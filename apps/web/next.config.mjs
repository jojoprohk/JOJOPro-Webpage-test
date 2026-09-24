import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@jojopro/ai"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  env: {
    // Next.js only exposes NEXT_PUBLIC_* values to browser bundles. The DSN
    // is client-safe, so bridge the existing SENTRY_DSN value for the client
    // instrumentation file while keeping one source of truth in Vercel.
    NEXT_PUBLIC_SENTRY_DSN:
      process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "",
  },
  webpack: (config) => {
    config.resolve.alias["@jojopro/ai"] = path.join(
      __dirname,
      "../../packages/ai/src/index.ts",
    );
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };

    return config;
  },
  experimental: {
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    },
  },
};

// Sentry build-time source map upload + bundle instrumentation.
// If SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT are unset the
// plugin no-ops, so local dev builds still work without env vars.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: !process.env.CI,
  debug: false,
});
