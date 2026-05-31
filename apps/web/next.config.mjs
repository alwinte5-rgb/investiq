/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@investiq/shared"],
  webpack: (config) => {
    // Railway mounts .next/cache and node_modules/.cache as persistent volumes.
    // A corrupted webpack cache from earlier builds was poisoning the prerender
    // ("Cannot read properties of null (reading 'useContext')") — the same code
    // builds green on a clean Linux runner (verified via GitHub Actions).
    // Disabling the filesystem cache makes every Railway build fresh.
    config.cache = false;
    return config;
  },
};

export default nextConfig;
