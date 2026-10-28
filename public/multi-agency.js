// ============================================
// 🏢 EASY BILL GENERATOR — MULTI-AGENCY OWNER HUB (PHASE 5)
// ✅ Consolidated Dashboard across 1 to 5 Agencies
// ✅ Instant Active Branch Switching
// ✅ Side-by-Side Financial & Operational Comparison
// ✅ Quota Shield: Smart Caching for 20-30 Agencies
// ✅ Add / Register Additional Branches (Package Controlled)
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
let myPrimaryAgencyId = null;
let myActiveAgencyId = null;
let ownedBranches = [];
let maxBranchesAllowed = 5;

// Auth Guard
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

        // Check user role: Only owner and super-admin can access Multi-Agency Hub
        if (myUser.role !== 'owner' && myUser.role !== 'super-admin') {
            Swal.fire({
                icon: 'warning',
                title: '🔒 Access Restricted',
                text: 'Multi-Agency Owner Hub sirf Business Owners aur Super Admin ke liye hai!',
                confirmButtonColor: '#27ae60'
            }).then(() => window.location.href = 'dashboard.html');
            return;
        }

        myPrimaryAgencyId = myUser.agencyId;
        myActiveAgencyId = localStorage.getItem('eb_active_agencyId') || myPrimaryAgencyId;

        document.getElementById('ownerTitle').innerText = `${myUser.name || 'Owner'} (${myUser.email || ''})`;

        // Step 1: Instant render from local cache (Quota Shield)
        loadFromCache();

        // Step 2: Fetch and sync all owned agencies from Firestore
        await loadOwnedAgencies();

    } catch (e) {
        console.error('Multi-Agency init error:', e);
        Swal.fire('Error', 'Initialization failed: ' + e.message, 'error');
    }
});

// ============================================
// 💾 SMART CACHING (QUOTA SHIELD)
// ============================================
function getCacheKey() {
    return `eb_multi_agency_cache_${myUid}`;
}

function loadFromCache() {
    try {
        const cached = localStorage.getItem(getCacheKey());
        if (cached) {
            const data = JSON.parse(cached);
            if (Array.isArray(data.branches) && data.branches.length > 0) {
                ownedBranches = data.branches;
                renderExecutiveMetrics();
                renderBranchesList();
                renderComparisonMatrix();
            }
        }
    } catch (e) {
        console.warn('Cache load error:', e);
    }
}

function saveToCache(branches) {
    try {
        localStorage.setItem(getCacheKey(), JSON.stringify({
            branches: branches,
            timestamp: new Date().toISOString()
        }));
    } catch (e) {
        console.warn('Cache save error:', e);
    }
}

// ============================================
// 🏢 LOAD ALL OWNED AGENCIES
// ============================================
async function loadOwnedAgencies() {
    try {
        const branchesMap = new Map();

        // 1. Fetch by ownerUid or ownerEmail
        const queries = [
            db.collection('agencies').where('ownerUid', '==', myUid).get(),
            db.collection('agencies').where('ownerEmail', '==', (myUser.email || '').toLowerCase()).get()
        ];

        // Also fetch primary agency if exists
        if (myPrimaryAgencyId) {
            queries.push(db.collection('agencies').doc(myPrimaryAgencyId).get());
        }

        const results = await Promise.all(queries);

        results.forEach(res => {
            if (res.docs) {
                res.docs.forEach(d => {
                    branchesMap.set(d.id, { id: d.id, ...d.data() });
                });
            } else if (res.exists) {
                branchesMap.set(res.id, { id: res.id, ...res.data() });
            }
        });

        const rawBranches = Array.from(branchesMap.values());

        // Package limits evaluation
        const firstAgency = rawBranches[0] || {};
        
        // 💎 SaaS Lock & Paywall Guard Check
        if (window.SaaSModules && myUser.role !== 'super-admin') {
            const isLocked = window.SaaSModules.enforcePagePaywall('multi_agency', '.panel-container', firstAgency, myUser.role, myUser);
            if (isLocked) {
                return;
            }
        }

        const pkgId = firstAgency.packageId || 'free';
        evaluatePackageLimits(pkgId);

        // Fetch detailed aggregated metrics per branch (in parallel)
        ownedBranches = await Promise.all(rawBranches.map(async (b) => {
            return await fetchBranchMetrics(b);
        }));

        saveToCache(ownedBranches);
        renderExecutiveMetrics();
        renderBranchesList();
        renderComparisonMatrix();

    } catch (e) {
        console.error('Load owned agencies error:', e);
    }
}

