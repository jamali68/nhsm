// ==========================================================================
// 💸 EASY BILL GENERATOR — BUSINESS EXPENSES MANAGER
// 🇵🇰 Daily, Weekly, Monthly, Category-wise & Custom Range Expense Analytics
// ⚡ Real-Time Firebase Sync with Local Offline Quota Caching
// ==========================================================================

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

// Global App State
let myUid = null;
let myUser = null;
let myAgencyId = null;
let myAgency = null;

let currentView = 'all'; // 'all' | 'category' | 'day' | 'weekly' | 'monthly'
let dateStart = '';
let dateEnd = '';
let currentSearch = '';
let filterCategory = 'all';
let filterPayMode = 'all';
let currentSort = 'date_desc';

let rawExpenses = [];
let expenseCategories = [];
let activeTableData = [];

// ==========================================================================
// 🏷️ STANDARD DEFAULT EXPENSE CATEGORIES (Requested by User)
// ==========================================================================
const DEFAULT_CATEGORIES = [
    { id: 'cat_electricity', name: 'Electricity Bills', urdu: 'بجلی کا بل', icon: 'fa-bolt', color: '#eab308', isDefault: true },
    { id: 'cat_water', name: 'Water Bill', urdu: 'پانی کا بل', icon: 'fa-faucet-drip', color: '#06b6d4', isDefault: true },
    { id: 'cat_fuel', name: 'Fuel Bill', urdu: 'فیول / پٹرول خرچ', icon: 'fa-gas-pump', color: '#f97316', isDefault: true },
    { id: 'cat_guests', name: 'Guests Bill', urdu: 'مہمان نوازی / چائے پانی', icon: 'fa-mug-hot', color: '#8b5cf6', isDefault: true },
    { id: 'cat_rent', name: 'Shop / Warehouse Rent', urdu: 'دکان / گودام کرایہ', icon: 'fa-building', color: '#3b82f6', isDefault: true },
    { id: 'cat_salary', name: 'Staff Salaries & Wages', urdu: 'ملازمین تنخواہ و دیہاڑی', icon: 'fa-user-tie', color: '#10b981', isDefault: true },
    { id: 'cat_packaging', name: 'Packaging & Supplies', urdu: 'پیکنگ و ضروری سامان', icon: 'fa-box-archive', color: '#6366f1', isDefault: true },
    { id: 'cat_maintenance', name: 'Maintenance & Repairs', urdu: 'مرمت و دیکھ بھال', icon: 'fa-screwdriver-wrench', color: '#ec4899', isDefault: true },
    { id: 'cat_transport', name: 'Transport & Carriage', urdu: 'کرایہ مال / ٹرانسپورٹ', icon: 'fa-truck', color: '#14b8a6', isDefault: true },
    { id: 'cat_internet', name: 'Internet & Phone Bills', urdu: 'انٹرنیٹ و موبائل خرچ', icon: 'fa-wifi', color: '#0284c7', isDefault: true },
    { id: 'cat_misc', name: 'Other Miscellaneous', urdu: 'متفرق اخراجات', icon: 'fa-receipt', color: '#64748b', isDefault: true }
];

// ==========================================================================
// 🛡️ AUTH GUARD & INITIALIZATION
// ==========================================================================
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

        // Check Permissions for staff
        if (myUser.role === 'booker') {
            const p = myUser.permissions || {};
            if (!p.expenses && !p.reports) {
                Swal.fire({
                    icon: 'warning',
                    title: '🔒 Access Restricted',
                    text: 'Aap ke paas Expenses module dekhne ki ijazat nahi hai!',
                    confirmButtonColor: '#ef4444'
                }).then(() => window.location.href = 'dashboard.html');
                return;
            }
        }

        myAgencyId = myUser.agencyId || localStorage.getItem('eb_active_agencyId');
        if (myAgencyId) {
            localStorage.setItem('eb_active_agencyId', myAgencyId);
        }

        if (!myAgencyId) {
            if (myUser.role === 'super-admin') {
                myAgencyId = 'super-admin-hq';
            } else {
                window.location.href = 'profile.html';
                return;
            }
        }

        // Fetch agency doc
        try {
            const agDoc = await db.collection('agencies').doc(myAgencyId).get();
            myAgency = agDoc.exists ? agDoc.data() : {};
        } catch (e) {
            myAgency = {};
        }

        // Apply default preset: This Month
        applyPreset('thismonth');

        // Setup DOM event listeners
        setupEventListeners();

        // Load Categories and Expenses
        await loadCategories();
        await loadExpenses();

        if (window.hideNHLoader) {
            window.hideNHLoader();
        }

    } catch (e) {
        console.error('Expenses init error:', e);
        if (window.hideNHLoader) window.hideNHLoader();
        const container = document.getElementById('expenseTableContainer');
        if (container) {
            container.innerHTML = `<div class="empty-state" style="color:#ef4444;"><i class="fas fa-triangle-exclamation"></i> Error loading expenses: ${e.message}</div>`;
        }
    }
});

// ==========================================================================
// 📂 1. CATEGORY MANAGEMENT
// ==========================================================================
async function loadCategories() {
    expenseCategories = [...DEFAULT_CATEGORIES];

    try {
        // Fetch custom agency categories
        const snap = await db.collection('expense_categories')
            .where('agencyId', '==', myAgencyId)
            .get();

        const customCats = [];
        snap.forEach(d => {
            const data = d.data();
            data.id = d.id;
            customCats.push(data);
        });

        // Merge custom categories
        if (customCats.length > 0) {
            expenseCategories = [...DEFAULT_CATEGORIES, ...customCats];
        }

        // Save local cache
        localStorage.setItem(`eb_expense_cats_${myAgencyId}`, JSON.stringify(expenseCategories));
    } catch (e) {
        console.warn('Could not load custom categories from cloud, loading cached:', e);
        try {
            const cached = localStorage.getItem(`eb_expense_cats_${myAgencyId}`);
            if (cached) expenseCategories = JSON.parse(cached);
        } catch (err) {}
    }

    populateCategoryDropdowns();
    renderCategoryManagerList();
}

function populateCategoryDropdowns() {
    const select = document.getElementById('expCategorySelect');
    const filterSelect = document.getElementById('expenseFilterCategory');

    if (select) {
        select.innerHTML = expenseCategories.map(c => `
            <option value="${c.id}" data-name="${c.name}">
                ${c.name} ${c.urdu ? '(' + c.urdu + ')' : ''}
            </option>
        `).join('');
    }

    if (filterSelect) {
        const currentVal = filterSelect.value || 'all';
        filterSelect.innerHTML = `
            <option value="all">All Categories (تمام کیٹیگریز)</option>
            ${expenseCategories.map(c => `
                <option value="${c.id}">${c.name}</option>
            `).join('')}
        `;
        filterSelect.value = currentVal;
    }
}

