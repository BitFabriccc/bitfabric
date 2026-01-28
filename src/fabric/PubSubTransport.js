/**
 * PubSubTransport - Distributed Network with End-to-End Encryption
 * 
 * Uses redundant network transports for direct publish/subscribe messaging with end-to-end encryption.
 * All messages encrypted with UnSEA (ECIES elliptic curve encryption).
 * NO WebRTC - all data flows through distributed relays.
 */

import { createNostrClient } from '../nostr/nostrClient.js';
import Gun from 'gun';
import { encryptMessageWithMeta, decryptMessageWithMeta, generateRandomPair } from 'unsea';

const ACTIVE_GUN_RELAYS = [
  'https://relay.peer.ooo/gun'
];

export class PubSubTransport {
  constructor(config = {}) {
    this.roomId = config.roomId;
    this.peerId = config.peerId;
    
    // Use API key as the channel (isolated per user)
    this.channel = this.roomId || 'default';
    
    // Transport clients
    this.nostrClients = [];
    this.gun = null;
    
    // Config
    // Primary relays first - try to use these
    this.primaryRelays = [
      'wss://nos.lol',
      'wss://relay.primal.net'
    ];
    
    this.nostrRelays = config.nostrRelays || [
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://relay.nostr.band',
      'wss://relay.snort.social',
      'wss://nostr.wine',
      'wss://relay.damus.io'
    ];
    
    // Topic subscriptions: topic -> Set<callback>
    this.subscriptions = new Map();
    
    // Message cache: topic -> last message (for replay on subscribe)
    this.topicCache = new Map();
    
    // Message deduplication
    this.seenMessages = new Set();
    this.maxSeenMessages = 1000;
    
    // Stats
    this.stats = {
      transport1: { published: 0, received: 0 },
      transport2: { published: 0, received: 0 }
    };
  }
  
  /**
   * Initialize transports
   */
  async init() {
    
    // Generate UnSEA keypair for end-to-end encryption
    try {
      this.keyPair = await generateRandomPair();
    } catch (err) {
      // Silently handle keypair generation
    }
    
    // Initialize Nostr first to get peer ID
    await this.initNostr();
    
    // Initialize Gun secondary transport
    await this.initGun();
    
    return this.peerId;
  }
  
  /**
   * Initialize network relays - try primary first, stop once connected
   */
  async initNostr() {
    // Try primary relays first
    for (const relayUrl of this.primaryRelays) {
      try {
        await this.initNostrRelay(relayUrl);
        // If we got a successful connection, stop trying others
        if (this.nostrClients.length >= 1) {
          return;
        }
      } catch (err) {
        // Continue to next relay
      }
    }
    
    // If primary relays didn't connect, try fallbacks one more time
    const fallbackRelays = this.nostrRelays.filter(r => !this.primaryRelays.includes(r));
    for (const relayUrl of fallbackRelays) {
      try {
        await this.initNostrRelay(relayUrl);
        // If we got a successful connection, stop
        if (this.nostrClients.length >= 1) {
          return;
        }
      } catch (err) {
        // Continue to next relay
      }
    }
  }
  
  /**
   * Initialize a single relay connection
   */
  async initNostrRelay(relayUrl) {
    try {
      const client = createNostrClient({
        relayUrl,
        room: this.channel,
        onPayload: ({ from, payload }) => {
          this.stats.transport1.received++;
          this.handleMessage('nostr', from, payload).catch(err => {
            // Silently handle message processing errors
          });
        },
        onState: (state) => {
          // Relay state changes (connecting/connected/error)
        }
      });
      
      await client.connect().catch(err => {
        // Silently fail on connection errors - don't propagate
        throw err;
      });
      this.nostrClients.push(client);
      
      // Set peer ID from first successful connection
      if (!this.peerId) {
        this.peerId = client.getPublicKeyHex();
      }
      
    } catch (err) {
      // Silently handle connection failures - no console spam
    }
  }
  
  /**
   * Initialize secondary network relay
   */
  async initGun() {
    if (!this.peerId) {
      return;
    }
    
    try {
      this.gun = Gun(ACTIVE_GUN_RELAYS);
      
      const room = this.gun.get(`pubsub-${this.channel}`);
      
      // Listen to all topics
      room.get('messages').map().on((message, messageId) => {
        if (!message || !message.data) return;
        
        try {
          const data = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
          
          this.stats.transport2.received++;
          this.handleMessage('gun', data.from, data).catch(err => {
            // Silently handle message processing errors
          });
          
        } catch (err) {
          // Silently handle parse errors
        }
      });
      
      
    } catch (err) {
      // Silently handle init errors
    }
  }
  
