import { defineConfig } from 'vite';

// Served by the Shuchu server at /desk. In development, Vite forwards the
// API to the server running on this computer.
const server = process.env.SHUCHU_SERVER ?? 'http://localhost:4545';

export default defineConfig({
  base: '/desk/',
  server: {
    port: 5175,
    proxy: { '/tasks': server, '/events': server, '/ping': server },
  },
});
