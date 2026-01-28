/**
 * PubSubFabric - Universal pub/sub over Gun + Nostr
 * 
 * Direct publish/subscribe messaging using Gun and Nostr relays.
 * NO WebRTC - all data flows through Gun and Nostr.
 */

import { PubSubTransport } from './PubSubTransport.js';

export class PubSubFabric {
  constructor(config = {}) {
    this.roomId = config.roomId || 'default';
    this.peerId = config.peerId || null;
    
    // Transport layer (Gun + Nostr) - ALL data flows through these
    this.transport = new PubSubTransport({
      roomId: this.roomId,
      peerId: this.peerId,
      nostrRelays: config.nostrRelays || [
        'wss://relay.primal.net',
        'wss://relay.nostr.band',
        'wss://nos.lol',
        'wss://relay.snort.social',
        'wss://nostr.wine',
        'wss://relay.damus.io'
      ]
    });
    
    // Local subscriptions: topic -> Set<callback>
    this.subscriptions = new Map();
    
    // Track ready state
    this.ready = false;
    this.readyPromise = null;
    
    // Stats
    this.stats = {
      messagesPublished: 0,
      messagesReceived: 0,
      topics: 0
    };
  }
  
  /**
   * Initialize the fabric
   */
  async init() {
    if (this.readyPromise) return this.readyPromise;
    
    this.readyPromise = (async () => {
      
      // Initialize transport
      await this.transport.init();
      this.peerId = this.transport.getPeerId();
      
      this.ready = true;
      
      return this.peerId;
    })();
    
    return this.readyPromise;
  }
  
  /**
   * Subscribe to a topic
   */
  subscribe(topic, callback) {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      this.stats.topics = this.subscriptions.size;
      
      // Subscribe at transport level
      this.transport.subscribe(topic, (message) => {
        this.stats.messagesReceived++;
        
        // Call all local subscribers
        const callbacks = this.subscriptions.get(topic);
        if (callbacks) {
          callbacks.forEach(cb => {
            try {
              cb(message);
            } catch (err) {
            }
          });
        }
      });
    }
    
    this.subscriptions.get(topic).add(callback);
    
    // Return unsubscribe function
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
        this.stats.topics = this.subscriptions.size;
        this.transport.unsubscribe(topic, callback);
      }
    }
  }
  
  /**
   * Publish a message to a topic
   */
  async publish(topic, data) {
    if (!this.ready) {
      throw new Error('PubSubFabric not ready. Call init() first.');
    }
    
    await this.transport.publish(topic, data);
    this.stats.messagesPublished++;
  }
  
  /**
   * Get peer ID
   */
  getPeerId() {
    return this.peerId;
  }
  
  /**
   * Get fabric stats
   */
  getStats() {
    const transportStats = this.transport.getStats();
    return {
      ...this.stats,
      transport: transportStats,
      peerId: this.peerId?.substring(0, 8)
    };
  }
  
  /**
   * Cleanup
   */
  async destroy() {
    
    this.subscriptions.clear();
    await this.transport.destroy();
    this.ready = false;
  }
}
