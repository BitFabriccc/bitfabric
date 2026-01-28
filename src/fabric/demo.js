/**
 * Pub/Sub Fabric Demo
 * 
 * Example usage of the pub/sub fabric with Gun + Nostr.
 * All data flows directly through Gun and Nostr relays - NO WebRTC.
 */

import { PubSubFabric } from './index.js';

// Create a demo chat application using the pub/sub fabric
export async function createChatDemo(roomId = 'demo-room') {
  console.log('=== PubSub Fabric Demo (Gun + Nostr) ===');
  console.log('API Key:', roomId);
  console.log('');
  
  // Initialize the fabric
  const fabric = new PubSubFabric({
    roomId,
    nostrRelays: [
      'wss://relay.damus.io',
      'wss://relay.nostr.band'
    ]
  });
  
  // Initialize (starts discovery on all transports)
  console.log('Initializing fabric...');
  const peerId = await fabric.init();
  console.log('✓ Fabric ready');
  console.log('✓ Peer ID:', peerId.substring(0, 16) + '...');
  console.log('');
  
  // Subscribe to chat messages
  console.log('Subscribing to topics...');
  const unsubscribeChat = fabric.subscribe('chat', (message) => {
    console.log(`[CHAT from ${message.from.substring(0, 8)}] ${message.data.text}`);
  });
  
  // Subscribe to presence updates
  const unsubscribePresence = fabric.subscribe('presence', (message) => {
    console.log(`[PRESENCE] ${message.from.substring(0, 8)} - ${message.data.status}`);
  });
  
  console.log('✓ Subscribed to: chat, presence');
  console.log('');
  
  // Announce presence
  fabric.publish('presence', {
    status: 'online',
    username: 'User-' + peerId.substring(0, 6)
  });
  
  // Send a welcome message after 2 seconds
  setTimeout(() => {
    fabric.publish('chat', {
      text: 'Hello from the pub/sub fabric!',
      username: 'User-' + peerId.substring(0, 6)
    });
  }, 2000);
  
  // Show stats every 10 seconds
  const statsInterval = setInterval(() => {
    const stats = fabric.getStats();
    console.log('');
    console.log('=== Stats ===');
    console.log('Topics:', stats.topics);
    console.log('Messages published:', stats.messagesPublished);
    console.log('Messages received:', stats.messagesReceived);
    console.log('Transport:', stats.transport);
    console.log('');
  }, 10000);
  
  // Return API for interaction
  return {
    fabric,
    peerId,
    
    // Send chat message
    sendMessage: (text) => {
      fabric.publish('chat', {
        text,
        username: 'User-' + peerId.substring(0, 6)
      });
    },
    
    // Update presence
    updatePresence: (status) => {
      fabric.publish('presence', {
        status,
        username: 'User-' + peerId.substring(0, 6)
      });
    },
    
    // Publish custom topic
    publish: (topic, data) => {
      fabric.publish(topic, data);
    },
    
    // Subscribe to custom topic
    subscribe: (topic, callback) => {
      return fabric.subscribe(topic, callback);
    },
    
    // Get stats
    getStats: () => fabric.getStats(),
    
    // Get connected peers
    getPeers: () => fabric.getConnectedPeers(),
    
    // Cleanup
    destroy: async () => {
      clearInterval(statsInterval);
      unsubscribeChat();
      unsubscribePresence();
      await fabric.destroy();
      console.log('✓ Demo destroyed');
    }
  };
}

// Expose for browser console if needed
if (typeof window !== 'undefined') {
  window.createChatDemo = createChatDemo;
}
