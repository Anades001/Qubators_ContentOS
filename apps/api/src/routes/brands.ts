import { Router } from "express";
import { z } from "zod";
import {
  BRAND_DNA_PROMPT_VERSION,
  BRAND_DNA_SYSTEM,
  StructuredOutputError,
  brandDnaSchema,
  buildBrandDnaPrompt,
  generateStructured,
  scanClaims,
  type LlmClient,
} from "@contentos/ai";
import { Platform, Prisma, type Brand, type PrismaClient } from "@contentos/db";
import { HttpError, parseBody, route, type RequireUser } from "../http";

export interface BrandsDeps {
  db: PrismaClient;
  llm: LlmClient;
}

// ─── Input schemas ───────────────────────────────────────────────

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  text(max)
    .nullish()
    .transform((v) => (v ? v : null));
const stringList = (maxItems: number, maxLen = 120) =>
  z
    .array(text(maxLen))
    .max(maxItems)
    .default([])
    .transform((items) => [...new Set(items.filter(Boolean))]);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a #RRGGBB colour");

export const brandInputSchema = z.object({
  name: text(80).min(1, "Brand name is required"),
  industry: optionalText(120),
  products: stringList(20),
  audience: optionalText(500),
  platforms: z.array(z.enum(Platform)).max(7).default([]),
  personality: optionalText(300),
  tone: optionalText(300),
  goals: stringList(10, 200),
  visualStyle: optionalText(300),
  colors: z.record(z.string().max(30), hex).nullish(),
  logoUrl: z.string().url().max(500).nullish(),
});
const brandPatchSchema = brandInputSchema.partial();

const dnaInputSchema = z.object({
  voice: stringList(10).refine((v) => v.length > 0, "Add at least one voice trait"),
  pillars: stringList(10).refine((v) => v.length > 0, "Add at least one content pillar"),
  ctas: stringList(10, 200),
  usePhrases: stringList(20),
  avoidPhrases: stringList(20),
  guidelines: optionalText(3000),
  sourceAiJobId: z.string().max(40).nullish(),
});

// ─── Helpers ─────────────────────────────────────────────────────

function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "brand"
  );
}

