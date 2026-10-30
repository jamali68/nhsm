// ============================================
// 📋 BOOKER ORDERS & ADMIN APPROVAL PORTAL ENGINE
// ✅ Dedicated Executive KPI Dashboard
// ✅ Real-Time Field Orders & Live Listener
// ✅ Order Booker Performance & Information Ribbon
// ✅ 1-Click Approval, Live Bill Generation & Stock Deduction
// ✅ Customer Khata Balance Synchronization
// ✅ Thermal & A4 Receipt Printing
// ✅ Bulk Approval & Supplier Van Dispatch
// ============================================

// Firebase Init
const firebaseConfig = {
    apiKey: "AIzaSyDDwKWcixoUThCJQqiVoBcUVsJZI60h43Q",
    authDomain: "multipos-ed91a.firebaseapp.com",
    projectId: "multipos-ed91a",
    storageBucket: "multipos-ed91a.firebasestorage.app",
    messagingSenderId: "862649586987",
    appId: "1:862649586987:web:599772124e4e29404ca16e",
    measurementId: "G-QPCP7S5Q5L"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Global State
let myUid = null;
let myUser = null;
let myAgencyId = null;
let myAgency = null;

let allOrders = [];
let allStaff = [];
let allStock = [];
let allCustomers = [];

let activeFilter = 'all';
let activeDateFilter = 'all';
let activeBookerFilter = 'all';
let isLiveSyncActive = false;

// ============================================
// 🛡️ UNIFIED ORDER STATUS & VALIDATION HELPERS
// ============================================
function isOrderPendingApproval(ord) {
    if (!ord) return false;
    const oStat = (ord.orderStatus || '').toLowerCase().trim();
    const dStat = (ord.deliveryStatus || '').toLowerCase().trim();
    const oType = (ord.orderType || '').toLowerCase().trim();

    // 1. Explicitly finalized statuses (approved, rejected, cancelled, returned)
    if (oStat === 'approved' || oStat === 'rejected' || oStat === 'cancelled' || oStat === 'returned') {
        return false;
    }

    // 2. Already dispatched on van or delivered to customer
    if (dStat === 'delivered' || dStat === 'dispatched' || dStat === 'returned') {
        return false;
    }

    // 3. Direct POS / Counter invoices are pre-approved sales, never pending approval
    if (oType === 'direct_bill' || oType === 'counter_sale' || ord.isCounterSale || ord.isDirectBill) {
        return false;
    }

    // 4. Explicit pending approval flags
    if (oStat === 'pending_approval' || oStat === 'pending' || oStat === 'pending approval' || oStat === 'waiting') {
        return true;
    }

    // 5. Field booker orders awaiting admin action
    if (oType === 'field_order' || ord.bookerId || (ord.bookerName && ord.bookerName.toLowerCase() !== 'counter' && ord.bookerName.toLowerCase() !== 'staff')) {
        if (!oStat || oStat === 'pending') {
            return true;
        }
    }

    return false;
}

function sanitizeOrder(ord) {
    if (!ord) return ord;
    const dStat = (ord.deliveryStatus || '').toLowerCase().trim();
    const oStat = (ord.orderStatus || '').toLowerCase().trim();
    const oType = (ord.orderType || '').toLowerCase().trim();

    // If delivered or dispatched, ensure orderStatus is marked approved
    if (dStat === 'delivered' || dStat === 'dispatched') {
        ord.orderStatus = 'approved';
    } 
    // Direct bills/counter sales are approved sales
    else if (oType === 'direct_bill' || oType === 'counter_sale' || ord.isCounterSale || ord.isDirectBill) {
        if (!ord.orderStatus || oStat === 'pending') {
            ord.orderStatus = 'approved';
        }
    } 
    // Normalize legacy 'pending' on field orders to 'pending_approval'
    else if (oStat === 'pending') {
        ord.orderStatus = 'pending_approval';
    }
    return ord;
}

// ============================================
// 🛡️ ROLE & PERMISSION HELPERS (ADMIN vs BOOKER)
// ============================================
function isUserAdmin() {
    if (!myUser) return false;
    const r = (myUser.role || '').toLowerCase();
    return r === 'super-admin' || r === 'owner' || r === 'admin';
}

function isUserBooker() {
    if (!myUser) return false;
    return (myUser.role || '').toLowerCase() === 'booker';
}

function canUserApproveOrders() {
    // 1. Super-Admin, Owner, Admin can ALWAYS approve orders
    if (isUserAdmin()) return true;

    // 2. If Booker: only allowed if Admin explicitly granted permission
    if (isUserBooker()) {
        const userPerms = myUser?.permissions || {};
        if (userPerms.approve_orders === true) return true;
        if (myAgency && (myAgency.allowBookerApprove === true || myAgency.bookerApprovalPolicy === 'allow_bookers')) return true;
        return false;
    }

    return false;
}

function setupRoleBasedUI() {
    const isBooker = isUserBooker();
    const canApprove = canUserApproveOrders();

    const bannerNotAllowed = document.getElementById('bookerPermBanner');
    const bannerAllowed = document.getElementById('bookerPermBannerAllowed');
    const advanceSettingsBtn = document.getElementById('btnOpenAdvanceSettings');
    const headerTitle = document.getElementById('agencyNameHeader');

    if (isBooker) {
        if (canApprove) {
            if (bannerAllowed) bannerAllowed.style.display = 'flex';
            if (bannerNotAllowed) bannerNotAllowed.style.display = 'none';
        } else {
            if (bannerNotAllowed) bannerNotAllowed.style.display = 'flex';
            if (bannerAllowed) bannerAllowed.style.display = 'none';
        }

        if (advanceSettingsBtn) advanceSettingsBtn.style.display = 'none';

        if (headerTitle) {
            headerTitle.innerHTML = `📋 My Field Orders &amp; Tracking <span style="font-size:11.5px; font-weight:normal; color:#64748b;">(${myUser.name || 'Order Booker'})</span>`;
        }

        // Booker automatically defaults to their own orders
        if (myUid) activeBookerFilter = myUid;
    } else {
        if (bannerNotAllowed) bannerNotAllowed.style.display = 'none';
        if (bannerAllowed) bannerAllowed.style.display = 'none';
        if (advanceSettingsBtn) advanceSettingsBtn.style.display = 'inline-flex';
    }
}

// ============================================
// 🛡️ AUTH GUARD & SMART INITIALIZATION
// ============================================
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }
    myUid = user.uid;

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            window.location.href = 'dashboard.html';
            return;
        }
        myUser = userDoc.data();

        if (myUser.status === 'blocked' || myUser.status === 'deleted') {
            await auth.signOut();
            window.location.href = 'auth.html';
            return;
        }

        myAgencyId = myUser.agencyId;
        if (!myAgencyId) {
            if (myUser.role === 'super-admin') {
                myAgencyId = 'super-admin-hq';
            } else {
                Swal.fire('⚠️', 'Agency link nahi hai! Profile se complete karein.', 'warning')
                    .then(() => window.location.href = 'profile.html');
                return;
            }
        }

        // Fetch Agency Info
        try {
            const agDoc = await db.collection('agencies').doc(myAgencyId).get();
            if (agDoc.exists) {
                myAgency = agDoc.data();
                const headEl = document.getElementById('agencyNameHeader');
                if (headEl && myAgency.name) {
                    headEl.innerText = `🏢 ${myAgency.name} | Field Booking Operations`;
                }
            }
        } catch (e) {
            console.warn('Agency load:', e);
        }

        // Setup Role-based View & Permissions
        setupRoleBasedUI();

        // ⚡ INSTANT LOCAL CACHE LOAD (Eliminates 0 0 0 delay instantly)
        const hasCachedOrders = loadFromCache();

        // Setup UI handlers
        setupFilters();
        setupModals();
        initBookerShiftUI();

        // Load data concurrently
        await Promise.all([
            loadStaff(),
            loadStock(),
            loadCustomers(),
            loadOrders()
        ]);

        // Start live order listener
        listenForLiveOrders();
        setTimeout(() => { isLiveSyncActive = true; }, 1500);

        // Ensure loader is closed once all fresh data is ready
        if (window.hideNHLoader) {
            window.hideNHLoader();
        }

    } catch (err) {
        console.error('Booker orders hub init error:', err);
        if (window.hideNHLoader) window.hideNHLoader();
        Swal.fire('Error', 'Initialization failed: ' + err.message, 'error');
    }
});

// ============================================
// ⚡ 2-SHIFT CLOUD SYNC & OFFLINE QUEUE (BOOKER)
// ============================================
function initBookerShiftUI() {
    if (!window.CloudSync) return;
    const shiftNameEl = document.getElementById('bookerShiftName');
    const statusTextEl = document.getElementById('bookerShiftStatusText');
    const netStatusEl = document.getElementById('bookerNetStatus');
    const pendingCountEl = document.getElementById('bookerPendingCount');
    const quickSyncBtn = document.getElementById('btnBookerQuickSync');
    const uploadOrdersBtn = document.getElementById('btnBookerUploadOrders');

    function getPendingOfflineOrders() {
        try {
            const raw = localStorage.getItem(`eb_offline_orders_${myAgencyId}`);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function update() {
        const status = window.CloudSync.getSyncStatus(myAgencyId);
        if (shiftNameEl) shiftNameEl.innerText = status.pkt.shiftTitle;
        if (statusTextEl) {
            if (status.isShiftSynced) {
                statusTextEl.style.color = '#34d399';
                statusTextEl.innerText = '✅ 1 of 1 Refresh Used (Cached)';
            } else {
                statusTextEl.style.color = '#38bdf8';
                statusTextEl.innerText = '⚡ 1 Refresh Available';
            }
        }
        if (netStatusEl) {
            const isOnline = navigator.onLine;
            netStatusEl.innerText = isOnline ? 'Network: Online' : 'Network: Offline';
            netStatusEl.style.color = isOnline ? '#34d399' : '#f87171';
        }
        if (pendingCountEl) {
            const count = getPendingOfflineOrders().length;
            pendingCountEl.innerText = count;
            if (count > 0 && uploadOrdersBtn) {
                uploadOrdersBtn.style.animation = 'pulse-glow 2s infinite';
            } else if (uploadOrdersBtn) {
                uploadOrdersBtn.style.animation = 'none';
            }
        }
    }
    update();

    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    // 🔄 1. Refresh Catalog Button (Strict 1-per-shift limit + offline guard)
    if (quickSyncBtn) {
        quickSyncBtn.addEventListener('click', async () => {
            // Check offline
            if (!navigator.onLine) {
                Swal.fire({
                    icon: 'warning',
                    title: 'You Are Offline',
                    text: 'Internet connection required. Please connect to the internet first to refresh catalog.',
                    confirmButtonColor: '#0284c7'
                });
                return;
            }

            // Check shift limit
            const status = window.CloudSync.getSyncStatus(myAgencyId);
            if (status.isShiftSynced) {
                Swal.fire({
                    icon: 'info',
                    title: 'Shift Refresh Limit Reached',
                    html: `
                        <div style="font-size:13px; color:#334155; line-height:1.6; text-align:left;">
                            <p style="margin:0 0 10px 0;">
                                <b>You have already refreshed catalog data for this shift:</b><br>
                                <span style="color:#0284c7; font-weight:700;">${status.pkt.shiftTitle}</span>
                            </p>
                            <div style="background:#f1f5f9; border-left:4px solid #0284c7; padding:10px 12px; border-radius:4px; margin-bottom:12px;">
                                Only <b>1 refresh</b> is permitted per shift.<br>
                                Next refresh unlocks in: <b style="color:#0f172a;">${status.pkt.nextShiftIn}</b>
                            </div>
                            <span style="font-size:12px; color:#64748b;">
                                You can continue taking orders offline or online using the loaded catalog.
                            </span>
                        </div>
                    `,
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#0284c7'
                });
                return;
            }

            quickSyncBtn.disabled = true;
            const originalHtml = quickSyncBtn.innerHTML;
            quickSyncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            try {
                await window.CloudSync.syncShiftData(myAgencyId, { db, silent: false });
                await Promise.all([loadStock(), loadCustomers()]);
                update();
            } finally {
                quickSyncBtn.disabled = false;
                quickSyncBtn.innerHTML = originalHtml;
            }
        });
    }

    // 📤 2. Upload Pending Offline Orders to Cloud
    if (uploadOrdersBtn) {
        uploadOrdersBtn.addEventListener('click', async () => {
            if (!navigator.onLine) {
                Swal.fire({
                    icon: 'warning',
                    title: 'You Are Offline',
                    text: 'Internet connection required. Please connect to the internet first to upload pending field orders.',
                    confirmButtonColor: '#0284c7'
                });
                return;
            }

            const pending = getPendingOfflineOrders();
            if (pending.length === 0) {
                Swal.fire({
                    icon: 'info',
                    title: 'No Pending Orders',
                    text: 'All field orders have already been synced to the cloud.',
                    confirmButtonColor: '#10b981'
                });
                return;
            }

            uploadOrdersBtn.disabled = true;
            const originalHtml = uploadOrdersBtn.innerHTML;
            uploadOrdersBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

            try {
                let successCount = 0;
                for (const ord of pending) {
                    const docId = ord.id || ord.billNo || ('ORD-' + Date.now());
                    ord.isOffline = false;
                    ord.uploadedAt = new Date().toISOString();
                    await db.collection('orders').doc(docId).set(ord);
                    await db.collection('bills').doc(docId).set(ord).catch(() => {});
                    successCount++;
                }

                // Clear queue
                localStorage.removeItem(`eb_offline_orders_${myAgencyId}`);
                update();
                await loadOrders();

                Swal.fire({
                    icon: 'success',
                    title: 'Orders Uploaded!',
                    text: `Successfully uploaded ${successCount} field order(s) to the agency database.`,
                    confirmButtonColor: '#10b981'
                });
            } catch (err) {
                console.error('Error uploading orders:', err);
                Swal.fire('Upload Error', 'Failed to upload some orders: ' + err.message, 'error');
            } finally {
                uploadOrdersBtn.disabled = false;
                uploadOrdersBtn.innerHTML = originalHtml;
            }
        });
    }
}

// ============================================
// 👥 LOAD STAFF (Bookers & Delivery Suppliers)
// ============================================
async function loadStaff() {
    try {
        const snap = await db.collection('users')
            .where('agencyId', '==', myAgencyId)
            .get();

        allStaff = [];
        snap.forEach(d => {
            const data = d.data();
            data.id = d.id;
            allStaff.push(data);
        });

        // Populate Delivery Suppliers dropdown in Bulk Action bar
        const bulkSel = document.getElementById('bulkSupplierSelect');
        if (bulkSel) {
            bulkSel.innerHTML = '<option value="">— Select Delivery Supplier —</option>';
            const suppliers = allStaff.filter(s => s.role === 'supplier' || s.role === 'driver' || s.role === 'delivery');
            suppliers.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = `🚚 ${s.name || s.email} (${s.route || 'General Depot Area'})`;
                bulkSel.appendChild(opt);
            });
            // Always provide Depot Van option for testing & internal dispatch
            const depotOpt = document.createElement('option');
            depotOpt.value = 'self';
            depotOpt.textContent = '🚚 Self / Agency Depot Van (ایجنسی گاڑی)';
            bulkSel.appendChild(depotOpt);
        }

        // Populate Booker Filter Select dropdown
        const bookerSel = document.getElementById('filterBookerSelect');
        if (bookerSel) {
            bookerSel.innerHTML = '<option value="all">👥 All Order Bookers</option>';
            const bookers = allStaff.filter(s => s.role === 'booker');
            bookers.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = `👤 ${b.name || b.email.split('@')[0]}`;
                bookerSel.appendChild(opt);
            });
        }

        renderBookerRibbon();
    } catch (e) {
        console.error('Load staff error:', e);
    }
}

