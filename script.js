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
    DATABASE: {
        NAME: 'TaruchhayaDB',
        VERSION: 1,
        STORE: 'app_data'
    },
    ADMIN: {
        DEFAULT_PIN: '1234'
    },
    SUPABASE: {
        URL: 'https://xhokskcszbmjuioeywmw.supabase.co',
        KEY: 'sb_publishable_AqkMNs5rKGyzz8mngxY0mg_JtCTQzFy'
    }
};

/* --- ⚡ Supabase Initialization --- */
const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.KEY);

/* --- 🌏 Global State --- */
let inventory = [];
let totalRevenue = 0;
let onlineRevenue = 0;
let analyticsChartObj = null;



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

function customConfirm(title, message, onConfirm, confirmText = "Proceed", cancelText = "Cancel", onCancel = null) {
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
    proceedBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    overlay.classList.add('show');

    const cleanup = () => {
        overlay.classList.remove('show');
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        proceedBtn.replaceWith(proceedBtn.cloneNode(true));
    };

    document.getElementById('confirm-cancel').addEventListener('click', () => {
        cleanup();
        if (onCancel) onCancel();
    });

    document.getElementById('confirm-proceed').addEventListener('click', () => {
        cleanup();
        if (onConfirm) onConfirm();
    });
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

        try {
            const idbInv = await idbGet('taruchhaya_inventory');
            const idbRev = await idbGet('taruchhaya_revenue');
            const idbOnlineRev = await idbGet('taruchhaya_online_revenue');

            if (idbInv && Array.isArray(idbInv)) {
                inventory = idbInv;
                totalRevenue = idbRev || 0;
                onlineRevenue = idbOnlineRev || 0;
            } else {
                // Fallback / Migrate from LocalStorage to IndexedDB
                inventory = JSON.parse(localStorage.getItem('taruchhaya_inventory')) || [];
                totalRevenue = parseFloat(localStorage.getItem('taruchhaya_revenue')) || 0;
                onlineRevenue = parseFloat(localStorage.getItem('taruchhaya_online_revenue')) || 0;

                await idbSet('taruchhaya_inventory', inventory);
                await idbSet('taruchhaya_revenue', totalRevenue);
                await idbSet('taruchhaya_online_revenue', onlineRevenue);
            }
        } catch (err) {
            console.error("IndexedDB Initialization Error:", err);
            inventory = JSON.parse(localStorage.getItem('taruchhaya_inventory')) || [];
            totalRevenue = parseFloat(localStorage.getItem('taruchhaya_revenue')) || 0;
        }

        // 🛠️ DATA INTEGRITY: Ensure every item has a unique ID for synchronization
        let needsMigrationSave = false;
        inventory.forEach(item => {
            if (!item.id) {
                item.id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                    const r = Math.random() * 16 | 0;
                    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                });
                needsMigrationSave = true;
            }
        });
        if (needsMigrationSave) saveLocalOnly();

        updateDashboard();
        renderInventoryTable();
        populatePosSelect();

        // FIX: Only reset session counters on a TRUE new login, not every page reload.
        // A real new login is detected by the absence of 'ti_session_active' in sessionStorage.
        // sessionStorage is cleared when the browser tab is closed, or on logout.
        if (!sessionStorage.getItem('ti_session_active')) {
            resetSessionCounters(); // Only resets counters, does NOT save to cloud
            sessionStorage.setItem('ti_session_active', 'true');
        }

        // 🌟 Always pull latest from cloud on start
        await pullFromSupabase();

        // 🔄 REALTIME SUBSCRIPTION: Listen for changes from other devices
        initSupabaseRealtime();

        // ⏱️ PERIODIC SYNC: Poll every 30 seconds so Supabase dashboard changes reflect quickly
        setInterval(() => pullFromSupabase(), 30 * 1000);

        // 👁️ TAB FOCUS SYNC: Pull immediately whenever user switches back to this tab
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                pullFromSupabase();
            }
        });
    }

    // FIX: Guard flag to prevent concurrent pull operations from stacking up
    let _isSyncing = false;

    /**
     * Initializes Supabase Realtime subscription to listen for inventory changes.
     */
    function initSupabaseRealtime() {
        try {
            console.log("Supabase: Initializing Realtime...");
            supabaseClient
                .channel('inventory_changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
                    console.log('Supabase: Realtime change detected!', payload);
                    // Pull silently; guard prevents stack-up
                    pullFromSupabase();
                })
                .subscribe();
        } catch (err) {
            console.error("Supabase Realtime Error:", err);
        }
    }

    /**
     * PUSH: Saves local inventory to the cloud (upsert by id).
     * Safe to call with empty inventory — will not return early so cloud clears work.
     */
    async function pushToSupabase() {
        const dot = document.getElementById('cloudStatus');
        if (dot) dot.classList.add('syncing');

        try {
            if (!inventory || inventory.length === 0) {
                updateCloudStatus(true);
                return true;
            }

            // Prepare payload. We now always send the ID (even for new items) 
            // because the database has a NOT NULL constraint on the 'id' column.
            const payload = inventory.map(item => ({
                id: item.id,
                name: item.name.trim(),
                barcode: item.barcode || '',
                category: item.category || 'General',
                price: parseFloat(item.price) || 0,
                stock: parseInt(item.stock) || 0,
                last_updated: new Date().toISOString()
            }));

            // .select() returns the updated rows including cloud-assigned IDs (if any)
            const { data, error } = await supabaseClient
                .from('inventory')
                .upsert(payload, { onConflict: 'id' })
                .select();

            if (error) throw error;

            // ✅ Update local inventory with authoritative cloud data
            if (data && data.length > 0) {
                data.forEach(cloudItem => {
                    const localItem = inventory.find(i => i.id === cloudItem.id);
                    if (localItem) {
                        localItem._pendingCloudSync = false;
                    }
                });
            }

            // Save the updated IDs locally
            saveLocalOnly();
            updateCloudStatus(true);
            return true;

        } catch (err) {
            console.error('Cloud push failed:', err);
            const msg = err?.message || err?.code || "Check internet connection";
            showToast(`☁️ Cloud sync failed: ${msg}`, 'error');
            updateCloudStatus(false);
            return false;
        } finally {
            if (dot) dot.classList.remove('syncing');
        }
    }

    function updateCloudStatus(isOk) {
        const dot = document.getElementById('cloudStatus');
        if (dot) {
            dot.style.backgroundColor = isOk ? 'var(--accent-success)' : 'var(--accent-danger)';
            dot.style.boxShadow = isOk ? '0 0 8px var(--accent-success)' : '0 0 8px var(--accent-danger)';
            dot.title = isOk ? 'Cloud: Synced' : 'Cloud: Error';
        }
    }

    async function deleteFromSupabase(id) {
        try {
            const { error } = await supabaseClient.from('inventory').delete().eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.error('Cloud delete failed:', err);
        }
    }

    async function clearSupabaseInventory() {
        try {
            const { error } = await supabaseClient.from('inventory').delete().neq('id', '0');
            if (error) throw error;
        } catch (err) {
            console.error('Cloud clear failed:', err);
        }
    }

    /**
     * PULL: Fetches cloud inventory and merges safely into local state.
     *
     * HOW DELETION DETECTION WORKS:
     * - New products added THIS SESSION are tagged with `_pendingCloudSync = true` in memory.
     * - This flag is NOT saved to localStorage/IndexedDB (it's session-only).
     * - On pull, if an item is missing from cloud:
     *   → If `_pendingCloudSync` is true  → it's a new local item not yet pushed → push it.
     *   → If `_pendingCloudSync` is false/undefined → it was in cloud before and got deleted → remove it locally.
     * - This works for ALL existing items (no migration needed) because items loaded from
     *   storage never have `_pendingCloudSync` set.
     */
    async function pullFromSupabase() {
        if (_isSyncing) return;
        _isSyncing = true;

        const dot = document.getElementById('cloudStatus');
        if (dot) dot.classList.add('syncing');

        try {
            const { data, error } = await supabaseClient.from('inventory').select('*');
            if (error) throw error;
            if (!data) { _isSyncing = false; return; }

            let changed = false;
            const cloudIds = new Set(data.map(d => d.id));
            const cloudNames = new Set(data.map(d => d.name.trim().toLowerCase()));

            // Step 1: Merge cloud items into local state
            data.forEach(cloudItem => {
                let localItem = inventory.find(i => i.id === cloudItem.id);
                if (!localItem) {
                    localItem = inventory.find(i =>
                        i.name.trim().toLowerCase() === cloudItem.name.trim().toLowerCase()
                    );
                    if (localItem) {
                        localItem.id = cloudItem.id;
                        localItem._pendingCloudSync = false;
                        changed = true;
                    }
                }

                if (!localItem) {
                    // New item from cloud
                    inventory.push({
                        id: cloudItem.id,
                        name: cloudItem.name,
                        barcode: cloudItem.barcode || '',
                        category: cloudItem.category || 'General',
                        price: parseFloat(cloudItem.price) || 0,
                        stock: parseInt(cloudItem.stock) || 0,
                        _pendingCloudSync: false
                    });
                    changed = true;
                } else {
                    const cloudPrice = parseFloat(cloudItem.price) || 0;
                    const cloudStock = parseInt(cloudItem.stock) || 0;
                    const cloudBarcode = cloudItem.barcode || '';
                    const cloudCategory = cloudItem.category || 'General';

                    if (localItem.stock !== cloudStock || 
                        localItem.price !== cloudPrice || 
                        localItem.name !== cloudItem.name || 
                        localItem.barcode !== cloudBarcode || 
                        localItem.category !== cloudCategory) {
                        
                        localItem.stock = cloudStock;
                        localItem.price = cloudPrice;
                        localItem.name = cloudItem.name;
                        localItem.barcode = cloudBarcode;
                        localItem.category = cloudCategory;
                        localItem._pendingCloudSync = false;
                        changed = true;
                    }
                }
            });

            // Step 2: Handle local items not in cloud
            // An item is deleted ONLY if it's not in cloud AND not pending sync
            const originalLength = inventory.length;
            inventory = inventory.filter(item => {
                const inCloud = cloudIds.has(item.id) || cloudNames.has(item.name.trim().toLowerCase());
                const isPending = item._pendingCloudSync === true;
                
                if (!inCloud && !isPending) {
                    console.log(`Removing ${item.name} (not in cloud and not pending)`);
                    return false;
                }
                return true;
            });

            if (inventory.length !== originalLength) changed = true;

            if (changed) {
                saveLocalOnly();
            }

            updateCloudStatus(true);

            // Step 3: Trigger push for pending items if any survived/were added
            const hasPending = inventory.some(i => i._pendingCloudSync === true);
            if (hasPending) {
                // We don't await here to avoid blocking pull completion, 
                // but pushToSupabase has its own guards.
                pushToSupabase();
            }

        } catch (err) {
            console.error('Cloud pull failed:', err);
            updateCloudStatus(false);
        } finally {
            _isSyncing = false;
            if (dot) dot.classList.remove('syncing');
        }
    }

    initializeData();
    updateSidebarDate();

    function updateSidebarDate() {
        const dateEl = document.getElementById('sidebarDate');
        if (dateEl) {
            const now = new Date();
            const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            dateEl.textContent = now.toLocaleDateString('en-IN', options);
        }
    }

    /**
     * Saves inventory to localStorage + IndexedDB and updates UI.
     * @param {boolean} skipCloud - If true, does NOT push to Supabase.
     */
    async function saveInventory(skipCloud = false) {
        // Save locally FIRST (preserves _pendingCloudSync in memory)
        saveLocalOnly();
        if (!skipCloud) {
            await pushToSupabase();
        }
    }

    /**
     * Saves inventory locally (localStorage + IDB) and refreshes UI.
     * Does NOT touch the cloud. Use this for cloud-triggered updates to
     * avoid infinite push-pull loops.
     */
    function saveLocalOnly() {
        // IMPORTANT: We now PERSIST the _pendingCloudSync flag.
        // This ensures that if a sync fails and the user refreshes, the app
        // still knows the product is new and shouldn't be deleted by the cloud pull.
        localStorage.setItem('taruchhaya_inventory', JSON.stringify(inventory));
        idbSet('taruchhaya_inventory', inventory).catch(err => console.error("IDB Save Error", err));
        
        updateDashboard();
        renderInventoryTable();
        populatePosSelect();
    }

    function saveRevenue(amount, isOnline = false) {
        totalRevenue += amount;
        if (isOnline) onlineRevenue += amount;

        localStorage.setItem('taruchhaya_revenue', totalRevenue);
        localStorage.setItem('taruchhaya_online_revenue', onlineRevenue);

        idbSet('taruchhaya_revenue', totalRevenue).catch(err => console.error("IDB Save Error", err));
        idbSet('taruchhaya_online_revenue', onlineRevenue).catch(err => console.error("IDB Save Error", err));

        updateDashboard();
    }

    /**
     * Resets total revenue to zero.
     */
    function resetRevenue() {
        totalRevenue = 0;
        onlineRevenue = 0;
        localStorage.setItem('taruchhaya_revenue', totalRevenue);
        localStorage.setItem('taruchhaya_online_revenue', onlineRevenue);
        idbSet('taruchhaya_revenue', totalRevenue).catch(err => console.error("IDB Save Error", err));
        idbSet('taruchhaya_online_revenue', onlineRevenue).catch(err => console.error("IDB Save Error", err));
        updateDashboard();
    }

    /**
     * Resets ONLY the in-memory session counters (sold/purchased/restock).
     * Does NOT save to cloud — called only on genuine new logins, not page reloads.
     */
    function resetSessionCounters() {
        console.log("Resetting session counters (new login)...");
        inventory.forEach(item => {
            item.sessionSold = 0;
            item.sessionPurchased = 0;
            item.restockCount = 0;
        });
        sessionStorage.setItem('ti_tx_count', '0');
        sessionStorage.setItem('ti_po_count', '0');
        sessionStorage.setItem('ti_po_value', '0');
        // Save locally only — cloud should not be affected by session counter resets
        saveLocalOnly();
    }

    /**
     * Full session analytics reset (used by report generation).
     */
    function resetSessionAnalytics() {
        resetSessionCounters();
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

                // Close sidebar on mobile/tablet after selection
                if (window.innerWidth <= 1024 && sidebar) {
                    sidebar.classList.remove('open');
                }
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
    /**
     * Generates a professional business report and uploads it to the cloud.
     * @param {boolean} silent - If true, minimizes user feedback.
     */
    async function generateAndUploadReport(silent = false) {
        if (!silent) showToast('Generating premium business report...', 'info');

        try {
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
            const shortDateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '');
            const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            
            // Unique Report ID
            const reportId = `TE-${shortDateStr}-${now.getHours()}${String(now.getMinutes()).padStart(2, '0')}`;

            // Session Data Gathering
            const sessionStartMs = parseInt(sessionStorage.getItem('ti_session_start')) || now.getTime();
            const durationMs = now.getTime() - sessionStartMs;
            const diffHours = Math.floor(durationMs / 3600000);
            const diffMins = Math.floor((durationMs % 3600000) / 60000);
            const durationStr = `${diffHours} Hours ${diffMins} Minutes`;

            const txCount = parseInt(sessionStorage.getItem('ti_tx_count') || '0');
            const poCount = parseInt(sessionStorage.getItem('ti_po_count') || '0');
            const poValue = parseFloat(sessionStorage.getItem('ti_po_value') || '0');

            let totalItemsSold = 0;
            inventory.forEach(i => totalItemsSold += (i.sessionSold || 0));

            const topSellers = [...inventory]
                .filter(i => (i.sessionSold || 0) > 0)
                .sort((a, b) => b.sessionSold - a.sessionSold)
                .slice(0, 5);

            const closingInvValue = inventory.reduce((sum, item) => sum + (item.price * item.stock), 0);
            const avgOrderValue = txCount > 0 ? (totalRevenue / txCount) : 0;
            
            // Estimated Gross Margin (Currently estimated at 18% of revenue since cost price isn't tracked yet)
            const estimatedMargin = totalRevenue * 0.18;

            // --- PREMIUM REPORT GENERATION ---
            let r = `╔══════════════════════════════════════════════════════════════╗\n`;
            r += `║            🌳 TARUCHHAYA ENTERPRISE                        ║\n`;
            r += `║                 DAILY BUSINESS REPORT                      ║\n`;
            r += `╚══════════════════════════════════════════════════════════════╝\n\n`;

            r += `📅 Report Date      : ${dateStr}\n`;
            r += `⏰ Generated At     : ${timeStr}\n`;
            r += `🕒 Session Duration : ${durationStr}\n`;
            r += `🧾 Report ID        : ${reportId}\n\n`;

            r += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            r += `💰 FINANCIAL SUMMARY\n`;
            r += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            r += `🟢 Total Revenue            : ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
            r += `   ├─ UPI / Online Sales    : ₹${onlineRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
            r += `   └─ Cash Sales            : ₹${(totalRevenue - onlineRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n`;

            r += `🧾 Total Transactions       : ${txCount}\n`;
            r += `📦 Total Products Sold      : ${totalItemsSold} Units\n`;
            r += `📊 Average Order Value      : ₹${avgOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
            r += `📈 Estimated Gross Margin   : ₹${estimatedMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n`;

            r += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            r += `📦 INVENTORY & STOCK OVERVIEW\n`;
            r += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            r += `🛒 Purchase Orders Created  : ${poCount}\n`;
            r += `💸 Purchase Expenditure     : ₹${poValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
            r += `🏬 Closing Inventory Value  : ₹${closingInvValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n`;

            r += `┌──────────────────────┬──────┬──────┬──────┬──────┬────────────┐\n`;
            r += `│ Product Name         │ Open │  In  │ Out  │Close │ Revenue    │\n`;
            r += `├──────────────────────┼──────┼──────┼──────┼──────┼────────────┤\n`;

            inventory.forEach(item => {
                const sold = item.sessionSold || 0;
                const purchased = item.sessionPurchased || 0;
                const closing = item.stock;
                const opening = closing + sold - purchased;
                const itemRev = sold * item.price;

                const name = (item.name.length > 20 ? item.name.substring(0, 18) + '..' : item.name).padEnd(20);
                const openStr = String(opening).padStart(4);
                const inStr = String(purchased).padStart(4);
                const outStr = String(sold).padStart(4);
                const closeStr = String(closing).padStart(4);
                const revStr = `₹${itemRev.toLocaleString('en-IN')}`.padStart(10);

                r += `│ ${name} │ ${openStr} │ ${inStr} │ ${outStr} │ ${closeStr} │ ${revStr} │\n`;
            });
            r += `└──────────────────────┴──────┴──────┴──────┴──────┴────────────┘\n\n`;

            r += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            r += `📈 TOP SELLING PRODUCTS\n`;
            r += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            if (topSellers.length > 0) {
                topSellers.forEach((item, idx) => {
                    const rev = item.sessionSold * item.price;
                    r += `${medals[idx]} ${item.name.padEnd(20)} → ${String(item.sessionSold).padStart(2)} Units Sold | ₹${rev.toLocaleString('en-IN')} Revenue\n`;
                });
            } else {
                r += `No sales activity recorded in this session.\n`;
            }
            r += `\n`;

            const restocked = inventory.filter(i => i.restockCount > 0);
            if (restocked.length > 0) {
                r += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                r += `📋 RESTOCK ACTIVITY LOG\n`;
                r += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
                restocked.forEach(item => {
                    const t = new Date(item.lastRestockTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                    r += `✅ ${item.name.padEnd(20)} restocked ${item.restockCount} Times   | Last Update: ${t}\n`;
                });
                r += `\n`;
            }

            // --- DYNAMIC BUSINESS INSIGHTS ---
            r += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            r += `🧠 BUSINESS INSIGHTS\n`;
            r += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            const insights = [];
            if (topSellers.length > 0) {
                insights.push(`• ${topSellers[0].name} generated the highest revenue today.`);
            }
            
            const outOfStock = inventory.filter(i => i.stock === 0).length;
            if (outOfStock > 0) {
                insights.push(`• ${outOfStock} products reached zero stock before closing.`);
            }

            if (totalRevenue > 0) {
                const upiPercent = Math.round((onlineRevenue / totalRevenue) * 100);
                insights.push(`• UPI payments contributed nearly ${upiPercent}% of total revenue.`);
            }

            const lowStockCount = inventory.filter(i => i.stock > 0 && i.stock <= 5).length;
            if (lowStockCount > 0) {
                insights.push(`• ${lowStockCount} items are running low. Consider increasing stock for fast-moving items.`);
            } else if (inventory.length > 0) {
                insights.push(`• Inventory levels for most items are currently healthy.`);
            }

            if (restocked.length > 3) {
                insights.push(`• High restocking frequency indicates strong demand during this session.`);
            }

            if (insights.length === 0) {
                insights.push(`• Maintain current operational pace. Monitor stock levels periodically.`);
            }

            insights.forEach(insight => r += `${insight}\n`);
            r += `\n`;

            r += `╔══════════════════════════════════════════════════════════════╗\n`;
            r += `║         END OF ELECTRONICALLY GENERATED REPORT             ║\n`;
            r += `║                Verified by Taruchhaya Systems              ║\n`;
            r += `╚══════════════════════════════════════════════════════════════╝\n`;

            if (!silent) {
                // --- CLOUD UPLOAD ---
                try {
                    await supabaseClient
                        .from('reports')
                        .insert([{
                            report_date: dateStr,
                            content: r
                        }]);
                    showToast('✅ Report finalized and uploaded to Cloud!', 'success');
                } catch (cloudErr) {
                    console.error("Cloud Report Upload Failed:", cloudErr);
                    showToast('Failed to sync report to Cloud.', 'error');
                }

                // Show the report virtually to the user immediately
                openVirtualReport({ report_date: dateStr, content: r });

                resetRevenue();
                resetSessionAnalytics();
            }
            return true;
        } catch (err) {
            console.error('Report Error:', err);
            if (!silent) showToast('Report Generation Failed.', 'error');
            return false;
        }
    }

    // --- Logout & Report Buttons ---
    const reportBtn = document.getElementById('reportBtn');
    const headerReportBtn = document.getElementById('headerReportBtn');
    const sidebarBrowseBtn = document.getElementById('sidebarBrowseBtn');

    function handleReportClick(e) {
        e.preventDefault();
        generateAndUploadReport();
    }

    function handleBrowseClick(e) {
        e.preventDefault();
        showPinModal(() => {
            openReportArchive();
        });
    }

    if (reportBtn) reportBtn.addEventListener('click', handleReportClick);
    if (headerReportBtn) headerReportBtn.addEventListener('click', handleBrowseClick);
    if (sidebarBrowseBtn) sidebarBrowseBtn.addEventListener('click', handleBrowseClick);

    async function processLogout(e) {
        if (e) e.preventDefault();

        customConfirm('Logout Confirmation', 'Are you sure you want to end your session? Your session analytics will be reset, but your inventory list will be preserved.', () => {
            // Reset daily/session numbers before leaving
            resetSessionAnalytics();

            // Wipe session tokens — next login starts fresh session
            sessionStorage.removeItem('ti_session');
            sessionStorage.removeItem('ti_session_start');
            sessionStorage.removeItem('ti_session_active');
            localStorage.removeItem('ti_session');

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
        if (invValueEl) invValueEl.textContent = `₹${invValue.toLocaleString('en-IN')}`;



        // Update Total Products count
        const totalProdsEl = document.getElementById('dashboardTotalProds');
        if (totalProdsEl) totalProdsEl.textContent = inventory.length;

        // Update Revenue
        const revenueEl = document.getElementById('dashboardRevenue');
        if (revenueEl) revenueEl.textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;

        renderLowStockList();
    }

    function renderLowStockList() {
        const container = document.getElementById('outOfStockList');
        if (!container) return;

        const lowStock = inventory.filter(item => item.stock < 5);

        if (lowStock.length === 0) {
            container.innerHTML = `<p style="grid-column: 1/-1; color: var(--text-tertiary); font-size: 13px; text-align: center; padding: 20px; background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px dashed var(--border-color);">All products have healthy stock levels (5+).</p>`;
            return;
        }

        container.innerHTML = lowStock.map(item => {
            const dotHtml = item.stock <= 0 ? `<div style="width: 8px; height: 8px; background: var(--accent-danger); border-radius: 50%; box-shadow: 0 0 8px var(--accent-danger);"></div>` : '';
            return `
                <div style="background: ${item.stock <= 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(245, 158, 11, 0.05)'}; border: 1px solid ${item.stock <= 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; padding: 12px; border-radius: 10px; display: flex; align-items: center; gap: 10px; animation: fadeIn 0.3s ease-out;">
                    ${dotHtml}
                    <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name} (${item.stock})</div>
                </div>
            `;
        }).join('');
    }




    // --- Mobile Settings ---
    const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    if (mobileSidebarToggle && sidebar) {
        mobileSidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024 && !sidebar.contains(e.target) && !mobileSidebarToggle.contains(e.target)) {
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

    let searchDebounce = null;
    globalSearch.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            renderInventoryTable(e.target.value);
        }, 150); // Snappy debounce for smooth feel
    });

    // Make delete and edit globally accessible for inline onclick
    window.deleteProduct = function (id) {
        customConfirm('Delete Product?', 'Are you sure you want to remove this product from your inventory?', () => {
            inventory = inventory.filter(item => item.id !== id);
            deleteFromSupabase(id); // Explicitly remove from cloud
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
                // Sanity check: prevent accidental astronomical quantities
                if (qtyToAdd > 10000) {
                    showToast("Quantity seems unusually high. Please verify or add in smaller batches.", "warning");
                    return;
                }

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

            if (pinInput.value === CONFIG.ADMIN.DEFAULT_PIN) {
                inventory = [];
                // FIX: Use resetRevenue() to zero out values — saveRevenue(0) would ADD 0
                resetRevenue();
                localStorage.removeItem('taruchhaya_inventory');
                localStorage.removeItem('taruchhaya_revenue');
                localStorage.removeItem('taruchhaya_online_revenue');
                idbSet('taruchhaya_inventory', []).catch(() => {});
                // Clear from cloud as well
                clearSupabaseInventory();
                // Refresh UI
                saveLocalOnly();

                pinInput.value = '';
                pinError.style.display = 'none';
                closeModal(clearDataConfirmModal);

                showToast("System has been factory reset. All data cleared.", "success");
            } else {
                pinError.style.display = 'block';
            }
        });
    }


    productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const barcode = document.getElementById('prodBarcode').value.trim();
        const name = document.getElementById('prodName').value.trim();
        
        // 🛡️ DUPLICATE PREVENTION: Barcode
        if (barcode && inventory.some(item => item.barcode === barcode)) {
            showToast("A product with this barcode already exists.", "error");
            return;
        }

        // 🛡️ DUPLICATE PREVENTION: Name (Required by Cloud Constraint)
        if (inventory.some(item => item.name.toLowerCase() === name.toLowerCase())) {
            showToast(`A product named "${name}" already exists. Please use a unique name.`, "error");
            return;
        }

        const newProduct = {
            id: crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            }),
            created_at: Date.now(),
            name: name,
            barcode: barcode,
            category: document.getElementById('prodCategory').value,
            price: parseFloat(document.getElementById('prodPrice').value),
            stock: parseInt(document.getElementById('prodStock').value),
            _pendingCloudSync: true  // In-memory flag: this item hasn't been pushed to cloud yet
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
            const barcode = document.getElementById('editProdBarcode').value.trim();
            const name = document.getElementById('editProdName').value.trim();
            const item = inventory.find(p => p.id === id);

            if (item) {
                // 🛡️ DUPLICATE PREVENTION: Barcode
                if (barcode && inventory.some(p => p.barcode === barcode && p.id !== id)) {
                    showToast("This barcode is already assigned to another product.", "error");
                    return;
                }

                // 🛡️ DUPLICATE PREVENTION: Name
                if (inventory.some(p => p.name.toLowerCase() === name.toLowerCase() && p.id !== id)) {
                    showToast(`Another product is already named "${name}".`, "error");
                    return;
                }

                item.name = name;
                item.barcode = barcode;
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

    /**
     * Centralized Barcode Handler
     * Implements logic: 0 stock -> Restock Modal, >0 stock -> POS Modal
     */
    function handleBarcode(code) {
        if (!code) return;
        const product = inventory.find(p => p.barcode === code || p.id === code);

        if (product) {
            if (product.stock === 0) {
                // Feature (a): Quantity is 0 -> Restock option
                showToast(`Product ${product.name} is out of stock. Opening restock...`, "info");
                // If POS modal is open, close it first
                closeModal(posModal);
                window.openRestockModal(product.id);
            } else {
                // Feature (b): Quantity > 0 -> Quick Bill option
                if (!posModal.classList.contains('open')) {
                    // Open POS if not open
                    currentCart = []; // New scan from outside starts fresh cart? 
                    // Actually, if it's "wherever scanned", maybe they want to add to existing?
                    // Let's check status. If it was closed, we assume new or resume.
                    // For now, let's just open it.
                    openModal(posModal);
                    renderCart();
                }
                addProductToCart(product);
                showToast(`Added ${product.name} to bill.`, "success");
            }
        } else {
            showToast("Barcode not found in inventory!", "warning");
        }
    }

    const posBarcodeInput = document.getElementById('posBarcodeInput');
    if (posBarcodeInput) {
        posBarcodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const code = posBarcodeInput.value.trim();
                handleBarcode(code);
                posBarcodeInput.value = ''; // clear for next scan
            }
        });
    }

    // --- Global Keyboard Barcode Listener ---
    // Physical scanners act like rapid keyboards ending with 'Enter'
    let barcodeBuffer = "";
    let lastKeyTime = Date.now();

    document.addEventListener('keydown', (e) => {
        const currentTime = Date.now();
        const target = e.target;

        // Barcode scanners are fast (usually < 50ms between keys)
        const isFastKey = (currentTime - lastKeyTime) < 50;

        if (currentTime - lastKeyTime > 150) {
            barcodeBuffer = ""; // Reset if it's too slow (definitely human typing)
        }

        if (e.key === 'Enter') {
            if (barcodeBuffer.length > 2) {
                e.preventDefault();
                e.stopImmediatePropagation(); // Prevent triggering form submits
                const code = barcodeBuffer;
                barcodeBuffer = "";

                // If focus is in a regular input, clear any characters that bled through
                if (target.tagName === 'INPUT' && !['posBarcodeInput', 'prodBarcode', 'editProdBarcode', 'globalSearch'].includes(target.id)) {
                    target.value = "";
                    target.blur();
                }

                handleBarcode(code);
                return;
            }
            barcodeBuffer = ""; // Reset on Enter if not enough chars
        } else if (e.key.length === 1) {
            barcodeBuffer += e.key;

            // If it's a scanner (fast typing) and not a dedicated barcode input, 
            // prevent the character from reaching the input field.
            if (isFastKey && target.tagName === 'INPUT' && !['posBarcodeInput', 'prodBarcode', 'editProdBarcode', 'globalSearch'].includes(target.id)) {
                e.preventDefault();
            }
        }

        lastKeyTime = currentTime;
    });

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

        posTotalAmt.textContent = total.toLocaleString('en-IN');
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

    const posOnlineBtn = document.getElementById('posOnlineBtn');
    if (posOnlineBtn) {
        posOnlineBtn.addEventListener('click', () => {
            if (currentCart.length === 0) {
                showToast("Cart is empty!", "info");
                return;
            }
            processCheckout(true);
        });
    }

    function processCheckout(isOnline = false) {
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

        saveRevenue(currentTotal, isOnline);
        saveInventory(); // Pushes updated stock levels to cloud

        currentCart = [];
        renderCart();
        closeModal(posModal);

        const method = isOnline ? "Online Gateway" : "Cash/Generic";
        showToast(`Bill generated successfully via ${method} for ₹${currentTotal}! Stock updated.`, "success");
    }

    posCheckoutBtn.addEventListener('click', () => {
        if (currentCart.length === 0) {
            showToast("Cart is empty!", "info");
            return;
        }
        processCheckout(false);
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
            let targetInputId = btn.getAttribute('data-target');

            // If global scan button is clicked from header, we actually want to open POS modal 
            // and use its scanner, or just handle it globally.
            if (targetInputId === 'globalScan') {
                if (!posModal.classList.contains('open')) {
                    openModal(posModal);
                }
                targetInputId = 'posBarcodeInput'; // Divert to POS scanner
            }

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
                        if (targetInput) targetInput.value = decodedText;

                        if (targetInputId === 'posBarcodeInput') {
                            handleBarcode(decodedText);
                        } else {
                            showToast("Scanned: " + decodedText, "success");
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
                if (targetInput) targetInput.value = decodedText;

                if (targetInputId === 'posBarcodeInput' || targetInputId === 'globalScan') {
                    handleBarcode(decodedText);
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
        // Force blur to prevent physical scanners from typing into hidden inputs
        if (document.activeElement && modal && modal.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        originalCloseModal(modal);
    };








    // --- 🔐 Security PIN Modal Logic ---
    const pinSecurityModal = document.getElementById('pinSecurityModal');
    const pinBoxes = document.querySelectorAll('.pin-box');
    const verifyPinBtn = document.getElementById('verifyPinBtn');
    const cancelPinBtn = document.getElementById('cancelPinBtn');
    let onPinSuccess = null;

    function showPinModal(callback) {
        onPinSuccess = callback;
        pinSecurityModal.classList.add('open');
        pinBoxes.forEach(box => box.value = '');
        pinBoxes[0].focus();
    }

    pinBoxes.forEach((box, index) => {
        box.addEventListener('input', (e) => {
            if (e.target.value && index < pinBoxes.length - 1) {
                pinBoxes[index + 1].focus();
            }
        });
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                pinBoxes[index - 1].focus();
            }
            if (e.key === 'Enter') verifyPin();
        });
    });

    function verifyPin() {
        const enteredPin = Array.from(pinBoxes).map(b => b.value).join('');
        if (enteredPin === CONFIG.ADMIN.DEFAULT_PIN) {
            pinSecurityModal.classList.remove('open');
            if (onPinSuccess) onPinSuccess();
        } else {
            showToast("Incorrect PIN. Please try again.", "error");
            pinBoxes.forEach(box => box.value = '');
            pinBoxes[0].focus();
        }
    }

    if (verifyPinBtn) verifyPinBtn.addEventListener('click', verifyPin);
    if (cancelPinBtn) cancelPinBtn.addEventListener('click', () => pinSecurityModal.classList.remove('open'));

    // --- 📂 Report Archive Logic ---
    const reportArchiveModal = document.getElementById('reportArchiveModal');
    const archiveContentBody = document.getElementById('archiveContentBody');
    const archivePathLabel = document.getElementById('archivePathLabel');
    const closeArchiveModal = document.getElementById('closeArchiveModal');

    async function openReportArchive() {
        reportArchiveModal.classList.add('open');
        archiveContentBody.innerHTML = '<div style="display:flex; justify-content:center; padding: 50px;"><i class="ph ph-circle-notch spinning" style="font-size: 32px; color: var(--accent-brand);"></i></div>';

        try {
            const { data: reports, error } = await supabaseClient
                .from('reports')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!reports || reports.length === 0) {
                archiveContentBody.innerHTML = '<div style="text-align:center; padding: 50px; color: var(--text-tertiary);"><i class="ph ph-mask-sad" style="font-size: 48px; margin-bottom: 16px;"></i><p>No finalized reports found in the cloud.</p><p style="font-size: 12px;">Click "Generate Report" at the end of your day to save your first one!</p></div>';
                return;
            }

            renderArchiveFolders(reports);
        } catch (err) {
            console.error("Archive Error:", err);
            showToast("Failed to load report archive.", "error");
        }
    }

    function renderArchiveFolders(reports) {
        archivePathLabel.textContent = "Browse folders by month";
        const months = {};

        reports.forEach(report => {
            const date = new Date(report.created_at);
            const monthKey = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            if (!months[monthKey]) months[monthKey] = [];
            months[monthKey].push(report);
        });

        let html = '<div class="folder-grid">';
        Object.keys(months).forEach(month => {
            html += `
                <div class="folder-card" data-month="${month}">
                    <div class="folder-icon"><i class="ph-fill ph-folder"></i></div>
                    <div class="folder-name">${month}</div>
                    <div class="folder-count">${months[month].length} Reports Saved</div>
                </div>
            `;
        });
        html += '</div>';
        archiveContentBody.innerHTML = html;

        // Add listeners
        archiveContentBody.querySelectorAll('.folder-card').forEach(card => {
            card.addEventListener('click', () => renderArchiveDays(months[card.dataset.month], card.dataset.month));
        });
    }

    function renderArchiveDays(monthReports, monthName) {
        archivePathLabel.textContent = `Reports for ${monthName}`;

        let html = `<button class="back-btn" id="backToFolders"><i class="ph ph-arrow-left"></i> Back to Months</button>`;
        html += '<div class="report-list">';
        monthReports.forEach(report => {
            const day = report.report_date;
            html += `
                <div class="report-entry" data-id="${report.id}">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="width: 40px; height: 40px; background: rgba(16, 185, 129, 0.1); color: var(--accent-success); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                            <i class="ph ph-file-text"></i>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary);">${day}</div>
                            <div style="font-size: 11px; color: var(--text-tertiary);">Finalized on ${new Date(report.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="primary-btn view-report-btn" style="height: 36px; padding: 0 12px; font-size: 12px;">View Virtually</button>
                        <button class="secondary-btn delete-report-btn" style="height: 36px; width: 36px; padding: 0; display: flex; align-items: center; justify-content: center; color: var(--accent-danger); border-color: rgba(239, 68, 68, 0.2);" title="Delete Report">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        archiveContentBody.innerHTML = html;

        document.getElementById('backToFolders').addEventListener('click', () => openReportArchive());

        archiveContentBody.querySelectorAll('.report-entry').forEach(entry => {
            const reportId = entry.dataset.id;
            const report = monthReports.find(r => r.id == reportId);

            entry.querySelector('.view-report-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openVirtualReport(report);
            });

            entry.querySelector('.delete-report-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                window.reportToDelete = reportId;
                openModal(document.getElementById('deleteReportConfirmModal'));
            });

            entry.addEventListener('click', () => {
                openVirtualReport(report);
            });
        });
    }

    // --- Deletion Confirmation Logic ---
    const confirmDeleteReportBtn = document.getElementById('confirmDeleteReportBtn');
    const deleteReportConfirmModal = document.getElementById('deleteReportConfirmModal');

    if (confirmDeleteReportBtn) {
        confirmDeleteReportBtn.addEventListener('click', async () => {
            const reportId = window.reportToDelete;
            if (!reportId) {
                showToast("No report selected for deletion.", "error");
                return;
            }

            confirmDeleteReportBtn.innerHTML = '<i class="ph ph-circle-notch spinning"></i> Deleting...';
            confirmDeleteReportBtn.disabled = true;

            try {
                // Determine if reportId should be a number or string
                // If it's a number-only string, try parsing it
                const finalId = /^\d+$/.test(reportId) ? parseInt(reportId) : reportId;

                console.log(`Attempting to delete report with ID: ${finalId} (type: ${typeof finalId})`);

                const { error, count } = await supabaseClient
                    .from('reports')
                    .delete()
                    .eq('id', finalId);

                if (error) throw error;

                showToast("Report deleted successfully.", "success");
                
                // Close modal using the common function
                if (deleteReportConfirmModal) {
                    deleteReportConfirmModal.classList.remove('open');
                }
                
                window.reportToDelete = null;
                
                // Refresh the archive view immediately
                await openReportArchive(); 
            } catch (err) {
                console.error("Delete Error:", err);
                showToast(`Delete failed: ${err.message || 'Error occurred'}`, "error");
            } finally {
                confirmDeleteReportBtn.innerHTML = 'Yes, Delete';
                confirmDeleteReportBtn.disabled = false;
            }
        });
    }

    // --- 👁️ Virtual Report Viewer Logic ---
    const reportViewModal = document.getElementById('reportViewModal');
    const reportViewerText = document.getElementById('reportViewerText');
    const viewReportTitle = document.getElementById('viewReportTitle');
    const closeViewModal = document.getElementById('closeViewModal');
    const closeViewBtn = document.getElementById('closeViewBtn');
    const downloadFromView = document.getElementById('downloadFromView');
    let currentViewingReport = null;

    function openVirtualReport(report) {
        currentViewingReport = report;
        viewReportTitle.textContent = `Report: ${report.report_date}`;
        reportViewerText.textContent = report.content;
        reportViewModal.classList.add('open');
    }

    if (downloadFromView) {
        downloadFromView.addEventListener('click', () => {
            if (currentViewingReport) {
                downloadTextFile(`Taruchhaya_Archive_${currentViewingReport.report_date.replace(/ /g, '_')}.txt`, currentViewingReport.content);
            }
        });
    }

    if (closeViewModal) closeViewModal.addEventListener('click', () => reportViewModal.classList.remove('open'));
    if (closeViewBtn) closeViewBtn.addEventListener('click', () => reportViewModal.classList.remove('open'));

    function downloadTextFile(filename, content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast("✅ Report downloaded!", "success");
    }

    if (closeArchiveModal) closeArchiveModal.addEventListener('click', () => reportArchiveModal.classList.remove('open'));


});
