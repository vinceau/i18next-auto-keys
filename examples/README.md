# Examples

This directory contains example configurations for using i18next-auto-keys with different bundlers.

## Available Examples

### Vite Example
- **Location**: `vite-example/`
- **File**: `vite.config.js`
- **Bundler**: Vite
- **Description**: Shows how to configure the Rollup plugin for Vite projects with React/Vue

### Rollup Example
- **Location**: `rollup-example/`
- **File**: `rollup.config.js`
- **Bundler**: Rollup
- **Description**: Shows how to configure the Rollup plugin for standalone Rollup projects

## Usage

These are configuration-only examples showing the plugin setup. To see a complete working example with message files and components, refer to the [e2e tests](../e2e/) in the project root.

## Key Differences

### Vite
- Uses the same `i18nextAutoKeyRollupPlugin` as Rollup
- Works in both dev mode (transform only) and build mode (full workflow)
- Supports HMR out of the box

### Rollup
- Uses `i18nextAutoKeyRollupPlugin`
- Always runs the full plugin lifecycle (buildStart → transform → generateBundle)
- Typically used for library builds or custom build setups

### Webpack (see main README)
- Uses separate `i18nextAutoKeyLoader` (loader) and `I18nextAutoKeyEmitPlugin` (plugin)
- More complex setup but provides fine-grained control
- The original implementation that started this project

## Migration

If you're migrating from Webpack to Vite or Rollup, your message files and application code remain completely unchanged. Only the build configuration needs to be updated.

See [USAGE_VITE_ROLLUP.md](../USAGE_VITE_ROLLUP.md) for detailed migration instructions.

