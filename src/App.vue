<template>
  <div>
    <div class="grid-bg"></div>
    <div class="app-shell">
      <section class="hero">
        <div class="logo-container">
          <svg width="420" height="220" viewBox="0 0 420 220" xmlns="http://www.w3.org/2000/svg" class="main-logo">
            <g transform="translate(210, 110)">
              <!-- Outer indigo border -->
              <ellipse cx="0" cy="0" rx="195" ry="95" fill="#4e5cc4" />
              <!-- White middle border -->
              <ellipse cx="0" cy="0" rx="188" ry="88" fill="white" />
              <!-- Main green oval (Site accent) -->
              <ellipse cx="0" cy="0" rx="180" ry="80" fill="#1ed2af" />
              
              <!-- "BIT" Text - Shifted LEFT and DOWN (y="16") for perfect border contact -->
              <text 
                x="-15" 
                y="16"
                font-family="'Space Grotesk', sans-serif" 
                font-size="155" 
                font-weight="700" 
                fill="white" 
                stroke="white"
                stroke-width="6"
                paint-order="stroke fill"
                text-anchor="middle"
                dominant-baseline="middle"
                style="font-style: italic; letter-spacing: -4px;"
                transform="skewX(-5)"
              >BIT</text>
            </g>
          </svg>
        </div>
        <div class="badge">Real-Time Messaging</div>
        <h1>BitFabric PubSub</h1>
        <p>
          Enterprise-grade publish/subscribe messaging. 
          Real-time data distribution at global scale.
        </p>
        
        <!-- Connection Controls (Universal) -->
        <div>
          <div class="meta" v-if="isEmailAuthed">
            <span class="tag">{{ userEmail }}</span>
            <span class="tag">API Key: {{ roomId }}</span>
          </div>

          <div class="field" v-if="isEmailAuthed" style="max-width: 520px; margin-top: 10px;">
            <label for="roomSignedIn">API Key (paste to test)</label>
            <input id="roomSignedIn" v-model="roomId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off" />
          </div>

          <div class="hero-actions">
            <button class="btn-primary" :disabled="isConnecting || isReady" @click="connect">
              {{ isConnecting ? 'Connecting…' : isReady ? 'Connected' : 'Connect' }}
            </button>
            <button class="btn-ghost" :disabled="!isReady && !fabric" @click="disconnect">Disconnect</button>
            <button class="btn-ghost" @click="joinForum" :style="isForumVisible ? 'border-color:var(--primary-color);color:var(--primary-color);' : ''">
              {{ isForumVisible ? 'Forum Active' : 'Support Forum' }}
            </button>
            <button v-if="isEmailAuthed" class="btn-ghost" @click="logout" style="background: #ff6b6b; color: white;">Logout</button>
          </div>
        </div>
      </section>

      <div class="card-grid">
        <!-- Account Card: always show -->
        <div class="card">
          <h3>{{ isEmailAuthed ? 'Managed Account' : 'Account' }}</h3>
          
          <div v-if="!isEmailAuthed" class="signin-form-compact">
            <p class="muted" style="margin-bottom: 12px;">
              Sign in for Managed features &amp; API keys.
            </p>
            <div class="field-compact">
              <input v-model="signInEmail" type="email" placeholder="Email" @keyup.enter="$refs.passCard.focus()" />
            </div>
            <div class="field-compact">
              <input v-model="signInPassword" type="password" placeholder="Password" ref="passCard" @keyup.enter="signInWithEmail" />
            </div>
            <button class="btn-primary" @click="signInWithEmail" :disabled="!signInEmail.trim() || !signInPassword.trim()">
              Sign In
            </button>
            <div style="margin-top: 12px; font-size: 13px;">
              <a href="/signup" class="btn-link">Create Account</a> · <a href="/pricing" class="btn-link">View Pricing</a>
            </div>
          </div>
          
          <div v-else class="account-info">
            <p><strong>Plan:</strong> {{ (userPlan || 'Starter').toUpperCase() }}</p>
            <p v-if="userEmail"><strong>Email:</strong> {{ userEmail }}</p>

            <div v-if="userPlan === 'burst'" style="margin-top: 12px; padding: 12px; border-radius: 8px; background: rgba(229, 62, 62, 0.1); border: 1px solid rgba(229, 62, 62, 0.3);">
              <h4 style="margin: 0 0 8px 0; color: #fc8181; font-size: 14px;">Burst Relay Status</h4>
              <div v-if="relayState === 'provisioning'" style="font-size: 13px; color: #fbd38d;">
                <span style="display:inline-block; animation: pulse 1.5s infinite;">⏳</span> Provisioning your dedicated Nostr relay...
              </div>
              <div v-else-if="relayState === 'active'" style="font-size: 13px;">
                <div style="color: #68d391; margin-bottom: 6px;">✓ Active and ready</div>
                <div style="font-family: monospace; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 4px; word-break: break-all;">
                  {{ relayUrl }}
                </div>
              </div>
              <div v-else-if="relayState === 'failed'" style="font-size: 13px; color: #fc8181;">
                Failed to provision. Please contact support.
              </div>
              <div v-else style="font-size: 13px; color: var(--text-muted);">
                Initializing...
              </div>
              
              <div style="margin-top: 10px; border-top: 1px solid rgba(229, 62, 62, 0.2); padding-top: 10px; text-align: right;">
                <button class="btn-ghost btn-sm" style="color: #fc8181; font-size: 12px; padding: 4px 8px;" @click="confirmCancelBurst = true">Cancel Add-on (Prorate Refund)</button>
              </div>
            </div>

            <div v-if="confirmCancelBurst" style="margin-top: 12px; padding: 12px; border-radius: 8px; background: #fff5f5; border: 1px solid #fed7d7;">
              <h4 style="margin: 0 0 8px 0; color: #c53030; font-size: 14px;">Confirm Cancellation</h4>
              <p style="font-size: 13px; color: #742a2a; margin-bottom: 10px; line-height: 1.4;">
                This will immediately terminate your dedicated AWS relay. Any unused time will be credited to your account balance for future invoices. Your plan will reset to Starter.
              </p>
              <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button class="btn-ghost btn-sm" @click="confirmCancelBurst = false">Keep Relay</button>
                <button class="btn-primary btn-sm" style="background: #e53e3e;" @click="executeCancelBurst" :disabled="isCanceling">
                  {{ isCanceling ? 'Canceling...' : 'Confirm Cancel' }}
                </button>
              </div>
            </div>

            <button class="btn-ghost" @click="logout" style="margin-top: 12px; width: 100%; border: 1px solid #ff6b6b; color: #ff6b6b;">
              Switch Session / Logout
            </button>
          </div>
        </div>

        <!-- API Keys (Active Session) -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;">API Key</h3>
            <span v-if="isEmailAuthed && userPlan !== 'pro' && userPlan !== 'enterprise'" class="tag" style="background:#fef3c7;color:#92400e;border:none;">Starter</span>
            <span v-else-if="!isEmailAuthed" class="tag">Guest</span>
          </div>
          
          <div v-if="!isEmailAuthed" class="manual-key-entry">
            <p class="muted" style="margin-bottom: 12px;">Paste an API key below or sign in to use managed keys.</p>
            <div class="field-compact">
              <input v-model="roomId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off" />
            </div>
            <div style="font-size: 11px; margin-top: 6px;" :style="isValidated ? 'color:var(--primary-color);' : (roomId ? 'color:#ff6b6b;' : 'color:var(--text-muted);')">
              {{ keySourceHint }}
            </div>
          </div>

          <div v-else class="managed-keys">
            <div class="keys-list" v-if="apiKeys.length > 0" style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
              <div v-for="key in apiKeys" :key="key.key_id" 
                   class="key-item" 
                   :class="{ active: roomId === key.value }"
                   style="padding:10px;border:1.5px solid var(--border-color);border-radius:12px;cursor:pointer;transition:all 0.2s;"
                   @click="roomId = key.value">
                <div style="font-weight:600;font-size:14px;">{{ key.name || 'Default' }}</div>
                <code style="font-size:12px;color:var(--primary-color);">{{ (key.value || '').slice(0, 12) }}...</code>
              </div>
            </div>
            <div v-else class="empty-keys">No keys found.</div>
            
            <div v-if="userPlan === 'pro' || userPlan === 'enterprise'" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color);">
              <button class="btn-outline btn-sm" @click="createKey">+ New Key</button>
            </div>
            <div v-else style="margin-top:12px;font-size:12px;color:var(--text-muted);text-align:center;">
               <a href="/pricing" target="_blank" style="color:var(--primary-color);">Upgrade for full management</a>
            </div>
          </div>
        </div>

        <!-- Support Forum Card -->
        <div class="card" v-if="isForumVisible" style="grid-column: span 1; background: var(--card-bg);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <h3 style="margin:0;">Support Forum</h3>
              <input v-model="userAlias" placeholder="Username (optional)" style="height:24px; font-size:11px; width:120px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:0 8px;" />
            </div>
            <span class="tag" style="background:var(--primary-color);color:white;border:none;">LIVE</span>
          </div>
          <div class="forum-chat" style="height: 320px; display: flex; flex-direction: column;">
            <div class="message-feed" ref="forumFeed" style="flex: 1; overflow-y: auto; padding: 12px; background: rgba(0,0,0,0.1); border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--border-color);">
              <div v-for="msg in forumMessages" :key="msg.messageId" class="chat-msg" style="margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                  <span style="font-weight: 700; font-size: 13px; color: var(--primary-color);">{{ msg.data?.userAlias || 'Unknown' }}</span>
                  <span style="font-size: 9px; color: var(--text-muted);">{{ new Date(msg.receivedAt).toLocaleTimeString() }}</span>
                </div>
                <div style="font-size: 14px; line-height: 1.4; color: var(--text-muted);">{{ msg.data?.text }}</div>
              </div>
              <div v-if="forumMessages.length === 0" class="muted" style="text-align: center; margin-top: 60px; font-size: 13px;">
                No support messages yet.<br>Ask a question to start the thread.
              </div>
            </div>
            <div class="field-compact" style="display: flex; gap: 8px;">
              <input v-model="forumInput" placeholder="Ask for support..." @keyup.enter="sendForumMessage" style="flex: 1; height: 38px;" />
              <button class="btn-primary" @click="sendForumMessage" :disabled="!forumInput.trim()" style="height: 38px; width: auto; padding: 0 16px;">Send</button>
            </div>
          </div>
          <p class="muted" style="font-size: 11px; margin-top: 8px; text-align: center;">Messages are shared in real-time on <code>{{ FORUM_TOPIC }}</code></p>
        </div>

        <div class="card">
          <h3>Publish</h3>
          <div class="field">
            <label for="topic">Topic</label>
            <input id="topic" v-model="publishTopic" placeholder="e.g., events, data" autocomplete="off" />
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
            <span 
              class="status-pill" 
              :class="{ 'status-active': isReady, 'status-connecting': isConnecting, 'status-offline': !isReady && !isConnecting }"
            >
              Network: {{ isReady ? 'Active' : isConnecting ? 'Connecting...' : 'Offline' }}
            </span>
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

        <div class="card" v-if="isEmailAuthed">
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
                      <p style="margin: 4px 0 0 0; color: var(--muted); font-size: 11px;">Created: {{ formatDate(key.created_at) }}</p>
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
        BitFabric PubSub © 2026 · <a href="/docs.html" @click="navDisconnect($event, '/docs.html')" style="color: #667eea; text-decoration: none;">📚 Docs</a> · <a href="/pricing" @click="navDisconnect($event, '/pricing')" style="color: #667eea; text-decoration: none;">Pricing</a> · <a href="/signup" @click="navDisconnect($event, '/signup')" style="color: #667eea; text-decoration: none;">Get Started</a> · Enterprise solutions available
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { PubSubFabric } from './fabric/index.js';

