import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const target = `http://localhost:${process.env.PORT || 3000}`;

// Standard proxy for REST API routes
const apiProxy = {
  target,
  changeOrigin: true,
  secure: false,
  configure: (proxy: any) => {
    proxy.on('error', (_err: any, _req: any, res: any) => {
      if (res.headersSent) return;
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Backend server unavailable' }));
    });
  },
};

// SSE proxy: disable timeouts so the long-lived streaming connection isn't killed
const sseProxy = {
  target,
  changeOrigin: true,
  secure: false,
  // Disable proxy timeout — SSE connections are indefinitely long
  timeout: 0,
  proxyTimeout: 0,
  configure: (proxy: any) => {
    // Forward the connection header so keep-alive is preserved
    proxy.on('proxyReq', (proxyReq: any) => {
      proxyReq.setHeader('Connection', 'keep-alive');
      proxyReq.setHeader('Cache-Control', 'no-cache');
      proxyReq.setHeader('Accept', 'text/event-stream');
    });
    proxy.on('error', (_err: any, _req: any, res: any) => {
      if (res.headersSent) return;
      // Send SSE-compatible error event instead of HTML
      res.writeHead(503, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'close',
      });
      res.end('event: error\ndata: {"error":"Backend unavailable"}\n\n');
    });
  },
};

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/api/events/stream': sseProxy,
        '/api': apiProxy,
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      proxy: {
        '/api/events/stream': sseProxy,
        '/api': apiProxy,
      },
    },
  };
});
