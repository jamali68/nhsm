// ============================================
// 🔔 EASY BILL GENERATOR — LOW STOCK ALERTS & REORDER ENGINE (PHASE 8)
// ✅ Real-time Critical & Low Stock Monitoring
// ✅ Smart Suggested Reorder Quantities & Cost Estimates
// ✅ Quick Incoming Stock Restock without page reload
// ✅ Automated WhatsApp Supplier Purchase Order Slip
// ✅ Web Desktop & Mobile Push Notifications
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
let allStock = [];
let lowStockItems = [];

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
    return m[u] || u || 'Unit';
}

// ============================================
// 🛡️ AUTH GUARD & LOAD
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

        myAgencyId = myUser.agencyId;
        if (!myAgencyId) {
            window.location.href = 'profile.html';
            return;
        }

        try {
            const agDoc = await db.collection('agencies').doc(myAgencyId).get();
            myAgency = agDoc.exists ? agDoc.data() : {};
            const h = document.getElementById('agencyNameHeader');
            if (h && myAgency.name) h.innerText = `🏢 ${myAgency.name}`;
        } catch (e) {}

        setupPushNotificationUI();
        loadStockAndAlerts();

    } catch (e) {
        console.error('Alerts init error:', e);
    }
});

// ============================================
// 📦 LOAD STOCK & COMPUTE ALERTS (LIVE LISTENER)
// ============================================
function loadStockAndAlerts() {
    db.collection('stock')
        .where('agencyId', '==', myAgencyId)
        .onSnapshot((snap) => {
            allStock = [];
            snap.forEach(d => allStock.push({ id: d.id, ...d.data() }));

            computeAlerts();
            populateCategoryFilter();
            renderTable();

            // Save low stock cache for badge synchronization
            localStorage.setItem(`eb_low_stock_count_${myAgencyId}`, lowStockItems.length);
        }, (e) => {
            console.error('Stock alerts error:', e);
        });
}

function computeAlerts() {
    lowStockItems = [];
    let outCount = 0;
    let lowCount = 0;
    let totalReorderCost = 0;

    allStock.forEach(item => {
        const qty = Number(item.qty || 0);
        const limit = item.lowStockLimit !== undefined ? Number(item.lowStockLimit) : 10;
        const cost = Number(item.purchaseRate || item.cost || 0);

        if (qty <= limit) {
            const isOut = qty <= 0;
            if (isOut) outCount++;
            else lowCount++;

            // Smart suggested reorder quantity (Default to replenish to 3x limit or 25 units)
            const targetQty = Math.max(25, limit * 3);
            const suggestedReorder = Math.max(10, targetQty - Math.max(0, qty));
            const estCost = suggestedReorder * cost;
            totalReorderCost += estCost;

            lowStockItems.push({
                ...item,
                qty,
                limit,
                cost,
                isOut,
                suggestedReorder,
                estCost
            });
        }
    });

    // Sort: Out of stock first, then by lowest qty
    lowStockItems.sort((a, b) => a.qty - b.qty);

    document.getElementById('kpiOutStock').innerText = outCount;
    document.getElementById('kpiLowStock').innerText = lowCount;
    document.getElementById('kpiTotalAlerts').innerText = lowStockItems.length;
    document.getElementById('kpiReorderCost').innerText = 'Rs ' + Math.round(totalReorderCost).toLocaleString();
}

function populateCategoryFilter() {
    const sel = document.getElementById('categoryFilter');
    const curVal = sel.value;
    const cats = new Set();
    allStock.forEach(s => {
        if (s.category) cats.add(s.category);
    });

    let html = '<option value="">All Categories</option>';
    cats.forEach(c => {
        html += `<option value="${c}" ${c === curVal ? 'selected' : ''}>${c}</option>`;
    });
    sel.innerHTML = html;
}