// Check sessionStorage for stored API key (don't use URL for security)
const storedApiKey = sessionStorage.getItem('bitfabric-api-key');
const roomId = ref(storedApiKey || '');
const authApiKey = ref(sessionStorage.getItem('bitfabric-auth-api-key') || '');
const accountId = ref('');
const signInEmail = ref('');
const signInPassword = ref('');
// New visitors with no session are always free tier by default
const isFreeTier = ref(sessionStorage.getItem('bitfabric-free-tier') === 'true');
const freeTopic = 'bitfabric-free-tier';
const publishTopic = ref(isFreeTier.value ? freeTopic : 'events');
const subscribeTopic = ref(isFreeTier.value ? freeTopic : 'events');
const messageData = ref('{"type": "test", "value": 123}');
const messages = ref([]);
const logs = ref([]);
const subscribedTopics = ref([]);
const unsubscribeFunctions = new Map();
const userEmail = ref('');
const userPlan = ref('free');
const newKeyName = ref('');
const newKeyDescription = ref('');
const apiKeys = ref([]);
const relayState = ref('idle');
const relayUrl = ref('');
const relayPollInterval = ref(null);
const confirmCancelBurst = ref(false);
const isCanceling = ref(false);

// Validation & Forum State
const isValidated = ref(false);
const keySourceHint = ref('Free session uses shared global topic.');
const isForumVisible = ref(false);
const FORUM_ROOM = 'bitfabric-free-tier';
const FORUM_TOPIC = 'general-support';
const forumInput = ref('');
const forumFeed = ref(null);
const userAlias = ref(localStorage.getItem('bitfabric-user-alias') || '');

