# BitFabric Examples

Advanced usage patterns and real-world scenarios.

## Table of Contents

1. [Real-time Chat](#real-time-chat)
2. [Event Broadcasting](#event-broadcasting)
3. [Multi-Room Coordination](#multi-room-coordination)
4. [Encrypted Private Messages](#encrypted-private-messages)
5. [Stats and Monitoring](#stats-and-monitoring)
6. [Error Recovery](#error-recovery)

---

## Real-time Chat

A complete chat application with multiple users:

```javascript
import { PubSubFabric } from './src/fabric/index.js';

class ChatApp {
  constructor(roomId, username) {
    this.fabric = new PubSubFabric({ roomId });
    this.username = username;
    this.messages = [];
  }

  async init() {
    await this.fabric.init();
    this.setupSubscriptions();
    console.log(`Chat initialized as ${this.username}`);
  }

  setupSubscriptions() {
    // Listen for new messages
    this.fabric.subscribe('chat', (message) => {
      const formatted = {
        user: message.data.user,
        text: message.data.text,
        timestamp: new Date(message.data.timestamp).toLocaleTimeString()
      };
      this.messages.push(formatted);
      this.displayMessage(formatted);
    });

    // Listen for user join/leave events
    this.fabric.subscribe('presence', (message) => {
      if (message.data.event === 'joined') {
        console.log(`✓ ${message.data.user} joined`);
      } else if (message.data.event === 'left') {
        console.log(`✗ ${message.data.user} left`);
      }
    });
  }

  sendMessage(text) {
    this.fabric.publish('chat', {
      user: this.username,
      text,
      timestamp: Date.now()
    });
  }

  announcePresence(event) {
    this.fabric.publish('presence', {
      user: this.username,
      event, // 'joined' or 'left'
      timestamp: Date.now()
    });
  }

  displayMessage(msg) {
    console.log(`[${msg.timestamp}] ${msg.user}: ${msg.text}`);
  }

  async cleanup() {
    this.announcePresence('left');
    await this.fabric.destroy?.();
  }
}

// Usage
const chat = new ChatApp('dev-team', 'Alice');
await chat.init();
chat.sendMessage('Hey everyone!');
```

---

## Event Broadcasting

System-wide event distribution:

```javascript
class EventBus {
  constructor(roomId) {
    this.fabric = new PubSubFabric({ roomId });
    this.handlers = new Map();
  }

  async init() {
    await this.fabric.init();
  }

  on(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
      
      // Subscribe to this event type
      this.fabric.subscribe(`event:${eventType}`, (message) => {
        const handlers = this.handlers.get(eventType) || [];
        handlers.forEach(h => h(message.data));
      });
    }
    
    this.handlers.get(eventType).push(handler);
  }

  emit(eventType, data) {
    this.fabric.publish(`event:${eventType}`, {
      type: eventType,
      data,
      timestamp: Date.now()
    });
  }

  off(eventType, handler) {
    if (this.handlers.has(eventType)) {
      const handlers = this.handlers.get(eventType);
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    }
  }
}

// Usage
const bus = new EventBus('app-events');
await bus.init();

bus.on('user-login', (data) => {
  console.log(`User logged in: ${data.userId}`);
});

bus.on('config-change', (data) => {
  console.log(`Config updated:`, data);
});

// Emit events
bus.emit('user-login', { userId: 'user123', timestamp: Date.now() });
bus.emit('config-change', { setting: 'theme', value: 'dark' });
```

---

## Multi-Room Coordination

Manage multiple rooms simultaneously:

```javascript
class MultiRoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomId, config = {}) {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId);
    }

    const fabric = new PubSubFabric({
      roomId,
      ...config
    });

    this.rooms.set(roomId, {
      fabric,
      subscribers: new Map(),
      initialized: false
    });

    return fabric;
  }

  async joinRoom(roomId) {
    const room = this.createRoom(roomId);
    
    if (!room.initialized) {
      await room.fabric.init();
      room.initialized = true;
    }

    return room.fabric;
  }

  async sendToRoom(roomId, topic, data) {
    const room = this.rooms.get(roomId);
    if (room && room.initialized) {
      room.fabric.publish(topic, data);
    }
  }

  async cleanup() {
    for (const room of this.rooms.values()) {
      if (room.fabric.destroy) {
        await room.fabric.destroy();
      }
    }
    this.rooms.clear();
  }
}

// Usage
const manager = new MultiRoomManager();

const room1 = await manager.joinRoom('project-alpha');
const room2 = await manager.joinRoom('project-beta');

await manager.sendToRoom('project-alpha', 'updates', { status: 'active' });
await manager.sendToRoom('project-beta', 'updates', { status: 'paused' });
```

---

## Encrypted Private Messages

Direct peer-to-peer encrypted messages:

```javascript
class EncryptedMessenger {
  constructor(fabric, myUserId) {
    this.fabric = fabric;
    this.myUserId = myUserId;
  }

  setupPrivateChannel() {
    // Listen on private topic (using user ID)
    this.fabric.subscribe(`private:${this.myUserId}`, (message) => {
      if (message.data.encrypted) {
        this.handleEncryptedMessage(message);
      }
    });
  }

  async sendPrivateMessage(recipientId, message) {
    // Message is already encrypted by fabric using UnSEA
    this.fabric.publish(`private:${recipientId}`, {
      from: this.myUserId,
      text: message,
      timestamp: Date.now(),
      encrypted: true // Flag for handler
    });
  }

  handleEncryptedMessage(message) {
    console.log(`Private message from ${message.data.from}: ${message.data.text}`);
  }
}

// Usage
await fabric.init();
const messenger = new EncryptedMessenger(fabric, 'alice');
messenger.setupPrivateChannel();
await messenger.sendPrivateMessage('bob', 'Secret message');
```

---

## Stats and Monitoring

Track fabric performance:

```javascript
class MonitoredFabric {
  constructor(roomId) {
    this.fabric = new PubSubFabric({ roomId });
    this.metrics = {
      published: 0,
      received: 0,
      startTime: null,
      topicStats: new Map()
    };
  }

  async init() {
    this.metrics.startTime = Date.now();
    return await this.fabric.init();
  }

  publish(topic, data) {
    this.metrics.published++;
    
    if (!this.metrics.topicStats.has(topic)) {
      this.metrics.topicStats.set(topic, { published: 0, received: 0 });
    }
    this.metrics.topicStats.get(topic).published++;

    return this.fabric.publish(topic, data);
  }

  subscribe(topic, callback) {
    if (!this.metrics.topicStats.has(topic)) {
      this.metrics.topicStats.set(topic, { published: 0, received: 0 });
    }

    return this.fabric.subscribe(topic, (message) => {
      this.metrics.received++;
      this.metrics.topicStats.get(topic).received++;
      callback(message);
    });
  }

  getStats() {
    const uptime = Date.now() - this.metrics.startTime;
    return {
      uptime: `${(uptime / 1000).toFixed(1)}s`,
      messagesPublished: this.metrics.published,
      messagesReceived: this.metrics.received,
      topicStats: Object.fromEntries(this.metrics.topicStats),
      rate: {
        pubPerSec: (this.metrics.published / (uptime / 1000)).toFixed(2),
        recvPerSec: (this.metrics.received / (uptime / 1000)).toFixed(2)
      }
    };
  }

  printStats() {
    const stats = this.getStats();
    console.table(stats);
  }
}

// Usage
const monitored = new MonitoredFabric('test-room');
await monitored.init();

monitored.subscribe('chat', msg => console.log(msg));
monitored.publish('chat', { text: 'Hello' });

setInterval(() => monitored.printStats(), 5000);
```

---

## Error Recovery

Graceful error handling and recovery:

```javascript
class ResilientFabric {
  constructor(roomId, options = {}) {
    this.fabric = new PubSubFabric(roomId);
    this.connected = false;
    this.retryCount = 0;
    this.maxRetries = options.maxRetries || 5;
    this.retryDelay = options.retryDelay || 1000;
  }

  async init() {
    try {
      await this.fabric.init();
      this.connected = true;
      this.retryCount = 0;
      console.log('✓ Fabric connected');
    } catch (err) {
      console.error('✗ Connection failed:', err.message);
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying in ${this.retryDelay}ms (${this.retryCount}/${this.maxRetries})`);
        await new Promise(r => setTimeout(r, this.retryDelay));
        return this.init();
      } else {
        throw new Error('Max retries exceeded');
      }
    }
  }

  publish(topic, data) {
    if (!this.connected) {
      console.warn('Not connected, queuing message');
      // Could implement message queue here
      return;
    }
    
    try {
      return this.fabric.publish(topic, data);
    } catch (err) {
      console.error(`Publish error on ${topic}:`, err);
      this.handleError(err);
    }
  }

  subscribe(topic, callback) {
    if (!this.connected) {
      console.warn('Not connected, subscription may fail');
    }

    try {
      return this.fabric.subscribe(topic, (message) => {
        try {
          callback(message);
        } catch (err) {
          console.error('Handler error:', err);
        }
      });
    } catch (err) {
      console.error(`Subscribe error on ${topic}:`, err);
      this.handleError(err);
    }
  }

  handleError(err) {
    if (err.message.includes('relay')) {
      console.log('Relay connection issue detected');
      // Could attempt reconnection
    }
  }
}

// Usage
const resilient = new ResilientFabric('stable-room', { 
  maxRetries: 3,
  retryDelay: 2000
});

try {
  await resilient.init();
} catch (err) {
  console.error('Failed to initialize after retries');
}
```

---

## See Also

- [QUICKSTART.md](QUICKSTART.md) - Getting started guide
- [../src/fabric/README.md](../src/fabric/README.md) - Full API documentation
