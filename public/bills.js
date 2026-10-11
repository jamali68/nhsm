// ============================================
// 🧾 EASY BILL GENERATOR — PRO BILLING & OFFLINE ENGINE (PHASE 4)
// ✅ Pro Inventory Bill Generation (Direct Stock Deduction)
// ✅ Wholesale vs Retail Pricing Tier Switcher
// ✅ Offline Order Booking Queue + Automatic / Manual Cloud Sync
// ✅ Customer Khata Ledger Auto-Update & Previous Balance Tracking
// ✅ Quick Customer Creation directly from billing screen
// ✅ Barcode Scan & Quick Product Selection
// ✅ Thermal POS Slip (58mm/80mm), A4/A5 Invoice & WhatsApp Share
// ============================================

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

// ============================================
// 🌐 GLOBAL STATE
// ============================================
let myUid = null;
let myAgencyId = null;
let myAgency = null;
let myUser = null;
let billNo = '';
let allMyCustomers = [];
let allMyStock = [];
let selectedCustomer = null;
let lastSavedBill = null;
let activeRateTier = 'wholesale'; // 'wholesale' or 'retail'

// ============================================
// 📏 UNIT HELPER
// ============================================
function UNIT_LBL(u) {
    const m = {
        'kg': 'kg', 'g': 'g', 'pound': 'lb', 'maund': 'Maund', 'liter': 'L',
        'pcs': 'pcs', 'dozen': 'Dozen', 'packet': 'Pkt', 'bag': 'Bag',
        'box': 'Box', 'carton': 'Ctn', 'bottle': 'Btl', 'can': 'Can',
        'meter': 'm', 'feet': 'ft', 'gallon': 'Gal', 'unit': 'Unit'
    };
    return m[u] || u || '';
}

// ============================================
// 📶 OFFLINE QUEUE HELPERS
// ============================================
function getOfflineQueueKey() {
    return `eb_offline_orders_${myAgencyId}`;
}

function getOfflineOrders() {
    try {
        const val = localStorage.getItem(getOfflineQueueKey());
        return val ? JSON.parse(val) : [];
    } catch (e) {
        return [];
    }
}

function saveOfflineOrders(orders) {
    try {
        localStorage.setItem(getOfflineQueueKey(), JSON.stringify(orders));
        updateOfflineQueueUI();
    } catch (e) {
        console.error('Save offline orders failed:', e);
    }
}

function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    const badge = document.getElementById('netStatusBadge');
    if (badge) {
        if (isOnline) {
            badge.className = 'net-status-badge net-online';
            badge.innerHTML = '<i class="fas fa-circle" style="font-size:8px;"></i> Online';
        } else {
            badge.className = 'net-status-badge net-offline';
            badge.innerHTML = '<i class="fas fa-circle" style="font-size:8px;"></i> Offline Mode';
        }
    }
    updateOfflineQueueUI();
}

function updateOfflineQueueUI() {
    const orders = getOfflineOrders();
    const bar = document.getElementById('offlineQueueBar');
    const countEl = document.getElementById('offlineCount');
    if (bar && countEl) {
        countEl.innerText = orders.length;
        if (orders.length > 0) {
            bar.style.display = 'flex';
        } else {
            bar.style.display = 'none';
        }
    }
}

window.addEventListener('online', () => {
    updateNetworkStatus();
    // Auto-sync offline orders when network resumes
    const orders = getOfflineOrders();
    if (orders.length > 0) {
        syncAllOfflineOrders(false);
    }
});
window.addEventListener('offline', updateNetworkStatus);

// ============================================
// 👀 BILL NUMBER GENERATION (Pure Sequential Numbering / Optional Prefix)
// ============================================
function getBillPrefix() {
    if (myAgency) {
        if (typeof myAgency.billPrefix === 'string' && myAgency.billPrefix.trim() !== '') {
            return myAgency.billPrefix.trim();
        }
        if (myAgency.billPrefixes && typeof myAgency.billPrefixes.stock === 'string') {
            const p = myAgency.billPrefixes.stock.trim();
            if (p && p !== 'INV-' && p !== 'STC-') return p;
        }
    }
    return ''; // Default: Pure clean sequential number (e.g. 42)
}

function formatBillNo(prefix, num) {
    if (!prefix) return String(num);
    const p = prefix.trim();
    if (p.endsWith('-') || p.endsWith('/') || p.endsWith(' ')) {
        return p + num;
    }
    return p + '-' + num;
}

async function previewBillNo() {
    const prefix = getBillPrefix();

    if (!navigator.onLine) {
        const offOrders = getOfflineOrders();
        billNo = formatBillNo(prefix, 'OFF-' + (offOrders.length + 1));
        document.getElementById('billNoDisplay').innerText = billNo;
        return;
    }

    const counterRef = db.collection('counters').doc(myAgencyId + '_stock');
    try {
        const cDoc = await counterRef.get();
        const next = (cDoc.exists ? (cDoc.data().count || 0) : 0) + 1;
        billNo = formatBillNo(prefix, next);
    } catch (e) {
        billNo = formatBillNo(prefix, 1);
    }
    document.getElementById('billNoDisplay').innerText = billNo;
}

async function getNextLiveBillNo() {
    const prefix = getBillPrefix();

    if (!navigator.onLine) {
        return formatBillNo(prefix, 'OFF-' + Date.now().toString().slice(-4));
    }

    const counterRef = db.collection('counters').doc(myAgencyId + '_stock');
    try {
        const result = await db.runTransaction(async (tx) => {
            const cDoc = await tx.get(counterRef);
            const newCount = (cDoc.exists ? (cDoc.data().count || 0) : 0) + 1;
            tx.set(counterRef, { count: newCount, type: 'stock', updatedAt: new Date().toISOString() });
            return newCount;
        });
        return formatBillNo(prefix, result);
    } catch (e) {
        return formatBillNo(prefix, Date.now().toString().slice(-6));
    }
}

// ============================================
// 🛡️ AUTH GUARD & DATA LOADING
// ============================================
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }
    myUid = user.uid;

    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (!doc.exists) {
            window.location.href = 'dashboard.html';
            return;
        }
        myUser = doc.data();

        if (myUser.status === 'blocked' || myUser.status === 'deleted') {
            await auth.signOut();
            window.location.href = 'auth.html';
            return;
        }

        myAgencyId = myUser.agencyId;
        if (!myAgencyId) {
            Swal.fire('⚠️', 'Agency link nahi hai! Pehle Profile complete karein.', 'warning')
                .then(() => window.location.href = 'profile.html');
            return;
        }

        try {
            const agDoc = await db.collection('agencies').doc(myAgencyId).get();
            myAgency = agDoc.exists ? agDoc.data() : {};

            // ⚠️ Phase 6: Subscription Expiry Check
            if (myAgency && myAgency.subscriptionExpiry) {
                const today = new Date().toISOString().slice(0, 10);
                if (myAgency.subscriptionExpiry < today) {
                    Swal.fire({
                        icon: 'warning',
                        title: '🔒 Subscription Expired',
                        html: `Aap ki agency ka package <b>${myAgency.subscriptionExpiry}</b> ko expire ho chuka hai.<br><br>
                               Naye bills banane ke liye Super Admin ya Developer (+923346800959) se package renew karwayein.`,
                        showCancelButton: true,
                        confirmButtonText: '<i class="fab fa-whatsapp"></i> Renew via WhatsApp',
                        confirmButtonColor: '#25D366',
                        cancelButtonText: 'Close'
                    }).then(r => {
                        if (r.isConfirmed) {
                            window.open('https://wa.me/923346800959?text=' + encodeURIComponent(`Assalam-o-Alaikum! Please renew subscription for agency: ${myAgency.name || ''}`), '_blank');
                        }
                    });
                }
            }

            // Load Agency Package & Custom Limits
            let pkgLimits = { monthlyBills: 150 };
            const pkgId = myAgency.packageId || 'free';
            try {
                const pkgDoc = await db.collection('packages').doc(pkgId).get();
                if (pkgDoc.exists && pkgDoc.data().limits) {
                    pkgLimits = { ...pkgLimits, ...pkgDoc.data().limits };
                }
            } catch(e){}
            if (myAgency.customLimits) {
                pkgLimits = { ...pkgLimits, ...myAgency.customLimits };
            }
            window.ebAgencyLimits = pkgLimits;
        } catch (e) {}

        myAgency = myAgency || {};
        myAgency.ownerName = (myUser.name || '').trim();
        myAgency.ownerMobile = (myUser.mobile || '').trim();

        const agLabel = document.getElementById('agencyNameLabel');
        if (agLabel && myAgency.name) {
            agLabel.innerText = '📦 ' + myAgency.name;
        }

        const dateEl = document.getElementById('billDateDisplay');
        if (dateEl) {
            dateEl.innerText = '📅 ' + new Date().toLocaleDateString('en-PK', {day:'numeric', month:'short', year:'numeric'});
        }

        // 📕 Booker Role Customization: Field Order Mode
        if (myUser && myUser.role === 'booker') {
            const saveBtn = document.getElementById('saveBillBtn');
            const bookBtn = document.getElementById('bookFieldOrderBtn');
            if (saveBtn) saveBtn.style.display = 'none'; // Only field orders for bookers
            if (bookBtn) {
                bookBtn.style.width = '100%';
                bookBtn.style.flex = '1 1 100%';
            }
            const brandSub = document.querySelector('.brand-sub');
            if (brandSub) brandSub.innerText = `📕 Order Booker Mode: ${myUser.name || 'Staff'}`;
        }

        // Setup rate tier buttons
        setupRateTiers();

        // Load cached & live data
        try {
            loadCustomers();
        } catch (e) {
            console.warn('loadCustomers error:', e);
        }

        try {
            loadStock();
        } catch (e) {
            console.warn('loadStock error:', e);
        }

        // Initial preview bill number & initial item row
        try {
            previewBillNo();
        } catch (e) {
            console.warn('previewBillNo error:', e);
        }

        try {
            addRow();
        } catch (e) {
            console.warn('addRow error:', e);
        }

        // Setup Offline queue listener
        updateNetworkStatus();

        // 📱 Initialize Visual Catalogue Order Booking System
        initVisualCatalogue();

    } catch (error) {
        console.error('Bills init error:', error);
        Swal.fire('Error', 'Billing load error: ' + (error.code || error.message), 'error');
    }
});

// ============================================
// 🏪 WHOLESALE vs 🏷️ RETAIL TIER SWITCHER
// ============================================
function setupRateTiers() {
    const btnW = document.getElementById('btnWholesaleRate');
    const btnR = document.getElementById('btnRetailRate');

    if (btnW) {
        btnW.addEventListener('click', () => {
            setRateTier('wholesale');
        });
    }

    if (btnR) {
        btnR.addEventListener('click', () => {
            setRateTier('retail');
        });
    }

    // 👁️ Check if Rate Bar should be Shown or Hidden from Agency Profile settings
    const rateBar = document.getElementById('rateTierBarContainer');
    if (rateBar) {
        if (myAgency && (myAgency.allowRateSwitch === 'no' || myAgency.allowRateSwitch === false)) {
            rateBar.style.display = 'none'; // 🙈 Completely Hide from screen!
        } else {
            rateBar.style.display = 'flex'; // 👁️ Show normally and fully clickable!
            rateBar.style.opacity = '1';
            rateBar.style.pointerEvents = 'auto';
        }
    }
}

function setRateTier(tier, showNotice = false) {
    activeRateTier = tier;
    const btnW = document.getElementById('btnWholesaleRate');
    const btnR = document.getElementById('btnRetailRate');
    if (btnW && btnR) {
        if (tier === 'wholesale') {
            btnW.classList.add('active');
            btnR.classList.remove('active');
        } else {
            btnR.classList.add('active');
            btnW.classList.remove('active');
        }
    }
    applyRateTierToRows();
    if (typeof updateCatalogueRateTier === 'function') {
        updateCatalogueRateTier();
    }
    if (showNotice) {
        const popupSetting = localStorage.getItem('eb_cust_type_popup') || (myAgency && myAgency.custTypePopupMode) || 'hide';
        if (popupSetting === 'show') {
            const lbl = tier === 'wholesale' ? '🏪 Wholesale Rate' : '🏷️ Retail Rate';
            Swal.fire({
                toast: true, position: 'top-end', showConfirmButton: false,
                timer: 1600, icon: 'info', title: `✅ ${lbl} Auto-applied!`
            });
        }
    }
}

function applyRateTierToRows() {
    document.querySelectorAll('#itemsRows .item-row').forEach(row => {
        const nameInput = row.querySelector('.ir-name');
        const rateInput = row.querySelector('.ir-rate');
        const stockId = nameInput.dataset.stockId;
        if (stockId) {
            const s = allMyStock.find(x => x.id === stockId);
            if (s) {
                const targetRate = activeRateTier === 'wholesale' 
                    ? (s.wholesaleRate || s.rate || 0) 
                    : (s.retailRate || s.rate || 0);
                rateInput.value = targetRate;
                const qty = parseFloat(row.querySelector('.ir-qty').value) || 0;
                row.querySelector('.row-total').innerText = 'Rs ' + (qty * targetRate).toFixed(2);
            }
        }
    });
    calcTotals();
}

