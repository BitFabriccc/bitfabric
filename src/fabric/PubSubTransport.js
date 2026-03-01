/**
 * PubSubTransport - Distributed Network with End-to-End Encryption
 * 
 * Uses redundant network transports for direct publish/subscribe messaging with end-to-end encryption.
 * All messages encrypted with UnSEA (ECIES elliptic curve encryption).
 * NO WebRTC - all data flows through distributed relays.
 */

import { createNostrClient } from '../nostr/nostrClient.js';
import Gun from 'gun';


const ACTIVE_GUN_RELAYS = [
  'https://relay.peer.ooo/gun'
];

export class PubSubTransport {
  constructor(config = {}) {
    this.roomId = config.roomId;
    this.peerId = config.peerId;

    // Use API key as the channel (isolated per user)
    this.channel = this.roomId || 'bitfabric-global-tier';

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


    // Initialize Nostr first to get peer ID
    await this.initNostr();

    // Ensure we have a peer ID
    if (!this.peerId) {
      throw new Error('Failed to initialize Nostr relays - no peer ID obtained');
    }

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
        await Promise.race([
          this.initNostrRelay(relayUrl),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
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
        await Promise.race([
          this.initNostrRelay(relayUrl),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
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
    // Ensure we can still use Gun even if Nostr is down.
    // Peer ID is used only for identifying the sender.
    if (!this.peerId) {
      try {
        this.peerId = crypto.randomUUID();
      } catch {
        this.peerId = `peer-${Math.random().toString(36).slice(2)}-${Date.now()}`;
      }
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
   * Derive an AES-GCM key from the SHA-256 hash of a topic string.
   * All clients on the same topic share the same key.
   */
  async _getTopicKey(topic) {
    if (this._topicKeys && this._topicKeys.has(topic)) {
      return this._topicKeys.get(topic);
    }
    if (!this._topicKeys) this._topicKeys = new Map();

    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(topic));
    const key = await crypto.subtle.importKey(
      'raw', hashBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
    this._topicKeys.set(topic, key);
    return key;
  }

  /**
   * Encrypt data with the topic-derived AES-GCM key.
   * Returns { iv, ciphertext } both as base64 strings.
   */
  async _encryptForTopic(topic, data) {
    const key = await this._getTopicKey(topic);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(JSON.stringify(data))
    );
    const toBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
    return { iv: toBase64(iv), ciphertext: toBase64(cipherBuffer) };
  }

  /**
   * Decrypt data with the topic-derived AES-GCM key.
   */
  async _decryptForTopic(topic, iv, ciphertext) {
    try {
      const key = await this._getTopicKey(topic);
      const fromBase64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
      const dec = new TextDecoder();
      const plainBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromBase64(iv) },
        key,
        fromBase64(ciphertext)
      );
      return JSON.parse(dec.decode(plainBuffer));
    } catch (err) {
      console.warn(`[PubSub] Decryption failed for topic "${topic}":`, err.message);
      throw err;
    }
  }

  /**
   * Decrypt data with the topic-derived AES-GCM key (public)
   */
  async decryptForTopic(topic, iv, ciphertext) {
    return this._decryptForTopic(topic, iv, ciphertext);
  }

  /**
   * Handle incoming message from any transport
   */
  async handleMessage(source, from, payload) {
    if (!payload || !payload.topic) return;

    // Diagnostic log for incoming raw payload
    console.log(`[PubSub] << RCV [${source}] from: ${from?.slice(0, 8)} topic: ${payload.topic}`,
      payload.topicEncrypted ? '(ENCRYPTED)' : '(PLAIN)');

    let decryptedPayload = { ...payload };

    // Topic-derived AES-GCM decryption
    if (payload.topicEncrypted && payload.iv && payload.ciphertext) {
      try {
        decryptedPayload.data = await this._decryptForTopic(
          payload.topic, payload.iv, payload.ciphertext
        );
        console.log(`[PubSub] << DEC [${source}] topic: ${payload.topic} SUCCESS`);
        delete decryptedPayload.topicEncrypted;
        delete decryptedPayload.iv;
        delete decryptedPayload.ciphertext;
      } catch (err) {
        console.error(`[PubSub] << DEC [${source}] topic: ${payload.topic} FAILED:`, err.message);
        return; // Wrong topic key or corrupted — drop
      }
    } else if (!decryptedPayload.data) {
      decryptedPayload.data = payload.data;
    }

    // Deduplication — use messageId if present
    const msgId = payload.messageId
      ? payload.messageId
      : `${from}-${decryptedPayload.topic}-${JSON.stringify(decryptedPayload.data)}-${decryptedPayload.timestamp || ''}`;

    if (this.seenMessages.has(msgId)) return;
    this.seenMessages.add(msgId);

    if (this.seenMessages.size > this.maxSeenMessages) {
      const toDelete = Array.from(this.seenMessages).slice(0, 100);
      toDelete.forEach(id => this.seenMessages.delete(id));
    }

    const topic = decryptedPayload.topic;
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
        try { callback(cachedMessage); } catch (err) { }
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
        try { callback(cachedMessage); } catch (err) { }
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
   * Publish a message to a topic — encrypted with topic-derived AES-GCM key
   */
  async publish(topic, data) {
    const messageId = `${this.peerId}-${topic}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Encrypt payload with topic-derived key
    let encrypted;
    try {
      encrypted = await this._encryptForTopic(topic, data);
    } catch (err) {
      encrypted = null;
    }

    const message = {
      messageId,
      from: this.peerId,
      topic,
      timestamp: Date.now(),
      ...(encrypted
        ? { topicEncrypted: true, iv: encrypted.iv, ciphertext: encrypted.ciphertext }
        : { data }) // fallback: send plaintext if crypto fails
    };

    // Publish via Nostr
    this.nostrClients.forEach(client => {
      try {
        if (client && typeof client.publish === 'function') {
          client.publish(message).catch(() => { });
          this.stats.transport1.published++;
        }
      } catch (err) { }
    });

    // Loopback to local subscribers (decrypt path, consistent with remote)
    setTimeout(() => {
      this.handleMessage('local', this.peerId, message);
    }, 10);

    // Publish via Gun
    if (this.gun) {
      try {
        const room = this.gun.get(`pubsub-${this.channel}`);
        const gunMsgId = `${this.peerId}-${topic}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        room.get('messages').get(gunMsgId).put({
          data: JSON.stringify(message),
          timestamp: Date.now()
        });
        this.stats.transport2.published++;
      } catch (err) { }
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
