// Admin Dashboard Module
let currentUser = null;
let allAccounts = [];
let allKeys = [];
let allApps = [];

let allUsers = [];
let allKeys = [];
let allApps = [];

const superAdmins = ['draeder@gmail.com', 'danraeder@gmail.com', 'daniel@bitfabric.cc'];

function authContext() {
    return {
        email: localStorage.getItem('bitfabric-email') || sessionStorage.getItem('bitfabric-email') || '',
        passwordHash: sessionStorage.getItem('bitfabric-password-hash') || localStorage.getItem('bitfabric-password-hash') || ''
    };
}

function setActiveTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });
}

function setStatus(message = '', tone = 'info') {
    const el = document.getElementById('admin-status');
    if (!el) return;

    if (!message) {
        el.hidden = true;
        el.textContent = '';
        el.className = 'status-banner';
        return;
    }

    el.hidden = false;
    el.textContent = message;
    el.className = `status-banner ${tone}`;
}

function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

async function fetchJson(path, options = {}) {
    const { email, passwordHash } = authContext();
    if (!email || !passwordHash) {
        throw new Error('Missing admin session');
    }

    const method = options.method || 'GET';
    const headers = {
        ...(options.headers || {}),
        'x-bitfabric-password-hash': passwordHash
    };

    let url = path;
    const init = { method, headers };

    if (method === 'GET') {
        url += `${path.includes('?') ? '&' : '?'}email=${encodeURIComponent(email)}`;
    } else {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify({ adminEmail: email, email, passwordHash, ...(options.body || {}) });
    }

    const response = await fetch(url, init);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
}

async function loadUsers() {
    const data = await fetchJson('/api/admin-users');
    allUsers = data.users || [];
    renderUsers();
}

async function loadKeys() {
    const data = await fetchJson('/api/keys?scope=all');
    allKeys = data.keys || [];
    renderKeys();
}

async function loadApps() {
    const data = await fetchJson('/api/app-ids?scope=all');
    allApps = data.appIds || [];
    renderApps();
}

async function refreshDashboard() {
    setStatus('Refreshing admin data…');
    try {
        await Promise.all([loadUsers(), loadKeys(), loadApps()]);
        renderOverview();
        setStatus(`Loaded ${allUsers.length} users, ${allKeys.length} keys, and ${allApps.length} app IDs.`, 'success');
    } catch (error) {
        console.error('Dashboard refresh failed:', error);
        setStatus(error.message, 'error');
    }
}

async function runUserAction(action, targetEmail, successMessage) {
    try {
        setStatus(`${successMessage}…`);
        await fetchJson('/api/admin-users', {
            method: 'POST',
            body: { action, targetEmail }
        });
        await refreshDashboard();
        setStatus(successMessage, 'success');
    } catch (error) {
        console.error(`${action} failed:`, error);
        setStatus(error.message, 'error');
    }
}

async function banUser(email) {
    if (!confirm(`Ban ${email}? This disables access until restored.`)) return;
    await runUserAction('ban', email, `Banned ${email}`);
}

async function restoreUser(email) {
    if (!confirm(`Restore ${email}?`)) return;
    await runUserAction('restore', email, `Restored ${email}`);
}

async function revokeKeys(email) {
    if (!confirm(`Revoke all active keys for ${email}?`)) return;
    await runUserAction('revoke-keys', email, `Revoked keys for ${email}`);
}

async function deleteKey(keyId, accountId) {
    if (!confirm('Delete this key? This cannot be undone.')) return;
    try {
        setStatus('Deleting key…');
        await fetchJson('/api/keys', {
            method: 'DELETE',
            body: { keyId, accountId }
        });
        await refreshDashboard();
        setStatus('Key deleted.', 'success');
    } catch (error) {
        console.error('Delete key failed:', error);
        setStatus(error.message, 'error');
    }
}

async function deleteApp(appId, accountId) {
    if (!confirm('Delete this app ID? This cannot be undone.')) return;
    try {
        setStatus('Deleting app ID…');
        await fetchJson('/api/app-ids', {
            method: 'DELETE',
            body: { appId, accountId }
        });
        await refreshDashboard();
        setStatus('App ID deleted.', 'success');
    } catch (error) {
        console.error('Delete app failed:', error);
        setStatus(error.message, 'error');
    }
}