// ============================================
// 👥 CUSTOMER MANAGEMENT & KHATA LINKING
// ============================================
function selectCustomerObject(c) {
    if (!c) return;
    selectedCustomer = c;
    const custInput = document.getElementById('custNameInput');
    const custSuggest = document.getElementById('custSuggest');
    const custInfoBox = document.getElementById('custInfoBox');

    if (custInput) custInput.value = c.name;
    if (custSuggest) custSuggest.classList.remove('show');

    // 🎯 AUTO-SELECT WHOLESALE vs RETAIL BASED ON CUSTOMER TYPE!
    if (c.customerType === 'wholesale') {
        setRateTier('wholesale', true);
    } else if (c.customerType === 'retail') {
        setRateTier('retail', true);
    }

    let info = '';
    if (c.shopName) info += `🏬 <b>${c.shopName}</b> &nbsp;|&nbsp; `;
    if (c.mobile) info += `📱 ${c.mobile} &nbsp;|&nbsp; `;
    if (c.route) info += `🛣️ Route: ${c.route} &nbsp;|&nbsp; `;
    if (c.customerType) info += `🏷️ Type: <b>${c.customerType.toUpperCase()}</b> &nbsp;|&nbsp; `;

    // 🇵🇰 NTN & FBR Filer / Non-Filer badge
    const ntnVal = c.ntn || c.custNTN || '';
    const isFiler = c.fbrStatus === 'filer' || (ntnVal && c.fbrStatus !== 'non-filer');
    if (ntnVal) {
        info += `🔢 NTN: <b>${ntnVal}</b> <span style="font-size:10px; font-weight:800; padding:1px 6px; border-radius:4px; ${isFiler ? 'background:#dcfce7; color:#15803d; border:1px solid #86efac;' : 'background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;'}">${isFiler ? '🟢 FILER' : '🔴 NON-FILER'}</span> &nbsp;|&nbsp; `;
    } else if (c.fbrStatus) {
        info += `<span style="font-size:10px; font-weight:800; padding:1px 6px; border-radius:4px; ${isFiler ? 'background:#dcfce7; color:#15803d; border:1px solid #86efac;' : 'background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;'}">${isFiler ? '🟢 FILER' : '🔴 NON-FILER'}</span> &nbsp;|&nbsp; `;
    }

    const prevBal = parseFloat(c.balance || 0);
    info += `
    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-top:8px; padding-top:6px; border-top:1px dashed #cbd5e1;">
        <span class="cust-balance-chip" style="font-size:13px; font-weight:800; color:#b45309; background:#fef3c7; border:1px solid #fde68a; padding:4px 10px; border-radius:8px;">
            💰 Previous Khata Balance: <b>Rs ${prevBal.toLocaleString()}</b> <span class="ur-sub">(پچھلا بقایا کھاتہ)</span>
        </span>
        ${prevBal > 0 ? `
        <button type="button" class="btn btn-sm" onclick="openQuickKhataRecoveryModal('${c.id}')" style="background:#16a34a; color:#fff; font-weight:800; font-size:12px; padding:6px 12px; border-radius:8px; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(22,163,74,0.3);">
            <i class="fas fa-hand-holding-usd"></i> 💵 Receive Previous Bill Cash (پچھلی رقم وصول کریں)
        </button>` : ''}
    </div>`;

    // 🇵🇰 Auto-Apply FBR Advance Tax Rate (Filer vs Non-Filer)
    const fbrEnabled = (typeof myAgency !== 'undefined' && myAgency && myAgency.enableFbrTax === true) || (localStorage.getItem('eb_enable_fbr_tax') === 'yes');
    const filerTaxRate = (typeof myAgency !== 'undefined' && myAgency && myAgency.filerTaxRate !== undefined) ? myAgency.filerTaxRate : (parseFloat(localStorage.getItem('eb_filer_tax_rate')) || 1.5);
    const nonFilerTaxRate = (typeof myAgency !== 'undefined' && myAgency && myAgency.nonFilerTaxRate !== undefined) ? myAgency.nonFilerTaxRate : (parseFloat(localStorage.getItem('eb_nonfiler_tax_rate')) || 3.0);

    const taxEnabled = document.getElementById('taxEnabled');
    const taxRateInput = document.getElementById('taxRate');
    if (taxEnabled) {
        if (fbrEnabled) {
            taxEnabled.checked = true;
            if (taxRateInput) {
                taxRateInput.value = isFiler ? filerTaxRate : nonFilerTaxRate;
            }
        } else {
            // When FBR Tax switch is OFF, ensure tax is unchecked and 0% for simple DigiKhata-style billing
            taxEnabled.checked = false;
            if (taxRateInput) {
                taxRateInput.value = '0';
            }
        }
    }
    
    if (custInfoBox) {
        custInfoBox.innerHTML = info;
        custInfoBox.classList.add('show');
    }

    if (typeof syncCatalogueCustomer === 'function') {
        syncCatalogueCustomer(c);
    }

    calcTotals();
}

function loadCustomers() {
    // 1. Try local cache first (Quota shield)
    try {
        const cached = localStorage.getItem(`eb_cust_cache_${myAgencyId}`);
        if (cached) {
            allMyCustomers = JSON.parse(cached);
        }
    } catch (e) {}

    // Check preselected customer
    const checkPreselect = () => {
        const preselectStr = sessionStorage.getItem('preselectCustomer');
        if (preselectStr) {
            try {
                const parsed = JSON.parse(preselectStr);
                sessionStorage.removeItem('preselectCustomer');
                const found = allMyCustomers.find(x => x.id === parsed.id) || parsed;
                selectCustomerObject(found);
            } catch (e) {
                sessionStorage.removeItem('preselectCustomer');
            }
        }
    };
    checkPreselect();

    // ⚡ Quota Saver: Check if shift is already synced
    const syncConf = (window.CloudSync && typeof window.CloudSync.getSettings === 'function') 
        ? window.CloudSync.getSettings(myAgencyId) 
        : { syncMode: 'shift_schedule' };
    const syncStatus = (window.CloudSync && typeof window.CloudSync.getSyncStatus === 'function') 
        ? window.CloudSync.getSyncStatus(myAgencyId) 
        : { isShiftSynced: false };

    if (syncConf.syncMode !== 'realtime' && syncStatus.isShiftSynced && allMyCustomers.length > 0) {
        if (window.CloudSync) window.CloudSync.recordReadsSaved(myAgencyId, allMyCustomers.length);
        return; // Zero Firestore reads!
    }

    // 2. Fetch from Firestore (Realtime onSnapshot or Single .get())
    if (syncConf.syncMode === 'realtime') {
        db.collection('customers')
            .where('agencyId', '==', myAgencyId)
            .onSnapshot((snap) => {
                allMyCustomers = [];
                snap.forEach(d => allMyCustomers.push({ id: d.id, ...d.data() }));
                localStorage.setItem(`eb_cust_cache_${myAgencyId}`, JSON.stringify(allMyCustomers));
                checkPreselect();
            }, (e) => console.warn('Customers load:', e.code));
    } else {
        db.collection('customers')
            .where('agencyId', '==', myAgencyId)
            .get()
            .then((snap) => {
                allMyCustomers = [];
                snap.forEach(d => allMyCustomers.push({ id: d.id, ...d.data() }));
                localStorage.setItem(`eb_cust_cache_${myAgencyId}`, JSON.stringify(allMyCustomers));
                checkPreselect();
            })
            .catch((e) => console.warn('Customers load:', e.code));
    }
}

// Customer Input Autocomplete
const custInput = document.getElementById('custNameInput');
const custSuggest = document.getElementById('custSuggest');
const custInfoBox = document.getElementById('custInfoBox');

custInput.addEventListener('input', function() {
    const val = this.value.toLowerCase().trim();
    selectedCustomer = null;
    custInfoBox.classList.remove('show');
    calcTotals();

    if (!val) { custSuggest.classList.remove('show'); return; }

    const matches = allMyCustomers.filter(c =>
        (c.name || '').toLowerCase().includes(val) ||
        (c.mobile || '').includes(val) ||
        (c.shopName || '').toLowerCase().includes(val)
    );

    if (matches.length === 0) {
        custSuggest.classList.remove('show');
        return;
    }

    let html = '';
    matches.slice(0, 8).forEach(c => {
        const typeBadge = c.customerType === 'retail'
            ? `<span style="font-size:10px; font-weight:800; padding:2px 7px; border-radius:10px; background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; margin-left:6px;">🏷️ RETAIL</span>`
            : `<span style="font-size:10px; font-weight:800; padding:2px 7px; border-radius:10px; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; margin-left:6px;">🏪 WHOLESALE</span>`;
        html += `
        <div class="suggest-item" data-id="${c.id}">
            <b>👤 ${c.name}</b> ${c.shopName ? `(${c.shopName})` : ''} ${typeBadge}<br>
            <span class="s-sub">
                ${c.mobile ? '📱 ' + c.mobile : ''} 
                ${c.route ? '| 🛣️ ' + c.route : ''}
                | 💰 Balance: <b>Rs ${(c.balance || 0).toLocaleString()}</b>
            </span>
        </div>`;
    });
    custSuggest.innerHTML = html;
    custSuggest.classList.add('show');

    custSuggest.querySelectorAll('.suggest-item').forEach(el => {
        el.addEventListener('click', function() {
            const c = allMyCustomers.find(x => x.id === this.dataset.id);
            if (!c) return;
            selectCustomerObject(c);
        });
    });
});

document.addEventListener('click', (e) => {
    if (!custInput.contains(e.target) && !custSuggest.contains(e.target)) {
        custSuggest.classList.remove('show');
    }
});

