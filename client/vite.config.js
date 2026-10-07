import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api to the Express server so session cookies stay same-origin.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': { target: 'http://localhost:5000', changeOrigin: false }
        }
    },
    build: { outDir: 'dist' }
});