function evaluatePackageLimits(pkgId) {
    if (pkgId === 'pro' || pkgId === 'enterprise' || pkgId === 'multi') {
        maxBranchesAllowed = 5;
        document.getElementById('pkgNameDisplay').innerHTML = '💎 Enterprise Multi-Agency (Up to 5 Branches)';
    } else if (pkgId === 'basic') {
        maxBranchesAllowed = 2;
        document.getElementById('pkgNameDisplay').innerHTML = '💳 Basic Multi-Agency (Up to 2 Branches)';
    } else {
        maxBranchesAllowed = 1;
        document.getElementById('pkgNameDisplay').innerHTML = '🆓 Single Agency Package (1 Branch)';
    }
}

// Fetch single branch operational numbers efficiently
async function fetchBranchMetrics(agency) {
    const branchId = agency.id;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthPrefix = todayStr.slice(0, 7); // YYYY-MM

    let todaySales = 0;
    let monthSales = 0;
    let billsCount = 0;
    let bookersCount = 0;
    let totalKhata = 0;
    let stockValue = 0;
    let stockItemsCount = 0;
    let lowStockCount = 0;

    try {
        // Bills query for this month
        const billsSnap = await db.collection('bills')
            .where('agencyId', '==', branchId)
            .where('date', '>=', monthPrefix + '-01')
            .get();

        billsSnap.forEach(d => {
            const b = d.data();
            const total = Number(b.billAmount || b.grandTotal || 0);
            monthSales += total;
            billsCount++;
            if (b.date === todayStr) {
                todaySales += total;
            }
        });

        // Bookers query
        const bookersSnap = await db.collection('users')
            .where('agencyId', '==', branchId)
            .where('role', '==', 'booker')
            .get();
        bookersCount = bookersSnap.size;

        // Customers khata query
        const custSnap = await db.collection('customers')
            .where('agencyId', '==', branchId)
            .get();
        custSnap.forEach(d => {
            totalKhata += Number(d.data().balance || 0);
        });

        // Stock valuation query
        const stockSnap = await db.collection('stock')
            .where('agencyId', '==', branchId)
            .get();
        stockItemsCount = stockSnap.size;
        stockSnap.forEach(d => {
            const item = d.data();
            const qty = Number(item.qty || 0);
            const rate = Number(item.retailRate || item.rate || 0);
            stockValue += (qty * rate);
            const limit = item.lowStockLimit !== undefined ? Number(item.lowStockLimit) : 10;
            if (qty <= limit) lowStockCount++;
        });

    } catch (e) {
        console.warn(`Metrics fetch error for agency ${branchId}:`, e);
    }

    return {
        ...agency,
        todaySales,
        monthSales,
        billsCount,
        bookersCount,
        totalKhata,
        stockValue,
        stockItemsCount,
        lowStockCount
    };
}

