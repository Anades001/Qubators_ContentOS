import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { FeatureDisabledError, assertFeature, type FeatureFlags } from "@contentos/config";
import { buildKey, verifyLocalSignature, type StorageAdapter } from "@contentos/storage";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/** Everything the HTTP layer needs, injected so tests can run without Postgres or BetterAuth. */
export interface AppDeps {
  flags: FeatureFlags;
  storage: StorageAdapter;
  /** Used to verify local presigned URLs (same secret LocalStorage signs with). */
  signingSecret: string;
  appUrl: string;
  /** BetterAuth's node handler, mounted at /api/auth/*. */
  authHandler: (req: Request, res: Response) => unknown;
  getSessionUser: (req: Request) => Promise<SessionUser | null>;
  /** Returns true if the user owns the brand. */
  userOwnsBrand: (userId: string, brandId: string) => Promise<boolean>;
  pingDb: () => Promise<void>;
  version?: string;
}

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
const route = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res, next).catch(next);
};

const presignBody = z.object({
  brandId: z.string().min(1),
  filename: z.string().min(1).max(200),
  contentType: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/, "invalid content type"),
});

const splatKey = (req: Request) => {
  const raw = (req.params as Record<string, string | string[] | undefined>).key;
  return Array.isArray(raw) ? raw.join("/") : (raw ?? "");
};

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable("x-powered-by");

  // Minimal CORS for the Next.js app in dev (same-origin behind Caddy in prod).
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin === deps.appUrl) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // BetterAuth must see the raw request body, so it is mounted before express.json().
  app.all("/api/auth/*splat", (req, res) => {
    void deps.authHandler(req, res);
  });

  // Local storage driver endpoints: mimic S3 presigned PUT/GET.
  app.put(
    "/api/storage/local/*key",
    express.raw({ type: () => true, limit: "25mb" }),
    route(async (req, res) => {
      const key = splatKey(req);
      const contentType = req.headers["content-type"] ?? "";
      const ok = verifyLocalSignature(deps.signingSecret, {
        method: "PUT",
        key,
        expires: req.query.expires as string | undefined,
        sig: req.query.sig as string | undefined,
        contentType,
      });
      if (!ok) throw new HttpError(403, "Invalid or expired signature");
      await deps.storage.put(key, req.body instanceof Buffer ? req.body : Buffer.alloc(0), contentType);
      res.sendStatus(200);
    }),
  );

  app.get(
    "/api/storage/local/*key",
    route(async (req, res) => {
      const key = splatKey(req);
      const ok = verifyLocalSignature(deps.signingSecret, {
        method: "GET",
        key,
        expires: req.query.expires as string | undefined,
        sig: req.query.sig as string | undefined,
      });
      if (!ok) throw new HttpError(403, "Invalid or expired signature");
      const body = await deps.storage.get(key);
      if (!body) throw new HttpError(404, "Not found");
      res.setHeader("Cache-Control", "private, max-age=300");
      res.send(Buffer.from(body));
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  app.get(
    "/api/health",
    route(async (_req, res) => {
      let db: "ok" | "error" = "ok";
      try {
        await deps.pingDb();
      } catch {
        db = "error";
      }
      res.status(db === "ok" ? 200 : 503).json({
        status: db === "ok" ? "ok" : "degraded",
        version: deps.version ?? "0.0.0",
        checks: { db, storage: deps.storage.driver },
      });
    }),
  );

  app.get("/api/flags", (_req, res) => {
    res.json(deps.flags);
  });

  const requireUser = async (req: Request): Promise<SessionUser> => {
    const user = await deps.getSessionUser(req);
    if (!user) throw new HttpError(401, "Unauthorized");
    return user;
  };

  app.get(
    "/api/me",
    route(async (req, res) => {
      res.json({ user: await requireUser(req) });
    }),
  );

  app.post(
    "/api/uploads/presign",
    route(async (req, res) => {
      const user = await requireUser(req);
      const parsed = presignBody.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));
      const { brandId, filename, contentType } = parsed.data;
      if (!(await deps.userOwnsBrand(user.id, brandId))) throw new HttpError(404, "Brand not found");
      const key = buildKey("originals", brandId, filename);
      const upload = await deps.storage.presignPut(key, contentType);
      res.status(201).json({ key, upload });
    }),
  );

  // Gated modules: present in the router so the shape is fixed, off until their phase lands.
  const gated = (flag: keyof FeatureFlags, name: string) =>
    route(async () => {
      assertFeature(deps.flags, flag);
      throw new HttpError(501, `${name} is not implemented yet`);
    });
  app.all("/api/publisher/*splat", gated("publisher", "Publisher"));
  app.all("/api/analytics/*splat", gated("analytics", "Analytics"));
  app.all("/api/images/*splat", gated("imageGen", "Image generation"));
  app.all("/api/billing/*splat", gated("billing", "Billing"));

  app.use("/api", (_req, _res, next) => next(new HttpError(404, "Not found")));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof FeatureDisabledError) {
      res.status(404).json({ error: err.message, feature: err.flag });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