async function cleanupDuplicates() {
    if (!confirm('Remove duplicate default keys across all accounts?')) return;
    try {
        setStatus('Cleaning duplicate default keys…');
        const result = await fetchJson('/api/admin-cleanup-keys', { method: 'POST', body: {} });
        await refreshDashboard();
        setStatus(`Cleaned duplicate defaults for ${result.cleaned || 0} account(s).`, 'success');
    } catch (error) {
        console.error('Cleanup failed:', error);
        setStatus(error.message, 'error');
    }
}

function attachSearchHandlers() {
    ['search-users', 'search-keys', 'search-apps'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', () => {
            if (id === 'search-users') renderUsers();
            if (id === 'search-keys') renderKeys();
            if (id === 'search-apps') renderApps();
        });
    });
}

async function init() {
    const { email, passwordHash } = authContext();
    if (!email || !passwordHash) {
        window.location.href = '/';
        return;
    }

    if (!superAdmins.includes(email.toLowerCase())) {
        document.body.innerHTML = '<h1>❌ Access Denied</h1><p>Super admin access required.</p>';
        return;
    }

    currentUser = { email };
    document.getElementById('admin-email').textContent = email;

    document.querySelectorAll('.tab-btn').forEach((button) => {
        button.addEventListener('click', () => setActiveTab(button.dataset.tab));
    });
    document.getElementById('cleanup-btn')?.addEventListener('click', cleanupDuplicates);

    attachSearchHandlers();
    setActiveTab('overview');
    await refreshDashboard();
}

window.banUser = banUser;
window.restoreUser = restoreUser;
window.revokeKeys = revokeKeys;
window.deleteKey = deleteKey;
window.deleteApp = deleteApp;

init();

const superAdmins = ['draeder@gmail.com', 'danraeder@gmail.com', 'daniel@bitfabric.cc'];

function authContext() {
    return {
        email: localStorage.getItem('bitfabric-email') || sessionStorage.getItem('bitfabric-email') || '',
        passwordHash: sessionStorage.getItem('bitfabric-password-hash') || localStorage.getItem('bitfabric-password-hash') || ''
    };
}

function setActiveTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });
}

function setStatus(message = '', tone = 'info') {
    const el = document.getElementById('admin-status');
    if (!el) return;
    if (!message) {
        el.hidden = true;
        el.textContent = '';
        el.className = 'status-banner';
        return;
    }

    el.hidden = false;
    el.textContent = message;
    el.className = `status-banner ${tone}`;
}

function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

async function fetchJson(path, options = {}) {
    const { email, passwordHash } = authContext();
    if (!email || !passwordHash) {
        throw new Error('Missing admin session');
    }

    const method = options.method || 'GET';
    const headers = {
        ...(options.headers || {}),
        'x-bitfabric-password-hash': passwordHash
    };

    let url = path;
    const init = { method, headers };

    if (method === 'GET') {
        const separator = path.includes('?') ? '&' : '?';
        url = `${path}${separator}email=${encodeURIComponent(email)}`;
    } else {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify({ adminEmail: email, email, passwordHash, ...(options.body || {}) });
    }

    const response = await fetch(url, init);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
}

async function loadUsers() {
    const data = await fetchJson('/api/admin-users');
    allAccounts = data.users || [];
    renderUsers();
}

async function loadKeys() {
    const data = await fetchJson('/api/keys?scope=all');
    allKeys = data.keys || [];
    renderKeys();
}

async function loadApps() {
    const data = await fetchJson('/api/app-ids?scope=all');
    allApps = data.appIds || [];
    renderApps();
}

async function refreshDashboard() {
    setStatus('Refreshing admin data…');
    try {
        await Promise.all([loadUsers(), loadKeys(), loadApps()]);
        renderOverview();
        setStatus(`Loaded ${allAccounts.length} users, ${allKeys.length} keys, and ${allApps.length} app IDs.`, 'success');
    } catch (error) {
        console.error('Dashboard refresh failed:', error);
        setStatus(error.message, 'error');
    }
}

async function runUserAction(action, targetEmail, successMessage) {
    try {
        setStatus(`${successMessage}…`);
        await fetchJson('/api/admin-users', {
            method: 'POST',
            body: { action, targetEmail }
        });
        await refreshDashboard();
        setStatus(successMessage, 'success');
    } catch (error) {
        console.error(`${action} failed:`, error);
        setStatus(error.message, 'error');
    }
}

