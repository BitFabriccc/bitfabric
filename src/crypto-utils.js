/**
 * Encryption utilities for BitFabric
 * Uses TweetNaCl.js for authenticated encryption (secretbox)
 */

// Generate encryption key from API key
export function deriveEncryptionKey(apiKey) {
  // Create a consistent key from API key using SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  return crypto.subtle.digest('SHA-256', data).then(hash => {
    // Convert to Uint8Array for NaCl
    return new Uint8Array(hash);
  });
}

// Encrypt message with nonce
export async function encryptMessage(message, encryptionKey) {
  if (typeof nacl === 'undefined') {
    throw new Error('TweetNaCl.js not loaded');
  }
  
  const encoder = new TextEncoder();
  const messageUint8 = encoder.encode(JSON.stringify(message));
  
  // Generate random nonce
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  
  // Encrypt
  const encrypted = nacl.secretbox(messageUint8, nonce, encryptionKey);
  
  if (!encrypted) {
    throw new Error('Encryption failed');
  }
  
  // Combine nonce + encrypted data
  const full = new Uint8Array(nonce.length + encrypted.length);
  full.set(nonce);
  full.set(encrypted, nonce.length);
  
  // Return as base64
  return btoa(String.fromCharCode(...full));
}

// Decrypt message
export async function decryptMessage(encrypted, encryptionKey) {
  if (typeof nacl === 'undefined') {
    throw new Error('TweetNaCl.js not loaded');
  }
  
  try {
    // Decode from base64
    const full = new Uint8Array(atob(encrypted).split('').map(c => c.charCodeAt(0)));
    
    // Split nonce and encrypted data
    const nonce = full.slice(0, nacl.secretbox.nonceLength);
    const encryptedData = full.slice(nacl.secretbox.nonceLength);
    
    // Decrypt
    const decrypted = nacl.secretbox.open(encryptedData, nonce, encryptionKey);
    
    if (!decrypted) {
      throw new Error('Decryption failed - wrong key or tampered data');
    }
    
    // Convert back to string and parse JSON
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch (err) {
    throw new Error('Decryption failed: ' + err.message);
  }
}

// Sign message with API key
export async function signMessage(message, apiKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(message) + apiKey);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify message signature
export async function verifySignature(message, signature, apiKey) {
  const computed = await signMessage(message, apiKey);
  return computed === signature;
}