// ➕ QUICK ADD CUSTOMER MODAL
document.getElementById('quickAddCustBtn').addEventListener('click', async () => {
    const { value: formValues } = await Swal.fire({
        title: '➕ Quick Add New Customer',
        html: `
            <div style="text-align:left; font-size:13px;">
                <label><b>Customer / Contact Name *</b></label>
                <input id="swalCustName" class="swal2-input" placeholder="e.g. Aslam Khan" style="margin-top:4px; margin-bottom:12px;">
                <label><b>Customer Type (ریٹ کی کیٹیگری) *</b></label>
                <select id="swalCustType" class="swal2-input" style="margin-top:4px; margin-bottom:12px; height:42px;">
                    <option value="wholesale" selected>🏪 Wholesale Customer (ہول سیل ریٹ)</option>
                    <option value="retail">🏷️ Retail Customer (پرچون ریٹ)</option>
                </select>
                <label><b>Shop / Business Name</b></label>
                <input id="swalShopName" class="swal2-input" placeholder="e.g. Bismillah Kiryana Store" style="margin-top:4px; margin-bottom:12px;">
                <label><b>Mobile Number</b></label>
                <input id="swalMobile" class="swal2-input" placeholder="03001234567" style="margin-top:4px; margin-bottom:12px;">
                <label><b>Route / Area</b></label>
                <input id="swalRoute" class="swal2-input" placeholder="e.g. Main Bazar Route" style="margin-top:4px; margin-bottom:12px;">
                <label><b>Opening Balance (Rs)</b></label>
                <input id="swalBal" type="number" class="swal2-input" placeholder="0" style="margin-top:4px;">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '✅ Save & Select',
        confirmButtonColor: '#27ae60',
        preConfirm: () => {
            const name = document.getElementById('swalCustName').value.trim();
            if (!name) {
                Swal.showValidationMessage('Customer Name lazmi hai!');
                return false;
            }
            return {
                name: name,
                customerType: document.getElementById('swalCustType').value,
                shopName: document.getElementById('swalShopName').value.trim(),
                mobile: document.getElementById('swalMobile').value.trim(),
                route: document.getElementById('swalRoute').value.trim(),
                balance: parseFloat(document.getElementById('swalBal').value) || 0
            };
        }
    });

    if (formValues) {
        try {
            const custData = {
                ...formValues,
                agencyId: myAgencyId,
                createdBy: myUid,
                createdAt: new Date().toISOString()
            };

            let newId = 'cust_' + Date.now();
            if (navigator.onLine) {
                const docRef = await db.collection('customers').add(custData);
                newId = docRef.id;
            }

            const newCust = { id: newId, ...custData };
            allMyCustomers.unshift(newCust);
            selectCustomerObject(newCust);

            Swal.fire({
                toast: true, position: 'top-end', showConfirmButton: false,
                timer: 1600, icon: 'success', title: '✅ Customer added & selected!'
            });
        } catch (e) {
            Swal.fire('Error', 'Customer add failed: ' + e.message, 'error');
        }
    }
});

// ============================================
// 📦 STOCK LOADING & BARCODE SCANNER
// ============================================
function loadStock() {
    // 1. Try local stock cache (Quota shield)
    try {
        const cached = localStorage.getItem(`eb_stock_cache_${myAgencyId}`);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed.items)) allMyStock = parsed.items;
        }
    } catch (e) {}

    if (allMyStock.length > 0 && typeof refreshCatalogueData === 'function') {
        refreshCatalogueData();
    }

    // ⚡ Quota Saver: Check if shift is already synced
    const syncConf = (window.CloudSync && typeof window.CloudSync.getSettings === 'function') 
        ? window.CloudSync.getSettings(myAgencyId) 
        : { syncMode: 'shift_schedule' };
    const syncStatus = (window.CloudSync && typeof window.CloudSync.getSyncStatus === 'function') 
        ? window.CloudSync.getSyncStatus(myAgencyId) 
        : { isShiftSynced: false };

    if (syncConf.syncMode !== 'realtime' && syncStatus.isShiftSynced && allMyStock.length > 0) {
        if (window.CloudSync && typeof window.CloudSync.recordReadsSaved === 'function') {
            window.CloudSync.recordReadsSaved(myAgencyId, allMyStock.length);
        }
        return; // Zero Firestore reads!
    }

    // 2. Fetch fresh stock from Firestore (Realtime or Single .get())
    if (syncConf.syncMode === 'realtime') {
        db.collection('stock')
            .where('agencyId', '==', myAgencyId)
            .onSnapshot((snap) => {
                allMyStock = [];
                snap.forEach(d => {
                    const item = { id: d.id, ...d.data() };
                    if (item.retailRate === undefined) item.retailRate = item.rate || 0;
                    if (item.wholesaleRate === undefined) item.wholesaleRate = item.rate || 0;
                    allMyStock.push(item);
                });
                allMyStock.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                localStorage.setItem(`eb_stock_cache_${myAgencyId}`, JSON.stringify({ items: allMyStock, timestamp: new Date().toISOString() }));
                if (typeof refreshCatalogueData === 'function') {
                    refreshCatalogueData();
                }
            }, (e) => console.warn('Stock load:', e.code));
    } else {
        db.collection('stock')
            .where('agencyId', '==', myAgencyId)
            .get()
            .then((snap) => {
                allMyStock = [];
                snap.forEach(d => {
                    const item = { id: d.id, ...d.data() };
                    if (item.retailRate === undefined) item.retailRate = item.rate || 0;
                    if (item.wholesaleRate === undefined) item.wholesaleRate = item.rate || 0;
                    allMyStock.push(item);
                });
                allMyStock.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                localStorage.setItem(`eb_stock_cache_${myAgencyId}`, JSON.stringify({ items: allMyStock, timestamp: new Date().toISOString() }));
                if (typeof refreshCatalogueData === 'function') {
                    refreshCatalogueData();
                }
            })
            .catch((e) => console.warn('Stock load:', e.code));
    }
}

// ⚡ Listen for central CloudSync updates
window.addEventListener('eb-data-synced', (e) => {
    if (e.detail && e.detail.agencyId === myAgencyId) {
        if (Array.isArray(e.detail.stock)) {
            allMyStock = e.detail.stock;
            if (typeof refreshCatalogueData === 'function') refreshCatalogueData();
        }
        if (Array.isArray(e.detail.customers)) {
            allMyCustomers = e.detail.customers;
        }
    }
});

// ============================================
// 🔊 SCANNER AUDIO BEEP & CAMERA BARCODE ENGINE
// ============================================
function playScanBeep() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
}

let lastScannedCode = '';
let lastScanTime = 0;

function handleScannedBarcode(rawCode) {
    if (!rawCode) return;
    const code = String(rawCode).trim();
    if (!code) return;

    // Prevent duplicate triggers within 1.3 seconds
    const now = Date.now();
    if (code === lastScannedCode && (now - lastScanTime) < 1300) {
        return;
    }
    lastScannedCode = code;
    lastScanTime = now;

    const codeLower = code.toLowerCase();
    const matched = allMyStock.find(s => 
        (s.barcode && String(s.barcode).trim().toLowerCase() === codeLower) ||
        (s.id && String(s.id).trim().toLowerCase() === codeLower)
    );

    const statusEl = document.getElementById('scannerStatusText');

    if (!matched) {
        if (statusEl) statusEl.innerHTML = `<span style="color:#ef4444;">⚠️ Barcode "${code}" not found!</span>`;
        Swal.fire({
            toast: true, position: 'top-end', showConfirmButton: false,
            timer: 2000, icon: 'warning', title: `⚠️ Barcode "${code}" not in stock!`
        });
        return;
    }

    playScanBeep();
    addItemToRows(matched);

    const rate = activeRateTier === 'wholesale' ? (matched.wholesaleRate || matched.rate || 0) : (matched.retailRate || matched.rate || 0);
    if (statusEl) {
        statusEl.innerHTML = `✅ Added: <b>${matched.name}</b> (Rs ${rate})`;
    }
    Swal.fire({
        toast: true, position: 'top-end', showConfirmButton: false,
        timer: 1500, icon: 'success', title: `✅ Added: ${matched.name}`
    });
}

// 📷 Camera Scanner Controls
let html5QrScanner = null;

function openCameraScanner() {
    const modal = document.getElementById('cameraScannerModal');
    if (!modal) return;
    modal.style.display = 'flex';
    const statusEl = document.getElementById('scannerStatusText');
    if (statusEl) statusEl.innerText = '📷 Camera activating...';

    try {
        if (typeof Html5Qrcode === 'undefined') {
            if (statusEl) statusEl.innerText = '⚠️ Scanner library loading... please retry in 2 seconds.';
            return;
        }

        if (!html5QrScanner) {
            html5QrScanner = new Html5Qrcode("scannerReader");
        }

        const config = {
            fps: 15,
            qrbox: { width: 280, height: 180 },
            aspectRatio: 1.333
        };

        // Try environment camera (mobile back camera), fallback to user camera (laptop front webcam)
        html5QrScanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                handleScannedBarcode(decodedText);
            },
            () => {}
        ).catch(err => {
            console.warn("Back camera unavailable, attempting front/default webcam:", err);
            html5QrScanner.start(
                { facingMode: "user" },
                config,
                (decodedText) => {
                    handleScannedBarcode(decodedText);
                },
                () => {}
            ).catch(e2 => {
                console.error("Camera access failed:", e2);
                if (statusEl) statusEl.innerText = '⚠️ Camera permission denied or webcam not detected.';
            });
        });
    } catch (e) {
        console.error("Camera scanner exception:", e);
        if (statusEl) statusEl.innerText = '⚠️ Camera scanner error.';
    }
}

function closeCameraScanner() {
    const modal = document.getElementById('cameraScannerModal');
    if (modal) modal.style.display = 'none';
    if (html5QrScanner) {
        try {
            html5QrScanner.stop().catch(() => {});
        } catch (e) {}
    }
}

const openCamBtn = document.getElementById('openCameraBtn');
if (openCamBtn) openCamBtn.addEventListener('click', openCameraScanner);

const closeCamBtn = document.getElementById('closeCameraBtn');
if (closeCamBtn) closeCamBtn.addEventListener('click', closeCameraScanner);

// Barcode Scan / Fast Product Input (Hardware Guns or typing)
const barcodeInput = document.getElementById('barcodeScanInput');
const barcodeSuggest = document.getElementById('barcodeSuggest');

if (barcodeInput) {
    barcodeInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const code = this.value.trim().toLowerCase();
            if (!code) return;

            // Direct scan handling
            handleScannedBarcode(code);
            this.value = '';
            if (barcodeSuggest) barcodeSuggest.classList.remove('show');
        }
    });

    barcodeInput.addEventListener('input', function() {
        const val = this.value.toLowerCase().trim();
        if (!val) { if (barcodeSuggest) barcodeSuggest.classList.remove('show'); return; }

        const matches = allMyStock.filter(s =>
            (s.name || '').toLowerCase().includes(val) ||
            (s.barcode || '').includes(val) ||
            (s.category || '').toLowerCase().includes(val)
        );

        if (matches.length === 0) {
            if (barcodeSuggest) barcodeSuggest.classList.remove('show');
            return;
        }

        let html = '';
        matches.slice(0, 6).forEach(s => {
            const rate = activeRateTier === 'wholesale' ? (s.wholesaleRate || s.rate || 0) : (s.retailRate || s.rate || 0);
            const schemeTag = s.hasScheme ? `<span style="background:#fdf4ff; color:#a21caf; border:1px solid #f0abfc; padding:1px 5px; border-radius:6px; font-size:10px; font-weight:bold; margin-left:4px;">🎁 ${s.schemeLabel || 'Scheme'}</span>` : '';
            const thumb = s.photoUrl ? `<img src="${s.photoUrl}" style="width:24px; height:24px; border-radius:4px; object-fit:cover; margin-right:6px; vertical-align:middle;">` : '';
            html += `
            <div class="suggest-item" data-sid="${s.id}">
                <b>${thumb}${s.name}</b> ${s.barcode ? `(${s.barcode})` : ''} ${schemeTag}<br>
                <span class="s-sub">
                    📦 Stock: <b>${s.qty || 0} ${UNIT_LBL(s.unit)}</b> | 💰 ${activeRateTier === 'wholesale' ? 'Wholesale' : 'Retail'}: Rs ${rate}
                </span>
            </div>`;
        });
        if (barcodeSuggest) {
            barcodeSuggest.innerHTML = html;
            barcodeSuggest.classList.add('show');

            barcodeSuggest.querySelectorAll('.suggest-item').forEach(el => {
                el.addEventListener('click', () => {
                    const s = allMyStock.find(x => x.id === el.dataset.sid);
                    if (s) {
                        addItemToRows(s);
                        barcodeInput.value = '';
                        barcodeSuggest.classList.remove('show');
                    }
                });
            });
        }
    });

    document.addEventListener('click', (e) => {
        if (barcodeInput && barcodeSuggest && !barcodeInput.contains(e.target) && !barcodeSuggest.contains(e.target)) {
            barcodeSuggest.classList.remove('show');
        }
    });
}

function addItemToRows(stockItem) {
    // Check if item is already in rows, if so, just increase Qty!
    let existingRow = null;
    let emptyRow = null;
    document.querySelectorAll('#itemsRows .item-row').forEach(row => {
        const input = row.querySelector('.ir-name');
        if (input && input.dataset.stockId === stockItem.id) {
            existingRow = row;
        } else if (input && !input.dataset.stockId && !input.value.trim() && !emptyRow) {
            emptyRow = row;
        }
    });

    if (existingRow) {
        const qtyInp = existingRow.querySelector('.ir-qty');
        const rateInp = existingRow.querySelector('.ir-rate');
        const currentQty = parseFloat(qtyInp.value) || 0;
        qtyInp.value = currentQty + 1;
        const total = (currentQty + 1) * (parseFloat(rateInp.value) || 0);
        existingRow.querySelector('.row-total').innerText = 'Rs ' + total.toFixed(2);
        calcTotals();
        return;
    }

    // Otherwise add or populate
    const rate = activeRateTier === 'wholesale' 
        ? (stockItem.wholesaleRate || stockItem.rate || 0) 
        : (stockItem.retailRate || stockItem.rate || 0);

    if (emptyRow) {
        const nameInput = emptyRow.querySelector('.ir-name');
        const qtyInput = emptyRow.querySelector('.ir-qty');
        const rateInput = emptyRow.querySelector('.ir-rate');
        const hint = emptyRow.querySelector('.stock-hint');

        nameInput.value = stockItem.name;
        nameInput.dataset.stockId = stockItem.id;
        qtyInput.value = 1;
        rateInput.value = rate;

        hint.style.display = 'inline-block';
        const colorClass = (stockItem.qty || 0) <= 0 ? 'stock-out' : ((stockItem.qty || 0) <= 10 ? 'stock-low' : 'stock-ok');
        let hintContent = `Available: <span class="stock-badge ${colorClass}"><b>${stockItem.qty || 0} ${UNIT_LBL(stockItem.unit)}</b></span>`;
        if (stockItem.hasScheme) {
            hintContent += ` <span style="background:#fdf4ff; color:#a21caf; border:1px solid #f0abfc; padding:1px 6px; border-radius:6px; font-size:10px; font-weight:bold;">🎁 ${stockItem.schemeLabel || 'Scheme'}</span>`;
        }
        hint.innerHTML = hintContent;
        emptyRow.querySelector('.row-total').innerText = 'Rs ' + rate.toFixed(2);
        calcTotals();
        return;
    }

    addRow({
        name: stockItem.name,
        stockId: stockItem.id,
        qty: 1,
        rate: rate,
        unit: stockItem.unit,
        availableQty: stockItem.qty || 0,
        hasScheme: stockItem.hasScheme,
        schemeLabel: stockItem.schemeLabel
    });
}

// ============================================
// 📝 INVOICE ITEM ROWS LOGIC
// ============================================
document.getElementById('addItemRowBtn').addEventListener('click', () => addRow());

function addRow(data = {}) {
    const rowsDiv = document.getElementById('itemsRows');
    const rowId = 'row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);

    const row = document.createElement('div');
    row.className = 'item-row';
    row.id = rowId;
    row.innerHTML = `
        <button type="button" class="row-del" onclick="removeRow('${rowId}')">✖</button>
        <div class="row-grid">
            <div style="position:relative;">
                <input type="text" class="ir-name" placeholder="Search product name or barcode..." 
                       value="${data.name || ''}" autocomplete="off" required>
                <div class="suggest-box ir-suggest"></div>
            </div>
            <div class="row-qty-rate">
                <input type="number" class="ir-qty" placeholder="Qty" min="0.01" step="0.01" value="${data.qty || 1}">
                <input type="number" class="ir-rate" placeholder="Rate" min="0" step="0.01" value="${data.rate || 0}">
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <div class="stock-hint" style="display:none;"></div>
            <div class="row-total">Rs 0.00</div>
        </div>
    `;
    rowsDiv.appendChild(row);

    const nameInput = row.querySelector('.ir-name');
    const qtyInput = row.querySelector('.ir-qty');
    const rateInput = row.querySelector('.ir-rate');
    const suggest = row.querySelector('.ir-suggest');
    const hint = row.querySelector('.stock-hint');

    if (data.stockId) {
        nameInput.dataset.stockId = data.stockId;
        hint.style.display = 'inline-block';
        const colorClass = (data.availableQty || 0) <= 0 ? 'stock-out' : ((data.availableQty || 0) <= 10 ? 'stock-low' : 'stock-ok');
        let hintContent = `Available: <span class="stock-badge ${colorClass}"><b>${data.availableQty || 0} ${UNIT_LBL(data.unit)}</b></span>`;
        if (data.hasScheme) {
            hintContent += ` <span style="background:#fdf4ff; color:#a21caf; border:1px solid #f0abfc; padding:1px 6px; border-radius:6px; font-size:10px; font-weight:bold;">🎁 ${data.schemeLabel || 'Scheme'}</span>`;
        }
        hint.innerHTML = hintContent;
    }

    [qtyInput, rateInput].forEach(inp => {
        inp.addEventListener('input', () => {
            const t = (parseFloat(qtyInput.value) || 0) * (parseFloat(rateInput.value) || 0);
            row.querySelector('.row-total').innerText = 'Rs ' + t.toFixed(2);
            calcTotals();
        });
    });

    // Stock Suggestions for inline row typing
    nameInput.addEventListener('input', function() {
        const val = this.value.toLowerCase().trim();
        if (!val) { suggest.classList.remove('show'); return; }

        const matches = allMyStock.filter(s =>
            (s.name || '').toLowerCase().includes(val) ||
            (s.barcode || '').includes(val)
        );

        if (matches.length === 0) {
            suggest.classList.remove('show');
            return;
        }

        let html = '';
        matches.slice(0, 8).forEach(s => {
            const stockColor = (s.qty || 0) <= 0 ? '#ef4444' : '#16a34a';
            const rate = activeRateTier === 'wholesale' ? (s.wholesaleRate || s.rate || 0) : (s.retailRate || s.rate || 0);
            const chosenRate = activeRateTier === 'wholesale' ? (s.wholesaleRate || s.rate || 0) : (s.retailRate || s.rate || 0);
            const schemeTag = s.hasScheme ? `<span style="background:#fdf4ff; color:#a21caf; border:1px solid #f0abfc; padding:1px 5px; border-radius:6px; font-size:10px; font-weight:bold; margin-left:4px;">🎁 ${s.schemeLabel || 'Scheme'}</span>` : '';
            const thumb = s.photoUrl ? `<img src="${s.photoUrl}" style="width:22px; height:22px; border-radius:4px; object-fit:cover; margin-right:4px; vertical-align:middle;">` : '';
            html += `
            <div class="suggest-item" data-sid="${s.id}">
                <b>${thumb}${s.name}</b> ${s.barcode ? `[${s.barcode}]` : ''} ${schemeTag}<br>
                <span class="s-sub">
                    📦 <b style="color:${stockColor};">${s.qty || 0} ${UNIT_LBL(s.unit)}</b> 
                    | 💰 ${activeRateTier === 'wholesale' ? 'Wholesale' : 'Retail'}: Rs ${chosenRate}
                </span>
            </div>`;
        });
        suggest.innerHTML = html;
        suggest.classList.add('show');

        suggest.querySelectorAll('.suggest-item').forEach(el => {
            el.addEventListener('click', function() {
                const s = allMyStock.find(x => x.id === this.dataset.sid);
                if (!s) return;

                nameInput.value = s.name;
                nameInput.dataset.stockId = s.id;
                qtyInput.value = 1;

                const chosenRate = activeRateTier === 'wholesale' 
                    ? (s.wholesaleRate || s.rate || 0) 
                    : (s.retailRate || s.rate || 0);
                rateInput.value = chosenRate;

                suggest.classList.remove('show');

                hint.style.display = 'inline-block';
                const colorClass = (s.qty || 0) <= 0 ? 'stock-out' : ((s.qty || 0) <= 10 ? 'stock-low' : 'stock-ok');
                let hintContent = `Available: <span class="stock-badge ${colorClass}"><b>${s.qty || 0} ${UNIT_LBL(s.unit)}</b></span>`;
                if (s.hasScheme) {
                    hintContent += ` <span style="background:#fdf4ff; color:#a21caf; border:1px solid #f0abfc; padding:1px 6px; border-radius:6px; font-size:10px; font-weight:bold;">🎁 ${s.schemeLabel || 'Scheme'}</span>`;
                }
                hint.innerHTML = hintContent;

                row.querySelector('.row-total').innerText = 'Rs ' + (1 * chosenRate).toFixed(2);
                calcTotals();
            });
        });
    });

    if (data.name) {
        row.querySelector('.row-total').innerText = 'Rs ' + ((data.qty || 0) * (data.rate || 0)).toFixed(2);
    } else {
        // Auto-focus and scroll into view on mobile/desktop
        setTimeout(() => {
            nameInput.focus();
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
    }

    calcTotals();
    return row;
}

function removeRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
    calcTotals();
}

// ============================================
// 🧮 TOTALS & KHATA RUNNING BALANCE CALCULATION
// ============================================
function calcTotals() {
    let subTotal = 0;
    document.querySelectorAll('#itemsRows .item-row').forEach(row => {
        const qty = parseFloat(row.querySelector('.ir-qty').value) || 0;
        const rate = parseFloat(row.querySelector('.ir-rate').value) || 0;
        subTotal += qty * rate;
    });

    const discount = parseFloat(document.getElementById('sumDiscount').value) || 0;
    
    // Tax Calculation
    const taxEnabled = document.getElementById('taxEnabled');
    const taxRateInput = document.getElementById('taxRate');
    let taxAmount = 0;
    if (taxEnabled && taxEnabled.checked && taxRateInput) {
        const taxRate = parseFloat(taxRateInput.value) || 0;
        if (taxRate > 0) taxAmount = ((subTotal - discount) * taxRate) / 100;
    }

    const currentBillTotal = Math.max(0, (subTotal - discount) + taxAmount);
    const prevBal = selectedCustomer ? (selectedCustomer.balance || 0) : 0;
    const totalPayable = prevBal + currentBillTotal;
    const received = parseFloat(document.getElementById('sumReceived').value) || 0;
    const newRemainingBalance = totalPayable - received;

    document.getElementById('sumSubTotal').innerText = subTotal.toFixed(2);
    document.getElementById('sumGrand').innerText = totalPayable.toFixed(2);
    document.getElementById('sumPrevBalance').innerText = prevBal.toFixed(2);
    document.getElementById('sumTax').innerText = taxAmount.toFixed(2);
    document.getElementById('sumBalance').innerText = newRemainingBalance.toFixed(2);
}

document.getElementById('sumDiscount').addEventListener('input', calcTotals);
document.getElementById('sumReceived').addEventListener('input', calcTotals);
document.getElementById('taxEnabled').addEventListener('change', calcTotals);
document.getElementById('taxRate').addEventListener('input', calcTotals);

// ============================================
// 💾 SAVE BILL & OFFLINE ORDER COMMIT (DIRECT BILL vs FIELD ORDER)
// ============================================
async function executeSaveBill(forceFieldOrder = false) {
    const items = [];
    let hasError = false;

    document.querySelectorAll('#itemsRows .item-row').forEach(row => {
        const name = row.querySelector('.ir-name').value.trim();
        const qty = parseFloat(row.querySelector('.ir-qty').value) || 0;
        const rate = parseFloat(row.querySelector('.ir-rate').value) || 0;
        const stockId = row.querySelector('.ir-name').dataset.stockId || null;

        if (!name || qty <= 0) { hasError = true; return; }

        let purchaseRate = 0;
        if (stockId && typeof allMyStock !== 'undefined' && Array.isArray(allMyStock)) {
            const s = allMyStock.find(x => x.id === stockId);
            if (s && s.purchaseRate !== undefined) {
                purchaseRate = parseFloat(s.purchaseRate) || 0;
            }
        }

        items.push({
            name,
            qty,
            rate,
            total: qty * rate,
            stockId,
            purchaseRate: purchaseRate,
            costTotal: qty * purchaseRate
        });
    });

    if (items.length === 0 || hasError) {
        Swal.fire('⚠️', 'Kam az kam 1 valid item aur quantity darj karein!', 'warning');
        return;
    }

    // 📄 Check Package Monthly Bills Limit
    const billLimits = window.ebAgencyLimits || (myAgency && myAgency.customLimits) || {};
    const maxMonthlyBills = (billLimits && billLimits.monthlyBills !== undefined) ? billLimits.monthlyBills : (myAgency && myAgency.customLimits && myAgency.customLimits.monthlyBills);
    if (maxMonthlyBills && maxMonthlyBills < 90000 && myUser && myUser.role !== 'super-admin') {
        try {
            const currentMonthPrefix = new Date().toISOString().slice(0, 7);
            const curBillsSnap = await db.collection('bills')
                .where('agencyId', '==', myAgencyId)
                .where('date', '>=', currentMonthPrefix + '-01')
                .where('date', '<=', currentMonthPrefix + '-31')
                .get();
            if (curBillsSnap.size >= maxMonthlyBills) {
                Swal.fire({
                    icon: 'warning',
                    title: '📄 Monthly Bills Limit Reached',
                    html: `Aap کے موجودہ پیکیج میں اس ماہ زیادہ سے زیادہ <b>${maxMonthlyBills} بلز</b> بنانے کی اجازت ہے جو کہ پوری ہو چکی ہے۔<br><br>
                           مزید بلز بنانے کے لیے <b>Super Admin</b> یا <b>Developer</b> سے لمٹ بڑھوائیں:
                           <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:10px; margin-top:10px; font-size:13px; font-weight:bold; color:#166534;">
                               <i class="fab fa-whatsapp"></i> Developer WhatsApp: +923346800959
                           </div>`,
                    showCancelButton: true,
                    confirmButtonText: '<i class="fab fa-whatsapp"></i> رابطہ ڈویلپر (+923346800959)',
                    confirmButtonColor: '#25D366',
                    cancelButtonText: 'Cancel'
                }).then(r => {
                    if (r.isConfirmed) {
                        window.open('https://wa.me/923346800959?text=' + encodeURIComponent(`السلام علیکم ڈویلپر صاحب!\nمیری ایجنسی: *${myAgency.name || ''}*\nاس ماہ کے بلز کی لمٹ ختم ہو گئی ہے (لمٹ: ${maxMonthlyBills})۔ براہ کرم بلز لمٹ بڑھا دیں۔`), '_blank');
                    }
                });
                return;
            }
        } catch(limitErr) {
            console.warn('Bill monthly limit check:', limitErr);
        }
    }

    const customerName = document.getElementById('custNameInput').value.trim() || 'Counter Sale';
    const discount = parseFloat(document.getElementById('sumDiscount').value) || 0;
    const received = parseFloat(document.getElementById('sumReceived').value) || 0;

    let subTotal = 0;
    items.forEach(it => subTotal += it.total);

    const taxEnabled = document.getElementById('taxEnabled');
    const taxRateInput = document.getElementById('taxRate');
    let taxRate = 0;
    let taxAmount = 0;
    if (taxEnabled && taxEnabled.checked && taxRateInput) {
        taxRate = parseFloat(taxRateInput.value) || 0;
        if (taxRate > 0) taxAmount = ((subTotal - discount) * taxRate) / 100;
    }

    const currentBillTotal = Math.max(0, (subTotal - discount) + taxAmount);
    const prevBal = selectedCustomer ? (selectedCustomer.balance || 0) : 0;
    const totalPayable = prevBal + currentBillTotal;
    const balance = totalPayable - received;

    // Stock warnings
    const lowStockWarnings = [];
    items.forEach(it => {
        if (!it.stockId) return;
        const s = allMyStock.find(x => x.id === it.stockId);
        if (s && (s.qty || 0) < it.qty) {
            lowStockWarnings.push(`${it.name}: In-stock ${s.qty}, ordered ${it.qty}!`);
        }
    });

    if (lowStockWarnings.length > 0) {
        const proceed = await Swal.fire({
            icon: 'warning',
            title: '⚠️ Stock Shortage Alert!',
            html: `<b>Ye items stock se zyada hain:</b><br>${lowStockWarnings.join('<br>')}<br><br>
                   <small>Kya order confirm karna hai? (Stock balance negative ho jayega)</small>`,
            showCancelButton: true,
            confirmButtonText: '✅ Haan, Confirm Order',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#f39c12'
        });
        if (!proceed.isConfirmed) return;
    }

    const saveBtn = document.getElementById('saveBillBtn');
    const bookBtn = document.getElementById('bookFieldOrderBtn');
    if (saveBtn) saveBtn.disabled = true;
    if (bookBtn) bookBtn.disabled = true;

    const bookerName = (myUser && myUser.name) ? myUser.name : ((myUser && myUser.email) ? myUser.email.split('@')[0] : 'Staff');
    const bookerMobile = (myUser && myUser.mobile) || '';
    const isBookerMode = forceFieldOrder || (myUser && myUser.role === 'booker');
    const orderStatus = isBookerMode ? 'pending_approval' : 'approved';
    const orderType = isBookerMode ? 'field_order' : 'direct_bill';

    const billData = {
        agencyId: myAgencyId,
        createdBy: myUid,
        bookerId: myUid,
        bookerName: bookerName,
        bookerMobile: bookerMobile,
        orderStatus: orderStatus,
        deliveryStatus: 'pending',
        orderType: orderType,
        customerName: customerName,
        customerId: selectedCustomer ? selectedCustomer.id : null,
        customerShopName: selectedCustomer ? (selectedCustomer.shopName || '') : '',
        customerMobile: selectedCustomer ? (selectedCustomer.mobile || '') : '',
        customerAddress: selectedCustomer ? (selectedCustomer.address || '') : '',
        customerRoute: selectedCustomer ? (selectedCustomer.route || '') : '',
        customerCity: selectedCustomer ? (selectedCustomer.city || '') : '',
        customerNtn: selectedCustomer ? (selectedCustomer.ntn || selectedCustomer.custNTN || '') : '',
        customerFbrStatus: selectedCustomer ? (selectedCustomer.fbrStatus || ((selectedCustomer.ntn || selectedCustomer.custNTN) ? 'filer' : 'non-filer')) : '',
        customerCnic: selectedCustomer ? (selectedCustomer.cnic || '') : '',
        customerTerms: selectedCustomer ? (selectedCustomer.paymentTerms || '') : '',
        customer: selectedCustomer ? { ...selectedCustomer } : null,
        agency: (typeof myAgency !== 'undefined' && myAgency) ? { ...myAgency } : null,
        items: items,
        itemCount: items.length,
        subTotal: subTotal,
        discount: discount,
        taxRate: taxRate,
        taxAmount: taxAmount,
        totalCost: items.reduce((sum, it) => sum + (it.costTotal || (it.qty * (it.purchaseRate || 0))), 0),
        grossProfit: (subTotal - discount) - items.reduce((sum, it) => sum + (it.costTotal || (it.qty * (it.purchaseRate || 0))), 0),
        billAmount: currentBillTotal,
        grandTotal: totalPayable,
        previousBalance: prevBal,
        received: received,
        balance: balance,
        rateTier: activeRateTier,
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString('en-PK', {hour:'2-digit', minute:'2-digit'}),
        createdAt: new Date().toISOString()
    };

    // 🌐 CASE 1: OFFLINE MODE (Saved to Local Queue)
    if (!navigator.onLine) {
        billData.billNo = (isBookerMode ? 'ORD-OFF-' : 'OFF-') + (getOfflineOrders().length + 1) + '-' + Date.now().toString().slice(-4);
        billData.isOffline = true;

        const queue = getOfflineOrders();
        queue.push(billData);
        saveOfflineOrders(queue);

        // Adjust local stock cache immediately only if direct sale
        if (!isBookerMode) {
            items.forEach(it => {
                if (it.stockId) {
                    const s = allMyStock.find(x => x.id === it.stockId);
                    if (s) s.qty = (s.qty || 0) - it.qty;
                }
            });
            localStorage.setItem(`eb_stock_cache_${myAgencyId}`, JSON.stringify({ items: allMyStock, timestamp: new Date().toISOString() }));

            if (selectedCustomer) {
                selectedCustomer.balance = balance;
            }
        }

        showSuccessScreen(billData, true);
        if (saveBtn) saveBtn.disabled = false;
        if (bookBtn) bookBtn.disabled = false;
        return;
    }

    // ☁️ CASE 2: ONLINE MODE
    try {
        // 📕 IF FIELD BOOKER ORDER: Save as Field Order for Admin Approval (No physical stock deduction yet)
        if (isBookerMode) {
            billData.billNo = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
            const billRef = db.collection('bills').doc();
            await billRef.set(billData);
            billData.id = billRef.id;

            // Redundant mirror to orders collection
            try {
                await db.collection('orders').doc(billRef.id).set(billData);
            } catch (eM) {}

            showSuccessScreen(billData, false);
            if (saveBtn) saveBtn.disabled = false;
            if (bookBtn) bookBtn.disabled = false;

            Swal.fire({
                icon: 'success',
                title: '📥 آرڈر کامیابی سے بک ہو گیا!',
                html: `<b>آرڈر ریفرنس نمبر: ${billData.billNo}</b><br>
                       دکان دار: <b>${customerName}</b><br>
                       نئے مال کی رقم: <b>Rs ${currentBillTotal.toLocaleString()}</b><br>
                       پچھلا بقایا: <b>Rs ${prevBal.toLocaleString()}</b><br>
                       کل واجب الادا: <b>Rs ${totalPayable.toLocaleString()}</b><br>
                       ${received > 0 ? `💵 وصول رقم: <b style="color:#16a34a;">Rs ${received.toLocaleString()}</b> &nbsp;|&nbsp; باقی: <b>Rs ${balance.toLocaleString()}</b><br>` : ''}
                       <br><small style="color:#64748b;">یہ آرڈر ایڈمن کے پاس منظوری (Approval) کے لیے پہنچ گیا ہے۔ ایڈمن منظوری پر بل جاری اور سپلائر گاڑی لوڈ ہوگی۔</small>`,
                confirmButtonText: '➕ اگلا آرڈر بک کریں',
                confirmButtonColor: '#d97706'
            });
            return;
        }

        // 🏢 IF DIRECT SALE INVOICE: Batched Stock Deduction & Khata Update
        const liveBillNo = await getNextLiveBillNo();
        billData.billNo = liveBillNo;

        const batch = db.batch();

        // 1. Bill Doc
        const billRef = db.collection('bills').doc();
        batch.set(billRef, billData);

        // 2. Stock deductions & movements
        const movements = [];
        items.forEach(it => {
            if (!it.stockId) return;
            const s = allMyStock.find(x => x.id === it.stockId);
            if (!s) return;

            const newQty = (s.qty || 0) - it.qty;
            batch.update(db.collection('stock').doc(it.stockId), {
                qty: newQty,
                updatedAt: new Date().toISOString()
            });

            movements.push({
                itemName: it.name,
                qty: it.qty,
                beforeQty: s.qty || 0,
                afterQty: newQty
            });
        });

        if (movements.length > 0) {
            const moveRef = db.collection('movements').doc();
            batch.set(moveRef, {
                agencyId: myAgencyId,
                billNo: liveBillNo,
                customerName: customerName,
                type: 'out',
                reason: 'sale',
                reasonLabel: '🛒 Sale Invoice ' + liveBillNo,
                movements: movements,
                createdBy: myUid,
                createdAt: new Date().toISOString()
            });
        }

        // 3. Customer Ledger Balance Update
        if (selectedCustomer) {
            batch.update(db.collection('customers').doc(selectedCustomer.id), {
                balance: balance,
                lastBillNo: liveBillNo,
                lastBillAt: new Date().toISOString()
            });
        }

        await batch.commit();

        showSuccessScreen(billData, false);
        if (saveBtn) saveBtn.disabled = false;
        if (bookBtn) bookBtn.disabled = false;

    } catch (error) {
        if (saveBtn) saveBtn.disabled = false;
        if (bookBtn) bookBtn.disabled = false;
        console.error('Invoice save error:', error);
        Swal.fire('❌ Error', 'Bill save fail: ' + (error.code || error.message), 'error');
    }
}

// Bind both button listeners
document.getElementById('saveBillBtn')?.addEventListener('click', () => executeSaveBill(false));
document.getElementById('bookFieldOrderBtn')?.addEventListener('click', () => executeSaveBill(true));

// ============================================
// 🔄 SYNC OFFLINE ORDERS TO FIRESTORE
// ============================================
async function syncAllOfflineOrders(isManual = true) {
    const orders = getOfflineOrders();
    if (orders.length === 0) {
        if (isManual) Swal.fire('ℹ️', 'Koi offline order pending nahi hai!', 'info');
        return;
    }

    if (!navigator.onLine) {
        Swal.fire('⚠️', 'Internet connection nahi hai! Online ho kar sync karein.', 'warning');
        return;
    }

    const btn = document.getElementById('syncOfflineNowBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    }

    let syncedCount = 0;
    try {
        for (const ord of orders) {
            const liveBillNo = await getNextLiveBillNo();
            const batch = db.batch();

            ord.billNo = liveBillNo;
            delete ord.isOffline;

            const billRef = db.collection('bills').doc();
            batch.set(billRef, ord);

            // Deduct stock
            (ord.items || []).forEach(it => {
                if (it.stockId) {
                    batch.update(db.collection('stock').doc(it.stockId), {
                        qty: firebase.firestore.FieldValue.increment(-it.qty),
                        updatedAt: new Date().toISOString()
                    });
                }
            });

            // Update customer balance
            if (ord.customerId) {
                batch.update(db.collection('customers').doc(ord.customerId), {
                    balance: ord.balance,
                    lastBillNo: liveBillNo,
                    lastBillAt: new Date().toISOString()
                });
            }

            await batch.commit();
            syncedCount++;
        }

        // Clear offline orders queue
        localStorage.removeItem(getOfflineQueueKey());
        updateOfflineQueueUI();

        Swal.fire({
            icon: 'success',
            title: '🎉 Sync Complete!',
            text: `${syncedCount} offline orders cloud par kamyabi se upload ho gaye!`
        });

    } catch (e) {
        console.error('Sync failed:', e);
        Swal.fire('Error', 'Offline sync fail: ' + e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sync All to Cloud';
        }
    }
}

document.getElementById('syncOfflineNowBtn').addEventListener('click', () => syncAllOfflineOrders(true));

// ============================================
// 🎉 SUCCESS SCREEN & OUTPUTS
// ============================================
function showSuccessScreen(b, isOffline) {
    lastSavedBill = {
        ...b,
        agencyName: (myAgency && myAgency.name) || 'Agency',
        agencyCity: (myAgency && myAgency.city) || '',
        agencyMobile: (myAgency && myAgency.mobile) || '',
        agencyAddress: (myAgency && myAgency.address) || '',
        agencyNTN: (myAgency && myAgency.ntn) || ''
    };

    document.getElementById('billFormCard').style.display = 'none';
    const ss = document.getElementById('successScreen');
    ss.style.display = 'block';

    document.getElementById('ssBillNo').innerText = b.billNo;
    document.getElementById('ssCustomer').innerText = b.customerName;
    document.getElementById('ssGrand').innerText = (b.billAmount || b.grandTotal || 0).toFixed(2);
    document.getElementById('ssPrevBalance').innerText = (b.previousBalance || 0).toFixed(2);
    document.getElementById('ssReceived').innerText = (b.received || 0).toFixed(2);
    document.getElementById('ssBalance').innerText = (b.balance || 0).toFixed(2);

    const offBadge = document.getElementById('ssOfflineBadge');
    if (offBadge) offBadge.style.display = isOffline ? 'inline-block' : 'none';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 🆕 CREATE NEXT BILL (Reset Form)
document.getElementById('outNewBillBtn').addEventListener('click', () => {
    document.getElementById('successScreen').style.display = 'none';
    document.getElementById('billFormCard').style.display = 'block';

    document.getElementById('custNameInput').value = '';
    document.getElementById('custInfoBox').classList.remove('show');
    document.getElementById('custInfoBox').innerHTML = '';
    selectedCustomer = null;

    document.getElementById('sumDiscount').value = '0';
    document.getElementById('sumReceived').value = '0';
    document.getElementById('taxEnabled').checked = false;
    document.getElementById('taxRate').value = '0';

    document.getElementById('itemsRows').innerHTML = '';
    addRow();

    previewBillNo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ============================================
// 🖨️ PRINT INVOICE & THERMAL RECEIPT
// ============================================
document.getElementById('outPrintBtn').addEventListener('click', () => {
    if (!lastSavedBill) return;

    const tplSelect = document.getElementById('ssTemplateSelect');
    const selectedTemplate = tplSelect ? tplSelect.value : ((typeof myAgency !== 'undefined' && myAgency && myAgency.defaultTemplate) ? myAgency.defaultTemplate : 'template8');

    let billHTML = '';
    try {
        billHTML = (window.buildBillHTML) 
            ? window.buildBillHTML(lastSavedBill, selectedTemplate)
            : buildFallbackHTML(lastSavedBill);
    } catch (e) {
        billHTML = buildFallbackHTML(lastSavedBill);
    }

    const win = window.open('', '_blank', 'width=800,height=700');
    win.document.write(billHTML);
    win.document.close();
    setTimeout(() => win.print(), 1200);
});

// 📄 PDF EXPORT
document.getElementById('outPdfBtn').addEventListener('click', () => {
    if (!lastSavedBill) return;

    const tplSelect = document.getElementById('ssTemplateSelect');
    const selectedTemplate = tplSelect ? tplSelect.value : ((typeof myAgency !== 'undefined' && myAgency && myAgency.defaultTemplate) ? myAgency.defaultTemplate : 'template8');

    let billHTML = '';
    try {
        billHTML = (window.buildBillHTML) 
            ? window.buildBillHTML(lastSavedBill, selectedTemplate)
            : buildFallbackHTML(lastSavedBill);
    } catch (e) {
        billHTML = buildFallbackHTML(lastSavedBill);
    }

    const win = window.open('', '_blank', 'width=800,height=700');
    win.document.write(billHTML);
    win.document.close();
    setTimeout(() => {
        win.print();
        Swal.fire({
            toast: true, position: 'top-end', showConfirmButton: false,
            timer: 3000, icon: 'info', title: '📄 "Save as PDF" select karein!'
        });
    }, 1200);
});

// 🖼️ JPG DOWNLOAD
document.getElementById('outJpgBtn').addEventListener('click', async () => {
    if (!lastSavedBill) return;

    let holder = document.getElementById('jpgHolder');
    if (!holder) {
        holder = document.createElement('div');
        holder.id = 'jpgHolder';
        holder.style.cssText = 'position:absolute; left:-10000px; top:0; width:650px; background:#fff;';
        document.body.appendChild(holder);
    }

    const tplSelect = document.getElementById('ssTemplateSelect');
    const selectedTemplate = tplSelect ? tplSelect.value : ((typeof myAgency !== 'undefined' && myAgency && myAgency.defaultTemplate) ? myAgency.defaultTemplate : 'template8');
    const fullHTML = (window.buildBillHTML) ? window.buildBillHTML(lastSavedBill, selectedTemplate) : buildFallbackHTML(lastSavedBill);

    const bodyStart = fullHTML.indexOf('<body>') + 6;
    const bodyEnd = fullHTML.indexOf('</body>');
    const bodyContent = fullHTML.substring(bodyStart, bodyEnd);
    const styleMatch = fullHTML.match(/<style>([\s\S]*?)<\/style>/);
    const styles = styleMatch ? styleMatch[1] : '';

    holder.innerHTML = `<style>${styles}</style><div style="padding:20px; background:#fff;">${bodyContent}</div>`;

    try {
        const canvas = await html2canvas(holder, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        holder.innerHTML = '';

        const link = document.createElement('a');
        link.download = `Invoice_${lastSavedBill.billNo}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        link.click();

        Swal.fire({
            toast: true, position: 'top-end', showConfirmButton: false,
            timer: 2000, icon: 'success', title: '🖼️ Invoice JPG downloaded!'
        });
    } catch (e) {
        holder.innerHTML = '';
        console.error(e);
        Swal.fire('❌ Error', 'JPG generation failed!', 'error');
    }
});

// 📲 WHATSAPP SHARE
document.getElementById('outShareBtn').addEventListener('click', () => {
    if (!lastSavedBill) return;
    const b = lastSavedBill;

    let shareText = `🧾 *INVOICE: ${b.billNo}*\n`;
    shareText += `🏢 *${b.agencyName || 'Agency'}*\n`;
    shareText += `👤 Customer: *${b.customerName}*\n`;
    shareText += `📅 Date: ${b.date || ''} (${b.time || ''})\n`;
    shareText += `---------------------------------\n`;
    shareText += `📦 *ITEMS:*\n`;
    (b.items || []).forEach((it, i) => {
        shareText += `${i + 1}. ${it.name} — ${it.qty} × Rs ${it.rate} = Rs ${(it.total || 0).toFixed(2)}\n`;
    });
    shareText += `---------------------------------\n`;
    shareText += `💵 Bill Amount: Rs ${(b.billAmount || b.grandTotal || 0).toFixed(2)}\n`;
    if (b.previousBalance) {
        shareText += `📊 Previous Balance: Rs ${b.previousBalance.toFixed(2)}\n`;
    }
    shareText += `💰 Total Payable: Rs ${(b.grandTotal || 0).toFixed(2)}\n`;
    shareText += `✅ Paid / Received: Rs ${(b.received || 0).toFixed(2)}\n`;
    shareText += `⚠️ *Net Balance Due: Rs ${(b.balance || 0).toFixed(2)}*\n\n`;
    shareText += `_Shukriya! Dobara tashreef layen._`;

    const mobile = (b.customerMobile || '').replace(/[^0-9]/g, '');
    const cleanMobile = mobile.startsWith('0') ? '92' + mobile.slice(1) : mobile;

    if (cleanMobile.length >= 10) {
        window.open(`https://wa.me/${cleanMobile}?text=${encodeURIComponent(shareText)}`, '_blank');
    } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    }
});