watch(userAlias, (val) => {
  localStorage.setItem('bitfabric-user-alias', val);
});

const forumMessages = computed(() => {
  return messages.value
    .filter(m => m.topic === FORUM_TOPIC && m.data?.text?.trim())
    .sort((a, b) => b.receivedAt - a.receivedAt);
});

const isEmailAuthed = computed(() => !!userEmail.value?.trim());
const isSessionActive = computed(() => isEmailAuthed.value || isFreeTier.value || isValidated.value);

const stats = ref({
  messagesPublished: 0,
  messagesReceived: 0,
  topics: 0,
  transport: {
    transport1: { published: 0, received: 0 },
    transport2: { published: 0, received: 0 }
  }
});

// Set initial defaults for free tier
if (isFreeTier.value && !storedApiKey) {
  publishTopic.value = freeTopic;
  subscribeTopic.value = freeTopic;
}

// Watch for auth changes to update state, but don't force topics (allow testing)
watch(isEmailAuthed, (authed) => {
  if (!authed) {
    isFreeTier.value = true;
  }
});

// Load user data from sessionStorage and fetch keys from D1
async function initializeFromStorage() {
  const storedEmail = sessionStorage.getItem('bitfabric-email');
  const storedPasswordHash = sessionStorage.getItem('bitfabric-password-hash');
  if (!storedEmail) return;
  if (!storedPasswordHash) return;

  // Always re-hydrate session from the server (D1 is source of truth)
  try {
    const authResponse = await fetch('/api/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: storedEmail, passwordHash: storedPasswordHash })
    });

    if (!authResponse.ok) return;
    const authData = await authResponse.json();
    if (!authData?.authenticated) return;

    sessionStorage.setItem('bitfabric-api-key', authData.sessionKey);
    sessionStorage.setItem('bitfabric-auth-api-key', authData.sessionKey);
    sessionStorage.setItem('bitfabric-password-hash', storedPasswordHash);
    roomId.value = authData.sessionKey || '';
    authApiKey.value = authData.sessionKey || '';
    accountId.value = authData.accountId || '';
    userEmail.value = authData.email || '';
    userPlan.value = authData.plan || 'starter';

    // Fetch API keys from D1 database
    try {
      const response = await fetch(`/api/keys?email=${encodeURIComponent(authData.email)}`, {
        headers: {
          'x-bitfabric-password-hash': storedPasswordHash
        }
      });
      if (response.ok) {
        const data = await response.json();
        apiKeys.value = data.keys || [];
      } else if (authData.defaultKey) {
        apiKeys.value = [authData.defaultKey];
      }
    } catch (error) {
      if (authData.defaultKey) apiKeys.value = [authData.defaultKey];
    }
    
    if (authData.plan === 'burst') {
       startRelayPolling(authData.email);
    }
  } catch (error) {
    // If auth fails, keep user signed out
  }
}