// ============================================
// 📦 LOAD STOCK & CUSTOMERS
// ============================================
async function loadStock() {
    try {
        const snap = await db.collection('stock').where('agencyId', '==', myAgencyId).get();
        allStock = [];
        snap.forEach(d => {
            const data = d.data();
            data.id = d.id;
            allStock.push(data);
        });
    } catch (e) {
        console.error('Load stock error:', e);
    }
}

async function loadCustomers() {
    try {
        const snap = await db.collection('customers').where('agencyId', '==', myAgencyId).get();
        allCustomers = [];
        snap.forEach(d => {
            const data = d.data();
            data.id = d.id;
            allCustomers.push(data);
        });
    } catch (e) {
        console.error('Load customers error:', e);
    }
}

// ============================================
// ⚡ INSTANT LOCAL CACHING ENGINE FOR ORDERS
// ============================================
function loadFromCache() {
    try {
        const agKey = myAgencyId || localStorage.getItem('eb_active_agencyId') || 'default_agency';
        const raw = localStorage.getItem(`eb_cache_orders_${agKey}`);
        if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list) && list.length > 0) {
                allOrders = list.map(sanitizeOrder);
                renderKPIRibbon();
                renderBookerRibbon();
                renderOrdersTable();
                if (window.hideNHLoader) {
                    setTimeout(() => { window.hideNHLoader(); }, 150);
                }
                return true;
            }
        }
    } catch (e) {
        console.warn('Orders cache read error:', e);
    }
    return false;
}

function saveToCache() {
    try {
        const agKey = myAgencyId || localStorage.getItem('eb_active_agencyId') || 'default_agency';
        if (agKey && Array.isArray(allOrders)) {
            localStorage.setItem(`eb_cache_orders_${agKey}`, JSON.stringify(allOrders.slice(0, 300)));
        }
    } catch (e) {}
}

// ============================================
// 📋 LOAD ORDERS & REAL-TIME LISTENER
// ============================================
async function loadOrders() {
    try {
        let snap;
        try {
            snap = await db.collection('bills')
                .where('agencyId', '==', myAgencyId)
                .orderBy('createdAt', 'desc')
                .limit(200)
                .get();
        } catch (eIndex) {
            snap = await db.collection('bills').where('agencyId', '==', myAgencyId).get();
        }

        allOrders = [];
        snap.forEach(d => {
            const data = d.data();
            data.id = d.id;
            allOrders.push(sanitizeOrder(data));
        });

        // 🔄 Inspect 'orders' collection (non-blocking sync)
        try {
            const snapOrders = await db.collection('orders')
                .where('agencyId', '==', myAgencyId)
                .get();

            for (const d of snapOrders.docs) {
                const oData = d.data();
                const alreadyInBills = allOrders.some(x => 
                    x.id === d.id || 
                    (x.orderNo && (x.orderNo === oData.orderNo || x.orderNo === oData.billNo)) || 
                    (x.billNo && (x.billNo === oData.billNo || x.billNo === oData.orderNo))
                );

                if (!alreadyInBills) {
                    const fallbackStatus = (oData.deliveryStatus === 'delivered' || oData.deliveryStatus === 'dispatched') ? 'approved' : 'pending_approval';
                    const billDocData = {
                        ...oData,
                        billNo: oData.billNo || oData.orderNo || ('ORD-' + Math.floor(1000 + Math.random() * 9000)),
                        orderNo: oData.orderNo || oData.billNo,
                        orderStatus: oData.orderStatus || fallbackStatus,
                        orderType: oData.orderType || 'field_order',
                        deliveryStatus: oData.deliveryStatus || 'pending'
                    };
                    // Write to bills asynchronously in background without blocking rendering
                    try {
                        db.collection('bills').doc(d.id).set(billDocData).catch(() => {});
                    } catch (eSave) {}
                    billDocData.id = d.id;
                    allOrders.push(sanitizeOrder(billDocData));
                }
            }
        } catch (eOrd) {
            console.warn('Orders sync in booker hub:', eOrd);
        }

        allOrders.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        // Save fresh orders to instant cache
        saveToCache();

        // If user is a Booker: default to only showing their own orders
        if (myUser && myUser.role === 'booker') {
            activeBookerFilter = myUid;
            const bookerSel = document.getElementById('filterBookerSelect');
            if (bookerSel) {
                bookerSel.value = myUid;
                bookerSel.disabled = true; // Lock booker to their own view
            }
        }

        renderKPIRibbon();
        renderBookerRibbon();
        renderOrdersTable();

        if (window.hideNHLoader) {
            window.hideNHLoader();
        }

    } catch (e) {
        console.error('Load orders error:', e);
        try {
            const snap = await db.collection('bills').where('agencyId', '==', myAgencyId).get();
            allOrders = [];
            snap.forEach(d => {
                const data = d.data();
                data.id = d.id;
                allOrders.push(sanitizeOrder(data));
            });
            allOrders.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            renderKPIRibbon();
            renderBookerRibbon();
            renderOrdersTable();
        } catch (err2) {
            console.error('Fallback orders load error:', err2);
        } finally {
            if (window.hideNHLoader) {
                window.hideNHLoader();
            }
        }
    }
}

function listenForLiveOrders() {
    if (!myAgencyId) return;

    // 1. Live listener on bills
    db.collection('bills')
        .where('agencyId', '==', myAgencyId)
        .onSnapshot(snap => {
            let changed = false;
            snap.docChanges().forEach(change => {
                const data = sanitizeOrder(change.doc.data());
                data.id = change.doc.id;

                if (change.type === 'added') {
                    if (!allOrders.some(o => o.id === data.id)) {
                        allOrders.unshift(data);
                        changed = true;
                        if (isLiveSyncActive) {
                            playNewOrderChime();
                            Swal.fire({
                                toast: true,
                                position: 'top-end',
                                timer: 4000,
                                icon: 'info',
                                title: `🔔 نیا فیلڈ آرڈر موصول ہوا: ${data.customerShop || data.customerName || 'Customer'} (Rs ${Math.round(data.billAmount || data.grandTotal || 0)})`
                            });
                        }
                    }
                } else if (change.type === 'modified') {
                    const idx = allOrders.findIndex(o => o.id === data.id);
                    if (idx !== -1) {
                        allOrders[idx] = data;
                        changed = true;
                    }
                } else if (change.type === 'removed') {
                    const idx = allOrders.findIndex(o => o.id === change.doc.id);
                    if (idx !== -1) {
                        allOrders.splice(idx, 1);
                        changed = true;
                    }
                }
            });

            if (changed) {
                allOrders.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
                renderKPIRibbon();
                renderBookerRibbon();
                renderOrdersTable();
            }
        }, err => console.warn('Live bills listener warning:', err));

    // 2. Live listener on orders collection
    try {
        db.collection('orders')
            .where('agencyId', '==', myAgencyId)
            .onSnapshot(snap => {
                let changed = false;
                snap.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const data = sanitizeOrder(change.doc.data());
                        data.id = change.doc.id;
                        if (!allOrders.some(o => o.id === data.id || (o.orderNo && o.orderNo === data.orderNo))) {
                            if (!data.billNo && data.orderNo) data.billNo = data.orderNo;
                            db.collection('bills').doc(data.id).set(data).catch(() => {});
                            allOrders.unshift(data);
                            changed = true;
                        }
                    }
                });

                if (changed) {
                    allOrders.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
                    renderKPIRibbon();
                    renderBookerRibbon();
                    renderOrdersTable();
                }
            }, () => {});
    } catch (eOrd) {}
}

// ============================================
// 📊 KPI DASHBOARD CALCULATIONS
// ============================================
function renderKPIRibbon() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayPkStr = new Date().toLocaleDateString('en-PK');

    const totalOrders = allOrders.length;
    let totalUnits = 0;
    let todayOrders = 0;
    let todayValue = 0;
    let pendingApproval = 0;
    let pendingApprovalValue = 0;
    let approved = 0;
    let approvedValue = 0;
    let pendingPrint = 0;
    let dispatched = 0;
    let delivered = 0;
    let totalValue = 0;

    allOrders.forEach(ord => {
        const dStat = ord.deliveryStatus || 'pending';
        const isPending = isOrderPendingApproval(ord);
        const amt = parseFloat(ord.billAmount || ord.grandTotal || 0) || 0;
        totalValue += amt;

        const isToday = (ord.date === todayPkStr) || (ord.createdAt && ord.createdAt.startsWith(todayStr));
        if (isToday) {
            todayOrders++;
            todayValue += amt;
        }

        if (isPending) {
            pendingApproval++;
            pendingApprovalValue += amt;
        } else if (ord.orderStatus === 'approved') {
            approved++;
            approvedValue += amt;
            if (dStat === 'pending') {
                pendingPrint++;
            }
        }

        if (dStat === 'dispatched') dispatched++;
        if (dStat === 'delivered') delivered++;

        if (Array.isArray(ord.items)) {
            ord.items.forEach(it => { totalUnits += (parseFloat(it.qty) || 0); });
        } else {
            totalUnits += (parseFloat(ord.totalUnits) || 0);
        }
    });

    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setTxt('kpiTotalOrders', totalOrders);
    setTxt('kpiTotalUnitsSub', `${Math.round(totalUnits).toLocaleString()} Total Units`);
    setTxt('kpiTodayOrders', todayOrders);
    setTxt('kpiTodayValueSub', `Rs ${Math.round(todayValue).toLocaleString()} Today`);
    setTxt('kpiPendingApproval', pendingApproval);
    setTxt('kpiPendingValueSub', `Rs ${Math.round(pendingApprovalValue).toLocaleString()} (${pendingApproval} Needs Action)`);
    setTxt('kpiApproved', approved);
    setTxt('kpiApprovedValueSub', `Rs ${Math.round(approvedValue).toLocaleString()} (Ready for Van)`);
    setTxt('kpiPendingPrint', pendingPrint || approved);
    setTxt('kpiPendingPrintSub', `${pendingPrint || approved} Bills to Print`);
    setTxt('btnPendingPrintCount', pendingApproval);
    setTxt('kpiDispatched', dispatched);
    setTxt('kpiDelivered', delivered);
    setTxt('kpiTotalValue', `Rs ${Math.round(totalValue).toLocaleString()}`);

    // Update Chips Counter
    const rejectedCount = allOrders.filter(o => o.orderStatus === 'rejected').length;
    setTxt('chipAllCount', totalOrders);
    setTxt('chipPendingCount', pendingApproval);
    setTxt('chipApprovedCount', approved);
    setTxt('chipDispatchedCount', dispatched);
    setTxt('chipDeliveredCount', delivered);
    setTxt('chipRejectedCount', rejectedCount);
}

window.filterByPendingApproval = function() {
    activeFilter = 'pending_approval';
    document.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.status === 'pending_approval');
    });

    // Ensure pending orders are not hidden by date or booker filters
    const hasPendingOrders = allOrders.some(o => isOrderPendingApproval(o));
    if (hasPendingOrders) {
        if (activeDateFilter !== 'all') {
            activeDateFilter = 'all';
            document.querySelectorAll('.filter-date-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.date === 'all');
            });
        }
        if (activeBookerFilter !== 'all' && (!myUser || myUser.role !== 'booker')) {
            const matchesCurrentBooker = allOrders.some(o => 
                isOrderPendingApproval(o) && (o.bookerId === activeBookerFilter || o.createdBy === activeBookerFilter)
            );
            if (!matchesCurrentBooker) {
                activeBookerFilter = 'all';
                const bSel = document.getElementById('filterBookerSelect');
                if (bSel) bSel.value = 'all';
                renderBookerRibbon();
            }
        }
    }

    renderOrdersTable();
};

window.filterByApproved = function() {
    activeFilter = 'approved';
    document.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.status === 'approved');
    });
    renderOrdersTable();
};

