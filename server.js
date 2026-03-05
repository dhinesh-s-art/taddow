const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 4173;
const ROOT = __dirname;
const STATE_FILE = path.join(ROOT, 'state.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const defaultState = {
  isAdmin: false,
  settings: {
    siteName: 'Best Sellers',
    pinterestConnected: false,
    pinterestAccount: '',
    intro: 'Handpicked best seller products pinned on Pinterest from Amazon, Flipkart, Meesho, and similar platforms.'
  },
  products: [],
  reactions: {},
  subscribers: [],
  activity: []
};

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return structuredClone(defaultState);
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return { ...defaultState, ...parsed };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState(next) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
}

let appState = loadState();
const sseClients = new Set();

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(payload));
}

function broadcast(eventType = 'state-updated') {
  const message = `event: ${eventType}\ndata: ${JSON.stringify({ state: appState, at: Date.now() })}\n\n`;
  for (const client of sseClients) client.write(message);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (requestUrl.pathname === '/api/state' && req.method === 'GET') {
    sendJson(res, 200, { state: appState });
    return;
  }

  if (requestUrl.pathname === '/api/state' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!body || typeof body.state !== 'object') {
        sendJson(res, 400, { error: 'state object required' });
        return;
      }
      appState = { ...defaultState, ...body.state, isAdmin: false };
      saveState(appState);
      broadcast(body.eventType || 'state-updated');
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (requestUrl.pathname === '/api/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('event: connected\ndata: {}\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  let requested = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  requested = path.normalize(requested).replace(/^\.\.(\/|\\|$)/, '');
  const filePath = path.join(ROOT, requested);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  serveFile(filePath, res);
});

server.listen(PORT, () => {
  console.log(`Best Sellers server running at http://0.0.0.0:${PORT}`);
});
