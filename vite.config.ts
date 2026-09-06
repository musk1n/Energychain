import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
  plugins: [react(), {
    name: 'local-telegram-alert-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== '/api/send-alert' || request.method !== 'POST') {
          next();
          return;
        }

        let body = '';
        request.on('data', chunk => { body += chunk; });
        request.on('end', async () => {
          try {
            const payload = JSON.parse(body) as { message?: string; deepLink?: string };
            const botToken = env.TELEGRAM_BOT_TOKEN?.trim();
            const chatId = env.TELEGRAM_CHAT_ID?.trim();
            if (!botToken || !chatId) {
              response.statusCode = 503;
              response.setHeader('Content-Type', 'application/json');
              response.end(JSON.stringify({ error: 'Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to .env, then restart Vite.' }));
              return;
            }

            const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: `${payload.message || 'EnergyChain grid alert'}\n\nOpen trade dashboard: ${payload.deepLink || ''}`
              })
            });
            const result = await telegramResponse.json() as { result?: { message_id?: number }; description?: string };
            response.statusCode = telegramResponse.ok ? 200 : 502;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(telegramResponse.ok ? { delivered: true, messageId: result.result?.message_id } : { error: result.description || 'Telegram rejected the alert.' }));
          } catch {
            response.statusCode = 400;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: 'Invalid alert request.' }));
          }
        });
      });
    }
  }],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  };
});
