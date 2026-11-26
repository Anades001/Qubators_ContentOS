import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockLlmClient, createMockLlm, type LlmClient } from "@contentos/ai";
import { LocalStorage } from "@contentos/storage";
import { createApp } from "../src/app";

/**
 * Integration tests against a real Postgres (DATABASE_URL). Each run uses fresh users and
 * deletes them afterwards (brands, DNA and AI jobs cascade).
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const { prisma } = hasDb ? await import("@contentos/db") : { prisma: undefined as never };

const run = randomUUID().slice(0, 8);
const alice = { id: `test_alice_${run}`, email: `alice_${run}@test.local`, name: "Alice" };
const bob = { id: `test_bob_${run}`, email: `bob_${run}@test.local`, name: "Bob" };

function makeApp(llm: LlmClient = createMockLlm()) {
  return createApp({
    flags: { publisher: false, analytics: false, imageGen: false, billing: false },
    storage: new LocalStorage({
      rootDir: "/tmp",
      bucket: "t",
      publicBaseUrl: "http://x",
      signingSecret: "s".repeat(32),
    }),
    signingSecret: "s".repeat(32),
    appUrl: "http://localhost:3000",
    authHandler: (_req, res) => res.sendStatus(204),
    getSessionUser: async (req) => {
      const id = req.headers["x-test-user"];
      return id === alice.id ? alice : id === bob.id ? bob : null;
    },
    userOwnsBrand: async () => false,
    pingDb: async () => {},
    brands: { db: prisma, llm },
  });
}

const brandBody = {
  name: "Ombra Fiore",
  industry: "Crochet fashion",
  products: ["Crochet phone pouch", "Crochet phone pouch", " "],
  audience: "Young fashion-conscious customers",
  platforms: ["INSTAGRAM", "TIKTOK"],
  tone: "Warm, artistic, feminine",
  goals: ["Launch new product"],
  visualStyle: "Minimal, soft luxury",
  colors: { primary: "#E8B4B8" },
};

describe.skipIf(!hasDb)("brands + Brand DNA (integration)", () => {
  const app = makeApp();
  const as = (user: { id: string }) => ({ "x-test-user": user.id });

  beforeAll(async () => {
    await prisma.user.createMany({ data: [alice, bob] });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [alice.id, bob.id] } } });
    await prisma.$disconnect();
  });

  let brandId = "";

  it("requires a session", async () => {
    expect((await request(app).get("/api/brands")).status).toBe(401);
  });

  it("validates brand input", async () => {
    const res = await request(app)
      .post("/api/brands")
      .set(as(alice))
      .send({ name: "", platforms: ["MYSPACE"] });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(["name", "platforms.0"]),
    );
  });

  it("creates brands with unique slugs and cleaned lists", async () => {
    const res = await request(app).post("/api/brands").set(as(alice)).send(brandBody);
    expect(res.status).toBe(201);
    expect(res.body.brand).toMatchObject({
      slug: "ombra-fiore",
      products: ["Crochet phone pouch"],
      ownerId: alice.id,
    });
    brandId = res.body.brand.id;

    const second = await request(app).post("/api/brands").set(as(alice)).send({ name: "Ombra Fiore" });
    expect(second.body.brand.slug).toBe("ombra-fiore-2");

    const list = await request(app).get("/api/brands").set(as(alice));
    expect(list.body.brands).toHaveLength(2);
    expect(list.body.brands[0].dnaVersion).toBeNull();
  });

  it("hides other users' brands", async () => {
    expect((await request(app).get(`/api/brands/${brandId}`).set(as(bob))).status).toBe(404);
    expect((await request(app).post(`/api/brands/${brandId}/dna/generate`).set(as(bob))).status).toBe(404);
    expect((await request(app).get("/api/brands").set(as(bob))).body.brands).toEqual([]);
  });

  it("updates a brand", async () => {
    const res = await request(app)
      .patch(`/api/brands/${brandId}`)
      .set(as(alice))
      .send({ personality: "Quietly confident" });
    expect(res.status).toBe(200);
    expect(res.body.brand.personality).toBe("Quietly confident");
    // Untouched fields survive a partial update.
    expect(res.body.brand).toMatchObject({
      colors: { primary: "#E8B4B8" },
      tone: "Warm, artistic, feminine",
      products: ["Crochet phone pouch"],
      platforms: ["INSTAGRAM", "TIKTOK"],
    });
  });

  let aiJobId = "";

  it("generates a DNA draft and logs the AI job", async () => {
    const res = await request(app).post(`/api/brands/${brandId}/dna/generate`).set(as(alice));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ model: "mock", promptVersion: "brand-dna@1", guardrailWarnings: [] });
    expect(res.body.resultJson.voice).toContain("Warm");
    aiJobId = res.body.aiJobId;

    const job = await prisma.aiJob.findUniqueOrThrow({ where: { id: aiJobId } });
    expect(job).toMatchObject({ status: "SUCCEEDED", kind: "brand-dna", attempts: 1 });
    // Generating does not save a version on its own.
    expect((await request(app).get(`/api/brands/${brandId}/dna`).set(as(alice))).body.dna).toBeNull();
  });

  it("flags risky claims in the draft", async () => {
    const llm = new MockLlmClient(() =>
      JSON.stringify({
        voice: ["Warm", "Bold", "Honest"],
        pillars: ["Craft", "Style", "BTS"],
        ctas: ["Shop the best pouch in Lagos", "DM us"],
        usePhrases: ["100% organic cotton", "handmade"],
        avoidPhrases: ["cheap", "guaranteed"],
        guidelines: "Keep it warm and specific to the craft.",
      }),
    );
    const res = await request(makeApp(llm)).post(`/api/brands/${brandId}/dna/generate`).set(as(alice));
    expect(res.body.guardrailWarnings.map((w: { claim: string }) => w.claim)).toEqual([
      "best",
      "100% organic",
    ]);
  });

  it("records failed AI jobs and returns 502", async () => {
    const llm = new MockLlmClient(() => "nonsense");
    const res = await request(makeApp(llm)).post(`/api/brands/${brandId}/dna/generate`).set(as(alice));
    expect(res.status).toBe(502);
    const failed = await prisma.aiJob.findFirst({ where: { brandId, status: "FAILED" } });
    expect(failed?.attempts).toBe(3);
  });

  it("saves edits as new versions and can restore old ones", async () => {
    const v1 = await request(app)
      .post(`/api/brands/${brandId}/dna`)
      .set(as(alice))
      .send({
        voice: ["Warm"],
        pillars: ["Craft"],
        ctas: [],
        usePhrases: [],
        avoidPhrases: [],
        guidelines: "v1",
        sourceAiJobId: aiJobId,
      });
    expect(v1.status).toBe(201);
    expect(v1.body.dna).toMatchObject({ version: 1, sourceAiJobId: aiJobId });

    const v2 = await request(app)
      .post(`/api/brands/${brandId}/dna`)
      .set(as(alice))
      .send({ voice: ["Warm", "Playful"], pillars: ["Craft"], guidelines: "v2" });
    expect(v2.body.dna.version).toBe(2);

    const restored = await request(app).post(`/api/brands/${brandId}/dna/versions/1/restore`).set(as(alice));
    expect(restored.body.dna).toMatchObject({ version: 3, guidelines: "v1", voice: ["Warm"] });

    const versions = await request(app).get(`/api/brands/${brandId}/dna/versions`).set(as(alice));
    expect(versions.body.versions.map((v: { version: number }) => v.version)).toEqual([3, 2, 1]);

    const current = await request(app).get(`/api/brands/${brandId}`).set(as(alice));
    expect(current.body.dna.version).toBe(3);
  });

  it("rejects empty DNA and foreign AI jobs", async () => {
    const empty = await request(app)
      .post(`/api/brands/${brandId}/dna`)
      .set(as(alice))
      .send({ voice: [], pillars: [] });
    expect(empty.status).toBe(400);
    const foreign = await request(app)
      .post(`/api/brands/${brandId}/dna`)
      .set(as(alice))
      .send({ voice: ["x"], pillars: ["y"], sourceAiJobId: "nope" });
    expect(foreign.status).toBe(400);
  });

  it("handles concurrent saves without losing a version", async () => {
    const body = { voice: ["Warm"], pillars: ["Craft"] };
    const results = await Promise.all(
      [1, 2, 3].map(() => request(app).post(`/api/brands/${brandId}/dna`).set(as(alice)).send(body)),
    );
    const ok = results.filter((r) => r.status === 201).map((r) => r.body.dna.version as number);
    expect(new Set(ok).size).toBe(ok.length);
    expect(ok.length).toBeGreaterThanOrEqual(2);
  });

  it("deletes a brand and its DNA", async () => {
    expect((await request(app).delete(`/api/brands/${brandId}`).set(as(alice))).status).toBe(204);
    expect(await prisma.brandDna.count({ where: { brandId } })).toBe(0);
  });
});
