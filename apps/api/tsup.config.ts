import { defineConfig } from "tsup";

// Bundle workspace packages (they ship TS source); keep npm deps external.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  sourcemap: true,
  noExternal: [/^@contentos\//],
  // Their transitive deps are listed in this package.json so they stay external too.
});