async function startRelayPolling(email) {
  if (relayPollInterval.value) clearInterval(relayPollInterval.value);
  
  const checkRelay = async () => {
    try {
      const resp = await fetch(`/api/get-relay?email=${encodeURIComponent(email)}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.hasRelay && data.relay) {
           relayState.value = data.relay.status;
           if (data.relay.status === 'active' && data.relay.relay_url) {
             relayUrl.value = data.relay.relay_url;
             // Stop polling once active or failed
             clearInterval(relayPollInterval.value);
             // Connect to the new relay if not already added to the fabric
             if (fabric && !nostrRelays.includes(relayUrl.value)) {
               nostrRelays.push(relayUrl.value);
               // Reconnect seamlessly with new relay list
               pushLog('Burst Relay active! Adding to peer distribution list.');
               fabric.addRelay(relayUrl.value); 
             }
           } else if (data.relay.status === 'failed') {
             clearInterval(relayPollInterval.value);
           }
        }
      }
    } catch(e) { console.error('Relay poll failed:', e); }
  };
  
  await checkRelay();
  if (relayState.value === 'provisioning') {
    relayPollInterval.value = setInterval(checkRelay, 5000); // Check every 5s while provisioning
  }
}

async function executeCancelBurst() {
  if (isCanceling.value) return;
  isCanceling.value = true;
  pushLog('Initiating Burst Relay cancellation...');
  
  try {
    const response = await fetch('/api/cancel-burst', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail.value })
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      pushLog(`Cancel failed: ${errData.error || 'Unknown error'}`);
      isCanceling.value = false;
      return;
    }
    
    pushLog('Burst Relay canceled. Account has been prorated.');
    
    // Reset local state
    confirmCancelBurst.value = false;
    userPlan.value = 'starter';
    relayState.value = 'idle';
    if (relayPollInterval.value) clearInterval(relayPollInterval.value);
    
    // Disconnect the fabric and let the user reconnect if they want without the premium relay
    await disconnect();
    
    alert('Your dedicated relay has been terminated and the plan prorated. You have been disconnected. Please reconnect manually.');
  } catch (err) {
    pushLog(`Cancel error: ${err.message}`);
  } finally {
    isCanceling.value = false;
  }
}

async function validateManualKey(key) {
  if (!key.trim()) {
    isValidated.value = false;
    keySourceHint.value = 'Free session uses shared global topic.';
    return;
  }
  
  keySourceHint.value = 'Validating key…';
  try {
    const resp = await fetch('/api/validate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key })
    });
    const data = await resp.json();
    if (data.valid) {
      isValidated.value = true;
      keySourceHint.value = '✓ Validated Key: Custom topics unlocked.';
      pushLog(`API Key Validated: ${key.slice(0, 8)}...`);
    } else {
      isValidated.value = false;
      keySourceHint.value = '⚠ Invalid Key: Restricted to free topic.';
      pushLog(`API Key Validation Failed: ${data.error || 'Unknown error'}`);
    }
  } catch (err) {
    isValidated.value = false;
    keySourceHint.value = 'Validation service unavailable.';
  }
}

let valTimeout;
watch(roomId, (newVal) => {
  if (isEmailAuthed.value) {
    isValidated.value = true;
    return;
  }
  
  clearTimeout(valTimeout);
  valTimeout = setTimeout(() => validateManualKey(newVal), 800);
});

function startFreeSession() {
  isFreeTier.value = true;
  userPlan.value = 'free';
  roomId.value = 'bitfabric-free-tier';
  publishTopic.value = freeTopic;
  subscribeTopic.value = freeTopic;
  sessionStorage.setItem('bitfabric-free-tier', 'true');
  sessionStorage.setItem('bitfabric-api-key', 'bitfabric-free-tier');
  pushLog('Started Free session (no API key required)');
  connect();
}

async function joinForum() {
  isForumVisible.value = !isForumVisible.value;
  if (!isForumVisible.value) {
    pushLog('Leaving support forum.');
    return;
  }

  pushLog('Joining P2P Support Forum...');
  
  // Use the shared free tier room for the forum
  roomId.value = FORUM_ROOM; 
  publishTopic.value = FORUM_TOPIC;
  subscribeTopic.value = FORUM_TOPIC;
  
  // Ensure we are connected - if already in free-tier room, no need to reconnect
  if (!isReady.value) {
    await connect();
  } else if (fabric && fabric.roomId !== FORUM_ROOM) {
    await connect();
  }

  // Subscribe to forum topic
  addSubscription();
  
  // Trace history from Gun
  traceForumHistory();

  // Auto-scroll to bottom after a short delay
  setTimeout(() => {
    if (forumFeed.value) forumFeed.value.scrollTop = forumFeed.value.scrollHeight;
  }, 100);
}

function traceForumHistory() {
  if (!fabric || !fabric.transport || !fabric.transport.gun) return;
  const gun = fabric.transport.gun;
  const room = gun.get(`pubsub-${FORUM_ROOM}`);

  pushLog(`Fetching Support Forum history...`);
  
  room.get('messages').map().on(async (data, id) => {
    if (!data || !data.data) return;
    try {
      const msg = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
      if (msg.topic !== FORUM_TOPIC) return;

      let payloadData = msg.data;

      // Handle encrypted messages from _encryptForTopic
      if (msg.topicEncrypted && msg.iv && msg.ciphertext) {
        try {
          payloadData = await fabric.transport._decryptForTopic(
             msg.topic, msg.iv, msg.ciphertext
          );
        } catch (err) {
          console.error('[App] Failed to decrypt history message:', err);
          return;
        }
      }

      if (!payloadData?.text?.trim()) return;

      // Check if we already have this message
      if (messages.value.some(m => m.messageId === msg.messageId)) return;

      messages.value.push({
        topic: msg.topic,
        from: msg.from,
        data: payloadData || {},
        messageId: msg.messageId,
        receivedAt: msg.timestamp || Date.now()
      });
      
      // Allow larger buffer for forum messages
      if (messages.value.length > 200) messages.value.shift();
    } catch (e) {
      console.warn('[App] Error processing history message:', e);
    }
  });
}

async function sendForumMessage() {
  if (!forumInput.value.trim() || !fabric || !isReady.value) return;

  const topic = FORUM_TOPIC;
  const displayAlias = userAlias.value.trim() || (isEmailAuthed.value 
    ? userEmail.value.split('@')[0] 
    : `Guest-${peerId.value.slice(0, 4)}`);

  const data = {
    type: 'chat',
    text: forumInput.value.trim(),
    userAlias: displayAlias
  };

  try {
    await fabric.publish(topic, data);
    pushLog(`Sent forum message: ${data.text.slice(0, 20)}...`);
    forumInput.value = '';
    
    // Auto-scroll to bottom
    setTimeout(() => {
      if (forumFeed.value) forumFeed.value.scrollTop = forumFeed.value.scrollHeight;
    }, 50);
  } catch (err) {
    pushLog(`Forum send error: ${err.message}`);
  }
}

// Helper: create key in database (using immutable account ID)
async function createKeyInDB(keyName, keyDescription) {
  try {
    const passwordHash = sessionStorage.getItem('bitfabric-password-hash') || '';
    const response = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail.value,
        passwordHash,
        keyName,
        keyDescription
      })
    });
    if (!response.ok) return false;
    const data = await response.json().catch(() => ({}));
    return data?.key || true;
  } catch (error) {
    pushLog('Error creating API key: ' + error.message);
    return false;
  }
}



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

// Handle free plan parameter
const planParam = new URLSearchParams(window.location.search).get('plan');
if (planParam === 'free') {
  isFreeTier.value = true;
  userPlan.value = 'free';
  roomId.value = 'bitfabric-free-tier';
  publishTopic.value = freeTopic;
  subscribeTopic.value = freeTopic;
  sessionStorage.setItem('bitfabric-free-tier', 'true');
  sessionStorage.setItem('bitfabric-api-key', 'bitfabric-free-tier');
  window.history.replaceState({}, '', window.location.pathname);
}

// Check for email parameter and auto-authenticate if whitelisted
const emailParam = new URLSearchParams(window.location.search).get('email');
if (emailParam) {
  (async () => {
    try {
      const storedPasswordHash = sessionStorage.getItem('bitfabric-password-hash');
      // Password is required; only auto-auth if we already have a stored hash.
      if (!storedPasswordHash) {
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }
      const authResponse = await fetch('/api/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailParam, passwordHash: storedPasswordHash })
      });
      
      if (authResponse.ok) {
        const authData = await authResponse.json();
        // Auto-authenticate whitelisted user
        sessionStorage.setItem('bitfabric-api-key', authData.sessionKey);
        sessionStorage.setItem('bitfabric-auth-api-key', authData.sessionKey);
        sessionStorage.setItem('bitfabric-email', authData.email);
        sessionStorage.setItem('bitfabric-password-hash', storedPasswordHash);
        roomId.value = authData.sessionKey || '';
    authApiKey.value = authData.sessionKey || '';
    accountId.value = authData.accountId || '';
    userEmail.value = authData.email || '';
    userPlan.value = authData.plan || 'starter';
        
        // Set default key if returned
        if (authData.defaultKey) {
          apiKeys.value = [authData.defaultKey];
        }
        
        // Clear email from URL
        window.history.replaceState({}, '', window.location.pathname);
        
        // Try to connect
        await connect();
      }
    } catch (error) {
      console.error('Error authenticating:', error);
    }
  })();
}

function pushLog(text) {
  const line = `${new Date().toLocaleTimeString()} · ${text}`;
  logs.value.unshift(line);
  if (logs.value.length > 120) logs.value.pop();
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp);
  return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
}
async function signInWithEmail() {
  const email = signInEmail.value.trim().toLowerCase();
  const password = signInPassword.value.trim();
  if (!email || !password) return;

  // SHA-256 password hash (hex)
  let passwordHash = '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    passwordHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // If hashing fails, treat as sign-in failure
    window.location.href = `/signup?email=${encodeURIComponent(email)}`;
    return;
  }

  // Server-side auth (D1 is source of truth for the API key)
  try {
    const authResponse = await fetch('/api/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, passwordHash })
    });

    if (!authResponse.ok) {
      window.location.href = `/signup?email=${encodeURIComponent(email)}`;
      return;
    }

    const authData = await authResponse.json();
    if (!authData?.authenticated) {
      window.location.href = `/signup?email=${encodeURIComponent(email)}`;
      return;
    }

    sessionStorage.setItem('bitfabric-api-key', authData.sessionKey);
    sessionStorage.setItem('bitfabric-email', authData.email);
    sessionStorage.setItem('bitfabric-password-hash', passwordHash);
    roomId.value = authData.sessionKey || '';
    sessionStorage.setItem('bitfabric-auth-api-key', authData.sessionKey);
    authApiKey.value = authData.sessionKey || '';
    accountId.value = authData.accountId || '';
    userEmail.value = authData.email || '';
    userPlan.value = authData.plan || 'starter';

    // Load keys list (DB)
    try {
      const response = await fetch(`/api/keys?email=${encodeURIComponent(authData.email)}`, {
        headers: {
          'x-bitfabric-password-hash': passwordHash
        }
      });
      if (response.ok) {
        apiKeys.value = (await response.json()).keys || [];
      } else if (authData.defaultKey) {
        apiKeys.value = [authData.defaultKey];
      }
    } catch {
      if (authData.defaultKey) apiKeys.value = [authData.defaultKey];
    }

    connect();
  } catch {
    window.location.href = `/signup?email=${encodeURIComponent(email)}`;
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
  
  // Auto-start free session if no other session is active
  if (!isSessionActive.value) {
    startFreeSession();
  }

  // Server-side validation: skip for free tier OR forum mode
  if (!isFreeTier.value && !isEmailAuthed.value && !isForumVisible.value) {
    await validateManualKey(roomId.value);
    if (!isValidated.value) {
      pushLog('Connection Restriction: Invalid key prevents connection to custom room.');
      status.value = 'error';
      return;
    }
  } else if (!isFreeTier.value && isEmailAuthed.value && !isForumVisible.value) {
    try {
      const validateResp = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail.value, apiKey: roomId.value })
      });
      if (!validateResp.ok) {
        const data = await validateResp.json().catch(() => ({}));
        pushLog(data?.error || 'Invalid API key');
        status.value = 'error';
        return;
      }
      const validateData = await validateResp.json().catch(() => ({}));
      if (!validateData?.valid) {
        pushLog(validateData?.error || 'Invalid API key');
        status.value = 'error';
        return;
      }
    } catch (e) {
      pushLog('Unable to validate API key');
      status.value = 'error';
      return;
    }
  }

  await disconnect();
  
  // Store API key in sessionStorage only (never in URL)
  sessionStorage.setItem('bitfabric-api-key', roomId.value);
  
  status.value = 'connecting';
  pushLog('Booting fabric…');

  try {
    const normalizedRoomId = roomId.value?.trim() || '';
    const effectiveRoomId = (isFreeTier.value && !normalizedRoomId) 
      ? freeTopic 
      : (normalizedRoomId || 'default');

    fabric = new PubSubFabric({
      roomId: effectiveRoomId,
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

async function navDisconnect(event, url) {
  event.preventDefault();
  await disconnect();
  window.location.href = url;
}

function publish() {
  if (!fabric || !isReady.value) return;
  let topic = publishTopic.value.trim();
  const dataStr = messageData.value.trim();
  if (!topic || !dataStr) return;

  // STRICT TOPIC ENFORCEMENT for unvalidated sessions
  if (!isEmailAuthed.value && !isValidated.value) {
    const permitted = isForumVisible.value ? FORUM_TOPIC : freeTopic;
    if (topic !== permitted) {
      pushLog(`Strict Enforcement: Mapping "${topic}" to "${permitted}" for unvalidated session.`);
      topic = permitted;
    }
  }

  try {
    const data = JSON.parse(dataStr);
    
    // Auto-subscribe to the topic if not already subscribed
    if (!subscribedTopics.value.includes(topic)) {
      const unsub = fabric.subscribe(topic, (message) => {
        pushLog(`Message received on ${topic}: ${JSON.stringify(message.data)}`);
        messages.value.unshift({
          topic: message.topic || topic,
          from: message.from || 'unknown',
          data: message.data || {},
          messageId: message.messageId || `${message.from}-${message.topic}-${Date.now()}`,
          receivedAt: message.timestamp ? new Date(message.timestamp).getTime() : Date.now()
        });
        if (messages.value.length > 50) messages.value.pop();
      });
      
      unsubscribeFunctions.set(topic, unsub);
      subscribedTopics.value.push(topic);
      pushLog(`Auto-subscribed to: ${topic}`);
    }
    
    fabric.publish(topic, data).catch(err => {
      pushLog(`Publish error: ${err.message}`);
    });
    pushLog(`Publishing to topic: ${topic}`);
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
    pushLog(`Message received on ${topic}: ${JSON.stringify(message.data)}`);
    messages.value.unshift({
      topic: message.topic || topic,
      from: message.from || 'unknown',
      data: message.data || {},
      messageId: message.messageId || `${message.from}-${message.topic}-${Date.now()}`,
      receivedAt: message.timestamp ? new Date(message.timestamp).getTime() : Date.now()
    });
    if (messages.value.length > 200) messages.value.pop();
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

  const passwordHash = sessionStorage.getItem('bitfabric-password-hash') || '';

  // Post to API (server generates key value)
  fetch('/api/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userEmail.value,
      passwordHash,
      keyName: name,
      keyDescription: description
    })
  }).then(response => {
    if (response.ok) {
      return response.json().then(data => {
        if (data?.key) {
          apiKeys.value.push(data.key);
          pushLog(`Created API key: ${name}`);
        }
        newKeyName.value = '';
        newKeyDescription.value = '';
      });
    }

    return response.json().then(err => {
      pushLog(err?.error || 'Error creating API key');
    }).catch(() => {
      pushLog('Error creating API key');
    });
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
  
  const passwordHash = sessionStorage.getItem('bitfabric-password-hash') || '';

  // Delete from API (using immutable account ID)
  fetch('/api/keys', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userEmail.value,
      passwordHash,
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
    } else {
      return response.json().then(err => {
        pushLog(err?.error || 'Error deleting API key');
      }).catch(() => {
        pushLog('Error deleting API key');
      });
    }
  }).catch(err => {
    pushLog('Error deleting API key: ' + err.message);
  });
}

function logout() {
  // Clear all sessionStorage data
  sessionStorage.removeItem('bitfabric-api-key');
  sessionStorage.removeItem('bitfabric-auth-api-key');
  sessionStorage.removeItem('bitfabric-email');
  sessionStorage.removeItem('bitfabric-password-hash');
  sessionStorage.removeItem('bitfabric-free-tier');
  
  // Clear UI
  roomId.value = '';
  authApiKey.value = '';
  userEmail.value = '';
  userPlan.value = 'free';
  isFreeTier.value = false;
  apiKeys.value = [];
  signInEmail.value = '';
  signInPassword.value = '';
  messages.value = [];
  logs.value = [];
  
  // Disconnect
  disconnect();
  
  if (relayPollInterval.value) clearInterval(relayPollInterval.value);
  relayState.value = 'idle';
  relayUrl.value = '';
  
  pushLog('Logged out');
}

onBeforeUnmount(() => {
  disconnect();
});

// Initialize on load (after all functions are defined)
initializeFromStorage();
if (isFreeTier.value && !userEmail.value) {
  connect();
}
</script>

<style scoped>
@import './styles/base.css';

.muted {
  color: var(--muted);
}

.logo-container {
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: center;
}

.main-logo {
  height: clamp(80px, 15vh, 160px);
  width: auto;
  filter: drop-shadow(0 4px 12px rgba(102, 126, 234, 0.4));
  transition: transform 0.3s ease;
}

.main-logo:hover {
  transform: scale(1.05) rotate(-2deg);
}

.signin-form-compact {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-compact input {
  width: 100%;
  padding: 10px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  color: white;
  font-size: 14px;
}

.account-info p {
  margin: 8px 0;
  font-size: 14px;
}

.signin-links-compact {
  display: flex;
  gap: 8px;
  font-size: 12px;
}
.locked-topic {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  font-family: monospace;
  font-size: 14px;
  color: #a0aec0;
}

.lock-badge {
  font-family: sans-serif;
  font-size: 11px;
  padding: 2px 6px;
  background: #2d3748;
  border-radius: 4px;
  color: #718096;
  white-space: nowrap;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.status-active {
  background: linear-gradient(135deg, var(--accent), #13b892);
  color: white;
  box-shadow: 0 4px 15px rgba(30, 210, 175, 0.2);
}

.status-connecting {
  background: rgba(255, 255, 255, 0.06);
  color: #f2a516;
  border-color: rgba(242, 165, 22, 0.3);
}

.status-offline {
  background: rgba(255, 255, 255, 0.06);
  color: var(--muted);
}
</style>