// Fallback HTML if template engine is unavailable
function buildFallbackHTML(bill) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Invoice ${bill.billNo}</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 13px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
            .header h1 { margin: 0; font-size: 22px; }
            .info-grid { display: flex; justify-content: space-between; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f2f2f2; }
            .totals { float: right; width: 280px; }
            .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
            .totals .grand { font-weight: bold; border-top: 2px solid #333; font-size: 15px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>${bill.agencyName || 'Distribution Agency'}</h1>
            <p>${bill.agencyAddress || ''} ${bill.agencyMobile ? ' | 📱 ' + bill.agencyMobile : ''}</p>
            <h3>INVOICE: ${bill.billNo}</h3>
        </div>
        <div class="info-grid">
            <div><b>Customer:</b> ${bill.customerName}</div>
            <div><b>Date:</b> ${bill.date} ${bill.time || ''}</div>
        </div>
        <table>
            <thead>
                <tr><th>#</th><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th></tr>
            </thead>
            <tbody>
                ${(bill.items || []).map((it, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${it.name}</td>
                        <td>${it.qty}</td>
                        <td>Rs ${it.rate}</td>
                        <td>Rs ${(it.total || 0).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="totals">
            <div><span>Sub Total:</span><span>Rs ${(bill.subTotal || 0).toFixed(2)}</span></div>
            <div><span>Discount:</span><span>- Rs ${(bill.discount || 0).toFixed(2)}</span></div>
            <div><span>Bill Total:</span><span>Rs ${(bill.billAmount || bill.grandTotal || 0).toFixed(2)}</span></div>
            <div><span>Prev Balance:</span><span>Rs ${(bill.previousBalance || 0).toFixed(2)}</span></div>
            <div class="grand"><span>Total Payable:</span><span>Rs ${(bill.grandTotal || 0).toFixed(2)}</span></div>
            <div><span>Received:</span><span>- Rs ${(bill.received || 0).toFixed(2)}</span></div>
            <div style="font-weight:bold; color:#e74c3c;"><span>Balance Due:</span><span>Rs ${(bill.balance || 0).toFixed(2)}</span></div>
        </div>
    </body>
    </html>`;
}

// 🚪 LOGOUT
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        const res = await Swal.fire({
            title: 'Logout?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#e74c3c',
            confirmButtonText: 'Yes, Logout',
            cancelButtonText: 'Cancel'
        });
        if (res.isConfirmed) {
            await auth.signOut();
            window.location.href = 'auth.html';
        }
    });
}

// ============================================
// 📱 VISUAL CATALOGUE ORDER BOOKER ENGINE (PHASE 2/4)
// ============================================
let catProducts = [];
let catIndex = 0;
let catActiveCategory = 'all';
let catSearchQuery = '';
let catCart = {}; // { [stockId]: { item, qty, rate, total, freeQty, schemeDiscount } }

function initVisualCatalogue() {
    // 1. Setup Agency Title & Booker Profile display
    const agTitle = document.getElementById('catAgencyTitle');
    if (agTitle) {
        agTitle.innerHTML = '🏢 ' + (myAgency?.name || 'Distribution Agency') + ' — Order Catalogue';
    }
    const bookerBadge = document.getElementById('catBookerBadge');
    if (bookerBadge) {
        const bName = (myUser && myUser.name) ? myUser.name : ((myUser && myUser.email) ? myUser.email.split('@')[0] : 'Staff');
        bookerBadge.innerHTML = `📕 Order Booker: <b>${bName}</b> | 📅 ${new Date().toLocaleDateString('en-PK', {day:'numeric', month:'short', year:'numeric'})}`;
    }

    // 2. Setup Price Tier Badge
    updateCatalogueRateTier();

    // 3. View Switcher setup (Radio Buttons: Classic Table Default)
    const radioTable = document.getElementById('radioSwitchTable');
    const radioCat = document.getElementById('radioSwitchCatalogue');
    const catSec = document.getElementById('catalogueOrderSection');
    const tabSec = document.getElementById('billFormCard');

    function switchViewMode(mode) {
        if (mode === 'catalogue') {
            if (radioCat) radioCat.checked = true;
            if (radioTable) radioTable.checked = false;
            if (catSec) catSec.style.display = 'block';
            if (tabSec) tabSec.style.display = 'none';
            renderCatalogueItem();
        } else {
            if (radioTable) radioTable.checked = true;
            if (radioCat) radioCat.checked = false;
            if (tabSec) tabSec.style.display = 'block';
            if (catSec) catSec.style.display = 'none';
        }
    }

    if (radioTable) {
        radioTable.addEventListener('change', () => switchViewMode('table'));
    }
    if (radioCat) {
        radioCat.addEventListener('change', () => switchViewMode('catalogue'));
    }

    // Check if catalogue mode explicitly requested via URL query param
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'catalogue') {
        switchViewMode('catalogue');
    } else {
        // DEFAULT IS ALWAYS CLASSIC TABLE!
        switchViewMode('table');
    }

    // 4. Shopkeeper Selection & Autocomplete
    setupCatalogueCustomerPicker();

    // 5. Navigation Controls (Next, Back, Arrows, Swipe, Keys)
    setupCatalogueNavigation();

    // 6. Quantity Controls (Plus, Minus, Typing)
    setupCatalogueQuantityControls();

    // 7. Search Input
    const catSearchInp = document.getElementById('catSearchInput');
    if (catSearchInp) {
        catSearchInp.addEventListener('input', function() {
            catSearchQuery = this.value.toLowerCase().trim();
            catIndex = 0;
            refreshCatalogueData();
        });
    }

    // 8. Sticky Bottom Bar & Review Modal
    setupCatalogueReviewModal();

    // 9. Initial data refresh
    refreshCatalogueData();
}

function updateCatalogueRateTier() {
    const badge = document.getElementById('catPriceTierBadge');
    if (badge) {
        if (activeRateTier === 'wholesale') {
            badge.innerText = '🏪 Wholesale Rate (ہول سیل)';
            badge.style.background = '#e0f2fe';
            badge.style.color = '#0369a1';
            badge.style.borderColor = '#bae6fd';
        } else {
            badge.innerText = '🏷️ Retail Rate (پرچون)';
            badge.style.background = '#dcfce7';
            badge.style.color = '#15803d';
            badge.style.borderColor = '#bbf7d0';
        }
    }
    // Update rates in cart for active items
    Object.keys(catCart).forEach(stockId => {
        const entry = catCart[stockId];
        const newRate = activeRateTier === 'wholesale' 
            ? (entry.item.wholesaleRate || entry.item.rate || 0) 
            : (entry.item.retailRate || entry.item.rate || 0);
        entry.rate = newRate;
        entry.total = entry.qty * newRate;
    });
    renderCatalogueItem();
    updateCatalogueStickyBar();
}

function setupCatalogueCustomerPicker() {
    const custInput = document.getElementById('catCustInput');
    const custSuggest = document.getElementById('catCustSuggest');
    const custInfo = document.getElementById('catCustInfo');
    const quickAddBtn = document.getElementById('catQuickAddCustBtn');

    if (!custInput || !custSuggest) return;

    custInput.addEventListener('input', function() {
        const val = this.value.toLowerCase().trim();
        if (!val) {
            custSuggest.classList.remove('show');
            return;
        }

        const matches = allMyCustomers.filter(c =>
            (c.name || '').toLowerCase().includes(val) ||
            (c.mobile || '').includes(val) ||
            (c.shopName || '').toLowerCase().includes(val) ||
            (c.route || '').toLowerCase().includes(val)
        );

        if (matches.length === 0) {
            custSuggest.classList.remove('show');
            return;
        }

        let html = '';
        matches.slice(0, 8).forEach(c => {
            const typeBadge = c.customerType === 'retail'
                ? `<span style="font-size:10px; font-weight:800; padding:2px 7px; border-radius:10px; background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; margin-left:6px;">🏷️ RETAIL</span>`
                : `<span style="font-size:10px; font-weight:800; padding:2px 7px; border-radius:10px; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; margin-left:6px;">🏪 WHOLESALE</span>`;
            html += `
            <div class="suggest-item" data-id="${c.id}" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #f1f5f9;">
                <b>👤 ${c.name}</b> ${c.shopName ? `(${c.shopName})` : ''} ${typeBadge}<br>
                <span class="s-sub" style="font-size:11px; color:#64748b;">
                    ${c.mobile ? '📱 ' + c.mobile : ''} 
                    ${c.route ? '| 🛣️ ' + c.route : ''}
                    | 💰 Balance: <b>Rs ${(c.balance || 0).toLocaleString()}</b>
                </span>
            </div>`;
        });

        custSuggest.innerHTML = html;
        custSuggest.classList.add('show');

        custSuggest.querySelectorAll('.suggest-item').forEach(el => {
            el.addEventListener('click', function() {
                const c = allMyCustomers.find(x => x.id === this.dataset.id);
                if (c) {
                    selectCustomerObject(c);
                }
            });
        });
    });

    document.addEventListener('click', (e) => {
        if (!custInput.contains(e.target) && !custSuggest.contains(e.target)) {
            custSuggest.classList.remove('show');
        }
    });

    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', () => {
            const tableAddBtn = document.getElementById('quickAddCustBtn');
            if (tableAddBtn) tableAddBtn.click();
        });
    }
}

function syncCatalogueCustomer(c) {
    const custInput = document.getElementById('catCustInput');
    const custSuggest = document.getElementById('catCustSuggest');
    const custInfo = document.getElementById('catCustInfo');

    if (custInput) custInput.value = c.name;
    if (custSuggest) custSuggest.classList.remove('show');

    if (custInfo) {
        const prevBal = parseFloat(c.balance || 0);
        let info = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
                🏬 <b>${c.shopName || c.name}</b> &nbsp;|&nbsp; 📱 ${c.mobile || '-'} &nbsp;|&nbsp; 🛣️ Route: <b>${c.route || '-'}</b>
                <div style="margin-top:4px;">
                    <span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:8px; font-weight:800; border:1px solid #fde68a;">
                        💰 Previous Balance: Rs ${prevBal.toLocaleString()} <span class="ur-sub">(پچھلا بقایا بل)</span>
                    </span>
                </div>
            </div>
            ${prevBal > 0 ? `
            <button type="button" class="btn btn-sm" onclick="openQuickKhataRecoveryModal('${c.id}')" style="background:#16a34a; color:#fff; font-weight:800; font-size:12px; padding:6px 12px; border-radius:8px; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(22,163,74,0.3);">
                <i class="fas fa-hand-holding-usd"></i> 💵 Receive Cash (پچھلی وصولی)
            </button>` : ''}
        </div>`;
        custInfo.innerHTML = info;
        custInfo.style.display = 'block';
    }
    updateCatalogueStickyBar();
}

function setupCatalogueNavigation() {
    const btnPrev = document.getElementById('catBtnPrev');
    const btnNext = document.getElementById('catBtnNext');
    const card = document.getElementById('catCard');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => stepCatProduct(-1));
    }
    if (btnNext) {
        btnNext.addEventListener('click', () => stepCatProduct(1));
    }

    // Touch Swipe Left / Right on the Card
    let touchStartX = 0;
    let touchEndX = 0;
    if (card) {
        card.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        card.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleCardSwipe();
        }, { passive: true });
    }

    function handleCardSwipe() {
        const threshold = 45;
        if (touchEndX < touchStartX - threshold) {
            // Swiped Left -> Next
            stepCatProduct(1);
        } else if (touchEndX > touchStartX + threshold) {
            // Swiped Right -> Prev
            stepCatProduct(-1);
        }
    }

    // Keyboard Arrow Keys (Left / Right)
    document.addEventListener('keydown', (e) => {
        const catSec = document.getElementById('catalogueOrderSection');
        if (!catSec || catSec.style.display === 'none') return;
        // Don't trigger if user is typing in an input
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

        if (e.key === 'ArrowRight') {
            stepCatProduct(1);
        } else if (e.key === 'ArrowLeft') {
            stepCatProduct(-1);
        }
    });
}

