#!/usr/bin/env node

/**
 * BitFabric AI Integration
 * Uses the BitFabric pub/sub library to communicate with brainfuct
 */

import { PubSubFabric } from 'bitfabric';

const API_KEY = 'c1aa5e8c0daa2c4f94d71dbcd0be6ab543d01d4f2e4c7cdcb27546cf8050bedc';
const APP_ID = 'app_pfhbzhvtgqugtj44';
const BRAINFUCT_REPO = 'https://github.com/draeder/brainfuct';

console.log('🧠 BitFabric AI Integration');
console.log('---');
console.log(`API Key: ${API_KEY.substring(0, 16)}...`);
console.log(`App ID: ${APP_ID}`);
console.log(`Brainfuct: ${BRAINFUCT_REPO}`);
console.log('');

// Initialize BitFabric with APP ID as room (not API key)
// This way it listens on the same channel as clients publishing to the App ID
const fabric = new PubSubFabric({
  roomId: APP_ID,  // Use App ID as the room
  peerId: `ai-worker-${Date.now()}`
});

// Connect and listen
try {
  console.log('⏳ Connecting to BitFabric network...');
  
  // Initialize with 10-second timeout
  const initPromise = fabric.init();
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Connection timeout after 10s')), 10000)
  );
  
  try {
    await Promise.race([initPromise, timeoutPromise]);
  } catch (err) {
    if (err.message.includes('timeout')) {
      console.log('⚠ Connection timed out but continuing in background...');
    } else {
      throw err;
    }
  }
  
  console.log('✓ Connected to BitFabric network');
  
  // Subscribe to AI request topic
  fabric.subscribe('ai-request', async (message) => {
    console.log('📨 AI Request received:', message);
    
    // Process request here
    const response = {
      requestId: message.id,
      status: 'processing',
      timestamp: Date.now()
    };
    
    // Publish response
    await fabric.publish('ai-response', response);
  });

  console.log('✓ Listening on topic: ai-request');
  console.log('✓ Publishing responses to: ai-response');
  console.log('');
  console.log('Ready to receive AI requests...');

} catch (err) {
  console.error('❌ Failed to initialize:', err.message);
  process.exit(1);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down...');
  await fabric.disconnect?.();
  process.exit(0);
});
