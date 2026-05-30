const path = require("path");

module.exports = function (api) {
  api.cache(true);
  // In a monorepo, Expo's CLI sometimes fails to propagate the app root to
  // Metro's babel workers, so expo-router's require.context() isn't inlined.
  // Set it here (per-worker) so babel-preset-expo can inline it.
  process.env.EXPO_ROUTER_APP_ROOT =
    process.env.EXPO_ROUTER_APP_ROOT || path.resolve(__dirname, "app");

  return {
    presets: ["babel-preset-expo"],
  };
};
