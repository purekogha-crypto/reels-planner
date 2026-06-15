const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const DATA_FILE = path.join(dir, 'schedule.json');
const TOKEN = '8120281989:AAG3GaKrQlAAPedaA8Ub6XGVdm7cLEwRgYs';

const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'
};

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { users: {} }; }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function sendTelegram(chatId, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
    const req = https.request(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function checkReminders() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const msk = new Date(utc + 3 * 60 * 60000);
  const day = msk.getDay();
  const h = msk.getHours();
  const m = msk.getMinutes();
  const todayKey = `${day}-${h}-${m}`;

  const data = loadData();
  for (const [chatId, user] of Object.entries(data.users)) {
    if (user.filmDays && user.filmDays.includes(day) && user.hour === h && user.minute === m) {
      if (user.lastSent !== todayKey) {
        user.lastSent = todayKey;
        sendTelegram(chatId, '🎬 Время снять новый Reels!\n\nОткройте Reels Planner и получите свежие идеи для контента.')
          .then(r => console.log(`Reminder sent to ${chatId}:`, r.ok))
          .catch(e => console.error(`Failed to send to ${chatId}:`, e.message));
      }
    }
  }
  saveData(data);
}

setInterval(checkReminders, 15000);
console.log('Reminder checker started');

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  if (req.url === '/api/schedule' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const { chatId, filmDays, hour, minute } = JSON.parse(body);
      const data = loadData();
      data.users[chatId] = { filmDays, hour, minute, lastSent: data.users[chatId]?.lastSent || '' };
      saveData(data);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  if (req.url === '/api/schedule' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(loadData()));
    return;
  }

  if (req.url === '/api/test' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      const { chatId } = JSON.parse(body);
      const result = await sendTelegram(chatId, '✅ Бот подключен! Напоминания настроены.');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  if (req.url === '/api/ai' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const { provider, apiKey, prompt } = JSON.parse(body);
      let url, headers, data;

      if (provider === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        headers = { 'Content-Type': 'application/json' };
        data = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
      } else if (provider === 'openai') {
        url = 'https://api.openai.com/v1/chat/completions';
        headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
        data = JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.9 });
      } else if (provider === 'claude') {
        url = 'https://api.anthropic.com/v1/messages';
        headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
        data = JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] });
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ error: 'Unknown provider' }));
      }

      const proxyReq = https.request(url, { method: 'POST', headers }, (proxyRes) => {
        let d = '';
        proxyRes.on('data', c => d += c);
        proxyRes.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(d);
        });
      });
      proxyReq.on('error', (e) => {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: e.message }));
      });
      proxyReq.write(data);
      proxyReq.end();
    });
    return;
  }

  let url = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = path.join(dir, url);
  const ext = path.extname(file);
  try {
    const data = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
