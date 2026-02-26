const authEmail = sessionStorage.getItem('bitfabric-email');
const authPasswordHash = sessionStorage.getItem('bitfabric-password-hash');
let appList = [];
let keyList = [];

// DOM Elements
const tbody = document.getElementById('keys-table-body');
const emptyState = document.getElementById('empty-state');

// App Modal
const btnCreateModal = document.getElementById('btn-create-app-modal');
const appModalOverlay = document.getElementById('create-app-modal');
const btnCancelApp = document.getElementById('btn-cancel-app');
const btnCreateApp = document.getElementById('btn-create-app');
const inputAppName = document.getElementById('app-name');
const inputAppApiKey = document.getElementById('app-api-key');
const inputAppCapabilities = document.getElementById('app-capabilities');
const groupAppCapabilities = document.getElementById('app-cap-group');

// Key Modal
const btnCreateKeyModal = document.getElementById('btn-create-key-modal');
const keyModalOverlay = document.getElementById('create-key-modal');
const btnCancelKey = document.getElementById('btn-cancel-key');
const btnCreateKey = document.getElementById('btn-create-key');
const inputKeyName = document.getElementById('key-name');

// Link Key Modal
const linkKeyModalOverlay = document.getElementById('link-key-modal');
const btnCancelLink = document.getElementById('btn-cancel-link');
const btnSaveLink = document.getElementById('btn-save-link');
const inputLinkApiKey = document.getElementById('link-api-key');
const inputLinkAppId = document.getElementById('link-app-id');
const inputLinkCapabilities = document.getElementById('link-capabilities');
const groupLinkCapabilities = document.getElementById('link-cap-group');

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

        // Re-authenticate silently to get their latest plan to display
        fetch('/api/authenticate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: authEmail, passwordHash: authPasswordHash })
        }).then(res => res.json()).then(data => {
            if (data.authenticated && planAlert) {
                const displayPlan = (data.plan && data.plan !== 'free' && data.plan !== 'starter') ? data.plan.toUpperCase() : 'PRO';
                planAlert.innerHTML = `
                    <div class="plan-alert-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                    </div>
                    <div class="plan-alert-content" style="flex: 1;">
                        <h4>${displayPlan} Tier Active · <span style="opacity: 0.8; font-weight: normal; font-size: 12px; margin-left: 6px;">${authEmail}</span></h4>
                        <p>Your account allows unlimited App IDs to connect to the dedicated paid peer network.</p>
                    </div>
                    <div>
                        <a href="/analytics.html" class="btn btn-success">View Analytics</a>
                    </div>
                `;
            }
        }).catch(err => console.error(err));

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

        // First pass: render all explicitly unassigned (Subscribe Only) App IDs
        const unassignedApps = appList.filter(a => !a.api_key_id);
        unassignedApps.forEach(appData => {
            const appTr = document.createElement('tr');
            appTr.style.background = 'rgba(255, 255, 255, 0.02)';
            appTr.innerHTML = `
                <td>
                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">${appData.name || 'Unnamed App'}</div>
                    <span class="badge badge-info">Unassigned App ID</span>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="key-mono" style="color: #a5b4fc;">${appData.app_id}</span>
                        <button class="btn btn-ghost" onclick="window.copyKey('${appData.app_id}')" title="Copy App ID">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                    </div>
                </td>
                <td>
                    <span style="font-size: 13px; color: var(--text-muted); display:flex; align-items:center; gap: 6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        Subscribe Only
                    </span>
                </td>
                <td class="actions-cell" style="display: flex; gap: 8px; justify-content: flex-end; align-items: center; border-bottom: none; padding-top: 16px;">
                    <button class="btn btn-ghost" style="font-size: 12px; padding: 6px 10px;" onclick="window.openLinkModal('${appData.app_id}')">Link Key</button>
                    <button class="btn btn-danger" style="font-size: 12px; padding: 6px 10px; color: var(--danger); border-color: transparent;" onclick="window.deleteAppId('${appData.app_id}')">Revoke App</button>
                </td>
            `;
            tbody.appendChild(appTr);
        });

        // Second pass: render all API keys and their child App IDs
        keyList.forEach((keyData) => {
            const keyTr = document.createElement('tr');
            keyTr.style.background = 'rgba(255, 255, 255, 0.04)';
            const isDefault = keyData.key_id === 'default';
            const maskedKey = isDefault ? (keyData.value.substring(0, 16) + '...') : (keyData.value.length > 12 ? keyData.value.substring(0, 12) + '...' + keyData.value.substring(keyData.value.length - 4) : keyData.value);

            keyTr.innerHTML = `
                <td>
                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">${keyData.name || (isDefault ? 'Default Key' : 'Unnamed Key')}</div>
                    <span class="badge badge-success">Active API Key</span>
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

            // Fetch and render child App IDs that are assigned to this key
            const assignedApps = appList.filter(a => a.api_key_id === keyData.key_id);
            assignedApps.forEach(appData => {
                const appTr = document.createElement('tr');
                appTr.innerHTML = `
                    <td style="padding-left: 40px; position: relative;">
                        <div style="position: absolute; left: 20px; top: 0; bottom: 50%; width: 12px; border-left: 2px solid var(--border); border-bottom: 2px solid var(--border); border-bottom-left-radius: 6px;"></div>
                        <div style="font-weight: 500; font-size: 14px; margin-bottom: 4px; color: var(--text-muted);">${appData.name || 'Unnamed App ID'}</div>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="key-mono" style="color: #a5b4fc;">${appData.app_id}</span>
                            <button class="btn btn-ghost" onclick="window.copyKey('${appData.app_id}')" title="Copy App ID">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                        </div>
                    </td>
                    <td>
                        <select onchange="window.updateAppCapability('${appData.app_id}', this.value)" style="font-size: 13px; color: ${appData.capabilities === 'subscribe-only' ? 'var(--text-muted)' : '#ec4899'}; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 4px 8px; cursor: pointer;">
                            <option value="inherit" ${appData.capabilities !== 'subscribe-only' ? 'selected' : ''}>Inherits Publish</option>
                            <option value="subscribe-only" ${appData.capabilities === 'subscribe-only' ? 'selected' : ''}>Subscribe Only</option>
                        </select>
                    </td>
                    <td class="actions-cell" style="display: flex; gap: 8px; justify-content: flex-end; align-items: center; border-bottom: none; padding-top: 16px;">
                        <button class="btn btn-ghost" style="font-size: 12px; padding: 6px 10px;" onclick="window.unlinkAppId('${appData.app_id}')">Unlink Key</button>
                        <button class="btn btn-danger" style="color: var(--danger); border-color: transparent; font-size: 12px; padding: 6px 10px;" onclick="window.deleteAppId('${appData.app_id}')">Revoke App</button>
                    </td>
                `;
                tbody.appendChild(appTr);
            });
        });
    }
}

// Window actions for inline onclick handlers
window.copyKey = async (key) => {
    try {
        await navigator.clipboard.writeText(key);
        alert('Copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy', err);
    }
};

window.deleteAppId = async (appId) => {
    if (!authEmail || !authPasswordHash) return;
    if (confirm('Are you sure you want to revoke this App ID?')) {
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

window.updateAppCapability = async (appId, capability) => {
    if (!authEmail || !authPasswordHash) return;

    // We need the existing api_key_id to maintain the link while updating the capability
    const existingApp = appList.find(a => a.app_id === appId);
    if (!existingApp) return;

    try {
        const response = await fetch('/api/app-ids', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: authEmail,
                passwordHash: authPasswordHash,
                appId: appId,
                apiKeyId: existingApp.api_key_id,
                capabilities: capability
            })
        });
        if (response.ok) await fetchKeys();
        else alert('Failed to update capability: ' + (await response.json()).error);
    } catch (err) {
        console.error('Update error', err);
    }
};

window.deleteApiKey = async (keyId) => {
    if (!authEmail || !authPasswordHash) return;
    if (confirm('Are you sure you want to revoke this secret API key? Any child App IDs will become Subscribe-Only.')) {
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

window.openLinkModal = (appId) => {
    inputLinkAppId.value = appId;

    // find existing app to set the current capability selection
    const existingApp = appList.find(a => a.app_id === appId);
    const existingKeyId = existingApp ? existingApp.api_key_id : null;
    const existingCap = existingApp ? existingApp.capabilities : 'inherit';

    inputLinkApiKey.innerHTML = '<option value="">None (Unlink / Subscribe Only)</option>';
    keyList.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k.key_id;
        opt.textContent = k.name || (k.key_id === 'default' ? 'Default Key' : 'Unnamed Key');
        if (k.key_id === existingKeyId) opt.selected = true;
        inputLinkApiKey.appendChild(opt);
    });

    inputLinkCapabilities.value = existingCap || 'inherit';
    groupLinkCapabilities.style.display = existingKeyId ? 'block' : 'none';

    linkKeyModalOverlay.classList.add('active');
};

window.unlinkAppId = async (appId) => {
    if (!authEmail || !authPasswordHash) return;
    if (confirm('Are you sure you want to unlink this App ID? It will become Subscribe Only.')) {
        try {
            const response = await fetch('/api/app-ids', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: authEmail, passwordHash: authPasswordHash, appId: appId, apiKeyId: null })
            });
            if (response.ok) await fetchKeys();
            else alert('Failed to unlink App ID: ' + (await response.json()).error);
        } catch (err) {
            console.error('Unlink error', err);
        }
    }
};

// App Modal Logic
if (btnCreateModal) {
    btnCreateModal.addEventListener('click', () => {
        if (!authEmail) return window.location.href = '/';
        inputAppName.value = '';

        // Populate API Key Dropdown
        inputAppApiKey.innerHTML = '<option value="">None (Subscribe Only)</option>';
        keyList.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k.key_id;
            opt.textContent = k.name || (k.key_id === 'default' ? 'Default Key' : 'Unnamed Key');
            inputAppApiKey.appendChild(opt);
        });

        inputAppCapabilities.value = 'inherit';
        groupAppCapabilities.style.display = 'none';

        appModalOverlay.classList.add('active');
        inputAppName.focus();
    });
}

if (inputAppApiKey) {
    inputAppApiKey.addEventListener('change', (e) => {
        groupAppCapabilities.style.display = e.target.value ? 'block' : 'none';
        if (!e.target.value) inputAppCapabilities.value = 'inherit';
    });
}

if (btnCancelApp) btnCancelApp.addEventListener('click', () => appModalOverlay.classList.remove('active'));
if (appModalOverlay) appModalOverlay.addEventListener('click', (e) => { if (e.target === appModalOverlay) appModalOverlay.classList.remove('active'); });

if (btnCreateApp) {
    btnCreateApp.addEventListener('click', async () => {
        const name = inputAppName.value.trim();
        const apiKeyId = inputAppApiKey.value;
        const capabilities = inputAppCapabilities.value;
        if (!name) return alert('Please enter an Application Name.');

        btnCreateApp.disabled = true;
        btnCreateApp.textContent = 'Generating...';
        try {
            const res = await fetch('/api/app-ids', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: authEmail,
                    passwordHash: authPasswordHash,
                    appName: name,
                    apiKeyId: apiKeyId || null,
                    capabilities: apiKeyId ? capabilities : 'inherit'
                })
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
if (btnCreateKeyModal) {
    btnCreateKeyModal.addEventListener('click', () => {
        if (!authEmail) return window.location.href = '/';
        inputKeyName.value = '';
        keyModalOverlay.classList.add('active');
        inputKeyName.focus();
    });
}

if (btnCancelKey) btnCancelKey.addEventListener('click', () => keyModalOverlay.classList.remove('active'));
if (keyModalOverlay) keyModalOverlay.addEventListener('click', (e) => { if (e.target === keyModalOverlay) keyModalOverlay.classList.remove('active'); });

if (btnCreateKey) {
    btnCreateKey.addEventListener('click', async () => {
        const name = inputKeyName.value.trim();
        if (!name) return alert('Please enter a Key Name.');

        btnCreateKey.disabled = true;
        btnCreateKey.textContent = 'Generating...';
        try {
            const res = await fetch('/api/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: authEmail, passwordHash: authPasswordHash, keyName: name, keyDescription: '' })
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

// Link Key Modal Logic
if (btnCancelLink) btnCancelLink.addEventListener('click', () => linkKeyModalOverlay.classList.remove('active'));
if (linkKeyModalOverlay) linkKeyModalOverlay.addEventListener('click', (e) => { if (e.target === linkKeyModalOverlay) linkKeyModalOverlay.classList.remove('active'); });

if (inputLinkApiKey) {
    inputLinkApiKey.addEventListener('change', (e) => {
        groupLinkCapabilities.style.display = e.target.value ? 'block' : 'none';
        if (!e.target.value) inputLinkCapabilities.value = 'inherit';
    });
}

if (btnSaveLink) {
    btnSaveLink.addEventListener('click', async () => {
        const appId = inputLinkAppId.value;
        const apiKeyId = inputLinkApiKey.value;
        const capabilities = inputLinkCapabilities.value;
        if (!appId) return;

        btnSaveLink.disabled = true;
        btnSaveLink.textContent = 'Saving...';
        try {
            const res = await fetch('/api/app-ids', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: authEmail,
                    passwordHash: authPasswordHash,
                    appId: appId,
                    apiKeyId: apiKeyId || null,
                    capabilities: apiKeyId ? capabilities : 'inherit'
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                linkKeyModalOverlay.classList.remove('active');
                await fetchKeys();
            } else {
                alert('Failed to link App ID: ' + (data.error || 'Unknown error.'));
            }
        } catch (err) {
            console.error(err);
        } finally {
            btnSaveLink.disabled = false;
            btnSaveLink.textContent = 'Save Settings';
        }
    });
}

// Startup
fetchKeys();
