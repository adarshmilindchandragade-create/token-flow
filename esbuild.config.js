// esbuild.config.js — TokenFlow AI bundler
// Bundles src/extension.ts → dist/extension.js for VS Code extension host (Node.js, CJS)

const esbuild = require('esbuild');
const isWatch = process.argv.includes('--watch');
const isProd = process.env.NODE_ENV === 'production';

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  // 'vscode' is a special virtual module injected by VS Code — must be external
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: !isProd,
  minify: isProd,
  logLevel: 'info',
};

if (isWatch) {
  esbuild
    .context(config)
    .then((ctx) => {
      console.log('[TokenFlow] Watching for changes...');
      return ctx.watch();
    })
    .catch(() => process.exit(1));
} else {
  esbuild
    .build(config)
    .then(() => console.log('[TokenFlow] Build complete.'))
    .catch(() => process.exit(1));
}