// ============================================
// 📊 RENDER CONSOLIDATED EXECUTIVE METRICS
// ============================================
function renderExecutiveMetrics() {
    let totSales = 0;
    let totBookers = 0;
    let totKhata = 0;
    let totInventory = 0;

    ownedBranches.forEach(b => {
        totSales += (b.monthSales || 0);
        totBookers += (b.bookersCount || 0);
        totKhata += (b.totalKhata || 0);
        totInventory += (b.stockValue || 0);
    });

    // Estimated Gross Margin (assuming ~18-20% standard margin across distribution)
    const estProfit = totSales * 0.18;

    document.getElementById('totBranchesVal').innerText = ownedBranches.length;
    document.getElementById('totSalesVal').innerText = 'Rs ' + Math.round(totSales).toLocaleString();
    document.getElementById('totProfitVal').innerText = 'Rs ' + Math.round(estProfit).toLocaleString();
    document.getElementById('totBookersVal').innerText = totBookers;
    document.getElementById('totReceivablesVal').innerText = 'Rs ' + Math.round(totKhata).toLocaleString();
    document.getElementById('totInventoryVal').innerText = 'Rs ' + Math.round(totInventory).toLocaleString();

    // Update branch capacity bar
    const ratioText = `${ownedBranches.length} / ${maxBranchesAllowed} Branches Used`;
    document.getElementById('branchCountRatio').innerText = ratioText;
    const percentage = Math.min(100, Math.round((ownedBranches.length / maxBranchesAllowed) * 100));
    document.getElementById('branchQuotaFill').style.width = percentage + '%';
    if (percentage >= 100) {
        document.getElementById('branchQuotaFill').style.background = '#e74c3c';
    } else {
        document.getElementById('branchQuotaFill').style.background = '#10b981';
    }
}

