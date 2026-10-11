// ============================================
// 📊 EASY BILL GENERATOR — REPORTS ENGINE (PHASE 7)
// ✅ Sales & Revenue Analytics
// ✅ Best Sellers & Top Moving Products
// ✅ Slow & Dead Moving Stock (Locked Capital)
// ✅ Claims & Customer Returns (واپسی مال)
// ✅ Damaged, Expired & Lost Stock Losses (نقصانات و ضائع مال)
// ✅ Booker / Salesman Performance & Conversion
// ✅ Customer Khata Recovery & Aging
// ✅ Excel/CSV Export & Printable Reports
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
let currentTab = 'sales';
let dateStart = '';
let dateEnd = '';

let rawBills = [];
let rawStock = [];
let rawMovements = [];
let rawCustomers = [];
let rawUsers = [];
let activeTableData = []; // for CSV export and quick search

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
            window.location.href = 'dashboard.html';
            return;
        }
        myUser = doc.data();

        // Role & permission guard
        if (myUser.role === 'booker') {
            const p = myUser.permissions || {};
            if (!p.reports) {
                Swal.fire({
                    icon: 'warning',
                    title: '🔒 Access Denied',
                    text: 'Aap ke paas Reports dekhne ki permission nahi hai!',
                    confirmButtonColor: '#27ae60'
                }).then(() => window.location.href = 'dashboard.html');
                return;
            }
        }

        myAgencyId = myUser.agencyId;
        if (!myAgencyId) {
            if (myUser.role === 'super-admin') {
                myAgencyId = 'super-admin-hq';
            } else {
                window.location.href = 'profile.html';
                return;
            }
        }

        try {
            const agDoc = await db.collection('agencies').doc(myAgencyId).get();
            myAgency = agDoc.exists ? agDoc.data() : {};
            const h = document.getElementById('agencyNameHeader');
            if (h && myAgency.name) h.innerText = `🏢 ${myAgency.name} (${myAgency.city || 'Depot'})`;
        } catch (e) {}

        // Check URL param for initial tab
        const urlParams = new URLSearchParams(window.location.search);
        const reqTab = urlParams.get('tab');
        if (reqTab && ['sales', 'bestsellers', 'slow', 'claims', 'damage', 'bookers', 'khata'].includes(reqTab)) {
            currentTab = reqTab;
        }

        // Setup UI Tabs & Presets
        setupTabs();
        setupDatePresets();

        // Default: This Month
        setDatePreset('thismonth');

        // Fetch Data & Render
        await loadAllReportData();

    } catch (e) {
        console.error('Reports init error:', e);
        Swal.fire('Error', 'Reports loading error: ' + e.message, 'error');
    }
});

// ============================================
// 📑 TAB SWITCHER
// ============================================
function setupTabs() {
    const tabs = document.querySelectorAll('.report-tab-btn');
    tabs.forEach(btn => {
        if (btn.dataset.tab === currentTab) btn.classList.add('active');
        else btn.classList.remove('active');

        btn.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            renderActiveReport();
        });
    });
}

// ============================================
// 📅 DATE PRESETS & RANGE SELECTION
// ============================================
function setupDatePresets() {
    document.querySelectorAll('.date-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.date-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setDatePreset(btn.dataset.preset);
            loadAllReportData();
        });
    });

    document.getElementById('btnApplyDate').addEventListener('click', () => {
        const s = document.getElementById('dateStart').value;
        const e = document.getElementById('dateEnd').value;
        if (!s || !e) {
            Swal.fire('⚠️', 'Start date aur End date select karein!', 'warning');
            return;
        }
        document.querySelectorAll('.date-preset-btn').forEach(b => b.classList.remove('active'));
        dateStart = s;
        dateEnd = e;
        loadAllReportData();
    });
}