window.filterByPendingPrint = function() {
    activeFilter = 'approved';
    document.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.status === 'approved');
    });
    renderOrdersTable();
};

// ============================================
// 👥 ORDER BOOKERS INFORMATION & PERFORMANCE RIBBON
// ============================================
function renderBookerRibbon() {
    const container = document.getElementById('bookersListRibbon');
    const countEl = document.getElementById('bookerActiveCountText');
    if (!container) return;

    const bookers = allStaff.filter(s => s.role === 'booker');
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayPkStr = new Date().toLocaleDateString('en-PK');

    const totalTodayBooking = allOrders
        .filter(o => (o.date === todayPkStr) || (o.createdAt && o.createdAt.startsWith(todayStr)))
        .reduce((sum, o) => sum + (parseFloat(o.billAmount || o.grandTotal) || 0), 0);

    if (countEl) {
        countEl.innerText = `${bookers.length} Registered Bookers | Today's Field Booking: Rs ${Math.round(totalTodayBooking).toLocaleString()}`;
    }

    if (bookers.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:15px; color:#94a3b8; font-size:13px;">
            کوئی آرڈر بکر رجسٹرڈ نہیں ہے۔ ایڈمن مینو سے اسٹاف میں آرڈر بکر شامل کریں۔
        </div>`;
        return;
    }

    container.innerHTML = bookers.map(b => {
        const bOrders = allOrders.filter(o => o.bookerId === b.id || o.createdBy === b.id || (o.bookerName && o.bookerName.toLowerCase() === (b.name || '').toLowerCase()));
        const todayOrders = bOrders.filter(o => (o.date === todayPkStr) || (o.createdAt && o.createdAt.startsWith(todayStr)));
        const todayAmt = todayOrders.reduce((sum, o) => sum + (parseFloat(o.billAmount || o.grandTotal) || 0), 0);
        const pendingCount = bOrders.filter(o => isOrderPendingApproval(o)).length;
        const approvedCount = bOrders.filter(o => o.orderStatus === 'approved').length;
        const totalAmount = bOrders.reduce((sum, o) => sum + (parseFloat(o.billAmount || o.grandTotal) || 0), 0);

        // Performance Level based on volume
        let levelBadge = '⭐ Level 1 (Starter)';
        let levelColor = '#64748b';
        if (bOrders.length >= 50) {
            levelBadge = '👑 Diamond Pro (50+ Orders)';
            levelColor = '#8b5cf6';
        } else if (bOrders.length >= 25) {
            levelBadge = '🏆 Gold Star (25+ Orders)';
            levelColor = '#eab308';
        } else if (bOrders.length >= 10) {
            levelBadge = '🥈 Silver Booker (10+ Orders)';
            levelColor = '#0284c7';
        }

        const isSelected = activeBookerFilter === b.id;
        const bMobile = b.mobile || b.phone || '';

        return `
            <div class="booker-card ${isSelected ? 'active' : ''}" onclick="selectBookerFilter('${b.id}')">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:42px; height:42px; border-radius:50%; background:#e0f2fe; color:#0284c7; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:bold; flex-shrink:0;">
                        👤
                    </div>
                    <div>
                        <div style="font-weight:800; font-size:14px; color:#0f172a; display:flex; align-items:center; gap:6px;">
                            <span>${b.name || b.email.split('@')[0]}</span>
                            ${bMobile ? `
                                <a href="https://wa.me/${bMobile.replace(/\D/g, '')}" target="_blank" onclick="event.stopPropagation();" title="Chat on WhatsApp" style="color:#25d366; font-size:13px; text-decoration:none;">
                                    <i class="fab fa-whatsapp"></i>
                                </a>
                            ` : ''}
                        </div>
                        <div style="font-size:11px; font-weight:700; color:${levelColor};">${levelBadge} ${b.route ? `| 🛣️ ${b.route}` : ''}</div>
                        <div style="font-size:11px; color:#64748b; margin-top:2px;">
                            Today: <b>${todayOrders.length}</b> (Rs ${Math.round(todayAmt).toLocaleString()}) | Pending: <b style="color:#d97706;">${pendingCount}</b> | Approved: <b style="color:#10b981;">${approvedCount}</b>
                        </div>
                    </div>
                </div>
                <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                    <div style="font-size:15px; font-weight:900; color:#10b981;">Rs ${Math.round(totalAmount).toLocaleString()}</div>
                    <div style="display:flex; gap:4px; align-items:center;">
                        <button type="button" class="btn btn-sm" onclick="event.stopPropagation(); printBookerDailySheet('${b.id}')" style="background:#e0f2fe; color:#0369a1; border:none; padding:3px 7px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer;" title="Print Booker Daily Sheet">
                            <i class="fas fa-print"></i> روزانہ شیٹ
                        </button>
                        <span style="font-size:10px; font-weight:800; padding:2px 7px; border-radius:10px; background:${isSelected ? '#0284c7' : '#f1f5f9'}; color:${isSelected ? '#fff' : '#475569'};">
                            ${isSelected ? 'Filtered' : 'Filter'}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.selectBookerFilter = function(bookerId) {
    if (activeBookerFilter === bookerId) {
        activeBookerFilter = 'all';
    } else {
        activeBookerFilter = bookerId;
    }
    const sel = document.getElementById('filterBookerSelect');
    if (sel) sel.value = activeBookerFilter;
    renderBookerRibbon();
    renderOrdersTable();
};

// ============================================
// 🔍 FILTERS & DATE SELECTOR
// ============================================
function setupFilters() {
    // Status Chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            activeFilter = this.dataset.status;
            if (activeFilter === 'pending_approval') {
                filterByPendingApproval();
                return;
            }
            renderOrdersTable();
        });
    });

    // Date Presets
    document.querySelectorAll('.filter-date-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-date-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            activeDateFilter = this.dataset.date;
            renderOrdersTable();
        });
    });

    // Custom Date Range
    const btnCustomDate = document.getElementById('btnApplyCustomDate');
    if (btnCustomDate) {
        btnCustomDate.addEventListener('click', () => {
            const from = document.getElementById('filterFromDate')?.value;
            const to = document.getElementById('filterToDate')?.value;
            if (!from && !to) {
                Swal.fire('توجہ', 'براہ کرم کوئی تاریخ منتخب کریں!', 'info');
                return;
            }
            document.querySelectorAll('.filter-date-btn').forEach(b => b.classList.remove('active'));
            activeDateFilter = 'custom';
            renderOrdersTable();
        });
    }

    // Booker Select
    const bSel = document.getElementById('filterBookerSelect');
    if (bSel) {
        bSel.addEventListener('change', function() {
            activeBookerFilter = this.value;
            renderBookerRibbon();
            renderOrdersTable();
        });
    }

    // Search Input
    const sInput = document.getElementById('orderSearchInput');
    if (sInput) {
        sInput.addEventListener('input', () => renderOrdersTable());
    }

    // Refresh Button
    const refBtn = document.getElementById('btnRefreshOrders');
    if (refBtn) {
        refBtn.addEventListener('click', async () => {
            refBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            await loadOrders();
            refBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            Swal.fire({ toast: true, position: 'top-end', timer: 1500, icon: 'success', title: 'Orders synchronized!' });
        });
    }
}