async function uniqueSlug(db: PrismaClient, ownerId: string, name: string): Promise<string> {
  const base = slugify(name);
  const taken = new Set(
    (await db.brand.findMany({ where: { ownerId, slug: { startsWith: base } }, select: { slug: true } })).map(
      (b) => b.slug,
    ),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

type Param = string | string[] | undefined;
const one = (p: Param) => (Array.isArray(p) ? p[0] : p);

const versionParam = (raw: Param) => {
  const v = Number(one(raw));
  if (!Number.isInteger(v) || v < 1) throw new HttpError(400, "Invalid version");
  return v;
};

// ─── Router ──────────────────────────────────────────────────────

export function brandsRouter({ db, llm }: BrandsDeps, requireUser: RequireUser) {
  const router = Router();

  async function ownedBrand(userId: string, rawId: Param): Promise<Brand> {
    const brandId = one(rawId);
    const brand = brandId ? await db.brand.findFirst({ where: { id: brandId, ownerId: userId } }) : null;
    if (!brand) throw new HttpError(404, "Brand not found");
    return brand;
  }

  const currentDna = (brandId: string) =>
    db.brandDna.findFirst({ where: { brandId }, orderBy: { version: "desc" } });

  /** Appends a DNA version; retries once if two saves race for the same number. */
  async function appendDna(
    brandId: string,
    data: Omit<Prisma.BrandDnaUncheckedCreateInput, "brandId" | "version">,
  ) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const latest = await db.brandDna.aggregate({ where: { brandId }, _max: { version: true } });
      try {
        return await db.brandDna.create({
          data: { ...data, brandId, version: (latest._max.version ?? 0) + 1 },
        });
      } catch (err) {
        if (!isUniqueViolation(err) || attempt === 1) throw err;
      }
    }
    throw new HttpError(409, "Could not save DNA version");
  }

  router.get(
    "/",
    route(async (req, res) => {
      const user = await requireUser(req);
      const brands = await db.brand.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: "asc" },
        include: { dna: { orderBy: { version: "desc" }, take: 1, select: { version: true } } },
      });
      res.json({
        brands: brands.map(({ dna, ...b }) => ({ ...b, dnaVersion: dna[0]?.version ?? null })),
      });
    }),
  );

  router.post(
    "/",
    route(async (req, res) => {
      const user = await requireUser(req);
      const input = parseBody(brandInputSchema, req.body);
      for (let attempt = 0; ; attempt++) {
        try {
          const brand = await db.brand.create({
            data: {
              ...input,
              colors: input.colors ?? Prisma.DbNull,
              logoUrl: input.logoUrl ?? null,
              ownerId: user.id,
              slug: await uniqueSlug(db, user.id, input.name),
            },
          });
          res.status(201).json({ brand });
          return;
        } catch (err) {
          if (!isUniqueViolation(err) || attempt >= 2) throw err;
        }
      }
    }),
  );

  router.get(
    "/:id",
    route(async (req, res) => {
      const user = await requireUser(req);
      const brand = await ownedBrand(user.id, req.params.id);
      res.json({ brand, dna: await currentDna(brand.id) });
    }),
  );

  router.patch(
    "/:id",
    route(async (req, res) => {
      const user = await requireUser(req);
      const brand = await ownedBrand(user.id, req.params.id);
      const parsed = parseBody(brandPatchSchema, req.body);
      // zod applies list defaults even to omitted keys; only touch fields the client actually sent.
      const sent = new Set(Object.keys((req.body ?? {}) as object));
      const { colors, ...rest } = Object.fromEntries(
        Object.entries(parsed).filter(([k]) => sent.has(k)),
      ) as Partial<typeof parsed>;
      const updated = await db.brand.update({
        where: { id: brand.id },
        data: { ...rest, ...(colors !== undefined ? { colors: colors ?? Prisma.DbNull } : {}) },
      });
      res.json({ brand: updated });
    }),
  );

  router.delete(
    "/:id",
    route(async (req, res) => {
      const user = await requireUser(req);
      const brand = await ownedBrand(user.id, req.params.id);
      await db.brand.delete({ where: { id: brand.id } });
      res.sendStatus(204);
    }),
  );

  // ── Brand DNA ──

  router.post(
    "/:id/dna/generate",
    route(async (req, res) => {
      const user = await requireUser(req);
      const brand = await ownedBrand(user.id, req.params.id);
      const input = {
        name: brand.name,
        industry: brand.industry,
        products: brand.products,
        audience: brand.audience,
        platforms: brand.platforms,
        personality: brand.personality,
        tone: brand.tone,
        goals: brand.goals,
        visualStyle: brand.visualStyle,
      };
      const job = await db.aiJob.create({
        data: {
          brandId: brand.id,
          kind: "brand-dna",
          model: llm.model,
          promptVersion: BRAND_DNA_PROMPT_VERSION,
          status: "RUNNING",
          input,
        },
      });

      try {
        const result = await generateStructured(llm, {
          system: BRAND_DNA_SYSTEM,
          prompt: buildBrandDnaPrompt(input),
          schema: brandDnaSchema,
        });
        // Avoid-phrases are *meant* to name risky claims, so they are not scanned.
        const { voice, ctas, usePhrases, pillars, guidelines } = result.data;
        const verified = await db.asset.findMany({
          where: { brandId: brand.id, text: { not: null } },
          select: { text: true },
        });
        const guardrailWarnings = scanClaims(
          [...voice, ...ctas, ...usePhrases, ...pillars, guidelines],
          verified.map((a) => a.text ?? ""),
        );
        await db.aiJob.update({
          where: { id: job.id },
          data: {
            status: "SUCCEEDED",
            resultJson: result.data,
            attempts: result.attempts,
            evalMs: result.evalMs,
            completedAt: new Date(),
          },
        });
        res.json({
          aiJobId: job.id,
          resultJson: result.data,
          model: llm.model,
          promptVersion: BRAND_DNA_PROMPT_VERSION,
          evalMs: result.evalMs,
          guardrailWarnings,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.aiJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            error: message.slice(0, 2000),
            attempts: err instanceof StructuredOutputError ? err.attempts : 1,
            completedAt: new Date(),
          },
        });
        const unreachable = /fetch failed|ECONNREFUSED|ENOTFOUND/i.test(message);
        throw new HttpError(
          502,
          unreachable
            ? "The AI model is not reachable. Is Ollama running? (or set AI_DRIVER=mock)"
            : "The AI could not produce a valid Brand DNA. Try again or fill it in manually.",
        );
      }
    }),
  );

  router.get(
    "/:id/dna",
    route(async (req, res) => {
      const user = await requireUser(req);
      const brand = await ownedBrand(user.id, req.params.id);
      res.json({ dna: await currentDna(brand.id) });
    }),
  );

  /** Saving always creates a new version — history is never overwritten. */
  router.post(
    "/:id/dna",
    route(async (req, res) => {
      const user = await requireUser(req);
      const brand = await ownedBrand(user.id, req.params.id);
      const { sourceAiJobId, ...input } = parseBody(dnaInputSchema, req.body);
      if (sourceAiJobId) {
        const job = await db.aiJob.findFirst({ where: { id: sourceAiJobId, brandId: brand.id } });
        if (!job) throw new HttpError(400, "sourceAiJobId does not belong to this brand");
      }
      const dna = await appendDna(brand.id, { ...input, sourceAiJobId: sourceAiJobId ?? null });
      res.status(201).json({ dna });
    }),
  );

  router.get(
    "/:id/dna/versions",
    route(async (req, res) => {
      const user = await requireUser(req);
      const brand = await ownedBrand(user.id, req.params.id);
      const versions = await db.brandDna.findMany({
        where: { brandId: brand.id },
        orderBy: { version: "desc" },
        select: { id: true, version: true, createdAt: true, sourceAiJobId: true },
      });
      res.json({ versions });
    }),
  );

  router.get(
    "/:id/dna/versions/:version",
    route(async (req, res) => {
      const user = await requireUser(req);
      const brand = await ownedBrand(user.id, req.params.id);
      const version = versionParam(req.params.version);
      const dna = await db.brandDna.findUnique({
        where: { brandId_version: { brandId: brand.id, version } },
      });
      if (!dna) throw new HttpError(404, "Version not found");
      res.json({ dna });
    }),
  );

  /** Restoring copies an old version forward as the newest one. */
  router.post(
    "/:id/dna/versions/:version/restore",
    route(async (req, res) => {
      const user = await requireUser(req);
      const brand = await ownedBrand(user.id, req.params.id);
      const version = versionParam(req.params.version);
      const old = await db.brandDna.findUnique({
        where: { brandId_version: { brandId: brand.id, version } },
      });
      if (!old) throw new HttpError(404, "Version not found");
      const dna = await appendDna(brand.id, {
        voice: old.voice,
        pillars: old.pillars,
        ctas: old.ctas,
        usePhrases: old.usePhrases,
        avoidPhrases: old.avoidPhrases,
        guidelines: old.guidelines,
        sourceAiJobId: old.sourceAiJobId,
      });
      res.status(201).json({ dna });
    }),
  );

  return router;
}
