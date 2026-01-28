<template>
  <div>
    <div class="grid-bg"></div>
    <div class="app-shell">
      <section class="hero">
        <div class="badge">Real-Time Messaging</div>
        <h1>BitFabric PubSub</h1>
        <p>
          Enterprise-grade publish/subscribe messaging. 
          Real-time data distribution at global scale.
        </p>
        
        <!-- Not signed in -->
        <div v-if="!roomId" class="signin-banner">
          <div class="signin-content">
            <h2>🚀 Sign In to BitFabric</h2>
            <p>Enter your email and password to access your account</p>
            
            <div class="signin-form">
              <input 
                v-model="signInEmail" 
                type="email" 
                class="signin-input" 
                placeholder="your@email.com"
                @keyup.enter="$refs.passwordInput.focus()"
              />
              <input 
                v-model="signInPassword" 
                type="password" 
                class="signin-input" 
                placeholder="Password"
                ref="passwordInput"
                @keyup.enter="signInWithEmail"
              />
              <button class="btn-cta" @click="signInWithEmail" :disabled="!signInEmail.trim() || !signInPassword.trim()">
                Sign In
              </button>
            </div>
            
            <div class="signin-links">
              <span>Don't have an account?</span>
              <a href="/signup.html" class="btn-link-bold">Create Free Account</a>
              <span>•</span>
              <a href="/pricing.html" class="btn-link">View Pricing</a>
            </div>
          </div>
        </div>
        
        <!-- Signed in -->
        <div v-else>
          <div class="meta">
            <span class="tag">{{ userEmail }}</span>
            <span class="tag">API Key: {{ roomId }}</span>
          </div>
          <div class="hero-actions">
            <button class="btn-primary" :disabled="isConnecting || isReady" @click="connect">
              {{ isConnecting ? 'Connecting…' : isReady ? 'Connected' : 'Connect' }}
            </button>
            <button class="btn-ghost" :disabled="!isReady && !fabric" @click="disconnect">Disconnect</button>
            <button class="btn-ghost" @click="logout" style="background: #ff6b6b; color: white;">Logout</button>
          </div>
        </div>
      </section>

      <div class="card-grid">
        <!-- Session card only shown when not signed in -->
        <div class="card" v-if="!roomId">
          <h3>Session</h3>
          <p class="muted">Sign in with your API key or <a href="/signup.html" style="color: #667eea; font-weight: 600;">create a free account</a>.</p>
          <div class="field">
            <label for="room">API Key</label>
            <input id="room" v-model="roomId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off" />
          </div>
          <div class="hero-actions" style="margin-top: 8px;">
            <button class="btn-primary" :disabled="isConnecting || isReady" @click="connect">
              {{ isConnecting ? 'Connecting…' : 'Connect' }}
            </button>
            <button class="btn-ghost" :disabled="!isReady && !fabric" @click="disconnect">Reset</button>
          </div>
        </div>

        <div class="card">
          <h3>Publish</h3>
          <div class="field">
            <label for="topic">Topic</label>
            <input id="topic" v-model="publishTopic" placeholder="e.g., events, data, notifications" autocomplete="off" />
          </div>
          <div class="field">
            <label for="message">Message Data (JSON)</label>
            <textarea
              id="message"
              v-model="messageData"
              rows="3"
              placeholder='{"type": "event", "value": 123}'
            ></textarea>
          </div>
          <div class="hero-actions" style="justify-content: space-between;">
            <div class="tag-row">
              <span class="tag">Delivery: Global P2P</span>
            </div>
            <button class="btn-primary" :disabled="!isReady || !publishTopic.trim() || !messageData.trim()" @click="publish">
              Publish
            </button>
          </div>
          <p class="muted">Messages are delivered globally through our distributed network to all subscribers.</p>
        </div>

        <div class="card">
          <h3>PubSub Stats</h3>
          <div class="stat-grid">
            <div class="stat">
              <div class="value">{{ stats.messagesPublished }}</div>
              <div class="label">Published</div>
            </div>
            <div class="stat">
              <div class="value">{{ stats.messagesReceived }}</div>
              <div class="label">Received</div>
            </div>
            <div class="stat">
              <div class="value">{{ stats.topics }}</div>
              <div class="label">Topics</div>
            </div>
            <div class="stat">
              <div class="value">{{ (stats.transport?.transport1?.published || 0) + (stats.transport?.transport2?.published || 0) }}</div>
              <div class="label">Delivered</div>
            </div>
          </div>
          <div class="tag-row" style="margin-top: 10px;">
            <span class="tag">Network: Active</span>
            <span class="tag">Protocol: P2P</span>
          </div>
        </div>

        <div class="card">
          <h3>Subscribe</h3>
          <div class="field">
            <label for="subtopic">Topic</label>
            <input id="subtopic" v-model="subscribeTopic" placeholder="e.g., events, data" autocomplete="off" />
          </div>
          <div class="hero-actions">
            <button class="btn-primary" :disabled="!isReady || !subscribeTopic.trim()" @click="addSubscription">
              Subscribe
            </button>
          </div>
          <div class="tag-row" style="margin-top: 10px;">
            <span class="tag" v-for="topic in subscribedTopics" :key="topic">{{ topic }}</span>
            <span class="muted" v-if="subscribedTopics.length === 0">No active subscriptions</span>
          </div>
        </div>

        <div class="card">
          <h3>Received Messages</h3>
          <div class="list" v-if="messages.length" style="max-height: 300px; overflow-y: auto;">
            <div class="message" v-for="msg in messages" :key="msg.messageId">
              <div class="tag-row">
                <span class="tag">{{ msg.topic }}</span>
                <span class="tag">{{ new Date(msg.receivedAt).toLocaleTimeString() }}</span>
              </div>
              <div style="margin-top: 4px;"><strong>from:</strong> {{ msg.from?.slice(0, 16) }}</div>
              <pre style="margin: 4px 0 0 0; background: #1a1a1a; color: #e0e0e0; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 13px;">{{ JSON.stringify(msg.data, null, 2) }}</pre>
            </div>
          </div>
          <p v-else class="muted">Subscribed messages appear here.</p>
        </div>

        <div class="card">
          <h3>API Keys</h3>
          <div v-if="userPlan === 'starter'" class="muted">
            <p>Upgrade to Professional or Enterprise to manage multiple API keys.</p>
          </div>
          <div v-else>
            <div class="field">
              <label for="keyname">Key Name</label>
              <input id="keyname" v-model="newKeyName" placeholder="e.g., Production API" class="form-input" />
            </div>
            <div class="field">
              <label for="keydesc">Description (optional)</label>
              <textarea id="keydesc" v-model="newKeyDescription" rows="2" placeholder="What is this key for?" class="form-input"></textarea>
            </div>
            <button class="btn-primary" @click="createApiKey" :disabled="!newKeyName.trim()">
              Create API Key
            </button>
            
            <div v-if="apiKeys.length" style="margin-top: 20px;">
              <h4 style="margin: 0 0 12px 0;">Your API Keys</h4>
              <div class="api-keys-list">
                <div class="api-key-item" v-for="key in apiKeys" :key="key.key_id">
                  <div class="key-header">
                    <div>
                      <strong>{{ key.name }}</strong>
                      <span v-if="key.permanent" style="margin-left: 8px; padding: 2px 6px; background: #48bb78; color: white; border-radius: 4px; font-size: 10px; font-weight: 600;">PERMANENT</span>
                      <p style="margin: 2px 0 0 0; color: var(--muted); font-size: 12px;">{{ key.description }}</p>
                      <p style="margin: 4px 0 0 0; color: var(--muted); font-size: 11px;">Created: {{ new Date(key.created_at).toLocaleDateString() }}</p>
                    </div>
                    <button v-if="!key.permanent" class="btn-small" @click="deleteApiKey(key.key_id)">Delete</button>
                  </div>
                  <div style="background: #1a1a1a; padding: 8px; border-radius: 4px; margin-top: 8px; font-family: monospace; font-size: 12px; overflow-x: auto;">
                    {{ key.value }}
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="muted" style="margin-top: 12px;">
              No API keys yet. Create one to get started.
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Logs</h3>
          <div class="list" style="max-height: 240px;">
            <div v-for="(log, idx) in logs" :key="idx" class="log">{{ log }}</div>
          </div>
        </div>

        <div class="card">
          <h3>How it works</h3>
          <ul style="margin: 0; padding-left: 18px; color: var(--muted);">
            <li>Direct peer-to-peer messaging</li>
            <li>Global distributed network</li>
            <li>Automatic message deduplication</li>
            <li>Sub-second latency delivery</li>
          </ul>
        </div>
      </div>

      <div class="footer">
        BitFabric PubSub © 2026 · <a href="/pricing.html" style="color: #667eea; text-decoration: none;">Pricing</a> · <a href="/signup.html" style="color: #667eea; text-decoration: none;">Get Started</a> · Enterprise solutions available
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { PubSubFabric } from './fabric/index.js';

