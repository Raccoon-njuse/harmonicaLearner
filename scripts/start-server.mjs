import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');

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

const server = createServer((req, res) => {
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
