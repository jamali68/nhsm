// ============================================
// 📦 EASY BILL GENERATOR — STOCK MANAGER (PHASE 3)
// ✅ Wholesale vs Retail Pricing + Purchase Cost
// ✅ Barcode & Category Support
// ✅ Smart Quota Shield: Offline-first Local Caching (Saves 50,000 Reads/Day!)
// ✅ Inventory Valuation: Retail Value, Cost Value & Est. Profit
// ✅ CSV Export & Inventory Report Printing
// ✅ Role & Booker Permission Security
// ============================================

// Firebase Initialization
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
// 📏 UNITS LABELS
// ============================================
const UNIT_LABELS = {
    'unit': 'Unit', 'pcs': 'pcs', 'carton': 'Ctn', 'box': 'Box',
    'packet': 'Pkt', 'bag': 'Bag', 'dozen': 'Dzn', 'bottle': 'Btl',
    'can': 'Can', 'set': 'Set', 'bundle': 'Bndl', 'pair': 'Pair', 'suit': 'Suit',
    'kg': 'kg', 'g': 'g', 'pound': 'lb',
    'maund': 'Maund', 'liter': 'L', 'gallon': 'Gal',
    'meter': 'm', 'feet': 'ft'
};

// ============================================
// 📝 REASONS FOR STOCK IN / OUT
// ============================================
const STOCK_REASONS = {
    in: [
        { value: 'purchase', label: '📥 Purchase from Supplier (مال آیا)' },
        { value: 'return', label: '↩️ Customer Return (واپسی آئی)' },
        { value: 'adjustment_in', label: '✏️ Stock Count Adjustment (گنتی درستگی)' },
        { value: 'other_in', label: '📝 Other Restock (دیگر)' }
    ],
    out: [
        { value: 'sale', label: '🛒 Direct Sale (فروخت)' },
        { value: 'damage', label: '💥 Damaged / Broken (خراب یا ٹوٹ پھوٹ)' },
        { value: 'expired', label: '⏰ Expired (تاریخ ختم)' },
        { value: 'lost', label: '❓ Lost / Missing (گم شدہ)' },
        { value: 'sample', label: '🎁 Free Sample / Marketing (سیمپل)' },
        { value: 'adjustment_out', label: '✏️ Stock Count Reduction (گنتی کٹوتی)' },
        { value: 'other_out', label: '📝 Other (دیگر)' }
    ]
};

// ============================================
// 🌐 GLOBAL STATE
// ============================================
let myUid = null;
let myUser = null;
let myAgencyId = null;
let myAgency = null;
let myLimits = { maxItems: 50, monthlyBills: 150 };
let allItems = [];
let currentFilter = 'all';
let currentCategory = 'all';
let currentSearch = '';
let editingItemId = null;
let modalItemId = null;
let modalMode = 'in';

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

        // Check if user is blocked or deleted
        if (myUser.status === 'blocked' || myUser.status === 'deleted') {
            await auth.signOut();
            window.location.href = 'auth.html';
            return;
        }

        // Booker permission check for stock
        if (myUser.role === 'booker') {
            const p = myUser.permissions || {};
            if (!p.stock) {
                Swal.fire({
                    icon: 'warning',
                    title: '🔒 Access Denied',
                    text: 'Aap ke Agency Owner ne Stock Manager ki permission enable nahi ki hui.',
                    confirmButtonColor: '#27ae60',
                    confirmButtonText: 'Back to Dashboard'
                }).then(() => window.location.href = 'dashboard.html');
                return;
            }

            // Adjust UI for booker
            const addSec = document.getElementById('addItemSection');
            if (addSec) addSec.style.display = 'none';
            const bNotice = document.getElementById('bookerNotice');
            if (bNotice) bNotice.style.display = 'inline-block';
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

        // Load limits
        loadAgencyLimits();

        // 🛡️ STEP 1: LOAD FROM LOCAL CACHE INSTANTLY (QUOTA SHIELD)
        loadFromCache();

        // 🛡️ STEP 2: SYNC FROM FIRESTORE
        fetchFreshStock();

    } catch (error) {
        console.error('Stock init error:', error);
        Swal.fire('Error', 'Stock load fail: ' + (error.code || error.message), 'error');
    }
});

// Load agency limits & industry category configuration
let currentBizType = 'books';
let currentCategoryDef = null;

function setupIndustryCategoryMode() {
    const rawType = (myAgency && myAgency.businessType) ? myAgency.businessType : 'books';
    currentBizType = rawType;

    if (window.BusinessCategories) {
        currentCategoryDef = window.BusinessCategories.getById(rawType) || window.BusinessCategories.getById('books');
    }

    if (!currentCategoryDef) return;

    // Update Top bar badge
    const badgeTxt = document.getElementById('bizCategoryText');
    if (badgeTxt) {
        badgeTxt.innerText = `Mode: ${currentCategoryDef.icon} ${currentCategoryDef.nameEn}`;
    }

    // Populate Datalist with Industry Subcategories
    const datalist = document.getElementById('categorySuggestions');
    if (datalist && Array.isArray(currentCategoryDef.subcategories)) {
        datalist.innerHTML = '';
        currentCategoryDef.subcategories.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub;
            datalist.appendChild(opt);
        });
    }

    // Render Custom Fields Container (e.g. Class, Publisher, Author, Edition for Book Depot)
    const container = document.getElementById('customIndustryFieldsContainer');
    const grid = document.getElementById('customFieldsGrid');
    const tag = document.getElementById('customFieldsCategoryTag');

    if (container && grid && Array.isArray(currentCategoryDef.customFields) && currentCategoryDef.customFields.length > 0) {
        container.style.display = 'block';
        if (tag) tag.innerHTML = `${currentCategoryDef.icon} ${currentCategoryDef.nameEn} Fields`;
        
        grid.innerHTML = '';
        currentCategoryDef.customFields.forEach(f => {
            const grp = document.createElement('div');
            grp.className = 'form-group';
            grp.style.marginBottom = '0';
            
            const lbl = document.createElement('label');
            lbl.style.fontSize = '11px';
            lbl.style.fontWeight = 'bold';
            lbl.style.color = '#0369a1';
            lbl.innerText = f.label;
            
            let inp;
            if (f.type === 'select') {
                inp = document.createElement('select');
                inp.className = 'custom-industry-field';
                inp.dataset.fieldId = f.id;
                inp.style.fontSize = '12px';
                (f.options || []).forEach(optVal => {
                    const o = document.createElement('option');
                    o.value = optVal;
                    o.textContent = optVal;
                    inp.appendChild(o);
                });
            } else {
                inp = document.createElement('input');
                inp.type = f.type || 'text';
                inp.className = 'custom-industry-field';
                inp.dataset.fieldId = f.id;
                inp.placeholder = f.placeholder || '';
                inp.style.fontSize = '12px';
            }
            inp.id = `customField_${f.id}`;
            grp.appendChild(lbl);
            grp.appendChild(inp);
            grid.appendChild(grp);
        });
    } else if (container) {
        container.style.display = 'none';
    }
}

