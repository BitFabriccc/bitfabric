import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';

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
    include: ['gun', 'buffer']
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        pricing: resolve(__dirname, 'pricing.html'),
        signup: resolve(__dirname, 'signup.html'),
        checkout: resolve(__dirname, 'checkout.html'),
        analytics: resolve(__dirname, 'analytics.html')
      }
    }
  }
});