// ============================================
// 📋 RENDER ORDERS TABLE
// ============================================
function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    const query = (document.getElementById('orderSearchInput')?.value || '').toLowerCase().trim();
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    const filtered = allOrders.filter(ord => {
        // 1. Status Filter
        const dStat = ord.deliveryStatus || 'pending';
        const isPending = isOrderPendingApproval(ord);

        if (activeFilter === 'pending_approval') {
            if (!isPending) return false;
        } else if (activeFilter === 'approved') {
            if (ord.orderStatus !== 'approved' || dStat !== 'pending') return false;
        } else if (activeFilter === 'rejected') {
            if (ord.orderStatus !== 'rejected') return false;
        } else if (activeFilter === 'dispatched') {
            if (dStat !== 'dispatched') return false;
        } else if (activeFilter === 'delivered') {
            if (dStat !== 'delivered') return false;
        } else if (activeFilter !== 'all' && dStat !== activeFilter) {
            return false;
        }

        // 2. Booker Filter
        if (activeBookerFilter !== 'all') {
            const matchesId = ord.bookerId === activeBookerFilter || ord.createdBy === activeBookerFilter;
            const staffObj = allStaff.find(s => s.id === activeBookerFilter);
            const matchesName = staffObj && ord.bookerName && ord.bookerName.toLowerCase() === (staffObj.name || '').toLowerCase();
            if (!matchesId && !matchesName) return false;
        }

        // 3. Date Preset Filter
        if (activeDateFilter !== 'all') {
            const orderDateStr = ord.createdAt ? ord.createdAt.slice(0, 10) : '';
            if (activeDateFilter === 'today') {
                if (orderDateStr !== todayStr && ord.date !== new Date().toLocaleDateString('en-PK')) return false;
            } else if (activeDateFilter === 'yesterday') {
                if (orderDateStr !== yesterdayStr) return false;
            } else if (activeDateFilter === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                if (new Date(ord.createdAt || ord.timestamp || 0) < weekAgo) return false;
            } else if (activeDateFilter === 'month') {
                const monthAgo = new Date();
                monthAgo.setDate(monthAgo.getDate() - 30);
                if (new Date(ord.createdAt || ord.timestamp || 0) < monthAgo) return false;
            } else if (activeDateFilter === 'custom') {
                const fromVal = document.getElementById('filterFromDate')?.value;
                const toVal = document.getElementById('filterToDate')?.value;
                if (fromVal && orderDateStr < fromVal) return false;
                if (toVal && orderDateStr > toVal) return false;
            }
        }

        // 4. Search Query Filter
        if (query) {
            const billNo = (ord.billNo || ord.orderNo || '').toLowerCase();
            const cust = (ord.customerName || '').toLowerCase();
            const shop = (ord.customerShop || '').toLowerCase();
            const booker = (ord.bookerName || '').toLowerCase();
            const route = (ord.customerRoute || '').toLowerCase();
            const mobile = (ord.customerMobile || '').toLowerCase();
            if (!billNo.includes(query) && !cust.includes(query) && !shop.includes(query) && !booker.includes(query) && !route.includes(query) && !mobile.includes(query)) {
                return false;
            }
        }

        return true;
    });

    const sumLabel = document.getElementById('tableSummaryLabel');
    if (sumLabel) {
        sumLabel.innerHTML = `📦 Showing <b>${filtered.length}</b> Field Orders (${activeFilter.replace('_', ' ').toUpperCase()})`;
    }

    if (filtered.length === 0) {
        let emptyMsg = 'کوئی فیلڈ آرڈر نہیں ملا۔ اوپر سے فلٹر یا تلاش تبدیل کریں۔';
        if (activeFilter === 'pending_approval') {
            emptyMsg = '🎉 اس وقت منظوری کے لیے کوئی نیا آرڈر پینڈنگ نہیں ہے (تمام آرڈرز مکمل اور منظور شدہ ہیں)!';
        }
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:35px; color:#94a3b8; font-size:14px;">
            <i class="fas fa-inbox" style="font-size:36px; margin-bottom:10px; display:block; color:#cbd5e1;"></i>
            ${emptyMsg}
        </td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(ord => {
        const dStat = ord.deliveryStatus || 'pending';
        const isPendingApproval = isOrderPendingApproval(ord);

        const isBooker = isUserBooker();
        const canApprove = canUserApproveOrders();

        let badgeClass = 'badge-pending';
        let badgeText = '⏳ Pending Dispatch';
        let badgeStyle = '';

        if (isPendingApproval) {
            badgeClass = 'badge-pending';
            badgeText = isBooker 
                ? (canApprove ? '⏳ Pending Approval (Admin Allowed)' : '⏳ Pending Admin Approval (ایڈمن کی منظوری کا انتظار)')
                : '⏳ Pending Approval (منظوری درکار)';
            badgeStyle = 'background:#fef3c7; color:#b45309; border:1.5px solid #fde68a; font-weight:800;';
        } else if (dStat === 'dispatched') {
            badgeClass = 'badge-dispatched';
            badgeText = '🚚 On Delivery Van';
        } else if (dStat === 'delivered') {
            badgeClass = 'badge-delivered';
            badgeText = '✅ Delivered';
        } else if (ord.orderStatus === 'rejected') {
            badgeClass = 'badge-returned';
            badgeText = '❌ Rejected / Cancelled';
            badgeStyle = 'background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;';
        } else if (ord.orderStatus === 'approved') {
            badgeClass = 'badge-delivered';
            badgeText = isBooker 
                ? '✅ Approved by Admin (ایڈمن نے منظور کر لیا)' 
                : '✅ Approved (منظور شدہ)';
            badgeStyle = 'background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; font-weight:bold;';
        }

        const itemsCount = (ord.items && ord.items.length) || ord.itemCount || 0;
        const totalPieces = (ord.items || []).reduce((sum, it) => sum + (it.qty || 0), 0) || ord.totalUnits || itemsCount;
        const totalFree = (ord.items || []).reduce((sum, it) => sum + (it.freeQty || 0), 0) || ord.totalFreeUnits || 0;
        const totalAmount = Math.round(ord.billAmount || ord.grandTotal || 0).toLocaleString();

        const billDisplay = ord.billNo || ord.orderNo || ord.id.slice(0, 8);

        return `
            <tr>
                <td>
                    <input type="checkbox" class="order-check" data-id="${ord.id}" onchange="updateBulkOrdersBar()" ${dStat === 'delivered' ? 'disabled' : ''}>
                </td>
                <td>
                    <b style="font-size:14px; color:#0284c7; cursor:pointer;" onclick="viewOrderDetails('${ord.id}')">${billDisplay}</b><br>
                    <small style="color:#64748b;">${ord.orderType === 'field_order' ? '📱 Field Booker' : '🧾 Counter Sale'}</small>
                </td>
                <td>
                    <b>${ord.date || ord.createdAt?.slice(0,10) || 'Today'}</b><br>
                    <small style="color:#64748b;">${ord.time || ''}</small>
                </td>
                <td>
                    <b>${ord.customerName || 'Counter Sale'}</b> ${ord.customerShop ? `<span style="color:#64748b;">(${ord.customerShop})</span>` : ''}<br>
                    <small style="color:#64748b;">${ord.customerMobile ? `📱 ${ord.customerMobile}` : ''} ${ord.customerRoute ? `| 🛣️ ${ord.customerRoute}` : ''}</small>
                </td>
                <td>
                    <span style="color:#0284c7; font-weight:800;"><i class="fas fa-user-edit"></i> ${ord.bookerName || 'Staff Booker'}</span><br>
                    <small style="color:#94a3b8;">${ord.bookerMobile || ''}</small>
                </td>
                <td>
                    <b>${itemsCount} Items (${totalPieces} Pcs)</b> ${totalFree > 0 ? `<span style="background:#fdf4ff; color:#a21caf; padding:1px 5px; border-radius:6px; font-size:10px; font-weight:bold;">+${totalFree} Free</span>` : ''}<br>
                    <span style="color:#10b981; font-weight:900; font-size:14px;">Rs ${totalAmount}</span>
                </td>
                <td>
                    <span class="badge-status ${badgeClass}" style="${badgeStyle}">${badgeText}</span>
                </td>
                <td>
                    ${ord.supplierName ? `
                        <div style="cursor:pointer;" onclick="openAssignSupplierModal('${ord.id}')" title="Click to change assigned supplier / van">
                            <b style="color:#0284c7;"><i class="fas fa-truck"></i> ${ord.supplierName}</b><br>
                            <span style="font-size:10px; color:#10b981; font-weight:800;">● ${ord.deliveryStatus === 'delivered' ? 'Delivered' : 'Dispatched'}</span>
                        </div>
                    ` : `
                        <button type="button" class="btn btn-sm" onclick="openAssignSupplierModal('${ord.id}')" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:6px; font-size:11px; padding:3px 7px; cursor:pointer;" title="Assign to Delivery Supplier / Van">
                            <i class="fas fa-truck"></i> + Assign Van
                        </button>
                    `}
                </td>
                <td style="text-align:right;">
                    <div style="display:flex; justify-content:flex-end; gap:4px; flex-wrap:wrap;">
                        <!-- Details View -->
                        <button type="button" class="btn btn-sm" onclick="viewOrderDetails('${ord.id}')" style="background:#f1f5f9; color:#475569; border-radius:6px; font-size:11px; padding:4px 8px; font-weight:bold;" title="View Order Details">
                            <i class="fas fa-eye"></i> View
                        </button>

                        <!-- Approval Actions -->
                        ${isPendingApproval ? `
                            ${canApprove ? `
                                <button type="button" class="btn btn-sm" onclick="approveOrder('${ord.id}')" style="background:#10b981; color:#fff; border-radius:6px; font-size:11px; padding:4px 9px; font-weight:bold;" title="Accept, Deduct Stock &amp; Assign">
                                    <i class="fas fa-check"></i> Accept ${isBooker ? '<span style="font-size:9px; opacity:0.9;">(Allowed)</span>' : ''}
                                </button>
                                <button type="button" class="btn btn-sm" onclick="rejectOrder('${ord.id}')" style="background:#ef4444; color:#fff; border-radius:6px; font-size:11px; padding:4px 7px;" title="Reject Order">
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : `
                                <span style="background:#fffbeb; border:1px solid #fde68a; color:#b45309; font-size:10.5px; font-weight:800; padding:3px 7px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;" title="Only Admin can approve field orders (Admin Not Allowed)">
                                    <i class="fas fa-lock" style="color:#d97706;"></i> Admin Not Allowed
                                </span>
                            `}
                        ` : ''}

                        <!-- Print Customer Bill -->
                        ${ord.orderStatus === 'approved' ? `
                            <button type="button" class="btn btn-sm" onclick="printOrderBill('${ord.id}')" style="background:#0284c7; color:#fff; border-radius:6px; font-size:11px; padding:4px 9px; font-weight:bold;" title="Print Official Customer Bill">
                                <i class="fas fa-print"></i> Print
                            </button>
                        ` : ''}

                        <!-- Dispatch on Van if Approved but not yet dispatched -->
                        ${(ord.orderStatus === 'approved' && (!ord.supplierName || ord.deliveryStatus === 'pending')) ? `
                            <button type="button" class="btn btn-sm" onclick="openAssignSupplierModal('${ord.id}')" style="background:#7c3aed; color:#fff; border-radius:6px; font-size:11px; padding:4px 8px; font-weight:bold;" title="Dispatch on Van / Assign Supplier">
                                <i class="fas fa-truck-loading"></i> Dispatch
                            </button>
                        ` : ''}

                        <!-- WhatsApp Share -->
                        ${ord.customerMobile ? `
                            <a href="https://wa.me/${ord.customerMobile.replace(/\D/g, '')}" target="_blank" class="btn btn-sm" style="background:#25d366; color:#fff; border-radius:6px; font-size:11px; padding:4px 8px;" title="Share on WhatsApp">
                                <i class="fab fa-whatsapp"></i>
                            </a>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateBulkOrdersBar();
}

// ============================================
// 🔢 BILL NUMBER GENERATION HELPER
// ============================================
function getBillPrefix() {
    let p = (myAgency && myAgency.billPrefix) ? String(myAgency.billPrefix).trim() : '';
    return p;
}

function formatBillNo(prefix, num) {
    if (!prefix) return String(num);
    return `${prefix}${num}`;
}

async function getNextLiveBillNo() {
    const prefix = getBillPrefix();
    const counterRef = db.collection('counters').doc(myAgencyId + '_stock');
    try {
        const result = await db.runTransaction(async (tx) => {
            const cDoc = await tx.get(counterRef);
            let nextNum = 1;
            if (cDoc.exists) {
                nextNum = (cDoc.data().lastBillNo || 0) + 1;
            }
            tx.set(counterRef, {
                lastBillNo: nextNum,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            return formatBillNo(prefix, nextNum);
        });
        return result;
    } catch (e) {
        console.warn('Bill counter transaction fallback:', e);
        return formatBillNo(prefix, Date.now().toString().slice(-6));
    }
}

// ============================================
// ✅ APPROVE SINGLE BOOKER ORDER
// ============================================
async function approveOrder(orderId) {
    if (!canUserApproveOrders()) {
        Swal.fire({
            icon: 'warning',
            title: '🔒 Admin Not Allowed (ایڈمن کی منظوری درکار)',
            html: `آپ کو فیلڈ آرڈر منظور کرنے کا اختیار نہیں ہے۔<br>
                   یہ کام صرف ایڈمن کر سکتا ہے جب تک کہ وہ آپ کو اجازت نہ دے۔<br><br>
                   <b style="color:#b45309;">(Status: Admin Not Allowed)</b>`,
            confirmButtonColor: '#0284c7'
        });
        return;
    }

    const ord = allOrders.find(o => o.id === orderId);
    if (!ord) return;

    if (ord.orderStatus === 'approved') {
        Swal.fire('Info', 'یہ آرڈر پہلے سے منظور شدہ ہے!', 'info');
        return;
    }

    const itemsCount = (ord.items && ord.items.length) || ord.itemCount || 0;
    const totalAmount = Math.round(ord.billAmount || ord.grandTotal || 0).toLocaleString();
    const prevBal = Math.round(ord.previousBalance || 0).toLocaleString();

    // Prepare supplier dropdown options
    const suppliers = allStaff.filter(s => s.role === 'supplier' || s.role === 'driver' || s.role === 'delivery');
    let supplierOptions = `<option value="">— بعد میں گاڑی پر بھیجیں (Leave for Batch Dispatch) —</option>`;
    suppliers.forEach(s => {
        supplierOptions += `<option value="${s.id}">🚚 ${s.name || s.email} (${s.route || 'Area'})</option>`;
    });
    supplierOptions += `<option value="self">🚚 Self / Agency Depot Van (ایجنسی گاڑی)</option>`;

    const { value: formValues } = await Swal.fire({
        title: '✅ آرڈر منظور کریں؟ (Order Approval)',
        html: `
            <div style="text-align:left; font-size:13px; line-height:1.7;">
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; margin-bottom:12px;">
                    <div>👤 <b>دکان دار:</b> ${ord.customerName} ${ord.customerShop ? `(${ord.customerShop})` : ''}</div>
                    <div>📕 <b>آرڈر بکر:</b> <span style="color:#0284c7; font-weight:bold;">${ord.bookerName || 'Staff'}</span></div>
                    <div>📦 <b>آئٹمز:</b> ${itemsCount} | <b>نئے مال کی رقم:</b> <span style="color:#10b981; font-weight:900;">Rs ${totalAmount}</span></div>
                    <div>💰 <b>سابقہ کھاتہ بقایا:</b> Rs ${prevBal}</div>
                </div>

                <div style="margin-bottom:6px;">
                    <label style="font-weight:bold; display:block; margin-bottom:4px; color:#334155;">
                        🚚 ڈلیوری سپلائر یا گاڑی منتخب کریں (Optional):
                    </label>
                    <select id="swalApproveSupplier" style="width:100%; height:40px; padding:6px 10px; border-radius:8px; border:1.5px solid #0284c7; font-size:13px; font-weight:bold; background:#fff;">
                        ${supplierOptions}
                    </select>
                    <small style="color:#64748b; font-size:11px;">اگر ابھی سپلائر منتخب کریں گے تو مال خودکار گاڑی پر لوڈ (Dispatched) نشان زد ہو جائے گا۔</small>
                </div>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ہاں، منظور کریں (Approve)',
        cancelButtonText: 'منسوخ (Cancel)',
        confirmButtonColor: '#10b981',
        preConfirm: () => {
            return {
                supplierId: document.getElementById('swalApproveSupplier')?.value || ''
            };
        }
    });

    if (!formValues) return;

    try {
        Swal.fire({
            title: 'منظوری جاری ہے...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const liveBillNo = await getNextLiveBillNo();
        const batch = db.batch();

        // 1. Determine Supplier & Dispatch Status
        const chosenSupplierId = formValues.supplierId;
        let chosenSupplierName = '';
        let isDispatched = false;

        if (chosenSupplierId === 'self') {
            chosenSupplierName = 'Agency Depot Van';
            isDispatched = true;
        } else if (chosenSupplierId) {
            const foundSup = allStaff.find(s => s.id === chosenSupplierId);
            chosenSupplierName = foundSup ? (foundSup.name || foundSup.email) : 'Delivery Van';
            isDispatched = true;
        }

        // 2. Update bill document
        const billRef = db.collection('bills').doc(orderId);
        const updateData = {
            orderStatus: 'approved',
            deliveryStatus: isDispatched ? 'dispatched' : 'pending',
            billNo: liveBillNo,
            approvedAt: new Date().toISOString(),
            approvedBy: myUid
        };

        if (isDispatched) {
            updateData.supplierId = chosenSupplierId;
            updateData.supplierName = chosenSupplierName;
            updateData.dispatchedAt = new Date().toISOString();
        }

        batch.update(billRef, updateData);

        // 3. Deduct inventory stock & record movements
        const movements = [];
        (ord.items || []).forEach(it => {
            if (!it.stockId) return;
            const s = allStock.find(x => x.id === it.stockId);
            const currentQty = s ? (s.qty || 0) : 0;
            const newQty = currentQty - (it.qty || 0);

            batch.update(db.collection('stock').doc(it.stockId), {
                qty: newQty,
                updatedAt: new Date().toISOString()
            });

            movements.push({
                itemName: it.name,
                qty: it.qty,
                beforeQty: currentQty,
                afterQty: newQty
            });

            if (s) s.qty = newQty;
        });

        if (movements.length > 0) {
            const moveRef = db.collection('movements').doc();
            batch.set(moveRef, {
                agencyId: myAgencyId,
                billNo: liveBillNo,
                type: 'out',
                reason: 'sale',
                note: `Field Booker Order Approved (${ord.customerName || 'Customer'})`,
                movements: movements,
                createdAt: new Date().toISOString(),
                createdBy: myUid
            });
        }

        // 4. Update customer Khata balance
        if (ord.customerId) {
            const custRef = db.collection('customers').doc(ord.customerId);
            const cDoc = await custRef.get();
            if (cDoc.exists) {
                const currentBal = parseFloat(cDoc.data().balance) || 0;
                const billAmt = (ord.billAmount !== undefined && ord.billAmount !== null)
                    ? parseFloat(ord.billAmount)
                    : (parseFloat(ord.grandTotal) || 0);
                const recAmt = parseFloat(ord.received) || 0;
                const newBalance = currentBal + (billAmt - recAmt);

                batch.update(custRef, {
                    balance: newBalance,
                    lastBillNo: liveBillNo,
                    lastBillAt: new Date().toISOString()
                });
            }
        }

        await batch.commit();

        // Mirror in orders collection
        try {
            await db.collection('orders').doc(orderId).update(updateData);
        } catch (eOrd) {}

        ord.orderStatus = 'approved';
        ord.billNo = liveBillNo;
        if (isDispatched) {
            ord.supplierId = chosenSupplierId;
            ord.supplierName = chosenSupplierName;
            ord.deliveryStatus = 'dispatched';
        } else {
            ord.deliveryStatus = 'pending';
        }

        renderKPIRibbon();
        renderBookerRibbon();
        renderOrdersTable();

        Swal.fire({
            icon: 'success',
            title: '✅ آرڈر منظور اور اسٹاک کٹ گیا!',
            html: `
                <div style="font-size:14px; text-align:center; line-height:1.7;">
                    نیا بل نمبر: <b style="font-size:22px; color:#0284c7;">${liveBillNo}</b><br>
                    دکان دار: <b>${ord.customerName}</b><br>
                    ${isDispatched ? `ڈلیوری وین: <b style="color:#7c3aed;">🚚 ${chosenSupplierName}</b> پر لوڈ ہو گیا۔` : '<span style="color:#64748b;">(گاڑی لوڈنگ کے لیے تیار ہے)</span>'}
                </div>
            `,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '🖨️ پرنٹ بل (Print Bill)',
            denyButtonText: '🚚 لوڈنگ گیٹ پاس (Gate Pass)',
            cancelButtonText: 'ٹھیک ہے (Done)',
            confirmButtonColor: '#0284c7',
            denyButtonColor: '#7c3aed'
        }).then(res => {
            if (res.isConfirmed) {
                printOrderBill(orderId);
            } else if (res.isDenied) {
                printVanLoadingChallan();
            }
        });

    } catch (e) {
        console.error('Approve order error:', e);
        Swal.fire('❌ Error', 'آرڈر منظور کرنے میں مسئلہ آیا: ' + e.message, 'error');
    }
}

// ============================================
// 🚚 QUICK ASSIGN / CHANGE SUPPLIER MODAL
// ============================================
window.openAssignSupplierModal = async function(orderId) {
    const ord = allOrders.find(o => o.id === orderId);
    if (!ord) return;

    const suppliers = allStaff.filter(s => s.role === 'supplier' || s.role === 'driver' || s.role === 'delivery');
    let supplierOptions = `<option value="">— Select Delivery Supplier / Van —</option>`;
    suppliers.forEach(s => {
        const isSel = ord.supplierId === s.id ? 'selected' : '';
        supplierOptions += `<option value="${s.id}" ${isSel}>🚚 ${s.name || s.email} (${s.route || 'General Area'})</option>`;
    });
    supplierOptions += `<option value="self" ${ord.supplierId === 'self' ? 'selected' : ''}>🚚 Self / Agency Depot Van (ایجنسی گاڑی)</option>`;

    const { value: supplierVal } = await Swal.fire({
        title: '🚚 ڈلیوری سپلائر و وین مقرر کریں',
        html: `
            <div style="text-align:left; font-size:13px; line-height:1.7;">
                <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px 14px; border-radius:10px; margin-bottom:12px;">
                    <div>بل نمبر: <b style="color:#0284c7;">${ord.billNo || ord.orderNo}</b></div>
                    <div>دکان دار: <b>${ord.customerName} ${ord.customerShop ? `(${ord.customerShop})` : ''}</b></div>
                    <div>روٹ: <b>${ord.customerRoute || 'General'}</b></div>
                    <div>موجودہ اسٹیٹس: <b>${ord.supplierName ? `🚚 ${ord.supplierName}` : 'کوئی سپلائر مقرر نہیں'}</b></div>
                </div>
                <label style="font-weight:bold; display:block; margin-bottom:5px; color:#334155;">
                    سپلائر / ڈلیوری وین منتخب کریں:
                </label>
                <select id="swalSupplierSelect" style="width:100%; height:40px; padding:6px 10px; border-radius:8px; border:1.5px solid #7c3aed; font-size:13px; font-weight:bold; background:#fff;">
                    ${supplierOptions}
                </select>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '🚚 مال گاڑی پر لوڈ کریں (Dispatch)',
        cancelButtonText: 'منسوخ (Cancel)',
        confirmButtonColor: '#7c3aed',
        preConfirm: () => {
            const val = document.getElementById('swalSupplierSelect')?.value;
            if (!val) {
                Swal.showValidationMessage('براہ کرم کوئی سپلائر یا ایجنسی وین منتخب کریں!');
                return false;
            }
            return val;
        }
    });

    if (!supplierVal) return;

    try {
        Swal.fire({ title: 'سپلائر تفویض ہو رہا ہے...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        let supName = 'Agency Depot Van';
        let supId = supplierVal;
        if (supplierVal !== 'self') {
            const found = allStaff.find(s => s.id === supplierVal);
            if (found) supName = found.name || found.email;
        }

        const updateData = {
            supplierId: supId,
            supplierName: supName,
            deliveryStatus: 'dispatched',
            dispatchedAt: new Date().toISOString()
        };

        await db.collection('bills').doc(orderId).update(updateData);
        try {
            await db.collection('orders').doc(orderId).update(updateData);
        } catch(e) {}

        ord.supplierId = supId;
        ord.supplierName = supName;
        ord.deliveryStatus = 'dispatched';

        renderKPIRibbon();
        renderOrdersTable();

        Swal.fire({
            icon: 'success',
            title: '🚚 مال گاڑی پر لوڈ ہو گیا!',
            text: `آرڈر ${ord.billNo || ord.orderNo} کامیابی کے ساتھ ${supName} کے حوالے کر دیا گیا ہے۔`,
            timer: 1800,
            showConfirmButton: false
        });
    } catch(err) {
        console.error('Assign supplier error:', err);
        Swal.fire('Error', 'سپلائر مقرر کرنے میں خرابی: ' + err.message, 'error');
    }
};

// ============================================
// ❌ REJECT BOOKER ORDER
// ============================================
async function rejectOrder(orderId) {
    if (!canUserApproveOrders()) {
        Swal.fire({
            icon: 'warning',
            title: '🔒 Admin Not Allowed (ایڈمن کی منظوری درکار)',
            text: 'آپ کو آرڈر منسوخ یا ریجیکٹ کرنے کا اختیار نہیں ہے۔ صرف ایڈمن منسوخ کر سکتا ہے۔',
            confirmButtonColor: '#0284c7'
        });
        return;
    }

    const confirm = await Swal.fire({
        title: '❌ آرڈر منسوخ کریں؟',
        text: 'کیا آپ واقعی اس فیلڈ آرڈر کو ریجیکٹ کرنا چاہتے ہیں؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ہاں، منسوخ کریں',
        cancelButtonText: 'نہیں',
        confirmButtonColor: '#ef4444'
    });

    if (!confirm.isConfirmed) return;

    try {
        await db.collection('bills').doc(orderId).update({
            orderStatus: 'rejected',
            deliveryStatus: 'cancelled',
            rejectedAt: new Date().toISOString(),
            rejectedBy: myUid
        });

        try {
            await db.collection('orders').doc(orderId).update({
                orderStatus: 'rejected',
                deliveryStatus: 'cancelled',
                rejectedAt: new Date().toISOString(),
                rejectedBy: myUid
            });
        } catch (eOrd) {}

        const ord = allOrders.find(o => o.id === orderId);
        if (ord) {
            ord.orderStatus = 'rejected';
            ord.deliveryStatus = 'cancelled';
        }

        renderKPIRibbon();
        renderBookerRibbon();
        renderOrdersTable();

        Swal.fire({ toast: true, position: 'top-end', timer: 1500, icon: 'info', title: 'Order Rejected' });
    } catch(e) {
        Swal.fire('Error', e.message, 'error');
    }
}

// ============================================
// 👁️ VIEW ORDER DETAILS MODAL
// ============================================
function viewOrderDetails(orderId) {
    const ord = allOrders.find(o => o.id === orderId);
    if (!ord) return;

    const modal = document.getElementById('modalOrderDetails');
    const titleEl = document.getElementById('modalOrderTitle');
    const body = document.getElementById('orderDetailsBody');
    const actionsEl = document.getElementById('modalOrderActions');

    if (titleEl) {
        titleEl.innerHTML = `Order Details: <b>${ord.billNo || ord.orderNo || ord.id}</b>`;
    }

    const isPending = isOrderPendingApproval(ord);

    let itemsTable = `
        <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:10px;">
            <thead>
                <tr style="background:#f1f5f9; text-align:left;">
                    <th style="padding:8px; border:1px solid #cbd5e1;">#</th>
                    <th style="padding:8px; border:1px solid #cbd5e1;">Product</th>
                    <th style="padding:8px; border:1px solid #cbd5e1; text-align:center;">Qty</th>
                    <th style="padding:8px; border:1px solid #cbd5e1; text-align:right;">Rate</th>
                    <th style="padding:8px; border:1px solid #cbd5e1; text-align:right;">Total</th>
                </tr>
            </thead>
            <tbody>
    `;

    (ord.items || []).forEach((it, idx) => {
        let schemeTag = '';
        if (it.freeQty > 0) {
            schemeTag = `<br><span style="background:#fdf4ff; color:#a21caf; border:1px solid #f0abfc; padding:1px 5px; border-radius:6px; font-size:10px; font-weight:bold;">🎁 +${it.freeQty} Free Bonus</span>`;
        } else if (it.hasScheme) {
            schemeTag = `<br><span style="background:#fdf4ff; color:#a21caf; border:1px solid #f0abfc; padding:1px 5px; border-radius:6px; font-size:10px; font-weight:bold;">🎁 ${it.schemeLabel || 'Scheme'}</span>`;
        }

        itemsTable += `
            <tr>
                <td style="padding:8px; border:1px solid #cbd5e1;">${idx + 1}</td>
                <td style="padding:8px; border:1px solid #cbd5e1;"><b>${it.name}</b> ${schemeTag}</td>
                <td style="padding:8px; border:1px solid #cbd5e1; text-align:center; font-weight:bold;">${it.qty} ${it.unit || ''}</td>
                <td style="padding:8px; border:1px solid #cbd5e1; text-align:right;">Rs ${it.rate}</td>
                <td style="padding:8px; border:1px solid #cbd5e1; text-align:right; font-weight:bold;">Rs ${(it.total || it.qty * it.rate || 0).toFixed(2)}</td>
            </tr>
        `;
    });

    itemsTable += `</tbody></table>`;

    body.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px; margin-bottom:12px;">
            <div style="background:#f8fafc; padding:10px 14px; border-radius:10px; border:1px solid #e2e8f0;">
                <div>👤 <b>Customer:</b> ${ord.customerName || 'Counter Sale'} ${ord.customerShop ? `(${ord.customerShop})` : ''}</div>
                <div>📱 <b>Mobile:</b> ${ord.customerMobile || '—'}</div>
                <div>🛣️ <b>Route:</b> ${ord.customerRoute || '—'}</div>
                <div>💰 <b>Customer Khata Balance:</b> Rs ${(ord.previousBalance || 0).toLocaleString()}</div>
            </div>
            <div style="background:#f8fafc; padding:10px 14px; border-radius:10px; border:1px solid #e2e8f0;">
                <div>📕 <b>Order Booker:</b> <span style="color:#0284c7; font-weight:bold;">${ord.bookerName || 'Staff'}</span></div>
                <div>📅 <b>Date:</b> ${ord.date || ord.createdAt?.slice(0,10)} (${ord.time || ''})</div>
                <div>🏷️ <b>Order Type:</b> ${ord.orderType || 'Field Booking'}</div>
                <div>🚚 <b>Assigned Supplier:</b> ${ord.supplierName || 'Not Assigned'}</div>
            </div>
        </div>

        ${ord.bookerNotes ? `
            <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:8px; padding:8px 12px; margin-bottom:10px; font-size:12px; color:#92400e;">
                📝 <b>Booker Delivery Instructions:</b> ${ord.bookerNotes}
            </div>
        ` : ''}

        ${itemsTable}

        <div style="margin-top:14px; text-align:right; font-size:14px; line-height:1.8;">
            <div>Items Subtotal: <b>Rs ${(ord.subTotal || ord.billAmount || 0).toFixed(2)}</b></div>
            ${ord.discount ? `<div style="color:#15803d;">Discounts: -Rs ${(ord.discount).toFixed(2)}</div>` : ''}
            ${ord.previousBalance ? `<div style="color:#b45309;">Previous Khata Balance: +Rs ${(ord.previousBalance).toFixed(2)}</div>` : ''}
            <div style="font-size:18px; font-weight:900; color:#0f172a; border-top:2px solid #e2e8f0; padding-top:6px;">
                Grand Total: <span style="color:#10b981;">Rs ${(ord.grandTotal || ord.billAmount || 0).toFixed(2)}</span>
            </div>
        </div>
    `;

    // Dynamic Actions in Modal
    const canApprove = canUserApproveOrders();
    actionsEl.innerHTML = `
        ${isPending ? `
            ${canApprove ? `
                <button type="button" onclick="closeOrderDetailsModal(); approveOrder('${ord.id}')" class="btn" style="background:#10b981; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">
                    <i class="fas fa-check"></i> Accept &amp; Generate Bill
                </button>
                <button type="button" onclick="closeOrderDetailsModal(); rejectOrder('${ord.id}')" class="btn" style="background:#ef4444; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">
                    <i class="fas fa-times"></i> Reject
                </button>
            ` : `
                <div style="font-size:12px; color:#b45309; background:#fffbeb; border:1px solid #fde68a; padding:8px 14px; border-radius:8px; display:inline-flex; align-items:center; gap:8px;">
                    <i class="fas fa-lock" style="color:#d97706;"></i> <b>Admin Not Allowed:</b> یہ آرڈر ایڈمن کی منظوری کا منتظر ہے (Pending Admin Approval)۔
                </div>
            `}
        ` : ''}
        ${ord.orderStatus === 'approved' ? `
            <button type="button" onclick="printOrderBill('${ord.id}')" class="btn" style="background:#0284c7; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">
                <i class="fas fa-print"></i> Print Customer Bill
            </button>
        ` : ''}
    `;

    modal.style.display = 'flex';
}

window.closeOrderDetailsModal = function() {
    const modal = document.getElementById('modalOrderDetails');
    if (modal) modal.style.display = 'none';
};

// ============================================
// 🖨️ PRINT CUSTOMER BILL
// ============================================
function printOrderBill(orderId) {
    const ord = allOrders.find(o => o.id === orderId);
    if (!ord) return;

    const printSettings = (typeof getPrintSettings === 'function') 
        ? getPrintSettings() 
        : { paperSize: 'thermal80', template: 'template6', headerTitle: myAgency?.name || 'Vyapar Invoice', phone: myAgency?.mobile || '', address: myAgency?.address || '' };

    const selectedTemplate = printSettings.template || 'template6';

    const billObj = {
        agencyName: myAgency?.name || 'Distribution Agency',
        agencyAddress: myAgency?.address || '',
        agencyMobile: myAgency?.mobile || '',
        billNo: ord.billNo || ord.orderNo || 'INV-001',
        customerName: ord.customerName || 'Counter Sale',
        customerMobile: ord.customerMobile || '',
        customerShop: ord.customerShop || '',
        date: ord.date || ord.createdAt?.slice(0, 10),
        time: ord.time || '',
        items: ord.items || [],
        subTotal: ord.subTotal || ord.billAmount || 0,
        discount: ord.discount || 0,
        billAmount: ord.billAmount || ord.grandTotal || 0,
        previousBalance: ord.previousBalance || 0,
        grandTotal: ord.grandTotal || ord.billAmount || 0,
        received: ord.received || 0,
        balance: ord.balance || (ord.grandTotal || 0)
    };

    let printHtml = '';
    if (typeof buildBillHTML === 'function') {
        printHtml = buildBillHTML(billObj, selectedTemplate, printSettings);
    } else {
        printHtml = `
            <div style="font-family:monospace; padding:15px; text-align:center;">
                <h2>${billObj.agencyName}</h2>
                <p>${billObj.agencyAddress} | ${billObj.agencyMobile}</p>
                <hr>
                <div style="text-align:left;">
                    <b>INVOICE: ${billObj.billNo}</b><br>
                    Customer: ${billObj.customerName} (${billObj.customerShop || ''})<br>
                    Date: ${billObj.date} ${billObj.time}
                </div>
                <hr>
                <table style="width:100%; text-align:left;">
                    ${(billObj.items || []).map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>Rs ${i.rate}</td><td>Rs ${i.total}</td></tr>`).join('')}
                </table>
                <hr>
                <div style="text-align:right;">
                    <b>Total: Rs ${billObj.grandTotal}</b>
                </div>
            </div>
        `;
    }

    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(printHtml);
        printWin.document.close();
        setTimeout(() => {
            printWin.focus();
            printWin.print();
        }, 350);
    } else {
        // Fallback hidden iframe
        let printIframe = document.getElementById('ebPrintIframe');
        if (!printIframe) {
            printIframe = document.createElement('iframe');
            printIframe.id = 'ebPrintIframe';
            printIframe.style.position = 'fixed';
            printIframe.style.right = '0';
            printIframe.style.bottom = '0';
            printIframe.style.width = '0';
            printIframe.style.height = '0';
            printIframe.style.border = '0';
            document.body.appendChild(printIframe);
        }
        printIframe.contentWindow.document.open();
        printIframe.contentWindow.document.write(printHtml);
        printIframe.contentWindow.document.close();
        setTimeout(() => {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
        }, 400);
    }
}

// ============================================
// ⚡ BULK ACTIONS & EXPORT
// ============================================
function updateBulkOrdersBar() {
    const checked = document.querySelectorAll('.order-check:checked');
    const bar = document.getElementById('bulkOrdersBar');
    const countEl = document.getElementById('selectedOrdersCount');
    const btnBulkApprove = document.getElementById('btnBulkApprove');
    const bulkSupplierSelect = document.getElementById('bulkSupplierSelect');

    const canApprove = canUserApproveOrders();

    if (checked.length > 0) {
        if (bar) bar.style.display = 'flex';
        if (countEl) countEl.innerText = checked.length;
        if (!canApprove) {
            if (btnBulkApprove) btnBulkApprove.style.display = 'none';
            if (bulkSupplierSelect) bulkSupplierSelect.style.display = 'none';
        } else {
            if (btnBulkApprove) btnBulkApprove.style.display = 'inline-flex';
            if (bulkSupplierSelect) bulkSupplierSelect.style.display = 'inline-block';
        }
    } else {
        if (bar) bar.style.display = 'none';
    }
}

async function handleBulkApproveAndAssign() {
    if (!canUserApproveOrders()) {
        Swal.fire({
            icon: 'warning',
            title: '🔒 Admin Not Allowed (ایڈمن کی منظوری درکار)',
            text: 'آپ کو آرڈرز منظور کرنے کا اختیار نہیں ہے۔ صرف ایڈمن ایک کلک پر منظور کر سکتا ہے۔',
            confirmButtonColor: '#0284c7'
        });
        return;
    }

    const checked = Array.from(document.querySelectorAll('.order-check:checked')).map(c => c.dataset.id);
    if (checked.length === 0) {
        Swal.fire('توجہ', 'کم از کم ایک آرڈر منتخب کریں!', 'warning');
        return;
    }

    const supplierId = document.getElementById('bulkSupplierSelect')?.value;
    let supplierObj = null;
    if (supplierId === 'self') {
        supplierObj = { id: 'self', name: 'Agency Depot Van' };
    } else if (supplierId) {
        supplierObj = allStaff.find(s => s.id === supplierId);
    }

    const confirm = await Swal.fire({
        title: '✅ منتخب آرڈرز منظور و ڈسپیچ کریں؟',
        html: `
            <div style="text-align:center; font-size:14px; line-height:1.7;">
                آپ <b>${checked.length} فیلڈ آرڈرز</b> کو منظور کرنے لگے ہیں۔<br>
                ${supplierObj 
                    ? `ڈلیوری وین / سپلائر: <b style="color:#7c3aed;">🚚 ${supplierObj.name}</b>` 
                    : '<span style="color:#d97706;">(ابھی سپلائر تفویض نہیں ہو گا، بعد میں گاڑی پر لوڈ کر سکتے ہیں)</span>'
                }
                <br><br>
                <small style="color:#64748b;">منظوری پر پکے انوائس نمبر جاری ہوں گے اور گودام کا اسٹاک خودکار کٹ جائے گا۔</small>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: supplierObj ? 'ہاں، منظور و گاڑی پر لوڈ کریں' : 'ہاں، صرف منظور کریں',
        cancelButtonText: 'منسوخ (Cancel)',
        confirmButtonColor: '#10b981'
    });

    if (!confirm.isConfirmed) return;

    try {
        Swal.fire({ title: 'منظوری و ڈسپیچ جاری ہے...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        for (const orderId of checked) {
            const ord = allOrders.find(o => o.id === orderId);
            if (!ord) continue;

            const isPending = isOrderPendingApproval(ord);
            let liveBillNo = ord.billNo;
            if (isPending) {
                liveBillNo = await getNextLiveBillNo();
            }

            const batch = db.batch();
            const billRef = db.collection('bills').doc(orderId);

            const updateData = {
                orderStatus: 'approved',
                billNo: liveBillNo,
                approvedAt: new Date().toISOString(),
                approvedBy: myUid
            };

            if (supplierObj) {
                updateData.supplierId = supplierObj.id;
                updateData.supplierName = supplierObj.name;
                updateData.deliveryStatus = 'dispatched';
                updateData.dispatchedAt = new Date().toISOString();
            }

            batch.update(billRef, updateData);

            if (isPending) {
                const movements = [];
                (ord.items || []).forEach(it => {
                    if (!it.stockId) return;
                    const s = allStock.find(x => x.id === it.stockId);
                    const currentQty = s ? (s.qty || 0) : 0;
                    const newQty = currentQty - (it.qty || 0);
                    batch.update(db.collection('stock').doc(it.stockId), {
                        qty: newQty,
                        updatedAt: new Date().toISOString()
                    });
                    movements.push({
                        itemName: it.name,
                        qty: it.qty,
                        beforeQty: currentQty,
                        afterQty: newQty
                    });
                    if (s) s.qty = newQty;
                });

                if (movements.length > 0) {
                    const moveRef = db.collection('movements').doc();
                    batch.set(moveRef, {
                        agencyId: myAgencyId,
                        billNo: liveBillNo,
                        type: 'out',
                        reason: 'sale',
                        note: `Bulk Booker Order Approved (${ord.customerName || 'Customer'})`,
                        movements: movements,
                        createdAt: new Date().toISOString(),
                        createdBy: myUid
                    });
                }

                if (ord.customerId) {
                    const custRef = db.collection('customers').doc(ord.customerId);
                    const cDoc = await custRef.get();
                    if (cDoc.exists) {
                        const currentBal = parseFloat(cDoc.data().balance) || 0;
                        const billAmt = (ord.billAmount !== undefined && ord.billAmount !== null)
                            ? parseFloat(ord.billAmount)
                            : (parseFloat(ord.grandTotal) || 0);
                        const recAmt = parseFloat(ord.received) || 0;
                        const newBal = currentBal + (billAmt - recAmt);
                        batch.update(custRef, { balance: newBal, lastBillNo: liveBillNo, lastBillAt: new Date().toISOString() });
                    }
                }
            }

            await batch.commit();

            try {
                await db.collection('orders').doc(orderId).update(updateData);
            } catch (eOrd) {}

            ord.orderStatus = 'approved';
            ord.billNo = liveBillNo;
            if (supplierObj) {
                ord.supplierId = supplierObj.id;
                ord.supplierName = supplierObj.name;
                ord.deliveryStatus = 'dispatched';
            }
        }

        renderKPIRibbon();
        renderBookerRibbon();
        renderOrdersTable();

        Swal.fire({
            icon: 'success',
            title: '✅ آرڈرز منظور اور گاڑی پر لوڈ ہو گئے!',
            html: `
                <div style="text-align:center; font-size:14px; line-height:1.7;">
                    <b>${checked.length} فیلڈ آرڈرز</b> کامیابی کے ساتھ منظور ہو چکے ہیں اور گودام کا اسٹاک اپڈیٹ ہو گیا ہے۔<br>
                    ${supplierObj ? `ڈلیوری وین: <b style="color:#7c3aed;">🚚 ${supplierObj.name}</b>` : ''}
                    <br><br>
                    <div style="font-size:12px; color:#64748b;">اب آپ گاڑی کا گیٹ پاس یا ڈلیوری روٹ شیٹ پرنٹ کر سکتے ہیں:</div>
                </div>
            `,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '🚚 لوڈنگ گیٹ پاس (Gate Pass)',
            denyButtonText: '🛣️ ڈلیوری روٹ شیٹ (Route Sheet)',
            cancelButtonText: 'ٹھیک ہے (Done)',
            confirmButtonColor: '#7c3aed',
            denyButtonColor: '#0891b2'
        }).then(res => {
            if (res.isConfirmed) {
                printVanLoadingChallan();
            } else if (res.isDenied) {
                printDeliveryRouteSheet();
            }
        });

    } catch (e) {
        console.error('Bulk approve error:', e);
        Swal.fire('Error', 'Bulk approval failed: ' + e.message, 'error');
    }
}

function handleBulkPrint() {
    const checked = Array.from(document.querySelectorAll('.order-check:checked')).map(c => c.dataset.id);
    if (checked.length === 0) {
        Swal.fire('توجہ', 'پرنٹ کے لیے کم از کم ایک آرڈر منتخب کریں!', 'warning');
        return;
    }

    const ordersToPrint = allOrders.filter(o => checked.includes(o.id));
    let combinedHtml = '';

    const printSettings = (typeof getPrintSettings === 'function') 
        ? getPrintSettings() 
        : { paperSize: 'thermal80', template: 'template6' };

    ordersToPrint.forEach(ord => {
        const billObj = {
            agencyName: myAgency?.name || 'Distribution Agency',
            agencyAddress: myAgency?.address || '',
            agencyMobile: myAgency?.mobile || '',
            billNo: ord.billNo || ord.orderNo || 'INV-001',
            customerName: ord.customerName || 'Counter Sale',
            customerMobile: ord.customerMobile || '',
            customerShop: ord.customerShop || '',
            date: ord.date || ord.createdAt?.slice(0, 10),
            time: ord.time || '',
            items: ord.items || [],
            subTotal: ord.subTotal || ord.billAmount || 0,
            discount: ord.discount || 0,
            billAmount: ord.billAmount || ord.grandTotal || 0,
            previousBalance: ord.previousBalance || 0,
            grandTotal: ord.grandTotal || ord.billAmount || 0,
            received: ord.received || 0,
            balance: ord.balance || (ord.grandTotal || 0)
        };

        if (typeof buildBillHTML === 'function') {
            combinedHtml += buildBillHTML(billObj, printSettings.template || 'template6', printSettings);
            combinedHtml += `<div style="page-break-after: always; height: 10px;"></div>`;
        }
    });

    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(combinedHtml);
        printWin.document.close();
        setTimeout(() => {
            printWin.focus();
            printWin.print();
        }, 400);
    }
}

function exportOrdersCSV() {
    if (allOrders.length === 0) {
        Swal.fire('Info', 'کوئی ڈیٹا موجود نہیں ہے۔', 'info');
        return;
    }

    let csv = 'Order/Bill No,Date,Time,Customer,Shop,Route,Mobile,Order Booker,Items Count,Total Amount,Status,Supplier\n';

    allOrders.forEach(o => {
        const row = [
            `"${o.billNo || o.orderNo || o.id}"`,
            `"${o.date || o.createdAt?.slice(0,10) || ''}"`,
            `"${o.time || ''}"`,
            `"${o.customerName || 'Counter Sale'}"`,
            `"${o.customerShop || ''}"`,
            `"${o.customerRoute || ''}"`,
            `"${o.customerMobile || ''}"`,
            `"${o.bookerName || 'Staff'}"`,
            `"${(o.items && o.items.length) || o.itemCount || 0}"`,
            `"${o.billAmount || o.grandTotal || 0}"`,
            `"${o.orderStatus || 'pending'}"`,
            `"${o.supplierName || 'Not Assigned'}"`
        ];
        csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Booker_Orders_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================
// 🖨️ ADVANCED PRINT HUB & REPORTS ENGINE
// ============================================

function openPrintDocument(htmlContent) {
    const printWin = window.open('', '_blank', 'width=850,height=900');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(htmlContent);
        printWin.document.close();
        setTimeout(() => {
            printWin.focus();
            printWin.print();
        }, 350);
    } else {
        let printIframe = document.getElementById('ebPrintIframe');
        if (!printIframe) {
            printIframe = document.createElement('iframe');
            printIframe.id = 'ebPrintIframe';
            printIframe.style.position = 'fixed';
            printIframe.style.right = '0';
            printIframe.style.bottom = '0';
            printIframe.style.width = '0';
            printIframe.style.height = '0';
            printIframe.style.border = '0';
            document.body.appendChild(printIframe);
        }
        printIframe.contentWindow.document.open();
        printIframe.contentWindow.document.write(htmlContent);
        printIframe.contentWindow.document.close();
        setTimeout(() => {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
        }, 400);
    }
}

// 1. 📋 Print Pending Orders List (User Specification)
window.printPendingOrdersList = function() {
    const pendingOrders = allOrders.filter(o => isOrderPendingApproval(o));
    if (pendingOrders.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'No Pending Orders',
            text: 'اس وقت منظوری کے لیے کوئی فیلڈ آرڈر پینڈنگ نہیں ہے۔ تمام آرڈرز مکمل ہیں۔',
            confirmButtonColor: '#0284c7'
        });
        return;
    }

    const totalVal = pendingOrders.reduce((sum, o) => sum + (parseFloat(o.billAmount || o.grandTotal) || 0), 0);
    let totalPcs = 0;
    pendingOrders.forEach(o => {
        (o.items || []).forEach(it => { totalPcs += (parseFloat(it.qty) || 0); });
    });

    const rows = pendingOrders.map((o, idx) => {
        const itemsSummary = (o.items || []).map(it => `${it.name} (x${it.qty}${it.freeQty ? ` +${it.freeQty} Free` : ''})`).join(', ');
        return `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
                <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1;">${idx + 1}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><b>${o.billNo || o.orderNo || o.id.slice(0,8)}</b><br><small style="color:#64748b;">${o.time || ''}</small></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><b>${o.bookerName || 'Staff'}</b></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><b>${o.customerName || 'Counter'}</b> ${o.customerShop ? `(${o.customerShop})` : ''}<br><small style="color:#64748b;">📱 ${o.customerMobile || '—'} | 🛣️ ${o.customerRoute || '—'}</small></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; max-width: 250px;">${itemsSummary || 'No items'}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: bold; color: #0284c7;">Rs ${Math.round(o.billAmount || o.grandTotal || 0).toLocaleString()}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; color: #d97706; font-weight: bold;">پینڈنگ (Pending)</td>
            </tr>
        `;
    }).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pending Approval Orders - NH POS</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #0f172a; margin: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th { background: #f1f5f9; padding: 8px; font-size: 12px; border: 1px solid #cbd5e1; text-align: left; }
                @media print {
                    button { display: none; }
                    body { padding: 10px; }
                }
            </style>
        </head>
        <body>
            <div style="text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 8px;">
                <h2 style="margin: 0; color: #0284c7;">${myAgency?.name || 'Distribution Agency'}</h2>
                <div style="font-size: 12px; color: #64748b;">${myAgency?.address || ''} | رابطہ: ${myAgency?.mobile || ''}</div>
                <h3 style="margin: 6px 0 0; color: #b45309;">📋 پینڈنگ فیلڈ آرڈرز منظوری شیٹ (Pending Approval Orders)</h3>
                <div style="font-size: 11px; color: #64748b;">تاریخ: ${new Date().toLocaleDateString('en-PK')} (${new Date().toLocaleTimeString('en-PK')})</div>
            </div>

            <div style="display: flex; justify-content: space-around; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px; margin-top: 12px; font-size: 13px;">
                <div>کل پینڈنگ آرڈرز: <b style="color:#b45309; font-size:16px;">${pendingOrders.length}</b></div>
                <div>کل پینڈنگ یونٹس: <b>${Math.round(totalPcs).toLocaleString()}</b></div>
                <div>کل پینڈنگ مالیت: <b style="color:#0284c7; font-size:16px;">Rs ${Math.round(totalVal).toLocaleString()}</b></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px; text-align: center;">#</th>
                        <th>Order #</th>
                        <th>Order Booker</th>
                        <th>Customer / Shop</th>
                        <th>Items Breakdown</th>
                        <th style="text-align: right;">Amount (Rs)</th>
                        <th style="text-align: center;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>

            <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px;">
                <div style="border-top: 1px solid #0f172a; width: 200px; text-align: center; padding-top: 5px;">
                    آرڈر انچارج دستخط (Incharge)
                </div>
                <div style="border-top: 1px solid #0f172a; width: 200px; text-align: center; padding-top: 5px;">
                    ایڈمن / اونر منظوری (Owner)
                </div>
            </div>
        </body>
        </html>
    `;

    openPrintDocument(html);
};

// 2. 🚚 Print Delivery Van Loading Challan (Gate Pass)
window.printVanLoadingChallan = function() {
    const checked = Array.from(document.querySelectorAll('.order-check:checked')).map(c => c.dataset.id);
    let targetOrders = [];
    if (checked.length > 0) {
        targetOrders = allOrders.filter(o => checked.includes(o.id));
    } else {
        targetOrders = allOrders.filter(o => o.orderStatus === 'approved' && (o.deliveryStatus === 'pending' || o.deliveryStatus === 'dispatched'));
    }

    if (targetOrders.length === 0) {
        Swal.fire('توجہ', 'گاڑی لوڈنگ کے لیے کم از کم ایک منظور شدہ آرڈر منتخب کریں یا فلٹر کریں!', 'warning');
        return;
    }

    // Aggregate items across all selected orders
    const itemMap = {};
    let totalPieces = 0;
    let totalFreePieces = 0;
    let totalGrossAmount = 0;

    targetOrders.forEach(ord => {
        totalGrossAmount += (parseFloat(ord.billAmount || ord.grandTotal) || 0);
        (ord.items || []).forEach(it => {
            const key = it.name || it.stockId || 'Generic Item';
            if (!itemMap[key]) {
                itemMap[key] = {
                    name: it.name,
                    unit: it.unit || 'Pcs',
                    qty: 0,
                    freeQty: 0,
                    category: it.category || 'General',
                    rate: it.rate || 0
                };
            }
            const q = parseFloat(it.qty) || 0;
            const fq = parseFloat(it.freeQty) || 0;
            itemMap[key].qty += q;
            itemMap[key].freeQty += fq;
            totalPieces += q;
            totalFreePieces += fq;
        });
    });

    const itemRows = Object.values(itemMap).map((it, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
            <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1;">${idx + 1}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;"><b>${it.name}</b></td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; color:#64748b;">${it.category}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: 800; font-size: 14px; color: #0284c7;">${it.qty} ${it.unit}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold; color: #a21caf;">${it.freeQty > 0 ? `+${it.freeQty}` : '—'}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold;">${it.qty + it.freeQty} ${it.unit}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; width: 60px;">[ &nbsp; ]</td>
        </tr>
    `).join('');

    const shopsList = targetOrders.map(o => `${o.customerShop || o.customerName} (${o.customerRoute || 'Area'})`).join(' • ');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Van Loading Gate Pass - NH POS</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #0f172a; margin: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                th { background: #f1f5f9; padding: 8px; font-size: 12px; border: 1px solid #cbd5e1; text-align: left; }
                @media print {
                    button { display: none; }
                    body { padding: 10px; }
                }
            </style>
        </head>
        <body>
            <div style="text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                <h2 style="margin: 0; color: #7c3aed;">${myAgency?.name || 'Distribution Agency'}</h2>
                <div style="font-size: 12px; color: #64748b;">${myAgency?.address || ''} | فون: ${myAgency?.mobile || ''}</div>
                <h3 style="margin: 6px 0 0; color: #0f172a; text-transform: uppercase;">🚚 ڈلیوری وین لوڈنگ چالان و گیٹ پاس (Van Loading Gate Pass)</h3>
                <div style="font-size: 11px; color: #64748b;">تاریخ: ${new Date().toLocaleDateString('en-PK')} (${new Date().toLocaleTimeString('en-PK')})</div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 10px; margin-top: 12px; font-size: 12.5px;">
                <div>کل بلز / دکانیں: <b>${targetOrders.length}</b></div>
                <div>پروڈکٹس ورائٹی: <b>${Object.keys(itemMap).length} Items</b></div>
                <div>کل لوڈنگ تعداد: <b style="color:#7c3aed; font-size:15px;">${Math.round(totalPieces + totalFreePieces)} Units</b></div>
                <div>کل مالیت (Rs): <b style="color:#15803d; font-size:15px;">Rs ${Math.round(totalGrossAmount).toLocaleString()}</b></div>
            </div>

            <div style="margin-top: 10px; font-size: 11.5px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px; border-radius: 6px;">
                <b>📍 ڈلیوری دکانیں و روٹ:</b> ${shopsList}
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px; text-align: center;">#</th>
                        <th>Product Description (پروڈکٹ کا نام)</th>
                        <th>Category</th>
                        <th style="text-align: center;">Sale Qty</th>
                        <th style="text-align: center;">Scheme Free</th>
                        <th style="text-align: center;">Total to Load</th>
                        <th style="text-align: center;">Checked</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemRows}
                </tbody>
            </table>

            <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px;">
                <div style="border-top: 1px solid #0f172a; width: 200px; text-align: center; padding-top: 5px;">
                    گودام انچارج دستخط (Storekeeper)
                </div>
                <div style="border-top: 1px solid #0f172a; width: 200px; text-align: center; padding-top: 5px;">
                    وین ڈرائیور / سپلائر دستخط (Driver)
                </div>
            </div>
        </body>
        </html>
    `;

    openPrintDocument(html);
};

// 3. 🛣️ Print Route Delivery & Cash Collection Manifest
window.printDeliveryRouteSheet = function() {
    const checked = Array.from(document.querySelectorAll('.order-check:checked')).map(c => c.dataset.id);
    let targetOrders = [];
    if (checked.length > 0) {
        targetOrders = allOrders.filter(o => checked.includes(o.id));
    } else {
        targetOrders = allOrders.filter(o => o.orderStatus === 'approved');
    }

    if (targetOrders.length === 0) {
        Swal.fire('توجہ', 'روٹ شیٹ کے لیے کم از کم ایک آرڈر منتخب کریں!', 'warning');
        return;
    }

    let totalAmount = 0;
    const rows = targetOrders.map((o, idx) => {
        const amt = parseFloat(o.billAmount || o.grandTotal || 0);
        totalAmount += amt;
        return `
            <tr style="border-bottom: 1px solid #cbd5e1; font-size: 12.5px;">
                <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1;">${idx + 1}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><b>${o.billNo || o.orderNo || o.id.slice(0,8)}</b></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">
                    <b>${o.customerShop || o.customerName}</b><br>
                    <small style="color:#64748b;">${o.customerName} | 📱 ${o.customerMobile || '—'}</small>
                </td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${o.customerRoute || '—'}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1;">${(o.items || []).length} Items</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: 800; color: #0f172a;">Rs ${Math.round(amt).toLocaleString()}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; width: 110px;"></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; width: 110px;"></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; width: 100px;"></td>
            </tr>
        `;
    }).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Delivery Route & Cash Collection Manifest</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #0f172a; margin: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                th { background: #f1f5f9; padding: 8px; font-size: 12px; border: 1px solid #cbd5e1; text-align: left; }
                @media print {
                    button { display: none; }
                    body { padding: 10px; }
                }
            </style>
        </head>
        <body>
            <div style="text-align: center; border-bottom: 2px solid #0891b2; padding-bottom: 8px;">
                <h2 style="margin: 0; color: #0891b2;">${myAgency?.name || 'Distribution Agency'}</h2>
                <div style="font-size: 12px; color: #64748b;">${myAgency?.address || ''} | فون: ${myAgency?.mobile || ''}</div>
                <h3 style="margin: 6px 0 0; color: #0f172a; text-transform: uppercase;">🛣️ روٹ ڈلیوری و کیش وصولی شیٹ (Van Delivery Manifest)</h3>
                <div style="font-size: 11px; color: #64748b;">تاریخ: ${new Date().toLocaleDateString('en-PK')}</div>
            </div>

            <div style="display: flex; justify-content: space-between; background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 8px; padding: 10px; margin-top: 12px; font-size: 13px;">
                <div>کل دکانیں / پارسلز: <b>${targetOrders.length} Shops</b></div>
                <div>متوقع کل کیش وصولی: <b style="color:#0891b2; font-size:16px;">Rs ${Math.round(totalAmount).toLocaleString()}</b></div>
                <div>ڈرائیور / وین سپلائر: <b>${targetOrders[0]?.supplierName || 'Delivery Van'}</b></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px; text-align: center;">#</th>
                        <th>Bill #</th>
                        <th>Shop Name / Owner</th>
                        <th>Route / Area</th>
                        <th style="text-align: center;">Items</th>
                        <th style="text-align: right;">Bill Amount</th>
                        <th style="text-align: center;">Cash Received</th>
                        <th style="text-align: center;">Credit / Balance</th>
                        <th style="text-align: center;">Receiver Sign</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>

            <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px;">
                <div style="border-top: 1px solid #0f172a; width: 220px; text-align: center; padding-top: 5px;">
                    ڈرائیور وصولی جمع دستخط (Driver Deposit)
                </div>
                <div style="border-top: 1px solid #0f172a; width: 220px; text-align: center; padding-top: 5px;">
                    کیشیر / منیجر تصدیق دستخط (Cashier Received)
                </div>
            </div>
        </body>
        </html>
    `;

    openPrintDocument(html);
};

