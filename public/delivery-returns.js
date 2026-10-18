// ============================================
// 🚚 VYAPAR-STYLE DELIVERY, VAN DISPATCH & STOCK RETURN ENGINE
// 100% Zero Profit / Zero Loss Inward Stock Return
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

// Global State
let myUid = null;
let myUser = null;
let myAgencyId = null;
let myAgency = null;

let allStaff = [];       // Bookers and Suppliers
let allStock = [];       // Agency inventory items
let allOrders = [];      // Booker field bills / orders
let allReturns = [];     // Stock return inward records
let allClaims = [];      // 💥 Damaged, Expired & Claims records
let allClaimCategories = []; // 🏷️ Categories for damage/loss
let activeTab = 'orders';
let activeFilter = 'all';
let activeClaimStatus = 'all';
let activeClaimCategory = 'all';

let lastCreatedVoucher = null;

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
    if (isUserAdmin()) return true;
    if (isUserBooker()) {
        const userPerms = myUser?.permissions || {};
        if (userPerms.approve_orders === true) return true;
        if (myAgency && (myAgency.allowBookerApprove === true || myAgency.bookerApprovalPolicy === 'allow_bookers')) return true;
        return false;
    }
    return false;
}

function setupBookerRoleUI() {
    const isBooker = isUserBooker();
    if (!isBooker) return;

    // 1. Hide staff management tab from booker (Admin only)
    const staffTabBtn = document.querySelector('.vyapar-tab-btn[data-tab="staff"]');
    if (staffTabBtn) staffTabBtn.style.display = 'none';

    // 2. Hide van dispatch challan button (Admin/Warehouse only)
    const dispatchBtn = document.getElementById('btnOpenDispatchModal');
    if (dispatchBtn) dispatchBtn.style.display = 'none';

    // 3. Hide categories management button (Admin only)
    const catBtn = document.getElementById('btnManageCategories');
    if (catBtn) catBtn.style.display = 'none';

    // 4. Update Header for Booker
    const nameEl = document.getElementById('agencyNameHeader');
    if (nameEl) {
        nameEl.innerText = `${myAgency?.name || 'Our Agency'} • Market Operations (${myUser.name || 'Booker'})`;
    }
}

// ============================================
// 🛡️ AUTH GUARD & INITIALIZATION
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
            window.location.href = 'profile.html';
            return;
        }
        myUser = doc.data() || {};
        myAgencyId = myUser.agencyId;

        if (!myAgencyId && myUser.role !== 'super-admin') {
            window.location.href = 'profile.html';
            return;
        }

        // Load Agency
        if (myAgencyId) {
            const agDoc = await db.collection('agencies').doc(myAgencyId).get();
            if (agDoc.exists) {
                myAgency = agDoc.data() || {};
                const nameEl = document.getElementById('agencyNameHeader');
                if (nameEl) nameEl.innerText = `${myAgency.name || 'Our Agency'} • ${myAgency.city || 'Depot'}`;
            }
        }

        // Initialize UI listeners
        setupTabs();
        setupFilters();
        setupReturnReasonToggle();
        setupModals();

        // Load Core Datasets
        await Promise.all([
            loadStaff(),
            loadStock(),
            loadOrders(),
            loadReturns(),
            loadClaimCategories(),
            loadDamageClaims()
        ]);

        updateKPIRibbon();

        // 🚚 Setup Dedicated Role Interfaces
        setupSupplierRoleUI();
        setupBookerRoleUI();

        // Check URL parameter or hash on start
        const urlParams = new URLSearchParams(window.location.search);
        const reqTab = urlParams.get('tab') || window.location.hash.replace('#', '');
        if (reqTab && ['claims', 'returns', 'history', 'staff', 'orders'].includes(reqTab)) {
            switchVyaparTab(reqTab);
        } else if (myUser && (myUser.role === 'supplier' || myUser.role === 'delivery')) {
            switchVyaparTab('orders');
        }

        // Real-time listener for incoming field orders
        listenForLiveOrders();

    } catch (err) {
        console.error('Delivery hub init error:', err);
        Swal.fire('Error', 'Initialization failed: ' + err.message, 'error');
    }
});

// ============================================
// 📑 TABS CONTROLLER
// ============================================
window.switchVyaparTab = function(tab) {
    document.querySelectorAll('.vyapar-tab-btn').forEach(b => {
        if (b.dataset.tab === tab) b.classList.add('active');
        else b.classList.remove('active');
    });
    activeTab = tab;

    const elOrders = document.getElementById('tabOrders');
    const elClaims = document.getElementById('tabClaims');
    const elReturns = document.getElementById('tabReturns');
    const elHistory = document.getElementById('tabHistory');
    const elStaff = document.getElementById('tabStaff');

    if (elOrders) elOrders.style.display = tab === 'orders' ? 'block' : 'none';
    if (elClaims) elClaims.style.display = tab === 'claims' ? 'block' : 'none';
    if (elReturns) elReturns.style.display = tab === 'returns' ? 'block' : 'none';
    if (elHistory) elHistory.style.display = tab === 'history' ? 'block' : 'none';
    if (elStaff) elStaff.style.display = tab === 'staff' ? 'block' : 'none';

    if (tab === 'claims') renderClaimsTable();
    if (tab === 'history') renderHistoryAnalysis();
    if (tab === 'staff') renderStaffTable();
};

function setupTabs() {
    document.querySelectorAll('.vyapar-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchVyaparTab(this.dataset.tab);
        });
    });
}

function setupFilters() {
    // Orders filter chips
    document.querySelectorAll('#tabOrders .filter-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            document.querySelectorAll('#tabOrders .filter-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            activeFilter = this.dataset.status;
            renderOrdersTable();
        });
    });

    // Claims filter chips
    document.querySelectorAll('[data-claim-status]').forEach(chip => {
        chip.addEventListener('click', function() {
            document.querySelectorAll('[data-claim-status]').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            activeClaimStatus = this.dataset.claimStatus;
            renderClaimsTable();
        });
    });

    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => renderOrdersTable());
    }

    const returnSearchInput = document.getElementById('returnSearchInput');
    if (returnSearchInput) {
        returnSearchInput.addEventListener('input', () => renderReturnsTable());
    }

    const claimSearchInput = document.getElementById('claimSearchInput');
    if (claimSearchInput) {
        claimSearchInput.addEventListener('input', () => renderClaimsTable());
    }

    const claimCategoryFilter = document.getElementById('claimCategoryFilter');
    if (claimCategoryFilter) {
        claimCategoryFilter.addEventListener('change', function() {
            activeClaimCategory = this.value;
            renderClaimsTable();
        });
    }
}

// ============================================
// 🔄 RETURN REASON DYNAMIC TEXTBOX TOGGLE (User Requirement)
// ============================================
function setupReturnReasonToggle() {
    const sel = document.getElementById('retReasonSelect');
    const container = document.getElementById('customReasonContainer');
    const textInput = document.getElementById('retCustomReasonText');

    if (sel && container) {
        sel.addEventListener('change', function() {
            if (this.value === 'other') {
                container.style.display = 'block';
                if (textInput) {
                    textInput.required = true;
                    textInput.focus();
                }
            } else {
                container.style.display = 'none';
                if (textInput) {
                    textInput.required = false;
                    textInput.value = '';
                }
            }
        });
    }
}

// ============================================
// 👥 LOAD & MANAGE FIELD STAFF (BOOKERS & SUPPLIERS)
// ============================================
async function loadStaff() {
    try {
        // Query users by agencyId safely (avoids composite index requirement!)
        const snap = await db.collection('users').where('agencyId', '==', myAgencyId).get();
        allStaff = [];
        snap.forEach(d => {
            const data = d.data();
            data.id = d.id;
            if (data.status !== 'deleted' && (data.role === 'booker' || data.role === 'supplier' || data.role === 'delivery')) {
                allStaff.push(data);
            }
        });

        populateStaffSelectDropdowns();
        renderStaffTable();
    } catch (e) {
        console.error('Load staff error:', e);
    }
}

function populateStaffSelectDropdowns() {
    const supplierSelects = [
        document.getElementById('retSupplierSelect'),
        document.getElementById('dispatchSupplierSelect')
    ];
    const bookerSelects = [
        document.getElementById('retBookerSelect')
    ];

    const suppliers = allStaff.filter(s => s.role === 'supplier' || s.role === 'delivery');
    const bookers = allStaff.filter(s => s.role === 'booker');

    supplierSelects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '<option value="">-- سپلائر منتخب کریں --</option>';
        suppliers.forEach(sp => {
            sel.innerHTML += `<option value="${sp.id}">${sp.name || sp.email} (${sp.mobile || 'No Mobile'}) - ${sp.route || 'General'}</option>`;
        });
    });

    bookerSelects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '<option value="">-- آرڈر بکر منتخب کریں --</option>';
        bookers.forEach(bk => {
            sel.innerHTML += `<option value="${bk.id}">${bk.name || bk.email} (${bk.mobile || 'No Mobile'}) - ${bk.route || 'General'}</option>`;
        });
    });
}