function stepCatProduct(delta) {
    if (!catProducts || catProducts.length === 0) return;
    catIndex = (catIndex + delta + catProducts.length) % catProducts.length;
    renderCatalogueItem();
}

function setupCatalogueQuantityControls() {
    const btnMinus = document.getElementById('catBtnMinus');
    const btnPlus = document.getElementById('catBtnPlus');
    const qtyInput = document.getElementById('catItemQty');

    if (btnPlus) {
        btnPlus.addEventListener('click', () => {
            if (!catProducts || catProducts.length === 0) return;
            const item = catProducts[catIndex];
            const currentQty = catCart[item.id] ? catCart[item.id].qty : 0;
            updateCatItemQty(item, currentQty + 1);
        });
    }

    if (btnMinus) {
        btnMinus.addEventListener('click', () => {
            if (!catProducts || catProducts.length === 0) return;
            const item = catProducts[catIndex];
            const currentQty = catCart[item.id] ? catCart[item.id].qty : 0;
            if (currentQty > 0) {
                updateCatItemQty(item, currentQty - 1);
            }
        });
    }

    if (qtyInput) {
        qtyInput.addEventListener('input', function() {
            if (!catProducts || catProducts.length === 0) return;
            const item = catProducts[catIndex];
            const q = Math.max(0, parseFloat(this.value) || 0);
            updateCatItemQty(item, q);
        });
        qtyInput.addEventListener('focus', function() {
            this.select();
        });
    }
}