function renderCategoryManagerList() {
    const container = document.getElementById('catListContainer');
    if (!container) return;

    if (expenseCategories.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8; font-size:12px;">No categories available.</p>';
        return;
    }

    container.innerHTML = expenseCategories.map(c => {
        const isDef = !!c.isDefault;
        return `
            <div class="cat-chip">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:6px; background:${c.color || '#64748b'}; color:#fff; font-size:12px;">
                        <i class="fas ${c.icon || 'fa-receipt'}"></i>
                    </span>
                    <div>
                        <div style="font-weight:700; color:#1e293b;">${c.name}</div>
                        ${c.urdu ? `<div style="font-size:11px; color:#64748b;">${c.urdu}</div>` : ''}
                    </div>
                </div>

                <div>
                    ${isDef ? `
                        <span style="font-size:10px; background:#e2e8f0; color:#475569; padding:2px 8px; border-radius:10px; font-weight:700;">
                            Default
                        </span>
                    ` : `
                        <button type="button" class="btn btn-sm" onclick="deleteCategory('${c.id}')" style="background:#fee2e2; color:#b91c1c; border:none; padding:3px 8px; border-radius:6px; font-size:11px; cursor:pointer;" title="Delete Custom Category">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

async function handleAddCategory(e) {
    e.preventDefault();
    const name = document.getElementById('newCatName').value.trim();
    const urdu = document.getElementById('newCatUrdu').value.trim();
    const icon = document.getElementById('newCatIcon').value;
    const color = document.getElementById('newCatColor').value;

    if (!name) {
        Swal.fire('Required', 'Please enter a category name.', 'warning');
        return;
    }

    // Check duplicate
    if (expenseCategories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        Swal.fire('Duplicate', 'This category already exists.', 'info');
        return;
    }

    const saveBtn = document.getElementById('btnSaveCategory');
    if (saveBtn) saveBtn.disabled = true;

    try {
        const newCatDoc = {
            agencyId: myAgencyId,
            name: name,
            urdu: urdu || '',
            icon: icon || 'fa-receipt',
            color: color || '#3b82f6',
            createdBy: myUid,
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection('expense_categories').add(newCatDoc);
        newCatDoc.id = docRef.id;

        expenseCategories.push(newCatDoc);
        localStorage.setItem(`eb_expense_cats_${myAgencyId}`, JSON.stringify(expenseCategories));

        populateCategoryDropdowns();
        renderCategoryManagerList();

        document.getElementById('formNewCat').reset();

        // Auto select in expense modal
        const expSelect = document.getElementById('expCategorySelect');
        if (expSelect) expSelect.value = docRef.id;

        Swal.fire({
            icon: 'success',
            title: 'Category Created!',
            text: `Category "${name}" successfully added.`,
            timer: 1500,
            showConfirmButton: false
        });

    } catch (err) {
        console.error('Add category error:', err);
        Swal.fire('Error', 'Failed to save category: ' + err.message, 'error');
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

window.deleteCategory = async function(catId) {
    const cat = expenseCategories.find(c => c.id === catId);
    if (!cat || cat.isDefault) return;

    const res = await Swal.fire({
        title: `Delete "${cat.name}"?`,
        text: 'This will remove the category from your list.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Yes, Delete'
    });

    if (res.isConfirmed) {
        try {
            await db.collection('expense_categories').doc(catId).delete();
            expenseCategories = expenseCategories.filter(c => c.id !== catId);
            localStorage.setItem(`eb_expense_cats_${myAgencyId}`, JSON.stringify(expenseCategories));
            populateCategoryDropdowns();
            renderCategoryManagerList();
            Swal.fire('Deleted!', 'Category removed.', 'success');
        } catch (e) {
            Swal.fire('Error', 'Failed to delete: ' + e.message, 'error');
        }
    }
};

// ==========================================================================
// 📥 2. LOAD EXPENSES
// ==========================================================================
async function loadExpenses() {
    const container = document.getElementById('expenseTableContainer');
    if (container) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:#94a3b8;">
                <i class="fas fa-spinner fa-spin" style="font-size:24px;"></i>
                <p style="margin-top:10px;">Loading expenses for ${dateStart} to ${dateEnd}...</p>
            </div>
        `;
    }

    try {
        let snap;
        if (dateStart && dateEnd) {
            snap = await db.collection('expenses')
                .where('agencyId', '==', myAgencyId)
                .where('date', '>=', dateStart)
                .where('date', '<=', dateEnd)
                .get();
        } else {
            snap = await db.collection('expenses')
                .where('agencyId', '==', myAgencyId)
                .get();
        }

        rawExpenses = [];
        snap.forEach(d => {
            const data = d.data();
            data.id = d.id;
            rawExpenses.push(data);
        });

        // Cache loaded expenses locally
        localStorage.setItem(`eb_expenses_${myAgencyId}`, JSON.stringify(rawExpenses));

    } catch (e) {
        console.warn('Expense fetch error, reading cached:', e);
        try {
            const cached = localStorage.getItem(`eb_expenses_${myAgencyId}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                rawExpenses = parsed.filter(item => {
                    const d = item.date || '';
                    if (dateStart && dateEnd) return d >= dateStart && d <= dateEnd;
                    return true;
                });
            }
        } catch (err) {}
    }

    renderExpenseDashboard();
}

// ==========================================================================
// 📊 3. RENDER EXPENSES DASHBOARD & METRICS
// ==========================================================================
function renderExpenseDashboard() {
    // 1. Calculate KPI Summary
    calculateAndRenderKPIs();

    // 2. Render current view table
    renderCurrentViewTable();
}

function calculateAndRenderKPIs() {
    const totalExp = rawExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const count = rawExpenses.length;

    // Today's expenses
    const todayStr = getPktToday();
    const todayExps = rawExpenses.filter(e => (e.date || '').slice(0, 10) === todayStr);
    const todayTotal = todayExps.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // This month's expenses
    const currentMonthPrefix = todayStr.slice(0, 7); // 'YYYY-MM'
    const monthExps = rawExpenses.filter(e => (e.date || '').slice(0, 7) === currentMonthPrefix);
    const monthTotal = monthExps.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Top Expense Category
    const catTotals = {};
    rawExpenses.forEach(e => {
        const cId = e.categoryId || e.category || 'cat_misc';
        catTotals[cId] = (catTotals[cId] || 0) + (Number(e.amount) || 0);
    });

    let topCatId = '--';
    let topCatAmount = 0;
    Object.keys(catTotals).forEach(cId => {
        if (catTotals[cId] > topCatAmount) {
            topCatAmount = catTotals[cId];
            topCatId = cId;
        }
    });

    const topCatObj = expenseCategories.find(c => c.id === topCatId || c.name === topCatId);
    const topCatName = topCatObj ? topCatObj.name : (topCatAmount > 0 ? topCatId : 'None');
    const topCatPct = totalExp > 0 ? ((topCatAmount / totalExp) * 100).toFixed(1) : '0';

    // Average per voucher
    const avgExpense = count > 0 ? Math.round(totalExp / count) : 0;

    // Update DOM
    const elTotal = document.getElementById('kpiTotalExpenses');
    const elCount = document.getElementById('kpiExpenseCount');
    const elToday = document.getElementById('kpiTodayExpenses');
    const elTodayCount = document.getElementById('kpiTodayCount');
    const elMonth = document.getElementById('kpiMonthExpenses');
    const elTopCat = document.getElementById('kpiTopCategory');
    const elTopCatAmt = document.getElementById('kpiTopCategoryAmount');
    const elAvg = document.getElementById('kpiAvgExpense');
    const elActiveCats = document.getElementById('kpiActiveCategories');

    if (elTotal) elTotal.innerText = `Rs ${totalExp.toLocaleString()}`;
    if (elCount) elCount.innerText = `${count} Vouchers (${dateStart} to ${dateEnd})`;
    if (elToday) elToday.innerText = `Rs ${todayTotal.toLocaleString()}`;
    if (elTodayCount) elTodayCount.innerText = `${todayExps.length} Vouchers Today`;
    if (elMonth) elMonth.innerText = `Rs ${monthTotal.toLocaleString()}`;
    if (elTopCat) elTopCat.innerText = topCatName;
    if (elTopCatAmt) elTopCatAmt.innerText = `Rs ${topCatAmount.toLocaleString()} (${topCatPct}% of Total)`;
    if (elAvg) elAvg.innerText = `Rs ${avgExpense.toLocaleString()}`;
    if (elActiveCats) elActiveCats.innerText = `${Object.keys(catTotals).length} Categories Active`;
}

// ==========================================================================
// 📑 4. RENDER CURRENT VIEW TABLES
// ==========================================================================
function renderCurrentViewTable() {
    const container = document.getElementById('expenseTableContainer');
    if (!container) return;

    // Filter Raw Expenses by Search, Category Filter, and Payment Mode Filter
    let filtered = rawExpenses.filter(e => {
        // Category Filter
        if (filterCategory !== 'all') {
            if (e.categoryId !== filterCategory && e.category !== filterCategory) return false;
        }
        // Payment Mode Filter
        if (filterPayMode !== 'all') {
            if ((e.paymentMethod || 'cash').toLowerCase() !== filterPayMode.toLowerCase()) return false;
        }
        // Search Filter
        if (currentSearch) {
            const q = currentSearch.toLowerCase();
            const titleMatch = (e.title || e.description || '').toLowerCase().includes(q);
            const vendorMatch = (e.paidTo || '').toLowerCase().includes(q);
            const receiptMatch = (e.receiptNo || e.voucherNo || '').toLowerCase().includes(q);
            const catObj = expenseCategories.find(c => c.id === e.categoryId || c.name === e.category);
            const catMatch = catObj && catObj.name.toLowerCase().includes(q);
            if (!titleMatch && !vendorMatch && !receiptMatch && !catMatch) return false;
        }
        return true;
    });

    // Sort Filtered
    filtered.sort((a, b) => {
        if (currentSort === 'date_desc') return (b.date || '').localeCompare(a.date || '');
        if (currentSort === 'date_asc') return (a.date || '').localeCompare(b.date || '');
        if (currentSort === 'amount_desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
        if (currentSort === 'amount_asc') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
        if (currentSort === 'category_asc') return (a.category || '').localeCompare(b.category || '');
        return 0;
    });

    if (currentView === 'all') {
        renderAllExpensesTable(filtered, container);
    } else if (currentView === 'category') {
        renderCategoryBreakdownTable(filtered, container);
    } else if (currentView === 'day') {
        renderDayBreakdownTable(filtered, container);
    } else if (currentView === 'weekly') {
        renderWeeklyBreakdownTable(filtered, container);
    } else if (currentView === 'monthly') {
        renderMonthlyBreakdownTable(filtered, container);
    }
}

// --------------------------------------------------------------------------
// View 1: All Expenses Vouchers
// --------------------------------------------------------------------------
function renderAllExpensesTable(items, container) {
    activeTableData = items;

    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-wallet" style="font-size:36px; color:#cbd5e1; margin-bottom:12px;"></i>
                <h3>No Expenses Recorded</h3>
                <p>No expense vouchers found for the selected date range and filters.</p>
                <button type="button" class="btn btn-sm" onclick="openExpenseModal()" style="background:#ef4444; color:#fff; margin-top:10px;">
                    <i class="fas fa-plus"></i> Record First Expense
                </button>
            </div>
        `;
        return;
    }

    const totalAmt = items.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const rows = items.map((e, idx) => {
        const cat = expenseCategories.find(c => c.id === e.categoryId || c.name === e.category) || {
            name: e.category || 'General',
            icon: 'fa-receipt',
            color: '#64748b'
        };

        const payBadge = getPaymentBadge(e.paymentMethod || 'cash');

        return `
            <tr>
                <td style="font-size:12px; font-weight:700; color:#475569;">${idx + 1}</td>
                <td style="font-size:12px; font-weight:700; color:#0f172a; white-space:nowrap;">
                    ${e.date || '--'}
                    ${e.time ? `<br><small style="color:#94a3b8; font-size:10px;">${e.time}</small>` : ''}
                </td>
                <td style="font-size:12px; font-family:monospace; font-weight:700; color:#0284c7;">
                    ${e.voucherNo || e.receiptNo || 'EXP-' + e.id.slice(-5)}
                </td>
                <td>
                    <span class="expense-cat-badge" style="background:${cat.color}15; color:${cat.color}; border:1px solid ${cat.color}35;">
                        <i class="fas ${cat.icon}"></i> ${cat.name}
                    </span>
                </td>
                <td>
                    <div style="font-weight:700; color:#1e293b; font-size:13px;">${e.title || e.description || '--'}</div>
                    ${e.notes ? `<small style="color:#64748b; font-size:11px;">${e.notes}</small>` : ''}
                </td>
                <td style="font-size:12px; color:#475569;">
                    ${e.paidTo || '<span style="color:#94a3b8;">--</span>'}
                </td>
                <td>${payBadge}</td>
                <td style="text-align:right; font-weight:900; font-size:14px; color:#b91c1c; white-space:nowrap;">
                    Rs ${(Number(e.amount) || 0).toLocaleString()}
                </td>
                <td style="text-align:center; white-space:nowrap;">
                    <button class="btn btn-sm" onclick="editExpense('${e.id}')" style="background:#f1f5f9; color:#0284c7; padding:4px 8px; border-radius:6px;" title="Edit Expense">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm" onclick="printSingleVoucher('${e.id}')" style="background:#f1f5f9; color:#475569; padding:4px 8px; border-radius:6px; margin:0 2px;" title="Print Voucher">
                        <i class="fas fa-print"></i>
                    </button>
                    <button class="btn btn-sm" onclick="deleteExpense('${e.id}')" style="background:#fee2e2; color:#ef4444; padding:4px 8px; border-radius:6px;" title="Delete Expense">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <table class="report-table">
            <thead>
                <tr>
                    <th style="width:40px;">#</th>
                    <th>Date</th>
                    <th>Voucher #</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Paid To / Vendor</th>
                    <th>Payment Mode</th>
                    <th style="text-align:right;">Amount (Rs.)</th>
                    <th style="text-align:center; width:110px;">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
            <tfoot>
                <tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #cbd5e1;">
                    <td colspan="7" style="text-align:right; font-size:13px; color:#1e293b;">
                        TOTAL EXPENSES (${items.length} Entries):
                    </td>
                    <td style="text-align:right; font-size:15px; color:#b91c1c; font-weight:900;">
                        Rs ${totalAmt.toLocaleString()}
                    </td>
                    <td></td>
                </tr>
            </tfoot>
        </table>
    `;
}

// --------------------------------------------------------------------------
// View 2: Category-wise Breakdown
// --------------------------------------------------------------------------
function renderCategoryBreakdownTable(items, container) {
    const totalExp = items.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const catMap = {};

    items.forEach(e => {
        const cId = e.categoryId || e.category || 'cat_misc';
        if (!catMap[cId]) {
            catMap[cId] = {
                id: cId,
                amount: 0,
                count: 0
            };
        }
        catMap[cId].amount += (Number(e.amount) || 0);
        catMap[cId].count += 1;
    });

    const list = Object.values(catMap);
    list.sort((a, b) => b.amount - a.amount);
    activeTableData = list;

    if (list.length === 0) {
        container.innerHTML = `<div class="empty-state">No category expense records found.</div>`;
        return;
    }

    const rows = list.map((item, idx) => {
        const cat = expenseCategories.find(c => c.id === item.id || c.name === item.id) || {
            name: item.id,
            icon: 'fa-receipt',
            color: '#64748b'
        };

        const pct = totalExp > 0 ? ((item.amount / totalExp) * 100).toFixed(1) : '0';
        const avg = item.count > 0 ? Math.round(item.amount / item.count) : 0;

        return `
            <tr>
                <td style="font-size:12px; font-weight:700; color:#475569;">${idx + 1}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:6px; background:${cat.color}20; color:${cat.color}; font-size:13px;">
                            <i class="fas ${cat.icon}"></i>
                        </span>
                        <div>
                            <div style="font-weight:800; font-size:13px; color:#0f172a;">${cat.name}</div>
                            ${cat.urdu ? `<div style="font-size:11px; color:#64748b;">${cat.urdu}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td style="text-align:right; font-weight:800; font-size:13px; color:#0f172a;">
                    ${item.count}
                </td>
                <td style="text-align:right; font-size:13px; color:#475569;">
                    Rs ${avg.toLocaleString()}
                </td>
                <td style="width:200px;">
                    <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; margin-bottom:2px;">
                        <span>${pct}%</span>
                    </div>
                    <div class="cat-bar-container">
                        <div class="cat-bar-fill" style="width:${pct}%; background:${cat.color};"></div>
                    </div>
                </td>
                <td style="text-align:right; font-weight:900; font-size:14px; color:#b91c1c;">
                    Rs ${item.amount.toLocaleString()}
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <table class="report-table">
            <thead>
                <tr>
                    <th style="width:40px;">#</th>
                    <th>Category Name</th>
                    <th style="text-align:right;">Vouchers</th>
                    <th style="text-align:right;">Avg / Voucher</th>
                    <th>Share of Total</th>
                    <th style="text-align:right;">Total Amount (Rs.)</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
            <tfoot>
                <tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #cbd5e1;">
                    <td colspan="5" style="text-align:right; font-size:13px; color:#1e293b;">
                        TOTAL ACROSS ALL CATEGORIES:
                    </td>
                    <td style="text-align:right; font-size:15px; color:#b91c1c; font-weight:900;">
                        Rs ${totalExp.toLocaleString()}
                    </td>
                </tr>
            </tfoot>
        </table>
    `;
}

// --------------------------------------------------------------------------
// View 3: Day-wise Breakdown
// --------------------------------------------------------------------------
function renderDayBreakdownTable(items, container) {
    const totalExp = items.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const dayMap = {};

    items.forEach(e => {
        const dStr = (e.date || '').slice(0, 10) || 'Unknown';
        if (!dayMap[dStr]) {
            dayMap[dStr] = {
                date: dStr,
                amount: 0,
                count: 0,
                catAmounts: {}
            };
        }
        dayMap[dStr].amount += (Number(e.amount) || 0);
        dayMap[dStr].count += 1;

        const cId = e.categoryId || e.category || 'cat_misc';
        dayMap[dStr].catAmounts[cId] = (dayMap[dStr].catAmounts[cId] || 0) + (Number(e.amount) || 0);
    });

    const list = Object.values(dayMap);
    list.sort((a, b) => b.date.localeCompare(a.date));
    activeTableData = list;

    if (list.length === 0) {
        container.innerHTML = `<div class="empty-state">No daily expenses found.</div>`;
        return;
    }

    const rows = list.map((item, idx) => {
        // Find top category for the day
        let topCat = '--';
        let topAmt = 0;
        Object.keys(item.catAmounts).forEach(cId => {
            if (item.catAmounts[cId] > topAmt) {
                topAmt = item.catAmounts[cId];
                const cObj = expenseCategories.find(c => c.id === cId || c.name === cId);
                topCat = cObj ? cObj.name : cId;
            }
        });

        const pct = totalExp > 0 ? ((item.amount / totalExp) * 100).toFixed(1) : '0';

        // Day of week
        let dayName = '';
        try {
            const dt = new Date(item.date);
            dayName = dt.toLocaleDateString('en-US', { weekday: 'long' });
        } catch (e) {}

        return `
            <tr>
                <td style="font-size:12px; font-weight:700; color:#475569;">${idx + 1}</td>
                <td>
                    <div style="font-weight:800; color:#0f172a; font-size:13px;">${item.date}</div>
                    <small style="color:#64748b; font-size:11px;">${dayName}</small>
                </td>
                <td style="text-align:right; font-weight:700; color:#0f172a;">
                    ${item.count}
                </td>
                <td>
                    <span style="font-size:12px; font-weight:700; color:#475569;">
                        ${topCat}
                    </span>
                    <small style="color:#94a3b8; font-size:11px;">(Rs ${topAmt.toLocaleString()})</small>
                </td>
                <td style="text-align:right; font-size:12px; font-weight:700; color:#64748b;">
                    ${pct}%
                </td>
                <td style="text-align:right; font-weight:900; font-size:14px; color:#b91c1c;">
                    Rs ${item.amount.toLocaleString()}
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <table class="report-table">
            <thead>
                <tr>
                    <th style="width:40px;">#</th>
                    <th>Date</th>
                    <th style="text-align:right;">Vouchers</th>
                    <th>Top Expense of Day</th>
                    <th style="text-align:right;">Share %</th>
                    <th style="text-align:right;">Daily Total (Rs.)</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
            <tfoot>
                <tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #cbd5e1;">
                    <td colspan="5" style="text-align:right; font-size:13px; color:#1e293b;">
                        TOTAL ACROSS ALL DAYS:
                    </td>
                    <td style="text-align:right; font-size:15px; color:#b91c1c; font-weight:900;">
                        Rs ${totalExp.toLocaleString()}
                    </td>
                </tr>
            </tfoot>
        </table>
    `;
}

// --------------------------------------------------------------------------
// View 4: Weekly Breakdown
// --------------------------------------------------------------------------
function renderWeeklyBreakdownTable(items, container) {
    const totalExp = items.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const weekMap = {};

    items.forEach(e => {
        const dStr = (e.date || '').slice(0, 10);
        if (!dStr) return;
        const d = new Date(dStr);
        const year = d.getFullYear();
        // Calculate week number
        const start = new Date(year, 0, 1);
        const days = Math.floor((d - start) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((days + start.getDay() + 1) / 7);
        const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`;

        if (!weekMap[weekKey]) {
            weekMap[weekKey] = {
                weekKey,
                year,
                weekNum,
                amount: 0,
                count: 0
            };
        }
        weekMap[weekKey].amount += (Number(e.amount) || 0);
        weekMap[weekKey].count += 1;
    });

    const list = Object.values(weekMap);
    list.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
    activeTableData = list;

    if (list.length === 0) {
        container.innerHTML = `<div class="empty-state">No weekly expenses found.</div>`;
        return;
    }

    const rows = list.map((item, idx) => {
        const pct = totalExp > 0 ? ((item.amount / totalExp) * 100).toFixed(1) : '0';
        return `
            <tr>
                <td style="font-size:12px; font-weight:700; color:#475569;">${idx + 1}</td>
                <td style="font-weight:800; color:#0f172a; font-size:13px;">
                    Week ${item.weekNum}, ${item.year} (${item.weekKey})
                </td>
                <td style="text-align:right; font-weight:700; color:#0f172a;">
                    ${item.count}
                </td>
                <td style="text-align:right; font-size:12px; font-weight:700; color:#64748b;">
                    ${pct}%
                </td>
                <td style="text-align:right; font-weight:900; font-size:14px; color:#b91c1c;">
                    Rs ${item.amount.toLocaleString()}
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <table class="report-table">
            <thead>
                <tr>
                    <th style="width:40px;">#</th>
                    <th>Week Period</th>
                    <th style="text-align:right;">Vouchers</th>
                    <th style="text-align:right;">Share %</th>
                    <th style="text-align:right;">Weekly Total (Rs.)</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
            <tfoot>
                <tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #cbd5e1;">
                    <td colspan="4" style="text-align:right; font-size:13px; color:#1e293b;">
                        TOTAL ACROSS ALL WEEKS:
                    </td>
                    <td style="text-align:right; font-size:15px; color:#b91c1c; font-weight:900;">
                        Rs ${totalExp.toLocaleString()}
                    </td>
                </tr>
            </tfoot>
        </table>
    `;
}

// --------------------------------------------------------------------------
// View 5: Monthly Breakdown
// --------------------------------------------------------------------------
function renderMonthlyBreakdownTable(items, container) {
    const totalExp = items.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const monthMap = {};

    items.forEach(e => {
        const mKey = (e.date || '').slice(0, 7) || 'Unknown';
        if (!monthMap[mKey]) {
            monthMap[mKey] = {
                monthKey: mKey,
                amount: 0,
                count: 0
            };
        }
        monthMap[mKey].amount += (Number(e.amount) || 0);
        monthMap[mKey].count += 1;
    });

    const list = Object.values(monthMap);
    list.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    activeTableData = list;

    if (list.length === 0) {
        container.innerHTML = `<div class="empty-state">No monthly expenses found.</div>`;
        return;
    }

    const rows = list.map((item, idx) => {
        let label = item.monthKey;
        try {
            const [y, m] = item.monthKey.split('-');
            const dt = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
            label = dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } catch (e) {}

        const pct = totalExp > 0 ? ((item.amount / totalExp) * 100).toFixed(1) : '0';

        return `
            <tr>
                <td style="font-size:12px; font-weight:700; color:#475569;">${idx + 1}</td>
                <td style="font-weight:800; color:#0f172a; font-size:13px;">
                    ${label}
                </td>
                <td style="text-align:right; font-weight:700; color:#0f172a;">
                    ${item.count}
                </td>
                <td style="text-align:right; font-size:12px; font-weight:700; color:#64748b;">
                    ${pct}%
                </td>
                <td style="text-align:right; font-weight:900; font-size:14px; color:#b91c1c;">
                    Rs ${item.amount.toLocaleString()}
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <table class="report-table">
            <thead>
                <tr>
                    <th style="width:40px;">#</th>
                    <th>Month & Year</th>
                    <th style="text-align:right;">Vouchers</th>
                    <th style="text-align:right;">Share %</th>
                    <th style="text-align:right;">Monthly Total (Rs.)</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
            <tfoot>
                <tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #cbd5e1;">
                    <td colspan="4" style="text-align:right; font-size:13px; color:#1e293b;">
                        TOTAL ACROSS ALL MONTHS:
                    </td>
                    <td style="text-align:right; font-size:15px; color:#b91c1c; font-weight:900;">
                        Rs ${totalExp.toLocaleString()}
                    </td>
                </tr>
            </tfoot>
        </table>
    `;
}

// ==========================================================================
// ➕ 5. RECORD / EDIT EXPENSE CONTROLLER
// ==========================================================================
window.openExpenseModal = function(editId = null) {
    const modal = document.getElementById('modalAddExpense');
    const form = document.getElementById('formExpense');
    const titleEl = document.getElementById('modalExpenseTitle');
    const idEl = document.getElementById('expDocId');

    if (!modal || !form) return;

    if (editId) {
        const exp = rawExpenses.find(e => e.id === editId);
        if (!exp) return;

        titleEl.innerHTML = '<i class="fas fa-edit" style="color:#0284c7;"></i> Edit Expense (خرچ تبدیل کریں)';
        idEl.value = editId;

        document.getElementById('expCategorySelect').value = exp.categoryId || exp.category || 'cat_misc';
        document.getElementById('expAmount').value = exp.amount || '';
        document.getElementById('expDate').value = exp.date || getPktToday();
        document.getElementById('expTitle').value = exp.title || exp.description || '';
        document.getElementById('expPaidTo').value = exp.paidTo || '';
        document.getElementById('expPayMethod').value = exp.paymentMethod || 'cash';
        document.getElementById('expReceiptNo').value = exp.receiptNo || exp.voucherNo || '';
        document.getElementById('expNotes').value = exp.notes || '';
    } else {
        titleEl.innerHTML = '<i class="fas fa-plus-circle" style="color:#ef4444;"></i> Record Expense (نیا خرچ درج کریں)';
        form.reset();
        idEl.value = '';
        document.getElementById('expDate').value = getPktToday();
    }

    modal.style.display = 'flex';
};

function closeExpenseModal() {
    const modal = document.getElementById('modalAddExpense');
    if (modal) modal.style.display = 'none';
}

async function handleSaveExpense(e) {
    e.preventDefault();

    const id = document.getElementById('expDocId').value;
    const catId = document.getElementById('expCategorySelect').value;
    const catObj = expenseCategories.find(c => c.id === catId);
    const catName = catObj ? catObj.name : 'General';

    const amount = Number(document.getElementById('expAmount').value) || 0;
    const date = document.getElementById('expDate').value || getPktToday();
    const title = document.getElementById('expTitle').value.trim();
    const paidTo = document.getElementById('expPaidTo').value.trim();
    const paymentMethod = document.getElementById('expPayMethod').value;
    const receiptNo = document.getElementById('expReceiptNo').value.trim();
    const notes = document.getElementById('expNotes').value.trim();

    if (!amount || amount <= 0) {
        Swal.fire('Invalid Amount', 'Please enter a valid expense amount.', 'warning');
        return;
    }
    if (!title) {
        Swal.fire('Required', 'Please enter a title/description.', 'warning');
        return;
    }

    const saveBtn = document.getElementById('btnSaveExpense');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        const timeNow = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        const expenseData = {
            agencyId: myAgencyId,
            categoryId: catId,
            category: catName,
            amount: amount,
            date: date,
            time: timeNow,
            title: title,
            description: title,
            paidTo: paidTo,
            paymentMethod: paymentMethod,
            receiptNo: receiptNo,
            voucherNo: receiptNo || ('EXP-' + Date.now().toString().slice(-6)),
            notes: notes,
            updatedAt: new Date().toISOString()
        };

        if (id) {
            // Update
            await db.collection('expenses').doc(id).update(expenseData);
            expenseData.id = id;
            const idx = rawExpenses.findIndex(e => e.id === id);
            if (idx !== -1) rawExpenses[idx] = expenseData;

            Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: 'Expense updated successfully.',
                timer: 1500,
                showConfirmButton: false
            });
        } else {
            // Create
            expenseData.createdBy = myUid;
            expenseData.createdAt = new Date().toISOString();

            const docRef = await db.collection('expenses').add(expenseData);
            expenseData.id = docRef.id;
            rawExpenses.unshift(expenseData);

            Swal.fire({
                icon: 'success',
                title: 'Expense Recorded!',
                html: `<b>${title}</b><br>Rs ${amount.toLocaleString()} (${catName})`,
                timer: 1800,
                showConfirmButton: false
            });
        }

        // Cache update
        localStorage.setItem(`eb_expenses_${myAgencyId}`, JSON.stringify(rawExpenses));

        closeExpenseModal();
        renderExpenseDashboard();

    } catch (err) {
        console.error('Save expense error:', err);
        Swal.fire('Error', 'Failed to save expense: ' + err.message, 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Expense (محفوظ کریں)';
        }
    }
}

window.editExpense = function(id) {
    openExpenseModal(id);
};

window.deleteExpense = async function(id) {
    const exp = rawExpenses.find(e => e.id === id);
    if (!exp) return;

    const res = await Swal.fire({
        title: 'Delete Expense Voucher?',
        html: `<b>${exp.title || exp.description}</b><br>Rs ${(Number(exp.amount) || 0).toLocaleString()}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Delete Voucher'
    });

    if (res.isConfirmed) {
        try {
            await db.collection('expenses').doc(id).delete();
            rawExpenses = rawExpenses.filter(e => e.id !== id);
            localStorage.setItem(`eb_expenses_${myAgencyId}`, JSON.stringify(rawExpenses));
            renderExpenseDashboard();
            Swal.fire('Deleted!', 'Expense removed successfully.', 'success');
        } catch (e) {
            Swal.fire('Error', 'Failed to delete: ' + e.message, 'error');
        }
    }
};

// ==========================================================================
// 🖨️ 6. PRINT VOUCHER & REPORTS
// ==========================================================================
window.printSingleVoucher = function(id) {
    const exp = rawExpenses.find(e => e.id === id);
    if (!exp) return;

    const printArea = document.getElementById('printableExpenseArea');
    if (!printArea) return;

    const catObj = expenseCategories.find(c => c.id === exp.categoryId || c.name === exp.category) || { name: exp.category || 'General' };
    const agencyName = (myAgency && myAgency.name) || 'NH POS Enterprise';
    const agencyPhone = (myAgency && (myAgency.phone || myAgency.mobile)) || '';
    const agencyCity = (myAgency && myAgency.city) || '';

    printArea.innerHTML = `
        <div style="font-family:'Segoe UI',sans-serif; max-width:600px; margin:0 auto; padding:20px; border:2px dashed #0f172a; border-radius:12px; background:#fff; color:#0f172a;">
            <!-- Header -->
            <div style="text-align:center; border-bottom:2px solid #0f172a; padding-bottom:12px; margin-bottom:14px;">
                <h2 style="margin:0; font-size:22px; font-weight:900; text-transform:uppercase;">${agencyName}</h2>
                ${agencyCity ? `<div style="font-size:12px; color:#475569;">${agencyCity} ${agencyPhone ? '• Tel: ' + agencyPhone : ''}</div>` : ''}
                <div style="margin-top:6px; font-size:14px; font-weight:800; background:#0f172a; color:#fff; display:inline-block; padding:3px 14px; border-radius:14px; letter-spacing:1px;">
                    EXPENSE PAYMENT VOUCHER
                </div>
            </div>

            <!-- Meta details -->
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:14px;">
                <div>
                    <b>Voucher #:</b> ${exp.voucherNo || exp.receiptNo || 'EXP-' + exp.id.slice(-6)}<br>
                    <b>Date:</b> ${exp.date || '--'} ${exp.time || ''}
                </div>
                <div style="text-align:right;">
                    <b>Category:</b> ${catObj.name}<br>
                    <b>Payment:</b> ${(exp.paymentMethod || 'Cash').toUpperCase()}
                </div>
            </div>

            <!-- Expense Content -->
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:12px; margin-bottom:16px;">
                <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Expense Particulars:</div>
                <div style="font-size:15px; font-weight:800; color:#0f172a; margin:4px 0;">
                    ${exp.title || exp.description}
                </div>
                ${exp.paidTo ? `<div style="font-size:12px; color:#334155;"><b>Paid To:</b> ${exp.paidTo}</div>` : ''}
                ${exp.notes ? `<div style="font-size:11px; color:#64748b; margin-top:4px;"><b>Remarks:</b> ${exp.notes}</div>` : ''}
            </div>

            <!-- Amount Box -->
            <div style="background:#fee2e2; border:2px solid #ef4444; border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;">
                <span style="font-size:14px; font-weight:800; color:#991b1b;">AMOUNT PAID:</span>
                <span style="font-size:22px; font-weight:900; color:#b91c1c;">Rs ${(Number(exp.amount) || 0).toLocaleString()}</span>
            </div>

            <!-- Signatures -->
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-top:50px;">
                <div style="text-align:center; border-top:1px solid #0f172a; width:150px; padding-top:6px;">
                    Receiver's Signature
                </div>
                <div style="text-align:center; border-top:1px solid #0f172a; width:150px; padding-top:6px;">
                    Authorized Signature
                </div>
            </div>
        </div>
    `;

    printArea.style.display = 'block';
    window.print();
    setTimeout(() => { printArea.style.display = 'none'; }, 1000);
};

function printFullReport() {
    window.print();
}

// ==========================================================================
// 📥 7. EXPORT TO CSV
// ==========================================================================
function exportToCSV() {
    if (!activeTableData || activeTableData.length === 0) {
        Swal.fire('No Data', 'No expenses available to export in current view.', 'info');
        return;
    }

    let csvContent = '\uFEFF'; // UTF-8 BOM
    let fileName = `Expenses_${currentView}_${dateStart}_to_${dateEnd}.csv`;

    if (currentView === 'all') {
        csvContent += 'Index,Date,Time,VoucherNo,Category,Title,PaidTo,PaymentMethod,Amount\n';
        activeTableData.forEach((e, idx) => {
            const cat = expenseCategories.find(c => c.id === e.categoryId || c.name === e.category) || { name: e.category || '' };
            csvContent += `"${idx + 1}","${e.date || ''}","${e.time || ''}","${e.voucherNo || e.receiptNo || ''}","${cleanCSV(cat.name)}","${cleanCSV(e.title || e.description || '')}","${cleanCSV(e.paidTo || '')}","${e.paymentMethod || 'cash'}","${e.amount || 0}"\n`;
        });
    } else if (currentView === 'category') {
        csvContent += 'Index,CategoryID,CategoryName,VoucherCount,TotalAmount\n';
        activeTableData.forEach((item, idx) => {
            const cat = expenseCategories.find(c => c.id === item.id || c.name === item.id) || { name: item.id };
            csvContent += `"${idx + 1}","${item.id}","${cleanCSV(cat.name)}","${item.count}","${item.amount}"\n`;
        });
    } else if (currentView === 'day') {
        csvContent += 'Index,Date,VouchersCount,DailyTotalAmount\n';
        activeTableData.forEach((item, idx) => {
            csvContent += `"${idx + 1}","${item.date}","${item.count}","${item.amount}"\n`;
        });
    } else if (currentView === 'weekly') {
        csvContent += 'Index,WeekKey,Year,WeekNumber,VouchersCount,WeeklyTotalAmount\n';
        activeTableData.forEach((item, idx) => {
            csvContent += `"${idx + 1}","${item.weekKey}","${item.year}","${item.weekNum}","${item.count}","${item.amount}"\n`;
        });
    } else if (currentView === 'monthly') {
        csvContent += 'Index,MonthKey,VouchersCount,MonthlyTotalAmount\n';
        activeTableData.forEach((item, idx) => {
            csvContent += `"${idx + 1}","${item.monthKey}","${item.count}","${item.amount}"\n`;
        });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function cleanCSV(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '""');
}

// ==========================================================================
// 📅 8. DATE PRESETS & FILTER CONTROLLER
// ==========================================================================
function applyPreset(presetKey) {
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let start = new Date();
    let end = new Date();

    if (presetKey === 'today') {
        // Today
    } else if (presetKey === 'yesterday') {
        start.setDate(today.getDate() - 1);
        end.setDate(today.getDate() - 1);
    } else if (presetKey === 'thisweek') {
        const day = today.getDay(); // 0 is Sun
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        start.setDate(diff);
    } else if (presetKey === 'last7') {
        start.setDate(today.getDate() - 6);
    } else if (presetKey === 'thismonth') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (presetKey === 'lastmonth') {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (presetKey === 'alltime') {
        start = new Date(2020, 0, 1);
        end = new Date(2035, 11, 31);
    }

    dateStart = toYMD(start);
    dateEnd = toYMD(end);

    const sInput = document.getElementById('expenseDateStart');
    const eInput = document.getElementById('expenseDateEnd');
    if (sInput) sInput.value = dateStart;
    if (eInput) eInput.value = dateEnd;

    // Toggle active button class
    const buttons = document.querySelectorAll('#expenseDatePresets .date-preset-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === presetKey);
    });
}

function getPktToday() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const pkt = new Date(utc + (3600000 * 5));
    const pad = n => String(n).padStart(2, '0');
    return `${pkt.getFullYear()}-${pad(pkt.getMonth() + 1)}-${pad(pkt.getDate())}`;
}

// ==========================================================================
// 🎛️ 9. EVENT LISTENERS SETUP
// ==========================================================================
function setupEventListeners() {
    // Top bar action buttons
    const btnAdd = document.getElementById('btnOpenAddExpenseModal');
    if (btnAdd) btnAdd.addEventListener('click', () => openExpenseModal());

    const btnCat = document.getElementById('btnOpenCatModal');
    if (btnCat) btnCat.addEventListener('click', () => openCategoryModal());

    const btnQuickCat = document.getElementById('btnQuickAddCat');
    if (btnQuickCat) btnQuickCat.addEventListener('click', () => openCategoryModal());

    const btnRefresh = document.getElementById('btnRefreshExpenses');
    if (btnRefresh) btnRefresh.addEventListener('click', () => loadExpenses());

    const btnExport = document.getElementById('btnExportExpenseCSV');
    if (btnExport) btnExport.addEventListener('click', exportToCSV);

    const btnPrint = document.getElementById('btnPrintExpenses');
    if (btnPrint) btnPrint.addEventListener('click', printFullReport);

    // Date presets
    const presetButtons = document.querySelectorAll('#expenseDatePresets .date-preset-btn');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            applyPreset(btn.dataset.preset);
            loadExpenses();
        });
    });

    // Custom Date Apply
    const btnApplyDate = document.getElementById('btnApplyExpenseDate');
    if (btnApplyDate) {
        btnApplyDate.addEventListener('click', () => {
            const sVal = document.getElementById('expenseDateStart').value;
            const eVal = document.getElementById('expenseDateEnd').value;
            if (!sVal || !eVal) {
                Swal.fire('Notice', 'Please choose both start and end dates.', 'info');
                return;
            }
            dateStart = sVal;
            dateEnd = eVal;
            const buttons = document.querySelectorAll('#expenseDatePresets .date-preset-btn');
            buttons.forEach(b => b.classList.remove('active'));
            loadExpenses();
        });
    }

    // View Tabs
    const tabButtons = document.querySelectorAll('#expenseViewTabs .report-tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;

            updateViewTitles();
            renderCurrentViewTable();
        });
    });

    // Filters & Search
    const searchInput = document.getElementById('expenseSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.trim();
            renderCurrentViewTable();
        });
    }

    const catFilter = document.getElementById('expenseFilterCategory');
    if (catFilter) {
        catFilter.addEventListener('change', (e) => {
            filterCategory = e.target.value;
            renderCurrentViewTable();
        });
    }

    const payFilter = document.getElementById('expenseFilterPayMode');
    if (payFilter) {
        payFilter.addEventListener('change', (e) => {
            filterPayMode = e.target.value;
            renderCurrentViewTable();
        });
    }

    const sortSelect = document.getElementById('expenseSortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            renderCurrentViewTable();
        });
    }

    // Modals
    const closeExpBtn = document.getElementById('btnCloseExpenseModal');
    if (closeExpBtn) closeExpBtn.addEventListener('click', closeExpenseModal);
    const cancelExpBtn = document.getElementById('btnCancelExpense');
    if (cancelExpBtn) cancelExpBtn.addEventListener('click', closeExpenseModal);
    const overlayExp = document.getElementById('overlayAddExpense');
    if (overlayExp) overlayExp.addEventListener('click', closeExpenseModal);

    const formExp = document.getElementById('formExpense');
    if (formExp) formExp.addEventListener('submit', handleSaveExpense);

    const closeCatBtn = document.getElementById('btnCloseCatModal');
    if (closeCatBtn) closeCatBtn.addEventListener('click', closeCategoryModal);
    const overlayCat = document.getElementById('overlayCategories');
    if (overlayCat) overlayCat.addEventListener('click', closeCategoryModal);

    const formCat = document.getElementById('formNewCat');
    if (formCat) formCat.addEventListener('submit', handleAddCategory);
}

