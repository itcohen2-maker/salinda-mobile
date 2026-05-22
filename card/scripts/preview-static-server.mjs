import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const rootDir = process.argv[2] || process.cwd();
const port = Number(process.argv[3] || 8181);
const host = process.argv[4] || '127.0.0.1';

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function safePath(urlPath) {
  const pathname = decodeURIComponent((urlPath || '/').split('?')[0]);
  const normalizedPath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  const relativePath = normalizedPath === '\\' || normalizedPath === '/' ? 'index.html' : normalizedPath.replace(/^[/\\]+/, '');
  return join(rootDir, relativePath);
}

function send(statusCode, headers, body, res) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

const server = createServer((req, res) => {
  const resolvedPath = safePath(req.url);
  if (!resolvedPath.startsWith(rootDir)) {
    send(403, { 'content-type': 'text/plain; charset=utf-8' }, 'Forbidden', res);
    return;
  }

  if (!existsSync(resolvedPath)) {
    send(404, { 'content-type': 'text/plain; charset=utf-8' }, 'Not found', res);
    return;
  }

  const stat = statSync(resolvedPath);
  if (stat.isDirectory()) {
    send(403, { 'content-type': 'text/plain; charset=utf-8' }, 'Directory listing disabled', res);
    return;
  }

  const ext = extname(resolvedPath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'cache-control': 'no-store',
    'content-length': stat.size,
    'content-type': contentType,
  });
  createReadStream(resolvedPath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Preview server listening on http://${host}:${port}/`);
  console.log(`Serving root: ${rootDir}`);
});
