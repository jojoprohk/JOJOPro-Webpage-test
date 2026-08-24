import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@jopojo/ai"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  webpack: (config) => {
    config.resolve.alias["@jopojo/ai"] = path.join(
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

export default nextConfig;
