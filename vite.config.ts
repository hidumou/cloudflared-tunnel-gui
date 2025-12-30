import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    root: path.join(__dirname, 'src/renderer'),
    resolve: {
        alias: {
            '@renderer': path.resolve(__dirname, 'src/renderer'),
            '@common': path.resolve(__dirname, 'src/common'),
            '@': path.resolve(__dirname, 'src/renderer'), // Keep @ for backward compatibility
        },
    },
    base: './',
    build: {
        outDir: '../../dist/renderer',
        emptyOutDir: true,
    },
    server: {
        port: 3000,
    },
});
