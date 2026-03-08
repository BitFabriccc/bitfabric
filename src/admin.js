// Admin Dashboard Module
let currentUser = null;
let allAccounts = [];
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
        const passwordHash = localStorage.getItem('bitfabric-password-hash');
        
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
        const passwordHash = localStorage.getItem('bitfabric-password-hash');
        
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
        const passwordHash = localStorage.getItem('bitfabric-password-hash');
        
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
        const passwordHash = localStorage.getItem('bitfabric-password-hash');
        
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
            alert('Failed to delete key');
        }
    } catch (err) {
        console.error('Delete error:', err);
        alert('Error deleting key');
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
            alert('Failed to delete app');
        }
    } catch (err) {
        console.error('Delete error:', err);
        alert('Error deleting app');
    }
}

async function banUser(email) {
    if (!confirm(`Ban user ${email}? They will lose access immediately.`)) return;
    
    try {
        const resp = await fetch('/api/admin-users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bitfabric-password-hash': localStorage.getItem('bitfabric-password-hash')
            },
            body: JSON.stringify({
                action: 'ban',
                targetEmail: email
            })
        });
        
        if (resp.ok) {
            await loadUsers();
        } else {
            const err = await resp.json();
            alert('Failed to ban user: ' + err.error);
        }
    } catch (err) {
        console.error('Ban error:', err);
        alert('Error banning user');
    }
}

async function restoreUser(email) {
    if (!confirm(`Restore user ${email}?`)) return;
    
    try {
        const resp = await fetch('/api/admin-users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bitfabric-password-hash': localStorage.getItem('bitfabric-password-hash')
            },
            body: JSON.stringify({
                action: 'restore',
                targetEmail: email
            })
        });
        
        if (resp.ok) {
            await loadUsers();
        } else {
            const err = await resp.json();
            alert('Failed to restore user: ' + err.error);
        }
    } catch (err) {
        console.error('Restore error:', err);
        alert('Error restoring user');
    }
}

async function revokeKeys(email) {
    if (!confirm(`Revoke all API keys for ${email}?`)) return;
    
    try {
        const resp = await fetch('/api/admin-users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bitfabric-password-hash': localStorage.getItem('bitfabric-password-hash')
            },
            body: JSON.stringify({
                action: 'revoke-keys',
                targetEmail: email
            })
        });
        
        if (resp.ok) {
            const data = await resp.json();
            alert(data.message);
            await loadKeys();
            await loadUsers();
        } else {
            const err = await resp.json();
            alert('Failed to revoke keys: ' + err.error);
        }
    } catch (err) {
        console.error('Revoke error:', err);
        alert('Error revoking keys');
    }
}

// Start initialization
init();