window.banUser = banUser;
window.restoreUser = restoreUser;
window.revokeKeys = revokeKeys;
window.deleteKey = deleteKey;
window.deleteApp = deleteApp;

init();
let allKeys = [];
let allApps = [];

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        
        // Update active button
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update active tab
        document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
        document.getElementById(`tab-${tabName}`).style.display = 'block';
        
        // Load data for tab
        if (tabName === 'users') loadUsers();
        else if (tabName === 'keys') loadKeys();
        else if (tabName === 'apps') loadApps();
    });
});

// Initialize
async function init() {
    try {
        // Check if user is authenticated from storage (localStorage for email, sessionStorage for session state)
        const email = localStorage.getItem('bitfabric-email') || sessionStorage.getItem('bitfabric-email');
        console.log('Admin init - email from storage:', email);
        
        if (!email) {
            console.log('No email in storage, redirecting to /');
            // Give browser time to log before redirect
            setTimeout(() => window.location.href = '/', 500);
            return;
        }
        
        // Check if this user is a super admin by checking the super admin list
        const superAdmins = ['draeder@gmail.com', 'danraeder@gmail.com', 'daniel@bitfabric.cc'];
        const isAdmin = superAdmins.includes(email.toLowerCase());
        console.log('Is super admin:', isAdmin);
        
        if (!isAdmin) {
            console.log('User is not a super admin');
            document.body.innerHTML = '<h1>❌ Access Denied</h1><p>Super admin access required.</p>';
            return;
        }
        
        console.log('Admin access granted for:', email);
        currentUser = { email };
        
        // Load overview
        loadOverview();
    } catch (err) {
        console.error('Init error:', err);
        setTimeout(() => window.location.href = '/', 500);
    }
}

async function loadOverview() {
    try {
        const email = localStorage.getItem('bitfabric-email');
        const passwordHash = sessionStorage.getItem('bitfabric-password-hash');
        
        if (!email || !passwordHash) {
            console.error('Missing auth credentials');
            return;
        }
        
        // Fetch all data with authentication
        const [keysResp, appsResp] = await Promise.all([
            fetch(`/api/keys?email=${encodeURIComponent(email)}&scope=all`, {
                headers: { 'x-bitfabric-password-hash': passwordHash }
            }),
            fetch(`/api/app-ids?email=${encodeURIComponent(email)}&scope=all`, {
                headers: { 'x-bitfabric-password-hash': passwordHash }
            })
        ]);
        
        if (!keysResp.ok || !appsResp.ok) {
            console.error('Keys response:', keysResp.status);
            console.error('Apps response:', appsResp.status);
            throw new Error('Failed to fetch data');
        }
        
        const keysData = await keysResp.json();
        const appsData = await appsResp.json();
        
        allKeys = keysData.keys || [];
        allApps = appsData.appIds || [];
        
        // Calculate unique accounts
        const uniqueEmails = new Set();
        allKeys.forEach(k => uniqueEmails.add(k.account_id || 'unknown'));
        allApps.forEach(a => uniqueEmails.add(a.account_id || 'unknown'));
        
        const totalUsers = uniqueEmails.size;
        const totalKeys = allKeys.length;
        const totalApps = allApps.length;
        
        // Update stat cards
        document.getElementById('stat-users').textContent = totalUsers;
        document.getElementById('stat-keys').textContent = totalKeys;
        document.getElementById('stat-apps').textContent = totalApps;
    } catch (err) {
        console.error('Overview error:', err);
    }
}

