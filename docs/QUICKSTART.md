# BitFabric Quickstart Guide

Get started with BitFabric's pub/sub messaging system in minutes.

## Installation

```bash
npm install
npm run dev
# Open http://localhost:5173
```

## Basic Usage

### 1. Initialize the Fabric

```javascript
import { PubSubFabric } from './src/fabric/index.js';

const fabric = new PubSubFabric({
  roomId: 'my-chat-room',
  nostrRelays: ['wss://relay.damus.io', 'wss://relay.nostr.band']
});

await fabric.init();
```

### 2. Subscribe to a Topic

```javascript
fabric.subscribe('messages', (message) => {
  console.log(`${message.from}: ${message.data.text}`);
});
```

### 3. Publish a Message

```javascript
fabric.publish('messages', { 
  text: 'Hello from BitFabric!',
  timestamp: Date.now()
});
```

### 4. Unsubscribe

```javascript
const unsubscribe = fabric.subscribe('events', handler);
// Later...
unsubscribe();
```

## Real-World Examples

### Chat Application

```javascript
import { createChatDemo } from './src/fabric/demo.js';

// Create a chat room
const chat = await createChatDemo('room-name');

// Send messages
chat.sendMessage('Hello everyone!');

// View stats
console.log(chat.getStats());
// { messagesSent: 1, messagesReceived: 0, peersOnline: 1 }

// Cleanup
await chat.destroy();
```

### Subscribe to Multiple Topics

```javascript
const topics = ['chat', 'notifications', 'system'];

topics.forEach(topic => {
  fabric.subscribe(topic, (message) => {
    console.log(`[${topic}] from ${message.from}:`, message.data);
  });
});
```

### Publish with Metadata

```javascript
fabric.publish('data', {
  type: 'sensor',
  value: 42,
  location: 'living-room',
  timestamp: Date.now()
});
```

## Architecture

BitFabric uses **Gun** (primary) and **Nostr** (backup) for redundant pub/sub:

- **Gun**: Fast distributed database sync
- **Nostr**: Additional relay layer for reach
- **End-to-End Encryption**: All messages use UnSEA encryption
- **No WebRTC**: Direct relay-based messaging

## Message Flow

```
Client → Gun Relay (encrypted) → All subscribers
      ↓
      → Nostr Relay (encrypted) → All subscribers
```

## Configuration

```javascript
const fabric = new PubSubFabric({
  roomId: 'required-room-id',           // Room identifier
  nostrRelays: [                         // Optional relay list
    'wss://nos.lol',
    'wss://relay.damus.io'
  ]
});
```

## Error Handling

```javascript
try {
  await fabric.init();
} catch (err) {
  console.error('Failed to initialize fabric:', err);
}

fabric.on('error', (error) => {
  console.error('Transport error:', error);
});
```

## Performance Tips

1. **Batch messages** - Group related publishes together
2. **Limit subscriptions** - Only subscribe to topics you need
3. **Cache topics** - Reuse fabric instances for same room
4. **Monitor stats** - Use `getStats()` to track performance

## Next Steps

- See [EXAMPLES.md](EXAMPLES.md) for advanced patterns
- Check [../src/fabric/README.md](../src/fabric/README.md) for full API reference
- Review [../README.md](../README.md) for project overview
