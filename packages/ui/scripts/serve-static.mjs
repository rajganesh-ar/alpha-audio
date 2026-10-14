#!/usr/bin/env node
/** Minimal static server for the built Storybook: `node scripts/serve-static.mjs <dir> <port>`. */
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const [dirArg = 'storybook-static', portArg = '6106'] = process.argv.slice(2)
const root = resolve(process.cwd(), dirArg)
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
  let file = normalize(join(root, path))
  if (!file.startsWith(root)) return res.writeHead(403).end()
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html')
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(res)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(Number(portArg), '127.0.0.1', () =>
  console.log(`serving ${dirArg} on http://127.0.0.1:${portArg}`),
)
