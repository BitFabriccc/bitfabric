const authEmail = sessionStorage.getItem('bitfabric-email');
const authPasswordHash = sessionStorage.getItem('bitfabric-password-hash');
let appList = [];
let keyList = [];

// DOM Elements
const tbody = document.getElementById('keys-table-body');
const emptyState = document.getElementById('empty-state');

// App Modal
const btnCreateModal = document.getElementById('btn-create-modal');
const appModalOverlay = document.getElementById('create-app-modal');
const btnCancelApp = document.getElementById('btn-cancel-app');
const btnCreateApp = document.getElementById('btn-create-app');
const inputAppName = document.getElementById('app-name');

// Key Modal
const keyModalOverlay = document.getElementById('create-key-modal');
const btnCancelKey = document.getElementById('btn-cancel-key');
const btnCreateKey = document.getElementById('btn-create-key');
const inputKeyName = document.getElementById('key-name');
const inputKeyAppId = document.getElementById('key-app-id');

const planAlert = document.getElementById('plan-alert');

// Redirect if unauthenticated
if (!authEmail || !authPasswordHash) {
    if (planAlert) {
        planAlert.innerHTML = `
            <div class="plan-alert-content">
                <h4>Not Signed In</h4>
                <p>You must sign in to manage App IDs.</p>
            </div>
            <div><a href="/" class="btn btn-primary">Sign In</a></div>
        `;
    }
}

// Fetch Keys
async function fetchKeys() {
    if (!authEmail || !authPasswordHash) return;
    try {
        const [appRes, keyRes] = await Promise.all([
            fetch(`/api/app-ids?email=${encodeURIComponent(authEmail)}`, {
                headers: { 'x-bitfabric-password-hash': authPasswordHash }
            }),
            fetch(`/api/keys?email=${encodeURIComponent(authEmail)}`, {
                headers: { 'x-bitfabric-password-hash': authPasswordHash }
            })
        ]);

        if (!appRes.ok || !keyRes.ok) {
            console.error('Failed to fetch data');
            return;
        }

        const appData = await appRes.json();
        const keyData = await keyRes.json();

        appList = appData.appIds || [];
        keyList = keyData.keys || [];
        renderKeys();
    } catch (err) {
        console.error('API Error:', err);
    }
}

// Render Table
function renderKeys() {
    tbody.innerHTML = '';

    if (appList.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';

        appList.forEach((appData) => {
            // Render App Row
            const appTr = document.createElement('tr');
            appTr.style.background = 'rgba(255, 255, 255, 0.02)';

            appTr.innerHTML = `
                <td>
                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">${appData.name || 'Unnamed App'}</div>
                    <span class="badge badge-success">Active App ID</span>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="key-mono" style="color: #a5b4fc;">${appData.app_id}</span>
                        <button class="btn btn-ghost" onclick="window.copyKey('${appData.app_id}')" title="Copy App ID">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                    </div>
                </td>
                <td>
                    <span style="font-size: 13px; color: var(--text-muted); display:flex; align-items:center; gap: 6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        Subscribe Only
                    </span>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-ghost" onclick="window.openKeyModal('${appData.app_id}')">+ Add API Key</button>
                    <button class="btn btn-danger" onclick="window.deleteAppId('${appData.app_id}')">Revoke App</button>
                </td>
            `;
            tbody.appendChild(appTr);

            // Render Child Keys
            const appSpecificKeys = keyList.filter(k => k.app_id === appData.app_id);
            appSpecificKeys.forEach((keyData) => {
                const keyTr = document.createElement('tr');
                const isDefault = keyData.key_id === 'default';
                const maskedKey = isDefault ? (keyData.value.substring(0, 16) + '...') : (keyData.value.length > 12 ? keyData.value.substring(0, 12) + '...' + keyData.value.substring(keyData.value.length - 4) : keyData.value);

                keyTr.innerHTML = `
                    <td style="padding-left: 40px; position: relative;">
                        <div style="position: absolute; left: 20px; top: 0; bottom: 50%; width: 12px; border-left: 2px solid var(--border); border-bottom: 2px solid var(--border); border-bottom-left-radius: 6px;"></div>
                        <div style="font-weight: 500; font-size: 14px; margin-bottom: 4px; color: var(--text-muted);">${keyData.name || (isDefault ? 'Default Key' : 'Unnamed Key')}</div>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="key-mono" style="color: #ec4899; background: rgba(236, 72, 153, 0.1); border-color: rgba(236, 72, 153, 0.2);">${maskedKey}</span>
                            <button class="btn btn-ghost" onclick="window.copyKey('${keyData.value}')" title="Copy Secret API Key">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                        </div>
                    </td>
                    <td>
                        <span style="font-size: 13px; color: #ec4899; display:flex; align-items:center; gap: 6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                            Publish & Subscribe
                        </span>
                    </td>
                    <td class="actions-cell">
                        ${isDefault ?
                        `<span style="font-size: 12px; color: var(--text-muted);">Permanent Default</span>` :
                        `<button class="btn btn-ghost" style="color: var(--danger); border-color: transparent;" onclick="window.deleteApiKey('${keyData.key_id}')">Revoke Key</button>`
                    }
                    </td>
                `;
                tbody.appendChild(keyTr);
            });
        });
    }
}

