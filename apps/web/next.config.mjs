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
    // @investiq/shared is TypeScript ESM with ".js" import specifiers; map
    // those back to the .ts sources when webpack transpiles the package.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
