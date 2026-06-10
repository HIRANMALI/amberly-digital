import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // PERF_OPT: Added prefetch to speed up navigation. Remove the `prefetch` block if you don't want it.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    react(),
  ],
  vite: {
    plugins: [
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  },
});
