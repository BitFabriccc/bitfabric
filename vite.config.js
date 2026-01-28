import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    vue(),
    nodePolyfills({
      protocolImports: true
    })
  ],
  server: {
    port: 5173,
    strictPort: true
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  define: {
    'process.env': {}
  },
  optimizeDeps: {
    include: ['gun', 'simple-peer', 'bittorrent-tracker/client', 'buffer']
  },
  build: {
    target: 'esnext'
  }
});
