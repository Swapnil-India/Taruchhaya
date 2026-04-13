/**
 * 🌳 Taruchhaya Inventory Management System
 * Next-Gen Business Logic (Professional Version)
 * 
 * @author Taruchhaya Enterprise
 * @version 1.0.0
 * @license MIT
 */

/* --- ⚙️ System Configuration --- */
const CONFIG = {
    DRIVE: {
        DEFAULT_CLIENT_ID: '399513000518-8b1o4jm1jsq6oppu6kae46q4trnv4u6s.apps.googleusercontent.com',
        DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
        SCOPES: 'https://www.googleapis.com/auth/drive.file'
    },
    DATABASE: {
        NAME: 'TaruchhayaDB',
        VERSION: 1,
        STORE: 'app_data'
    },
    ADMIN: {
        DEFAULT_PIN: '1234'
    }
};

/* --- 🌏 Global State --- */
let GOOGLE_CLIENT_ID = localStorage.getItem('taruchhaya_drive_client_id') || CONFIG.DRIVE.DEFAULT_CLIENT_ID;
let tokenClient;
let gapiInited = false;
let gisInited = false;
let inventory = [];
let totalRevenue = 0;
let analyticsChartObj = null;

/* --- 🛡️ Google Drive API Lifecycle --- */

window.gapiLoaded = function () {
    console.log("GAPI script loaded");
    gapi.load('client', async () => {
        try {
            await gapi.client.init({ discoveryDocs: [CONFIG.DRIVE.DISCOVERY_DOC] });
            gapiInited = true;
            console.log("GAPI Client initialized");
            if (window.checkBeforeStart) window.checkBeforeStart();
        } catch (e) {
            console.error("GAPI Init error:", e);
        }
    });
};

window.gisLoaded = function () {
    console.log("GIS script loaded");
    initTokenClient();
};

function initTokenClient() {
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: CONFIG.DRIVE.SCOPES,
            callback: '', // assigned in click handler
        });
        gisInited = true;
        console.log("GIS Token Client initialized with ID:", GOOGLE_CLIENT_ID);
        if (window.checkBeforeStart) window.checkBeforeStart();
    } catch (e) {
        console.error("GIS Init error:", e);
    }
}

window.checkBeforeStart = function () {
    if (gapiInited && gisInited) {
        console.log("Both APIs ready");

        // --- Persistent Drive Connection ---
        // If user has previously connected, silently re-acquire a token
        // (no popup — Google remembers the granted consent)
        const isPersistentlyConnected = localStorage.getItem('taruchhaya_drive_connected') === 'true';

        if (isPersistentlyConnected) {
            console.log("Persistent Drive connection found — silently re-authenticating...");
            // Check if current in-memory token is still valid first
            const savedToken = localStorage.getItem('google_drive_token');
            if (savedToken) {
                try {
                    const token = JSON.parse(savedToken);
                    if (Date.now() < token.expires_at) {
                        // Still valid — just restore it
                        gapi.client.setToken(token);
                        if (window.updateDriveUI) window.updateDriveUI(true);
                        console.log("Drive token still valid, connection restored.");
                        return;
                    }
                } catch (e) { /* fall through to silent refresh */ }
            }

            // Token expired or missing — silently get a fresh one (no consent popup)
            tokenClient.callback = (resp) => {
                if (resp.error) {
                    // Silent refresh failed (user revoked access externally)
                    console.warn("Silent Drive re-auth failed:", resp.error);
                    localStorage.removeItem('taruchhaya_drive_connected');
                    localStorage.removeItem('google_drive_token');
                    if (window.updateDriveUI) window.updateDriveUI(false);
                    return;
                }
                resp.expires_at = Date.now() + (resp.expires_in * 1000);
                localStorage.setItem('google_drive_token', JSON.stringify(resp));
                gapi.client.setToken(resp); // <--- ENSURE TOKEN IS SET IN GAPI
                if (window.updateDriveUI) window.updateDriveUI(true);
                console.log("Drive token silently refreshed.");
            };
            // prompt: '' means no account chooser / no consent screen
            tokenClient.requestAccessToken({ prompt: '' });
        }
    }
};