// 4. 👥 Print All Bookers Daily Performance Sheet
window.printAllBookersPerformanceSheet = function() {
    const bookers = allStaff.filter(s => s.role === 'booker');
    if (bookers.length === 0) {
        Swal.fire('معلومات', 'کوئی آرڈر بکر رجسٹرڈ نہیں ہے!', 'info');
        return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayPkStr = new Date().toLocaleDateString('en-PK');

    let totalTodayOrders = 0;
    let totalTodayAmount = 0;
    let totalOverallOrders = 0;
    let totalOverallAmount = 0;

    const rows = bookers.map((b, idx) => {
        const bOrders = allOrders.filter(o => o.bookerId === b.id || o.createdBy === b.id || (o.bookerName && o.bookerName.toLowerCase() === (b.name || '').toLowerCase()));
        const todayOrders = bOrders.filter(o => (o.date === todayPkStr) || (o.createdAt && o.createdAt.startsWith(todayStr)));
        const todayAmt = todayOrders.reduce((sum, o) => sum + (parseFloat(o.billAmount || o.grandTotal) || 0), 0);
        const allAmt = bOrders.reduce((sum, o) => sum + (parseFloat(o.billAmount || o.grandTotal) || 0), 0);

        totalTodayOrders += todayOrders.length;
        totalTodayAmount += todayAmt;
        totalOverallOrders += bOrders.length;
        totalOverallAmount += allAmt;

        return `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
                <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1;">${idx + 1}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><b>${b.name || b.email}</b><br><small style="color:#64748b;">📱 ${b.mobile || b.phone || '—'}</small></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${b.route || 'General Market'}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold; color: #0284c7;">${todayOrders.length}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: bold; color: #15803d;">Rs ${Math.round(todayAmt).toLocaleString()}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1;">${bOrders.length}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: bold;">Rs ${Math.round(allAmt).toLocaleString()}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1;">${bOrders.length >= 25 ? '👑 Top Star' : '⭐ Active'}</td>
            </tr>
        `;
    }).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Order Bookers Performance Report - NH POS</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #0f172a; margin: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                th { background: #f1f5f9; padding: 8px; font-size: 12px; border: 1px solid #cbd5e1; text-align: left; }
                @media print {
                    button { display: none; }
                    body { padding: 10px; }
                }
            </style>
        </head>
        <body>
            <div style="text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 8px;">
                <h2 style="margin: 0; color: #0284c7;">${myAgency?.name || 'Distribution Agency'}</h2>
                <div style="font-size: 12px; color: #64748b;">${myAgency?.address || ''} | رابطہ: ${myAgency?.mobile || ''}</div>
                <h3 style="margin: 6px 0 0; color: #0f172a; text-transform: uppercase;">👥 آرڈر بکرز کی روزانہ کارکردگی رپورٹ (Daily Order Bookers Report)</h3>
                <div style="font-size: 11px; color: #64748b;">تاریخ: ${new Date().toLocaleDateString('en-PK')}</div>
            </div>

            <div style="display: flex; justify-content: space-around; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 10px; margin-top: 12px; font-size: 13px;">
                <div>رجسٹرڈ بکرز: <b>${bookers.length}</b></div>
                <div>آج کے کل آرڈرز: <b style="color:#0284c7; font-size:16px;">${totalTodayOrders}</b></div>
                <div>آج کی کل فیلڈ بکنگ: <b style="color:#15803d; font-size:16px;">Rs ${Math.round(totalTodayAmount).toLocaleString()}</b></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px; text-align: center;">#</th>
                        <th>Order Booker Name</th>
                        <th>Assigned Route</th>
                        <th style="text-align: center;">Today Orders</th>
                        <th style="text-align: right;">Today Booking (Rs)</th>
                        <th style="text-align: center;">Total Orders</th>
                        <th style="text-align: right;">Total Booking (Rs)</th>
                        <th style="text-align: center;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>

            <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px;">
                <div style="border-top: 1px solid #0f172a; width: 200px; text-align: center; padding-top: 5px;">
                    فیلڈ سپروائزر دستخط
                </div>
                <div style="border-top: 1px solid #0f172a; width: 200px; text-align: center; padding-top: 5px;">
                    ایڈمن / ڈائریکٹر دستخط
                </div>
            </div>
        </body>
        </html>
    `;

    openPrintDocument(html);
};

// 5. 👤 Print Individual Booker Daily Sheet
window.printBookerDailySheet = function(bookerId) {
    const booker = allStaff.find(s => s.id === bookerId);
    if (!booker) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayPkStr = new Date().toLocaleDateString('en-PK');

    const bOrders = allOrders.filter(o => (o.bookerId === booker.id || o.createdBy === booker.id || (o.bookerName && o.bookerName.toLowerCase() === (booker.name || '').toLowerCase())) && ((o.date === todayPkStr) || (o.createdAt && o.createdAt.startsWith(todayStr))));

    if (bOrders.length === 0) {
        Swal.fire('معلومات', `${booker.name || 'Booker'} کا آج کوئی آرڈر نہیں ملا!`, 'info');
        return;
    }

    let todayTotal = 0;
    const rows = bOrders.map((o, idx) => {
        const amt = parseFloat(o.billAmount || o.grandTotal || 0);
        todayTotal += amt;
        const itemsText = (o.items || []).map(i => `${i.name} (x${i.qty})`).join(', ');
        return `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12.5px;">
                <td style="padding: 7px; text-align: center; border: 1px solid #cbd5e1;">${idx + 1}</td>
                <td style="padding: 7px; border: 1px solid #cbd5e1;"><b>${o.billNo || o.orderNo || o.id.slice(0,8)}</b></td>
                <td style="padding: 7px; border: 1px solid #cbd5e1;"><b>${o.customerShop || o.customerName}</b><br><small style="color:#64748b;">${o.customerMobile || ''}</small></td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; max-width: 250px;">${itemsText}</td>
                <td style="padding: 7px; text-align: right; border: 1px solid #cbd5e1; font-weight: bold; color: #0284c7;">Rs ${Math.round(amt).toLocaleString()}</td>
                <td style="padding: 7px; text-align: center; border: 1px solid #cbd5e1;">${o.orderStatus === 'approved' ? '✅ Approved' : '⏳ Pending'}</td>
            </tr>
        `;
    }).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Daily Booker Sheet - ${booker.name}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #0f172a; margin: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                th { background: #f1f5f9; padding: 8px; font-size: 12px; border: 1px solid #cbd5e1; text-align: left; }
                @media print { button { display: none; } }
            </style>
        </head>
        <body>
            <div style="text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 8px;">
                <h2 style="margin: 0; color: #0284c7;">${myAgency?.name || 'Distribution Agency'}</h2>
                <h3 style="margin: 4px 0 0;">آرڈر بکر روزانہ فیلڈ سمری شیٹ</h3>
                <div style="font-size: 12px; color: #64748b;">بکر: <b>${booker.name}</b> | روٹ: <b>${booker.route || 'General Area'}</b> | فون: ${booker.mobile || booker.phone || '—'}</div>
                <div style="font-size: 11px; color: #64748b;">تاریخ: ${new Date().toLocaleDateString('en-PK')}</div>
            </div>

            <div style="display: flex; justify-content: space-between; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 8px 14px; margin-top: 10px; font-size: 13px;">
                <div>کل دکانیں وزٹ: <b>${bOrders.length} Shops</b></div>
                <div>آج کی کل بکنگ: <b style="color:#0284c7; font-size:16px;">Rs ${Math.round(todayTotal).toLocaleString()}</b></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px; text-align: center;">#</th>
                        <th>Order #</th>
                        <th>Shop Name</th>
                        <th>Items Summary</th>
                        <th style="text-align: right;">Amount (Rs)</th>
                        <th style="text-align: center;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>

            <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px;">
                <div style="border-top: 1px solid #0f172a; width: 180px; text-align: center; padding-top: 5px;">
                    آرڈر بکر دستخط
                </div>
                <div style="border-top: 1px solid #0f172a; width: 180px; text-align: center; padding-top: 5px;">
                    وصولی / ایڈمن دستخط
                </div>
            </div>
        </body>
        </html>
    `;

    openPrintDocument(html);
};

// ============================================
// 🔔 AUDIO SOUND CHIME ON NEW ORDERS
// ============================================
function playTestChime() {
    playNewOrderChime();
    Swal.fire({ toast: true, position: 'top-end', timer: 1500, icon: 'info', title: '🔔 Sound played!' });
}
window.playTestChime = playTestChime;

function playNewOrderChime() {
    try {
        const settings = JSON.parse(localStorage.getItem('eb_booker_orders_settings') || '{}');
        if (settings.orderSound === 'off') return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15); // A5

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
        console.warn('Audio chime warning:', e);
    }
}