async function loadUsers() {
    try {
        const email = localStorage.getItem('bitfabric-email');
        const passwordHash = sessionStorage.getItem('bitfabric-password-hash');
        
        // Fetch keys and apps
        const [keysResp, appsResp] = await Promise.all([
            fetch(`/api/keys?email=${encodeURIComponent(email)}&scope=all`, {
                headers: { 'x-bitfabric-password-hash': passwordHash }
            }),
            fetch(`/api/app-ids?email=${encodeURIComponent(email)}&scope=all`, {
                headers: { 'x-bitfabric-password-hash': passwordHash }
            })
        ]);
        
        // Get unique users from keys and apps
        const emailStats = {};
        
        if (keysResp.ok) {
            const keysData = await keysResp.json();
            (keysData.keys || []).forEach(k => {
                if (!emailStats[k.email]) {
                    emailStats[k.email] = { 
                        email: k.email, 
                        account_id: k.account_id,
                        plan: k.plan,
                        deleted_at: k.deleted_at,
                        keys: 0, 
                        apps: 0, 
                        created: k.created_at 
                    };
                }
                emailStats[k.email].keys++;
            });
        }
        
        if (appsResp.ok) {
            const appsData = await appsResp.json();
            (appsData.appIds || []).forEach(a => {
                if (!emailStats[a.email]) {
                    emailStats[a.email] = { 
                        email: a.email,
                        account_id: a.account_id,
                        plan: a.plan,
                        deleted_at: a.deleted_at,
                        keys: 0, 
                        apps: 0, 
                        created: a.created_at 
                    };
                }
                emailStats[a.email].apps++;
            });
        }
        
        allAccounts = Object.values(emailStats);
        renderUsers();
    } catch (err) {
        console.error('Users load error:', err);
    }
}

