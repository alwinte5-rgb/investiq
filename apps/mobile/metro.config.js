// Metro config for Expo inside a Turborepo monorepo.
// - Watches the repo root so workspace packages resolve.
// - Looks up hoisted deps from both the app and the root node_modules.
// - Forces a SINGLE react-native / react copy. Clerk-expo transitively pulls
//   Solana wallet adapters that depend on a newer react-native, which would
//   duplicate RN and break bundling; we redirect those imports to the root copy.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = false;

const FORCE_SINGLE = ["react-native", "react"];
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const forced = FORCE_SINGLE.find(
    (m) => moduleName === m || moduleName.startsWith(`${m}/`),
  );
  if (forced) {
    return {
      type: "sourceFile",
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
    };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
