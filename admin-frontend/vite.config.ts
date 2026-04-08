import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function adminRootRedirectPlugin() {
  const redirect = (req: { url?: string }, res: { statusCode?: number; setHeader: (name: string, value: string) => void; end: () => void }) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.statusCode = 302;
      res.setHeader('Location', '/admin/');
      res.end();
      return true;
    }
    return false;
  };

  return {
    name: 'admin-root-redirect',
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { statusCode?: number; setHeader: (name: string, value: string) => void; end: () => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        if (!redirect(req, res)) {
          next();
        }
      });
    },
    configurePreviewServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { statusCode?: number; setHeader: (name: string, value: string) => void; end: () => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        if (!redirect(req, res)) {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  base: '/admin/',
  plugins: [react(), adminRootRedirectPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern',
      },
    },
  },
  server: {
    port: 3200,
    open: '/admin/',
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  preview: {
    open: '/admin/',
  },
});

