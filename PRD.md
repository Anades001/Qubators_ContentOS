# ContentOS – Implementation Plan (PRD Companion)

> Source PRD: `Documents/ContentOS.md` (43 sections). Overview: `README.md`. Visual contract: `design.html`.
> Status: Pre-MVP → MVP Core Loop. Stack locked for live-hosting.

## 1. Locked Decisions (live-minded)

- **Database:** PostgreSQL 16 (Docker volume `pgdata`, Prisma ORM, `pgvector` for Phase-2 search)
- **Auth:** BetterAuth (MIT, self-hosted, Postgres adapter: `user, session, account, verification`), Google social provider with `calendar` scope (single OAuth for app + GCal)
- **Storage:** Cloudflare R2 (S3-compatible via `aws-sdk v3`, presigned PUT/GET, bucket `contentos-assets`, prefixes `originals/`, `generated/`, `backups/`). Dev fallback `STORAGE_DRIVER=minio|local`
- **Payments:** Paystack (test mode in MVP, live-ready webhook). Plans: Free / Creator-Pro / Business / Agency (PRD §38). Tables `subscriptions`, `billing_events`
- **Email:** ZeptoMail via `emailAdapter` (verification, reset, digests, receipts). Dev driver = log + Mailhog, no send until domain verified
- **Realtime (MVP):** No Supabase, no sockets. SWR refetch + SSE (`/api/stream/*`) for Ollama token streaming. Upgrade path: `ws` + Redis later, no schema change
- **Hosting:** Local device now (Docker Compose), live-ready (same compose ships to VPS). Caddy reverse-proxy + auto-HTTPS via `{$DOMAIN}`
- **AI:** Ollama JS SDK (`ollama` npm), default `mistral:7b-instruct` (Apache-2.0, truly OSS), optional `llama3.1:8b` via `AI_MODEL=` (Llama Community License – conditional, needs attribution). Embeddings: `nomic-embed-text` local
- **Images:** Ollama is text-only → separate `sd-service` (SDXL-Turbo via ComfyUI/Diffusers API, Open RAIL-M). MVP text-first (save `imagePrompt` + placeholder), render async when GPU available

## 2. Free-Use Audit

| Component | License / Cost | Free? |
|---|---|---|
| Next.js, React, Node, TS, Prisma, Tailwind/shadcn, Docker, Caddy, PG | MIT/Apache/ISC/PostgreSQL Licence | ✅ Yes |
| BetterAuth, Ollama server + JS SDK | MIT | ✅ Yes (software; Ollama needs 8–16GB RAM for 8B) |
| Mistral 7B weights | Apache-2.0 | ✅ Yes |
| Llama 3.x weights | Llama Community License (AUP + 700M MAU clause + attribution) | ⚠️ Conditional – opt-in only |
| SDXL weights | CreativeML Open RAIL-M | ⚠️ Mostly free (use restrictions) |
| R2 (10GB + 10M ops free tier, no egress fee) | Commercial | ⚠️ Freemium – needs account/card |
| Google Calendar API (free quota) | Commercial | ⚠️ Free-with-limits |
| ZeptoMail (trial credits, then per-email) | Commercial | ❌ Paid – stub in MVP |
| Paystack (1.5%+₦100 NG, test mode free) | Commercial | ❌ Per-txn – test mode in MVP |

Fully-$0 local core = Next.js + Node + PG + BetterAuth + Ollama/Mistral + SSE + Docker. R2/ZeptoMail/Paystack isolated behind adapters.

## 3. Architecture

```
Docker Compose (local + VPS-identical)
├─ web: Next.js 14 App Router TS :3000 (Caddy → :443)
├─ api: Node NestJS/Express TS :4000 (REST)
├─ db: postgres:16 + pgvector :5432
├─ ollama: ollama/ollama :11434 (pull mistral + nomic-embed-text on boot)
├─ sd-service: ComfyUI/Diffusers :7860 (gated – CPU-slow, GPU-fast)
└─ mailhog: :8025 (dev email catcher) + minio profile (dev S3)

External: R2, ZeptoMail, Paystack, Google Calendar
Monorepo: apps/web, apps/api, packages/db, packages/ai, packages/storage, packages/email, packages/billing, packages/ui
```

API (REST first): `/brands, /brands/:id/dna/generate, /inbox/categorize, /ideas/generate, /ideas/:id/brief, /studio/generate, /studio/carousel, /images/generate, /content/:id/package, /content/:id/repurpose, /content-items, /campaigns, /calendar-events, /library, /integrations/gcal/*, /billing/paystack/*`. All AI routes return `{resultJson, model, promptVersion, evalMs, guardrailWarnings[]}`.

## 4. Data Model (Prisma)

`users (BetterAuth) + brands(ownerId, name, industry, products, audience, platforms[], personality, tone, goals[], visualStyle, colors, logoUrl) + brand_dna(brandId, voice[], pillars[], ctas[], use/avoidPhrases[], guidelines, version) + assets(storageUrl) + inbox_items(rawText, category, status) + ideas + briefs(hook, slidesJson) + content_items(type, platform[], payloadJson, imagePrompt, imageUrl, status idea→published, scheduledAt) + campaigns + calendar_events(source internal|gcal, gcalEventId) + gcal_connections(encrypted refresh) + subscriptions + billing_events + email_logs + ai_jobs(model, promptVersion, evalMs)`.

## 5. Phases

- **0 Scaffold:** compose, TS strict, lint/type/test, Prisma migrate, seed Ombra Fiore, R2/MinIO adapter, BetterAuth stub, flags for publisher/analytics
- **1 Auth + DNA (1wk):** wizard → `dna/generate` (Ollama JSON `format:'json'` + zod + retry) → editable versioned DNA
- **2 Inbox + Idea→Brief (1wk):** quick-add + categorize; idea form (goal/platform/pillar/product/format) → brief (hook + slides table)
- **3 Studio text + Carousel (1.5wk):** per-section regenerate (SSE), guardrail claim-scan vs assets/faqs → ⚠️ banner; save imagePrompt
- **4 Packaging + Repurpose (1wk):** 1-click `{instagram, tiktok, linkedin, pinterest}` bundle; repurpose selector
- **5 Library + pgvector + Calendar/Kanban/Campaigns + GCal sync (1.5wk):** filters, detail drawer idea→brief→assets; FullCalendar + Kanban sync; 14-day launch template; OAuth + sync worker (ContentOS-wins for own events)
- **6 Billing + Email test-mode + hardening:** quotas, audit log, e2e (signup→DNA→idea→brief→studio→calendar→GCal), `pg_dump` backup cron, cost (time) logging

Out of MVP: auto-publisher (stub `Scheduled`), Performance Intelligence, Gap Detector, Why-This-Idea, Email mining, team roles, Client Mode.

## 6. Infra – Docker + Caddy (live-ready)

`docker-compose.yml` services as §3. `Caddyfile`: `{$DOMAIN} { reverse_proxy web:3000; handle /api/* { reverse_proxy api:4000 } }` + auto-HTTPS. Local: `http://localhost:3000`. Backups: nightly `pg_dump` → R2 `backups/`. Same files deploy to VPS later.

## 7. Metrics / Risks

Metrics (PRD §37): DNA %, time-to-first-content, items/week, campaigns, GCal %. Risks: 7B JSON reliability → zod+retry; CPU image slowness → async + placeholder; GCal expiry → refresh worker; scope creep → flags.

## 8. Next

Build order §5. Need before launch: domain + R2 keys + Paystack live keys + ZeptoMail domain verify + GPU decision for SD.
