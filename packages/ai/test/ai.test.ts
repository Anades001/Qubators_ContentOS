import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  BRAND_DNA_SYSTEM,
  MockLlmClient,
  OllamaClient,
  StructuredOutputError,
  brandDnaSchema,
  buildBrandDnaPrompt,
  generateStructured,
  mockBrandDna,
  scanClaims,
  type BrandProfile,
} from "../src";

const brand: BrandProfile = {
  name: "Ombra Fiore",
  industry: "Crochet fashion",
  products: ["Crochet phone pouch"],
  audience: "Young fashion-conscious customers",
  platforms: ["INSTAGRAM"],
  personality: null,
  tone: "Warm, artistic, feminine",
  goals: ["Launch new product"],
  visualStyle: "Minimal, soft luxury",
};

describe("generateStructured", () => {
  const schema = z.object({ title: z.string().min(1) });

  it("returns validated data on the first good answer", async () => {
    const llm = new MockLlmClient(() => '{"title":"Hello"}');
    const res = await generateStructured(llm, { system: "s", prompt: "p", schema });
    expect(res).toMatchObject({ data: { title: "Hello" }, attempts: 1 });
  });

  it("extracts JSON wrapped in prose", async () => {
    const llm = new MockLlmClient(() => 'Sure! ```json\n{"title":"X"}\n```');
    expect((await generateStructured(llm, { system: "s", prompt: "p", schema })).data.title).toBe("X");
  });

  it("feeds validation errors back and retries", async () => {
    const llm = new MockLlmClient((_m, call) => (call === 1 ? '{"title":""}' : '{"title":"Fixed"}'));
    const res = await generateStructured(llm, { system: "s", prompt: "p", schema });
    expect(res.attempts).toBe(2);
    const retryMsg = llm.calls[1]!.at(-1)!;
    expect(retryMsg.role).toBe("user");
    expect(retryMsg.content).toMatch(/title/);
  });

  it("gives up after maxAttempts", async () => {
    const llm = new MockLlmClient(() => "not json at all");
    await expect(
      generateStructured(llm, { system: "s", prompt: "p", schema, maxAttempts: 2 }),
    ).rejects.toBeInstanceOf(StructuredOutputError);
    expect(llm.calls).toHaveLength(2);
  });
});

describe("brand DNA prompt", () => {
  it("includes the brand facts and marks gaps", () => {
    const prompt = buildBrandDnaPrompt(brand);
    expect(prompt).toContain("Name: Ombra Fiore");
    expect(prompt).toContain("Personality: (not provided");
    expect(BRAND_DNA_SYSTEM).toMatch(/ONLY a JSON object/);
  });

  it("mock draft satisfies the schema", () => {
    const draft = brandDnaSchema.parse(mockBrandDna(brand));
    expect(draft.voice).toContain("Warm");
    expect(draft.ctas[0]).toContain("Crochet phone pouch");
  });

  it("dedupes and clamps long lists", () => {
    const res = brandDnaSchema.parse({
      ...mockBrandDna(brand),
      voice: ["A", "A", "B", "C", "D", "E", "F", "G"],
    });
    expect(res.voice).toEqual(["A", "B", "C", "D", "E", "F"]);
  });
});

describe("OllamaClient", () => {
  it("calls /api/chat in JSON mode and reports eval time", async () => {
    let body: Record<string, unknown> = {};
    const fakeFetch = (async (url: string, init: RequestInit) => {
      expect(url).toBe("http://ollama.test:11434/api/chat");
      body = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({
          model: "m",
          message: { role: "assistant", content: '{"ok":true}' },
          done: true,
          total_duration: 1_500_000_000,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const client = new OllamaClient("http://ollama.test:11434", "mistral:7b-instruct", fakeFetch);
    const res = await client.chatJson([{ role: "user", content: "hi" }]);
    expect(body).toMatchObject({ model: "mistral:7b-instruct", format: "json", stream: false });
    expect(res).toEqual({ content: '{"ok":true}', evalMs: 1500 });
  });
});

describe("scanClaims", () => {
  it("flags unsupported claims once", () => {
    const w = scanClaims(["Our 100% organic yarn", "the best pouch", "100% organic again"]);
    expect(w.map((x) => x.claim)).toEqual(["100% organic", "best"]);
  });

  it("allows claims backed by brand material", () => {
    expect(scanClaims(["certified organic cotton"], ["Our cotton is certified organic (GOTS #123)"])).toEqual(
      [],
    );
  });
});

describe("createMockLlm", () => {
  it("drafts a Brand DNA from the real prompt", async () => {
    const { createMockLlm } = await import("../src");
    const res = await generateStructured(createMockLlm(), {
      system: BRAND_DNA_SYSTEM,
      prompt: buildBrandDnaPrompt(brand),
      schema: brandDnaSchema,
    });
    expect(res.attempts).toBe(1);
    expect(res.data.voice.slice(0, 3)).toEqual(["Warm", "Artistic", "Feminine"]);
    expect(res.data.guidelines).toContain("Ombra Fiore");
  });
});