// Window actions for inline onclick handlers
window.copyKey = async (key) => {
    try {
        await navigator.clipboard.writeText(key);
        alert('App ID copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy', err);
    }
};

window.deleteAppId = async (appId) => {
    if (!authEmail || !authPasswordHash) return;
    if (confirm('Are you sure you want to revoke this App ID? Any secret API keys associated with it will be orphaned or deleted.')) {
        try {
            const response = await fetch('/api/app-ids', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: authEmail, passwordHash: authPasswordHash, appId: appId })
            });
            if (response.ok) await fetchKeys();
            else alert('Failed to delete App ID: ' + (await response.json()).error);
        } catch (err) {
            console.error('Delete error', err);
        }
    }
};

window.deleteApiKey = async (keyId) => {
    if (!authEmail || !authPasswordHash) return;
    if (confirm('Are you sure you want to revoke this secret API key?')) {
        try {
            const response = await fetch('/api/keys', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: authEmail, passwordHash: authPasswordHash, keyId: keyId })
            });
            if (response.ok) await fetchKeys();
            else alert('Failed to delete API Key: ' + (await response.json()).error);
        } catch (err) {
            console.error('Delete error', err);
        }
    }
};

window.openKeyModal = (appId) => {
    inputKeyAppId.value = appId;
    inputKeyName.value = '';
    keyModalOverlay.classList.add('active');
    inputKeyName.focus();
};

// App Modal Logic
if (btnCreateModal) {
    btnCreateModal.addEventListener('click', () => {
        if (!authEmail) return window.location.href = '/';
        inputAppName.value = '';
        appModalOverlay.classList.add('active');
        inputAppName.focus();
    });
}

if (btnCancelApp) btnCancelApp.addEventListener('click', () => appModalOverlay.classList.remove('active'));
if (appModalOverlay) appModalOverlay.addEventListener('click', (e) => { if (e.target === appModalOverlay) appModalOverlay.classList.remove('active'); });

if (btnCreateApp) {
    btnCreateApp.addEventListener('click', async () => {
        const name = inputAppName.value.trim();
        if (!name) return alert('Please enter an Application Name.');

        btnCreateApp.disabled = true;
        btnCreateApp.textContent = 'Generating...';
        try {
            const res = await fetch('/api/app-ids', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: authEmail, passwordHash: authPasswordHash, appName: name })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                appModalOverlay.classList.remove('active');
                await fetchKeys();
            } else {
                alert('Failed to generate App ID: ' + (data.error || 'Limit reached.'));
            }
        } catch (err) {
            console.error(err);
        } finally {
            btnCreateApp.disabled = false;
            btnCreateApp.textContent = 'Generate App ID';
        }
    });
}

// Key Modal Logic
if (btnCancelKey) btnCancelKey.addEventListener('click', () => keyModalOverlay.classList.remove('active'));
if (keyModalOverlay) keyModalOverlay.addEventListener('click', (e) => { if (e.target === keyModalOverlay) keyModalOverlay.classList.remove('active'); });

if (btnCreateKey) {
    btnCreateKey.addEventListener('click', async () => {
        const name = inputKeyName.value.trim();
        const appId = inputKeyAppId.value;
        if (!name) return alert('Please enter a Key Name.');

        btnCreateKey.disabled = true;
        btnCreateKey.textContent = 'Generating...';
        try {
            const res = await fetch('/api/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: authEmail, passwordHash: authPasswordHash, keyName: name, keyDescription: 'Nested under App', appId: appId })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                keyModalOverlay.classList.remove('active');
                await fetchKeys();
            } else {
                alert('Failed to generate Key: ' + (data.error || 'Limit reached.'));
            }
        } catch (err) {
            console.error(err);
        } finally {
            btnCreateKey.disabled = false;
            btnCreateKey.textContent = 'Generate API Key';
        }
    });
}

// Startup
fetchKeys();