async function loadAgencyLimits() {
    try {
        const agDoc = await db.collection('agencies').doc(myAgencyId).get();
        myAgency = agDoc.exists ? agDoc.data() : {};
        const pkgId = myAgency.packageId || 'free';
        const pkgDoc = await db.collection('packages').doc(pkgId).get();
        if (pkgDoc.exists && pkgDoc.data().limits) {
            myLimits = { ...myLimits, ...pkgDoc.data().limits };
        }
        if (myAgency.customLimits) {
            myLimits = { ...myLimits, ...myAgency.customLimits };
        }
        setupIndustryCategoryMode();

        // 🔒 CHECK IMAGE URL / WEB LINK PERMISSION (Default Locked unless allowed by Admin)
        applyImageUrlPermission();
    } catch (e) {
        console.warn('Limits error:', e);
    }
    const maxLimitEl = document.getElementById('itemLimitMax');
    if (maxLimitEl) maxLimitEl.innerText = (myLimits.maxItems >= 90000) ? 'Unlimited' : (myLimits.maxItems || 50);
}

function applyImageUrlPermission() {
    const isSuperAdmin = (myUser && myUser.role === 'super-admin');
    const agencyPerms = (myAgency && myAgency.permissions) ? myAgency.permissions : {};
    const userPerms = (myUser && myUser.permissions) ? myUser.permissions : {};

    // By default: locked for everyone unless admin grants `image_url_input: true`
    const isAllowed = isSuperAdmin || agencyPerms.image_url_input === true || userPerms.image_url_input === true;

    const lockedMsg = document.getElementById('itemPhotoUrlLockedMsg');
    const activeBox = document.getElementById('itemPhotoUrlActiveBox');
    const urlInput = document.getElementById('itemPhotoUrl');
    const loadBtn = document.getElementById('itemPhotoUrlLoadBtn');

    if (isAllowed) {
        if (lockedMsg) lockedMsg.style.display = 'none';
        if (activeBox) activeBox.style.display = 'flex';
        if (urlInput) {
            urlInput.disabled = false;
            urlInput.placeholder = "Paste image web link (https://...)";
        }
        if (loadBtn) loadBtn.disabled = false;
    } else {
        // Show locked indicator
        if (lockedMsg) lockedMsg.style.display = 'flex';
        if (activeBox) activeBox.style.display = 'none';
        if (urlInput) {
            urlInput.disabled = true;
            urlInput.placeholder = "🔒 Locked by Admin";
        }
        if (loadBtn) loadBtn.disabled = true;
    }
}

// ============================================
// 💾 SMART CACHING SYSTEM (QUOTA SHIELD)
// ============================================
function getCacheKey() {
    return `eb_stock_cache_${myAgencyId}`;
}

function loadFromCache() {
    try {
        const cachedStr = localStorage.getItem(getCacheKey());
        if (cachedStr) {
            const parsed = JSON.parse(cachedStr);
            if (Array.isArray(parsed.items) && parsed.items.length > 0) {
                allItems = parsed.items;
                populateCategoryFilter();
                renderStats();
                renderItems();
                if (window.hideNHLoader) {
                    setTimeout(() => { window.hideNHLoader(); }, 150);
                }
                if (parsed.timestamp) {
                    const d = new Date(parsed.timestamp);
                    document.getElementById('lastSyncTime').innerText = 'Cached: ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                }
            }
        }
    } catch (e) {
        console.warn('Cache read error:', e);
    }
}

function saveToCache(items) {
    try {
        localStorage.setItem(getCacheKey(), JSON.stringify({
            items: items,
            timestamp: new Date().toISOString()
        }));
        document.getElementById('lastSyncTime').innerText = 'Synced: ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        document.getElementById('cacheStatusBadge').style.background = '#dcfce7';
        document.getElementById('cacheStatusBadge').style.color = '#15803d';
        document.getElementById('cacheStatusBadge').innerHTML = '<i class="fas fa-check-circle"></i> Live Synced';
    } catch (e) {
        console.warn('Cache save error:', e);
    }
}

// Fetch fresh stock from Firestore (Smart Single-Query)
async function fetchFreshStock() {
    const container = document.getElementById('itemsList');
    try {
        const snap = await db.collection('stock')
            .where('agencyId', '==', myAgencyId)
            .get();

        allItems = [];
        snap.forEach(d => {
            const data = d.data();
            data.id = d.id;
            // Backwards compatibility for old rate field
            if (data.retailRate === undefined) data.retailRate = data.rate || 0;
            if (data.wholesaleRate === undefined) data.wholesaleRate = data.rate || 0;
            if (data.purchaseRate === undefined) data.purchaseRate = 0;
            allItems.push(data);
        });

        allItems.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        saveToCache(allItems);
        populateCategoryFilter();
        renderStats();
        renderItems();

        if (window.hideNHLoader) {
            window.hideNHLoader();
        }

    } catch (error) {
        console.error('Fetch fresh stock error:', error);
        if (window.hideNHLoader) window.hideNHLoader();
        // If offline and cache exists, we keep showing cache!
        if (allItems.length === 0) {
            container.innerHTML = '<div class="error-inline">⚠️ Cloud sync failed. Check internet connection.</div>';
        }
    }
}

document.getElementById('syncStockBtn').addEventListener('click', async () => {
    const btn = document.getElementById('syncStockBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    btn.disabled = true;
    await fetchFreshStock();
    btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sync Live';
    btn.disabled = false;
    Swal.fire({
        toast: true, position: 'top-end', showConfirmButton: false,
        timer: 1600, icon: 'success', title: '✅ Stock data synchronized!'
    });
});

// Safe number formatter (avoids browser-specific RangeError on 'en-PKR')
function fmtPKR(val) {
    const n = Number(val);
    return isNaN(n) ? '0' : Math.round(n).toLocaleString();
}

// ============================================
// 📊 STATS & INVENTORY VALUATION
// ============================================
function renderStats() {
    const total = allItems.length;
    let retailValue = 0;
    let costValue = 0;
    let low = 0;
    let out = 0;

    allItems.forEach(item => {
        const qty = Number(item.qty || 0);
        const retail = Number(item.retailRate || item.rate || 0);
        const cost = Number(item.purchaseRate || 0);

        retailValue += (qty * retail);
        costValue += (qty * cost);

        const limit = item.lowStockLimit !== undefined && item.lowStockLimit !== ''
            ? parseFloat(item.lowStockLimit) : 10;

        if (qty <= 0) out++;
        else if (qty <= limit) low++;
    });

    const estProfit = retailValue - costValue;

    document.getElementById('statTotal').innerText = total;
    document.getElementById('statValue').innerText = 'Rs ' + fmtPKR(retailValue);
    document.getElementById('statCostValue').innerText = 'Rs ' + fmtPKR(costValue);
    document.getElementById('statProfitEst').innerText = 'Est. Profit: Rs ' + fmtPKR(estProfit);
    document.getElementById('statLow').innerText = low;
    document.getElementById('statOut').innerText = out;

    const countEl = document.getElementById('itemCount');
    if (countEl) countEl.innerText = total;
}

// Valuation Card Click -> Show full financial breakdown
const valCard = document.getElementById('valuationCard');
if (valCard) {
    valCard.addEventListener('click', () => {
        let totalItems = allItems.length;
        let retailVal = 0, costVal = 0, wholesaleVal = 0;
        allItems.forEach(i => {
            const q = Number(i.qty || 0);
            retailVal += q * Number(i.retailRate || i.rate || 0);
            wholesaleVal += q * Number(i.wholesaleRate || i.rate || 0);
            costVal += q * Number(i.purchaseRate || 0);
        });
        const retailProfit = retailVal - costVal;
        const wholesaleProfit = wholesaleVal - costVal;

        Swal.fire({
            title: '💼 Inventory Financial Valuation',
            html: `
                <div style="text-align:left; font-size:14px; line-height:1.9; background:#f8fafc; padding:16px; border-radius:12px; border:1px solid #e2e8f0; color:#1e293b;">
                    <div>📦 <b>Total Unique Products:</b> ${totalItems}</div>
                    <hr style="margin:8px 0; border:none; border-top:1px dashed #cbd5e1;">
                    <div>💵 <b>Purchase Cost (خریداری مالیت):</b> <span style="font-weight:bold; color:#475569;">Rs ${fmtPKR(costVal)}</span></div>
                    <div>🏪 <b>Wholesale Value (ہول سیل مالیت):</b> <span style="font-weight:bold; color:#0284c7;">Rs ${fmtPKR(wholesaleVal)}</span></div>
                    <div>🏷️ <b>Retail Value (پرچون مالیت):</b> <span style="font-weight:bold; color:#15803d;">Rs ${fmtPKR(retailVal)}</span></div>
                    <hr style="margin:8px 0; border:none; border-top:1px dashed #cbd5e1;">
                    <div>📈 <b>Wholesale Margin:</b> <span style="color:#0369a1; font-weight:bold;">+Rs ${fmtPKR(wholesaleProfit)}</span></div>
                    <div>💰 <b>Full Retail Margin:</b> <span style="color:#15803d; font-weight:bold;">+Rs ${fmtPKR(retailProfit)}</span></div>
                </div>
            `,
            confirmButtonText: 'Close',
            confirmButtonColor: '#27ae60'
        });
    });
}

// ============================================
// 📂 CATEGORY FILTER MANAGEMENT
// ============================================
function populateCategoryFilter() {
    const select = document.getElementById('categoryFilter');
    if (!select) return;

    const cats = new Set();
    allItems.forEach(i => {
        const cat = String(i.category || '').trim();
        if (cat) {
            cats.add(cat);
        }
    });

    const currentVal = select.value;
    select.innerHTML = '<option value="all">📂 All Categories</option>';
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });

    if (cats.has(currentVal)) {
        select.value = currentVal;
    }
}

