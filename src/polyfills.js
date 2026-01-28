// Browser polyfills for libs expecting Node globals

// Ensure global/globalThis mapping
if (typeof globalThis.global === 'undefined') {
  globalThis.global = globalThis;
}

// Minimal process shim
if (!globalThis.process) {
  globalThis.process = { browser: true, env: {} };
} else {
  globalThis.process.browser = true;
  if (!globalThis.process.env) globalThis.process.env = {};
}
if (!globalThis.process.nextTick) {
  globalThis.process.nextTick = (cb, ...args) => Promise.resolve().then(() => cb(...args));
}

// Buffer shim
import { Buffer } from 'buffer';
if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

// crypto.getRandomValues shim for environments missing it (should exist in browsers)
if (!globalThis.crypto && typeof window !== 'undefined' && window.crypto) {
  globalThis.crypto = window.crypto;
}
