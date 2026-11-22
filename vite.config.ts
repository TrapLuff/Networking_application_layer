import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const { APP_PORT = '3000', VITE_PORT = '5173' } = loadEnv(mode, process.cwd(), '');
  const proxy = { '/api': { target: `http://127.0.0.1:${APP_PORT}` } };

  return {
    plugins: [react()],
    server: { port: Number(VITE_PORT), strictPort: true, proxy },
    preview: { host: '127.0.0.1', proxy },
    build: {
      rollupOptions: {
        output: { manualChunks: { react: ['react', 'react-dom/client'] } },
      },
    },
  };
});
