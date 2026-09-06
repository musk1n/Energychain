declare const process: { env: Record<string, string | undefined> };

type AlertRequest = {
  channel?: 'telegram';
  message?: string;
  deepLink?: string;
};

export default async function handler(request: { method?: string; body?: AlertRequest }, response: { status: (code: number) => { json: (body: unknown) => void } }) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'POST required' });
  }

  const { channel, message, deepLink } = request.body || {};
  if (channel !== 'telegram') {
    return response.status(400).json({ error: 'Choose telegram.' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return response.status(503).json({ error: 'Telegram is not configured. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.' });
  }

  const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: `${message || 'EnergyChain grid alert'}\n\nOpen trade dashboard: ${deepLink || ''}`, disable_web_page_preview: false }) });

  if (!telegramResponse.ok) {
    return response.status(502).json({ error: 'Telegram rejected the alert.' });
  }

  const result = await telegramResponse.json() as { result?: { message_id?: number } };
  return response.status(200).json({ delivered: true, messageId: result.result?.message_id });
}