function openCategoryModal() {
    const modal = document.getElementById('modalCategories');
    if (modal) {
        renderCategoryManagerList();
        modal.style.display = 'flex';
    }
}

function closeCategoryModal() {
    const modal = document.getElementById('modalCategories');
    if (modal) modal.style.display = 'none';
}

function updateViewTitles() {
    const titleEl = document.getElementById('expenseViewTitle');
    const subEl = document.getElementById('expenseViewSubTitle');
    if (!titleEl || !subEl) return;

    if (currentView === 'all') {
        titleEl.innerHTML = '<i class="fas fa-list-check" style="color:#ef4444;"></i> Detailed Expenses Vouchers';
        subEl.innerText = 'تاریخ وار تمام ادائیگیوں اور واؤچرز کی مکمل تفصیل';
    } else if (currentView === 'category') {
        titleEl.innerHTML = '<i class="fas fa-chart-pie" style="color:#6366f1;"></i> Category-wise Expenses Breakdown';
        subEl.innerText = 'کیٹیگری وار کل خرچ، فیصد تناسب اور واؤچرز کی تعداد';
    } else if (currentView === 'day') {
        titleEl.innerHTML = '<i class="fas fa-calendar-day" style="color:#f59e0b;"></i> Day-wise Daily Expenses';
        subEl.innerText = 'ہر دن کا کل خرچ، واؤچرز اور دن کا سب سے بڑا خرچ';
    } else if (currentView === 'weekly') {
        titleEl.innerHTML = '<i class="fas fa-calendar-week" style="color:#8b5cf6;"></i> Weekly Expenses Summary';
        subEl.innerText = 'ہفتہ وار اخراجات کی تفصیل اور اوسط';
    } else if (currentView === 'monthly') {
        titleEl.innerHTML = '<i class="fas fa-calendar-alt" style="color:#3b82f6;"></i> Monthly Expenses Overview';
        subEl.innerText = 'ماہانہ اخراجات کا تاریخی جائزہ اور موازنہ';
    }
}

function getPaymentBadge(mode) {
    const m = (mode || 'cash').toLowerCase();
    if (m === 'bank') {
        return '<span class="pay-mode-badge" style="background:#e0f2fe; color:#0369a1;"><i class="fas fa-building-columns"></i> Bank</span>';
    } else if (m === 'wallet') {
        return '<span class="pay-mode-badge" style="background:#fef3c7; color:#b45309;"><i class="fas fa-mobile-screen"></i> Wallet</span>';
    } else if (m === 'cheque') {
        return '<span class="pay-mode-badge" style="background:#f3e8ff; color:#7e22ce;"><i class="fas fa-money-check"></i> Cheque</span>';
    }
    return '<span class="pay-mode-badge" style="background:#dcfce7; color:#15803d;"><i class="fas fa-money-bill-1"></i> Cash</span>';
}
