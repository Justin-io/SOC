import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const target = `http://localhost:${process.env.PORT || 3000}`;

const proxyOptions = {
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
        '/api': proxyOptions,
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      proxy: {
        '/api': proxyOptions,
      },
    },
  };
});
