import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig = {
  transpilePackages: ["@0g-databounty/shared"],
  outputFileTracingRoot: rootDir
};

export default nextConfig;
