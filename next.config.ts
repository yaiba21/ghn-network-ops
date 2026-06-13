import path from "node:path";
import type { NextConfig } from "next";

// GitHub Pages serves the repo under /<repo-name>/. Set basePath to match
// so internal links + assets resolve correctly. For local dev (npm run dev)
// we leave basePath empty.
const isProd = process.env.NODE_ENV === "production";
const repoName = "ghn-network-ops";

const nextConfig: NextConfig = {
  reactCompiler: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Static HTML export — works on any static host (GitHub Pages, S3, etc.).
  output: "export",
  // Required for GitHub Pages sub-path hosting.
  basePath: isProd ? `/${repoName}` : "",
  assetPrefix: isProd ? `/${repoName}/` : "",
  // GitHub Pages serves /foo/ as /foo/index.html — trailingSlash matches that.
  trailingSlash: true,
  // next/image's default loader needs a Node server; disable for static export.
  images: { unoptimized: true },
};

export default nextConfig;