// ============================================
// 🖨️ PRINT HUB & SETTINGS MODALS
// ============================================
window.openPrintHubModal = function() {
    const modal = document.getElementById('modalPrintHub');
    if (modal) modal.style.display = 'flex';
};
window.closePrintHubModal = function() {
    const modal = document.getElementById('modalPrintHub');
    if (modal) modal.style.display = 'none';
};

window.openAdvanceSettingsModal = function() {
    const modal = document.getElementById('modalAdvanceSettings');
    if (!modal) return;

    const settings = JSON.parse(localStorage.getItem('eb_booker_orders_settings') || '{}');
    const autoSel = document.getElementById('settingAutoApprove');
    if (autoSel) autoSel.value = settings.autoApprove || 'manual';

    const policySel = document.getElementById('settingBookerApprovalPolicy');
    if (policySel) policySel.value = myAgency?.bookerApprovalPolicy || settings.bookerApprovalPolicy || 'admin_only';

    const soundSel = document.getElementById('settingOrderSound');
    if (soundSel) soundSel.value = settings.orderSound || 'on';

    const paperSel = document.getElementById('settingPrintPaper');
    if (paperSel) paperSel.value = settings.printPaper || 'thermal80';

    const prefixInp = document.getElementById('settingBillPrefix');
    if (prefixInp) prefixInp.value = settings.billPrefix || myAgency?.billPrefix || 'ORD-';

    modal.style.display = 'flex';
};
window.closeAdvanceSettingsModal = function() {
    const modal = document.getElementById('modalAdvanceSettings');
    if (modal) modal.style.display = 'none';
};