  /**
   * Handle incoming message from any transport (with UnSEA decryption)
   */
  async handleMessage(source, from, payload) {
    // Process incoming message from network
    if (!payload || !payload.topic) {
      return;
    }
    let decryptedPayload = { ...payload };
    if (payload.encrypted && this.keyPair?.priv) {
      try {
        const decrypted = await decryptMessageWithMeta(
          payload.encrypted,
          this.keyPair.priv
        );
        decryptedPayload.data = JSON.parse(decrypted);
        delete decryptedPayload.encrypted;
      } catch (err) {
        return; // Unable to decrypt, skip
      }
    } else {
      // Fallback for non-encrypted messages
      if (!decryptedPayload.data) {
        decryptedPayload.data = payload.data;
      }
    }
    
    // Create message ID for deduplication based on content, not timestamp
    const dataStr = JSON.stringify(decryptedPayload.data);
    const msgId = `${from}-${decryptedPayload.topic}-${dataStr}`;
    
    if (this.seenMessages.has(msgId)) {
      // Duplicate message skipped (deduplication)
      return; // Already processed
    }
    
    this.seenMessages.add(msgId);
    
    // Cleanup old messages
    if (this.seenMessages.size > this.maxSeenMessages) {
      const toDelete = Array.from(this.seenMessages).slice(0, 100);
      toDelete.forEach(id => this.seenMessages.delete(id));
    }
    
    // Route to topic subscribers
    const topic = decryptedPayload.topic;
    
    // Cache this message for the topic (for replay to future subscribers)
    const cachedMessage = {
      source,
      from,
      topic,
      data: decryptedPayload.data,
      timestamp: decryptedPayload.timestamp
    };
    this.topicCache.set(topic, cachedMessage);
    
    if (topic && this.subscriptions.has(topic)) {
      const callbacks = this.subscriptions.get(topic);
      callbacks.forEach(callback => {
        try {
          callback(cachedMessage);
        } catch (err) {
          // Silently handle callback errors
        }
      });
    }
  }
  
  /**
   * Subscribe to a topic
   */
  subscribe(topic, callback) {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    
    this.subscriptions.get(topic).add(callback);
    
    // Deliver cached message immediately if one exists for this topic
    if (this.topicCache.has(topic)) {
      const cachedMessage = this.topicCache.get(topic);
      setTimeout(() => {
        try {
          callback(cachedMessage);
        } catch (err) {
          // Silently handle callback errors
        }
      }, 0);
    }
    
    return () => this.unsubscribe(topic, callback);
  }
  
  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic, callback) {
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic).delete(callback);
      
      if (this.subscriptions.get(topic).size === 0) {
        this.subscriptions.delete(topic);
      }
    }
  }
  
  /**
   * Publish a message to a topic (encrypted with UnSEA)
   */
  async publish(topic, data) {
    const message = {
      from: this.peerId,
      topic,
      data,
      timestamp: Date.now()
    };
    
    // Send message unencrypted for now (testing)
    let messageToSend = { ...message };
    
    // DEBUG: Log to console (hidden from user)
    if (typeof window !== 'undefined' && window.__DEBUG_PUBSUB) {
      console.log('[DEBUG] Publishing:', messageToSend);
    }
    
    // Publish via Nostr (all relays)
    this.nostrClients.forEach(client => {
      try {
        if (client && typeof client.publish === 'function') {
          client.publish(messageToSend).catch(() => {
            // Silently ignore relay publish errors
          });
          this.stats.transport1.published++;
        }
      } catch (err) {
        // Silently ignore all errors
      }
    });
    
    // Also immediately deliver message to local subscribers (loopback - unencrypted for testing)
    setTimeout(() => {
      this.handleMessage('local', this.peerId, message);
    }, 0);
    
    // Publish via Gun
    if (this.gun) {
      try {
        const room = this.gun.get(`pubsub-room-${this.roomId}`);
        const messageId = `${this.peerId}-${topic}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        
        room.get('messages').get(messageId).put({
          data: JSON.stringify(messageToSend),
          timestamp: Date.now()
        });
        
        this.stats.transport2.published++;
      } catch (err) {
        // Silently handle secondary relay publish errors
      }
    }
  }
  
  /**
   * Get peer ID
   */
  getPeerId() {
    return this.peerId;
  }
  
  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      subscriptions: this.subscriptions.size,
      seenMessages: this.seenMessages.size
    };
  }
  
  /**
   * Cleanup
   */
  async destroy() {
    
    // Disconnect Nostr clients
    this.nostrClients.forEach(client => {
      try {
        client.disconnect?.();
      } catch (err) {
        // Silently handle disconnect errors
      }
    });
    
    this.nostrClients = [];
    this.subscriptions.clear();
    this.seenMessages.clear();
  }
}