// Check sessionStorage for stored API key (don't use URL for security)
const storedApiKey = sessionStorage.getItem('bitfabric-api-key');
const roomId = ref(storedApiKey || '');
const accountId = ref('');
const signInEmail = ref('');
const signInPassword = ref('');
const publishTopic = ref('events');
const subscribeTopic = ref('events');
const messageData = ref('{"type": "test", "value": 123}');
const messages = ref([]);
const logs = ref([]);
const subscribedTopics = ref([]);
const unsubscribeFunctions = new Map();
const userEmail = ref('');
const userPlan = ref('starter');
const newKeyName = ref('');
const newKeyDescription = ref('');
const apiKeys = ref([]);

const stats = ref({
  messagesPublished: 0,
  messagesReceived: 0,
  topics: 0,
  transport: {
    transport1: { published: 0, received: 0 },
    transport2: { published: 0, received: 0 }
  }
});

// Load user data from sessionStorage and fetch keys from D1
async function initializeFromStorage() {
  if (storedApiKey) {
    const storedEmail = sessionStorage.getItem('bitfabric-email');
    const storedPasswordHash = sessionStorage.getItem('bitfabric-password-hash');
    if (storedEmail && storedPasswordHash) {
      // Regenerate deterministic session key
      const deterministicKey = await generateDeterministicKey(storedEmail, storedPasswordHash);
      sessionStorage.setItem('bitfabric-api-key', deterministicKey);
      roomId.value = deterministicKey;
      
      // Generate immutable account ID
      const immutableAccountId = await generateAccountId(storedEmail, storedPasswordHash);
      accountId.value = immutableAccountId;
      
      userEmail.value = storedEmail;
      
      // Check premium status from server
      let isPremium = false;
      try {
        const premiumResponse = await fetch('/api/premium-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: storedEmail })
        });
        if (premiumResponse.ok) {
          const premiumData = await premiumResponse.json();
          isPremium = premiumData.isPremium;
        }
      } catch (error) {
        console.error('Error checking premium status:', error);
      }
      userPlan.value = isPremium ? 'enterprise' : 'starter';
      
      // Fetch API keys from D1 database (using immutable account ID)
      if (isPremium) {
        try {
          const response = await fetch(`/api/keys?account_id=${encodeURIComponent(immutableAccountId)}`);
          if (response.ok) {
            const data = await response.json();
            apiKeys.value = data.keys || [];
            
            // Check if Default key exists in D1
            const existingDefault = apiKeys.value.find(k => k.key_id === 'default');
            if (!existingDefault) {
              // Only create Default key on first login
              const defaultKeyValue = await generateDefaultKey(storedEmail, storedPasswordHash);
              await createKeyInDB('Default', 'Your default API key', defaultKeyValue);
              // Fetch again to get the newly created key
              const refetch = await fetch(`/api/keys?account_id=${encodeURIComponent(immutableAccountId)}`);
              if (refetch.ok) {
                apiKeys.value = (await refetch.json()).keys || [];
              }
            }
            // If Default key exists, keep using it (even if password changed!)
          }
        } catch (error) {
          pushLog('Error loading API keys: ' + error.message);
        }
      }
    }
  }
}