function renderStaffTable() {
    const tbody = document.getElementById('staffTableBody');
    if (!tbody) return;

    if (allStaff.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:25px; color:#94a3b8;">
            کوئی فیلڈ اسٹاف نہیں ملا۔ اوپر <b>+ Add Booker or Supplier</b> پر کلک کر کے شامل کریں۔
        </td></tr>`;
        return;
    }

    tbody.innerHTML = allStaff.map(st => {
        const isSupplier = st.role === 'supplier' || st.role === 'delivery';
        const roleBadge = isSupplier
            ? `<span style="background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:10px; font-size:11px; font-weight:bold;">🚚 Delivery Supplier</span>`
            : `<span style="background:#fef3c7; color:#b45309; padding:3px 8px; border-radius:10px; font-size:11px; font-weight:bold;">📕 Order Booker</span>`;

        const statusBadge = st.status === 'blocked'
            ? `<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:bold;">🚫 Blocked</span>`
            : `<span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:bold;">✅ Active</span>`;

        return `
            <tr>
                <td>
                    <b>${st.name || 'Unnamed'}</b><br>
                    ${roleBadge}
                </td>
                <td>
                    ${st.mobile ? `<a href="tel:${st.mobile}" style="color:#0284c7; text-decoration:none;"><i class="fas fa-phone-alt"></i> ${st.mobile}</a>` : '<span style="color:#94a3b8;">—</span>'}
                </td>
                <td>
                    <span style="font-size:12px; color:#475569;">${st.email}</span><br>
                    <small style="color:#94a3b8;">Pass: <span style="font-family:monospace; background:#e2e8f0; padding:1px 4px; border-radius:4px;">${st.tempPassword || '******'}</span></small>
                </td>
                <td><b>${st.route || 'General Depot Area'}</b></td>
                <td>${statusBadge}</td>
                <td>
                    <span style="font-size:12px; color:#64748b;">Active on Field</span>
                </td>
                <td style="text-align:right;">
                    <button class="btn" onclick="toggleStaffBlock('${st.id}', '${st.status || 'active'}')" style="padding:4px 8px; font-size:11px; background:#f1f5f9; color:#475569; border-radius:6px; margin-right:4px;">
                        ${st.status === 'blocked' ? 'Unblock' : 'Block'}
                    </button>
                    ${st.mobile ? `<a href="https://wa.me/${st.mobile.replace(/\D/g, '')}" target="_blank" class="btn" style="padding:4px 8px; font-size:11px; background:#10b981; color:#fff; border-radius:6px; text-decoration:none;"><i class="fab fa-whatsapp"></i></a>` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleStaffBlock(staffId, currentStatus) {
    const next = currentStatus === 'blocked' ? 'active' : 'blocked';
    try {
        await db.collection('users').doc(staffId).update({ status: next });
        await loadStaff();
        Swal.fire({ toast: true, position: 'top-end', timer: 1500, icon: 'success', title: `Staff status updated to ${next}!` });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

// ============================================
// 📦 LOAD LIVE STOCK ITEMS
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

// ============================================
// 📋 LOAD BOOKER ORDERS & REAL-TIME LISTENER
// ============================================
async function loadOrders() {
    try {
        let snap;
        try {
            snap = await db.collection('bills')
                .where('agencyId', '==', myAgencyId)
                .orderBy('createdAt', 'desc')
                .limit(150)
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

        // 🔄 ALSO CHECK 'orders' COLLECTION TO MIGRATE & SHOW ANY RECENTLY BOOKED ORDERS!
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
                    // Ensure it is saved in bills collection so all approval & print functions work seamlessly
                    try {
                        await db.collection('bills').doc(d.id).set(billDocData);
                    } catch (eSave) {}
                    billDocData.id = d.id;
                    allOrders.push(sanitizeOrder(billDocData));
                }
            }
        } catch (eOrd) {
            console.warn('Orders collection migration check:', eOrd);
        }

        allOrders.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        renderOrdersTable();
        updateKPIRibbon();
    } catch (e) {
        console.error('Orders load error:', e);
        try {
            const snap = await db.collection('bills').where('agencyId', '==', myAgencyId).get();
            allOrders = [];
            snap.forEach(d => {
                const data = d.data();
                data.id = d.id;
                allOrders.push(sanitizeOrder(data));
            });
            allOrders.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            renderOrdersTable();
            updateKPIRibbon();
        } catch (err2) {
            console.error('Orders load fallback error:', err2);
        }
    }
}

function listenForLiveOrders() {
    if (!myAgencyId) return;

    // 1. Live listener on bills collection
    db.collection('bills')
        .where('agencyId', '==', myAgencyId)
        .onSnapshot(snap => {
            let changed = false;
            snap.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    data.id = change.doc.id;
                    if (!allOrders.some(o => o.id === data.id)) {
                        allOrders.unshift(data);
                        changed = true;
                    }
                } else if (change.type === 'modified') {
                    const data = change.doc.data();
                    data.id = change.doc.id;
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
                renderOrdersTable();
                updateKPIRibbon();
            }
        }, err => console.warn('Live order listener warning:', err));

    // 2. Live listener on orders collection for instant sync
    try {
        db.collection('orders')
            .where('agencyId', '==', myAgencyId)
            .onSnapshot(snap => {
                let changed = false;
                snap.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        data.id = change.doc.id;
                        if (!allOrders.some(o => o.id === data.id || (o.orderNo && o.orderNo === data.orderNo))) {
                            if (!data.billNo && data.orderNo) data.billNo = data.orderNo;
                            // Also mirror to bills
                            db.collection('bills').doc(data.id).set(data).catch(() => {});
                            allOrders.unshift(data);
                            changed = true;
                        }
                    }
                });
                if (changed) {
                    renderOrdersTable();
                    updateKPIRibbon();
                }
            }, () => {});
    } catch (e2) {}
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
            const newCount = (cDoc.exists ? (cDoc.data().count || 0) : 0) + 1;
            tx.set(counterRef, { count: newCount, type: 'stock', updatedAt: new Date().toISOString() });
            return newCount;
        });
        return formatBillNo(prefix, result);
    } catch (e) {
        return formatBillNo(prefix, Date.now().toString().slice(-6));
    }
}

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    const query = (document.getElementById('orderSearchInput')?.value || '').toLowerCase().trim();

    // Count pending approval orders
    const pendingApprovalCount = allOrders.filter(o => isOrderPendingApproval(o)).length;
    const chipCountEl = document.getElementById('chipPendingApprovalCount');
    if (chipCountEl) chipCountEl.innerText = pendingApprovalCount;

    const filtered = allOrders.filter(ord => {
        // Filter chip status
        const dStat = ord.deliveryStatus || 'pending';
        const isPending = isOrderPendingApproval(ord);

        // Supplier role filter: If logged in as supplier, allow viewing their assigned orders or all
        const isSupplierUser = myUser && (myUser.role === 'supplier' || myUser.role === 'delivery');
        if (isSupplierUser && activeFilter === 'my_dispatched') {
            if (ord.supplierId !== myUid && ord.supplierName !== myUser.name) return false;
            if (dStat !== 'dispatched') return false;
        }

        if (activeFilter === 'pending_approval') {
            if (!isPending) return false;
        } else if (activeFilter === 'approved') {
            if (ord.orderStatus !== 'approved' || dStat !== 'pending') return false;
        } else if (activeFilter !== 'all' && activeFilter !== 'my_dispatched' && dStat !== activeFilter) {
            return false;
        }

        // Search query
        if (query) {
            const billNo = (ord.billNo || '').toLowerCase();
            const cust = (ord.customerName || '').toLowerCase();
            const booker = (ord.bookerName || '').toLowerCase();
            return billNo.includes(query) || cust.includes(query) || booker.includes(query);
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">
            کوئی آرڈر نہیں ملا۔
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
            badgeStyle = 'background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-weight:800;';
        } else if (dStat === 'dispatched') {
            badgeClass = 'badge-dispatched';
            badgeText = '🚚 On Delivery Van';
        } else if (dStat === 'delivered') {
            badgeClass = 'badge-delivered';
            badgeText = '✅ Delivered';
        } else if (dStat === 'returned') {
            badgeClass = 'badge-returned';
            badgeText = '🔄 Stock Returned';
        } else if (ord.orderStatus === 'approved') {
            badgeClass = 'badge-delivered';
            badgeText = isBooker ? '✅ Approved by Admin (ایڈمن نے منظور کر لیا)' : '✅ Approved (منظور شدہ)';
            badgeStyle = 'background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; font-weight:bold;';
        }

        const itemsCount = (ord.items && ord.items.length) || ord.itemCount || 0;
        const totalAmount = Math.round(ord.billAmount || ord.grandTotal || 0).toLocaleString();

        return `
            <tr>
                <td><input type="checkbox" class="order-check" data-id="${ord.id}" onchange="updateBulkOrdersBar()" ${dStat === 'delivered' ? 'disabled' : ''}></td>
                <td>
                    <b>${ord.billNo || ord.id.slice(0,8)}</b><br>
                    <small style="color:#64748b;">${ord.date || ord.createdAt?.slice(0,10) || ''}</small>
                </td>
                <td>
                    <b>${ord.customerName || 'Counter Sale'}</b><br>
                    <small style="color:#64748b;">${ord.customerMobile ? `📱 ${ord.customerMobile}` : ''} ${ord.customerRoute ? `| 🛣️ ${ord.customerRoute}` : ''}</small>
                </td>
                <td>
                    <span style="color:#0284c7; font-weight:700;"><i class="fas fa-user-edit"></i> ${ord.bookerName || 'Staff Booker'}</span>
                </td>
                <td>
                    <b>${itemsCount} Items</b><br>
                    <span style="color:#10b981; font-weight:700;">Rs ${totalAmount}</span>
                </td>
                <td>
                    <span class="badge-status ${badgeClass}" style="${badgeStyle}">${badgeText}</span>
                </td>
                <td>
                    ${ord.supplierName ? `<b style="color:#334155;"><i class="fas fa-truck"></i> ${ord.supplierName}</b>` : '<span style="color:#94a3b8;">Not Assigned</span>'}
                </td>
                <td style="text-align:right;">
                    <div style="display:flex; justify-content:flex-end; gap:4px; flex-wrap:wrap;">
                        <button class="btn btn-sm" onclick="viewOrderDetails('${ord.id}')" style="background:#f1f5f9; color:#475569; border-radius:6px; font-size:11px; padding:4px 7px;" title="View Order Details">
                            <i class="fas fa-eye"></i> View
                        </button>

                        <!-- Approval Actions -->
                        ${isPendingApproval ? `
                            ${canApprove ? `
                                <button class="btn btn-sm" onclick="approveOrder('${ord.id}')" style="background:#10b981; color:#fff; border-radius:6px; font-size:11px; padding:4px 8px; font-weight:bold;" title="Approve & Generate Bill">
                                    <i class="fas fa-check"></i> Accept ${isBooker ? '<span style="font-size:9px;">(Allowed)</span>' : ''}
                                </button>
                                <button class="btn btn-sm" onclick="rejectOrder('${ord.id}')" style="background:#ef4444; color:#fff; border-radius:6px; font-size:11px; padding:4px 6px;" title="Reject Order">
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : `
                                <span style="background:#fffbeb; border:1px solid #fde68a; color:#b45309; font-size:10.5px; font-weight:800; padding:3px 7px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;" title="Only Admin can approve field orders (Admin Not Allowed)">
                                    <i class="fas fa-lock" style="color:#d97706;"></i> Admin Not Allowed
                                </span>
                            `}
                        ` : ''}

                        ${ord.orderStatus === 'approved' ? `
                            <button class="btn btn-sm" onclick="printOrderBill('${ord.id}')" style="background:#0284c7; color:#fff; border-radius:6px; font-size:11px; padding:4px 8px;" title="Print Customer Bill">
                                <i class="fas fa-print"></i> Print
                            </button>
                        ` : ''}

                        ${dStat === 'dispatched' ? `
                            <button class="btn btn-sm" onclick="openLoadingSheetForOrder('${ord.id}')" style="background:#0284c7; color:#fff; border-radius:6px; font-size:11px; padding:4px 7px;" title="Print Loading Sheet &amp; Gate Pass">
                                <i class="fas fa-file-invoice"></i> Sheet
                            </button>
                            <button class="btn btn-sm" onclick="markOrderDelivered('${ord.id}')" style="background:#10b981; color:#fff; border-radius:6px; font-size:11px; padding:4px 8px;" title="Mark as Delivered (Zero Return)">
                                <i class="fas fa-check"></i> Delivered
                            </button>
                            <button class="btn btn-sm" onclick="openReturnForOrder('${ord.id}')" style="background:#8b5cf6; color:#fff; border-radius:6px; font-size:11px; padding:4px 7px;" title="Record Unsold Return (مال واپسی)">
                                <i class="fas fa-undo"></i> Return
                            </button>
                        ` : ''}

                        ${ord.customerMobile ? `
                            <a href="https://wa.me/${ord.customerMobile.replace(/\D/g, '')}" target="_blank" class="btn btn-sm" style="background:#25d366; color:#fff; border-radius:6px; font-size:11px; padding:4px 8px;" title="WhatsApp">
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
// ✅ APPROVE SINGLE BOOKER ORDER
// Deducts inventory stock, updates customer Khata, issues official bill number
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

    const confirm = await Swal.fire({
        title: '✅ آرڈر منظور کریں؟',
        html: `دکان دار: <b>${ord.customerName}</b><br>
               بکر: <b>${ord.bookerName || 'Staff'}</b><br>
               آئٹمز: <b>${itemsCount}</b> | کل رقم: <b>Rs ${totalAmount}</b><br><br>
               <small style="color:#64748b;">منظوری پر انوائس نمبر جاری ہو گا اور گودام کا اسٹاک خودکار کٹ جائے گا۔</small>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ہاں، منظور کریں (Approve)',
        cancelButtonText: 'منسوخ',
        confirmButtonColor: '#10b981'
    });

    if (!confirm.isConfirmed) return;

    try {
        Swal.fire({
            title: 'منظوری جاری ہے...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const liveBillNo = await getNextLiveBillNo();
        const batch = db.batch();

        // 1. Update bill document
        const billRef = db.collection('bills').doc(orderId);
        batch.update(billRef, {
            orderStatus: 'approved',
            deliveryStatus: 'pending',
            billNo: liveBillNo,
            approvedAt: new Date().toISOString(),
            approvedBy: myUid
        });

        // 2. Deduct inventory stock & record movements
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
                customerName: ord.customerName,
                type: 'out',
                reason: 'sale',
                reasonLabel: '🛒 Approved Booker Order ' + liveBillNo,
                movements: movements,
                createdBy: myUid,
                createdAt: new Date().toISOString()
            });
        }

        // 3. Customer Ledger Balance Update
        if (ord.customerId) {
            const custRef = db.collection('customers').doc(ord.customerId);
            const cDoc = await custRef.get();
            if (cDoc.exists) {
                const cData = cDoc.data();
                const newBalance = (cData.balance || 0) + (ord.billAmount || 0) - (ord.received || 0);
                batch.update(custRef, {
                    balance: newBalance,
                    lastBillNo: liveBillNo,
                    lastBillAt: new Date().toISOString()
                });
            }
        }

        await batch.commit();

        try {
            await db.collection('orders').doc(orderId).update({
                orderStatus: 'approved',
                deliveryStatus: 'pending',
                billNo: liveBillNo,
                approvedAt: new Date().toISOString(),
                approvedBy: myUid
            });
        } catch (eOrd) {}

        ord.orderStatus = 'approved';
        ord.billNo = liveBillNo;

        renderOrdersTable();
        updateKPIRibbon();

        Swal.fire({
            icon: 'success',
            title: '✅ آرڈر منظور ہو گیا!',
            html: `نیا بل نمبر: <b style="font-size:22px; color:#0284c7;">${liveBillNo}</b><br>
                   دکان دار: <b>${ord.customerName}</b><br><br>
                   کیا آپ اس گاہک کا بل پرنٹ کرنا چاہتے ہیں؟`,
            showCancelButton: true,
            confirmButtonText: '🖨️ Print Customer Bill',
            cancelButtonText: 'ٹھیک ہے (Done)',
            confirmButtonColor: '#0284c7'
        }).then(res => {
            if (res.isConfirmed) {
                printOrderBill(orderId);
            }
        });

    } catch (e) {
        console.error('Approve order error:', e);
        Swal.fire('❌ Error', 'آرڈر منظور کرنے میں مسئلہ آیا: ' + e.message, 'error');
    }
}

// ============================================
// ❌ REJECT BOOKER ORDER
// ============================================
async function rejectOrder(orderId) {
    if (!canUserApproveOrders()) {
        Swal.fire({
            icon: 'warning',
            title: '🔒 Admin Not Allowed (ایڈمن کی منظوری درکار)',
            text: 'آپ کو آرڈر منسوخ یا ریجیکٹ کرنے کی اجازت نہیں ہے۔ صرف ایڈمن منسوخ کر سکتا ہے۔',
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
        renderOrdersTable();
        updateKPIRibbon();
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
    const body = document.getElementById('orderDetailsBody');
    const btnApprove = document.getElementById('btnModalApproveOrder');
    const btnPrint = document.getElementById('btnModalPrintBill');

    const isPending = isOrderPendingApproval(ord);

    let itemsTable = `
        <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:10px;">
            <thead>
                <tr style="background:#f1f5f9; text-align:left;">
                    <th style="padding:6px 8px; border:1px solid #cbd5e1;">#</th>
                    <th style="padding:6px 8px; border:1px solid #cbd5e1;">Item Name</th>
                    <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Qty</th>
                    <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:right;">Rate</th>
                    <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:right;">Total</th>
                </tr>
            </thead>
            <tbody>
    `;

    (ord.items || []).forEach((it, idx) => {
        const itemTot = (it.qty || 0) * (it.rate || 0);
        itemsTable += `
            <tr>
                <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center;">${idx + 1}</td>
                <td style="padding:6px 8px; border:1px solid #e2e8f0;"><b>${it.name || ''}</b></td>
                <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center;"><b>${it.qty || 0}</b> ${it.unit || ''}</td>
                <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:right;">Rs ${(it.rate || 0).toLocaleString()}</td>
                <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:right; font-weight:bold;">Rs ${itemTot.toLocaleString()}</td>
            </tr>
        `;
    });

    itemsTable += `
            </tbody>
        </table>
    `;

    body.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">
            <div>
                <h4 style="margin:0 0 4px; font-size:16px; color:#0f172a;">🏪 ${ord.customerName || 'Customer'}</h4>
                <div style="font-size:12px; color:#64748b;">
                    ${ord.customerMobile ? `📱 ${ord.customerMobile} &nbsp;|&nbsp; ` : ''}
                    🛣️ Route: <b>${ord.customerRoute || 'General'}</b>
                </div>
            </div>
            <div style="text-align:right;">
                <span style="font-size:11px; padding:3px 8px; border-radius:10px; font-weight:bold; ${isPending ? 'background:#fef3c7; color:#b45309;' : 'background:#dcfce7; color:#15803d;'}">
                    ${isPending ? '⏳ Pending Approval' : '✅ Approved Bill'}
                </span>
                <div style="font-weight:bold; font-size:15px; margin-top:4px; color:#0284c7;">${ord.billNo || ord.id.slice(0,8)}</div>
            </div>
        </div>

        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:10px; color:#475569;">
            <div><b>Order Booker:</b> 📕 ${ord.bookerName || 'Staff'}</div>
            <div><b>Date:</b> 📅 ${ord.date || ord.createdAt?.slice(0,10) || ''} ${ord.time || ''}</div>
        </div>

        ${itemsTable}

        <div style="margin-top:14px; padding:10px; background:#f8fafc; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:13px; color:#64748b;">Grand Total Payable:</div>
            <div style="font-size:18px; font-weight:800; color:#10b981;">Rs ${Math.round(ord.billAmount || ord.grandTotal || 0).toLocaleString()}</div>
        </div>
    `;

    if (isPending) {
        if (canUserApproveOrders()) {
            btnApprove.style.display = 'inline-flex';
            btnApprove.onclick = () => { closeOrderDetailsModal(); approveOrder(orderId); };
        } else {
            btnApprove.style.display = 'none';
        }
        btnPrint.style.display = 'none';
    } else {
        btnApprove.style.display = 'none';
        btnPrint.style.display = 'inline-flex';
        btnPrint.onclick = () => { printOrderBill(orderId); };
    }

    modal.style.display = 'flex';
}

window.closeOrderDetailsModal = () => {
    const modal = document.getElementById('modalOrderDetails');
    if (modal) modal.style.display = 'none';
};

// ============================================
// 🖨️ PRINT INDIVIDUAL CUSTOMER BILL
// ============================================
function printOrderBill(orderId) {
    const ord = allOrders.find(o => o.id === orderId);
    if (!ord) return;

    let templateId = (myAgency && myAgency.defaultTemplate) || 'template6';
    let billHTML = '';
    try {
        if (typeof window.buildBillHTML === 'function') {
            billHTML = window.buildBillHTML(ord, templateId);
        } else {
            billHTML = buildFallbackInvoiceHTML(ord);
        }
    } catch(e) {
        billHTML = buildFallbackInvoiceHTML(ord);
    }

    const win = window.open('', '_blank', 'width=800,height=700');
    win.document.write(billHTML);
    win.document.close();
    setTimeout(() => win.print(), 800);
}

function buildFallbackInvoiceHTML(bill) {
    return `
        <html><head><title>Bill ${bill.billNo}</title></head>
        <body style="font-family:sans-serif; padding:20px;">
            <h2>${(myAgency && myAgency.name) || 'Agency'}</h2>
            <p><b>Bill No:</b> ${bill.billNo} | <b>Date:</b> ${bill.date}</p>
            <p><b>Customer:</b> ${bill.customerName}</p>
            <p><b>Booker:</b> ${bill.bookerName || 'Staff'}</p>
            <hr>
            <table style="width:100%; border-collapse:collapse;" border="1" cellpadding="5">
                <tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr>
                ${(bill.items || []).map(it => `<tr><td>${it.name}</td><td>${it.qty}</td><td>${it.rate}</td><td>${it.qty * it.rate}</td></tr>`).join('')}
            </table>
            <h3>Total: Rs ${bill.billAmount || bill.grandTotal}</h3>
        </body></html>
    `;
}

// ============================================
// ⚡ BULK ORDERS SELECTION & APPROVE BAR
// ============================================
function updateBulkOrdersBar() {
    const bar = document.getElementById('bulkOrdersBar');
    const checked = document.querySelectorAll('.order-check:checked');
    const countEl = document.getElementById('selectedOrdersCount');

    if (!bar) return;

    if (checked.length > 0) {
        bar.style.display = 'flex';
        if (countEl) countEl.innerText = checked.length;

        // Populate suppliers dropdown if empty
        const sel = document.getElementById('bulkSupplierSelect');
        if (sel && sel.options.length <= 1) {
            const suppliers = allStaff.filter(s => s.role === 'supplier' || s.role === 'delivery');
            suppliers.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = `🚚 ${s.name || s.email} (${s.route || 'General'})`;
                sel.appendChild(opt);
            });
        }
    } else {
        bar.style.display = 'none';
    }
}

async function handleBulkApproveAndAssign() {
    if (!canUserApproveOrders()) {
        Swal.fire({
            icon: 'warning',
            title: '🔒 Admin Not Allowed (ایڈمن کی منظوری درکار)',
            text: 'آپ کو آرڈرز منظور کرنے کی اجازت نہیں ہے۔ صرف ایڈمن منظور کر سکتا ہے۔',
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
    const supplierObj = allStaff.find(s => s.id === supplierId);

    const confirm = await Swal.fire({
        title: '✅ منتخب آرڈرز منظور کریں؟',
        html: `آپ <b>${checked.length} آرڈرز</b> کو منظور کرنے لگے ہیں۔<br>
               ${supplierObj ? `ڈلیوری سپلائر: <b>🚚 ${supplierObj.name}</b>` : '<span style="color:#d97706;">(کوئی سپلائر منتخب نہیں کیا گیا)</span>'}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ہاں، منظور کریں',
        cancelButtonText: 'منسوخ',
        confirmButtonColor: '#10b981'
    });

    if (!confirm.isConfirmed) return;

    try {
        Swal.fire({ title: 'منظوری جاری ہے...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

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

            // Deduct stock if was pending
            if (isPending) {
                (ord.items || []).forEach(it => {
                    if (!it.stockId) return;
                    const s = allStock.find(x => x.id === it.stockId);
                    const currentQty = s ? (s.qty || 0) : 0;
                    const newQty = currentQty - (it.qty || 0);
                    batch.update(db.collection('stock').doc(it.stockId), {
                        qty: newQty,
                        updatedAt: new Date().toISOString()
                    });
                    if (s) s.qty = newQty;
                });

                if (ord.customerId) {
                    const custRef = db.collection('customers').doc(ord.customerId);
                    const cDoc = await custRef.get();
                    if (cDoc.exists) {
                        const newBal = (cDoc.data().balance || 0) + (ord.billAmount || 0) - (ord.received || 0);
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

        renderOrdersTable();
        updateKPIRibbon();

        Swal.fire({
            icon: 'success',
            title: '🎉 تمام منتخب آرڈرز منظور ہو گئے!',
            text: `${checked.length} آرڈرز کامیابی سے منظور اور اپڈیٹ ہو چکے ہیں۔`,
            confirmButtonText: 'ٹھیک ہے',
            confirmButtonColor: '#10b981'
        });

    } catch(e) {
        console.error('Bulk approve error:', e);
        Swal.fire('Error', e.message, 'error');
    }
}

async function markOrderDelivered(orderId) {
    try {
        await db.collection('bills').doc(orderId).update({
            deliveryStatus: 'delivered',
            deliveredAt: new Date().toISOString()
        });
        const ord = allOrders.find(o => o.id === orderId);
        if (ord) ord.deliveryStatus = 'delivered';
        renderOrdersTable();
        updateKPIRibbon();
        Swal.fire({ toast: true, position: 'top-end', timer: 1500, icon: 'success', title: 'Order marked as Delivered!' });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

// ============================================
// 🔄 STOCK RETURN INWARD (EXACT USER REQUIREMENT)
// 0 Profit / 0 Loss Accounting Rule
// ============================================
async function loadReturns() {
    try {
        const snap = await db.collection('stock_returns')
            .where('agencyId', '==', myAgencyId)
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();

        allReturns = [];
        snap.forEach(d => {
            const data = d.data();
            data.id = d.id;
            allReturns.push(data);
        });

        renderReturnsTable();
    } catch (e) {
        // Fallback without composite orderBy
        try {
            const snap = await db.collection('stock_returns').where('agencyId', '==', myAgencyId).get();
            allReturns = [];
            snap.forEach(d => {
                const data = d.data();
                data.id = d.id;
                allReturns.push(data);
            });
            allReturns.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            renderReturnsTable();
        } catch (err2) {
            console.error('Load returns error:', err2);
        }
    }
}

function renderReturnsTable() {
    const tbody = document.getElementById('returnsTableBody');
    if (!tbody) return;

    const query = (document.getElementById('returnSearchInput')?.value || '').toLowerCase().trim();

    const filtered = allReturns.filter(ret => {
        if (!query) return true;
        const vNum = (ret.voucherNo || '').toLowerCase();
        const sup = (ret.supplierName || '').toLowerCase();
        const bk = (ret.bookerName || '').toLowerCase();
        const sh = (ret.shopName || '').toLowerCase();
        return vNum.includes(query) || sup.includes(query) || bk.includes(query) || sh.includes(query);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">
            کوئی واپسی مال ریکارڈ نہیں ملا۔
        </td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(ret => {
        const itemsSummary = (ret.items || []).map(it => `${it.name} (${it.qty} ${it.unit || ''})`).join(', ');

        return `
            <tr>
                <td>
                    <b style="color:#7c3aed;">${ret.voucherNo || ret.id.slice(0,8)}</b>
                </td>
                <td>
                    <b>${ret.date || ''}</b><br>
                    <small style="color:#64748b;">${ret.time || ''}</small>
                </td>
                <td>
                    <b style="color:#0284c7;"><i class="fas fa-truck"></i> ${ret.supplierName || 'Delivery Salesman'}</b>
                </td>
                <td>
                    <b style="color:#0f172a;"><i class="fas fa-user-edit"></i> ${ret.bookerName || 'Order Booker'}</b>
                </td>
                <td>
                    <b>${ret.shopName || 'Route Customer'}</b><br>
                    ${ret.billNo ? `<small style="color:#64748b;">Ref Bill: ${ret.billNo}</small>` : ''}
                </td>
                <td style="max-width:240px; font-size:12px; color:#334155;">
                    ${itemsSummary}
                </td>
                <td>
                    <span style="background:#fef3c7; color:#92400e; padding:3px 8px; border-radius:10px; font-size:11px; font-weight:700;">
                        ${ret.reasonDetails || ret.reasonCategory || 'Unsold Return'}
                    </span>
                </td>
                <td style="text-align:right;">
                    <button class="btn-vyapar btn-vyapar-purple" onclick="viewReturnVoucher('${ret.id}')" style="padding:4px 10px; font-size:11px;">
                        <i class="fas fa-receipt"></i> Voucher
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Dynamic Return Items Rows in Modal
function addReturnItemRow(initialStockId = '', initialQty = 1) {
    const container = document.getElementById('returnItemsContainer');
    if (!container) return;

    const rowId = 'retRow_' + Date.now() + '_' + Math.floor(Math.random()*100);
    const row = document.createElement('div');
    row.className = 'return-item-row';
    row.id = rowId;

    let options = '<option value="">-- پروڈکٹ منتخب کریں --</option>';
    allStock.forEach(s => {
        const isSel = s.id === initialStockId ? 'selected' : '';
        options += `<option value="${s.id}" data-unit="${s.unit || 'Unit'}" data-qty="${s.qty || 0}" ${isSel}>${s.name} (Current: ${s.qty || 0} ${s.unit || ''})</option>`;
    });

    row.innerHTML = `
        <div>
            <select class="ret-stock-sel" style="width:100%; padding:7px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; outline:none; background:#fff;">
                ${options}
            </select>
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
            <input type="number" class="ret-qty-inp" min="1" step="any" value="${initialQty}" style="width:70px; padding:7px 6px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; text-align:center; font-weight:bold;">
            <span class="ret-unit-lbl" style="font-size:11px; color:#64748b; font-weight:bold;">Unit</span>
        </div>
        <div>
            <button type="button" class="btn" onclick="document.getElementById('${rowId}').remove()" style="background:#fee2e2; color:#b91c1c; border:none; padding:6px 8px; border-radius:6px; cursor:pointer;" title="Remove Item">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;

    container.appendChild(row);

    // Update unit label on select change
    const sel = row.querySelector('.ret-stock-sel');
    const unitLbl = row.querySelector('.ret-unit-lbl');
    sel.addEventListener('change', function() {
        const opt = this.options[this.selectedIndex];
        if (opt && opt.dataset.unit) {
            unitLbl.innerText = opt.dataset.unit;
        }
    });

    // trigger once if preset
    if (initialStockId) {
        sel.dispatchEvent(new Event('change'));
    }
}

// Open Return Modal directly for a specific Order
window.openReturnForOrder = function(orderId) {
    const ord = allOrders.find(o => o.id === orderId);
    if (!ord) return;

    openReturnModal();

    if (ord.supplierId) {
        document.getElementById('retSupplierSelect').value = ord.supplierId;
    }
    if (ord.bookerId) {
        document.getElementById('retBookerSelect').value = ord.bookerId;
    }
    document.getElementById('retShopName').value = ord.customerName || '';
    document.getElementById('retBillNo').value = ord.billNo || '';

    // Pre-populate items from order
    const container = document.getElementById('returnItemsContainer');
    container.innerHTML = '';
    if (ord.items && ord.items.length > 0) {
        ord.items.forEach(it => {
            addReturnItemRow(it.stockId || '', it.qty || 1);
        });
    } else {
        addReturnItemRow();
    }
};

// ============================================
// 💾 SUBMIT STOCK RETURN (THE EXACT CRITICAL TRANSACTION)
// 0 Profit / 0 Loss: Restores physical inventory count ONLY
// ============================================
document.getElementById('stockReturnForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const supplierId = document.getElementById('retSupplierSelect').value;
    const bookerId = document.getElementById('retBookerSelect').value;
    const shopName = (document.getElementById('retShopName').value || '').trim();
    const billNo = (document.getElementById('retBillNo').value || '').trim();

    if (!supplierId || !bookerId) {
        Swal.fire('⚠️ توجہ', 'برائے مہربانی سپلائر اور آرڈر بکر دونوں منتخب کریں۔', 'warning');
        return;
    }

    const supplierObj = allStaff.find(s => s.id === supplierId);
    const bookerObj = allStaff.find(s => s.id === bookerId);

    // Reason resolution (5 defaults + other)
    const reasonSel = document.getElementById('retReasonSelect').value;
    let finalReason = reasonSel;
    if (reasonSel === 'other') {
        finalReason = (document.getElementById('retCustomReasonText').value || '').trim();
        if (!finalReason) {
            Swal.fire('⚠️ توجہ', 'برائے مہربانی دیگر خاص وجہ باکس میں تفصیل سے درج کریں۔', 'warning');
            return;
        }
    }

    // Collect Items
    const rows = document.querySelectorAll('#returnItemsContainer .return-item-row');
    if (rows.length === 0) {
        Swal.fire('⚠️ توجہ', 'کم از کم ایک پروڈکٹ شامل کرنا لازمی ہے۔', 'warning');
        return;
    }

    const returnItems = [];
    let totalQty = 0;

    for (const r of rows) {
        const stockId = r.querySelector('.ret-stock-sel').value;
        const qty = parseFloat(r.querySelector('.ret-qty-inp').value) || 0;
        if (!stockId || qty <= 0) continue;

        const stockObj = allStock.find(s => s.id === stockId);
        returnItems.push({
            stockId: stockId,
            name: stockObj ? stockObj.name : 'Unknown Product',
            qty: qty,
            unit: stockObj ? (stockObj.unit || 'Unit') : 'Unit'
        });
        totalQty += qty;
    }

    if (returnItems.length === 0) {
        Swal.fire('⚠️ توجہ', 'براہ کرم واپسی مال کی صحیح تعداد درج کریں۔', 'warning');
        return;
    }

    const submitBtn = document.getElementById('btnSubmitReturn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Return Voucher...';

    try {
        const voucherNo = 'RET-' + (allReturns.length + 1001);
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-PK', { day:'numeric', month:'short', year:'numeric' });
        const timeStr = now.toLocaleTimeString('en-PK', { hour:'2-digit', minute:'2-digit' });

        const returnDocData = {
            agencyId: myAgencyId,
            voucherNo: voucherNo,
            supplierId: supplierId,
            supplierName: supplierObj ? (supplierObj.name || supplierObj.email) : 'Delivery Salesman',
            supplierMobile: supplierObj ? (supplierObj.mobile || '') : '',
            bookerId: bookerId,
            bookerName: bookerObj ? (bookerObj.name || bookerObj.email) : 'Order Booker',
            bookerMobile: bookerObj ? (bookerObj.mobile || '') : '',
            shopName: shopName || 'Route Customer',
            billNo: billNo || '',
            items: returnItems,
            totalItemsCount: returnItems.length,
            totalUnitsCount: totalQty,
            reasonCategory: reasonSel,
            reasonDetails: finalReason,
            // ⭐️ CRITICAL ACCOUNTING FLAG:
            isProfitLossNeutral: true,
            profitImpact: 0,
            salesImpact: 0,
            purchaseImpact: 0,
            date: dateStr,
            time: timeStr,
            createdAt: now.toISOString(),
            createdBy: myUid
        };

        const batch = db.batch();

        // 1. Save Return Voucher Doc
        const retRef = db.collection('stock_returns').doc();
        batch.set(retRef, returnDocData);

        // 2. Physical Stock Restoration (Increment warehouse inventory count ONLY)
        returnItems.forEach(it => {
            const stockRef = db.collection('stock').doc(it.stockId);
            batch.update(stockRef, {
                qty: firebase.firestore.FieldValue.increment(it.qty),
                lastRestockedAt: now.toISOString()
            });

            // update local in-memory stock
            const s = allStock.find(x => x.id === it.stockId);
            if (s) s.qty = (s.qty || 0) + it.qty;
        });

        // 3. Movement Log (van_return)
        const moveRef = db.collection('movements').doc();
        batch.set(moveRef, {
            agencyId: myAgencyId,
            type: 'in',
            movementCategory: 'van_return',
            reason: 'Unsold Van Return - ' + finalReason,
            voucherNo: voucherNo,
            supplierName: returnDocData.supplierName,
            bookerName: returnDocData.bookerName,
            items: returnItems,
            profitImpact: 0,
            salesImpact: 0,
            createdAt: now.toISOString(),
            createdBy: myUid
        });

        // 4. If associated bill was provided, update delivery status & reconcile Customer Khata
        if (billNo) {
            const matchBill = allOrders.find(o => o.billNo === billNo);
            if (matchBill) {
                const billRef = db.collection('bills').doc(matchBill.id);
                batch.update(billRef, {
                    deliveryStatus: 'returned',
                    returnVoucherNo: voucherNo
                });
                matchBill.deliveryStatus = 'returned';

                // 🔄 CUSTOMER KHATA REVERSAL (اگر دکان بند ہونے یا مال واپس آنے پر آرڈر کینسل ہوا تو گاہک کا کھاتہ درست کریں)
                if (matchBill.customerId) {
                    try {
                        const custRef = db.collection('customers').doc(matchBill.customerId);
                        const cDoc = await custRef.get();
                        if (cDoc.exists) {
                            const cData = cDoc.data() || {};
                            const curBal = Number(cData.balance || 0);
                            const billedNet = Number(matchBill.billAmount || matchBill.grandTotal || 0) - Number(matchBill.received || 0);
                            const updatedBal = Math.max(0, curBal - billedNet);
                            batch.update(custRef, {
                                balance: updatedBal,
                                lastReturnAt: now.toISOString(),
                                lastReturnVoucher: voucherNo
                            });
                        }
                    } catch (eCustBal) {
                        console.warn('Customer balance reversal notice:', eCustBal);
                    }
                }
            }
        }

        await batch.commit();

        returnDocData.id = retRef.id;
        allReturns.unshift(returnDocData);
        lastCreatedVoucher = returnDocData;

        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Save Return &amp; Generate Voucher';

        closeReturnModal();
        renderReturnsTable();
        renderOrdersTable();
        updateKPIRibbon();

        // Display Success Screen & Voucher
        displayReturnVoucher(returnDocData);

    } catch (err) {
        console.error('Save stock return failed:', err);
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Save Return &amp; Generate Voucher';
        Swal.fire('Error', 'واپسی مال محفوظ نہ ہو سکا: ' + err.message, 'error');
    }
});

// ============================================
// 🖨️ RETURN VOUCHER PREVIEW & WHATSAPP GENERATOR
// ============================================
window.viewReturnVoucher = function(returnId) {
    const ret = allReturns.find(r => r.id === returnId);
    if (!ret) return;
    lastCreatedVoucher = ret;
    displayReturnVoucher(ret);
};

function displayReturnVoucher(voucher) {
    const area = document.getElementById('voucherPrintArea');
    if (!area) return;

    let itemsTableRows = '';
    (voucher.items || []).forEach((it, idx) => {
        itemsTableRows += `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:6px 8px; font-size:12px;">${idx + 1}. <b>${it.name}</b></td>
                <td style="padding:6px 8px; font-size:12px; text-align:center; font-weight:bold; color:#7c3aed;">
                    ${it.qty} ${it.unit || ''}
                </td>
            </tr>
        `;
    });

    area.innerHTML = `
        <div class="voucher-paper">
            <div class="voucher-header">
                <div style="font-size:24px;">🚚📦</div>
                <div class="voucher-title">UNSOLD VAN STOCK RETURN INWARD</div>
                <div style="font-size:12px; color:#475569; font-weight:bold;">${(myAgency && myAgency.name) || 'Agency Depot'}</div>
                <div class="voucher-badge">0 PROFIT / 0 LOSS PHYSICAL RESTORATION</div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12px; margin-bottom:12px; background:#f8fafc; padding:10px; border-radius:8px;">
                <div><b>Voucher #:</b> <span style="color:#7c3aed; font-weight:800;">${voucher.voucherNo}</span></div>
                <div><b>Date:</b> ${voucher.date} ${voucher.time}</div>
                <div><b>🚚 Delivery Salesman:</b> ${voucher.supplierName}</div>
                <div><b>📕 Original Booker:</b> ${voucher.bookerName}</div>
                <div><b>🏪 Shop / Route:</b> ${voucher.shopName}</div>
                <div><b>🧾 Ref Bill #:</b> ${voucher.billNo || 'Unassigned / Excess'}</div>
            </div>

            <div style="margin-bottom:12px;">
                <div style="font-size:11px; font-weight:800; color:#64748b; margin-bottom:4px; text-transform:uppercase;">Returned Items to Warehouse:</div>
                <table style="width:100%; border-collapse:collapse; background:#fff; border:1px solid #e2e8f0; border-radius:6px;">
                    <thead>
                        <tr style="background:#f1f5f9; text-align:left;">
                            <th style="padding:6px 8px; font-size:11px; color:#475569;">Item Name</th>
                            <th style="padding:6px 8px; font-size:11px; text-align:center; color:#475569;">Returned Qty</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsTableRows}
                    </tbody>
                </table>
            </div>

            <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:8px; padding:10px; font-size:12px; color:#92400e; margin-bottom:14px;">
                <b>📝 و جہ واپسی (Verified Reason):</b><br>
                ${voucher.reasonDetails || voucher.reasonCategory}
            </div>

            <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748b; border-top:1px dashed #cbd5e1; padding-top:10px; text-align:center;">
                <div>______________________<br>سپلائر / ڈلیوری دستخط</div>
                <div>______________________<br>گودام انچارج تصدیق</div>
            </div>
        </div>
    `;

    document.getElementById('modalVoucherPreview').classList.add('show');
}

// WhatsApp Share Handler
document.getElementById('btnWhatsAppShareVoucher').addEventListener('click', function() {
    if (!lastCreatedVoucher) return;
    const v = lastCreatedVoucher;

    let text = `🔄 *EASY BILL ERP — مال واپسی رسید (RETURN INWARD)*\n`;
    text += `🏢 *${(myAgency && myAgency.name) || 'Agency Depot'}*\n`;
    text += `📄 Voucher #: *${v.voucherNo}*\n`;
    text += `📅 Date: ${v.date} (${v.time})\n`;
    text += `------------------------------------\n`;
    text += `🚚 Delivery Supplier: *${v.supplierName}*\n`;
    text += `📕 Order Booker: *${v.bookerName}*\n`;
    text += `🏪 Shop: *${v.shopName}*\n`;
    if (v.billNo) text += `🧾 Ref Bill: *${v.billNo}*\n`;
    text += `------------------------------------\n`;
    text += `📦 *واپس آیا ہوا فزیکل مال:*\n`;
    (v.items || []).forEach((it, idx) => {
        text += `${idx + 1}. *${it.name}* — ${it.qty} ${it.unit || ''}\n`;
    });
    text += `------------------------------------\n`;
    text += `📝 *وجہ واپسی:* ${v.reasonDetails || v.reasonCategory}\n`;
    text += `------------------------------------\n`;
    text += `✅ یہ مال بغیر نفع نقصان کے گودام کے اسٹاک میں واپس بحفاظت جمع کر لیا گیا ہے۔`;

    const encoded = encodeURIComponent(text);
    const targetMobile = v.supplierMobile || v.bookerMobile;
    const cleanPhone = targetMobile ? targetMobile.replace(/\D/g, '') : '';

    if (cleanPhone) {
        window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
    } else {
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
});

// ============================================
// 🚚 MODAL: VAN DISPATCH GATE PASS
// ============================================
function setupModals() {
    document.getElementById('btnOpenReturnModal')?.addEventListener('click', openReturnModal);
    document.getElementById('btnQuickReturnAction')?.addEventListener('click', openReturnModal);
    document.getElementById('btnAddReturnItemRow')?.addEventListener('click', () => addReturnItemRow());

    document.getElementById('btnOpenDispatchModal')?.addEventListener('click', openDispatchModal);
    document.getElementById('btnOpenAddStaffModal')?.addEventListener('click', openAddStaffModal);

    // 💥 Damaged & Expired Claims modal triggers
    document.getElementById('btnOpenClaimModal')?.addEventListener('click', () => openDamageClaimModal());
    document.getElementById('btnManageCategories')?.addEventListener('click', openManageCategoriesModal);
    setupProductAutocomplete();

    // ⚡ Bulk Approve & Assign to Supplier
    const bulkApproveBtn = document.getElementById('btnBulkApprove');
    if (bulkApproveBtn) {
        bulkApproveBtn.addEventListener('click', handleBulkApproveAndAssign);
    }

    // Select All Orders checkbox
    const selAll = document.getElementById('selectAllOrders');
    if (selAll) {
        selAll.addEventListener('change', function() {
            document.querySelectorAll('.order-check').forEach(ck => {
                if (!ck.disabled) ck.checked = this.checked;
            });
            updateBulkOrdersBar();
        });
    }
}

function openReturnModal() {
    document.getElementById('stockReturnForm').reset();
    document.getElementById('returnItemsContainer').innerHTML = '';
    document.getElementById('customReasonContainer').style.display = 'none';
    addReturnItemRow();

    // Auto-select logged-in supplier if user is supplier
    const supSelect = document.getElementById('retSupplierSelect');
    if (supSelect && myUser && (myUser.role === 'supplier' || myUser.role === 'delivery') && myUid) {
        supSelect.value = myUid;
    }

    document.getElementById('modalStockReturn').classList.add('show');
}
window.closeReturnModal = () => document.getElementById('modalStockReturn').classList.remove('show');
window.closeVoucherPreview = () => document.getElementById('modalVoucherPreview').classList.remove('show');

function openDispatchModal() {
    const list = document.getElementById('dispatchOrdersList');
    list.innerHTML = '';

    const pendingOrders = allOrders.filter(o => (o.deliveryStatus || 'pending') === 'pending');
    if (pendingOrders.length === 0) {
        list.innerHTML = '<div style="padding:15px; color:#94a3b8; text-align:center;">کوئی پینڈنگ آرڈر موجود نہیں ہے۔</div>';
    } else {
        pendingOrders.forEach(ord => {
            const count = (ord.items && ord.items.length) || ord.itemCount || 0;
            list.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #e2e8f0; font-size:12px;">
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                        <input type="checkbox" class="dispatch-chk" value="${ord.id}" checked>
                        <b>${ord.billNo || ord.id.slice(0,8)}</b> — ${ord.customerName} (${count} Items)
                    </label>
                    <span style="color:#10b981; font-weight:bold;">Rs ${Math.round(ord.billAmount || ord.grandTotal || 0).toLocaleString()}</span>
                </div>
            `;
        });
    }

    updateDispatchSelectedCount();
    document.getElementById('modalDispatch').classList.add('show');
}
window.closeDispatchModal = () => document.getElementById('modalDispatch').classList.remove('show');

function updateDispatchSelectedCount() {
    const count = document.querySelectorAll('.dispatch-chk:checked').length;
    const el = document.getElementById('dispatchSelectedCount');
    if (el) el.innerText = count;
}

// Confirm Van Dispatch
document.getElementById('btnConfirmDispatch').addEventListener('click', async function() {
    const supplierId = document.getElementById('dispatchSupplierSelect').value;
    if (!supplierId) {
        Swal.fire('⚠️ توجہ', 'براہ کرم ڈلیوری سپلائر منتخب کریں۔', 'warning');
        return;
    }

    const supplierObj = allStaff.find(s => s.id === supplierId);
    const checked = Array.from(document.querySelectorAll('.dispatch-chk:checked')).map(c => c.value);
    if (checked.length === 0) {
        Swal.fire('⚠️ توجہ', 'کم از کم ایک آرڈر منتخب کریں۔', 'warning');
        return;
    }

    const btn = this;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Dispatched...';

    try {
        const batch = db.batch();
        const now = new Date().toISOString();

        checked.forEach(orderId => {
            const ref = db.collection('bills').doc(orderId);
            batch.update(ref, {
                deliveryStatus: 'dispatched',
                supplierId: supplierId,
                supplierName: supplierObj ? (supplierObj.name || supplierObj.email) : 'Delivery Salesman',
                dispatchedAt: now
            });

            const ord = allOrders.find(o => o.id === orderId);
            if (ord) {
                ord.deliveryStatus = 'dispatched';
                ord.supplierId = supplierId;
                ord.supplierName = supplierObj ? (supplierObj.name || supplierObj.email) : 'Delivery Salesman';
            }
        });

        await batch.commit();

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-truck"></i> Confirm Dispatch &amp; Generate Challan';

        closeDispatchModal();
        renderOrdersTable();
        updateKPIRibbon();

        // 🚚 Auto-open Consolidated Loading Sheet & Gate Pass
        generateAndShowLoadingSheet(supplierId, checked);

    } catch (e) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-truck"></i> Confirm Dispatch &amp; Generate Challan';
        Swal.fire('Error', e.message, 'error');
    }
});

// ============================================
// 🚚 CONSOLIDATED LOADING SHEET & GATE PASS ENGINE (Phase 3)
// ============================================
let currentLoadingSheetData = null;

window.openLoadingSheetForOrder = function(orderId) {
    const ord = allOrders.find(o => o.id === orderId);
    if (!ord) return;
    const supId = ord.supplierId;
    const supOrders = allOrders.filter(o => o.supplierId === supId && o.deliveryStatus === 'dispatched');
    const orderList = supOrders.length > 0 ? supOrders : [ord];
    generateAndShowLoadingSheet(supId, orderList.map(o => o.id));
};

function generateAndShowLoadingSheet(supplierId, orderIds) {
    const supplierObj = allStaff.find(s => s.id === supplierId);
    const orders = allOrders.filter(o => orderIds.includes(o.id));

    if (orders.length === 0) {
        Swal.fire('Info', 'لوڈنگ شیٹ کے لیے کوئی آرڈر نہیں ملا۔', 'info');
        return;
    }

    const supName = supplierObj ? (supplierObj.name || supplierObj.email) : (orders[0]?.supplierName || 'Delivery Supplier');
    const supMobile = supplierObj ? (supplierObj.mobile || '') : '';
    const supRoute = supplierObj ? (supplierObj.route || 'General Depot Route') : (orders[0]?.customerRoute || 'General Area');

    // Consolidated Stock items sum
    const stockMap = {};
    let totalPieces = 0;
    let grandBillTotal = 0;

    orders.forEach(ord => {
        grandBillTotal += Number(ord.billAmount || ord.grandTotal || 0);
        (ord.items || []).forEach(it => {
            const name = (it.name || 'Item').trim();
            const unit = it.unit || 'Pcs';
            const qty = Number(it.qty) || 0;
            totalPieces += qty;

            if (!stockMap[name]) {
                stockMap[name] = { name, unit, totalQty: 0, orderCount: 0 };
            }
            stockMap[name].totalQty += qty;
            stockMap[name].orderCount++;
        });
    });

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
    const sheetNo = 'LS-' + Date.now().toString().slice(-5);

    currentLoadingSheetData = {
        sheetNo, dateStr, timeStr, supName, supMobile, supRoute, orders, stockMap, totalPieces, grandBillTotal
    };

    const container = document.getElementById('loadingSheetPrintArea');
    if (!container) return;

    let stockRows = Object.values(stockMap).map((st, idx) => `
        <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:6px 8px; text-align:center;">${idx + 1}</td>
            <td style="padding:6px 8px;"><b>${st.name}</b></td>
            <td style="padding:6px 8px; text-align:center;">${st.unit}</td>
            <td style="padding:6px 8px; text-align:center; font-size:15px; font-weight:800; color:#0284c7;">${st.totalQty}</td>
            <td style="padding:6px 8px; text-align:center; color:#64748b;">${st.orderCount} دکانیں</td>
            <td style="padding:6px 8px; text-align:center;"><input type="checkbox" checked style="width:16px; height:16px;"></td>
        </tr>
    `).join('');

    let orderRows = orders.map((ord, idx) => {
        const itemsSummary = (ord.items || []).map(i => `${i.name} (${i.qty})`).join(', ');
        const amt = Math.round(ord.billAmount || ord.grandTotal || 0).toLocaleString();
        return `
            <tr style="border-bottom:1px solid #e2e8f0; font-size:12px;">
                <td style="padding:6px 8px; text-align:center;">${idx + 1}</td>
                <td style="padding:6px 8px;"><b>${ord.billNo || ord.id.slice(0,8)}</b></td>
                <td style="padding:6px 8px;"><b>${ord.customerName}</b><br><small style="color:#64748b;">${ord.customerMobile || ord.customerRoute || ''}</small></td>
                <td style="padding:6px 8px;">${itemsSummary}</td>
                <td style="padding:6px 8px; text-align:right; font-weight:800; color:#10b981;">Rs ${amt}</td>
                <td style="padding:6px 8px; text-align:center;"><span style="border-bottom:1px dashed #94a3b8; display:inline-block; width:60px;">&nbsp;</span></td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div style="border:2px solid #0284c7; border-radius:12px; padding:18px; background:#fff;">
            <!-- HEADER -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0284c7; padding-bottom:12px; margin-bottom:14px;">
                <div>
                    <h2 style="margin:0 0 4px; font-size:20px; color:#0f172a;">${(myAgency && myAgency.name) || 'Our Distribution Agency'}</h2>
                    <div style="font-size:14px; font-weight:800; color:#0284c7;">🚚 گاڑی لوڈنگ شیٹ و گودام گیٹ پاس (Van Loading Sheet &amp; Dispatch Gate Pass)</div>
                    <div style="font-size:12px; color:#64748b;">${(myAgency && myAgency.city) || 'Main Depot'}</div>
                </div>
                <div style="text-align:right; font-size:12px;">
                    <div><b>Sheet #:</b> <span style="font-size:15px; font-weight:800; color:#0284c7;">${sheetNo}</span></div>
                    <div><b>Date:</b> ${dateStr} ${timeStr}</div>
                    <div style="margin-top:4px;"><span style="background:#e0f2fe; color:#0284c7; padding:2px 8px; border-radius:8px; font-weight:bold;">Active Dispatch</span></div>
                </div>
            </div>

            <!-- SUPPLIER INFO BANNER -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; margin-bottom:16px; display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px; font-size:12px;">
                <div><b>ڈلیوری سپلائر:</b> <span style="color:#0f172a; font-weight:bold;">🚚 ${supName}</span></div>
                <div><b>موبائل:</b> <span>${supMobile || '—'}</span></div>
                <div><b>روٹ / علاقہ:</b> <span style="font-weight:bold; color:#0284c7;">📍 ${supRoute}</span></div>
                <div><b>کل آرڈرز:</b> <span style="font-weight:800; color:#10b981;">${orders.length} دکانیں</span></div>
                <div><b>کل بل رقم:</b> <span style="font-weight:800; color:#10b981;">Rs ${grandBillTotal.toLocaleString()}</span></div>
            </div>

            <!-- SECTION 1: CONSOLIDATED WAREHOUSE STOCK TO LOAD -->
            <div style="margin-bottom:18px;">
                <div style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                    <span>📦 1. گودام سے گاڑی میں لوڈ ہونے والے کل آئٹمز (Consolidated Warehouse Items)</span>
                    <span style="font-size:12px; color:#0284c7; font-weight:bold;">کل آئٹمز کی تعداد: ${totalPieces}</span>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #cbd5e1;">
                    <thead>
                        <tr style="background:#f1f5f9; text-align:left; border-bottom:2px solid #cbd5e1;">
                            <th style="padding:6px 8px; width:30px; text-align:center;">#</th>
                            <th style="padding:6px 8px;">آئٹم کا نام (Product Name)</th>
                            <th style="padding:6px 8px; width:70px; text-align:center;">یونٹ</th>
                            <th style="padding:6px 8px; width:90px; text-align:center;">کل تعداد برائے لوڈنگ</th>
                            <th style="padding:6px 8px; width:80px; text-align:center;">دکانوں کی تعداد</th>
                            <th style="padding:6px 8px; width:60px; text-align:center;">تصدیق</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stockRows}
                    </tbody>
                </table>
            </div>

            <!-- SECTION 2: SHOP DROP LIST & CASH TALLY -->
            <div style="margin-bottom:18px;">
                <div style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:6px;">
                    🏪 2. دکان وار ڈلیوری، مال اور کیش وصولی شیٹ (Shop-by-Shop Delivery Drop List)
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #cbd5e1;">
                    <thead>
                        <tr style="background:#f1f5f9; text-align:left; border-bottom:2px solid #cbd5e1;">
                            <th style="padding:6px 8px; width:30px; text-align:center;">#</th>
                            <th style="padding:6px 8px; width:70px;">بل نمبر</th>
                            <th style="padding:6px 8px; width:140px;">دکان / کسٹمر</th>
                            <th style="padding:6px 8px;">مال کی تفصیل</th>
                            <th style="padding:6px 8px; width:80px; text-align:right;">بل رقم</th>
                            <th style="padding:6px 8px; width:80px; text-align:center;">وصولی دستخط</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orderRows}
                    </tbody>
                </table>
            </div>

            <!-- SIGNATURES BLOCK -->
            <div style="margin-top:20px; padding-top:14px; border-top:1px dashed #cbd5e1; display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#475569;">
                <div>
                    <div>_____________________________</div>
                    <div style="font-weight:bold; margin-top:4px;">گودام انچارج / اسٹور کیپر دستخط</div>
                    <small style="color:#94a3b8;">مال گاڑی میں گن کر لوڈ کروایا گیا</small>
                </div>
                <div style="text-align:right;">
                    <div>_____________________________</div>
                    <div style="font-weight:bold; margin-top:4px;">ڈلیوری سپلائر دستخط</div>
                    <small style="color:#94a3b8;">مال بالکل ٹھیک اور پورا وصول پایا</small>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalLoadingSheet').style.display = 'flex';
}

window.closeLoadingSheetModal = () => {
    const modal = document.getElementById('modalLoadingSheet');
    if (modal) modal.style.display = 'none';
};

window.printLoadingSheetDoc = () => {
    const content = document.getElementById('loadingSheetPrintArea');
    if (!content) return;
    const win = window.open('', '_blank', 'width=850,height=750');
    win.document.write(`
        <html><head><title>Loading Sheet</title>
        <style>body { font-family:sans-serif; margin:15px; color:#0f172a; }</style>
        </head><body>
            ${content.innerHTML}
        </body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 600);
};

// WhatsApp Loading Sheet Share
document.getElementById('btnShareLoadingSheetWA')?.addEventListener('click', function() {
    if (!currentLoadingSheetData) return;
    const d = currentLoadingSheetData;
    let text = `🚚 *گاڑی لوڈنگ شیٹ و گودام گیٹ پاس*\n`;
    text += `🏢 *${(myAgency && myAgency.name) || 'Our Agency'}*\n`;
    text += `📄 شیٹ نمبر: *${d.sheetNo}* (${d.dateStr})\n`;
    text += `🚚 سپلائر: *${d.supName}* | روٹ: *${d.supRoute}*\n\n`;
    text += `📦 *گودام سے لوڈ ہونے والے کل آئٹمز:*\n`;
    Object.values(d.stockMap).forEach((st, idx) => {
        text += `${idx + 1}. *${st.name}*: ${st.totalQty} ${st.unit}\n`;
    });
    text += `\n🏪 *دکانیں:* ${d.orders.length} | 💰 *کل رقم:* Rs ${d.grandBillTotal.toLocaleString()}\n`;
    text += `برائے مہربانی مال گاڑی میں گن کر لوڈ کریں اور دکانوں پر بل کے مطابق سپلائی کریں۔`;

    const cleanPhone = (d.supMobile || '').replace(/\D/g, '');
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
});

// ============================================
// ➕ QUICK ADD STAFF (FIXED & ROBUST)
// ============================================
function openAddStaffModal() {
    document.getElementById('quickStaffForm').reset();
    document.getElementById('modalAddStaff').classList.add('show');
}
window.closeAddStaffModal = () => document.getElementById('modalAddStaff').classList.remove('show');

document.getElementById('quickStaffForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const role = document.getElementById('qStaffRole').value;
    const name = document.getElementById('qStaffName').value.trim();
    const mobile = document.getElementById('qStaffMobile').value.trim();
    const email = document.getElementById('qStaffEmail').value.trim().toLowerCase();
    const password = document.getElementById('qStaffPassword').value;
    const route = document.getElementById('qStaffRoute').value.trim();

    const submitBtn = document.getElementById('btnSubmitStaff');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';

    try {
        // Safe secondary app trick
        const secApp = firebase.initializeApp(firebaseConfig, 'StaffSec-' + Date.now());
        const secAuth = secApp.auth();

        let uid = null;
        try {
            const cred = await secAuth.createUserWithEmailAndPassword(email, password);
            uid = cred.user.uid;
            await secAuth.signOut();
        } catch (authErr) {
            if (authErr.code === 'auth/email-already-in-use') {
                // If account exists in Auth, generate deterministic or fallback doc id
                uid = 'staff_' + Date.now();
            } else {
                throw authErr;
            }
        }
        secApp.delete();

        // Save Firestore Staff Record
        const staffDoc = {
            agencyId: myAgencyId,
            name: name,
            email: email,
            mobile: mobile,
            role: role, // 'booker' or 'supplier'
            route: route || 'General Area',
            tempPassword: password,
            status: 'active',
            permissions: {
                instant: true,
                stock: true,
                customers: true,
                reports: false
            },
            createdAt: new Date().toISOString(),
            createdBy: myUid
        };

        await db.collection('users').doc(uid).set(staffDoc);

        staffDoc.id = uid;
        allStaff.push(staffDoc);

        populateStaffSelectDropdowns();
        renderStaffTable();

        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Create Staff Account';
        closeAddStaffModal();

        Swal.fire({
            icon: 'success',
            title: `🎉 ${role === 'supplier' ? 'Delivery Supplier' : 'Order Booker'} شامل ہو گیا!`,
            html: `<b>${name}</b><br>📧 ${email}<br>🔑 Password: ${password}<br>📍 Route: ${route || 'General'}`
        });

    } catch (err) {
        console.error('Add staff failed:', err);
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Create Staff Account';
        Swal.fire('❌ Error', 'Staff account nahi ban saka: ' + (err.message || err.code), 'error');
    }
});

// ============================================
// 📊 KPI UPDATE & HISTORY ANALYSIS
// ============================================
function updateKPIRibbon() {
    const totalOrdersEl = document.getElementById('kpiTotalOrders');
    const dispatchedEl = document.getElementById('kpiDispatched');
    const deliveredEl = document.getElementById('kpiDelivered');
    const returnsEl = document.getElementById('kpiReturns');

    if (totalOrdersEl) totalOrdersEl.innerText = allOrders.length;

    const dispatchedCount = allOrders.filter(o => (o.deliveryStatus || 'pending') === 'dispatched').length;
    if (dispatchedEl) dispatchedEl.innerText = dispatchedCount;

    const deliveredCount = allOrders.filter(o => o.deliveryStatus === 'delivered').length;
    if (deliveredEl) deliveredEl.innerText = deliveredCount;

    let returnedUnits = 0;
    allReturns.forEach(r => returnedUnits += (r.totalUnitsCount || 0));
    if (returnsEl) returnsEl.innerText = `${allReturns.length} (${returnedUnits} Items)`;
}

function renderHistoryAnalysis() {
    const container = document.getElementById('returnReasonStats');
    if (!container) return;

    const reasonCounts = {};
    allReturns.forEach(r => {
        const cat = r.reasonCategory || 'Unclassified';
        reasonCounts[cat] = (reasonCounts[cat] || 0) + 1;
    });

    if (Object.keys(reasonCounts).length === 0) {
        container.innerHTML = '<div style="color:#94a3b8; font-size:13px;">No returns recorded yet.</div>';
        return;
    }

    container.innerHTML = Object.entries(reasonCounts).map(([cat, count]) => `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
            <div style="font-size:11px; color:#64748b; font-weight:700;">${cat}</div>
            <div style="font-size:20px; font-weight:800; color:#7c3aed; margin-top:2px;">${count} Vouchers</div>
        </div>
    `).join('');
}

// ============================================
// 🚚 SUPPLIER ROLE PORTAL SETUP & SHEET LAUNCHER (Phase 3)
// ============================================
function setupSupplierRoleUI() {
    const isSupplier = myUser && (myUser.role === 'supplier' || myUser.role === 'delivery');
    const banner = document.getElementById('supplierDedicatedBanner');
    if (!banner) return;

    if (isSupplier) {
        banner.style.display = 'block';

        const nameEl = document.getElementById('supplierBannerName');
        const routeEl = document.getElementById('supplierBannerRoute');
        const agEl = document.getElementById('supplierBannerAgency');

        if (nameEl) nameEl.innerText = `خوش آمدید، ${myUser.name || 'Delivery Salesman'}!`;
        if (routeEl) routeEl.innerText = myUser.route || 'General Delivery Area';
        if (agEl) agEl.innerText = (myAgency && myAgency.name) || 'Agency Depot';

        // Filter supplier's dispatched orders
        const myActiveOrders = allOrders.filter(o => 
            (o.supplierId === myUid || o.supplierName === myUser.name) && 
            (o.deliveryStatus === 'dispatched')
        );

        let activeAmount = 0;
        myActiveOrders.forEach(o => activeAmount += Number(o.billAmount || o.grandTotal || 0));

        const myDeliveredOrders = allOrders.filter(o => 
            (o.supplierId === myUid || o.supplierName === myUser.name) && 
            (o.deliveryStatus === 'delivered')
        );

        const activeOrdEl = document.getElementById('supBannerActiveOrders');
        const activeAmtEl = document.getElementById('supBannerActiveAmount');
        const delOrdEl = document.getElementById('supBannerDeliveredOrders');

        if (activeOrdEl) activeOrdEl.innerText = `${myActiveOrders.length} آرڈرز`;
        if (activeAmtEl) activeAmtEl.innerText = `Rs ${Math.round(activeAmount).toLocaleString()}`;
        if (delOrdEl) delOrdEl.innerText = `${myDeliveredOrders.length} دکانیں`;
    } else {
        banner.style.display = 'none';
    }
}

window.openLoadingSheetForCurrentSupplier = function() {
    if (!myUid) return;
    // Find dispatched orders assigned to this supplier
    const supOrders = allOrders.filter(o => 
        (o.supplierId === myUid || (myUser && o.supplierName === myUser.name)) && 
        (o.deliveryStatus === 'dispatched')
    );

    if (supOrders.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'گاڑی پر کوئی آرڈر لوڈ نہیں!',
            text: 'فی الحال آپ کی گاڑی پر کوئی نیا ڈسپیچ (Dispatched) آرڈر موجود نہیں ہے۔ ایڈمن سے چالان جاری کروائیں۔',
            confirmButtonColor: '#0284c7'
        });
        return;
    }

    generateAndShowLoadingSheet(myUid, supOrders.map(o => o.id));
};

// ============================================
// 💥 =========================================
// 💥 ADVANCED DAMAGED, EXPIRED & CLAIMS RECOVERY ENGINE
// 💥 100% User Requirements & Financial Calculations
// 💥 =========================================
// ============================================

const DEFAULT_CLAIM_CATEGORIES = [
    { id: 'cat_expired', name: '⏰ Expired Items (تاریخ ختم)', type: 'expired', icon: 'fa-hourglass-end', color: '#f59e0b', desc: 'Expiry date passed / obsolete' },
    { id: 'cat_broken', name: '💥 Broken / Physical Damage (ٹوٹ پھوٹ)', type: 'broken', icon: 'fa-burst', color: '#ef4444', desc: 'Broken bottles, packs, crushed cartons' },
    { id: 'cat_leaked', name: '📦 Leaked / Damaged Packing (لیکج یا ڈبہ خراب)', type: 'damage', icon: 'fa-box-tissue', color: '#dc2626', desc: 'Torn wrapper, leaked liquid, seal broken' },
    { id: 'cat_near_expiry', name: '⚠️ Near Expiry / Short Expiry (قریب المعیاد مال)', type: 'near_expiry', icon: 'fa-calendar-xmark', color: '#d97706', desc: 'Short expiry stock returned from route' },
    { id: 'cat_defect', name: '🏭 Company / Manufacturing Defect (کمپنی نقص)', type: 'defect', icon: 'fa-industry', color: '#8b5cf6', desc: 'Faulty manufacturing or factory seal issue' },
    { id: 'cat_weather', name: '💧 Weather / Water Damaged (بارش یا نمی سے خراب)', type: 'weather', icon: 'fa-cloud-showers-heavy', color: '#0284c7', desc: 'Dampness, rain or transit degradation' },
    { id: 'cat_other', name: '📝 Other Damage / Lost (دیگر نقصان)', type: 'other', icon: 'fa-triangle-exclamation', color: '#64748b', desc: 'General warehouse loss or transit issue' }
];

// ============================================
// 🏷️ CATEGORIES MANAGEMENT
// ============================================
async function loadClaimCategories() {
    try {
        const snap = await db.collection('claim_categories')
            .where('agencyId', '==', myAgencyId)
            .get();

        allClaimCategories = [];
        snap.forEach(d => {
            const data = d.data();
            data.id = d.id;
            allClaimCategories.push(data);
        });

        // If no custom categories found, fallback to defaults
        if (allClaimCategories.length === 0) {
            allClaimCategories = DEFAULT_CLAIM_CATEGORIES.map(c => ({
                ...c,
                agencyId: myAgencyId,
                isDefault: true
            }));
        }

        populateCategoryDropdowns();
        renderCategoriesList();
    } catch (e) {
        console.error('Load claim categories error:', e);
        allClaimCategories = DEFAULT_CLAIM_CATEGORIES.map(c => ({ ...c, agencyId: myAgencyId, isDefault: true }));
        populateCategoryDropdowns();
        renderCategoriesList();
    }
}

function populateCategoryDropdowns() {
    const formSel = document.getElementById('claimCategorySelect');
    const filterSel = document.getElementById('claimCategoryFilter');

    if (formSel) {
        formSel.innerHTML = '<option value="">-- کیٹیگری منتخب کریں --</option>' + 
            allClaimCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    }

    if (filterSel) {
        filterSel.innerHTML = '<option value="all">تمام کیٹیگریز (All Categories)</option>' +
            allClaimCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    }
}

function renderCategoriesList() {
    const container = document.getElementById('categoriesListContainer');
    if (!container) return;

    if (allClaimCategories.length === 0) {
        container.innerHTML = '<div style="padding:18px; text-align:center; color:#94a3b8; font-size:13px;">کوئی کیٹیگری موجود نہیں ہے۔</div>';
        return;
    }

    container.innerHTML = allClaimCategories.map(cat => {
        const usageCount = allClaims.filter(c => c.category === cat.name || c.categoryId === cat.id).length;
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid #f1f5f9; background:#fff;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:16px;"><i class="fas ${cat.icon || 'fa-tag'}" style="color:${cat.color || '#0284c7'};"></i></span>
                    <div>
                        <b style="font-size:13px; color:#0f172a;">${cat.name}</b><br>
                        <small style="color:#64748b;">${usageCount} کلیمز اندراج شدہ</small>
                    </div>
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="btn btn-sm" onclick="editCategory('${cat.id}')" style="background:#f1f5f9; color:#475569; padding:4px 8px; border-radius:6px; font-size:11px;" title="Edit Category">
                        <i class="fas fa-edit"></i> نام بدلیں
                    </button>
                    ${!cat.isDefault ? `
                        <button type="button" class="btn btn-sm" onclick="deleteCategory('${cat.id}')" style="background:#fee2e2; color:#b91c1c; padding:4px 8px; border-radius:6px; font-size:11px;" title="Delete Category">
                            <i class="fas fa-trash-alt"></i> ڈیلیٹ
                        </button>
                    ` : `
                        <button type="button" class="btn btn-sm" onclick="editCategory('${cat.id}')" style="background:#fee2e2; color:#b91c1c; padding:4px 8px; border-radius:6px; font-size:11px;" title="Remove Category">
                            <i class="fas fa-trash-alt"></i> ڈیلیٹ
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

window.openManageCategoriesModal = function() {
    renderCategoriesList();
    const m = document.getElementById('modalManageCategories');
    if (m) m.style.display = 'flex';
};

window.closeManageCategoriesModal = function() {
    const m = document.getElementById('modalManageCategories');
    if (m) m.style.display = 'none';
};

window.saveNewCategory = async function() {
    const nameInput = document.getElementById('newCatName');
    const typeInput = document.getElementById('newCatType');
    const catName = (nameInput.value || '').trim();
    const catType = typeInput.value || 'other';

    if (!catName) {
        Swal.fire('⚠️ توجہ', 'برائے مہربانی کیٹیگری کا نام درج کریں۔', 'warning');
        return;
    }

    try {
        let icon = 'fa-tag';
        let color = '#0284c7';
        if (catType === 'expired') { icon = 'fa-hourglass-end'; color = '#f59e0b'; }
        else if (catType === 'broken') { icon = 'fa-burst'; color = '#ef4444'; }
        else if (catType === 'damage') { icon = 'fa-box-tissue'; color = '#dc2626'; }
        else if (catType === 'defect') { icon = 'fa-industry'; color = '#8b5cf6'; }
        else if (catType === 'weather') { icon = 'fa-cloud-showers-heavy'; color = '#0284c7'; }

        const newDoc = {
            agencyId: myAgencyId,
            name: catName,
            type: catType,
            icon: icon,
            color: color,
            createdAt: new Date().toISOString()
        };

        const ref = await db.collection('claim_categories').add(newDoc);
        newDoc.id = ref.id;
        allClaimCategories.push(newDoc);

        nameInput.value = '';
        populateCategoryDropdowns();
        renderCategoriesList();

        Swal.fire({
            icon: 'success',
            title: '✅ کیٹیگری شامل ہو گئی!',
            text: `نئی کیٹیگری "${catName}" محفوظ ہو گئی۔`,
            timer: 1500,
            showConfirmButton: false
        });
    } catch (err) {
        console.error('Save category error:', err);
        Swal.fire('Error', 'کیٹیگری محفوظ نہیں ہو سکی: ' + err.message, 'error');
    }
};

window.editCategory = async function(catId) {
    const cat = allClaimCategories.find(c => c.id === catId);
    if (!cat) return;

    const { value: newName } = await Swal.fire({
        title: '✏️ کیٹیگری کا نام تبدیل کریں',
        input: 'text',
        inputValue: cat.name,
        showCancelButton: true,
        confirmButtonText: 'محفوظ کریں',
        cancelButtonText: 'منسوخ',
        confirmButtonColor: '#0284c7'
    });

    if (!newName || !newName.trim()) return;

    try {
        const updatedName = newName.trim();
        cat.name = updatedName;

        // If exists in DB
        if (!cat.isDefault) {
            await db.collection('claim_categories').doc(catId).update({
                name: updatedName,
                updatedAt: new Date().toISOString()
            });
        }

        populateCategoryDropdowns();
        renderCategoriesList();
        renderClaimsTable();

        Swal.fire({
            icon: 'success',
            title: '✅ کیٹیگری اپ ڈیٹ ہو گئی!',
            timer: 1200,
            showConfirmButton: false
        });
    } catch (e) {
        console.error('Edit category error:', e);
        Swal.fire('Error', 'تبدیلی نہیں ہو سکی: ' + e.message, 'error');
    }
};

window.deleteCategory = async function(catId) {
    const cat = allClaimCategories.find(c => c.id === catId);
    if (!cat) return;

    const confirm = await Swal.fire({
        title: 'کیٹیگری ڈیلیٹ کریں؟',
        text: `کیا آپ واقعی "${cat.name}" کو ڈیلیٹ کرنا چاہتے ہیں؟`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ہاں، ڈیلیٹ کریں',
        cancelButtonText: 'منسوخ'
    });

    if (!confirm.isConfirmed) return;

    try {
        if (!cat.isDefault) {
            await db.collection('claim_categories').doc(catId).delete();
        }
        allClaimCategories = allClaimCategories.filter(c => c.id !== catId);

        populateCategoryDropdowns();
        renderCategoriesList();

        Swal.fire({
            icon: 'success',
            title: '✅ کیٹیگری ڈیلیٹ ہو گئی',
            timer: 1200,
            showConfirmButton: false
        });
    } catch (e) {
        console.error('Delete category error:', e);
        Swal.fire('Error', 'ڈیلیٹ نہیں ہو سکی: ' + e.message, 'error');
    }
};

// ============================================
// 💥 LOAD & MANAGE DAMAGE / EXPIRED CLAIMS
// ============================================
async function loadDamageClaims() {
    try {
        let snap;
        try {
            snap = await db.collection('damage_claims')
                .where('agencyId', '==', myAgencyId)
                .orderBy('createdAt', 'desc')
                .get();
        } catch (eIdx) {
            snap = await db.collection('damage_claims')
                .where('agencyId', '==', myAgencyId)
                .get();
        }

        allClaims = [];
        snap.forEach(d => {
            const data = d.data();
            data.id = d.id;
            allClaims.push(data);
        });

        allClaims.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        renderClaimsTable();
        updateClaimsKPIRibbon();
    } catch (err) {
        console.error('Load damage claims error:', err);
    }
}

function renderClaimsTable() {
    const tbody = document.getElementById('claimsTableBody');
    if (!tbody) return;

    const query = (document.getElementById('claimSearchInput')?.value || '').toLowerCase().trim();

    const filtered = allClaims.filter(claim => {
        // Status filter
        if (activeClaimStatus !== 'all') {
            if (activeClaimStatus === 'pending') {
                if (claim.status !== 'pending') return false;
            } else if (activeClaimStatus === 'recovered') {
                if (claim.status !== 'recovered') return false;
            } else if (activeClaimStatus === 'partial') {
                if (claim.status !== 'partial') return false;
            } else if (activeClaimStatus === 'loss') {
                if (claim.status !== 'loss') return false;
            }
        }

        // Category filter
        if (activeClaimCategory !== 'all') {
            if (claim.category !== activeClaimCategory) return false;
        }

        // Search text
        if (query) {
            const vNo = (claim.voucherNo || '').toLowerCase();
            const item = (claim.itemName || '').toLowerCase();
            const sup = (claim.supplierName || '').toLowerCase();
            const cat = (claim.category || '').toLowerCase();
            const notes = (claim.notes || '').toLowerCase();
            return vNo.includes(query) || item.includes(query) || sup.includes(query) || cat.includes(query) || notes.includes(query);
        }

        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:35px; color:#94a3b8;">
            کوئی کلیم یا نقصان کا ریکارڈ نہیں ملا۔ نیا ریکارڈ درج کرنے کے لیے اوپر دیا گیا بٹن دبائیں۔
        </td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(c => {
        const totalLoss = Math.round(c.totalLoss || 0);
        const recoveredAmount = Math.round(c.recoveredAmount || 0);
        const remainingLoss = Math.round(c.remainingLoss !== undefined ? c.remainingLoss : Math.max(0, totalLoss - recoveredAmount));

        let statusBadge = '<span class="badge-claim-pending">⏳ Pending <span class="ur-sub">(زیر التواء)</span></span>';
        if (c.status === 'recovered') {
            statusBadge = '<span class="badge-claim-recovered">✅ Recovered <span class="ur-sub">(مکمل وصول)</span></span>';
        } else if (c.status === 'partial') {
            statusBadge = '<span class="badge-claim-partial">⚠️ Partial <span class="ur-sub">(جزوی وصول)</span></span>';
        } else if (c.status === 'loss') {
            statusBadge = '<span class="badge-claim-loss">❌ Net Loss <span class="ur-sub">(خالص نقصان)</span></span>';
        }

        let recoverySummaryHtml = `<span style="color:#94a3b8; font-size:11.5px;">Not Recovered Yet <span class="ur-block">(ابھی وصولی نہیں ہوئی)</span></span>`;
        if (recoveredAmount > 0) {
            recoverySummaryHtml = `
                <b style="color:#15803d; font-size:12px;">Rec: Rs ${recoveredAmount.toLocaleString()} <span class="ur-sub">(وصول)</span></b><br>
                ${remainingLoss > 0 ? `<small style="color:#ea580c; font-weight:700;">Rem. Loss: Rs ${remainingLoss.toLocaleString()} <span class="ur-sub">(باقی نقصان)</span></small>` : '<small style="color:#16a34a; font-weight:700;">100% Fully Recovered <span class="ur-sub">(مکمل وصول)</span></small>'}
            `;
        } else if (c.status === 'loss') {
            recoverySummaryHtml = `<b style="color:#dc2626; font-size:12px;">Written Off Loss <span class="ur-block">(مسترد شدہ خالص نقصان)</span></b>`;
        }

        return `
            <tr>
                <td>
                    <b style="color:#7c3aed; font-size:13px;">${c.voucherNo || c.id.slice(0,8)}</b>
                </td>
                <td>
                    <b>${c.incidentDate || (c.createdAt || '').slice(0,10)}</b><br>
                    ${c.expiryDate ? `<small style="color:#d97706;"><i class="fas fa-clock"></i> Exp: ${c.expiryDate}</small>` : ''}
                </td>
                <td>
                    <b style="color:#0f172a; font-size:13px;">${c.itemName}</b>
                    ${c.notes ? `<br><small style="color:#64748b;">${c.notes}</small>` : ''}
                </td>
                <td>
                    <span class="cat-badge">
                        ${c.category || 'Damage'}
                    </span>
                </td>
                <td>
                    <b style="font-size:13.5px; color:#1e293b;">${c.qty}</b> <small style="color:#64748b; font-weight:700;">${c.unit || 'Units'}</small>
                </td>
                <td>
                    <span style="color:#64748b; font-size:11.5px;">@ Rs ${c.purchaseRate}</span><br>
                    <b style="color:#dc2626; font-size:13px;">Rs ${totalLoss.toLocaleString()}</b>
                </td>
                <td>
                    ${c.supplierName ? `<b style="color:#0284c7;"><i class="fas fa-building"></i> ${c.supplierName}</b>` : '<span style="color:#94a3b8;">Not Specified</span>'}
                </td>
                <td>
                    ${statusBadge}
                </td>
                <td>
                    ${recoverySummaryHtml}
                </td>
                <td style="text-align:right;">
                    <div style="display:flex; justify-content:flex-end; gap:4px; flex-wrap:wrap;">
                        <button class="btn btn-sm" onclick="openClaimRecoveryModal('${c.id}')" style="background:#15803d; color:#fff; padding:5px 9px; border-radius:6px; font-size:11px; font-weight:bold;" title="Record Claim Recovery">
                            <i class="fas fa-hand-holding-dollar"></i> Recover <span class="ur-sub">(وصول)</span>
                        </button>
                        <button class="btn btn-sm" onclick="viewClaimVoucher('${c.id}')" style="background:#0284c7; color:#fff; padding:5px 8px; border-radius:6px; font-size:11px;" title="Print Official Voucher">
                            <i class="fas fa-print"></i> Voucher <span class="ur-sub">(واؤچر)</span>
                        </button>
                        <button class="btn btn-sm" onclick="openDamageClaimModal('${c.id}')" style="background:#f1f5f9; color:#475569; padding:5px 7px; border-radius:6px; font-size:11px;" title="Edit Claim">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm" onclick="deleteDamageClaim('${c.id}')" style="background:#fee2e2; color:#b91c1c; padding:5px 7px; border-radius:6px; font-size:11px;" title="Delete Record">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

}

function updateClaimsKPIRibbon() {
    let totalItems = allClaims.length;
    let totalUnits = 0;
    let totalGrossLoss = 0;
    let totalRecovered = 0;
    let totalRemainingLoss = 0;
    let pendingCount = 0;

    allClaims.forEach(c => {
        totalUnits += (parseFloat(c.qty) || 0);
        const loss = parseFloat(c.totalLoss) || 0;
        const rec = parseFloat(c.recoveredAmount) || 0;
        totalGrossLoss += loss;
        totalRecovered += rec;

        if (c.remainingLoss !== undefined) {
            totalRemainingLoss += (parseFloat(c.remainingLoss) || 0);
        } else {
            totalRemainingLoss += Math.max(0, loss - rec);
        }

        if (c.status === 'pending' || c.status === 'partial') {
            pendingCount++;
        }
    });

    const countEl = document.getElementById('claimKpiCount');
    const unitsSub = document.getElementById('claimKpiUnitsSub');
    const totalLossEl = document.getElementById('claimKpiTotalLoss');
    const recoveredEl = document.getElementById('claimKpiRecovered');
    const recPercentEl = document.getElementById('claimKpiRecoveredPercent');
    const remLossEl = document.getElementById('claimKpiRemainingLoss');
    const pendingEl = document.getElementById('claimKpiPending');

    if (countEl) countEl.innerText = `${totalItems} Records`;
    if (unitsSub) unitsSub.innerText = `${Math.round(totalUnits)} Total Units`;
    if (totalLossEl) totalLossEl.innerText = `Rs ${Math.round(totalGrossLoss).toLocaleString()}`;
    if (recoveredEl) recoveredEl.innerText = `Rs ${Math.round(totalRecovered).toLocaleString()}`;
    if (remLossEl) remLossEl.innerText = `Rs ${Math.round(totalRemainingLoss).toLocaleString()}`;
    if (pendingEl) pendingEl.innerText = `${pendingCount} Pending`;

    if (recPercentEl) {
        const pct = totalGrossLoss > 0 ? Math.round((totalRecovered / totalGrossLoss) * 100) : 0;
        recPercentEl.innerText = `${pct}% Recovered Successfully`;
    }

    // Top Header KPI Card
    const headerClaimsLoss = document.getElementById('kpiClaimsLoss');
    const headerClaimsSub = document.getElementById('kpiClaimsRecoveredSub');
    if (headerClaimsLoss) {
        headerClaimsLoss.innerText = `Rs ${Math.round(totalGrossLoss).toLocaleString()}`;
    }
    if (headerClaimsSub) {
        headerClaimsSub.innerText = `Rs ${Math.round(totalRecovered).toLocaleString()} Recovered / ${pendingCount} Pending`;
    }
}

// ============================================
// 📦 PRODUCT SEARCH & AUTOCOMPLETE HELPER
// ============================================
function setupProductAutocomplete() {
    const input = document.getElementById('claimProductSearch');
    const dropdown = document.getElementById('claimProductDropdown');
    if (!input || !dropdown) return;

    input.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        if (!query) {
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
            return;
        }

        const matches = allStock.filter(s => {
            const n = (s.name || '').toLowerCase();
            const c = (s.code || '').toLowerCase();
            const b = (s.barcode || '').toLowerCase();
            return n.includes(query) || c.includes(query) || b.includes(query);
        }).slice(0, 8);

        if (matches.length === 0) {
            dropdown.innerHTML = `<div style="padding:10px; color:#94a3b8; font-size:12px;">کوئی آئٹم نہیں ملا۔ آپ نیا نام ٹائپ بھی کر سکتے ہیں۔</div>`;
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = matches.map(s => {
            const pRate = s.purchaseRate || s.purchasePrice || s.costPrice || 0;
            return `
                <div class="product-search-item" onclick="selectProductForClaim('${s.id}')">
                    <div>
                        <b>${s.name}</b><br>
                        <small style="color:#64748b;">موجودہ اسٹاک: ${s.qty || 0} ${s.unit || ''} | خرید ریٹ: Rs ${pRate}</small>
                    </div>
                    <span style="font-size:11px; color:#0284c7; font-weight:bold;">منتخب کریں →</span>
                </div>
            `;
        }).join('');
        dropdown.style.display = 'block';
    });

    // Close on outside click
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

window.selectProductForClaim = function(stockId) {
    const s = allStock.find(x => x.id === stockId);
    if (!s) return;

    document.getElementById('claimStockId').value = s.id;
    document.getElementById('claimProductSearch').value = s.name;
    document.getElementById('claimProductDropdown').style.display = 'none';

    // Auto-fill purchase rate and unit
    const pRate = parseFloat(s.purchaseRate || s.purchasePrice || s.costPrice || 0);
    document.getElementById('claimPurchaseRate').value = pRate;

    if (s.unit) {
        const unitSel = document.getElementById('claimUnit');
        if (unitSel) {
            const u = (s.unit || '').toLowerCase();
            for (let i = 0; i < unitSel.options.length; i++) {
                if (unitSel.options[i].value === u) {
                    unitSel.selectedIndex = i;
                    break;
                }
            }
        }
    }

    const meta = document.getElementById('claimSelectedProductMeta');
    if (meta) {
        meta.style.display = 'block';
        meta.innerHTML = `<i class="fas fa-check-circle" style="color:#10b981;"></i> موجودہ اسٹاک: <b>${s.qty || 0} ${s.unit || ''}</b> | پہلے سے درج خرید قیمت: <b>Rs ${pRate}</b>`;
    }

    recalcClaimLoss();
};

window.recalcClaimLoss = function() {
    const qty = parseFloat(document.getElementById('claimQty')?.value) || 0;
    const rate = parseFloat(document.getElementById('claimPurchaseRate')?.value) || 0;
    const unit = document.getElementById('claimUnit')?.value || 'Units';
    const total = Math.round(qty * rate);

    const formulaEl = document.getElementById('claimFormulaPreview');
    const totalEl = document.getElementById('claimTotalLossPreview');

    if (formulaEl) formulaEl.innerText = `${qty} ${unit} × Rs ${rate} = Rs ${total.toLocaleString()}`;
    if (totalEl) totalEl.innerText = `Rs ${total.toLocaleString()}`;
};

// ============================================
// ➕ OPEN / CLOSE CLAIM RECORDING MODAL
// ============================================
window.openDamageClaimModal = function(claimId = null) {
    const modal = document.getElementById('modalDamageClaim');
    const form = document.getElementById('damageClaimForm');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('claimEditId').value = '';
    document.getElementById('claimStockId').value = '';
    document.getElementById('claimSelectedProductMeta').style.display = 'none';

    // Defaults
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('claimIncidentDate').value = today;

    if (claimId) {
        const c = allClaims.find(x => x.id === claimId);
        if (c) {
            document.getElementById('claimEditId').value = c.id;
            document.getElementById('claimStockId').value = c.stockId || '';
            document.getElementById('claimProductSearch').value = c.itemName || '';
            document.getElementById('claimCategorySelect').value = c.category || '';
            document.getElementById('claimIncidentDate').value = c.incidentDate || today;
            document.getElementById('claimExpiryDate').value = c.expiryDate || '';
            document.getElementById('claimSupplierName').value = c.supplierName || '';
            document.getElementById('claimQty').value = c.qty || 1;
            document.getElementById('claimUnit').value = c.unit || 'pcs';
            document.getElementById('claimPurchaseRate').value = c.purchaseRate || 0;
            document.getElementById('claimNotes').value = c.notes || '';
            document.getElementById('claimDeductStock').checked = false; // already saved
            recalcClaimLoss();
        }
    } else {
        recalcClaimLoss();
    }

    modal.style.display = 'flex';
};

window.closeDamageClaimModal = function() {
    const m = document.getElementById('modalDamageClaim');
    if (m) m.style.display = 'none';
};

window.handleDamageClaimSubmit = async function(e) {
    e.preventDefault();

    const editId = document.getElementById('claimEditId').value;
    const stockId = document.getElementById('claimStockId').value;
    const itemName = (document.getElementById('claimProductSearch').value || '').trim();
    const category = document.getElementById('claimCategorySelect').value;
    const incidentDate = document.getElementById('claimIncidentDate').value;
    const expiryDate = document.getElementById('claimExpiryDate').value;
    const supplierName = (document.getElementById('claimSupplierName').value || '').trim();
    const qty = parseFloat(document.getElementById('claimQty').value) || 0;
    const unit = document.getElementById('claimUnit').value;
    const purchaseRate = parseFloat(document.getElementById('claimPurchaseRate').value) || 0;
    const notes = (document.getElementById('claimNotes').value || '').trim();
    const deductStock = document.getElementById('claimDeductStock').checked;

    if (!itemName) {
        Swal.fire('⚠️ توجہ', 'برائے مہربانی پروڈکٹ کا نام درج کریں۔', 'warning');
        return;
    }
    if (!category) {
        Swal.fire('⚠️ توجہ', 'برائے مہربانی نقصان کی کیٹیگری منتخب کریں۔', 'warning');
        return;
    }
    if (qty <= 0) {
        Swal.fire('⚠️ توجہ', 'برائے مہربانی خراب آئٹمز کی درست تعداد درج کریں۔', 'warning');
        return;
    }

    const totalLoss = Math.round(qty * purchaseRate);
    const submitBtn = document.getElementById('btnSaveClaimSubmit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> کلیم محفوظ ہو رہا ہے...';

    try {
        const voucherNo = 'CLM-' + (allClaims.length + 1001);

        const claimData = {
            agencyId: myAgencyId,
            voucherNo: editId ? (allClaims.find(x => x.id === editId)?.voucherNo || voucherNo) : voucherNo,
            stockId: stockId || '',
            itemName: itemName,
            category: category,
            incidentDate: incidentDate,
            expiryDate: expiryDate || '',
            supplierName: supplierName || '',
            qty: qty,
            unit: unit,
            purchaseRate: purchaseRate,
            totalLoss: totalLoss,
            notes: notes,
            status: 'pending',
            recoveredQty: 0,
            recoveredRate: 0,
            recoveredAmount: 0,
            remainingLoss: totalLoss,
            recoveryHistory: [],
            updatedAt: new Date().toISOString()
        };

        if (editId) {
            // Keep prior recovery data on edit
            const existing = allClaims.find(x => x.id === editId);
            if (existing) {
                claimData.voucherNo = existing.voucherNo;
                claimData.recoveredQty = existing.recoveredQty || 0;
                claimData.recoveredRate = existing.recoveredRate || 0;
                claimData.recoveredAmount = existing.recoveredAmount || 0;
                claimData.remainingLoss = Math.max(0, totalLoss - (existing.recoveredAmount || 0));
                claimData.status = (existing.recoveredAmount >= totalLoss) ? 'recovered' : (existing.recoveredAmount > 0 ? 'partial' : 'pending');
                claimData.recoveryHistory = existing.recoveryHistory || [];
            }
            await db.collection('damage_claims').doc(editId).update(claimData);
        } else {
            claimData.createdAt = new Date().toISOString();
            claimData.createdBy = myUid;
            claimData.createdByName = (myUser && myUser.name) ? myUser.name : 'Store Manager';

            // Deduct stock from physical inventory if requested
            if (deductStock && stockId) {
                const s = allStock.find(x => x.id === stockId);
                if (s) {
                    const newQty = Math.max(0, (s.qty || 0) - qty);
                    await db.collection('stock').doc(stockId).update({
                        qty: newQty,
                        updatedAt: new Date().toISOString()
                    });
                    s.qty = newQty;

                    // Log movement
                    try {
                        await db.collection('movements').add({
                            agencyId: myAgencyId,
                            stockId: stockId,
                            itemName: itemName,
                            type: 'out',
                            reason: category.includes('Exp') ? 'expired' : 'damage',
                            qty: qty,
                            unit: unit,
                            beforeQty: s.qty + qty,
                            afterQty: newQty,
                            note: `Damage Claim #${voucherNo}: ${category}`,
                            createdAt: new Date().toISOString(),
                            createdBy: myUid
                        });
                    } catch (eMov) {}
                }
            }

            await db.collection('damage_claims').add(claimData);
        }

        closeDamageClaimModal();
        await loadDamageClaims();

        Swal.fire({
            icon: 'success',
            title: editId ? '✅ کلیم اپ ڈیٹ ہو گیا!' : '✅ نقصان کا اندراج اور کلیم محفوظ ہو گیا!',
            html: `پروڈکٹ: <b>${itemName}</b><br>تعداد: <b>${qty} ${unit}</b> @ Rs ${purchaseRate}<br>کل مالی نقصان: <b style="color:#dc2626;">Rs ${totalLoss.toLocaleString()}</b>`,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'ٹھیک ہے'
        });

    } catch (err) {
        console.error('Save claim error:', err);
        Swal.fire('Error', 'کلیم محفوظ نہیں ہو سکا: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> کلیم محفوظ کریں (Save Claim)';
    }
};

// ============================================
// 🏢 CLAIM RECOVERY POPUP & EXACT USER MATH LOGIC
// "agar us k 12 pics ya 1 ctn tha our 12 pics 10 k purchase rate k hesaab say 120 bantay hain..."
// ============================================
let activeClaimForRecovery = null;

window.openClaimRecoveryModal = function(claimId) {
    const claim = allClaims.find(c => c.id === claimId);
    if (!claim) return;

    activeClaimForRecovery = claim;
    document.getElementById('recTargetClaimId').value = claim.id;

    // Fill Summary
    document.getElementById('recSummaryVoucherNo').innerText = claim.voucherNo || claim.id.slice(0,8);
    document.getElementById('recSummaryItemName').innerText = claim.itemName;
    document.getElementById('recSummaryCategory').innerText = claim.category || 'Damage';
    document.getElementById('recSummaryOriginalClaim').innerText = `${claim.qty} ${claim.unit || 'pcs'} @ Rs ${claim.purchaseRate}`;
    document.getElementById('recSummaryTotalLoss').innerText = `Rs ${Math.round(claim.totalLoss).toLocaleString()}`;
    
    const rem = claim.remainingLoss !== undefined ? claim.remainingLoss : Math.max(0, claim.totalLoss - (claim.recoveredAmount || 0));
    document.getElementById('recSummaryRemaining').innerText = `Rs ${Math.round(rem).toLocaleString()}`;

    // Fill defaults (User prompt: auto fills full qty and purchase rate so 12 @ 10 = 120 gives Recovered Successfully)
    const unrecoveredQty = Math.max(0, claim.qty - (claim.recoveredQty || 0)) || claim.qty;
    document.getElementById('recQty').value = unrecoveredQty;
    document.getElementById('recRate').value = claim.purchaseRate || 0;
    document.getElementById('recTotalAmount').value = Math.round(unrecoveredQty * (claim.purchaseRate || 0));

    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('recDate').value = today;
    document.getElementById('recMode').value = 'cash';
    document.getElementById('recReference').value = '';
    document.getElementById('recNotes').value = '';

    recalcRecoveryMath();

    const m = document.getElementById('modalClaimRecovery');
    if (m) m.style.display = 'flex';
};

window.closeClaimRecoveryModal = function() {
    const m = document.getElementById('modalClaimRecovery');
    if (m) m.style.display = 'none';
    activeClaimForRecovery = null;
};

// Live calculation when Qty or Rate changes
window.recalcRecoveryMath = function() {
    if (!activeClaimForRecovery) return;

    const qty = parseFloat(document.getElementById('recQty')?.value) || 0;
    const rate = parseFloat(document.getElementById('recRate')?.value) || 0;
    const totalAmount = Math.round(qty * rate);

    const amountInput = document.getElementById('recTotalAmount');
    if (amountInput) amountInput.value = totalAmount;

    updateRecoveryStatusBanner(totalAmount);
};

// When user directly changes total amount input
window.recalcRecoveryMathFromAmount = function() {
    if (!activeClaimForRecovery) return;
    const totalAmount = parseFloat(document.getElementById('recTotalAmount')?.value) || 0;
    updateRecoveryStatusBanner(totalAmount);
};

function updateRecoveryStatusBanner(currentSettlementAmount) {
    if (!activeClaimForRecovery) return;

    const banner = document.getElementById('recStatusBanner');
    if (!banner) return;

    const priorRecovered = parseFloat(activeClaimForRecovery.recoveredAmount) || 0;
    const totalClaimLoss = parseFloat(activeClaimForRecovery.totalLoss) || 0;
    const grandRecovered = priorRecovered + currentSettlementAmount;
    const unrecoveredBalance = Math.max(0, totalClaimLoss - grandRecovered);

    // Exact User Prompt Logic:
    // If rate or amount matches full: "agar wo pic's main 12 likhay ga our Rate main 10 likhay ga to wo poray ho jateen gay our wo Recovered Successfully main aa jaye"
    // If rate is less: "our agar rate kam likhay ga to jo cover ho gaya wo cover ho gay our jo baki rate pora Nahi mela us ko loose main count keya jayee"
    if (grandRecovered >= totalClaimLoss) {
        banner.className = 'recovery-status-banner recovery-status-full';
        banner.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:22px;">🎉</span>
                <div>
                    <b style="font-size:14px; color:#14532d;">مکمل کلیم وصولی (Recovered Successfully)!</b><br>
                    <span>وصول شدہ رقم: <b>Rs ${grandRecovered.toLocaleString()}</b> / کل دعویٰ: <b>Rs ${totalClaimLoss.toLocaleString()}</b>۔ یہ کلیم 100% مکمل وصول شمار ہو گا۔</span>
                </div>
            </div>
        `;
    } else {
        banner.className = 'recovery-status-banner recovery-status-partial';
        banner.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:22px;">⚠️</span>
                <div>
                    <b style="font-size:14px; color:#9a3412;">جزوی وصولی (Partial Recovery):</b><br>
                    <span>کمپنی سے وصول رقم: <b>Rs ${grandRecovered.toLocaleString()}</b> | بقیہ غیر وصول شدہ رقم: <b style="color:#dc2626;">Rs ${unrecoveredBalance.toLocaleString()}</b> بطور خالص نقصان (Net Loose) شمار ہو گی۔</span>
                </div>
            </div>
        `;
    }
}

window.handleClaimRecoverySubmit = async function(e) {
    e.preventDefault();
    if (!activeClaimForRecovery) return;

    const claimId = document.getElementById('recTargetClaimId').value;
    const recQty = parseFloat(document.getElementById('recQty').value) || 0;
    const recRate = parseFloat(document.getElementById('recRate').value) || 0;
    const recAmount = parseFloat(document.getElementById('recTotalAmount').value) || 0;
    const recMode = document.getElementById('recMode').value;
    const recDate = document.getElementById('recDate').value;
    const recRef = (document.getElementById('recReference').value || '').trim();
    const recNotes = (document.getElementById('recNotes').value || '').trim();

    if (recAmount <= 0) {
        Swal.fire('⚠️ توجہ', 'برائے مہربانی وصول شدہ رقم درج کریں۔', 'warning');
        return;
    }

    const submitBtn = document.getElementById('btnSaveRecoverySubmit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> وصولی تصدیق ہو رہی ہے...';

    try {
        const priorRecovered = parseFloat(activeClaimForRecovery.recoveredAmount) || 0;
        const priorQty = parseFloat(activeClaimForRecovery.recoveredQty) || 0;
        const totalClaimLoss = parseFloat(activeClaimForRecovery.totalLoss) || 0;

        const newTotalRecoveredAmount = priorRecovered + recAmount;
        const newTotalRecoveredQty = priorQty + recQty;
        const remainingLoss = Math.max(0, totalClaimLoss - newTotalRecoveredAmount);

        // Determine Status
        const newStatus = (newTotalRecoveredAmount >= totalClaimLoss) ? 'recovered' : 'partial';

        const historyEntry = {
            date: recDate,
            qty: recQty,
            rate: recRate,
            amount: recAmount,
            mode: recMode,
            reference: recRef,
            notes: recNotes,
            recoveredBy: myUid,
            recoveredByName: (myUser && myUser.name) ? myUser.name : 'Store Manager',
            timestamp: new Date().toISOString()
        };

        const updatePayload = {
            recoveredQty: newTotalRecoveredQty,
            recoveredRate: recRate,
            recoveredAmount: newTotalRecoveredAmount,
            remainingLoss: remainingLoss,
            status: newStatus,
            lastSettlementDate: recDate,
            recoveryHistory: firebase.firestore.FieldValue.arrayUnion(historyEntry),
            updatedAt: new Date().toISOString()
        };

        // If Settlement Mode is "Replacement Stock" (گودام میں نیا مال جمع کریں)
        if (recMode === 'replacement' && activeClaimForRecovery.stockId) {
            const stockId = activeClaimForRecovery.stockId;
            const s = allStock.find(x => x.id === stockId);
            if (s) {
                const newStockQty = (s.qty || 0) + recQty;
                await db.collection('stock').doc(stockId).update({
                    qty: newStockQty,
                    updatedAt: new Date().toISOString()
                });
                s.qty = newStockQty;

                try {
                    await db.collection('movements').add({
                        agencyId: myAgencyId,
                        stockId: stockId,
                        itemName: activeClaimForRecovery.itemName,
                        type: 'in',
                        reason: 'claim_replacement',
                        qty: recQty,
                        unit: activeClaimForRecovery.unit || 'pcs',
                        beforeQty: s.qty - recQty,
                        afterQty: newStockQty,
                        note: `Claim Replacement Restock #${activeClaimForRecovery.voucherNo}`,
                        createdAt: new Date().toISOString(),
                        createdBy: myUid
                    });
                } catch (eMov) {}
            }
        }

        await db.collection('damage_claims').doc(claimId).update(updatePayload);

        closeClaimRecoveryModal();
        await loadDamageClaims();

        Swal.fire({
            icon: 'success',
            title: newStatus === 'recovered' ? '🎉 مکمل کلیم وصول ہو گیا!' : '✅ جزوی وصولی محفوظ ہو گئی!',
            html: `پروڈکٹ: <b>${activeClaimForRecovery.itemName}</b><br>
                   وصول شدہ رقم: <b style="color:#15803d;">Rs ${recAmount.toLocaleString()}</b><br>
                   طریقہ کار: <b>${recMode === 'cash' ? 'Cash Received' : (recMode === 'ledger' ? 'Supplier Khata Credit' : 'Replacement Restock')}</b><br>
                   ${remainingLoss > 0 ? `<b style="color:#ea580c;">بقیہ غیر وصول شدہ نقصان: Rs ${remainingLoss.toLocaleString()}</b>` : '<b style="color:#16a34a;">خالص نقصان: Rs 0 (100% Recovered)</b>'}`,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'ٹھیک ہے'
        });

    } catch (err) {
        console.error('Claim recovery error:', err);
        Swal.fire('Error', 'وصولی محفوظ نہیں ہو سکی: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> وصولی تصدیق کریں (Confirm Recovery)';
    }
};

window.markClaimAsLoss = async function() {
    if (!activeClaimForRecovery) return;

    const confirm = await Swal.fire({
        title: '⚠️ کلیم مسترد / خالص نقصان؟',
        text: 'کیا کمپنی / سپلائر نے یہ کلیم مسترد کر دیا ہے؟ بقیہ تمام رقم بطور خالص کاروباری نقصان (Unrecoverable Loss) درج ہو جائے گی۔',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'ہاں، خالص نقصان شمار کریں',
        cancelButtonText: 'منسوخ'
    });

    if (!confirm.isConfirmed) return;

    try {
        const claimId = activeClaimForRecovery.id;
        await db.collection('damage_claims').doc(claimId).update({
            status: 'loss',
            markedLossAt: new Date().toISOString(),
            markedLossBy: myUid,
            updatedAt: new Date().toISOString()
        });

        closeClaimRecoveryModal();
        await loadDamageClaims();

        Swal.fire('محفوظ', 'کلیم کو خالص نقصان (Net Business Loss) کے طور پر نشان زد کر دیا گیا ہے۔', 'info');
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

window.deleteDamageClaim = async function(claimId) {
    const claim = allClaims.find(c => c.id === claimId);
    if (!claim) return;

    const confirm = await Swal.fire({
        title: 'کلیم ڈیلیٹ کریں؟',
        html: `کیا آپ واقعی کلیم <b>${claim.voucherNo || ''} (${claim.itemName})</b> کو حذف کرنا چاہتے ہیں؟`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ہاں، ڈیلیٹ کریں',
        cancelButtonText: 'منسوخ'
    });

    if (!confirm.isConfirmed) return;

    try {
        await db.collection('damage_claims').doc(claimId).delete();
        allClaims = allClaims.filter(c => c.id !== claimId);
        renderClaimsTable();
        updateClaimsKPIRibbon();

        Swal.fire({
            icon: 'success',
            title: 'کلیم ڈیلیٹ ہو گیا',
            timer: 1200,
            showConfirmButton: false
        });
    } catch (err) {
        Swal.fire('Error', 'ڈیلیٹ نہیں ہو سکا: ' + err.message, 'error');
    }
};

// ============================================
// 🖨️ PRINTABLE CLAIM GATE PASS & VOUCHER
// ============================================
let activeClaimForVoucher = null;

window.viewClaimVoucher = function(claimId) {
    const claim = allClaims.find(c => c.id === claimId);
    if (!claim) return;

    activeClaimForVoucher = claim;
    const printArea = document.getElementById('claimVoucherPrintArea');
    if (!printArea) return;

    const agencyName = (myAgency && myAgency.name) ? myAgency.name : 'Distribution Agency';
    const agencyCity = (myAgency && myAgency.city) ? myAgency.city : '';
    const agencyPhone = (myAgency && myAgency.phone) ? myAgency.phone : '';

    const totalLoss = Math.round(claim.totalLoss || 0);
    const recAmount = Math.round(claim.recoveredAmount || 0);
    const remaining = Math.round(claim.remainingLoss !== undefined ? claim.remainingLoss : Math.max(0, totalLoss - recAmount));

    let statusText = 'Pending Settlement (زیر التواء کلیم)';
    if (claim.status === 'recovered') statusText = '100% Recovered Successfully (مکمل وصول شدہ)';
    else if (claim.status === 'partial') statusText = `Partially Recovered (Rs ${recAmount.toLocaleString()}) | Net Loss: Rs ${remaining.toLocaleString()}`;
    else if (claim.status === 'loss') statusText = 'Written Off / Unrecoverable Loss (خالص نقصان)';

    printArea.innerHTML = `
        <div style="max-width:540px; margin:0 auto; border:2px dashed #94a3b8; border-radius:12px; padding:20px; background:#fff; font-family:'Segoe UI', sans-serif;">
            <div style="text-align:center; border-bottom:2px solid #0f172a; padding-bottom:12px; margin-bottom:14px;">
                <h2 style="margin:0; font-size:20px; color:#0f172a; text-transform:uppercase;">${agencyName}</h2>
                <div style="font-size:12px; color:#475569;">${agencyCity} ${agencyPhone ? `• Phone: ${agencyPhone}` : ''}</div>
                <div style="margin-top:6px; display:inline-block; background:#dc2626; color:#fff; padding:3px 14px; border-radius:12px; font-size:12px; font-weight:800; letter-spacing:1px;">
                    DAMAGE / EXPIRE CLAIM PASS (کلیم چالان)
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:12px;">
                <div>
                    <b>Voucher #:</b> <span style="color:#7c3aed; font-weight:800;">${claim.voucherNo || claim.id.slice(0,8)}</span><br>
                    <b>Date:</b> ${claim.incidentDate || (claim.createdAt || '').slice(0,10)}<br>
                    ${claim.expiryDate ? `<b>Expiry Date:</b> ${claim.expiryDate}<br>` : ''}
                </div>
                <div style="text-align:right;">
                    <b>Company/Supplier:</b> ${claim.supplierName || 'Distributor Desk'}<br>
                    <b>Category:</b> ${claim.category || 'General Damage'}<br>
                    <b>Prepared By:</b> ${claim.createdByName || 'Store Keeper'}
                </div>
            </div>

            <table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:12.5px;">
                <thead>
                    <tr style="background:#f1f5f9; border-top:1px solid #cbd5e1; border-bottom:1px solid #cbd5e1;">
                        <th style="padding:8px; text-align:left;">Item Description</th>
                        <th style="padding:8px; text-align:center;">Qty</th>
                        <th style="padding:8px; text-align:right;">Cost Rate</th>
                        <th style="padding:8px; text-align:right;">Total Claim Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding:10px 8px; border-bottom:1px solid #e2e8f0;">
                            <b>${claim.itemName}</b>
                            ${claim.notes ? `<br><small style="color:#64748b;">${claim.notes}</small>` : ''}
                        </td>
                        <td style="padding:10px 8px; text-align:center; border-bottom:1px solid #e2e8f0; font-weight:bold;">
                            ${claim.qty} ${claim.unit || 'pcs'}
                        </td>
                        <td style="padding:10px 8px; text-align:right; border-bottom:1px solid #e2e8f0;">
                            Rs ${claim.purchaseRate}
                        </td>
                        <td style="padding:10px 8px; text-align:right; border-bottom:1px solid #e2e8f0; font-weight:800; color:#dc2626;">
                            Rs ${totalLoss.toLocaleString()}
                        </td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr style="background:#f8fafc; font-weight:bold;">
                        <td colspan="3" style="padding:8px; text-align:right;">Gross Claimed Loss:</td>
                        <td style="padding:8px; text-align:right; color:#dc2626; font-size:14px;">Rs ${totalLoss.toLocaleString()}</td>
                    </tr>
                    ${recAmount > 0 ? `
                        <tr style="background:#f0fdf4; font-weight:bold; color:#15803d;">
                            <td colspan="3" style="padding:8px; text-align:right;">Recovered from Supplier:</td>
                            <td style="padding:8px; text-align:right;">Rs ${recAmount.toLocaleString()}</td>
                        </tr>
                        <tr style="background:#fff7ed; font-weight:bold; color:#ea580c;">
                            <td colspan="3" style="padding:8px; text-align:right;">Remaining Balance Loss:</td>
                            <td style="padding:8px; text-align:right;">Rs ${remaining.toLocaleString()}</td>
                        </tr>
                    ` : ''}
                </tfoot>
            </table>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:20px; font-size:12px;">
                <b>Current Settlement Status:</b> <span style="font-weight:700; color:#0f172a;">${statusText}</span>
            </div>

            <div style="display:flex; justify-content:space-between; margin-top:35px; padding-top:10px; font-size:12px; border-top:1px dashed #cbd5e1;">
                <div style="text-align:center; width:45%;">
                    <div style="border-top:1px solid #64748b; margin-top:30px; padding-top:4px;">
                        <b>Store Manager Signature</b>
                    </div>
                </div>
                <div style="text-align:center; width:45%;">
                    <div style="border-top:1px solid #64748b; margin-top:30px; padding-top:4px;">
                        <b>Company Representative / Receiver</b>
                    </div>
                </div>
            </div>
        </div>
    `;

    // WhatsApp button setup
    const waBtn = document.getElementById('btnShareClaimWA');
    if (waBtn) {
        waBtn.onclick = function() {
            const text = `*DAMAGE / EXPIRE CLAIM VOUCHER*\nAgency: ${agencyName}\nVoucher #: ${claim.voucherNo}\nProduct: ${claim.itemName}\nQty: ${claim.qty} ${claim.unit || 'pcs'}\nClaim Value: Rs ${totalLoss}\nStatus: ${statusText}\nRemaining Loss: Rs ${remaining}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        };
    }

    const m = document.getElementById('modalClaimVoucher');
    if (m) m.style.display = 'flex';
};

window.closeClaimVoucherModal = function() {
    const m = document.getElementById('modalClaimVoucher');
    if (m) m.style.display = 'none';
};

window.printClaimVoucherDoc = function() {
    const printArea = document.getElementById('claimVoucherPrintArea');
    if (!printArea) return;

    const w = window.open('', '', 'width=700,height=800');
    w.document.write(`
        <html>
        <head>
            <title>Claim Voucher</title>
            <style>
                body { font-family: sans-serif; margin: 20px; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            ${printArea.innerHTML}
        </body>
        </html>
    `);
    w.document.close();
};

window.printClaimsTableReport = function() {
    if (allClaims.length === 0) {
        Swal.fire('Info', 'کوئی کلیم ریکارڈ موجود نہیں ہے۔', 'info');
        return;
    }

    const w = window.open('', '', 'width=900,height=700');
    let rowsHtml = allClaims.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td>${c.voucherNo || ''}</td>
            <td>${c.incidentDate || ''}</td>
            <td><b>${c.itemName}</b></td>
            <td>${c.category || ''}</td>
            <td>${c.qty} ${c.unit || ''}</td>
            <td>Rs ${c.purchaseRate}</td>
            <td><b>Rs ${Math.round(c.totalLoss || 0).toLocaleString()}</b></td>
            <td>Rs ${Math.round(c.recoveredAmount || 0).toLocaleString()}</td>
            <td>Rs ${Math.round(c.remainingLoss || 0).toLocaleString()}</td>
            <td>${c.status}</td>
        </tr>
    `).join('');

    w.document.write(`
        <html>
        <head>
            <title>Damaged & Expired Claims Summary</title>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
                th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
                th { background: #f1f5f9; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <h2>Damaged, Expired & Claims Summary Report</h2>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Voucher #</th>
                        <th>Date</th>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Total Claim</th>
                        <th>Recovered</th>
                        <th>Remaining Loss</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </body>
        </html>
    `);
    w.document.close();
};

window.exportClaimsCSV = function() {
    if (allClaims.length === 0) {
        Swal.fire('Info', 'کوئی کلیم ڈیٹا موجود نہیں ہے۔', 'info');
        return;
    }

    const headers = ['Voucher No', 'Date', 'Expiry Date', 'Product Name', 'Category', 'Quantity', 'Unit', 'Purchase Rate', 'Total Claim Loss', 'Supplier', 'Recovered Amount', 'Remaining Loss', 'Status', 'Notes'];
    const rows = allClaims.map(c => [
        `"${c.voucherNo || ''}"`,
        `"${c.incidentDate || ''}"`,
        `"${c.expiryDate || ''}"`,
        `"${(c.itemName || '').replace(/"/g, '""')}"`,
        `"${c.category || ''}"`,
        c.qty || 0,
        `"${c.unit || ''}"`,
        c.purchaseRate || 0,
        c.totalLoss || 0,
        `"${(c.supplierName || '').replace(/"/g, '""')}"`,
        c.recoveredAmount || 0,
        c.remainingLoss || 0,
        `"${c.status || ''}"`,
        `"${(c.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Damage_Claims_Report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};