function setDatePreset(preset) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
        dateStart = toYMD(now);
        dateEnd = toYMD(now);
    } else if (preset === 'yesterday') {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        dateStart = toYMD(y);
        dateEnd = toYMD(y);
    } else if (preset === 'last7') {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        dateStart = toYMD(d);
        dateEnd = toYMD(now);
    } else if (preset === 'thismonth') {
        const s = new Date(now.getFullYear(), now.getMonth(), 1);
        dateStart = toYMD(s);
        dateEnd = toYMD(now);
    } else if (preset === 'lastmonth') {
        const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const e = new Date(now.getFullYear(), now.getMonth(), 0);
        dateStart = toYMD(s);
        dateEnd = toYMD(e);
    }

    document.getElementById('dateStart').value = dateStart;
    document.getElementById('dateEnd').value = dateEnd;
}

// ============================================
// 📥 FETCH REPORT DATA (QUOTA OPTIMIZED)
// ============================================
async function loadAllReportData() {
    const tableDiv = document.getElementById('tableContainer');
    tableDiv.innerHTML = '<div class="loading-inline">Loading report data...</div>';

    try {
        // Parallel queries (Single equality field — NO composite index needed!)
        const [billsSnap, stockSnap, moveSnap, custSnap, usersSnap] = await Promise.all([
            db.collection('bills').where('agencyId', '==', myAgencyId).get(),
            db.collection('stock').where('agencyId', '==', myAgencyId).get(),
            db.collection('movements').where('agencyId', '==', myAgencyId).get(),
            db.collection('customers').where('agencyId', '==', myAgencyId).get(),
            db.collection('users').where('agencyId', '==', myAgencyId).get()
        ]);

        rawBills = [];
        billsSnap.forEach(d => {
            const b = d.data();
            const bDate = b.date || (b.createdAt || '').slice(0, 10);
            if (bDate >= dateStart && bDate <= dateEnd) {
                rawBills.push({ id: d.id, ...b });
            }
        });

        rawStock = [];
        stockSnap.forEach(d => rawStock.push({ id: d.id, ...d.data() }));

        rawMovements = [];
        moveSnap.forEach(d => {
            const m = d.data();
            const mDate = (m.createdAt || '').slice(0, 10);
            if (mDate >= dateStart && mDate <= dateEnd) {
                rawMovements.push({ id: d.id, ...m });
            }
        });

        rawCustomers = [];
        custSnap.forEach(d => rawCustomers.push({ id: d.id, ...d.data() }));

        rawUsers = [];
        usersSnap.forEach(d => rawUsers.push({ id: d.id, ...d.data() }));

        renderActiveReport();

    } catch (e) {
        console.error('Data fetch error:', e);
        tableDiv.innerHTML = '<div class="error-inline">⚠️ Failed to load report data: ' + e.message + '</div>';
    }
}

// ============================================
// 🔀 RENDER ACTIVE REPORT DISPATCHER
// ============================================
function renderActiveReport() {
    const searchInput = document.getElementById('reportSearchInput');
    if (searchInput) searchInput.value = '';

    if (currentTab === 'sales') renderSalesReport();
    else if (currentTab === 'bestsellers') renderBestSellersReport();
    else if (currentTab === 'slow') renderSlowStockReport();
    else if (currentTab === 'claims') renderClaimsReport();
    else if (currentTab === 'damage') renderDamageReport();
    else if (currentTab === 'bookers') renderBookersReport();
    else if (currentTab === 'khata') renderKhataReport();
}

