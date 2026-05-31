// Build marker: single React 18.3.1 enforced repo-wide (see root package.json overrides).
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@investiq/shared"],
};

export default nextConfig;
