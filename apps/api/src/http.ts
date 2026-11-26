import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wraps an async handler so rejections reach the error middleware. */
export const route = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res, next).catch(next);
};

/** Parses input with zod or throws a 400 with field-level issues. */
export function parseBody<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new HttpError(
      400,
      issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; "),
      issues,
    );
  }
  return parsed.data;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export type RequireUser = (req: Request) => Promise<SessionUser>;