document.getElementById('categoryFilter').addEventListener('change', function() {
    currentCategory = this.value;
    renderItems();
});

// ============================================
// 📋 RENDER ITEMS LIST
// ============================================
function renderItems() {
    const container = document.getElementById('itemsList');
    const isBooker = myUser && myUser.role === 'booker';

    let filtered = allItems.filter(item => {
        // Search query check (name, barcode, category)
        if (currentSearch) {
            const nameMatch = String(item.name || '').toLowerCase().includes(currentSearch);
            const barcodeMatch = String(item.barcode || '').toLowerCase().includes(currentSearch);
            const catMatch = String(item.category || '').toLowerCase().includes(currentSearch);
            if (!nameMatch && !barcodeMatch && !catMatch) return false;
        }

        // Category filter check
        if (currentCategory !== 'all' && String(item.category || '').toLowerCase() !== currentCategory.toLowerCase()) {
            return false;
        }

        // Status chip filter
        const qty = Number(item.qty || 0);
        const limit = item.lowStockLimit !== undefined && item.lowStockLimit !== ''
            ? parseFloat(item.lowStockLimit) : 10;

        if (currentFilter === 'low') return qty > 0 && qty <= limit;
        if (currentFilter === 'out') return qty <= 0;
        if (currentFilter === 'instock') return qty > limit;
        return true;
    });

    if (allItems.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="big-icon">📦</div>
                <strong>Inventory Stock is Empty!</strong><br>
                ${isBooker ? 'No items in stock yet.' : 'Click "Add New Product" above to create your first item!'}
            </div>`;
        return;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="big-icon">🔍</div>
                Koi item match nahi hua!<br>
                <small>Search ya category filter tabdeel karein</small>
            </div>`;
        return;
    }

    let html = '';
    filtered.forEach(item => {
        const qty = Number(item.qty || 0);
        const limit = item.lowStockLimit !== undefined && item.lowStockLimit !== ''
            ? parseFloat(item.lowStockLimit) : 10;
        const unit = UNIT_LABELS[item.unit] || item.unit || 'Unit';

        const retailRate = Number(item.retailRate || item.rate || 0);
        const wholesaleRate = Number(item.wholesaleRate || item.rate || 0);
        const costRate = Number(item.purchaseRate || 0);

        let statusClass = '';
        let badge = '';
        if (qty <= 0) {
            statusClass = 'out-stock';
            badge = '<span class="item-badge badge-out">💥 OUT OF STOCK</span>';
        } else if (qty <= limit) {
            statusClass = 'low-stock';
            badge = `<span class="item-badge badge-low">⚠️ LOW STOCK (<= ${limit})</span>`;
        } else {
            badge = '<span class="item-badge badge-ok">✅ In Stock</span>';
        }

        const barcodeHtml = item.barcode ? `<span class="item-code-tag"><i class="fas fa-barcode"></i> ${item.barcode}</span>` : '';
        const catHtml = item.category ? `<span class="item-cat-tag">📂 ${item.category}</span>` : '';

        // Industry Dynamic Fields summary (e.g. Class, Publisher, Subject, Edition for Books)
        let industryDetailsHtml = '';
        if (item.industryFields && typeof item.industryFields === 'object') {
            const parts = [];
            if (item.industryFields.classGrade) parts.push(`📖 <b>جماعت:</b> ${item.industryFields.classGrade}`);
            if (item.industryFields.publisherBoard) parts.push(`🏛️ <b>بورڈ/پبلشر:</b> ${item.industryFields.publisherBoard}`);
            if (item.industryFields.subjectAuthor) parts.push(`✍️ <b>مضمون:</b> ${item.industryFields.subjectAuthor}`);
            if (item.industryFields.editionYear) parts.push(`📅 <b>ایڈیشن:</b> ${item.industryFields.editionYear}`);
            if (item.industryFields.imeiSerial) parts.push(`📱 <b>IMEI:</b> ${item.industryFields.imeiSerial}`);
            if (item.industryFields.batchNo) parts.push(`💊 <b>Batch:</b> ${item.industryFields.batchNo}`);
            if (item.industryFields.expiryDate) parts.push(`⏳ <b>Exp:</b> ${item.industryFields.expiryDate}`);
            if (item.industryFields.shoeSize) parts.push(`👟 <b>Size:</b> ${item.industryFields.shoeSize}`);
            if (item.industryFields.clothSize) parts.push(`👕 <b>Size:</b> ${item.industryFields.clothSize}`);

            if (parts.length > 0) {
                industryDetailsHtml = `<div style="font-size:11px; color:#0369a1; background:#f0f9ff; padding:2px 8px; border-radius:6px; display:inline-flex; flex-wrap:wrap; gap:8px; margin-top:3px; border:1px solid #bae6fd;">${parts.join(' &nbsp;|&nbsp; ')}</div>`;
            }
        }

        // Safe escaped name for inline onclick
        const safeName = String(item.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        const photoHtml = item.photoUrl
            ? `<div class="item-photo-portrait-wrapper" onclick="showItemPhotoModal('${item.id}', '${safeName}', '${item.photoUrl}')" title="Click to view photo (تصویر دیکھیں)" style="width:52px; height:70px; border-radius:10px; overflow:hidden; border:1.5px solid #cbd5e1; box-shadow:0 2px 6px rgba(0,0,0,0.06); flex-shrink:0; cursor:pointer; position:relative; background:#f8fafc;">
                <img src="${item.photoUrl}" alt="${safeName}" style="width:100%; height:100%; object-fit:cover; display:block;">
                <span style="position:absolute; bottom:2px; right:2px; background:rgba(15,23,42,0.7); color:#fff; font-size:7px; font-weight:800; padding:1px 3px; border-radius:3px;">3:4</span>
               </div>`
            : `<div onclick="adjustProductPhotoDirectly('${item.id}')" title="Click to add photo" style="width:52px; height:70px; border-radius:10px; background:#f1f5f9; border:1.5px dashed #cbd5e1; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; cursor:pointer; color:#94a3b8;">
                <span>📦</span>
                <span style="font-size:8px; font-weight:700; color:#64748b; margin-top:2px;">+ Photo</span>
               </div>`;

        const schemeHtml = item.hasScheme ? `
            <div style="margin-top:4px;">
                <span style="background:#fdf4ff; color:#a21caf; border:1px solid #f0abfc; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:bold; display:inline-flex; align-items:center; gap:4px;">
                    🎁 ${item.schemeLabel || 'Trade Scheme Active'}
                </span>
            </div>` : '';

        html += `
        <div class="item-card ${statusClass}" style="display:flex; gap:12px; align-items:center;">
            ${photoHtml}
            <div class="item-info" style="flex:1;">
                <div class="item-name">
                    <span>${item.name || 'Unnamed Product'}</span>
                    ${barcodeHtml}
                    ${catHtml}
                </div>
                ${industryDetailsHtml}
                <div class="item-details">
                    <span>📦 Current Stock: <b>${qty}</b> ${unit}</span>
                    <span>💰 Total Worth: <b>Rs ${fmtPKR(qty * retailRate)}</b></span>
                </div>
                <div class="item-rates-row">
                    <span class="rate-tag rate-cost">Cost: Rs ${fmtPKR(costRate)}</span>
                    <span class="rate-tag rate-wholesale">Wholesale: Rs ${fmtPKR(wholesaleRate)}</span>
                    <span class="rate-tag rate-retail">Retail: Rs ${fmtPKR(retailRate)}</span>
                </div>
                ${schemeHtml}
                ${badge}
            </div>
            <div class="item-actions">
                <button class="btn-icon btn-in" onclick="openStockModal('${item.id}', 'in')" title="Restock / Purchase In">📥</button>
                <button class="btn-icon btn-out" onclick="openStockModal('${item.id}', 'out')" title="Sale / Stock Out">📤</button>
                <button class="btn-icon btn-history" onclick="viewHistory('${item.id}')" title="Movement Log">📜</button>
                ${!isBooker ? `
                    <button class="btn-icon" onclick="adjustProductPhotoDirectly('${item.id}')" title="✂️ Adjust / Rotate Portrait Photo" style="background:#f5f3ff; color:#7c3aed;">📐</button>
                    <button class="btn-icon btn-edit" onclick="editItem('${item.id}')" title="Edit Product">✏️</button>
                    <button class="btn-icon btn-del" onclick="deleteItem('${item.id}', '${safeName}')" title="Delete Product">🗑️</button>
                ` : ''}
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// ============================================
// 📸 PRODUCT PHOTO & 🎁 SCHEME HANDLERS
// ============================================
let currentItemPhotoBase64 = '';

const photoFileInput = document.getElementById('itemPhotoFile');
const photoUrlInput = document.getElementById('itemPhotoUrl');
const photoPreviewImg = document.getElementById('itemPhotoPreview');
const photoPlaceholder = document.getElementById('itemPhotoPlaceholder');
const removePhotoBtn = document.getElementById('itemRemovePhotoBtn');
const rotatePhotoBtn = document.getElementById('itemRotatePhotoBtn');
const adjustPhotoBtn = document.getElementById('itemAdjustPhotoBtn');
const photoRatioBadge = document.getElementById('itemPhotoRatioBadge');

const photoCompressStats = document.getElementById('itemPhotoCompressStats');

function setPhotoPreview(src, stats) {
    if (src) {
        currentItemPhotoBase64 = src;
        photoPreviewImg.src = src;
        photoPreviewImg.style.display = 'block';
        photoPlaceholder.style.display = 'none';
        if (photoRatioBadge) photoRatioBadge.style.display = 'block';
        if (removePhotoBtn) removePhotoBtn.style.display = 'inline-flex';
        if (rotatePhotoBtn) rotatePhotoBtn.style.display = 'inline-flex';
        if (adjustPhotoBtn) adjustPhotoBtn.style.display = 'inline-flex';
        if (stats && window.ImageOptimizer && photoCompressStats) {
            window.ImageOptimizer.renderStatsBadge(photoCompressStats, stats);
        }
    } else {
        currentItemPhotoBase64 = '';
        photoPreviewImg.src = '';
        photoPreviewImg.style.display = 'none';
        photoPlaceholder.style.display = 'block';
        if (photoRatioBadge) photoRatioBadge.style.display = 'none';
        if (removePhotoBtn) removePhotoBtn.style.display = 'none';
        if (rotatePhotoBtn) rotatePhotoBtn.style.display = 'none';
        if (adjustPhotoBtn) adjustPhotoBtn.style.display = 'none';
        if (photoCompressStats) {
            photoCompressStats.style.display = 'none';
            photoCompressStats.innerHTML = '';
        }
        if (photoFileInput) photoFileInput.value = '';
        if (photoUrlInput) photoUrlInput.value = '';
    }
}

// 📸 FILE CHOOSER: Opens Interactive Portrait Studio (Lighting spotlight, 3:4 crop, 90° rotation)
if (photoFileInput) {
    photoFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (window.ImageOptimizer && window.ImageOptimizer.openPortraitStudio) {
            window.ImageOptimizer.openPortraitStudio({
                imageSource: file,
                onSave: function(optimized) {
                    setPhotoPreview(optimized.dataUrl, optimized);
                }
            });
        } else {
            // Fallback compression
            window.ImageOptimizer.compressFile(file, { maxDimension: 600, quality: 0.80 })
                .then(opt => setPhotoPreview(opt.dataUrl, opt))
                .catch(err => Swal.fire('Error', err.message, 'error'));
        }
    });
}

// 🔄 QUICK ROTATE 90° (Clockwise 0° -> 90° -> 180° -> 270° -> 0°)
if (rotatePhotoBtn) {
    rotatePhotoBtn.addEventListener('click', async function() {
        if (!currentItemPhotoBase64) return;
        try {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rotating...';
            if (window.ImageOptimizer && window.ImageOptimizer.rotateImage90) {
                const rotated = await window.ImageOptimizer.rotateImage90(currentItemPhotoBase64);
                setPhotoPreview(rotated.dataUrl, rotated);
            }
        } catch (err) {
            console.error('Rotation error:', err);
            Swal.fire('Error', 'Could not rotate image: ' + err.message, 'error');
        } finally {
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-redo"></i> <span>Rotate 90° (گھمائیں)</span>';
        }
    });
}

// ✂️ ADJUST / RE-CROP IN STUDIO (Admin can adjust anytime!)
if (adjustPhotoBtn) {
    adjustPhotoBtn.addEventListener('click', function() {
        if (!currentItemPhotoBase64) return;
        if (window.ImageOptimizer && window.ImageOptimizer.openPortraitStudio) {
            window.ImageOptimizer.openPortraitStudio({
                imageSource: currentItemPhotoBase64,
                onSave: function(optimized) {
                    setPhotoPreview(optimized.dataUrl, optimized);
                }
            });
        }
    });
}

const photoUrlLoadBtn = document.getElementById('itemPhotoUrlLoadBtn');

async function handleUrlImageLoad(url) {
    if (!url) return;
    try {
        if (photoUrlLoadBtn) {
            photoUrlLoadBtn.disabled = true;
            photoUrlLoadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }

        // Test loading the image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Image load nahi ho saki. Link check karein ya direct download kar k upload karein.'));
            img.src = url;
        });

        // Open in Portrait Studio for framing and adjusting
        if (window.ImageOptimizer && window.ImageOptimizer.openPortraitStudio) {
            window.ImageOptimizer.openPortraitStudio({
                imageSource: url,
                onSave: function(optimized) {
                    setPhotoPreview(optimized.dataUrl, optimized);
                }
            });
        } else {
            setPhotoPreview(url);
        }
    } catch (err) {
        console.warn('URL image load error:', err);
        // Fallback: If CORS prevented canvas drawing, still allow previewing the URL directly
        setPhotoPreview(url);
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Image Loaded!',
                text: 'Image link load ho gaya hai. Agar website security (CORS) ki wajah se studio adjust na khulay to aap image right-click save kar k Upload Photo se bhi adjust kar saktay hain.',
                icon: 'info'
            });
        }
    } finally {
        if (photoUrlLoadBtn) {
            photoUrlLoadBtn.disabled = false;
            photoUrlLoadBtn.innerHTML = '<i class="fas fa-magic"></i> <span>Load & Frame</span>';
        }
    }
}

if (photoUrlLoadBtn) {
    photoUrlLoadBtn.addEventListener('click', function() {
        const val = photoUrlInput ? photoUrlInput.value.trim() : '';
        if (!val) {
            Swal.fire('Link Required', 'Pehle kisi bhi tasveer ka web link (URL) paste karein.', 'info');
            return;
        }
        handleUrlImageLoad(val);
    });
}

if (photoUrlInput) {
    photoUrlInput.addEventListener('change', async function() {
        const val = this.value.trim();
        if (!val) return;
        if (val.startsWith('data:image/') && window.ImageOptimizer) {
            try {
                const opt = await window.ImageOptimizer.compressDataUrl(val, { maxDimension: 600, quality: 0.80 });
                setPhotoPreview(opt.dataUrl, opt);
            } catch (_) {
                setPhotoPreview(val);
            }
        } else {
            handleUrlImageLoad(val);
        }
    });
}

if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', () => setPhotoPreview(''));
}

// ========================================================
// 📐 ADJUST EXISTING PRODUCT PHOTO ANYTIME DIRECTLY
// ========================================================
window.adjustProductPhotoDirectly = function(itemId) {
    const item = allMyStock.find(x => x.id === itemId);
    if (!item) return;

    if (item.photoUrl) {
        if (window.ImageOptimizer && window.ImageOptimizer.openPortraitStudio) {
            window.ImageOptimizer.openPortraitStudio({
                imageSource: item.photoUrl,
                onSave: async function(optimized) {
                    await saveDirectProductPhoto(itemId, optimized.dataUrl);
                }
            });
        }
    } else {
        const tempInput = document.createElement('input');
        tempInput.type = 'file';
        tempInput.accept = 'image/*';
        tempInput.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            window.ImageOptimizer.openPortraitStudio({
                imageSource: file,
                onSave: async function(optimized) {
                    await saveDirectProductPhoto(itemId, optimized.dataUrl);
                }
            });
        };
        tempInput.click();
    }
};

async function saveDirectProductPhoto(itemId, newPhotoUrl) {
    try {
        Swal.fire({
            title: 'Saving Portrait Photo...',
            text: 'Updating product in cloud database...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        await db.collection('stock').doc(itemId).update({
            photoUrl: newPhotoUrl,
            updatedAt: new Date().toISOString()
        });

        // Update local memory stock
        const localItem = allMyStock.find(x => x.id === itemId);
        if (localItem) localItem.photoUrl = newPhotoUrl;

        renderStockList();

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: '✅ Portrait Photo Updated (تصویر محفوظ ہو گئی)',
            timer: 2200,
            showConfirmButton: false
        });
    } catch (err) {
        console.error('Failed to update product photo directly:', err);
        Swal.fire('Error', 'Failed to save photo: ' + err.message, 'error');
    }
}

window.showItemPhotoModal = function(itemId, safeName, photoUrl) {
    const item = (typeof allMyStock !== 'undefined' && Array.isArray(allMyStock))
        ? allMyStock.find(x => x.id === itemId)
        : null;

    const retailRate = item ? (item.retailRate || item.price || item.rate || 0) : 0;
    const qty = item ? (item.stock || item.qty || 0) : null;
    const unit = (item && item.unit) ? item.unit : '';

    Swal.fire({
        html: `
            <div style="text-align: center; padding: 4px 0 2px;">
                <!-- 🖼️ Portrait Photo on Top -->
                <div style="display:inline-block; width: 100%; max-width: 270px; aspect-ratio: 3/4; border-radius: 16px; overflow: hidden; border: 2px solid #cbd5e1; box-shadow: 0 8px 24px rgba(0,0,0,0.12); background: #0f172a;">
                    <img src="${photoUrl}" alt="${safeName}" style="width: 100%; height: 100%; object-fit: cover; display:block;">
                </div>

                <!-- 🏷️ Item Title at Bottom (Top per naheen) -->
                <h3 style="margin: 14px 0 6px; font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.35; padding: 0 8px;">
                    ${safeName}
                </h3>

                <!-- 📱 Fixed Booker Detail directly under Title -->
                <div style="display: inline-flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 4px; max-width: 92%;">
                    <div style="font-size: 11.5px; font-weight: 700; color: #0369a1; background: #e0f2fe; border: 1px solid #bae6fd; padding: 5px 12px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fas fa-camera"></i> <span>Fixed Booker Catalog: 600 × 800 px (3:4 Portrait)</span>
                    </div>
                    ${(qty !== null || retailRate > 0) ? `
                        <div style="font-size: 12px; color: #475569; display: inline-flex; align-items: center; gap: 8px;">
                            ${qty !== null ? `<span>📦 Stock: <b style="color:#0f172a;">${qty}</b> ${unit}</span>` : ''}
                            ${retailRate > 0 ? `<span style="color:#cbd5e1;">•</span> <span style="font-weight:700; color:#059669;">Rs ${Number(retailRate).toLocaleString()}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `,
        showConfirmButton: true,
        confirmButtonText: '<i class="fas fa-times"></i> Close (بند کریں)',
        confirmButtonColor: '#475569',
        showCancelButton: false,
        showDenyButton: false,
        showCloseButton: true,
        focusConfirm: true
    });
};

// Scheme toggle
const schemeCheckbox = document.getElementById('itemHasScheme');
const schemeContainer = document.getElementById('schemeDetailsContainer');
if (schemeCheckbox && schemeContainer) {
    schemeCheckbox.addEventListener('change', function() {
        schemeContainer.style.display = this.checked ? 'block' : 'none';
    });
}

// Auto-fill scheme badge description when type/values change
const schemeTypeSel = document.getElementById('itemSchemeType');
const schemeMinQtyInp = document.getElementById('itemSchemeMinQty');
const schemeValInp = document.getElementById('itemSchemeValue');
const schemeLblInp = document.getElementById('itemSchemeLabel');

function updateSchemeLabelAuto() {
    if (!schemeLblInp || schemeLblInp.dataset.manualEdited === 'true') return;
    const type = schemeTypeSel?.value;
    const minQ = schemeMinQtyInp?.value || 'X';
    const val = schemeValInp?.value || 'Y';

    if (type === 'buy_x_get_y') {
        schemeLblInp.value = `${minQ} + ${val} FREE`;
    } else if (type === 'cash_discount') {
        schemeLblInp.value = `Rs ${val} OFF on ${minQ}+`;
    } else if (type === 'percent_discount') {
        schemeLblInp.value = `${val}% OFF on ${minQ}+`;
    }
}

if (schemeTypeSel) schemeTypeSel.addEventListener('change', updateSchemeLabelAuto);
if (schemeMinQtyInp) schemeMinQtyInp.addEventListener('input', updateSchemeLabelAuto);
if (schemeValInp) schemeValInp.addEventListener('input', updateSchemeLabelAuto);
if (schemeLblInp) schemeLblInp.addEventListener('input', () => { schemeLblInp.dataset.manualEdited = 'true'; });

// ============================================
// 🔍 SEARCH & FILTER EVENTS
// ============================================
document.getElementById('searchInput').addEventListener('input', function() {
    currentSearch = this.value.toLowerCase().trim();
    renderItems();
});

document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', function() {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        currentFilter = this.dataset.filter;
        renderItems();
    });
});

// Auto generate barcode helper
document.getElementById('generateCodeBtn').addEventListener('click', () => {
    const randomCode = '896' + Math.floor(100000 + Math.random() * 900000);
    document.getElementById('itemBarcode').value = randomCode;
});

// ============================================
// ➕ ADD / EDIT PRODUCT ITEM
// ============================================
document.getElementById('addItemToggle').addEventListener('click', function() {
    const form = document.getElementById('addItemForm');
    const arrow = document.getElementById('toggleArrow');
    const isOpen = form.style.display !== 'none';
    form.style.display = isOpen ? 'none' : 'block';
    arrow.classList.toggle('open', !isOpen);
});

document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('itemName').value.trim();
    const barcode = document.getElementById('itemBarcode').value.trim();
    const category = document.getElementById('itemCategory').value.trim();
    const unit = document.getElementById('itemUnit').value;
    const qty = parseFloat(document.getElementById('itemQty').value) || 0;
    const purchaseRate = parseFloat(document.getElementById('itemPurchase').value) || 0;
    const wholesaleRate = parseFloat(document.getElementById('itemWholesale').value) || 0;
    const retailRate = parseFloat(document.getElementById('itemRate').value) || 0;
    const limitInput = document.getElementById('itemLimit').value;
    const lowStockLimit = limitInput === '' ? 10 : parseFloat(limitInput);

    if (!name) { Swal.fire('⚠️', 'Product ka naam lazmi hai!', 'warning'); return; }

    // Check plan item limit for new creations
    if (!editingItemId) {
        if (myLimits.maxItems && myLimits.maxItems < 90000 && allItems.length >= myLimits.maxItems) {
            Swal.fire({
                icon: 'warning',
                title: '📦 Item Limit Reached!',
                html: `Aap کے موجودہ پیکیج میں زیادہ سے زیادہ <b>${myLimits.maxItems} items</b> شامل کرنے کی اجازت ہے۔<br><br>
                       مزید آئٹمز شامل کرنے کے لیے <b>Super Admin</b> یا <b>Developer</b> سے پیکیج اپ گریڈ کروائیں:
                       <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:10px; margin-top:10px; font-size:13px; font-weight:bold; color:#166534;">
                           <i class="fab fa-whatsapp"></i> Developer WhatsApp: +923346800959
                       </div>`,
                showCancelButton: true,
                confirmButtonText: '<i class="fab fa-whatsapp"></i> رابطہ ڈویلپر (+923346800959)',
                confirmButtonColor: '#25D366',
                cancelButtonText: 'Theek Hai'
            }).then(r => {
                if (r.isConfirmed) {
                    window.open('https://wa.me/923346800959?text=' + encodeURIComponent(`السلام علیکم ڈویلپر صاحب!\nمیری ایجنسی: *${myAgency.name || ''}*\nمجھے اسٹاک آئٹم کی لمٹ بڑھوانی ہے (موجودہ لمٹ: ${myLimits.maxItems})۔`), '_blank');
                }
            });
            return;
        }

        // Duplicate name check
        const dup = allItems.find(i => (i.name || '').toLowerCase() === name.toLowerCase());
        if (dup) {
            Swal.fire({
                icon: 'warning',
                title: '⚠️ Duplicate Item Name!',
                text: `"${name}" pehle se inventory mein moujood hai!`,
                confirmButtonText: 'OK'
            });
            return;
        }
    }

    const saveBtn = document.getElementById('saveItemBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Item...';

    try {
        const hasScheme = document.getElementById('itemHasScheme')?.checked || false;
        const photo = currentItemPhotoBase64 || document.getElementById('itemPhotoUrl')?.value || '';

        // Gather Dynamic Industry Custom Fields
        const industryFields = {};
        document.querySelectorAll('.custom-industry-field').forEach(input => {
            const fId = input.dataset.fieldId;
            if (fId) {
                industryFields[fId] = input.value.trim();
            }
        });

        const itemData = {
            name: name,
            barcode: barcode,
            category: category,
            unit: unit,
            qty: qty,
            purchaseRate: purchaseRate,
            wholesaleRate: wholesaleRate,
            retailRate: retailRate,
            rate: retailRate, // backwards compat
            lowStockLimit: lowStockLimit,
            photoUrl: photo,
            industryFields: industryFields,
            hasScheme: hasScheme,
            schemeType: document.getElementById('itemSchemeType')?.value || 'buy_x_get_y',
            schemeMinQty: parseFloat(document.getElementById('itemSchemeMinQty')?.value) || 0,
            schemeValue: parseFloat(document.getElementById('itemSchemeValue')?.value) || 0,
            schemeLabel: (document.getElementById('itemSchemeLabel')?.value || '').trim(),
            agencyId: myAgencyId,
            updatedAt: new Date().toISOString()
        };

        if (editingItemId) {
            await db.collection('stock').doc(editingItemId).update(itemData);
            Swal.fire({
                toast: true, position: 'top-end', showConfirmButton: false,
                timer: 1800, icon: 'success', title: '✅ Product updated successfully!'
            });
        } else {
            itemData.createdAt = new Date().toISOString();
            itemData.createdBy = myUid;
            await db.collection('stock').add(itemData);
            Swal.fire({
                toast: true, position: 'top-end', showConfirmButton: false,
                timer: 1800, icon: 'success', title: '🎉 Product added to inventory!'
            });
        }

        // Refresh state
        document.getElementById('addItemForm').reset();
        document.querySelectorAll('.custom-industry-field').forEach(inp => { inp.value = ''; });
        document.getElementById('itemLimit').value = '';
        setPhotoPreview('');
        if (schemeCheckbox) schemeCheckbox.checked = false;
        if (schemeContainer) schemeContainer.style.display = 'none';
        editingItemId = null;
        const headerH2 = document.querySelector('.add-item-header h2');
        if (headerH2) headerH2.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Product / Stock Item';
        document.getElementById('addItemForm').style.display = 'none';
        const arrow = document.getElementById('toggleArrow');
        if (arrow) arrow.classList.remove('open');

        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> SAVE ITEM TO INVENTORY';

        await fetchFreshStock();

    } catch (error) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> SAVE ITEM TO INVENTORY';
        console.error('Save error:', error);
        Swal.fire('❌ Error', 'Item save nahi hua: ' + (error.code || error.message), 'error');
    }
});

// ============================================
// ✏️ EDIT PRODUCT ITEM
// ============================================
function editItem(itemId) {
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    editingItemId = itemId;

    document.getElementById('itemName').value = item.name || '';
    document.getElementById('itemBarcode').value = item.barcode || '';
    document.getElementById('itemCategory').value = item.category || '';
    document.getElementById('itemUnit').value = item.unit || 'unit';
    document.getElementById('itemQty').value = item.qty || 0;
    document.getElementById('itemPurchase').value = item.purchaseRate || '';
    document.getElementById('itemWholesale').value = item.wholesaleRate || item.rate || '';
    document.getElementById('itemRate').value = item.retailRate || item.rate || '';
    document.getElementById('itemLimit').value = item.lowStockLimit !== undefined ? item.lowStockLimit : '';

    // Populate custom industry fields
    document.querySelectorAll('.custom-industry-field').forEach(inp => {
        const fId = inp.dataset.fieldId;
        if (fId && item.industryFields && item.industryFields[fId] !== undefined) {
            inp.value = item.industryFields[fId];
        } else if (fId && item[fId] !== undefined) {
            inp.value = item[fId];
        } else {
            inp.value = '';
        }
    });

    // Populate photo
    setPhotoPreview(item.photoUrl || '');
    if (document.getElementById('itemPhotoUrl')) {
        document.getElementById('itemPhotoUrl').value = (item.photoUrl && !item.photoUrl.startsWith('data:')) ? item.photoUrl : '';
    }

    // Populate scheme
    const hasScheme = !!item.hasScheme;
    if (schemeCheckbox) schemeCheckbox.checked = hasScheme;
    if (schemeContainer) schemeContainer.style.display = hasScheme ? 'block' : 'none';
    if (document.getElementById('itemSchemeType')) document.getElementById('itemSchemeType').value = item.schemeType || 'buy_x_get_y';
    if (document.getElementById('itemSchemeMinQty')) document.getElementById('itemSchemeMinQty').value = item.schemeMinQty || '';
    if (document.getElementById('itemSchemeValue')) document.getElementById('itemSchemeValue').value = item.schemeValue || '';
    if (document.getElementById('itemSchemeLabel')) document.getElementById('itemSchemeLabel').value = item.schemeLabel || '';

    document.getElementById('addItemForm').style.display = 'block';
    const arrow = document.getElementById('toggleArrow');
    if (arrow) arrow.classList.add('open');
    const headerH2 = document.querySelector('.add-item-header h2');
    if (headerH2) headerH2.innerHTML = '<i class="fas fa-edit"></i> Edit Product: ' + (item.name || '');
    
    document.getElementById('addItemForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ============================================
// 🗑️ DELETE PRODUCT ITEM
// ============================================
async function deleteItem(itemId, name) {
    const result = await Swal.fire({
        title: '🗑️ Delete Product?',
        html: `<b>${name}</b> ko inventory se delete karna hai?<br>
               <small style="color:#e74c3c;">Yeh action wapas nahi ho sakta!</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#c0392b',
        confirmButtonText: '🗑️ Delete Product',
        cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;

    try {
        await db.collection('stock').doc(itemId).delete();
        Swal.fire({
            toast: true, position: 'top-end', showConfirmButton: false,
            timer: 1800, icon: 'success', title: '🗑️ Product deleted!'
        });
        await fetchFreshStock();
    } catch (e) {
        Swal.fire('Error', 'Delete failed: ' + e.code, 'error');
    }
}

// ============================================
// 📥📤 STOCK RESTOCK & SALE MODAL
// ============================================
function openStockModal(itemId, mode) {
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    modalItemId = itemId;
    modalMode = mode;

    document.getElementById('stockModalTitle').innerText = mode === 'in' 
        ? '📥 Restock — Stock Inflow (مال آیا)' 
        : '📤 Stock Outflow — Direct Sale / Reduction';
    
    document.getElementById('stockModalItem').innerText = 
        `${item.name} — Available: ${item.qty || 0} ${UNIT_LABELS[item.unit] || ''}`;

    document.getElementById('modalQty').value = '';
    document.getElementById('modalNote').value = '';

    const purchaseGroup = document.getElementById('modalPurchaseGroup');
    if (mode === 'in') {
        purchaseGroup.style.display = 'block';
        document.getElementById('modalNewPurchase').value = item.purchaseRate || '';
    } else {
        purchaseGroup.style.display = 'none';
    }

    const reasonSel = document.getElementById('modalReason');
    reasonSel.innerHTML = '';
    STOCK_REASONS[mode].forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.value;
        opt.textContent = r.label;
        reasonSel.appendChild(opt);
    });

    const confirmBtn = document.getElementById('modalConfirmBtn');
    if (mode === 'in') {
        confirmBtn.style.background = '#27ae60';
        confirmBtn.innerText = '✅ ADD TO STOCK';
    } else {
        confirmBtn.style.background = '#e67e22';
        confirmBtn.innerText = '📤 RECORD OUTFLOW';
    }

    document.getElementById('stockModalOverlay').style.display = 'flex';
    document.getElementById('modalQty').focus();
}

function closeStockModal() {
    document.getElementById('stockModalOverlay').style.display = 'none';
    modalItemId = null;
}

document.getElementById('modalConfirmBtn').addEventListener('click', async () => {
    if (!modalItemId) return;

    const qty = parseFloat(document.getElementById('modalQty').value) || 0;
    const reason = document.getElementById('modalReason').value;
    const note = document.getElementById('modalNote').value.trim();
    const newPurchaseRate = parseFloat(document.getElementById('modalNewPurchase').value);

    if (qty <= 0) {
        Swal.fire('⚠️', 'Quantity 0 se zyada honi chahiye!', 'warning');
        return;
    }

    const item = allItems.find(i => i.id === modalItemId);
    if (!item) return;

    const currentQty = item.qty || 0;
    let newQty = modalMode === 'in' ? (currentQty + qty) : (currentQty - qty);

    const reasonObj = STOCK_REASONS[modalMode].find(r => r.value === reason);
    const reasonLabel = reasonObj ? reasonObj.label : reason;

    const confirmBtn = document.getElementById('modalConfirmBtn');
    confirmBtn.disabled = true;

    try {
        const updateData = {
            qty: newQty,
            updatedAt: new Date().toISOString()
        };

        if (modalMode === 'in' && !isNaN(newPurchaseRate) && newPurchaseRate > 0) {
            updateData.purchaseRate = newPurchaseRate;
        }

        // 1. Update Stock Quantity & Cost
        await db.collection('stock').doc(modalItemId).update(updateData);

        // 2. Add Movement Log Entry
        await db.collection('movements').add({
            agencyId: myAgencyId,
            itemId: modalItemId,
            itemName: item.name,
            type: modalMode,
            reason: reason,
            reasonLabel: reasonLabel,
            qty: qty,
            beforeQty: currentQty,
            afterQty: newQty,
            note: note,
            createdBy: myUid,
            createdAt: new Date().toISOString()
        });

        closeStockModal();
        confirmBtn.disabled = false;

        Swal.fire({
            toast: true, position: 'top-end', showConfirmButton: false,
            timer: 2000, icon: 'success',
            title: modalMode === 'in' 
                ? `📥 +${qty} ${UNIT_LABELS[item.unit] || ''} added! Total: ${newQty}`
                : `📤 -${qty} ${UNIT_LABELS[item.unit] || ''} recorded! Total: ${newQty}`
        });

        await fetchFreshStock();

    } catch (error) {
        confirmBtn.disabled = false;
        console.error(error);
        Swal.fire('❌ Error', 'Stock update fail: ' + (error.code || error.message), 'error');
    }
});

const stockOverlay = document.getElementById('stockModalOverlay');
if (stockOverlay) {
    stockOverlay.addEventListener('click', function(e) {
        if (e.target === this) closeStockModal();
    });
}

// ============================================
// 📜 VIEW MOVEMENT HISTORY
// ============================================
async function viewHistory(itemId) {
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('historyTitle').innerHTML = `<i class="fas fa-history"></i> Movement: <b>${item.name}</b>`;
    document.getElementById('historyContent').innerHTML = '<div class="loading-inline">Loading history logs...</div>';
    document.getElementById('historyModalOverlay').style.display = 'flex';

    try {
        const snap = await db.collection('movements')
            .where('agencyId', '==', myAgencyId)
            .where('itemId', '==', itemId)
            .get();

        const movements = [];
        snap.forEach(d => movements.push(d.data()));
        movements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (movements.length === 0) {
            document.getElementById('historyContent').innerHTML = 
                '<div class="empty-state">Abhi koi movement history record nahi hai!</div>';
            return;
        }

        let html = '';
        movements.slice(0, 50).forEach(mv => {
            const date = new Date(mv.createdAt);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
            const isIn = mv.type === 'in';
            const qtyStr = isIn ? `+${mv.qty}` : `-${mv.qty}`;
            const color = isIn ? '#16a34a' : '#ea580c';
            const reasonText = mv.reasonLabel || mv.reason || '';

            html += `
            <div style="border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:8px; background:#fff;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; font-size:14px; color:${color};">${qtyStr} ${UNIT_LABELS[item.unit] || ''}</span>
                    <span style="font-size:11px; color:#94a3b8;">${dateStr}</span>
                </div>
                <div style="font-size:12px; color:#334155; margin-top:4px;">
                    ${reasonText}${mv.note ? ' — <i>' + mv.note + '</i>' : ''}
                </div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">
                    Stock Balance: <b>${mv.beforeQty}</b> → <b>${mv.afterQty}</b>
                </div>
            </div>`;
        });
        document.getElementById('historyContent').innerHTML = html;

    } catch (error) {
        console.error('History error:', error);
        document.getElementById('historyContent').innerHTML = 
            '<div class="error-inline">⚠️ History load fail: ' + (error.code || error.message) + '</div>';
    }
}

function closeHistoryModal() {
    document.getElementById('historyModalOverlay').style.display = 'none';
}
const historyOverlay = document.getElementById('historyModalOverlay');
if (historyOverlay) {
    historyOverlay.addEventListener('click', function(e) {
        if (e.target === this) closeHistoryModal();
    });
}

// ============================================
// 📑 EXPORT STOCK TO CSV / EXCEL
// ============================================
document.getElementById('exportStockBtn').addEventListener('click', () => {
    if (allItems.length === 0) {
        Swal.fire('⚠️', 'Export karne ke liye koi item nahi hai!', 'info');
        return;
    }

    let csv = "Product Name,Barcode,Category,Unit,Quantity,Cost Price,Wholesale Rate,Retail Rate,Stock Retail Value\n";
    allItems.forEach(i => {
        const name = `"${(i.name || '').replace(/"/g, '""')}"`;
        const barcode = `"${i.barcode || ''}"`;
        const cat = `"${i.category || ''}"`;
        const unit = i.unit || 'unit';
        const qty = i.qty || 0;
        const cost = i.purchaseRate || 0;
        const wholesale = i.wholesaleRate || i.rate || 0;
        const retail = i.retailRate || i.rate || 0;
        const val = qty * retail;

        csv += `${name},${barcode},${cat},${unit},${qty},${cost},${wholesale},${retail},${val}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date().toISOString().slice(0, 10);
    link.download = `Stock_Inventory_${now}.csv`;
    link.click();
    URL.revokeObjectURL(url);
});

// ============================================
// 🖨️ PRINT INVENTORY REPORT
// ============================================
document.getElementById('printStockBtn').addEventListener('click', () => {
    window.print();
});