// ============================================
// 1️⃣ SALES & REVENUE REPORT
// ============================================
function renderSalesReport() {
    document.getElementById('reportTitle').innerHTML = '<i class="fas fa-chart-line"></i> Sales & Revenue Report';
    document.getElementById('reportSubTitle').innerText = `${dateStart} se ${dateEnd} tak ki mukammal sales`;

    let totalSales = 0, totalReceived = 0, totalCredit = 0, totalBills = rawBills.length;
    rawBills.forEach(b => {
        const val = Number(b.billAmount || b.grandTotal || 0);
        const rec = Number(b.received || 0);
        totalSales += val;
        totalReceived += rec;
        totalCredit += Math.max(0, val - rec);
    });

    const avgBill = totalBills > 0 ? (totalSales / totalBills) : 0;

    // Render KPIs
    document.getElementById('kpiGrid').innerHTML = `
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#10b981;">💰</div>
            <div class="kpi-value">Rs ${Math.round(totalSales).toLocaleString()}</div>
            <div class="kpi-label">Total Sales (Rs)</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#0284c7;">💵</div>
            <div class="kpi-value">Rs ${Math.round(totalReceived).toLocaleString()}</div>
            <div class="kpi-label">Cash Collected</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#ef4444;">📊</div>
            <div class="kpi-value">Rs ${Math.round(totalCredit).toLocaleString()}</div>
            <div class="kpi-label">Credit Added (Khata)</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#8b5cf6;">🧾</div>
            <div class="kpi-value">${totalBills}</div>
            <div class="kpi-label">Total Invoices</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#f59e0b;">📈</div>
            <div class="kpi-value">Rs ${Math.round(avgBill).toLocaleString()}</div>
            <div class="kpi-label">Avg Invoice Size</div>
        </div>
    `;

    // Sort bills desc
    const sorted = [...rawBills].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
    activeTableData = sorted.map(b => ({
        date: b.date || '',
        billNo: b.billNo || '',
        customer: b.customerName || 'Counter Sale',
        itemsCount: (b.items || []).length,
        total: Number(b.billAmount || b.grandTotal || 0),
        received: Number(b.received || 0),
        balance: Number(b.balance || 0)
    }));

    renderTable([
        { header: 'Date', key: 'date' },
        { header: 'Invoice #', key: 'billNo', bold: true },
        { header: 'Customer / Shop', key: 'customer' },
        { header: 'Items', key: 'itemsCount', align: 'center' },
        { header: 'Total (Rs)', key: 'total', align: 'right', format: (v) => 'Rs ' + Math.round(v).toLocaleString() },
        { header: 'Cash Paid', key: 'received', align: 'right', format: (v) => 'Rs ' + Math.round(v).toLocaleString(), color: '#16a34a' },
        { header: 'Balance', key: 'balance', align: 'right', format: (v) => 'Rs ' + Math.round(v).toLocaleString(), color: '#dc2626' }
    ]);
}

// ============================================
// 2️⃣ BEST SELLERS REPORT
// ============================================
function renderBestSellersReport() {
    document.getElementById('reportTitle').innerHTML = '<i class="fas fa-trophy"></i> Best Selling Products';
    document.getElementById('reportSubTitle').innerText = 'سب سے زیادہ بکنے والے اور منافع بخش آئٹمز کی درجہ بندی';

    const itemMap = new Map();

    rawBills.forEach(b => {
        (b.items || []).forEach(it => {
            const key = (it.name || '').trim();
            if (!key) return;

            const existing = itemMap.get(key) || {
                name: key,
                unitsSold: 0,
                revenue: 0,
                orderCount: 0,
                stockId: it.stockId
            };

            existing.unitsSold += Number(it.qty || 0);
            existing.revenue += Number(it.total || (it.qty * it.rate) || 0);
            existing.orderCount++;
            itemMap.set(key, existing);
        });
    });

    const list = Array.from(itemMap.values()).sort((a, b) => b.unitsSold - a.unitsSold);

    let totUnits = 0, totRev = 0;
    list.forEach(i => { totUnits += i.unitsSold; totRev += i.revenue; });

    document.getElementById('kpiGrid').innerHTML = `
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#f59e0b;">🏆</div>
            <div class="kpi-value">${list[0] ? list[0].name : '—'}</div>
            <div class="kpi-label">#1 Top Selling Product</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#10b981;">📦</div>
            <div class="kpi-value">${Math.round(totUnits).toLocaleString()}</div>
            <div class="kpi-label">Total Units Sold</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#0284c7;">💰</div>
            <div class="kpi-value">Rs ${Math.round(totRev).toLocaleString()}</div>
            <div class="kpi-label">Top Sellers Revenue</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#8b5cf6;">🏷️</div>
            <div class="kpi-value">${list.length}</div>
            <div class="kpi-label">Unique Products Moving</div>
        </div>
    `;

    activeTableData = list.map((it, idx) => {
        const s = rawStock.find(x => x.name.toLowerCase() === it.name.toLowerCase());
        return {
            rank: `#${idx + 1}`,
            name: it.name,
            category: (s && s.category) ? s.category : 'General',
            unitsSold: it.unitsSold,
            revenue: it.revenue,
            inStock: s ? s.qty : '—'
        };
    });

    renderTable([
        { header: 'Rank', key: 'rank', bold: true },
        { header: 'Product Name', key: 'name', bold: true },
        { header: 'Category', key: 'category' },
        { header: 'Units Sold', key: 'unitsSold', align: 'center', bold: true, color: '#16a34a' },
        { header: 'Revenue Generated', key: 'revenue', align: 'right', format: (v) => 'Rs ' + Math.round(v).toLocaleString() },
        { header: 'Current Stock Left', key: 'inStock', align: 'center' }
    ]);
}

