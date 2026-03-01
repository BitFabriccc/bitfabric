import {
  PubSubFabric,
  PubSubTransport,
  createChatDemo,
  createNostrClient
} from '../dist/index.js';

import assert from 'node:assert/strict';
import { webcrypto as nodeCrypto } from 'node:crypto';

// Ensure WebCrypto is available for AES-GCM in Node
if (!globalThis.crypto) {
  globalThis.crypto = nodeCrypto;
}

console.log('bitfabric smoke test');
console.log('exports ok:', {
  PubSubFabric: typeof PubSubFabric,
  PubSubTransport: typeof PubSubTransport,
  createChatDemo: typeof createChatDemo,
  createNostrClient: typeof createNostrClient
});

// Minimal instantiation check (no network)
const fabric = new PubSubFabric({ roomId: 'bitfabric-global-tier' });
console.log('fabric created:', typeof fabric === 'object');

// NOTE: fabric.init() will attempt to connect to real transports (Gun/Nostr).
// Keep this smoke test offline-safe.

// --- Encryption proof (offline) ---
const transport = new PubSubTransport({
  roomId: 'bitfabric-global-tier',
  peerId: 'smoke-peer',
  gunRelays: [],
  nostrRelays: []
});

let captured = null;
transport.nostrClients = [
  {
    getPublicKeyHex: () => 'smoke-peer',
    connect: async () => { },
    publish: async (msg) => {
      captured = msg;
    }
  }
];

const topic = 'smoke-topic';
const payload = { hello: 'world', n: 1 };
await transport.publish(topic, payload);

assert.ok(captured, 'Expected to capture a published message');
assert.ok(captured.topicEncrypted, 'Expected published message to include `topicEncrypted`');
assert.ok(captured.iv && captured.ciphertext, 'Expected IV and ciphertext');
assert.equal(captured.data, undefined, 'Expected no plaintext `data` on-wire');

const decrypted = await transport.decryptForTopic(topic, captured.iv, captured.ciphertext);
assert.deepEqual(decrypted, payload, 'Decrypted payload should match original');

console.log('encryption ok: publish() sends ciphertext and decrypts locally');