window.saveAdvanceSettings = async function() {
    const policyVal = document.getElementById('settingBookerApprovalPolicy')?.value || 'admin_only';
    const settings = {
        autoApprove: document.getElementById('settingAutoApprove')?.value || 'manual',
        bookerApprovalPolicy: policyVal,
        orderSound: document.getElementById('settingOrderSound')?.value || 'on',
        printPaper: document.getElementById('settingPrintPaper')?.value || 'thermal80',
        billPrefix: document.getElementById('settingBillPrefix')?.value || 'ORD-'
    };

    localStorage.setItem('eb_booker_orders_settings', JSON.stringify(settings));

    if (myAgencyId && myAgencyId !== 'super-admin-hq') {
        try {
            await db.collection('agencies').doc(myAgencyId).update({
                bookerApprovalPolicy: policyVal,
                allowBookerApprove: policyVal === 'allow_bookers',
                billPrefix: settings.billPrefix
            });
            if (myAgency) {
                myAgency.bookerApprovalPolicy = policyVal;
                myAgency.allowBookerApprove = (policyVal === 'allow_bookers');
            }
        } catch(e) {
            console.warn('Sync agency settings:', e);
        }
    }

    closeAdvanceSettingsModal();

    Swal.fire({
        icon: 'success',
        title: '✅ Settings Saved!',
        text: 'Booker Orders & Dispatch settings updated successfully.',
        timer: 1500,
        showConfirmButton: false
    });
};