// ============================================
// 🏢 RENDER BRANCHES CARDS LIST
// ============================================
function renderBranchesList() {
    const container = document.getElementById('branchesList');
    if (ownedBranches.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="big-icon">🏢</div>
                <strong>Koi branch mili nahi!</strong><br>
                Upar "Add / Connect New Branch" par click karein.
            </div>`;
        return;
    }

    let html = '';
    ownedBranches.forEach((b, idx) => {
        const isActive = (b.id === myActiveAgencyId);
        const cardClass = isActive ? 'branch-card active-branch' : 'branch-card';
        const badgeHtml = isActive 
            ? '<span class="branch-badge badge-active"><i class="fas fa-check-circle"></i> CURRENT ACTIVE BRANCH</span>'
            : '<span class="branch-badge badge-inactive">Secondary Branch</span>';

        html += `
        <div class="${cardClass}">
            <div class="branch-header">
                <div>
                    <div class="branch-name">
                        <span>🏢 ${b.name || 'Unnamed Agency'}</span>
                        ${badgeHtml}
                    </div>
                    <div style="font-size:12px; color:#64748b; margin-top:2px;">
                        📍 ${b.city || 'Pakistan'} &nbsp;|&nbsp; 📱 ${b.mobile || 'No Phone'} &nbsp;|&nbsp; 🧾 Prefix: <b>${(b.billPrefixes && b.billPrefixes.stock) || 'STK-'}</b>
                    </div>
                </div>
                <div class="branch-actions">
                    ${!isActive ? `
                        <button class="btn btn-sm" style="background:#10b981; color:#fff;" onclick="switchActiveBranch('${b.id}', '${(b.name || '').replace(/'/g, "\\'")}')">
                            <i class="fas fa-toggle-on"></i> Switch to This Branch
                        </button>
                    ` : `
                        <span style="font-size:12px; font-weight:bold; color:#15803d; padding:6px 10px; background:#dcfce7; border-radius:6px;">
                            ✅ Active Working Session
                        </span>
                    `}
                    <button class="btn btn-sm" style="background:#0284c7; color:#fff;" onclick="openBranchSection('${b.id}', 'bills.html')">
                        <i class="fas fa-file-invoice"></i> Invoices
                    </button>
                    <button class="btn btn-sm" style="background:#f59e0b; color:#fff;" onclick="openBranchSection('${b.id}', 'stock.html')">
                        <i class="fas fa-boxes"></i> Stock
                    </button>
                    <button class="btn btn-sm" style="background:#6366f1; color:#fff;" onclick="openBranchSection('${b.id}', 'owner.html')">
                        <i class="fas fa-users"></i> Bookers
                    </button>
                </div>
            </div>

            <div class="branch-stats">
                <div class="b-stat-item">
                    <div class="b-stat-num" style="color:#10b981;">Rs ${Math.round(b.todaySales || 0).toLocaleString()}</div>
                    <div class="b-stat-lbl">Today Sales</div>
                </div>
                <div class="b-stat-item">
                    <div class="b-stat-num" style="color:#0284c7;">Rs ${Math.round(b.monthSales || 0).toLocaleString()}</div>
                    <div class="b-stat-lbl">Month Sales</div>
                </div>
                <div class="b-stat-item">
                    <div class="b-stat-num">${b.billsCount || 0}</div>
                    <div class="b-stat-lbl">Month Bills</div>
                </div>
                <div class="b-stat-item">
                    <div class="b-stat-num">${b.bookersCount || 0}</div>
                    <div class="b-stat-lbl">Active Bookers</div>
                </div>
                <div class="b-stat-item">
                    <div class="b-stat-num" style="color:#ef4444;">Rs ${Math.round(b.totalKhata || 0).toLocaleString()}</div>
                    <div class="b-stat-lbl">Customer Khata</div>
                </div>
                <div class="b-stat-item">
                    <div class="b-stat-num">${b.stockItemsCount || 0} (${b.lowStockCount || 0} low)</div>
                    <div class="b-stat-lbl">Stock Items</div>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// ============================================
// 📈 RENDER COMPARATIVE MATRIX TABLE
// ============================================
function renderComparisonMatrix() {
    const tbody = document.getElementById('matrixTbody');
    if (ownedBranches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No branches registered.</td></tr>';
        return;
    }

    let html = '';
    ownedBranches.forEach(b => {
        const isActive = (b.id === myActiveAgencyId);
        html += `
        <tr style="${isActive ? 'background:#f0fdf4; font-weight:600;' : ''}">
            <td><b>${b.name || 'Branch'}</b> ${isActive ? '✅' : ''}</td>
            <td>${b.city || '—'}</td>
            <td style="color:#15803d; font-weight:bold;">Rs ${Math.round(b.todaySales || 0).toLocaleString()}</td>
            <td style="color:#0369a1; font-weight:bold;">Rs ${Math.round(b.monthSales || 0).toLocaleString()}</td>
            <td>${b.bookersCount || 0}</td>
            <td style="color:#b91c1c;">Rs ${Math.round(b.totalKhata || 0).toLocaleString()}</td>
            <td>Rs ${Math.round(b.stockValue || 0).toLocaleString()}</td>
            <td><span class="branch-badge ${isActive ? 'badge-active' : 'badge-inactive'}">${isActive ? 'Active' : 'Standby'}</span></td>
        </tr>`;
    });

    tbody.innerHTML = html;
}

// ============================================
// ⚡ SWITCH ACTIVE BRANCH
// ============================================
async function switchActiveBranch(agencyId, agencyName) {
    try {
        localStorage.setItem('eb_active_agencyId', agencyId);
        myActiveAgencyId = agencyId;

        // Also update agencyId in user doc so all devices/sessions sync
        await db.collection('users').doc(myUid).update({
            agencyId: agencyId,
            lastSwitchedAt: new Date().toISOString()
        });

        renderBranchesList();
        renderComparisonMatrix();

        Swal.fire({
            icon: 'success',
            title: '🏢 Branch Switched!',
            html: `Aap ka active working session ab <b>${agencyName}</b> par switch ho chuka hai!`,
            showCancelButton: true,
            confirmButtonText: '🏠 Go to Dashboard',
            cancelButtonText: 'Stay Here',
            confirmButtonColor: '#27ae60'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = 'dashboard.html';
            }
        });

    } catch (e) {
        console.error('Branch switch error:', e);
        Swal.fire('Error', 'Switching failed: ' + e.message, 'error');
    }
}

// Open section under specific branch
async function openBranchSection(agencyId, targetUrl) {
    if (agencyId !== myActiveAgencyId) {
        localStorage.setItem('eb_active_agencyId', agencyId);
        await db.collection('users').doc(myUid).update({ agencyId: agencyId });
    }
    window.location.href = targetUrl;
}

// ============================================
// ➕ REGISTER / CONNECT NEW BRANCH
// ============================================
document.getElementById('registerBranchBtn').addEventListener('click', async () => {
    // 1. Capacity limit check
    if (ownedBranches.length >= maxBranchesAllowed) {
        Swal.fire({
            icon: 'warning',
            title: '🔒 Branch Limit Reached!',
            html: `Aap ka package max <b>${maxBranchesAllowed} branches</b> allow karta hai.<br><br>
                   <span style="color:#0284c7; font-weight:bold;">💎 Mazid branches add karne ke liye Enterprise Package upgrade karwayein!</span>`,
            confirmButtonText: 'Contact Super Admin',
            confirmButtonColor: '#0284c7'
        });
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: '🏢 Register New Branch',
        html: `
            <div style="text-align:left; font-size:13px;">
                <label><b>Branch / Agency Name *</b></label>
                <input id="swalBrName" class="swal2-input" placeholder="e.g. GS Bag House (Faisalabad Branch)" style="margin-top:4px; margin-bottom:10px;">
                
                <label><b>City / District *</b></label>
                <input id="swalBrCity" class="swal2-input" placeholder="e.g. Faisalabad" style="margin-top:4px; margin-bottom:10px;">
                
                <label><b>Branch Phone / Mobile</b></label>
                <input id="swalBrPhone" class="swal2-input" placeholder="03001234567" style="margin-top:4px; margin-bottom:10px;">

                <label><b>Address / Depot Location</b></label>
                <input id="swalBrAddr" class="swal2-input" placeholder="e.g. Grain Market, Shop 42" style="margin-top:4px; margin-bottom:10px;">

                <label><b>Bill Invoice Prefix (Unique)</b></label>
                <input id="swalBrPrefix" class="swal2-input" placeholder="e.g. FSD-" value="BR${ownedBranches.length + 1}-" style="margin-top:4px;">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '✅ Register Branch',
        confirmButtonColor: '#27ae60',
        preConfirm: () => {
            const name = document.getElementById('swalBrName').value.trim();
            const city = document.getElementById('swalBrCity').value.trim();
            const prefix = document.getElementById('swalBrPrefix').value.trim();
            if (!name) {
                Swal.showValidationMessage('Branch Name lazmi hai!');
                return false;
            }
            if (!city) {
                Swal.showValidationMessage('City lazmi hai!');
                return false;
            }
            return {
                name: name,
                city: city,
                mobile: document.getElementById('swalBrPhone').value.trim(),
                address: document.getElementById('swalBrAddr').value.trim(),
                billPrefix: prefix || `BR${ownedBranches.length + 1}-`
            };
        }
    });

    if (formValues) {
        Swal.fire({ title: 'Creating Branch...', didOpen: () => Swal.showLoading() });
        try {
            const primaryAgency = ownedBranches[0] || {};
            const newAgencyData = {
                name: formValues.name,
                city: formValues.city,
                mobile: formValues.mobile || myUser.mobile || '',
                address: formValues.address,
                ownerUid: myUid,
                ownerEmail: (myUser.email || '').toLowerCase(),
                businessType: primaryAgency.businessType || 'general',
                packageId: primaryAgency.packageId || 'free',
                status: 'active',
                billPrefixes: {
                    stock: formValues.billPrefix
                },
                createdAt: new Date().toISOString(),
                createdBy: myUid
            };

            const docRef = await db.collection('agencies').add(newAgencyData);

            Swal.fire({
                icon: 'success',
                title: '🎉 Branch Registered Successfully!',
                text: `${formValues.name} ab aap ke Multi-Agency Hub mein shamil ho chuki hai!`
            });

            await loadOwnedAgencies();

        } catch (e) {
            console.error('Register branch failed:', e);
            Swal.fire('Error', 'Branch creation failed: ' + e.message, 'error');
        }
    }
});

// Refresh Button
document.getElementById('refreshConsolidatedBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshConsolidatedBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    btn.disabled = true;
    await loadOwnedAgencies();
    btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh All Data';
    btn.disabled = false;
    Swal.fire({
        toast: true, position: 'top-end', showConfirmButton: false,
        timer: 1600, icon: 'success', title: '✅ Multi-Agency Data Synced!'
    });
});

// Print comparison matrix
document.getElementById('printMatrixBtn').addEventListener('click', () => {
    window.print();
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    const res = await Swal.fire({
        title: 'Logout?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        confirmButtonText: 'Yes',
        cancelButtonText: 'Cancel'
    });
    if (res.isConfirmed) {
        await auth.signOut();
        window.location.href = 'auth.html';
    }
});