function refreshCatalogueData() {
    // 1. Populate Category Chips dynamically from allMyStock
    const chipsContainer = document.getElementById('catCategoryChips');
    if (chipsContainer) {
        const categories = new Set();
        allMyStock.forEach(it => {
            const c = String(it.category || '').trim();
            if (c) categories.add(c);
        });

        let chipsHtml = `<button type="button" class="cat-chip ${catActiveCategory === 'all' ? 'active' : ''}" data-cat="all">📂 All Products (${allMyStock.length})</button>`;
        categories.forEach(cat => {
            const count = allMyStock.filter(x => x.category === cat).length;
            const isAct = catActiveCategory === cat ? 'active' : '';
            chipsHtml += `<button type="button" class="cat-chip ${isAct}" data-cat="${cat}">${cat} (${count})</button>`;
        });
        chipsContainer.innerHTML = chipsHtml;

        chipsContainer.querySelectorAll('.cat-chip').forEach(btn => {
            btn.addEventListener('click', function() {
                chipsContainer.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                catActiveCategory = this.dataset.cat;
                catIndex = 0;
                filterAndRenderCatalogue();
            });
        });
    }

    filterAndRenderCatalogue();
}

function filterAndRenderCatalogue() {
    catProducts = allMyStock.filter(item => {
        // Category filter
        if (catActiveCategory !== 'all' && item.category !== catActiveCategory) {
            return false;
        }
        // Search filter
        if (catSearchQuery) {
            const nameMatch = String(item.name || '').toLowerCase().includes(catSearchQuery);
            const barcodeMatch = String(item.barcode || '').toLowerCase().includes(catSearchQuery);
            const catMatch = String(item.category || '').toLowerCase().includes(catSearchQuery);
            if (!nameMatch && !barcodeMatch && !catMatch) return false;
        }
        return true;
    });

    if (catIndex >= catProducts.length) {
        catIndex = Math.max(0, catProducts.length - 1);
    }

    renderCatalogueItem();
    updateCatalogueStickyBar();
}

function renderCatalogueItem() {
    const card = document.getElementById('catCard');
    const catBadge = document.getElementById('catItemCategoryBadge');
    const counterBadge = document.getElementById('catCounterBadge');
    const navIndex = document.getElementById('catNavIndex');
    const titleEl = document.getElementById('catItemTitle');
    const imgEl = document.getElementById('catItemImg');
    const phEl = document.getElementById('catPhotoPlaceholder');
    const rateEl = document.getElementById('catItemRate');
    const unitEl = document.getElementById('catItemUnit');
    const stockBadge = document.getElementById('catItemStockBadge');
    const qtyInput = document.getElementById('catItemQty');
    const subtotalEl = document.getElementById('catItemSubtotal');
    const schemeCard = document.getElementById('catSchemeCard');
    const noSchemeCard = document.getElementById('catNoSchemeCard');
    const schemeLabel = document.getElementById('catSchemeLabel');
    const schemeTracker = document.getElementById('catSchemeTracker');

    if (!card) return;

    if (!catProducts || catProducts.length === 0) {
        if (titleEl) titleEl.innerText = 'No products found';
        if (catBadge) catBadge.innerText = '📂 0 Products';
        if (counterBadge) counterBadge.innerText = '0 of 0';
        if (navIndex) navIndex.innerText = '0 / 0';
        if (imgEl) imgEl.style.display = 'none';
        if (phEl) phEl.style.display = 'block';
        if (rateEl) rateEl.innerText = 'Rs 0';
        if (unitEl) unitEl.innerText = '';
        if (stockBadge) stockBadge.innerHTML = '<span class="stock-badge stock-out">Out of stock</span>';
        if (qtyInput) qtyInput.value = 0;
        if (subtotalEl) subtotalEl.innerText = 'Item Total: Rs 0.00';
        if (schemeCard) schemeCard.style.display = 'none';
        if (noSchemeCard) noSchemeCard.style.display = 'block';
        return;
    }

    const item = catProducts[catIndex];
    const totalCount = catProducts.length;

    // Badges & Counter
    if (catBadge) catBadge.innerText = '📂 ' + (item.category || 'General');
    if (counterBadge) counterBadge.innerText = `Product ${catIndex + 1} of ${totalCount}`;
    if (navIndex) navIndex.innerText = `${catIndex + 1} / ${totalCount}`;

    // Title
    if (titleEl) {
        titleEl.innerHTML = `<span style="font-size:18px;">${item.name || 'Unnamed Product'}</span> ${item.barcode ? `<span style="font-size:11px; color:#64748b; font-weight:600; margin-left:6px;">[${item.barcode}]</span>` : ''}`;
    }

    // Photo
    if (item.photoUrl) {
        if (imgEl) {
            imgEl.src = item.photoUrl;
            imgEl.alt = item.name || 'Product Photo';
            imgEl.style.display = 'block';
        }
        if (phEl) phEl.style.display = 'none';
    } else {
        if (imgEl) imgEl.style.display = 'none';
        if (phEl) {
            phEl.style.display = 'block';
            phEl.innerHTML = `
                <i class="fas fa-box-open" style="font-size:64px; color:#cbd5e1; margin-bottom:8px;"></i>
                <div style="font-size:13px; font-weight:700; color:#94a3b8;">${item.name || 'No Photo'}</div>
            `;
        }
    }

    // Price & Available Stock
    const rate = activeRateTier === 'wholesale' 
        ? (item.wholesaleRate || item.rate || 0) 
        : (item.retailRate || item.rate || 0);
    
    if (rateEl) rateEl.innerText = 'Rs ' + Number(rate).toLocaleString();
    if (unitEl) unitEl.innerText = ' / ' + UNIT_LBL(item.unit);

    if (stockBadge) {
        const q = item.qty || 0;
        const colorClass = q <= 0 ? 'stock-out' : (q <= 10 ? 'stock-low' : 'stock-ok');
        stockBadge.innerHTML = `<span class="stock-badge ${colorClass}">Available: <b>${q} ${UNIT_LBL(item.unit)}</b></span>`;
    }

    // Booked Qty & Subtotal
    const bookedQty = catCart[item.id] ? catCart[item.id].qty : 0;
    if (qtyInput) qtyInput.value = bookedQty;
    const itemSubtotal = bookedQty * rate;
    if (subtotalEl) {
        subtotalEl.innerText = 'Item Total: Rs ' + itemSubtotal.toFixed(2);
    }

    // Scheme Section ("thora oper scroll karne per scheme nazar ayeen")
    if (item.hasScheme) {
        if (schemeCard) schemeCard.style.display = 'block';
        if (noSchemeCard) noSchemeCard.style.display = 'none';
        if (schemeLabel) schemeLabel.innerText = item.schemeLabel || 'Special Scheme Active';

        if (schemeTracker) {
            const minQ = parseFloat(item.schemeMinQty) || 1;
            const sVal = parseFloat(item.schemeValue) || 1;

            if (item.schemeType === 'buy_x_get_y') {
                if (bookedQty === 0) {
                    schemeTracker.innerHTML = `✨ <b>آفر:</b> ہر <b>${minQ}</b> کی خریداری پر <b>${sVal} ${UNIT_LBL(item.unit)} مفت</b> ملیں گے!`;
                } else if (bookedQty < minQ) {
                    schemeTracker.innerHTML = `ℹ️ مزید <b>${minQ - bookedQty} ${UNIT_LBL(item.unit)}</b> شامل کریں اور <b>${sVal} مفت</b> حاصل کریں!`;
                } else {
                    const freeUnits = Math.floor(bookedQty / minQ) * sVal;
                    schemeTracker.innerHTML = `🎉 <b>مبارک!</b> اس آرڈر میں <b>+${freeUnits} ${UNIT_LBL(item.unit)} مفت</b> شامل ہو گئے!`;
                }
            } else if (item.schemeType === 'flat_discount') {
                if (bookedQty >= minQ) {
                    const disc = Math.floor(bookedQty / minQ) * sVal;
                    schemeTracker.innerHTML = `🎉 <b>رعایت فعال!</b> کل <b>Rs ${disc}</b> کا خصوصی ڈسکاؤنٹ لاگو ہو چکا ہے۔`;
                } else {
                    schemeTracker.innerHTML = `ℹ️ مزید <b>${minQ - bookedQty}</b> شامل کریں اور <b>Rs ${sVal} کی رعایت</b> حاصل کریں!`;
                }
            } else if (item.schemeType === 'percent_discount') {
                if (bookedQty >= minQ) {
                    schemeTracker.innerHTML = `🎉 <b>${sVal}% رعایت فعال!</b> خصوصی فیصد رعایت لاگو ہے۔`;
                } else {
                    schemeTracker.innerHTML = `ℹ️ مزید <b>${minQ - bookedQty}</b> شامل کریں اور <b>${sVal}% کی رعایت</b> حاصل کریں!`;
                }
            } else {
                schemeTracker.innerText = 'خصوصی پروموشنل اسکیم فعال ہے۔';
            }
        }
    } else {
        if (schemeCard) schemeCard.style.display = 'none';
        if (noSchemeCard) noSchemeCard.style.display = 'block';
    }
}

