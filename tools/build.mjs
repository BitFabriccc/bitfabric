import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');

async function rmrf(p) {
  await fs.rm(p, { recursive: true, force: true });
}

async function mkdirp(p) {
  await fs.mkdir(p, { recursive: true });
}

async function copyDir(src, dst) {
  await mkdirp(dst);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else {
      await fs.copyFile(from, to);
    }
  }
}

async function writeFile(p, content) {
  await mkdirp(path.dirname(p));
  await fs.writeFile(p, content);
}

async function main() {
  await rmrf(distDir);
  await mkdirp(distDir);

  // Copy library sources into dist so the npm package is self-contained
  await copyDir(path.join(repoRoot, 'src', 'fabric'), path.join(distDir, 'fabric'));
  await copyDir(path.join(repoRoot, 'src', 'nostr'), path.join(distDir, 'nostr'));

  // Create dist entrypoint
  await writeFile(
    path.join(distDir, 'index.js'),
    "export { PubSubFabric } from './fabric/PubSubFabric.js';\n" +
      "export { PubSubTransport } from './fabric/PubSubTransport.js';\n" +
      "export { createChatDemo } from './fabric/demo.js';\n" +
      "export { createNostrClient } from './nostr/nostrClient.js';\n"
  );

  // Minimal typings stub (helps TS users)
  await writeFile(
    path.join(distDir, 'index.d.ts'),
    `export class PubSubFabric {
  constructor(config: { roomId: string; gunRelays?: string[]; nostrRelays?: string[]; peerId?: string | null });
  init(): Promise<string>;
  subscribe(topic: string, callback: (message: any) => void): () => void;
  publish(topic: string, data: any): Promise<void>;
  getPeerId(): string;
  getStats(): any;
  destroy(): Promise<void>;
}

export class PubSubTransport {}

export function createChatDemo(roomId?: string): Promise<any>;

export function createNostrClient(opts: any): any;
`
  );
}

await main();