// Helper: create key in database (using immutable account ID)
async function createKeyInDB(keyName, keyDescription, keyValue) {
  try {
    const response = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: accountId.value,
        keyName,
        keyDescription,
        keyValue
      })
    });
    return response.ok;
  } catch (error) {
    pushLog('Error creating API key: ' + error.message);
    return false;
  }
}

// Initialize on load
initializeFromStorage();

const nostrRelays = [
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://relay.damus.io'
];

let fabric = null;
let statsInterval = null;
const status = ref('idle');
const peerId = ref('');

const shortPeerId = computed(() => {
  return peerId.value ? peerId.value.slice(0, 10) + '…' : 'None';
});

const statusLabel = computed(() => {
  if (status.value === 'connecting') return 'Connecting';
  if (status.value === 'ready') return 'Live';
  if (status.value === 'error') return 'Error';
  return 'Idle';
});

const isConnecting = computed(() => status.value === 'connecting');
const isReady = computed(() => status.value === 'ready');

// Clear any API key from URL for security
if (window.location.search.includes('apikey') || window.location.search.includes('room')) {
  window.history.replaceState({}, '', window.location.pathname);
}

function pushLog(text) {
  const line = `${new Date().toLocaleTimeString()} · ${text}`;
  logs.value.unshift(line);
  if (logs.value.length > 120) logs.value.pop();
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate deterministic API key from email + password hash
async function generateDeterministicKey(email, passwordHash) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`bitfabric-${email.toLowerCase()}-${passwordHash}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  // Format as UUID
  return `${hash.substr(0,8)}-${hash.substr(8,4)}-${hash.substr(12,4)}-${hash.substr(16,4)}-${hash.substr(20,12)}`;
}

// Generate immutable account ID from email + password hash (never changes)
async function generateAccountId(email, passwordHash) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`bitfabric-account-${email.toLowerCase()}-${passwordHash}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hash.substr(0,8)}-${hash.substr(8,4)}-${hash.substr(12,4)}-${hash.substr(16,4)}-${hash.substr(20,12)}`;
}

// Generate deterministic Default key - same as session key (one key per user!)
async function generateDefaultKey(email, passwordHash) {
  return await generateDeterministicKey(email, passwordHash);
}
async function signInWithEmail() {
  const email = signInEmail.value.trim().toLowerCase();
  const password = signInPassword.value.trim();
  if (!email || !password) return;
  
  // Hash the entered password
  const hashedPassword = await hashPassword(password);
  
  // Generate deterministic key from email + password hash
  const deterministicKey = await generateDeterministicKey(email, hashedPassword);
  
  // Check sessionStorage for stored API key for this email
  const storedEmail = sessionStorage.getItem('bitfabric-email');
  const storedPasswordHash = sessionStorage.getItem('bitfabric-password-hash');
  
  if (storedEmail === email && storedPasswordHash === hashedPassword) {
    // Correct credentials - use deterministic key
    sessionStorage.setItem('bitfabric-api-key', deterministicKey);
    roomId.value = deterministicKey;
    
    // Generate immutable account ID
    const immutableAccountId = await generateAccountId(email, hashedPassword);
    accountId.value = immutableAccountId;
    
    userEmail.value = email;
    
    // Check premium status from server
    let isPremium = false;
    try {
      const premiumResponse = await fetch('/api/premium-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });
      if (premiumResponse.ok) {
        const premiumData = await premiumResponse.json();
        isPremium = premiumData.isPremium;
      }
    } catch (error) {
      console.error('Error checking premium status:', error);
    }
    userPlan.value = isPremium ? 'enterprise' : 'starter';
    
    // Fetch API keys from D1 (using immutable account ID)
    if (isPremium) {
      try {
        const response = await fetch(`/api/keys?account_id=${encodeURIComponent(immutableAccountId)}`);
        if (response.ok) {
          const data = await response.json();
          apiKeys.value = data.keys || [];
          
          // Check if Default key exists in D1
          const existingDefault = apiKeys.value.find(k => k.key_id === 'default');
          if (!existingDefault) {
            // Only create Default key on first login
            const defaultKeyValue = await generateDefaultKey(email, hashedPassword);
            await createKeyInDB('Default', 'Your default API key', defaultKeyValue);
            // Fetch again to get the newly created key
            const refetch = await fetch(`/api/keys?account_id=${encodeURIComponent(immutableAccountId)}`);
            if (refetch.ok) {
              apiKeys.value = (await refetch.json()).keys || [];
            }
          }
          // If Default key exists, keep using it (even if password changed!)
        }
      } catch (error) {
        pushLog('Error loading keys: ' + error.message);
      }
    }
    connect();
  }
  
  if (storedEmail === email && storedPasswordHash !== hashedPassword) {
    // Wrong password
    alert('Incorrect password. Please try again.');
  } else {
    // No account found - redirect to signup
    window.location.href = `/signup.html?email=${encodeURIComponent(email)}`;
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function connect() {
  if (isConnecting.value) return;
  await disconnect();
  
  // Store API key in sessionStorage only (never in URL)
  sessionStorage.setItem('bitfabric-api-key', roomId.value);
  
  status.value = 'connecting';
  pushLog('Booting fabric…');

  try {
    fabric = new PubSubFabric({
      roomId: roomId.value.trim() || 'default',
      nostrRelays
    });

    const peerIdValue = await fabric.init();
    peerId.value = peerIdValue;
    pushLog(`Client ID: ${peerIdValue}`);

    statsInterval = setInterval(() => {
      stats.value = fabric.getStats();
    }, 1200);

    status.value = 'ready';
    pushLog('Connected - ready to publish/subscribe');
  } catch (err) {
    console.error(err);
    pushLog('Failed to connect: ' + (err?.message || err));
    status.value = 'error';
  }
}

async function disconnect() {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  
  // Unsubscribe from all topics
  unsubscribeFunctions.forEach((unsub, topic) => {
    try {
      unsub();
    } catch {}
  });
  unsubscribeFunctions.clear();
  subscribedTopics.value = [];
  
  if (fabric) {
    try {
      await fabric.destroy();
      pushLog('Disconnected.');
    } catch (err) {
      pushLog('Error during disconnect: ' + (err?.message || err));
    }
    fabric = null;
  }
  peerId.value = '';
  status.value = 'idle';
  messages.value = [];
}

function publish() {
  if (!fabric || !isReady.value) return;
  const topic = publishTopic.value.trim();
  const dataStr = messageData.value.trim();
  if (!topic || !dataStr) return;

  try {
    const data = JSON.parse(dataStr);
    
    // Auto-subscribe to the topic if not already subscribed
    if (!subscribedTopics.value.includes(topic)) {
      const unsub = fabric.subscribe(topic, (message) => {
        messages.value.unshift({
          topic: message.topic,
          from: message.from,
          data: message.data,
          messageId: `${message.from}-${message.topic}-${Date.now()}`,
          receivedAt: message.timestamp || Date.now()
        });
        if (messages.value.length > 50) messages.value.pop();
      });
      
      unsubscribeFunctions.set(topic, unsub);
      subscribedTopics.value.push(topic);
      pushLog(`Auto-subscribed to: ${topic}`);
    }
    
    fabric.publish(topic, data);
    pushLog(`Published to topic: ${topic}`);
  } catch (err) {
    pushLog('Invalid JSON: ' + err.message);
  }
}

function addSubscription() {
  if (!fabric || !isReady.value) return;
  const topic = subscribeTopic.value.trim();
  if (!topic) return;
  
  if (subscribedTopics.value.includes(topic)) {
    pushLog(`Already subscribed to: ${topic}`);
    return;
  }

  const unsub = fabric.subscribe(topic, (message) => {
    messages.value.unshift({
      topic: message.topic,
      from: message.from,
      data: message.data,
      messageId: `${message.from}-${message.topic}-${Date.now()}`,
      receivedAt: message.timestamp || Date.now()
    });
    if (messages.value.length > 50) messages.value.pop();
  });
  
  unsubscribeFunctions.set(topic, unsub);
  subscribedTopics.value.push(topic);
  pushLog(`Subscribed to: ${topic}`);
  subscribeTopic.value = '';
}

function createApiKey() {
  const name = newKeyName.value.trim();
  const description = newKeyDescription.value.trim();
  if (!name) return;
  
  // Generate unique API key
  const keyValue = generateUUID();
  
  // Post to API
  fetch('/api/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userEmail.value,
      passwordHash: sessionStorage.getItem('bitfabric-password-hash'),
      keyName: name,
      keyDescription: description,
      keyValue: keyValue
    })
  }).then(response => {
    if (response.ok) {
      // Add to local list
      const newKey = {
        key_id: generateUUID(),
        name: name,
        description: description,
        value: keyValue,
        created_at: Date.now(),
        permanent: false
      };
      apiKeys.value.push(newKey);
      
      // Clear form
      newKeyName.value = '';
      newKeyDescription.value = '';
      
      pushLog(`Created API key: ${name}`);
    }
  }).catch(err => {
    pushLog('Error creating API key: ' + err.message);
  });
}

function deleteApiKey(keyId) {
  // Prevent deletion of Default key
  if (keyId === 'default') {
    alert('Default API key cannot be deleted.');
    return;
  }
  
  // Delete from API (using immutable account ID)
  fetch('/api/keys', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account_id: accountId.value,
      keyId: keyId
    })
  }).then(response => {
    if (response.ok) {
      // Remove from local list
      const index = apiKeys.value.findIndex(k => k.key_id === keyId);
      if (index >= 0) {
        const keyName = apiKeys.value[index].name;
        apiKeys.value.splice(index, 1);
        pushLog(`Deleted API key: ${keyName}`);
      }
    }
  }).catch(err => {
    pushLog('Error deleting API key: ' + err.message);
  });
}

function logout() {
  // Clear all sessionStorage data
  sessionStorage.removeItem('bitfabric-api-key');
  sessionStorage.removeItem('bitfabric-email');
  sessionStorage.removeItem('bitfabric-password-hash');
  
  // Clear UI
  roomId.value = '';
  userEmail.value = '';
  userPlan.value = 'starter';
  apiKeys.value = [];
  signInEmail.value = '';
  signInPassword.value = '';
  messages.value = [];
  logs.value = [];
  
  // Disconnect
  disconnect();
  
  pushLog('Logged out');
}

onBeforeUnmount(() => {
  disconnect();
});
</script>

<style scoped>
@import './styles/base.css';

.muted {
  color: var(--muted);
}
</style>