/**
 * Displays a non-blocking toast notification.
 * @param {string} message - Content to display.
 * @param {'success'|'error'|'warning'|'info'} type - Notification style.
 */
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ph-check-circle';
    if (type === 'error') icon = 'ph-warning-circle';
    if (type === 'warning') icon = 'ph-warning';
    if (type === 'info') icon = 'ph-info';

    toast.innerHTML = `
        <div class="toast-icon"><i class="ph-fill ${icon}"></i></div>
        <div class="toast-content">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()"><i class="ph ph-x"></i></button>
    `;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function customConfirm(title, message, onConfirm) {
    let overlay = document.getElementById('custom-confirm-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'custom-confirm-overlay';
        overlay.className = 'custom-confirm-overlay';
        overlay.innerHTML = `
            <div class="custom-confirm-card">
                <div class="confirm-icon"><i class="ph ph-warning-circle"></i></div>
                <h3 class="confirm-title" id="confirm-title">Confirm Action</h3>
                <p class="confirm-message" id="confirm-message"></p>
                <div class="confirm-actions">
                    <button class="btn-cancel" id="confirm-cancel">Cancel</button>
                    <button class="btn-confirm" id="confirm-proceed">Proceed</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    const titleEl = overlay.querySelector('#confirm-title');
    const msgEl = overlay.querySelector('#confirm-message');
    const cancelBtn = overlay.querySelector('#confirm-cancel');
    const proceedBtn = overlay.querySelector('#confirm-proceed');

    titleEl.textContent = title;
    msgEl.textContent = message;

    overlay.classList.add('show');

    const closeHandler = () => {
        overlay.classList.remove('show');
        cancelBtn.removeEventListener('click', cancelHandler);
        proceedBtn.removeEventListener('click', proceedHandler);
    };

    const cancelHandler = () => closeHandler();
    const proceedHandler = () => {
        closeHandler();
        if (onConfirm) onConfirm();
    };

    cancelBtn.addEventListener('click', cancelHandler);
    proceedBtn.addEventListener('click', proceedHandler);
}

// Override native alert/confirm for legacy calls if any remain
window.alert = (msg) => showToast(msg, 'info');

/* --- 📦 IndexedDB Resilience Layer --- */

/**
 * Initializes the IndexedDB instance.
 * @returns {Promise<IDBDatabase>}
 */
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(CONFIG.DATABASE.NAME, CONFIG.DATABASE.VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(CONFIG.DATABASE.STORE)) {
                db.createObjectStore(CONFIG.DATABASE.STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function idbGet(key) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.DATABASE.STORE, 'readonly');
        const store = tx.objectStore(CONFIG.DATABASE.STORE);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbSet(key, value) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.DATABASE.STORE, 'readwrite');
        const store = tx.objectStore(CONFIG.DATABASE.STORE);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

/* --- 🚀 Core Application Controller --- */
(function authGuard() {
    const session = sessionStorage.getItem('ti_session') || localStorage.getItem('ti_session');
    if (!session && !window.location.href.includes('login.html')) {
        window.location.replace('login.html');
    }
})();

document.addEventListener('DOMContentLoaded', () => {

    if (!sessionStorage.getItem('ti_session_start')) {
        sessionStorage.setItem('ti_session_start', Date.now().toString());
    }

    async function initializeData() {
        // Populate Client ID input in settings
        const driveClientIdInput = document.getElementById('driveClientIdInput');
        if (driveClientIdInput) driveClientIdInput.value = GOOGLE_CLIENT_ID;

        try {
            const idbInv = await idbGet('taruchhaya_inventory');
            const idbRev = await idbGet('taruchhaya_revenue');

            if (idbInv && Array.isArray(idbInv)) {
                inventory = idbInv;
                totalRevenue = idbRev || 0;
            } else {
                // Fallback / Migrate from LocalStorage to IndexedDB
                inventory = JSON.parse(localStorage.getItem('taruchhaya_inventory')) || [];
                totalRevenue = parseFloat(localStorage.getItem('taruchhaya_revenue')) || 0;

                await idbSet('taruchhaya_inventory', inventory);
                await idbSet('taruchhaya_revenue', totalRevenue);
            }
        } catch (err) {
            console.error("IndexedDB Initialization Error:", err);
            inventory = JSON.parse(localStorage.getItem('taruchhaya_inventory')) || [];
            totalRevenue = parseFloat(localStorage.getItem('taruchhaya_revenue')) || 0;
        }

        updateDashboard();
        renderInventoryTable();
        populatePosSelect();
        scheduleDriveAutoSync();
    }

    initializeData();

    function saveInventory() {
        localStorage.setItem('taruchhaya_inventory', JSON.stringify(inventory));
        idbSet('taruchhaya_inventory', inventory).catch(err => console.error("IDB Save Error", err));
        updateDashboard();
        renderInventoryTable();
        populatePosSelect();
        scheduleDriveAutoSync();
    }

    function saveRevenue(amount) {
        totalRevenue += amount;
        localStorage.setItem('taruchhaya_revenue', totalRevenue);
        idbSet('taruchhaya_revenue', totalRevenue).catch(err => console.error("IDB Save Error", err));
        updateDashboard();
        scheduleDriveAutoSync();
    }

    // --- Navigation & Views ---
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-container');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const viewName = item.getAttribute('data-view');

            if (viewName === 'assistant') {
                e.preventDefault();
                toggleAiChat();
                return;
            }

            if (viewName) {
                e.preventDefault();
                // Update Nav
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');

                // Update View
                views.forEach(v => v.classList.remove('active'));
                const targetView = document.getElementById(`view-${viewName}`);
                if (targetView) targetView.classList.add('active');
            }
        });
    });

    // --- Theme Toggle ---
    const themeBtn = document.querySelector('.theme-toggle');
    themeBtn.addEventListener('click', () => {
        const html = document.documentElement;
        if (html.getAttribute('data-theme') === 'dark') {
            html.setAttribute('data-theme', 'light');
            themeBtn.innerHTML = '<i class="ph ph-sun"></i>';
        } else {
            html.setAttribute('data-theme', 'dark');
            themeBtn.innerHTML = '<i class="ph ph-moon"></i>';
        }
    });

    // --- Report Generation Logic ---
    async function generateAndUploadReport(silent = false) {
        if (typeof gapi === 'undefined' || !gapi.client) {
            showToast('Google Drive API not ready. Please refresh.', 'error');
            return;
        }

        // --- PRE-UPLOAD TOKEN VALIDATION/REFRESH ---
        const savedToken = localStorage.getItem('google_drive_token');
        if (savedToken) {
            try {
                const token = JSON.parse(savedToken);
                if (Date.now() >= token.expires_at) {
                    if (!silent) showToast('Session expired. Refreshing Drive connection...', 'info');
                    await new Promise((resolve, reject) => {
                        tokenClient.callback = (resp) => {
                            if (resp.error) {
                                localStorage.removeItem('taruchhaya_drive_connected');
                                reject(resp);
                            } else {
                                resp.expires_at = Date.now() + (resp.expires_in * 1000);
                                localStorage.setItem('google_drive_token', JSON.stringify(resp));
                                gapi.client.setToken(resp);
                                resolve();
                            }
                        };
                        tokenClient.requestAccessToken({ prompt: '' });
                    });
                } else {
                    gapi.client.setToken(token);
                }
            } catch (e) {
                showToast('Please connect Google Drive in Settings!', 'warning');
                return;
            }
        }

        if (gapi.client.getToken() === null) {
            showToast('Please connect Google Drive in Settings first!', 'warning');
            return;
        }

        if (!silent) showToast('Generating business report and uploading to Drive...', 'info');

        try {
            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const yyyy = now.getFullYear();
            const HH = String(now.getHours()).padStart(2, '0');
            const MM = String(now.getMinutes()).padStart(2, '0');
            const SS = String(now.getSeconds()).padStart(2, '0');
            const reportFileName = `Taruchhaya_Report_${dd}-${mm}-${yyyy}_${HH}h${MM}m${SS}s.txt`;

            // Session Tracking
            const sessionStartMs = parseInt(sessionStorage.getItem('ti_session_start')) || now.getTime();
            const durationMs = now.getTime() - sessionStartMs;
            const diffHours = Math.floor(durationMs / 3600000);
            const diffMins = Math.floor((durationMs % 3600000) / 60000);
            const durationStr = `${diffHours} hrs ${diffMins} mins`;

            const txCount = parseInt(sessionStorage.getItem('ti_tx_count') || '0');
            const poCount = parseInt(sessionStorage.getItem('ti_po_count') || '0');
            const poValue = parseFloat(sessionStorage.getItem('ti_po_value') || '0');

            let totalItemsSold = 0;
            inventory.forEach(i => totalItemsSold += (i.sessionSold || 0));

            const topSellers = [...inventory]
                .filter(i => (i.sessionSold || 0) > 0)
                .sort((a, b) => b.sessionSold - a.sessionSold)
                .slice(0, 5);

            let r = `Daily Business Performance Report\n\n`;
            r += `Date: ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\n`;
            r += `Business: Taruchhaya Enterprise\n`;
            r += `Generated At: ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}\n\n`;

            r += `🧾 Sales Summary\n`;
            r += `Total Transactions: ${txCount}\n`;
            r += `Total Items Sold: ${totalItemsSold}\n`;
            r += `Total Revenue: ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n`;

            r += `📦 Inventory Movement\n`;
            const nameWidth = 24, numWidth = 14;
            r += `${'Item Name'.padEnd(nameWidth)}\t${'Opening'.padEnd(numWidth)}\t${'Purchased'.padEnd(numWidth)}\t${'Sold'.padEnd(numWidth)}\tClosing\n`;

            inventory.forEach(item => {
                const sold = item.sessionSold || 0;
                const purchased = item.sessionPurchased || 0;
                const closing = item.stock;
                const opening = closing + sold - purchased;

                const name = item.name.substring(0, nameWidth - 2).padEnd(nameWidth);
                r += `${name}\t${String(opening).padEnd(numWidth)}\t${String(purchased).padEnd(numWidth)}\t${String(sold).padEnd(numWidth)}\t${closing}\n`;
            });
            r += `\n`;

            r += `🔄 Purchase Order Analytics\n`;
            r += `Total POs Issued: ${poCount}\n`;
            r += `Total PO Value: ₹${poValue.toLocaleString('en-IN')}\n\n`;

            r += `📈 Best Selling Categories\n`;
            if (topSellers.length > 0) {
                topSellers.forEach(item => r += `${item.name} → ${item.sessionSold} units\n`);
            } else {
                r += `   No sales recorded this session.\n`;
            }
            r += `\n`;

            const restocked = inventory.filter(i => i.restockCount > 0);
            if (restocked.length > 0) {
                r += `📋 Operational Log (Restocks)\n`;
                restocked.forEach(item => {
                    const t = new Date(item.lastRestockTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                    r += `${item.name} (${item.restockCount} times) @ ${t}\n`;
                });
                r += `\n`;
            }

            r += `🔐 Session Metadata\n`;
            r += `Duration: ${durationStr}\n`;
            r += `Status: Verified\n\n`;
            r += `✅ End of Generated Report\n`;

            // -- Upload to Drive --
            const boundary = '-------taruchhayareport2026';
            const delimiter = `--${boundary}\r\n`; // Modified: removed leading \r\n for first part
            const close_delim = `\r\n--${boundary}--`;
            const metadata = { name: reportFileName, mimeType: 'text/plain' };

            const multipartBody =
                delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
                '\r\n' + delimiter + 'Content-Type: text/plain; charset=utf-8\r\n\r\n' + r +
                close_delim;

            const response = await gapi.client.request({
                path: '/upload/drive/v3/files',
                method: 'POST',
                params: { uploadType: 'multipart' },
                headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
                body: multipartBody
            });

            if (response.status >= 200 && response.status < 300) {
                if (!silent) showToast('✅ Report successfully uploaded to Google Drive!', 'success');
                return true;
            } else {
                throw new Error(`Cloud error: ${response.status}`);
            }
        } catch (err) {
            console.error('Report upload failed:', err);
            if (!silent) showToast('Failed to upload report to Drive.', 'error');
            return false;
        }
    }

    // --- Logout & Report Buttons ---
    const reportBtn = document.getElementById('reportBtn');
    const headerReportBtn = document.getElementById('headerReportBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');

    if (reportBtn) reportBtn.addEventListener('click', (e) => { e.preventDefault(); generateAndUploadReport(); });
    if (headerReportBtn) headerReportBtn.addEventListener('click', (e) => { e.preventDefault(); generateAndUploadReport(); });

    async function processLogout(e) {
        e.preventDefault();

        customConfirm('Logout Confirmation', 'Are you sure you want to end your session? Your local data will be cleared for security.', () => {
            // Wipe local session + data — next login starts completely fresh
            sessionStorage.removeItem('ti_session');
            localStorage.removeItem('ti_session');
            localStorage.removeItem('taruchhaya_inventory');
            localStorage.removeItem('taruchhaya_revenue');
            window.location.href = 'login.html';
        });
    }

    if (logoutBtn) logoutBtn.addEventListener('click', processLogout);
    if (headerLogoutBtn) headerLogoutBtn.addEventListener('click', processLogout);


    // --- Dashboard Logic ---
    function updateDashboard() {
        // Calculate total inventory value
        const invValue = inventory.reduce((sum, item) => sum + (item.price * item.stock), 0);
        const invValueEl = document.getElementById('dashboardInvValue');
        if (invValueEl) invValueEl.textContent = `₹${invValue.toLocaleString()}`;

        // Calculate low stock items (threshold < 5)
        const lowStockItems = inventory.filter(item => item.stock < 5);
        const lowStockContainer = document.getElementById('dashboardLowStock');
        if (lowStockContainer) {
            if (lowStockItems.length > 0) {
                const names = lowStockItems.map(item => item.name).join(', ');
                lowStockContainer.innerHTML = `<span style="font-size: 16px; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3;">${names}</span>`;
            } else {
                lowStockContainer.innerHTML = `<span style="font-size: 16px; font-weight: 500; color: var(--text-secondary);">None</span>`;
            }
        }

        // Update Total Products count
        const totalProdsEl = document.getElementById('dashboardTotalProds');
        if (totalProdsEl) totalProdsEl.textContent = inventory.length;

        // Update Revenue
        const revenueEl = document.getElementById('dashboardRevenue');
        if (revenueEl) revenueEl.textContent = `₹${totalRevenue.toLocaleString()}`;

        renderAnalytics();
    }

    // --- Analytics Rendering ---
    let analyticsChartObj = null;
    function renderAnalytics() {
        const canvas = document.getElementById('analyticsChart');
        if (!canvas) return;

        const catMap = {};
        inventory.forEach(i => {
            if (!catMap[i.category]) catMap[i.category] = 0;
            catMap[i.category] += (i.stock * i.price);
        });

        const labels = Object.keys(catMap);
        const data = Object.values(catMap);

        if (analyticsChartObj) analyticsChartObj.destroy();

        analyticsChartObj = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels.length ? labels : ['No Data'],
                datasets: [{
                    data: data.length ? data : [1],
                    backgroundColor: ['#6366f1', '#8b5cf6', '#d946ef', '#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#f4f4f5', font: { family: 'Inter' } }
                    }
                }
            }
        });
    }

    // --- Mobile Settings ---
    const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    if (mobileSidebarToggle && sidebar) {
        mobileSidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !mobileSidebarToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }

    // --- Inventory Table Logic ---
    const globalSearch = document.getElementById('globalSearch');
    const inventoryList = document.getElementById('inventoryList');

    function renderInventoryTable(filterText = '') {
        inventoryList.innerHTML = '';

        const filtered = inventory.filter(item => item.name.toLowerCase().includes(filterText.toLowerCase()));

        filtered.forEach(item => {
            const tr = document.createElement('tr');

            let statusHtml = '';
            if (item.stock < 5) {
                statusHtml = `<span class="status-badge low">Low Stock</span>`;
            } else {
                statusHtml = `<span class="status-badge ok">Healthy</span>`;
            }

            tr.innerHTML = `
                <td><strong>${item.name}</strong></td>
                <td>${item.category}</td>
                <td>₹${item.price}</td>
                <td>${item.stock} units</td>
                <td>${statusHtml}</td>
                <td>
                    <button class="secondary-btn" style="padding: 4px 8px; font-size: 11px; margin-right: 4px; background: rgba(16, 185, 129, 0.1); color: var(--accent-success); border-color: rgba(16, 185, 129, 0.3);" onclick="openRestockModal('${item.id}')">Restock</button>
                    <button class="secondary-btn" style="padding: 4px 8px; font-size: 11px; margin-right: 4px;" onclick="editProduct('${item.id}')">Edit</button>
                    <button class="secondary-btn" style="padding: 4px 8px; font-size: 11px;" onclick="deleteProduct('${item.id}')">Delete</button>
                </td>
            `;
            inventoryList.appendChild(tr);
        });
    }

    globalSearch.addEventListener('input', (e) => {
        renderInventoryTable(e.target.value);
    });

    // Make delete and edit globally accessible for inline onclick
    window.deleteProduct = function (id) {
        customConfirm('Delete Product?', 'Are you sure you want to remove this product from your inventory?', () => {
            inventory = inventory.filter(item => item.id !== id);
            saveInventory();
            showToast('Product deleted successfully', 'success');
        });
    };

    window.editProduct = function (id) {
        const item = inventory.find(p => p.id === id);
        if (!item) return;

        document.getElementById('editProdId').value = item.id;
        document.getElementById('editProdName').value = item.name;
        document.getElementById('editProdBarcode').value = item.barcode || '';
        document.getElementById('editProdCategory').value = item.category;
        document.getElementById('editProdPrice').value = item.price;
        document.getElementById('editProdStock').value = item.stock;

        const editModal = document.getElementById('editProductModal');
        editModal.classList.add('open');
    };

    window.openRestockModal = function (id) {
        const item = inventory.find(p => p.id === id);
        if (!item) return;

        document.getElementById('restockProdId').value = item.id;
        document.getElementById('restockItemName').textContent = item.name;
        document.getElementById('restockQtyAdd').value = '';

        const restockModal = document.getElementById('restockProductModal');
        if (restockModal) restockModal.classList.add('open');
    };

    const restockProductForm = document.getElementById('restockProductForm');
    if (restockProductForm) {
        restockProductForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('restockProdId').value;
            const item = inventory.find(p => p.id === id);
            const qtyToAdd = parseInt(document.getElementById('restockQtyAdd').value) || 0;

            if (item && qtyToAdd > 0) {
                item.stock += qtyToAdd;

                // Track restock history and session analytics
                if (!item.restockCount) item.restockCount = 0;
                item.restockCount += 1;
                item.lastRestockTime = new Date().toISOString();

                item.sessionPurchased = (item.sessionPurchased || 0) + qtyToAdd;
                const poCount = parseInt(sessionStorage.getItem('ti_po_count') || '0');
                sessionStorage.setItem('ti_po_count', (poCount + 1).toString());
                const poValue = parseFloat(sessionStorage.getItem('ti_po_value') || '0');
                sessionStorage.setItem('ti_po_value', (poValue + (qtyToAdd * item.price)).toString());

                saveInventory();
                closeModal(document.getElementById('restockProductModal'));
                showToast(`Restocked ${qtyToAdd} units of ${item.name}`, 'success');
            }
        });
    }

    // --- Add Product Modal Logic ---
    const addProductBtn = document.getElementById('openAddProductModal');
    const productModal = document.getElementById('productModal');
    const productForm = document.getElementById('productForm');

    function openModal(modal) { modal.classList.add('open'); }
    function closeModal(modal) { modal.classList.remove('open'); }

    addProductBtn.addEventListener('click', () => openModal(productModal));

    // Close modal handling for all modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            closeModal(e.target.closest('.modal-overlay'));
        });
    });

    // --- Clear All Data Logic ---
    const clearAllDataBtn = document.getElementById('clearAllDataBtn');
    const clearDataConfirmModal = document.getElementById('clearDataConfirmModal');
    const confirmClearDataBtn = document.getElementById('confirmClearDataBtn');

    if (clearAllDataBtn && clearDataConfirmModal && confirmClearDataBtn) {
        clearAllDataBtn.addEventListener('click', () => {
            openModal(clearDataConfirmModal);
        });

        // Also wire up the settings clear button
        const settingsClearDataBtn = document.getElementById('settingsClearDataBtn');
        if (settingsClearDataBtn) {
            settingsClearDataBtn.addEventListener('click', () => {
                openModal(clearDataConfirmModal);
            });
        }

        confirmClearDataBtn.addEventListener('click', () => {
            const pinInput = document.getElementById('adminPinInput');
            const pinError = document.getElementById('pinError');

            // Set the Admin PIN here
            if (pinInput.value === CONFIG.ADMIN.DEFAULT_PIN) {
                inventory = [];
                totalRevenue = 0;
                localStorage.removeItem('taruchhaya_inventory');
                localStorage.removeItem('taruchhaya_revenue');
                saveInventory();
                saveRevenue(0);

                pinInput.value = '';
                pinError.style.display = 'none';
                closeModal(clearDataConfirmModal);

                showToast("System has been factory reset. All data cleared.", "success");
            } else {
                pinError.style.display = 'block';
            }
        });
    }

    // --- Export / Import (Data Portability) Logic ---
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importDataInput = document.getElementById('importDataInput');

    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', () => {
            const data = {
                inventory: inventory,
                totalRevenue: totalRevenue,
                exportDate: new Date().toISOString(),
                app: "Taruchhaya Inventory"
            };

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `taruchhaya_backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });
    }

    if (importDataInput) {
        importDataInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (event) {
                try {
                    const importedData = JSON.parse(event.target.result);

                    if (importedData.app !== "Taruchhaya Inventory" || !Array.isArray(importedData.inventory)) {
                        throw new Error("Invalid backup file format.");
                    }

                    customConfirm('Restore Data?', `This will REPLACE your current data with ${importedData.inventory.length} items from the backup. Are you sure?`, () => {
                        inventory = importedData.inventory;
                        totalRevenue = importedData.totalRevenue || 0;

                        saveInventory();
                        localStorage.setItem('taruchhaya_revenue', totalRevenue);
                        updateDashboard();

                        showToast("Data restored successfully!", "success");
                        // Move to dashboard to show results
                        document.querySelector('[data-view="dashboard"]').click();
                    });
                } catch (err) {
                    console.error("Import error:", err);
                    showToast("Import failed: Please ensure you are uploading a valid Taruchhaya backup file.", "error");
                }
                importDataInput.value = ''; // Reset for next time
            };
            reader.readAsText(file);
        });
    }

    productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newProduct = {
            id: 'p' + Date.now(),
            name: document.getElementById('prodName').value,
            barcode: document.getElementById('prodBarcode').value.trim(),
            category: document.getElementById('prodCategory').value,
            price: parseFloat(document.getElementById('prodPrice').value),
            stock: parseInt(document.getElementById('prodStock').value)
        };

        inventory.push(newProduct);
        saveInventory();
        productForm.reset();
        closeModal(productModal);
    });

    const editProductForm = document.getElementById('editProductForm');
    if (editProductForm) {
        editProductForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('editProdId').value;
            const item = inventory.find(p => p.id === id);
            if (item) {
                item.name = document.getElementById('editProdName').value;
                item.barcode = document.getElementById('editProdBarcode').value.trim();
                item.category = document.getElementById('editProdCategory').value;
                item.price = parseFloat(document.getElementById('editProdPrice').value);
                item.stock = parseInt(document.getElementById('editProdStock').value);
                saveInventory();
                closeModal(document.getElementById('editProductModal'));
            }
        });
    }

    // --- Quick Bill (POS) Logic ---
    const posBtn = document.getElementById('sidebarPosBtn');
    const posModal = document.getElementById('posModal');
    const posProductSelect = document.getElementById('posProductSelect');
    const posItemList = document.getElementById('posItemList');
    const posTotalAmt = document.getElementById('posTotalAmt');
    const posAddItemBtn = document.getElementById('posAddItemBtn');
    const posCheckoutBtn = document.getElementById('posCheckoutBtn');

    let currentCart = [];

    posBtn.addEventListener('click', () => {
        currentCart = [];
        renderCart();
        openModal(posModal);
        setTimeout(() => {
            const barcodeInput = document.getElementById('posBarcodeInput');
            if (barcodeInput) barcodeInput.focus();
        }, 100);
    });

    function populatePosSelect() {
        posProductSelect.innerHTML = '';
        inventory.forEach(item => {
            if (item.stock > 0) {
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.textContent = `${item.name} (Stock: ${item.stock}) - ₹${item.price}`;
                posProductSelect.appendChild(opt);
            }
        });
    }

    posAddItemBtn.addEventListener('click', () => {
        const prodId = posProductSelect.value;
        if (!prodId) return;

        const product = inventory.find(p => p.id === prodId);
        if (!product) return;

        addProductToCart(product);
    });

    const posBarcodeInput = document.getElementById('posBarcodeInput');
    if (posBarcodeInput) {
        posBarcodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const code = posBarcodeInput.value.trim();
                if (!code) return;

                const product = inventory.find(p => p.barcode === code || p.id === code);

                if (product) {
                    if (product.stock > 0) {
                        addProductToCart(product);
                        posBarcodeInput.value = ''; // clear for next scan
                    } else {
                        showToast("Product is out of stock!", "error");
                    }
                } else {
                    showToast("Barcode not found in inventory!", "warning");
                }
            }
        });
    }

    function addProductToCart(product) {
        const existingCartItem = currentCart.find(c => c.product.id === product.id);

        if (existingCartItem) {
            if (existingCartItem.qty < product.stock) {
                existingCartItem.qty += 1;
            } else {
                showToast("Cannot add more than available stock!", "warning");
            }
        } else {
            currentCart.push({ product: product, qty: 1 });
        }
        renderCart();
    }

    function renderCart() {
        posItemList.innerHTML = '';
        let total = 0;

        currentCart.forEach((item, index) => {
            const subtotal = item.qty * item.product.price;
            total += subtotal;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.product.name}</td>
                <td>
                    <button class="secondary-btn" style="padding: 2px 6px; font-size: 10px;" onclick="updateCartQty(${index}, -1)">-</button>
                    ${item.qty}
                    <button class="secondary-btn" style="padding: 2px 6px; font-size: 10px;" onclick="updateCartQty(${index}, 1)">+</button>
                </td>
                <td>₹${subtotal}</td>
                <td><button style="color:var(--accent-danger); background:none; border:none; cursor:pointer;" onclick="removeCartItem(${index})"><i class="ph ph-trash"></i></button></td>
            `;
            posItemList.appendChild(tr);
        });

        posTotalAmt.textContent = total.toLocaleString();
    }

    window.updateCartQty = function (index, delta) {
        const item = currentCart[index];
        const newQty = item.qty + delta;
        if (newQty > 0 && newQty <= item.product.stock) {
            item.qty = newQty;
            renderCart();
        } else if (newQty > item.product.stock) {
            showToast("Exceeds available stock!", "warning");
        }
    };

    window.removeCartItem = function (index) {
        currentCart.splice(index, 1);
        renderCart();
    };

    const posPrintBtn = document.getElementById('posPrintBtn');
    if (posPrintBtn) {
        posPrintBtn.addEventListener('click', () => {
            if (currentCart.length === 0) {
                showToast("Cart is empty!", "info");
                return;
            }
            const printArea = document.getElementById('printReceiptArea');
            let total = 0;

            let html = `
                <div style="padding: 40px; font-family: 'Inter', sans-serif; max-width: 400px; margin: 0 auto; color: black !important;">
                    <h2 style="text-align: center; margin-bottom: 24px; font-weight: 700;">Taruchhaya Store</h2>
                    <p style="text-align: center; font-size: 12px; margin-bottom: 24px;">Date: ${new Date().toLocaleString()}</p>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                        <tr style="border-bottom: 1px solid #ccc;">
                            <th style="text-align: left; padding: 8px 0;">Item</th>
                            <th style="text-align: center; padding: 8px 0;">Qty</th>
                            <th style="text-align: right; padding: 8px 0;">Amt</th>
                        </tr>
            `;

            currentCart.forEach(item => {
                const sub = item.qty * item.product.price;
                total += sub;
                html += `
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px dashed #eee;">${item.product.name}</td>
                            <td style="text-align: center; padding: 8px 0; border-bottom: 1px dashed #eee;">${item.qty}</td>
                            <td style="text-align: right; padding: 8px 0; border-bottom: 1px dashed #eee;">₹${sub.toLocaleString()}</td>
                        </tr>
                `;
            });

            html += `
                    </table>
                    <h3 style="text-align: right; font-weight: 700;">Total: ₹${total.toLocaleString()}</h3>
                    <p style="text-align: center; margin-top: 40px; font-size: 12px;">Thank you for shopping!</p>
                </div>
            `;

            printArea.innerHTML = html;
            window.print();
        });
    }

    posCheckoutBtn.addEventListener('click', () => {
        if (currentCart.length === 0) {
            showToast("Cart is empty!", "info");
            return;
        }

        // Process checkout
        let currentTotal = 0;
        currentCart.forEach(cartItem => {
            // Deduct stock and track session sales
            const invItem = inventory.find(p => p.id === cartItem.product.id);
            if (invItem) {
                invItem.stock -= cartItem.qty;
                invItem.sessionSold = (invItem.sessionSold || 0) + cartItem.qty;
            }
            currentTotal += (cartItem.qty * cartItem.product.price);
        });

        const txCount = parseInt(sessionStorage.getItem('ti_tx_count') || '0');
        sessionStorage.setItem('ti_tx_count', (txCount + 1).toString());

        saveRevenue(currentTotal);
        saveInventory();

        currentCart = [];
        renderCart();
        closeModal(posModal);

        showToast(`Bill generated successfully for ₹${currentTotal}! Stock has been updated.`, "success");
    });


    // --- AI Chat Assistant Logic ---
    const chatFab = document.getElementById('openChatFab');
    const chatWindow = document.getElementById('aiChatWindow');
    const closeChatBtn = document.querySelector('.close-chat-btn');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.querySelector('.chat-send-btn');
    const chatMessages = document.getElementById('chatMessages');

    function toggleAiChat() {
        chatWindow.classList.toggle('open');
        if (chatWindow.classList.contains('open')) {
            chatInput.focus();
        }
    }

    chatFab.addEventListener('click', toggleAiChat);
    closeChatBtn.addEventListener('click', toggleAiChat);

    function addMessage(text, isUser = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
        let avatarHTML = isUser ? '' : `<div class="msg-avatar"><i class="ph-fill ph-robot"></i></div>`;

        msgDiv.innerHTML = `${avatarHTML}<div class="msg-bubble">${text}</div>`;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function handleSend() {
        const text = chatInput.value.trim();
        if (!text) return;

        addMessage(text, true);
        chatInput.value = '';

        // Simulate functional AI parsing local data
        setTimeout(() => {
            const lowerText = text.toLowerCase();
            let reply = "I can analyze your stock if you ask me 'low stock' or 'search <item>'.";

            if (lowerText.includes('low') || lowerText.includes('out of stock')) {
                const lowItems = inventory.filter(i => i.stock < 5).map(i => i.name).join(', ');
                reply = lowItems ? `You are low on: ${lowItems}.` : "All your stock is healthy!";
            } else if (lowerText.includes('total') || lowerText.includes('revenue')) {
                reply = `Your total recorded revenue is ₹${totalRevenue}.`;
            } else if (lowerText.includes('search')) {
                const query = lowerText.replace('search', '').trim();
                const found = inventory.filter(i => i.name.toLowerCase().includes(query));
                if (found.length) {
                    reply = found.map(i => `${i.name}: ₹${i.price} (${i.stock} in stock)`).join('<br>');
                } else {
                    reply = `I couldn't find any items matching '${query}'.`;
                }
            }

            addMessage(reply);
        }, 1000);
    }

    sendBtn.addEventListener('click', handleSend);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });

    // --- Camera Scanning Logic ---
    let html5QrCode = null;
    const cameraButtons = document.querySelectorAll('.start-camera-btn');

    async function stopCamera() {
        if (html5QrCode && html5QrCode.isScanning) {
            await html5QrCode.stop();
            document.querySelectorAll('.camera-reader-container').forEach(c => c.style.display = 'none');
            document.querySelectorAll('.start-camera-btn').forEach(b => {
                b.innerHTML = '<i class="ph ph-camera"></i> ' + (b.id === 'posCameraBtn' ? 'Use Camera' : '');
            });
        }
    }

    cameraButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const targetInputId = btn.getAttribute('data-target');
            const readerId = targetInputId === 'posBarcodeInput' ? 'reader-pos' : (targetInputId === 'prodBarcode' ? 'reader-add' : 'reader-edit');
            const fallbackId = targetInputId === 'posBarcodeInput' ? 'fallback-pos' : (targetInputId === 'prodBarcode' ? 'fallback-add' : 'fallback-edit');
            const readerContainer = document.getElementById(readerId);
            const fallbackContainer = document.getElementById(fallbackId);

            if (html5QrCode && html5QrCode.isScanning) {
                await stopCamera();
                return;
            }

            // Clean up previous reader if it exists but isn't scanning
            if (html5QrCode) {
                try { await html5QrCode.clear(); } catch (e) { }
            }

            readerContainer.style.display = 'block';
            if (fallbackContainer) fallbackContainer.style.display = 'none';
            btn.innerHTML = '<i class="ph ph-stop"></i> Stop';

            // Configure to support Data Matrix (DTM) and other common formats
            const formatsToSupport = [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.DATA_MATRIX,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_39
            ];

            html5QrCode = new Html5Qrcode(readerId, { formatsToSupport: formatsToSupport });
            const config = {
                fps: 20,
                qrbox: { width: 280, height: 200 },
                aspectRatio: 1.0
            };

            try {
                // Check if we are in a secure context or localhost
                if (window.location.protocol === 'file:' && !window.location.hostname.includes('localhost')) {
                    throw new Error("Camera scanning requires a secure context (HTTPS or Local Server).");
                }

                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText) => {
                        const targetInput = document.getElementById(targetInputId);
                        targetInput.value = decodedText;
                        if (targetInputId === 'posBarcodeInput') {
                            const event = new KeyboardEvent('keypress', { key: 'Enter' });
                            targetInput.dispatchEvent(event);
                        }
                        stopCamera();
                    },
                    (errorMessage) => { /* ignore */ }
                );
            } catch (err) {
                console.warn("Camera start failed, showing fallback:", err);
                if (fallbackContainer) fallbackContainer.style.display = 'block';
                if (readerContainer) readerContainer.style.display = 'none';

                if (window.location.protocol === 'file:') {
                    showToast("Scanning from files (file://) is blocked by browsers for security. Please run a local server or use the 'Upload to Scan' option below.", "info");
                } else {
                    showToast("Could not access camera. Please check permissions.", "error");
                }

                // Keep the button as "Stop" to allow closing the fallback UI
            }
        });
    });

    // Image file scanning logic
    document.querySelectorAll('.file-scan-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            const targetInputId = input.getAttribute('data-target');
            if (!file) return;

            const tempReader = new Html5Qrcode("reader-add"); // temp hidden reader
            try {
                const decodedText = await tempReader.scanFile(file, true);
                const targetInput = document.getElementById(targetInputId);
                targetInput.value = decodedText;

                if (targetInputId === 'posBarcodeInput') {
                    const event = new KeyboardEvent('keypress', { key: 'Enter' });
                    targetInput.dispatchEvent(event);
                }

                showToast("Successfully scanned: " + decodedText, "success");
                // Reset file input
                input.value = '';
            } catch (err) {
                console.error("File scan error:", err);
                showToast("Could not find a barcode in this image. Please ensure it is clear and well-lit.", "error");
            }
        });
    });

    // Ensure camera stops when modals are closed
    const originalCloseModal = closeModal;
    window.closeModal = function (modal) {
        stopCamera();
        originalCloseModal(modal);
    };



    // Drive UI Updates
    window.updateDriveUI = function (isConnected) {
        const driveConnectedUI = document.getElementById('driveConnectedUI');
        const driveDisconnectedUI = document.getElementById('driveDisconnectedUI');
        const driveStatusBadge = document.getElementById('driveStatusBadge');
        const driveLastSync = document.getElementById('driveLastSync');

        if (isConnected) {
            if (driveConnectedUI) driveConnectedUI.style.display = 'block';
            if (driveDisconnectedUI) driveDisconnectedUI.style.display = 'none';
            if (driveStatusBadge) {
                driveStatusBadge.innerHTML = '<i class="ph-fill ph-circle" style="color: #34A853;"></i> Connected';
                driveStatusBadge.style.color = '#34A853';
                driveStatusBadge.style.background = 'rgba(52, 168, 83, 0.1)';
            }
            const lastSync = localStorage.getItem('taruchhaya_last_sync');
            if (driveLastSync && lastSync) driveLastSync.textContent = `Last synced: ${new Date(lastSync).toLocaleString()}`;
        } else {
            if (driveConnectedUI) driveConnectedUI.style.display = 'none';
            if (driveDisconnectedUI) driveDisconnectedUI.style.display = 'block';
            if (driveStatusBadge) {
                driveStatusBadge.innerHTML = '<i class="ph ph-circle"></i> Not Connected';
                driveStatusBadge.style.color = 'var(--text-tertiary)';
                driveStatusBadge.style.background = 'rgba(255,255,255,0.05)';
            }
            localStorage.removeItem('google_drive_token');
        }
    };

    const driveConnectBtn = document.getElementById('driveConnectBtn');
    if (driveConnectBtn) {
        driveConnectBtn.addEventListener('click', () => {
            tokenClient.callback = async (resp) => {
                if (resp.error !== undefined) throw (resp);
                resp.expires_at = Date.now() + (resp.expires_in * 1000);
                localStorage.setItem('google_drive_token', JSON.stringify(resp));
                gapi.client.setToken(resp); // <--- ENSURE TOKEN IS SET IN GAPI
                // ✅ Mark as persistently connected so we auto-reconnect on next load
                localStorage.setItem('taruchhaya_drive_connected', 'true');
                updateDriveUI(true);
                showToast("✅ Google Drive connected! It will stay connected automatically.", 'success');
            };

            if (gapi.client.getToken() === null) {
                tokenClient.requestAccessToken({ prompt: 'consent' });
            } else {
                tokenClient.requestAccessToken({ prompt: '' });
            }
        });
    }

    const driveDisconnectBtn = document.getElementById('driveDisconnectBtn');
    if (driveDisconnectBtn) {
        driveDisconnectBtn.addEventListener('click', () => {
            customConfirm('Disconnect Google Drive?', 'This will stop automatic syncing. Your data already on Drive will remain safe. Reconnect anytime from Settings.', () => {
                const token = gapi.client.getToken();
                if (token !== null) {
                    google.accounts.oauth2.revoke(token.access_token);
                    gapi.client.setToken('');
                }
                // ✅ Clear persistent connection flag so we don't auto-reconnect
                localStorage.removeItem('taruchhaya_drive_connected');
                localStorage.removeItem('google_drive_token');
                updateDriveUI(false);
                showToast("Disconnected from Google Drive.", 'info');
            });
        });
    }

    async function syncToDrive(silent = false) {
        try {
            const data = {
                inventory: inventory,
                totalRevenue: totalRevenue,
                syncDate: new Date().toISOString(),
                app: "Taruchhaya Inventory"
            };

            let response = await gapi.client.drive.files.list({
                q: "name = 'taruchhaya_v1_backup.json' and trashed = false",
                fields: 'files(id, name)',
            });

            const files = response.result.files;
            const fileContent = JSON.stringify(data, null, 2);

            if (files.length > 0) {
                const fileId = files[0].id;
                await gapi.client.request({
                    path: '/upload/drive/v3/files/' + fileId,
                    method: 'PATCH',
                    params: { uploadType: 'media' },
                    body: fileContent
                });
            } else {
                const metadata = { name: 'taruchhaya_v1_backup.json', mimeType: 'application/json' };
                const boundary = '-------314159265358979323846';
                const delimiter = `--${boundary}\r\n`; // No leading \r\n
                const close_delim = `\r\n--${boundary}--`;

                const multipartRequestBody =
                    delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
                    '\r\n' + delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + fileContent +
                    close_delim;

                await gapi.client.request({
                    'path': '/upload/drive/v3/files',
                    'method': 'POST',
                    'params': { 'uploadType': 'multipart' },
                    'headers': { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
                    'body': multipartRequestBody
                });
            }
            localStorage.setItem('taruchhaya_last_sync', new Date().toISOString());
            updateDriveUI(true);
            if (!silent) showToast("✅ Synced to Google Drive!", "success");
        } catch (err) {
            console.error(err);
            if (!silent) showToast("Sync failed: " + err.message, "error");
        }
    }

    async function pullFromDrive() {
        try {
            let response = await gapi.client.drive.files.list({
                q: "name = 'taruchhaya_v1_backup.json' and trashed = false",
                fields: 'files(id, name)',
            });

            const files = response.result.files;
            if (files.length === 0) {
                showToast("No backup found on Drive.", "error");
                return;
            }

            const fileId = files[0].id;
            const fileResp = await gapi.client.drive.files.get({ fileId: fileId, alt: 'media' });
            const importedData = fileResp.result;

            customConfirm('Sync from Cloud?', 'This will replace your current local data with the backup from Google Drive. Are you sure?', () => {
                inventory = importedData.inventory;
                totalRevenue = importedData.totalRevenue || 0;
                saveInventory();
                localStorage.setItem('taruchhaya_revenue', totalRevenue);
                localStorage.setItem('taruchhaya_last_sync', new Date().toISOString());
                updateDashboard();
                updateDriveUI(true);
                showToast('Success! Data pulled from Google Drive.', 'success');
                document.querySelector('[data-view="dashboard"]').click();
            });
        } catch (err) {
            console.error(err);
            showToast("Pull failed: " + err.message, "error");
        }
    }

    const drivePushBtn = document.getElementById('drivePushBtn');
    const drivePullBtn = document.getElementById('drivePullBtn');
    if (drivePushBtn) drivePushBtn.addEventListener('click', () => syncToDrive(false));
    if (drivePullBtn) drivePullBtn.addEventListener('click', pullFromDrive);

    // --- Google Client ID Update Logic ---
    const driveClientIdInput = document.getElementById('driveClientIdInput');
    const saveClientIdBtn = document.getElementById('saveClientIdBtn');
    const resetClientIdBtn = document.getElementById('resetClientIdBtn');

    if (saveClientIdBtn && driveClientIdInput) {
        saveClientIdBtn.addEventListener('click', () => {
            const newId = driveClientIdInput.value.trim();
            if (!newId) return;
            GOOGLE_CLIENT_ID = newId;
            localStorage.setItem('taruchhaya_drive_client_id', newId);
            initTokenClient();
            showToast("Google Client ID updated! Please try connecting again.", "success");
        });
    }

    if (resetClientIdBtn && driveClientIdInput) {
        resetClientIdBtn.addEventListener('click', () => {
            GOOGLE_CLIENT_ID = CONFIG.DRIVE.DEFAULT_CLIENT_ID;
            localStorage.removeItem('taruchhaya_drive_client_id');
            driveClientIdInput.value = CONFIG.DRIVE.DEFAULT_CLIENT_ID;
            initTokenClient();
            showToast("Client ID reset to system default.", "info");
        });
    }

    // --- Auto-Sync to Drive (debounced, fires 3s after any data change) ---
    let autoSyncTimer = null;
    async function scheduleDriveAutoSync() {
        // Only auto-sync if user has persistently connected Drive
        if (localStorage.getItem('taruchhaya_drive_connected') !== 'true') return;

        // Ensure we have a valid (non-expired) token before syncing
        const savedToken = localStorage.getItem('google_drive_token');
        if (savedToken) {
            try {
                const token = JSON.parse(savedToken);
                if (Date.now() >= token.expires_at) {
                    // Token expired — silently refresh before syncing
                    await new Promise((resolve) => {
                        tokenClient.callback = (resp) => {
                            if (!resp.error) {
                                resp.expires_at = Date.now() + (resp.expires_in * 1000);
                                localStorage.setItem('google_drive_token', JSON.stringify(resp));
                                gapi.client.setToken(resp);
                            }
                            resolve();
                        };
                        tokenClient.requestAccessToken({ prompt: '' });
                    });
                } else {
                    // Token still valid — ensure it's set in gapi
                    gapi.client.setToken(JSON.parse(savedToken));
                }
            } catch (e) { return; }
        } else {
            return; // No token at all
        }

        // Debounce: reset timer on every call, sync 3s after last change
        clearTimeout(autoSyncTimer);
        autoSyncTimer = setTimeout(() => {
            syncToDrive(true); // silent = true, no toast
        }, 3000);
    }

    // Trigger check anyway in case scripts loaded very fast
    window.checkBeforeStart();

    // Fallback if global handlers weren't triggered by script tags
    if (typeof gapi !== 'undefined' && gapi.load && !gapiInited) window.gapiLoaded();
    if (typeof google !== 'undefined' && google.accounts && !gisInited) window.gisLoaded();


});