// ============================================
// 3️⃣ SLOW & DEAD MOVING STOCK REPORT
// ============================================
function renderSlowStockReport() {
    document.getElementById('reportTitle').innerHTML = '<i class="fas fa-hourglass-half"></i> Slow & Dead Moving Stock';
    document.getElementById('reportSubTitle').innerText = 'وہ پراڈکٹس جن کی سیلز نہ ہونے کے برابر ہے اور کیپیٹل رکا ہوا ہے';

    const soldMap = new Set();
    rawBills.forEach(b => {
        (b.items || []).forEach(it => {
            if (it.name) soldMap.add(it.name.trim().toLowerCase());
        });
    });

    // Items with zero sales
    const deadItems = rawStock.filter(s => !soldMap.has((s.name || '').trim().toLowerCase()));

    let lockedCapital = 0;
    deadItems.forEach(i => {
        lockedCapital += (Number(i.qty || 0) * Number(i.purchaseRate || 0));
    });

    document.getElementById('kpiGrid').innerHTML = `
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#ef4444;">🐢</div>
            <div class="kpi-value">${deadItems.length}</div>
            <div class="kpi-label">Zero-Sales Products</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#f59e0b;">🔒</div>
            <div class="kpi-value">Rs ${Math.round(lockedCapital).toLocaleString()}</div>
            <div class="kpi-label">Capital Trapped in Dead Stock</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#64748b;">📦</div>
            <div class="kpi-value">${deadItems.reduce((acc, i) => acc + (Number(i.qty) || 0), 0)}</div>
            <div class="kpi-label">Total Idle Units</div>
        </div>
    `;

    activeTableData = deadItems.map(i => ({
        name: i.name,
        category: i.category || 'General',
        qty: i.qty || 0,
        unit: i.unit || 'Unit',
        cost: i.purchaseRate || 0,
        trappedCost: (i.qty || 0) * (i.purchaseRate || 0)
    }));

    renderTable([
        { header: 'Product Name', key: 'name', bold: true },
        { header: 'Category', key: 'category' },
        { header: 'Stock in Hand', key: 'qty', align: 'center', bold: true },
        { header: 'Unit', key: 'unit' },
        { header: 'Cost Price', key: 'cost', align: 'right', format: (v) => 'Rs ' + Math.round(v).toLocaleString() },
        { header: 'Capital Trapped', key: 'trappedCost', align: 'right', bold: true, color: '#dc2626', format: (v) => 'Rs ' + Math.round(v).toLocaleString() }
    ]);
}