// ============================================
// 🎨 RENDER ALERTS TABLE
// ============================================
function renderTable() {
    const tbody = document.getElementById('alertsTbody');
    const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
    const catVal = document.getElementById('categoryFilter').value;
    const sevVal = document.getElementById('severityFilter').value;

    const filtered = lowStockItems.filter(item => {
        if (searchVal) {
            const nameMatch = (item.name || '').toLowerCase().includes(searchVal);
            const barMatch = (item.barcode || '').includes(searchVal);
            if (!nameMatch && !barMatch) return false;
        }
        if (catVal && item.category !== catVal) return false;
        if (sevVal === 'out' && !item.isOut) return false;
        if (sevVal === 'low' && item.isOut) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:35px; color:#15803d; font-weight:bold;">
                    <i class="fas fa-check-circle" style="font-size:26px; color:#10b981; display:block; margin-bottom:8px;"></i>
                    Mashallah! Koi item low stock ya khatam nahi hai. Sara stock theek hai!
                </td>
            </tr>`;
        return;
    }

    let html = '';
    filtered.forEach(it => {
        const badge = it.isOut
            ? `<span class="badge-out"><i class="fas fa-ban"></i> OUT OF STOCK (0)</span>`
            : `<span class="badge-low"><i class="fas fa-triangle-exclamation"></i> LOW (${it.qty} left)</span>`;

        html += `
        <tr>
            <td>
                <b>${it.name}</b>
                ${it.barcode ? `<div style="font-size:11px; color:#64748b;">Code: ${it.barcode}</div>` : ''}
            </td>
            <td><span style="font-size:12px; color:#475569;">${it.category || 'General'}</span></td>
            <td>
                ${badge}
            </td>
            <td><b>${it.limit}</b> ${UNIT_LBL(it.unit)}</td>
            <td style="color:#0284c7; font-weight:800;">
                + ${it.suggestedReorder} ${UNIT_LBL(it.unit)}
            </td>
            <td>Rs ${Math.round(it.estCost).toLocaleString()}</td>
            <td class="btn-action-cell">
                <button class="btn btn-sm" style="background:#10b981; color:#fff;" onclick="quickRestockModal('${it.id}', '${(it.name || '').replace(/'/g, "\\'")}', '${it.unit}', ${it.cost})">
                    <i class="fas fa-plus"></i> Restock
                </button>
                <button class="btn btn-sm" style="background:#0284c7; color:#fff;" onclick="singleItemWhatsAppReorder('${(it.name || '').replace(/'/g, "\\'")}', ${it.suggestedReorder}, '${UNIT_LBL(it.unit)}')">
                    <i class="fab fa-whatsapp"></i> Reorder
                </button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
}

// Search and filter listeners
document.getElementById('searchInput').addEventListener('input', renderTable);
document.getElementById('categoryFilter').addEventListener('change', renderTable);
document.getElementById('severityFilter').addEventListener('change', renderTable);