function updateCatItemQty(item, newQty) {
    const qty = Math.max(0, parseFloat(newQty) || 0);
    const rate = activeRateTier === 'wholesale' 
        ? (item.wholesaleRate || item.rate || 0) 
        : (item.retailRate || item.rate || 0);

    if (qty > 0) {
        let freeQty = 0;
        let schemeDiscount = 0;

        if (item.hasScheme) {
            const minQ = parseFloat(item.schemeMinQty) || 1;
            const sVal = parseFloat(item.schemeValue) || 1;
            if (item.schemeType === 'buy_x_get_y') {
                freeQty = Math.floor(qty / minQ) * sVal;
            } else if (item.schemeType === 'flat_discount') {
                schemeDiscount = Math.floor(qty / minQ) * sVal;
            } else if (item.schemeType === 'percent_discount') {
                if (qty >= minQ) {
                    schemeDiscount = (qty * rate * sVal) / 100;
                }
            }
        }

        catCart[item.id] = {
            item: item,
            qty: qty,
            rate: rate,
            total: qty * rate,
            freeQty: freeQty,
            schemeDiscount: schemeDiscount
        };
    } else {
        delete catCart[item.id];
    }

    // Refresh current card displays
    renderCatalogueItem();
    updateCatalogueStickyBar();
    syncCatCartToTableRows();
}

function updateCatalogueStickyBar() {
    const itemsCountEl = document.getElementById('catBottomItemsCount');
    const unitsCountEl = document.getElementById('catBottomTotalUnits');
    const totalEl = document.getElementById('catBottomTotal');

    const entries = Object.values(catCart);
    const count = entries.length;
    const units = entries.reduce((s, e) => s + e.qty, 0);
    const total = entries.reduce((s, e) => s + (e.qty * e.rate - (e.schemeDiscount || 0)), 0);

    if (itemsCountEl) itemsCountEl.innerText = count;
    if (unitsCountEl) unitsCountEl.innerText = units;
    if (totalEl) totalEl.innerText = total.toFixed(2);
}

function syncCatCartToTableRows() {
    // Keep classic table rows in sync with catalogue cart
    const rowsDiv = document.getElementById('itemsRows');
    if (!rowsDiv) return;

    rowsDiv.innerHTML = '';
    const entries = Object.values(catCart);
    if (entries.length === 0) {
        addRow();
        return;
    }

    entries.forEach(entry => {
        addRow({
            name: entry.item.name,
            stockId: entry.item.id,
            qty: entry.qty,
            rate: entry.rate,
            unit: entry.item.unit,
            availableQty: entry.item.qty || 0,
            hasScheme: entry.item.hasScheme,
            schemeLabel: entry.item.schemeLabel
        });
    });
}

function setupCatalogueReviewModal() {
    const openBtn = document.getElementById('catBtnOpenReview');
    const closeBtn = document.getElementById('catBtnCloseReview');
    const modal = document.getElementById('catReviewModal');
    const submitBtn = document.getElementById('catBtnSubmitOrder');

    if (openBtn) {
        openBtn.addEventListener('click', openCatalogueReviewModal);
    }
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    }
    if (submitBtn) {
        submitBtn.addEventListener('click', submitCatalogueFieldOrder);
    }
}

