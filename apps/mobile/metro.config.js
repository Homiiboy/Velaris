const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const repositoryRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

// Allow Expo/Metro to load the same JSON contract as the native TV build.
config.watchFolders = [...new Set([...(config.watchFolders || []), repositoryRoot])];
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules')];
module.exports = config;
