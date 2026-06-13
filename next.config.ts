import path from "node:path";
import type { NextConfig } from "next";

// Chỉ bật static export khi build cho GitHub Pages.
// Vercel / Local dev không cần — để giữ API routes + dynamic features.
//   GITHUB_PAGES=1 npm run build   → static export với basePath
//   npm run build                  → Vercel-style server build
const isGithubPages = process.env.GITHUB_PAGES === "1";
const repoName = "ghn-network-ops";

const nextConfig: NextConfig = {
  reactCompiler: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
  ...(isGithubPages
    ? {
        output: "export" as const,
        basePath: `/${repoName}`,
        assetPrefix: `/${repoName}/`,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