function openCatalogueReviewModal() {
    const entries = Object.values(catCart);
    if (entries.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'آرڈر خالی ہے',
            text: 'براہ کرم کیٹلاگ سے کم از کم 1 آئٹم کی تعداد منتخب کریں!',
            confirmButtonColor: '#0284c7'
        });
        return;
    }

    const modal = document.getElementById('catReviewModal');
    const custNameEl = document.getElementById('catReviewCustName');
    const custDetailsEl = document.getElementById('catReviewCustDetails');
    const listEl = document.getElementById('catReviewItemsList');
    const subtotalEl = document.getElementById('catReviewSubtotal');
    const prevBalEl = document.getElementById('catReviewPrevBal');
    const grandEl = document.getElementById('catReviewGrand');

    // Customer display
    if (selectedCustomer) {
        if (custNameEl) custNameEl.innerText = `👤 ${selectedCustomer.name} ${selectedCustomer.shopName ? `(${selectedCustomer.shopName})` : ''}`;
        if (custDetailsEl) {
            custDetailsEl.innerHTML = `📱 ${selectedCustomer.mobile || 'No mobile'} | 🛣️ Route: ${selectedCustomer.route || 'General'}`;
        }
    } else {
        if (custNameEl) custNameEl.innerText = '👤 Counter / Spot Sale (دکان دار منتخب نہیں)';
        if (custDetailsEl) custDetailsEl.innerHTML = '⚠️ ایڈمن منظوری کے لیے دکان دار کا نام اوپر سے منتخب کر سکتے ہیں۔';
    }

    // Render items list
    let html = '';
    let subtotal = 0;
    let totalDiscount = 0;

    entries.forEach(entry => {
        const item = entry.item;
        const lineTotal = entry.qty * entry.rate;
        subtotal += lineTotal;
        totalDiscount += (entry.schemeDiscount || 0);

        const thumb = item.photoUrl 
            ? `<img src="${item.photoUrl}" style="width:36px; height:36px; border-radius:6px; object-fit:cover; margin-right:8px; border:1px solid #cbd5e1;">`
            : `<div style="width:36px; height:36px; border-radius:6px; background:#f1f5f9; display:inline-flex; align-items:center; justify-content:center; margin-right:8px; color:#94a3b8;"><i class="fas fa-box"></i></div>`;

        let schemeBadge = '';
        if (entry.freeQty > 0) {
            schemeBadge = `<span style="background:#fdf4ff; color:#a21caf; border:1px solid #f0abfc; padding:2px 6px; border-radius:6px; font-size:10px; font-weight:800; margin-left:6px;">🎁 +${entry.freeQty} FREE</span>`;
        } else if (entry.schemeDiscount > 0) {
            schemeBadge = `<span style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; padding:2px 6px; border-radius:6px; font-size:10px; font-weight:800; margin-left:6px;">🏷️ -Rs ${entry.schemeDiscount} OFF</span>`;
        }

        html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-bottom:1px solid #f1f5f9;">
            <div style="display:flex; align-items:center;">
                ${thumb}
                <div>
                    <div style="font-weight:800; font-size:13px; color:#0f172a;">${item.name} ${schemeBadge}</div>
                    <div style="font-size:11px; color:#64748b;">${entry.qty} ${UNIT_LBL(item.unit)} × Rs ${entry.rate}</div>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-weight:900; font-size:14px; color:#15803d;">Rs ${lineTotal.toFixed(2)}</div>
                <button type="button" onclick="removeCatItem('${item.id}')" style="background:none; border:none; color:#ef4444; font-size:11px; cursor:pointer; padding:2px 0;">Remove ✖</button>
            </div>
        </div>`;
    });

    if (listEl) listEl.innerHTML = html;

    const prevBal = selectedCustomer ? (selectedCustomer.balance || 0) : 0;
    const finalBill = Math.max(0, subtotal - totalDiscount);
    const grand = prevBal + finalBill;

    if (subtotalEl) subtotalEl.innerText = subtotal.toFixed(2);
    if (prevBalEl) prevBalEl.innerText = prevBal.toFixed(2);
    if (grandEl) grandEl.innerText = grand.toFixed(2);

    const recInput = document.getElementById('catReviewReceived');
    const balEl = document.getElementById('catReviewBalance');
    if (recInput) {
        recInput.value = '0';
        recInput.oninput = () => {
            const r = parseFloat(recInput.value) || 0;
            const b = Math.max(0, grand - r);
            if (balEl) balEl.innerText = b.toFixed(2);
        };
    }
    if (balEl) balEl.innerText = grand.toFixed(2);

    if (modal) modal.style.display = 'flex';
}

window.removeCatItem = function(stockId) {
    if (catCart[stockId]) {
        delete catCart[stockId];
        renderCatalogueItem();
        updateCatalogueStickyBar();
        openCatalogueReviewModal();
    }
};

async function submitCatalogueFieldOrder() {
    const entries = Object.values(catCart);
    if (entries.length === 0) {
        Swal.fire('آرڈر خالی ہے', 'براہ کرم کم از کم 1 آئٹم شامل کریں۔', 'warning');
        return;
    }

    const modal = document.getElementById('catReviewModal');
    const submitBtn = document.getElementById('catBtnSubmitOrder');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> آرڈر محفوظ ہو رہا ہے...';
    }

    try {
        const orderNo = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
        const bookerName = (myUser && myUser.name) ? myUser.name : ((myUser && myUser.email) ? myUser.email.split('@')[0] : 'Staff');
        const bookerMobile = (myUser && myUser.mobile) || '';
        const notes = document.getElementById('catReviewNotes')?.value.trim() || '';

        const items = entries.map(e => ({
            name: e.item.name,
            qty: e.qty,
            rate: e.rate,
            total: e.qty * e.rate,
            stockId: e.item.id,
            unit: e.item.unit || 'pcs',
            hasScheme: !!e.item.hasScheme,
            schemeLabel: e.item.schemeLabel || '',
            freeQty: e.freeQty || 0,
            discount: e.schemeDiscount || 0
        }));

        let subTotal = 0;
        let totalDiscount = 0;
        let totalUnits = 0;
        let totalFreeUnits = 0;

        items.forEach(it => {
            subTotal += it.total;
            totalDiscount += (it.discount || 0);
            totalUnits += it.qty;
            totalFreeUnits += (it.freeQty || 0);
        });

        const prevBal = selectedCustomer ? (selectedCustomer.balance || 0) : 0;
        const currentBillTotal = Math.max(0, subTotal - totalDiscount);
        const grandTotal = prevBal + currentBillTotal;
        const receivedAmt = parseFloat(document.getElementById('catReviewReceived')?.value) || 0;
        const netBalance = Math.max(0, grandTotal - receivedAmt);

        const orderData = {
            agencyId: myAgencyId,
            billNo: orderNo,
            orderNo: orderNo,
            orderStatus: 'pending_approval', // ⏳ Admin approval required!
            orderType: 'field_order',
            deliveryStatus: 'pending',
            customerId: selectedCustomer ? selectedCustomer.id : null,
            customerName: selectedCustomer ? (selectedCustomer.name || 'Counter Sale') : 'Counter Sale',
            customerShop: selectedCustomer ? (selectedCustomer.shopName || '') : '',
            customerMobile: selectedCustomer ? (selectedCustomer.mobile || '') : '',
            customerRoute: selectedCustomer ? (selectedCustomer.route || '') : '',
            customerType: selectedCustomer ? (selectedCustomer.customerType || activeRateTier) : activeRateTier,
            items: items,
            itemCount: items.length,
            totalUnits: totalUnits,
            totalFreeUnits: totalFreeUnits,
            subTotal: subTotal,
            discount: totalDiscount,
            billAmount: currentBillTotal,
            previousBalance: prevBal,
            grandTotal: grandTotal,
            received: receivedAmt,
            balance: netBalance,
            bookerNotes: notes,
            createdBy: myUid,
            bookerId: myUid,
            bookerName: bookerName,
            bookerMobile: bookerMobile,
            createdAt: new Date().toISOString(),
            date: new Date().toLocaleDateString('en-PK'),
            time: new Date().toLocaleTimeString('en-PK', {hour:'2-digit', minute:'2-digit'}),
            timestamp: Date.now()
        };

        if (navigator.onLine) {
            // Save directly to 'bills' collection (which delivery-returns.html and admin portal watch)
            const billRef = db.collection('bills').doc();
            orderData.id = billRef.id;
            await billRef.set(orderData);

            // Also mirror in 'orders' collection for redundancy
            try {
                await db.collection('orders').doc(billRef.id).set(orderData);
            } catch (eOrd) {}
        } else {
            // Save offline
            let offlineQueue = [];
            try {
                offlineQueue = JSON.parse(localStorage.getItem(`eb_offline_orders_${myAgencyId}`) || '[]');
            } catch (e) {}
            offlineQueue.push(orderData);
            localStorage.setItem(`eb_offline_orders_${myAgencyId}`, JSON.stringify(offlineQueue));
            updateNetworkStatus();
        }

        // Close modal and reset cart
        if (modal) modal.style.display = 'none';
        catCart = {};
        renderCatalogueItem();
        updateCatalogueStickyBar();
        syncCatCartToTableRows();

        await Swal.fire({
            title: '✅ فیلڈ آرڈر بک ہو گیا!',
            html: `
                <div style="text-align:center; font-size:14px; line-height:1.8;">
                    <div style="font-size:24px; font-weight:900; color:#d97706; margin-bottom:8px;">${orderNo}</div>
                    <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:10px; padding:10px; color:#92400e; margin-bottom:10px;">
                        ⏳ <b>Admin Approval Pending (ایڈمن منظوری کا منتظر)</b><br>
                        یہ آرڈر کامیابی کے ساتھ ایڈمن پورٹل میں محفوظ ہو چکا ہے۔ ایڈمن کی منظوری کے بعد بل پرنٹ اور سپلائر کی ترسیل شروع ہوگی۔
                    </div>
                    <div>👤 <b>دکان دار:</b> ${orderData.customerName} ${orderData.customerShop ? `(${orderData.customerShop})` : ''}</div>
                    <div>📦 <b>کل آئٹمز:</b> ${orderData.itemCount} (${orderData.totalUnits} Units) ${orderData.totalFreeUnits ? `+ 🎁 ${orderData.totalFreeUnits} Free Units` : ''}</div>
                    <div>💰 <b>کل رقم:</b> Rs ${orderData.grandTotal.toLocaleString()}</div>
                    ${receivedAmt > 0 ? `<div>💵 <b>وصول رقم:</b> <span style="color:#16a34a; font-weight:bold;">Rs ${receivedAmt.toLocaleString()}</span> &nbsp;|&nbsp; باقی: <b>Rs ${netBalance.toLocaleString()}</b></div>` : ''}
                </div>
            `,
            icon: 'success',
            confirmButtonColor: '#27ae60',
            confirmButtonText: 'اگلا آرڈر بک کریں (Next Order)'
        });

    } catch (err) {
        console.error('Catalogue order booking error:', err);
        Swal.fire('خرابی', 'آرڈر محفوظ نہیں ہو سکا: ' + (err.message || err), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 📥 SUBMIT FIELD ORDER TO ADMIN (ایڈمن منظوری کے لیے بھیجیں)';
        }
    }
}

// ============================================
// 💵 QUICK KHATA RECOVERY ENGINE (FIELD BOOKING RECOVERY)
// ============================================
window.openQuickKhataRecoveryModal = async function(custId) {
    const c = allMyCustomers.find(x => x.id === (custId || (selectedCustomer ? selectedCustomer.id : null)));
    if (!c) {
        Swal.fire('⚠️', 'پہلے کسٹمر یا دکان دار منتخب کریں۔', 'warning');
        return;
    }

    const currentBal = parseFloat(c.balance || 0);
    if (currentBal <= 0) {
        Swal.fire({
            icon: 'info',
            title: 'No Pending Balance',
            text: `اس گاہک (${c.name}) کے ذمے کوئی پچھلا بقایا واجب الادا نہیں ہے۔ کھاتہ کلیئر ہے۔`,
            confirmButtonColor: '#10b981'
        });
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: `💵 پچھلے بل کی وصولی / ریکوری`,
        html: `
            <div style="text-align:left; font-size:13px; font-family:'Segoe UI',sans-serif;">
                <div style="margin-bottom:12px; background:#fffbeb; border:1px solid #fde68a; padding:10px 14px; border-radius:10px;">
                    <div style="font-size:14px; font-weight:800; color:#0f172a;">👤 ${c.name} ${c.shopName ? `(${c.shopName})` : ''}</div>
                    <div style="font-size:12px; color:#64748b; margin-top:2px;">📱 ${c.mobile || 'No Mobile'} | 🛣️ ${c.route || 'General'}</div>
                    <div style="margin-top:6px; font-size:15px; font-weight:900; color:#b45309;">
                        پچھلا کل بقایا: Rs ${Math.round(currentBal).toLocaleString()}
                    </div>
                </div>

                <div style="margin-bottom:12px;">
                    <label style="font-weight:800; display:block; margin-bottom:4px; color:#334155;">
                        وصول رقم (Received Amount Rs) *
                    </label>
                    <input type="number" id="swalRecAmt" step="any" min="1" max="${currentBal}" value="${currentBal}" placeholder="e.g. 2000" style="width:100%; height:44px; padding:8px 12px; border-radius:8px; border:2px solid #16a34a; font-size:18px; font-weight:900; color:#15803d; box-sizing:border-box;">
                    <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:11px; color:#64748b;">
                        <span>پوری رقم وصول یا جزوی (Partial) درج کر سکتے ہیں۔</span>
                        <a href="javascript:void(0)" onclick="document.getElementById('swalRecAmt').value = ${currentBal}" style="color:#0284c7; font-weight:bold; text-decoration:none;">Full Pay (پوری رقم)</a>
                    </div>
                </div>

                <div style="margin-bottom:12px;">
                    <label style="font-weight:800; display:block; margin-bottom:4px; color:#334155;">
                        طریقۂ ادائیگی (Payment Mode) *
                    </label>
                    <select id="swalRecMethod" style="width:100%; height:40px; padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px; background:#fff; box-sizing:border-box;">
                        <option value="Cash" selected>💵 Cash (نقد مارکیٹ وصولی)</option>
                        <option value="Bank / Online">🏦 Bank / Online Transfer</option>
                        <option value="JazzCash">📱 JazzCash</option>
                        <option value="EasyPaisa">📱 EasyPaisa</option>
                        <option value="Cheque">📜 Cheque</option>
                    </select>
                </div>

                <div style="margin-bottom:10px;">
                    <label style="font-weight:800; display:block; margin-bottom:4px; color:#334155;">
                        خصوصی نوٹ / تفصیل (Optional)
                    </label>
                    <input type="text" id="swalRecNote" placeholder="e.g. مارکیٹ وزٹ پر پچھلے بل کی ریکوری وصول کی" style="width:100%; height:38px; padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px; box-sizing:border-box;">
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#64748b',
        confirmButtonText: '💾 وصولی محفوظ کریں (Save Recovery)',
        cancelButtonText: 'منسوخ (Cancel)',
        preConfirm: () => {
            const amt = parseFloat(document.getElementById('swalRecAmt').value);
            if (!amt || amt <= 0) {
                Swal.showValidationMessage('براہ کرم وصول شدہ رقم درج کریں!');
                return false;
            }
            return {
                amount: amt,
                method: document.getElementById('swalRecMethod').value,
                note: document.getElementById('swalRecNote').value.trim()
            };
        }
    });

    if (!formValues) return;

    try {
        Swal.fire({ title: 'وصولی محفوظ ہو رہی ہے...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const receivedAmt = formValues.amount;
        const newBal = Math.max(0, currentBal - receivedAmt);
        const bookerName = (myUser && myUser.name) ? myUser.name : ((myUser && myUser.email) ? myUser.email.split('@')[0] : 'Staff');
        const vBillNo = 'PAY-' + Math.floor(10000 + Math.random() * 90000);

        const payDoc = {
            billNo: vBillNo,
            orderNo: vBillNo,
            type: 'payment',
            orderType: 'recovery_payment',
            orderStatus: 'approved',
            deliveryStatus: 'delivered',
            agencyId: myAgencyId,
            createdBy: myUid,
            bookerId: myUid,
            bookerName: bookerName,
            bookerMobile: (myUser && myUser.mobile) || '',
            customerId: c.id,
            customerName: c.name,
            customerShop: c.shopName || '',
            customerShopName: c.shopName || '',
            customerMobile: c.mobile || '',
            customerRoute: c.route || '',
            paymentAmount: receivedAmt,
            paymentMethod: formValues.method,
            note: formValues.note || `Recovery collected by ${bookerName}`,
            items: [{
                name: `Previous Bill Recovery (${formValues.method})`,
                qty: 1,
                rate: receivedAmt,
                total: receivedAmt
            }],
            subTotal: 0,
            discount: 0,
            billAmount: 0,
            grandTotal: 0,
            previousBalance: currentBal,
            received: receivedAmt,
            balance: newBal,
            date: new Date().toLocaleDateString('en-PK'),
            time: new Date().toLocaleTimeString('en-PK', {hour:'2-digit', minute:'2-digit'}),
            createdAt: new Date().toISOString(),
            timestamp: Date.now()
        };

        if (navigator.onLine) {
            // Update customer balance in Firestore
            await db.collection('customers').doc(c.id).update({
                balance: newBal,
                lastPaymentAt: new Date().toISOString(),
                lastPaymentAmount: receivedAmt,
                lastPaymentBy: myUid,
                updatedAt: new Date().toISOString()
            });

            // Save voucher to bills collection
            const docRef = await db.collection('bills').add(payDoc);
            payDoc.id = docRef.id;

            // Mirror to orders
            try {
                await db.collection('orders').doc(docRef.id).set(payDoc);
            } catch(e) {}
        } else {
            // Offline support
            payDoc.isOffline = true;
            const offQueue = getOfflineOrders();
            offQueue.push(payDoc);
            saveOfflineOrders(offQueue);
        }

        // Update local object & memory
        c.balance = newBal;
        if (selectedCustomer && selectedCustomer.id === c.id) {
            selectedCustomer.balance = newBal;
            selectCustomerObject(selectedCustomer);
        }

        // Cache update
        try {
            localStorage.setItem(`eb_cust_cache_${myAgencyId}`, JSON.stringify(allMyCustomers));
        } catch(e) {}

        Swal.fire({
            icon: 'success',
            title: '✅ رقم کامیابی سے وصول ہو گئی!',
            html: `
                دکان دار: <b>${c.name} (${c.shopName || ''})</b><br>
                وصول شدہ رقم: <b style="color:#16a34a; font-size:20px;">Rs ${receivedAmt.toLocaleString()}</b><br>
                باقی بقایا رقم: <b style="color:${newBal > 0 ? '#b45309' : '#15803d'}; font-size:16px;">Rs ${newBal.toLocaleString()}</b><br><br>
                <small style="color:#64748b;">واؤچر نمبر: ${vBillNo}</small>
            `,
            showCancelButton: true,
            confirmButtonColor: '#0284c7',
            cancelButtonColor: '#25d366',
            confirmButtonText: '🖨️ پرنٹ سلپ (Print Slip)',
            cancelButtonText: '📲 واٹس ایپ سلپ (WhatsApp)'
        }).then(res => {
            if (res.isConfirmed) {
                printQuickRecoverySlip(payDoc);
            } else if (res.dismiss === Swal.DismissReason.cancel) {
                shareRecoveryWhatsApp(payDoc);
            }
        });

    } catch (err) {
        console.error('Quick recovery error:', err);
        Swal.fire('Error', 'ریکوری محفوظ کرنے میں مسئلہ آیا: ' + err.message, 'error');
    }
};

function printQuickRecoverySlip(doc) {
    const agencyTitle = myAgency?.name || 'Distribution Agency';
    const agencyAddress = myAgency?.address || '';
    const agencyMobile = myAgency?.mobile || '';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Payment Receipt - ${doc.billNo}</title>
        <style>
            @page { size: 80mm auto; margin: 4mm; }
            body { font-family: monospace, sans-serif; font-size: 12px; margin: 0; color: #000; }
            .text-center { text-align: center; }
            .line { border-top: 1px dashed #000; margin: 6px 0; }
            .flex-between { display: flex; justify-content: space-between; }
            .bold { font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="text-center bold" style="font-size:15px;">${agencyTitle}</div>
        ${agencyAddress ? `<div class="text-center" style="font-size:11px;">${agencyAddress}</div>` : ''}
        ${agencyMobile ? `<div class="text-center" style="font-size:11px;">📱 ${agencyMobile}</div>` : ''}
        <div class="line"></div>
        <div class="text-center bold" style="font-size:13px;">CASH RECOVERY RECEIPT</div>
        <div class="text-center" style="font-size:11px;">رسید وصولی نقد رقم</div>
        <div class="line"></div>
        <div class="flex-between"><span>Voucher #:</span><span class="bold">${doc.billNo}</span></div>
        <div class="flex-between"><span>Date:</span><span>${doc.date} ${doc.time || ''}</span></div>
        <div class="flex-between"><span>Booker / Staff:</span><span>${doc.bookerName || 'Staff'}</span></div>
        <div class="line"></div>
        <div class="flex-between"><span>Customer:</span><span class="bold">${doc.customerName}</span></div>
        ${doc.customerShop ? `<div class="flex-between"><span>Shop:</span><span>${doc.customerShop}</span></div>` : ''}
        ${doc.customerMobile ? `<div class="flex-between"><span>Mobile:</span><span>${doc.customerMobile}</span></div>` : ''}
        <div class="line"></div>
        <div class="flex-between" style="font-size:11px;"><span>Previous Due:</span><span>Rs ${Math.round(doc.previousBalance || 0).toLocaleString()}</span></div>
        <div class="flex-between bold" style="font-size:14px; margin:4px 0;"><span>AMOUNT RECEIVED:</span><span>Rs ${Math.round(doc.received || 0).toLocaleString()}</span></div>
        <div class="flex-between" style="font-size:11px;"><span>Payment Mode:</span><span>${doc.paymentMethod || 'Cash'}</span></div>
        <div class="line"></div>
        <div class="flex-between bold" style="font-size:13px;"><span>NET BALANCE REMAINING:</span><span>Rs ${Math.round(doc.balance || 0).toLocaleString()}</span></div>
        <div class="line"></div>
        <div class="text-center" style="font-size:10px; margin-top:10px;">شکریہ! جزاک اللہ خیراً</div>
    </body>
    </html>`;

    const printWin = window.open('', '_blank', 'width=400,height=600');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
        setTimeout(() => { printWin.focus(); printWin.print(); }, 350);
    }
}

function shareRecoveryWhatsApp(doc) {
    const phone = (doc.customerMobile || '').replace(/\D/g, '');
    const msg = `*${myAgency?.name || 'Distribution Agency'}*\n` +
        `🧾 *CASH RECOVERY RECEIPT / رسید وصولی*\n` +
        `--------------------------------\n` +
        `👤 *Customer:* ${doc.customerName} (${doc.customerShop || ''})\n` +
        `📄 *Voucher No:* ${doc.billNo}\n` +
        `📅 *Date:* ${doc.date} ${doc.time || ''}\n` +
        `📕 *Booker:* ${doc.bookerName || 'Staff'}\n` +
        `--------------------------------\n` +
        `💰 *Previous Balance:* Rs ${Math.round(doc.previousBalance || 0).toLocaleString()}\n` +
        `✅ *Amount Received:* Rs ${Math.round(doc.received || 0).toLocaleString()} (${doc.paymentMethod || 'Cash'})\n` +
        `⏳ *Remaining Balance:* Rs ${Math.round(doc.balance || 0).toLocaleString()}\n` +
        `--------------------------------\n` +
        `شکریہ! جزاک اللہ خیراً`;

    const url = phone 
        ? `https://wa.me/${phone.startsWith('0') ? '92' + phone.slice(1) : phone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}