// ============================================
// 4️⃣ CLAIMS & CUSTOMER RETURNS REPORT
// ============================================
function renderClaimsReport() {
    document.getElementById('reportTitle').innerHTML = '<i class="fas fa-rotate-left"></i> Claims & Customer Returns ' +
        '<a href="delivery-returns.html?tab=claims" class="btn btn-sm" style="background:#dc2626; color:#fff; font-size:11px; padding:4px 10px; border-radius:6px; text-decoration:none; margin-left:10px; vertical-align:middle;"><i class="fas fa-hand-holding-dollar"></i> اوپن کلیم ریکوری پورٹل →</a>';
    document.getElementById('reportSubTitle').innerText = 'گاہکوں کی طرف سے واپس آیا ہوا مال، ڈسٹری بیوشن کلائمز اور وجوہات';

    const returns = rawMovements.filter(m => m.reason === 'return' || m.reasonLabel?.toLowerCase().includes('return'));

    let totalReturnedUnits = 0;
    returns.forEach(r => { totalReturnedUnits += Number(r.qty || 0); });

    document.getElementById('kpiGrid').innerHTML = `
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#f59e0b;">↩️</div>
            <div class="kpi-value">${returns.length}</div>
            <div class="kpi-label">Return Claim Events</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#0284c7;">📦</div>
            <div class="kpi-value">${Math.round(totalReturnedUnits)}</div>
            <div class="kpi-label">Total Units Returned</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#10b981;">📅</div>
            <div class="kpi-value">${dateStart} to ${dateEnd}</div>
            <div class="kpi-label">Report Period</div>
        </div>
    `;

    activeTableData = returns.map(r => ({
        date: (r.createdAt || '').slice(0, 10),
        name: r.itemName || 'Item',
        qty: r.qty || 0,
        reason: r.reasonLabel || r.reason || 'Customer Return',
        note: r.note || 'No notes'
    }));

    renderTable([
        { header: 'Date', key: 'date' },
        { header: 'Product Name', key: 'name', bold: true },
        { header: 'Returned Qty', key: 'qty', align: 'center', bold: true, color: '#d97706' },
        { header: 'Claim / Reason', key: 'reason', badge: 'badge-return' },
        { header: 'Remarks / Invoice #', key: 'note' }
    ]);
}

// ============================================
// 5️⃣ DAMAGED, EXPIRED & LOST STOCK REPORT
// ============================================
function renderDamageReport() {
    document.getElementById('reportTitle').innerHTML = '<i class="fas fa-triangle-exclamation"></i> Damaged, Expired & Lost Losses ' +
        '<a href="delivery-returns.html?tab=claims" class="btn btn-sm" style="background:#dc2626; color:#fff; font-size:11px; padding:4px 10px; border-radius:6px; text-decoration:none; margin-left:10px; vertical-align:middle;"><i class="fas fa-hand-holding-dollar"></i> اوپن کلیم ریکوری پورٹل →</a>';
    document.getElementById('reportSubTitle').innerText = 'ٹوٹ پھوٹ، خراب، تاریخ ختم اور گم شدہ مال کی تفصیلی رپورٹ';

    const losses = rawMovements.filter(m => ['damage', 'expired', 'lost'].includes(m.reason));

    let damagedUnits = 0, expiredUnits = 0, lostUnits = 0, estLossCost = 0;

    losses.forEach(l => {
        const q = Number(l.qty || 0);
        if (l.reason === 'damage') damagedUnits += q;
        else if (l.reason === 'expired') expiredUnits += q;
        else if (l.reason === 'lost') lostUnits += q;

        // Find cost rate
        const s = rawStock.find(x => x.name.toLowerCase() === (l.itemName || '').toLowerCase());
        const cost = s ? Number(s.purchaseRate || 0) : 0;
        estLossCost += (q * cost);
    });

    document.getElementById('kpiGrid').innerHTML = `
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#ef4444;">💥</div>
            <div class="kpi-value">${damagedUnits}</div>
            <div class="kpi-label">Damaged / Broken Units</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#f59e0b;">⏰</div>
            <div class="kpi-value">${expiredUnits}</div>
            <div class="kpi-label">Expired Stock Units</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#64748b;">❓</div>
            <div class="kpi-value">${lostUnits}</div>
            <div class="kpi-label">Lost / Missing Units</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#b91c1c;">💸</div>
            <div class="kpi-value" style="color:#b91c1c;">Rs ${Math.round(estLossCost).toLocaleString()}</div>
            <div class="kpi-label">Total Financial Loss (At Cost)</div>
        </div>
    `;

    activeTableData = losses.map(l => {
        const s = rawStock.find(x => x.name.toLowerCase() === (l.itemName || '').toLowerCase());
        const cost = s ? Number(s.purchaseRate || 0) : 0;
        return {
            date: (l.createdAt || '').slice(0, 10),
            name: l.itemName || 'Product',
            type: l.reason.toUpperCase(),
            qty: l.qty || 0,
            lossAmount: (l.qty || 0) * cost,
            note: l.note || '—'
        };
    });

    renderTable([
        { header: 'Date', key: 'date' },
        { header: 'Product Name', key: 'name', bold: true },
        { header: 'Loss Type', key: 'type', badge: 'badge-loss' },
        { header: 'Quantity Lost', key: 'qty', align: 'center', bold: true, color: '#dc2626' },
        { header: 'Est. Loss Amount', key: 'lossAmount', align: 'right', format: (v) => 'Rs ' + Math.round(v).toLocaleString() },
        { header: 'Reason / Remarks', key: 'note' }
    ]);
}

