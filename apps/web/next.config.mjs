// Build marker: single React 18.3.1 repo-wide + cross-platform lockfile (linux swc included).
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@investiq/shared"],
};

export default nextConfig;