// ============================================
// ➕ QUICK RESTOCK MODAL (Incoming Stock)
// ============================================
window.quickRestockModal = async function(stockId, itemName, unit, curCost) {
    const { value: formValues } = await Swal.fire({
        title: `➕ Quick Restock: ${itemName}`,
        html: `
            <div style="text-align:left; font-size:13px;">
                <label><b>Incoming Quantity to Add (${UNIT_LBL(unit)}) *</b></label>
                <input id="swalAddQty" type="number" class="swal2-input" placeholder="e.g. 50" min="0.1" step="0.1" style="margin-top:4px; margin-bottom:10px;">
                
                <label><b>Purchase Cost Rate (Rs per unit)</b></label>
                <input id="swalAddCost" type="number" class="swal2-input" value="${curCost}" style="margin-top:4px; margin-bottom:10px;">

                <label><b>Supplier / Note (Optional)</b></label>
                <input id="swalAddNote" class="swal2-input" placeholder="e.g. Bill # 498 from Lahore Wholesaler" style="margin-top:4px;">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '✅ Confirm & Add Stock',
        confirmButtonColor: '#10b981',
        preConfirm: () => {
            const qty = parseFloat(document.getElementById('swalAddQty').value);
            if (!qty || qty <= 0) {
                Swal.showValidationMessage('Valid quantity likhein!');
                return false;
            }
            return {
                qty: qty,
                cost: parseFloat(document.getElementById('swalAddCost').value) || curCost,
                note: document.getElementById('swalAddNote').value.trim()
            };
        }
    });

    if (formValues) {
        try {
            const batch = db.batch();
            const stockRef = db.collection('stock').doc(stockId);

            // Increment quantity
            batch.update(stockRef, {
                qty: firebase.firestore.FieldValue.increment(formValues.qty),
                purchaseRate: formValues.cost,
                updatedAt: new Date().toISOString()
            });

            // Log movement
            const moveRef = db.collection('movements').doc();
            batch.set(moveRef, {
                agencyId: myAgencyId,
                itemName: itemName,
                itemId: stockId,
                qty: formValues.qty,
                type: 'in',
                reason: 'purchase',
                reasonLabel: '📦 Quick Restock',
                note: formValues.note,
                createdBy: myUid,
                createdAt: new Date().toISOString()
            });

            await batch.commit();

            Swal.fire({
                toast: true, position: 'top-end', showConfirmButton: false,
                timer: 2000, icon: 'success', title: `✅ +${formValues.qty} ${itemName} added to stock!`
            });

        } catch (e) {
            Swal.fire('Error', 'Restock failed: ' + e.message, 'error');
        }
    }
};

// ============================================
// 📲 WHATSAPP SUPPLIER PURCHASE ORDER
// ============================================
window.singleItemWhatsAppReorder = function(name, qty, unit) {
    const text = `السلام علیکم!
برائے مہربانی درج ذیل مال فوری بھیجیں:
📦 *${name}* — ${qty} ${unit}

🏢 ایجنسی: *${(myAgency && myAgency.name) || 'My Agency'}*
📱 رابطہ: ${(myUser && myUser.mobile) || ''}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

document.getElementById('btnSupplierWhatsApp').addEventListener('click', () => {
    if (lowStockItems.length === 0) {
        Swal.fire('ℹ️', 'Koi low stock item nahi hai reorder ke liye!', 'info');
        return;
    }

    let text = `🛒 *PURCHASE REORDER LIST*\n`;
    text += `🏢 *${(myAgency && myAgency.name) || 'Agency'}*\n`;
    text += `📅 Date: ${new Date().toLocaleDateString('en-PK')}\n`;
    text += `------------------------------------\n`;
    text += `برائے مہربانی درج ذیل مال جلد از جلد سپلائی فرمائیں:\n\n`;

    lowStockItems.slice(0, 25).forEach((it, idx) => {
        text += `${idx + 1}. *${it.name}* — ضرورت: *${it.suggestedReorder} ${UNIT_LBL(it.unit)}* (موجودہ: ${it.qty})\n`;
    });

    text += `\n------------------------------------\n`;
    text += `کل متوقع لاگت: Rs ${document.getElementById('kpiReorderCost').innerText}\n`;
    text += `شکریہ!`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
});

// Print Checklist
document.getElementById('btnPrintChecklist').addEventListener('click', () => {
    window.print();
});

// ============================================
// 🔔 WEB DESKTOP / MOBILE PUSH NOTIFICATIONS
// ============================================
function setupPushNotificationUI() {
    const btn = document.getElementById('btnTogglePush');
    const txt = document.getElementById('pushStatusText');

    if (!('Notification' in window)) {
        txt.innerText = 'Browser notifications are not supported on this device.';
        btn.style.display = 'none';
        return;
    }

    if (Notification.permission === 'granted') {
        txt.innerHTML = '✅ <b>Push Alerts Active!</b> You will receive notifications when items reach low stock threshold.';
        btn.innerText = '🔔 Push Alerts Enabled';
        btn.disabled = true;
        btn.style.background = '#64748b';
    }

    btn.addEventListener('click', async () => {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
            txt.innerHTML = '✅ <b>Push Alerts Activated!</b>';
            btn.innerText = '🔔 Push Alerts Enabled';
            btn.disabled = true;
            btn.style.background = '#64748b';

            if (lowStockItems.length > 0) {
                new Notification('⚠️ Easy Bill Generator — Low Stock Alert', {
                    body: `${lowStockItems.length} items require immediate restocking!`,
                    icon: 'icon-192.png'
                });
            }
        } else {
            Swal.fire('ℹ️', 'Notification permission deny ho gayi!', 'info');
        }
    });
}

    const alLogout = document.getElementById('logoutBtn');
    if (alLogout) {
        alLogout.addEventListener('click', async () => {
            const res = await Swal.fire({ title: 'Logout?', icon: 'question', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes, Logout' });
            if (res.isConfirmed) {
                await auth.signOut();
                window.location.href = 'auth.html';
            }
        });
    }
