import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';

const repoRoot = process.cwd();
const port = Number(process.env.PORT || 8080);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const UPSTREAM_ORIGIN = process.env.BITFABRIC_ORIGIN || 'https://bitfabric.cc';

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function withCors(res, extraHeaders = {}) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
}

async function proxyValidateKey(req, res) {
  if (req.method === 'OPTIONS') {
    withCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    withCors(res, { 'Content-Type': 'application/json; charset=utf-8' });
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const bodyBuf = await readBody(req);
  const upstreamUrl = new URL('/api/validate-key', UPSTREAM_ORIGIN).toString();

  const upstreamRes = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json'
    },
    body: bodyBuf
  });

  const text = await upstreamRes.text();
  withCors(res, { 'Content-Type': upstreamRes.headers.get('content-type') || 'application/json; charset=utf-8' });
  res.writeHead(upstreamRes.status);
  res.end(text);
}

async function proxyAuthenticate(req, res) {
  if (req.method === 'OPTIONS') {
    withCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    withCors(res, { 'Content-Type': 'application/json; charset=utf-8' });
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const bodyBuf = await readBody(req);
  const upstreamUrl = new URL('/api/authenticate', UPSTREAM_ORIGIN).toString();

  const upstreamRes = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json'
    },
    body: bodyBuf
  });

  const text = await upstreamRes.text();
  withCors(res, { 'Content-Type': upstreamRes.headers.get('content-type') || 'application/json; charset=utf-8' });
  res.writeHead(upstreamRes.status);
  res.end(text);
}

async function proxyKeys(req, res) {
  if (req.method === 'OPTIONS') {
    withCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    withCors(res, { 'Content-Type': 'application/json; charset=utf-8' });
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const bodyBuf = await readBody(req);
  const upstreamUrl = new URL('/api/keys', UPSTREAM_ORIGIN).toString();

  const upstreamRes = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json'
    },
    body: bodyBuf
  });

  const text = await upstreamRes.text();
  withCors(res, { 'Content-Type': upstreamRes.headers.get('content-type') || 'application/json; charset=utf-8' });
  res.writeHead(upstreamRes.status);
  res.end(text);
}

function safeResolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0] || '/');
  const rel = clean.replace(/^\//, '');
  const resolved = path.resolve(repoRoot, rel);
  if (!resolved.startsWith(repoRoot)) return null;
  return resolved;
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = req.url || '/';

    if (urlPath.startsWith('/api/validate-key')) {
      await proxyValidateKey(req, res);
      return;
    }

    if (urlPath.startsWith('/api/authenticate')) {
      await proxyAuthenticate(req, res);
      return;
    }

    if (urlPath.startsWith('/api/keys')) {
      await proxyKeys(req, res);
      return;
    }

    if (urlPath === '/' || urlPath === '/examples' || urlPath === '/examples/') {
      res.writeHead(302, { Location: '/examples/browser.html' });
      res.end();
      return;
    }

    const filePath = safeResolve(urlPath);
    if (!filePath) {
      res.writeHead(400);
      res.end('Bad path');
      return;
    }

    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const finalPath = stat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    const ext = path.extname(finalPath);
    const contentType = contentTypes[ext] || 'application/octet-stream';

    const body = await fs.readFile(finalPath);
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    res.end(body);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err?.stack || err));
  }
});

server.listen(port, () => {
  console.log(`Examples server running: http://localhost:${port}/examples/`);
});