// ============================================
// ⚙️ SETUP MODALS & EVENTS
// ============================================
function setupModals() {
    // Select All Checkbox
    const selectAll = document.getElementById('selectAllOrders');
    if (selectAll) {
        selectAll.addEventListener('change', function() {
            const boxes = document.querySelectorAll('.order-check:not(:disabled)');
            boxes.forEach(b => b.checked = this.checked);
            updateBulkOrdersBar();
        });
    }

    // Top action buttons
    const btnPrintHub = document.getElementById('btnOpenPrintHub');
    if (btnPrintHub) btnPrintHub.addEventListener('click', openPrintHubModal);

    const btnSettings = document.getElementById('btnOpenAdvanceSettings');
    if (btnSettings) btnSettings.addEventListener('click', openAdvanceSettingsModal);

    // Bulk toolbar buttons
    const btnBulkApprove = document.getElementById('btnBulkApprove');
    if (btnBulkApprove) btnBulkApprove.addEventListener('click', handleBulkApproveAndAssign);

    const btnBulkPrint = document.getElementById('btnBulkPrint');
    if (btnBulkPrint) btnBulkPrint.addEventListener('click', handleBulkPrint);

    const btnBulkChallan = document.getElementById('btnBulkChallan');
    if (btnBulkChallan) btnBulkChallan.addEventListener('click', () => printVanLoadingChallan());

    const btnBulkRouteSheet = document.getElementById('btnBulkRouteSheet');
    if (btnBulkRouteSheet) btnBulkRouteSheet.addEventListener('click', () => printDeliveryRouteSheet());

    const btnExport = document.getElementById('btnExportCSV');
    if (btnExport) btnExport.addEventListener('click', exportOrdersCSV);
}