function renderUsers() {
    const tbody = document.getElementById('global-users-body');
    tbody.innerHTML = '';
    
    const filtered = filterData(allAccounts, 'search-users', 'email');
    
    filtered.forEach(user => {
        const row = document.createElement('tr');
        const isBanned = user.deleted_at !== null && user.deleted_at !== undefined;
        const statusLabel = isBanned ? '(BANNED)' : '';
        
        row.innerHTML = `
            <td>${user.email || 'Unknown'} ${statusLabel}</td>
            <td>${(user.plan || 'free').toUpperCase()}</td>
            <td>${user.created ? new Date(user.created).toLocaleDateString() : 'N/A'}</td>
            <td style="text-align: right;">
                ${isBanned 
                    ? `<button class="btn-success btn-sm" onclick="restoreUser('${user.email}')">Restore</button>` 
                    : `<button class="btn-warning btn-sm" onclick="banUser('${user.email}')">Ban</button>`
                }
                <button class="btn-danger btn-sm" onclick="revokeKeys('${user.email}')">Revoke Keys</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function loadKeys() {
    try {
        const email = localStorage.getItem('bitfabric-email');
        const passwordHash = sessionStorage.getItem('bitfabric-password-hash');
        
        const resp = await fetch(`/api/keys?email=${encodeURIComponent(email)}&scope=all`, {
            headers: { 'x-bitfabric-password-hash': passwordHash }
        });
        if (!resp.ok) throw new Error('Failed to fetch keys');
        
        const data = await resp.json();
        allKeys = data.keys || [];
        renderKeys();
    } catch (err) {
        console.error('Keys load error:', err);
    }
}

function renderKeys() {
    const tbody = document.getElementById('global-keys-body');
    tbody.innerHTML = '';
    
    const filtered = filterData(allKeys, 'search-keys', 'email');
    
    filtered.forEach(key => {
        const masked = key.value ? key.value.substring(0, 10) + '...' : '***';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${key.email || 'Unknown'}</td>
            <td>${key.name || 'Unnamed'}</td>
            <td><code>${masked}</code></td>
            <td>${new Date(key.created_at).toLocaleDateString()}</td>
            <td style="text-align: right;">
                <button class="btn-danger btn-sm" onclick="deleteKey('${key.key_id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function loadApps() {
    try {
        const email = localStorage.getItem('bitfabric-email');
        const passwordHash = sessionStorage.getItem('bitfabric-password-hash');
        
        const resp = await fetch(`/api/app-ids?email=${encodeURIComponent(email)}&scope=all`, {
            headers: { 'x-bitfabric-password-hash': passwordHash }
        });
        if (!resp.ok) throw new Error('Failed to fetch apps');
        
        const data = await resp.json();
        allApps = data.appIds || [];
        renderApps();
    } catch (err) {
        console.error('Apps load error:', err);
    }
}

function renderApps() {
    const tbody = document.getElementById('global-apps-body');
    tbody.innerHTML = '';
    
    const filtered = filterData(allApps, 'search-apps', 'email');
    
    filtered.forEach(app => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${app.email || 'Unknown'}</td>
            <td>${app.name || 'Unnamed'}</td>
            <td><code>${app.app_id}</code></td>
            <td><a href="${app.app_id}" target="_blank">Open ↗</a></td>
            <td>${new Date(app.created_at).toLocaleDateString()}</td>
            <td style="text-align: right;">
                <button class="btn-danger btn-sm" onclick="deleteApp('${app.app_id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterData(data, searchInputId, searchField) {
    const searchTerm = document.getElementById(searchInputId)?.value.toLowerCase() || '';
    if (!searchTerm) return data;
    
    return data.filter(item => 
        String(item[searchField]).toLowerCase().includes(searchTerm)
    );
}

// Search listeners
['search-users', 'search-keys', 'search-apps'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', () => {
            const activeTab = document.querySelector('.tab-content[style*="display: block"]');
            if (activeTab?.id === 'tab-users') renderUsers();
            else if (activeTab?.id === 'tab-keys') renderKeys();
            else if (activeTab?.id === 'tab-apps') renderApps();
        });
    }
});

async function deleteKey(keyId) {
    if (!confirm('Delete this key? This action is irreversible.')) return;
    
    try {
        const resp = await fetch(`/api/keys?keyId=${keyId}`, { method: 'DELETE' });
        if (resp.ok) {
            allKeys = allKeys.filter(k => k.key_id !== keyId);
            renderKeys();
        } else {
            console.error('Failed to delete key');
        }
    } catch (err) {
        console.error('Delete error:', err);
        console.error('Error deleting key');
    }
}

async function deleteApp(appId) {
    if (!confirm('Delete this app ID? This action is irreversible.')) return;
    
    try {
        const resp = await fetch(`/api/app-ids?appId=${appId}`, { method: 'DELETE' });
        if (resp.ok) {
            allApps = allApps.filter(a => a.app_id !== appId);
            renderApps();
        } else {
            console.error('Failed to delete app');
        }
    } catch (err) {
        console.error('Delete error:', err);
        console.error('Error deleting app');
    }
}

async function banUser(email) {
    if (!confirm(`Ban user ${email}? They will lose access immediately.`)) return;
    
    try {
        const adminEmail = localStorage.getItem('bitfabric-email');
        const resp = await fetch('/api/admin-users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bitfabric-password-hash': sessionStorage.getItem('bitfabric-password-hash')
            },
            body: JSON.stringify({
                adminEmail,
                action: 'ban',
                targetEmail: email
            })
        });
        
        if (resp.ok) {
            console.log('User banned:', email);
            await loadUsers();
        } else {
            const err = await resp.json();
            console.error('Failed to ban user:', err.error);
        }
    } catch (err) {
        console.error('Ban error:', err);
    }
}

async function restoreUser(email) {
    if (!confirm(`Restore user ${email}?`)) return;
    
    try {
        const adminEmail = localStorage.getItem('bitfabric-email');
        const resp = await fetch('/api/admin-users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bitfabric-password-hash': sessionStorage.getItem('bitfabric-password-hash')
            },
            body: JSON.stringify({
                adminEmail,
                action: 'restore',
                targetEmail: email
            })
        });
        
        if (resp.ok) {
            console.log('User restored:', email);
            await loadUsers();
        } else {
            const err = await resp.json();
            console.error('Failed to restore user:', err.error);
        }
    } catch (err) {
        console.error('Restore error:', err);
    }
}

async function revokeKeys(email) {
    if (!confirm(`Revoke all API keys for ${email}?`)) return;
    
    try {
        const adminEmail = localStorage.getItem('bitfabric-email');
        const resp = await fetch('/api/admin-users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bitfabric-password-hash': sessionStorage.getItem('bitfabric-password-hash')
            },
            body: JSON.stringify({
                adminEmail,
                action: 'revoke-keys',
                targetEmail: email
            })
        });
        
        if (resp.ok) {
            const data = await resp.json();
            console.log('Keys revoked:', data.message);
            await loadKeys();
            await loadUsers();
        } else {
            const err = await resp.json();
            console.error('Failed to revoke keys:', err.error);
        }
    } catch (err) {
        console.error('Revoke error:', err);
    }
}

// Expose functions to global scope for onclick handlers
window.banUser = banUser;
window.restoreUser = restoreUser;
window.revokeKeys = revokeKeys;

// Expose functions to global scope for onclick handlers
window.banUser = banUser;
window.restoreUser = restoreUser;
window.revokeKeys = revokeKeys;
window.deleteKey = deleteKey;
window.deleteApp = deleteApp;

// Start initialization
init();
