# BitFabric API Reference

Complete API documentation for BitFabric.

## PubSubFabric

Main class for pub/sub messaging.

### Constructor

```javascript
const fabric = new PubSubFabric(options)
```

**Options:**
- `roomId` (string, required) - Room identifier
- `nostrRelays` (string[], optional) - Nostr relay URLs

**Example:**
```javascript
const fabric = new PubSubFabric({
  roomId: 'my-room',
  nostrRelays: ['wss://nos.lol', 'wss://relay.damus.io']
});
```

---

### Methods

#### `init()`

Initialize the fabric and connect to transports.

```javascript
const peerId = await fabric.init();
```

**Returns:** `string` - Peer ID

**Throws:** `Error` if connection fails

---

#### `subscribe(topic, callback)`

Subscribe to a topic.

```javascript
const unsubscribe = fabric.subscribe('messages', (message) => {
  console.log(message);
});
```

**Parameters:**
- `topic` (string) - Topic name
- `callback` (function) - Message handler

**Message object:**
```javascript
{
  topic: 'messages',
  data: { /* your data */ },
  from: 'peer-id-123',
  timestamp: 1234567890
}
```

**Returns:** `function` - Unsubscribe function

**Example:**
```javascript
const unsub = fabric.subscribe('chat', (msg) => {
  console.log(`${msg.from}: ${msg.data.text}`);
});

// Later...
unsub();
```

---

#### `publish(topic, data)`

Publish data to a topic.

```javascript
fabric.publish('messages', { text: 'Hello!' });
```

**Parameters:**
- `topic` (string) - Topic name
- `data` (object) - Data to publish

**Returns:** `void`

**Note:** Data is automatically JSON serialized and encrypted

**Example:**
```javascript
fabric.publish('events', {
  type: 'user-login',
  userId: 'user123',
  timestamp: Date.now()
});
```

---

#### `destroy()`

Cleanup fabric connections.

```javascript
await fabric.destroy();
```

**Returns:** `Promise<void>`

---

## Transport Statistics

### `getStats()`

Get transport statistics.

```javascript
const stats = fabric.getStats();
console.log(stats);
// {
//   transport1: { published: 42, received: 38 },
//   transport2: { published: 40, received: 40 }
// }
```

**Returns:** `object`

---

## Event Handlers

### `on(event, callback)`

Listen to fabric events.

```javascript
fabric.on('error', (err) => {
  console.error(err);
});
```

**Events:**
- `'error'` - Error occurred
- `'connected'` - Connected to transports
- `'disconnected'` - Disconnected
- `'peer-joined'` - New peer joined
- `'peer-left'` - Peer left

---

## PubSubTransport (Lower Level)

For advanced use cases, work directly with PubSubTransport.

```javascript
import { PubSubTransport } from './src/fabric/PubSubTransport.js';

const transport = new PubSubTransport({
  roomId: 'advanced-room',
  peerId: 'my-peer-id'
});

await transport.init();
```

### Methods

#### `subscribe(topic, callback)`

Subscribe at transport level.

```javascript
transport.subscribe('raw-messages', (message) => {
  console.log('Raw:', message);
});
```

#### `publish(topic, data, encrypted = true)`

Publish with encryption control.

```javascript
// Encrypted (default)
transport.publish('messages', { text: 'secret' });

// Unencrypted
transport.publish('public', { status: 'ok' }, false);
```

---

## Nostr Client

Work directly with Nostr relays.

```javascript
import { createNostrClient } from './src/nostr/nostrClient.js';

const nostr = createNostrClient({
  relayUrl: 'wss://nos.lol',
  room: 'my-room',
  onPayload: (data) => console.log(data),
  secretKeyHex: 'optional-key'
});
```

### Events

#### `onPayload(data)`

Called when message received.

```javascript
onPayload: ({ from, payload }) => {
  console.log(`Message from ${from}:`, payload);
}
```

#### `onState(state)`

Connection state changes.

```javascript
onState: (state) => {
  console.log('State:', state); // 'connecting', 'connected', 'error'
}
```

#### `onNotice(notice)`

Relay sends notice.

```javascript
onNotice: (notice) => {
  console.log('Relay notice:', notice);
}
```

---

## Gun Integration

BitFabric uses Gun for primary transport.

```javascript
import Gun from 'gun';

const gun = Gun(['https://relay.peer.ooo/gun']);
const ref = gun.get('bitfabric-room');

ref.on((data) => {
  console.log('Gun data:', data);
});
```

---

## Encryption (UnSEA)

Messages are encrypted using UnSEA.

```javascript
import { encryptMessageWithMeta, decryptMessageWithMeta } from 'unsea';

// Encryption is automatic in fabric
// But you can use directly:

const encrypted = await encryptMessageWithMeta(
  'secret message',
  recipientPublicKey
);

const decrypted = await decryptMessageWithMeta(
  encrypted,
  privateKey
);
```

---

## Error Handling

### Common Errors

```javascript
try {
  await fabric.init();
} catch (err) {
  if (err.message.includes('relay')) {
    console.error('Relay connection failed');
  } else if (err.message.includes('timeout')) {
    console.error('Connection timeout');
  } else {
    console.error('Unknown error:', err);
  }
}
```

---

## Rate Limits

Default limits:

| Limit | Value |
|-------|-------|
| Message cache | 1,000 messages |
| Nostr query limit | 50 messages |
| Peer age | 2 minutes |

---

## TypeScript Support

BitFabric is written in JavaScript. For TypeScript, add type definitions:

```typescript
interface Message {
  topic: string;
  data: any;
  from: string;
  timestamp: number;
}

interface FabricOptions {
  roomId: string;
  nostrRelays?: string[];
}
```

---

## See Also

- [QUICKSTART.md](QUICKSTART.md) - Quick start guide
- [EXAMPLES.md](EXAMPLES.md) - Code examples
- [../src/fabric/README.md](../src/fabric/README.md) - Architecture details