// ============================================
// 6️⃣ BOOKER / SALESMAN PERFORMANCE REPORT
// ============================================
function renderBookersReport() {
    document.getElementById('reportTitle').innerHTML = '<i class="fas fa-users-gear"></i> Booker Performance & Orders';
    document.getElementById('reportSubTitle').innerText = 'آرڈر بکیشنل سیلز مینز کی کارکردگی، بلز کی تعداد اور کیش وصولی';

    const bookerMap = new Map();

    rawBills.forEach(b => {
        const uid = b.createdBy || 'Unknown';
        const userObj = rawUsers.find(u => u.id === uid) || { name: b.bookerName || 'Salesman' };
        const bName = userObj.name || uid;

        const cur = bookerMap.get(uid) || {
            name: bName,
            ordersCount: 0,
            salesVolume: 0,
            cashCollected: 0
        };

        cur.ordersCount++;
        cur.salesVolume += Number(b.billAmount || b.grandTotal || 0);
        cur.cashCollected += Number(b.received || 0);
        bookerMap.set(uid, cur);
    });

    const list = Array.from(bookerMap.values()).sort((a, b) => b.salesVolume - a.salesVolume);

    let totSales = 0, totOrders = 0;
    list.forEach(i => { totSales += i.salesVolume; totOrders += i.ordersCount; });

    document.getElementById('kpiGrid').innerHTML = `
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#3b82f6;">👥</div>
            <div class="kpi-value">${list.length}</div>
            <div class="kpi-label">Active Field Bookers</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#10b981;">💰</div>
            <div class="kpi-value">Rs ${Math.round(totSales).toLocaleString()}</div>
            <div class="kpi-label">Total Bookers Sales</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#8b5cf6;">🧾</div>
            <div class="kpi-value">${totOrders}</div>
            <div class="kpi-label">Total Orders Booked</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#f59e0b;">🏆</div>
            <div class="kpi-value">${list[0] ? list[0].name : '—'}</div>
            <div class="kpi-label">Top Performer Salesman</div>
        </div>
    `;

    activeTableData = list.map(b => ({
        name: b.name,
        orders: b.ordersCount,
        sales: b.salesVolume,
        cash: b.cashCollected,
        balance: b.salesVolume - b.cashCollected
    }));

    renderTable([
        { header: 'Booker Name', key: 'name', bold: true },
        { header: 'Orders Booked', key: 'orders', align: 'center', bold: true },
        { header: 'Total Sales (Rs)', key: 'sales', align: 'right', format: (v) => 'Rs ' + Math.round(v).toLocaleString() },
        { header: 'Cash Collected', key: 'cash', align: 'right', format: (v) => 'Rs ' + Math.round(v).toLocaleString(), color: '#16a34a' },
        { header: 'Pending Collection', key: 'balance', align: 'right', format: (v) => 'Rs ' + Math.round(v).toLocaleString(), color: '#dc2626' }
    ]);
}

