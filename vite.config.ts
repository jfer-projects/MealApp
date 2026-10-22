import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'scan-debug-logger',
      configureServer(server) {
        server.middlewares.use('/__scan_debug', (req, res) => {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            console.log('\n[PHONE SCAN DEBUG]:', body);
            res.statusCode = 200;
            res.end('ok');
          });
        });
      },
    },
  ],
  server: {
    host: true,
  },
});
