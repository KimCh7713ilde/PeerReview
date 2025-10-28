/** @type {import('next').NextConfig} */
const isCI = process.env.GITHUB_ACTIONS === "true";
const repo = "PeerReview";

export default {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Use basePath and assetPrefix only on GitHub Actions/Pages
  basePath: isCI ? `/${repo}` : "",
  assetPrefix: isCI ? `/${repo}/` : undefined,
};


