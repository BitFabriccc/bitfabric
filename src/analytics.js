import { PubSubFabric } from './fabric/index.js';
import { Chart, registerables } from 'chart.js';

// Register Chart.js
Chart.register(...registerables);
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";

// State
let totalMessages = 0;
let totalBytes = 0;
let activeTopics = new Set();
let seenPeers = new Set();
const seenMessageIds = new Set();
let recentActivity = [];
const MAX_ACTIVITY = 10;

// Time series data (last 5 minutes)
const timeSeriesLabels = Array.from({ length: 30 }, (_, i) => {
    const secs = (30 - i) * 10;
    if (secs >= 60) return `${Math.floor(secs / 60)}m ${secs % 60}s ago`;
    return `${secs}s ago`;
}).reverse();
const pubData = new Array(30).fill(0);
const subData = new Array(30).fill(0);

// DOM Elements
const elMessages = document.getElementById('stat-messages');
const elBandwidth = document.getElementById('stat-bandwidth');
const elPeers = document.getElementById('stat-peers');
const elTopics = document.getElementById('stat-topics');
const elFeedStatus = document.getElementById('feed-status');
const elActivityBody = document.getElementById('activity-table-body');
const elDoughnutSubtext = document.getElementById('doughnut-subtext');

// Format Bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format relative time
function getRelativeTime(timestamp) {
    const diff = Date.now() - (timestamp || Date.now());
    if (diff < 5000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    return `${Math.floor(diff / 60000)}m ago`;
}

// Update DOM
function updateStatsUI() {
    elMessages.textContent = totalMessages.toLocaleString();
    elBandwidth.textContent = formatBytes(totalBytes);
    elPeers.textContent = seenPeers.size.toLocaleString();
    elTopics.textContent = activeTopics.size.toLocaleString();
}

// Render Table
function renderTable() {
    elActivityBody.innerHTML = recentActivity.map(msg => `
        <tr>
            <td><span class="badge ${msg.type === 'PUBLISH' ? 'badge-success' : 'badge-info'}">${msg.type}</span></td>
            <td><code>${msg.topic}</code></td>
            <td><span class="key-mono">${msg.from.startsWith('Global-') ? msg.from : 'Global-' + msg.from.slice(0, 4)}...</span></td>
            <td class="key-mono">${new Date(msg.timestamp).toLocaleTimeString()}</td>
            <td><span style="color:#10b981;">●</span> ${msg.type === 'PUBLISH' ? 'Delivered' : 'Received'}</td>
        </tr>
    `).join('');
}

// ------------------
// Main Line Chart
// ------------------
const ctxMain = document.getElementById('mainChart').getContext('2d');

const gradientPub = ctxMain.createLinearGradient(0, 0, 0, 400);
gradientPub.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
gradientPub.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

const gradientSub = ctxMain.createLinearGradient(0, 0, 0, 400);
gradientSub.addColorStop(0, 'rgba(236, 72, 153, 0.5)');
gradientSub.addColorStop(1, 'rgba(236, 72, 153, 0.0)');

const mainChart = new Chart(ctxMain, {
    type: 'line',
    data: {
        labels: timeSeriesLabels,
        datasets: [
            {
                label: 'Global Tier Network Traffic',
                data: pubData,
                borderColor: '#6366f1',
                backgroundColor: gradientPub,
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 6
            },
            {
                label: 'Other Topics Traffic',
                data: subData,
                borderColor: '#ec4899',
                backgroundColor: gradientSub,
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 6
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', align: 'end', labels: { boxWidth: 10, usePointStyle: true } },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(15, 17, 26, 0.9)',
                titleColor: '#fff',
                bodyColor: '#a5b4fc',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                padding: 10
            }
        },
        scales: {
            x: { grid: { display: false, drawBorder: false }, ticks: { maxTicksLimit: 7, maxRotation: 0 } },
            y: { grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, beginAtZero: true }
        },
        animation: { duration: 400 } // Enable smooth animation for historical loads
    }
});

// ------------------
// Doughnut Chart
// ------------------
const ctxDoughnut = document.getElementById('doughnutChart').getContext('2d');
const doughnutChart = new Chart(ctxDoughnut, {
    type: 'doughnut',
    data: {
        labels: [],
        datasets: [{
            data: [],
            backgroundColor: ['#6366f1', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b'],
            borderWidth: 0,
            hoverOffset: 4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
            legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, boxWidth: 10 } }
        }
    }
});

function updateDoughnut() {
    const topicsArr = Array.from(activeTopics);
    // Tally up messages per topic (just a rough estimate based on recent activity, or evenly split for now if zero)
    let topicCounts = {};
    recentActivity.forEach(msg => {
        topicCounts[msg.topic] = (topicCounts[msg.topic] || 0) + 1;
    });

    const sorted = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (sorted.length > 0) {
        doughnutChart.data.labels = sorted.map(s => s[0]);
        doughnutChart.data.datasets[0].data = sorted.map(s => s[1]);
        elDoughnutSubtext.textContent = `Tracking ${activeTopics.size} active topics in real-time`;
    } else {
        doughnutChart.data.labels = ['Waiting for traffic...'];
        doughnutChart.data.datasets[0].data = [1];
        elDoughnutSubtext.textContent = `Listening to BitFabric Global Tier...`;
    }
    doughnutChart.update();
}

// ------------------
// Networking Data Pipeline
// ------------------
let globalFabric = null;
let trafficInterval = null;
let doughnutInterval = null;

async function initNetwork(sinceTimestamp = null, untilTimestamp = null) {
    if (globalFabric) {
        try { globalFabric.disconnect?.(); } catch (e) { }
    }
    if (trafficInterval) clearInterval(trafficInterval);
    if (doughnutInterval) clearInterval(doughnutInterval);

    let statusText = sinceTimestamp ? `Querying ${new Date(sinceTimestamp).toLocaleDateString()}...` : 'Connecting...';
    elFeedStatus.textContent = statusText;
    elFeedStatus.style.color = '#f59e0b';

    const config = { roomId: 'bitfabric-global-tier' };

    // Inject custom history bounds into Nostr relay requests if requesting past data
    if (sinceTimestamp && untilTimestamp) {
        config.since = Math.floor(sinceTimestamp / 1000); // Nostr uses seconds
        config.until = Math.floor(untilTimestamp / 1000);
        recentActivity.length = 0; // flush for history playback
    }

    const fabric = new PubSubFabric(config);
    globalFabric = fabric;


    try {
        await fabric.init();
        if (!sinceTimestamp) {
            elFeedStatus.textContent = 'Live';
            elFeedStatus.style.color = '#10b981';
            mainChart.data.labels = timeSeriesLabels; // Reset to 30s labels
        } else {
            elFeedStatus.textContent = `Historical: ${new Date(sinceTimestamp).toLocaleDateString()}`;
            elFeedStatus.style.color = '#6366f1';

            // Re-scale the chart labels to represent 24 hours (30 blocks = ~48 min each)
            mainChart.data.labels = Array.from({ length: 30 }, (_, i) => {
                const step = 86400000 / 30;
                const d = new Date(sinceTimestamp + (i * step));
                return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            });
            mainChart.update();
        }

        const peerId = fabric.getPeerId() || 'Unknown';
        seenPeers.add(peerId);

        trafficInterval = setInterval(() => {
            if (!sinceTimestamp) {
                // Shift data only if we are live watching
                pubData.shift();
                pubData.push(0);
                subData.shift();
                subData.push(0);

                mainChart.update();
            }
            updateStatsUI();
            renderTable(); // Update relative timestamps
        }, 10000); // 10-second ticks for the 5-minute rolling window

        // Update relative times in the table more frequently
        setInterval(() => {
            if (!sinceTimestamp) renderTable();
        }, 1000);

        doughnutInterval = setInterval(updateDoughnut, 5000); // 5s heartbeat doughnut update

        // Intercept logs / data
        const trackMessage = (msg) => {
            // Deduplicate across relays
            const msgId = msg.messageId || `${msg.from}-${msg.topic}-${msg.timestamp}`;
            if (seenMessageIds.has(msgId)) return;
            seenMessageIds.add(msgId);

            totalMessages++;
            totalBytes += JSON.stringify(msg).length;

            if (msg.topic) activeTopics.add(msg.topic);
            if (msg.from) seenPeers.add(msg.from);

            const isGlobal = msg.topic === 'bitfabric-global-tier';

            if (!sinceTimestamp) {
                // Live mode plotting: 30 buckets covering 5 minutes (10s each)
                const ageMs = Math.max(0, Date.now() - (msg.timestamp || Date.now()));
                if (ageMs < 30 * 10000) {
                    const bucketIdx = 29 - Math.floor(ageMs / 10000);
                    if (bucketIdx >= 0 && bucketIdx <= 29) {
                        if (isGlobal) pubData[bucketIdx]++;
                        else subData[bucketIdx]++;
                        mainChart.update();
                    }
                }
            } else {
                // Bucket into the correct time slot for the historical day
                const bucketSpan = 86400000 / 30;
                const offset = msg.timestamp - sinceTimestamp;
                const bucketIdx = Math.max(0, Math.min(29, Math.floor(offset / bucketSpan)));
                if (!isNaN(bucketIdx)) {
                    if (isGlobal) pubData[bucketIdx]++;
                    else subData[bucketIdx]++;
                    mainChart.update();
                }
            }

            const msgType = msg.from === peerId ? 'PUBLISH' : 'RECEIVE';

            recentActivity.unshift({
                // Treat incoming messages from other peers as RECEIVE network traffic
                type: msgType,
                topic: msg.topic || 'Unknown',
                from: msg.from || 'System',
                timestamp: msg.timestamp || Date.now()
            });

            // Keep table sorted chronologically descending
            recentActivity.sort((a, b) => b.timestamp - a.timestamp);
            if (recentActivity.length > MAX_ACTIVITY) {
                recentActivity = recentActivity.slice(0, MAX_ACTIVITY);
            }

            renderTable();
            updateStatsUI();
        };

        // Patch publish to track stats
        const origPublish = fabric.publish.bind(fabric);
        fabric.publish = async (topic, data) => {
            totalMessages++;
            totalBytes += JSON.stringify(data).length;
            currentSecPubs++;
            activeTopics.add(topic);

            recentActivity.unshift({
                type: 'PUBLISH',
                topic: topic,
                from: peerId,
                timestamp: Date.now()
            });

            // Keep table sorted chronologically descending
            recentActivity.sort((a, b) => b.timestamp - a.timestamp);
            if (recentActivity.length > MAX_ACTIVITY) {
                recentActivity = recentActivity.slice(0, MAX_ACTIVITY);
            }

            renderTable();
            updateStatsUI();

            return origPublish(topic, data);
        };

        // Subscribe to common global topics to seed metrics
        fabric.subscribe('bitfabric-global-tier', trackMessage);
        fabric.subscribe('general-support', trackMessage);
        fabric.subscribe('events', trackMessage);

    } catch (err) {
        elFeedStatus.textContent = 'Connection Failed';
        elFeedStatus.style.color = '#f43f5e';
        console.error('Failed to initialize BitFabric Analytics:', err);
    }
}

// History Date Picker
const elHistoryDate = document.getElementById('history-date');

// Set default to today
const today = new Date();
elHistoryDate.value = today.toISOString().split('T')[0];

elHistoryDate.addEventListener('change', async (e) => {
    const selectedDateStr = e.target.value;
    if (!selectedDateStr) return;

    // Convert to Unix timestamps (start and end of the selected day in local time)
    const selectedDate = new Date(selectedDateStr);
    const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime();
    const endOfDay = startOfDay + 86400000;

    // Clear State
    totalMessages = 0;
    totalBytes = 0;
    activeTopics.clear();
    seenPeers.clear();
    seenMessageIds.clear();
    recentActivity = [];
    pubData.fill(0);
    subData.fill(0);
    mainChart.update();
    renderTable();
    updateStatsUI();

    // Restart network with historical timeframe
    await initNetwork(startOfDay, endOfDay);
});

initNetwork();
