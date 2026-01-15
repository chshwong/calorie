const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Get the project root (apps/native directory)
// This ensures Metro treats apps/native as the isolated project root
const projectRoot = __dirname;

// Get workspace root (repo root) to explicitly exclude it
const workspaceRoot = path.resolve(projectRoot, "../..");
const rootAppFolder = path.join(workspaceRoot, "app");

// Get default Expo config with explicit project root
const config = getDefaultConfig(projectRoot);

// CRITICAL: Explicitly set project root to apps/native
// This tells Metro and Expo Router where the app directory is
config.projectRoot = projectRoot;

// CRITICAL: Restrict watchFolders to ONLY apps/native
// This prevents Metro from watching/scanning the repo root or ../app folder
config.watchFolders = [projectRoot];

// CRITICAL: Block the root-level app folder from being scanned
// This prevents Expo Router from treating ../app as routes
// Use RegExp patterns that work on both Windows and Unix
const rootAppPattern = rootAppFolder.replace(/\\/g, "/"); // Normalize to forward slashes
config.resolver = {
  ...config.resolver,
  blockList: [
    // Block the entire root app folder (works on both Windows and Unix)
    new RegExp(`${rootAppPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*`),
  ],
  // Ensure node_modules resolution works correctly
  nodeModulesPaths: [
    path.resolve(projectRoot, "node_modules"),
  ],
  // Keep source extensions including SVG
  sourceExts: [...config.resolver.sourceExts, "svg"],
};

// Transformer config for SVG support
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer"),
};

// Filter out SVG from asset extensions (SVG should be treated as source)
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== "svg");

module.exports = config;
