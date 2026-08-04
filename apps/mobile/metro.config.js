const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Let Metro watch the whole workspace so it picks up changes in packages/core.
config.watchFolders = [workspaceRoot];

// pnpm symlinks workspace packages (e.g. @runner/core) into place; Metro must
// follow them. Hierarchical node_modules lookup stays ON (the default) —
// disabling it breaks resolution of pnpm's nested .pnpm/<pkg>/node_modules
// transitive dependencies, which normal Node module resolution walks up to
// find automatically.
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
