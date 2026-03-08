let currentUser = null;
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

function filterData(data, searchInputId, fields) {
    const searchTerm = (document.getElementById(searchInputId)?.value || '').trim().toLowerCase();
    if (!searchTerm) return data;
    return data.filter((item) => fields.some((field) => String(item[field] ?? '').toLowerCase().includes(searchTerm)));
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

function renderOverview() {
    const activeUsers = allUsers.filter((user) => !user.deleted_at).length;
    const bannedUsers = allUsers.filter((user) => !!user.deleted_at).length;

    document.getElementById('stat-users').textContent = String(allUsers.length);
    document.getElementById('stat-active-users').textContent = String(activeUsers);
    document.getElementById('stat-banned-users').textContent = String(bannedUsers);
    document.getElementById('stat-keys').textContent = String(allKeys.length);
    document.getElementById('stat-apps').textContent = String(allApps.length);

    const summary = document.getElementById('overview-summary');
    if (summary) {
        summary.innerHTML = `
            <div class="summary-grid">
                <div><strong>${activeUsers}</strong> active user${activeUsers === 1 ? '' : 's'}</div>
                <div><strong>${bannedUsers}</strong> banned account${bannedUsers === 1 ? '' : 's'}</div>
                <div><strong>${allKeys.length}</strong> active API key${allKeys.length === 1 ? '' : 's'}</div>
                <div><strong>${allApps.length}</strong> app ID${allApps.length === 1 ? '' : 's'}</div>
            </div>
        `;
    }
}

function renderUsers() {
    const tbody = document.getElementById('global-users-body');
    const users = filterData(allUsers, 'search-users', ['email', 'plan']);

    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No users match the current filter.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map((user) => `
        <tr class="${user.deleted_at ? 'row-deleted' : ''}">
            <td>
                <div class="cell-title">${escapeHtml(user.email)}</div>
                <div class="cell-subtitle">${escapeHtml(user.account_id)}</div>
            </td>
            <td>${user.deleted_at ? '<span class="pill danger">Banned</span>' : '<span class="pill success">Active</span>'}</td>
            <td><span class="pill muted">${escapeHtml((user.plan || 'free').toUpperCase())}</span></td>
            <td>${user.key_count || 0}</td>
            <td>${user.app_count || 0}</td>
            <td>${formatDate(user.created_at)}</td>
            <td class="actions-cell">
                ${user.deleted_at
                    ? `<button class="btn btn-success btn-sm" onclick="restoreUser('${escapeHtml(user.email)}')">Restore</button>`
                    : `<button class="btn btn-warning btn-sm" onclick="banUser('${escapeHtml(user.email)}')">Ban</button>`}
                <button class="btn btn-ghost btn-sm" onclick="revokeKeys('${escapeHtml(user.email)}')">Revoke keys</button>
            </td>
        </tr>
    `).join('');
}

function renderKeys() {
    const tbody = document.getElementById('global-keys-body');
    const keys = filterData(allKeys, 'search-keys', ['email', 'name', 'key_id']);

    if (!keys.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No keys match the current filter.</td></tr>';
        return;
    }

    tbody.innerHTML = keys.map((key) => `
        <tr>
            <td>
                <div class="cell-title">${escapeHtml(key.email || 'Unknown')}</div>
                <div class="cell-subtitle">${escapeHtml(key.account_id)}</div>
            </td>
            <td>${escapeHtml(key.name || key.key_id || 'Unnamed')}</td>
            <td><span class="key-mono">${escapeHtml((key.value || '').slice(0, 12))}${key.value ? '…' : ''}</span></td>
            <td>${key.permanent ? '<span class="pill muted">Permanent</span>' : '<span class="pill">Standard</span>'}</td>
            <td>${formatDate(key.created_at)}</td>
            <td class="actions-cell">
                <button class="btn btn-danger btn-sm" onclick="deleteKey('${escapeHtml(key.key_id)}','${escapeHtml(key.account_id)}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderApps() {
    const tbody = document.getElementById('global-apps-body');
    const apps = filterData(allApps, 'search-apps', ['email', 'name', 'app_id']);

    if (!apps.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No app IDs match the current filter.</td></tr>';
        return;
    }

    tbody.innerHTML = apps.map((app) => `
        <tr>
            <td>
                <div class="cell-title">${escapeHtml(app.email || 'Unknown')}</div>
                <div class="cell-subtitle">${escapeHtml(app.account_id)}</div>
            </td>
            <td>${escapeHtml(app.name || 'Unnamed')}</td>
            <td><span class="key-mono">${escapeHtml(app.app_id)}</span></td>
            <td><a href="${escapeHtml(app.app_id)}" target="_blank" rel="noreferrer">Open ↗</a></td>
            <td>${formatDate(app.created_at)}</td>
            <td class="actions-cell">
                <button class="btn btn-danger btn-sm" onclick="deleteApp('${escapeHtml(app.app_id)}','${escapeHtml(app.account_id)}')">Delete</button>
            </td>
        </tr>
    `).join('');
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