// ============================================
// 7️⃣ CUSTOMER KHATA AGING & RECOVERY REPORT
// ============================================
function renderKhataReport() {
    document.getElementById('reportTitle').innerHTML = '<i class="fas fa-hand-holding-dollar"></i> Customer Khata Recovery & Aging';
    document.getElementById('reportSubTitle').innerText = 'ادھار بقایا جات کی ترجیحی فہرست برائے فوری ریکوری';

    const debtors = rawCustomers
        .filter(c => Number(c.balance || 0) > 0)
        .sort((a, b) => Number(b.balance) - Number(a.balance));

    let totalPending = 0;
    debtors.forEach(c => totalPending += Number(c.balance || 0));

    document.getElementById('kpiGrid').innerHTML = `
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#ef4444;">💸</div>
            <div class="kpi-value" style="color:#ef4444;">Rs ${Math.round(totalPending).toLocaleString()}</div>
            <div class="kpi-label">Total Outstanding Market Khata</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#f59e0b;">🏬</div>
            <div class="kpi-value">${debtors.length}</div>
            <div class="kpi-label">Shops With Pending Balance</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon" style="background:#0284c7;">🔝</div>
            <div class="kpi-value">${debtors[0] ? debtors[0].name : '—'}</div>
            <div class="kpi-label">Highest Outstanding Balance</div>
        </div>
    `;

    activeTableData = debtors.map(c => ({
        name: c.name,
        shop: c.shopName || '—',
        route: c.route || 'General Route',
        mobile: c.mobile || '—',
        balance: Number(c.balance || 0)
    }));

    renderTable([
        { header: 'Customer Name', key: 'name', bold: true },
        { header: 'Shop / Business', key: 'shop' },
        { header: 'Route / Area', key: 'route' },
        { header: 'Mobile #', key: 'mobile' },
        { header: 'Outstanding Khata (Rs)', key: 'balance', align: 'right', bold: true, color: '#dc2626', format: (v) => 'Rs ' + Math.round(v).toLocaleString() }
    ]);
}

// ============================================
// 🎨 UNIVERSAL TABLE RENDERER
// ============================================
function renderTable(columns) {
    const container = document.getElementById('tableContainer');
    if (!activeTableData || activeTableData.length === 0) {
        container.innerHTML = '<div class="empty-state">No records found for this period.</div>';
        return;
    }

    let thHtml = columns.map(c => `<th class="${c.align === 'right' ? 'text-right' : ''}">${c.header}</th>`).join('');

    let trHtml = activeTableData.map(row => {
        let tds = columns.map(col => {
            let val = row[col.key];
            if (col.format) val = col.format(val);
            let style = '';
            if (col.color) style += `color:${col.color};`;
            if (col.bold) style += `font-weight:bold;`;
            let cls = col.align === 'right' ? 'text-right' : (col.align === 'center' ? 'text-center' : '');

            if (col.badge) {
                return `<td class="${cls}"><span class="${col.badge}">${val}</span></td>`;
            }
            return `<td class="${cls}" style="${style}">${val !== undefined ? val : '—'}</td>`;
        }).join('');
        return `<tr>${tds}</tr>`;
    }).join('');

    container.innerHTML = `
        <table class="report-table" id="activeReportTable">
            <thead><tr>${thHtml}</tr></thead>
            <tbody>${trHtml}</tbody>
        </table>
    `;
}

// Quick Search within table results
document.getElementById('reportSearchInput').addEventListener('input', function() {
    const q = this.value.toLowerCase().trim();
    const rows = document.querySelectorAll('#activeReportTable tbody tr');
    rows.forEach(r => {
        const text = r.innerText.toLowerCase();
        r.style.display = text.includes(q) ? '' : 'none';
    });
});

// ============================================
// 📑 EXPORT CSV (EXCEL READY)
// ============================================
document.getElementById('btnExportCSV').addEventListener('click', () => {
    if (!activeTableData || activeTableData.length === 0) {
        Swal.fire('ℹ️', 'Export karne ke liye koi data nahi hai!', 'info');
        return;
    }

    const keys = Object.keys(activeTableData[0]);
    let csv = keys.map(k => `"${k.toUpperCase()}"`).join(',') + '\n';

    activeTableData.forEach(row => {
        const line = keys.map(k => {
            const v = row[k] !== undefined ? String(row[k]).replace(/"/g, '""') : '';
            return `"${v}"`;
        }).join(',');
        csv += line + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Report_${currentTab.toUpperCase()}_${dateStart}_to_${dateEnd}.csv`;
    a.click();
    URL.revokeObjectURL(a);
});

// ============================================
// 🖨️ PRINT REPORT
// ============================================
document.getElementById('btnPrintReport').addEventListener('click', () => {
    window.print();
});

    const rLogout = document.getElementById('logoutBtn');
    if (rLogout) {
        rLogout.addEventListener('click', async () => {
            const res = await Swal.fire({ title: 'Logout?', icon: 'question', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes, Logout' });
            if (res.isConfirmed) {
                await auth.signOut();
                window.location.href = 'auth.html';
            }
        });
    }
