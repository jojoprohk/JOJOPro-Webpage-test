import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// The source uses TypeScript extensionless/.js imports (ESM style).
// Map relative "./x.js" imports to the real "./x.ts" file on disk.
const tsExtensionPlugin = {
  name: "ts-extension",
  setup(b) {
    b.onResolve({ filter: /\.js$/ }, (args) => {
      if (args.kind === "entry-point") return null;
      const base = path.resolve(args.resolveDir, args.path);
      const tsCandidate = base.replace(/\.js$/, ".ts");
      if (existsSync(tsCandidate)) {
        return { path: tsCandidate };
      }
      return null;
    });
  },
};

await build({
  entryPoints: [path.join(__dirname, "telegram-webhook.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: path.join(__dirname, "dist/telegram-webhook.cjs"),
  // Only Node built-ins stay external — they are always available instantly.
  external: [
    "node:*",
  ],
  sourcemap: true,
  logLevel: "info",
  alias: {
    "@jojopro/ai": path.join(root, "packages/ai/src/index.ts"),
  },
  plugins: [tsExtensionPlugin],
});

console.log("[build] bundled to server/dist/telegram-webhook.mjs");
