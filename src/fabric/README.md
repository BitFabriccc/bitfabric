# PubSub Fabric - Gun + Nostr Direct PubSub

A universal pub/sub system that uses **Gun and Nostr** for direct publish/subscribe messaging.

## Architecture

### Direct PubSub (No WebRTC)
- **Gun**: Primary pubsub data layer (distributed database)
- **Nostr**: Secondary pubsub layer for redundancy (multiple relays)

All application data flows directly through Gun and Nostr relays.

## Key Principles

1. **Direct messaging** - No WebRTC, no peer discovery, no signaling
2. **Gun as primary** - Fast, distributed pubsub through Gun relays
3. **Nostr as backup** - Additional redundancy and reach
4. **Message deduplication** - Prevents duplicate processing across transports

## Usage

### Basic Example

```javascript
import { PubSubFabric } from './fabric/index.js';

// Initialize fabric
const fabric = new PubSubFabric({
  roomId: 'my-room',
  nostrRelays: ['wss://relay.damus.io', 'wss://relay.nostr.band']
});

await fabric.init();

// Subscribe to a topic
fabric.subscribe('chat', (message) => {
  console.log(`${message.from}: ${message.data.text}`);
});

// Publish to a topic (flows through Gun + Nostr)
fabric.publish('chat', { text: 'Hello world!' });
```

### Chat Demo

```javascript
import { createChatDemo } from './fabric/demo.js';

// Create demo instance
const demo = await createChatDemo('my-room');

// Send messages
demo.sendMessage('Hello everyone!');

// Check stats
console.log(demo.getStats());

// Cleanup
await demo.destroy();
```

## API Reference

### PubSubFabric

#### Constructor
```javascript
const fabric = new PubSubFabric({
  roomId: 'room-name',           // Required: Room identifier
  nostrRelays: [...]              // Optional: Nostr relay URLs
});
```

#### Methods

##### `async init()`
Initialize the fabric and connect to transports. Returns the peer ID.

```javascript
const peerId = await fabric.init();
```

##### `subscribe(topic, callback)`
Subscribe to a topic. Returns unsubscribe function.

```javascript
const unsubscribe = fabric.subscribe('events', (message) => {
  console.log(message.topic, message.data);
});

// Later: unsubscribe
unsubscribe();
```

##### `publish(topic, data)`
Publish data to a topic. Flows through Gun and Nostr relays to all interested peers.

```javascript
fabric.publish('events', { type: 'update', value: 42 });
```

##### `getStats()`
Get fabric statistics.

```javascript
const stats = fabric.getStats();
// {
//   messagesPublished: 10,
//   messagesReceived: 15,
//   topics: 2
// }
```

##### `async destroy()`
Cleanup and disconnect from all transports.

```javascript
await fabric.destroy();
```

## How It Works

### 1. Transport Phase
- **Gun**: Acts as a distributed database and real-time messaging carrier.
- **Nostr**: Provides a decentralized relay network for message publication.

### 2. Messaging Phase
- Publishers send to topic (flows through Gun + Nostr relays).
- Subscribers receive via their callbacks from the same relays.
- Deduplication prevents message loops and duplicate processing.

## Transport Comparison

| Transport | Purpose | Speed | Reliability |
|-----------|---------|-------|-------------|
| **Gun** | Primary messaging | Fast | High (distributed) |
| **Nostr** | Secondary messaging | Fast | High (multi-relay) |

## Benefits

- ✅ **Censorship resistant** - Multiple transports, no central point
- ✅ **Scalable** - Direct P2P data flow, relays only for discovery
- ✅ **Private** - Data never touches relays/trackers
- ✅ **Fast** - Direct WebRTC connections, minimal latency
- ✅ **Resilient** - Multi-transport redundancy

## Browser Example

Open in 2+ browser tabs:

```html
<!DOCTYPE html>
<html>
<head>
  <title>PubSub Fabric Demo</title>
</head>
<body>
  <h1>PubSub Fabric</h1>
  <div id="output"></div>
  <input id="input" placeholder="Type message..." />
  <button id="send">Send</button>
  
  <script type="module">
    import { createChatDemo } from './src/fabric/demo.js';
    
    const demo = await createChatDemo('test-room');
    const output = document.getElementById('output');
    
    demo.fabric.subscribe('chat', (msg) => {
      const div = document.createElement('div');
      div.textContent = `${msg.fromPeerId.substring(0, 8)}: ${msg.data.text}`;
      output.appendChild(div);
    });
    
    document.getElementById('send').onclick = () => {
      const input = document.getElementById('input');
      demo.sendMessage(input.value);
      input.value = '';
    };
  </script>
</body>
</html>
```

## Advanced Usage

### Custom Topics

```javascript
// Subscribe to multiple topics
fabric.subscribe('user-events', handleUserEvents);
fabric.subscribe('system-alerts', handleAlerts);
fabric.subscribe('metrics', handleMetrics);

// Publish to specific topics
fabric.publish('user-events', { action: 'login', userId: 123 });
fabric.publish('metrics', { cpu: 45, memory: 78 });
```

### Message Filtering

```javascript
fabric.subscribe('events', (message) => {
  // Filter by origin
  if (message.fromPeerId === myPeerId) return;
  
  // Filter by data
  if (message.data.priority === 'high') {
    handleHighPriority(message.data);
  }
});
```

### Connection Monitoring

```javascript
setInterval(() => {
  const peers = fabric.getConnectedPeers();
  const stats = fabric.getStats();
  
  console.log(`Connected: ${peers.length} peers`);
  console.log(`Stats:`, stats);
}, 5000);
```

## Testing

Open multiple browser tabs to the same room and observe:
1. Peers discovered via all transports
2. WebRTC connections established automatically
3. Messages flowing peer-to-peer (not through relays)
4. Topic-based routing working correctly

Check browser console for detailed logs showing:
- Transport discovery events
- WebRTC connection establishment
- Message routing decisions

## License

MIT
