import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, normalize, extname, join } from 'node:path';
import process from 'node:process';

const host = '127.0.0.1';
const port = 4173;
const distRoot = resolve(process.cwd(), 'dist');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function resolveFilePath(requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split('?')[0] || '/');
  const normalizedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const candidatePath = normalize(join(distRoot, normalizedPath));
  if (!candidatePath.startsWith(distRoot)) {
    return null;
  }
  if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
    return candidatePath;
  }
  return resolve(distRoot, 'index.html');
}

const server = createServer((req, res) => {
  const filePath = resolveFilePath(req.url || '/');
  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  process.stdout.write(`Static e2e server ready at http://${host}:${port}\n`);
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
