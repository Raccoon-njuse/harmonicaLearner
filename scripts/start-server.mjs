import { createReadStream, existsSync, statSync, readdirSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const scoresDir = join(rootDir, 'scores');
if (!existsSync(scoresDir)) mkdirSync(scoresDir, { recursive: true });

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function getPort() {
  const portArgIndex = process.argv.findIndex((arg) => arg === '--port' || arg === '-p');
  const rawPort = portArgIndex >= 0 ? process.argv[portArgIndex + 1] : process.env.PORT;
  const port = Number.parseInt(rawPort || '2001', 10);
  return Number.isInteger(port) && port > 0 ? port : 2001;
}

function resolveRequestPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const normalizedPath = normalize(decodedPath === '/' ? '/index.html' : decodedPath);
  const filePath = resolve(join(rootDir, normalizedPath));

  // 只允许访问项目目录内的静态文件，避免路径穿越。
  if (filePath !== rootDir && !filePath.startsWith(`${rootDir}${sep}`)) {
    return null;
  }

  return filePath;
}

function sendJson(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const server = createServer((req, res) => {
  const reqPath = (req.url || '/').split('?')[0];

  // GET /api/scores — list saved .txt files
  if (req.method === 'GET' && reqPath === '/api/scores') {
    try {
      const files = readdirSync(scoresDir).filter(f => f.endsWith('.txt')).sort();
      sendJson(res, 200, files);
    } catch { sendJson(res, 500, { error: 'Failed to list scores' }); }
    return;
  }

  // GET /api/scores/<name> — get score content
  if (req.method === 'GET' && reqPath.startsWith('/api/scores/')) {
    const name = decodeURIComponent(reqPath.slice('/api/scores/'.length));
    const fp = join(scoresDir, name);
    if (!fp.startsWith(scoresDir + sep)) { sendJson(res, 403, {}); return; }
    if (!existsSync(fp)) { sendJson(res, 404, {}); return; }
    try {
      sendJson(res, 200, { name, content: readFileSync(fp, 'utf-8') });
    } catch { sendJson(res, 500, {}); }
    return;
  }

  // POST /upload?name=… — save uploaded file
  if (req.method === 'POST' && reqPath === '/upload') {
    const url = new URL(req.url, 'http://localhost');
    let name = url.searchParams.get('name') || 'untitled.txt';
    name = name.replace(/[/\\]/g, '_');
    if (!name.endsWith('.txt')) name += '.txt';
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        writeFileSync(join(scoresDir, name), Buffer.concat(chunks).toString('utf-8'));
        sendJson(res, 200, { ok: true, name });
      } catch { sendJson(res, 500, {}); }
    });
    return;
  }

  const filePath = resolveRequestPath(req.url || '/');

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const contentType = mimeTypes[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  createReadStream(filePath).pipe(res);
});

const port = getPort();
server.listen(port, '0.0.0.0', () => {
  console.log(`口琴练习系统已启动：http://0.0.0.0:${port}`);
});
