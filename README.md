# BitFabric NPM Package

Direct pub/sub messaging over **Gun + Nostr** with built-in **UnSEA** encryption. BitFabric provides a lightweight, decentralized transport layer for modern web applications.

## Install

```bash
npm install bitfabric
```

## Usage

### Connecting to a Room

In BitFabric, communication is scoped by a `roomId`. To message between clients, they must join the same room.

- **Free Tier**: Use the default `bitfabric-global-tier` Room ID. No registration required.
- **Custom Rooms**: Requires a **Validated API Key**. You can obtain and manage keys at [bitfabric.cc](https://bitfabric.cc).

```js
import { PubSubFabric } from 'bitfabric';

// Join the global free tier
const fabric = new PubSubFabric({
	roomId: 'bitfabric-global-tier'
});

await fabric.init();

// Subscribe to a topic
fabric.subscribe('general-support', (msg) => {
	console.log(`From ${msg.from}:`, msg.data);
});

// Publish a message
await fabric.publish('general-support', { text: 'Hello BitFabric!' });
```

### Advanced Configuration

BitFabric automatically detects global Gun and Nostr relays, but you can provide your own for dedicated infrastructure.

```js
const fabric = new PubSubFabric({
  roomId: 'your-room-id',
  nostrRelays: [
    'wss://nos.lol',
    'wss://relay.damus.io'
  ],
  gunPeers: [
    'https://relay.peer.ooo/gun'
  ]
});
```

> **Note:** `gunPeers` and `nostrRelays` are optional. The library will auto-detect optimal relays if these lists are omitted.

## Security & Validation

The library implements a **Validated Key** system to ensure network integrity:
- **Strict Enforcement**: If a session is initiated without a validated key, all publication attempts to custom topics are automatically remapped to the shared `bitfabric-global-tier` namespace.
- **End-to-End Encryption**: All messages are encrypted with topic-derived AES-GCM keys via UnSEA, ensuring that only participants on that topic can read the contents.

## Local Development & Examples

Build the browser-ready bundle:

```bash
npm run build:browser
```

Explore the interactive examples:

```bash
npm run examples:serve
```

- `http://localhost:8080/examples/` (Reference Implementation)
- `http://localhost:8080/examples/browser.html` (Advanced Pub/Sub Test)

### Verification

The `browser.html` example includes a live validation panel to test your API keys against the production registry at `bitfabric.cc`.

## Project Structure

- `src/fabric/`: Core PubSubFabric and Transport logic.
- `src/nostr/`: Nostr client and relay management.
- `dist/`: Unified bundles (ESM, CJS, IIFE).

MIT Licensed.
