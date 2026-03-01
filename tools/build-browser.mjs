import { build } from 'esbuild';

// Bundles the library for CDN usage.
// Output is a single IIFE bundle that attaches to window.BitFabric
await build({
  entryPoints: ['dist/index.js'],
  outfile: 'dist/bitfabric.iife.js',
  bundle: true,
  format: 'iife',
  globalName: 'BitFabric',
  sourcemap: true,
  platform: 'browser',
  target: ['es2020'],
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});

await build({
  entryPoints: ['dist/index.js'],
  outfile: 'dist/bitfabric.iife.min.js',
  bundle: true,
  format: 'iife',
  globalName: 'BitFabric',
  sourcemap: true,
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});
