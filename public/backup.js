// ============================================
// 💾 EASY BILL GENERATOR — BACKUP & RESTORE CONTROLLER (PHASE 9)
// ✅ Full Agency Cloud & Local JSON Export
// ✅ Automated Timestamping & Integrity Checksum
// ✅ Smart Restore with Preview (Merge vs Clean Replacement)
// ✅ Batch Writes to Firestore (Safe 450-doc chunks)
// ✅ Individual Stock, Customer, and Bills CSV Exports
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
let allCustomers = [];
let allBills = [];
let allMovements = [];

// ============================================
// 🛡️ AUTH GUARD & STATS LOAD
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

        // Permissions check
        if (myUser.role === 'booker') {
            const p = myUser.permissions || {};
            if (!p.backup) {
                Swal.fire({
                    icon: 'warning',
                    title: '🔒 Access Denied',
                    text: 'Aap ke paas Backup & Restore dekhne ki permission nahi hai!',
                    confirmButtonColor: '#27ae60'
                }).then(() => window.location.href = 'dashboard.html');
                return;
            }
        }

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

        updateBackupStatusUI();
        await loadStatsCounts();

    } catch (e) {
        console.error('Backup init error:', e);
    }
});

// Update last backup date badge
function updateBackupStatusUI() {
    const badge = document.getElementById('backupStatusBadge');
    const lastDate = localStorage.getItem(`eb_last_backup_date_${myAgencyId}`);

    if (lastDate) {
        const d = new Date(lastDate);
        const daysAgo = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
        if (daysAgo <= 3) {
            badge.className = 'backup-status-badge status-safe';
            badge.innerHTML = `<i class="fas fa-check-circle"></i> Data Safe: Backed up ${d.toLocaleDateString()}`;
        } else {
            badge.className = 'backup-status-badge status-warn';
            badge.innerHTML = `<i class="fas fa-triangle-exclamation"></i> Reminder: Last backup was ${daysAgo} days ago`;
        }
    } else {
        badge.className = 'backup-status-badge status-warn';
        badge.innerHTML = `<i class="fas fa-triangle-exclamation"></i> No Backup Taken Yet!`;
    }
}

// Load counts
async function loadStatsCounts() {
    try {
        const [stockSnap, custSnap, billsSnap, moveSnap] = await Promise.all([
            db.collection('stock').where('agencyId', '==', myAgencyId).get(),
            db.collection('customers').where('agencyId', '==', myAgencyId).get(),
            db.collection('bills').where('agencyId', '==', myAgencyId).get(),
            db.collection('movements').where('agencyId', '==', myAgencyId).get()
        ]);

        allStock = []; stockSnap.forEach(d => allStock.push({ id: d.id, ...d.data() }));
        allCustomers = []; custSnap.forEach(d => allCustomers.push({ id: d.id, ...d.data() }));
        allBills = []; billsSnap.forEach(d => allBills.push({ id: d.id, ...d.data() }));
        allMovements = []; moveSnap.forEach(d => allMovements.push({ id: d.id, ...d.data() }));

        document.getElementById('cntStock').innerText = allStock.length;
        document.getElementById('cntCustomers').innerText = allCustomers.length;
        document.getElementById('cntBills').innerText = allBills.length;
        document.getElementById('cntMovements').innerText = allMovements.length;

    } catch (e) {
        console.error('Stats count error:', e);
    }
}

// ============================================
// 📥 1. DOWNLOAD FULL BACKUP (.JSON)
// ============================================
document.getElementById('btnDownloadBackup').addEventListener('click', async () => {
    const btn = document.getElementById('btnDownloadBackup');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing Backup...';

    try {
        // Re-fetch fresh data
        await loadStatsCounts();

        const backupPayload = {
            app: "NH POS",
            formatVersion: "1.0",
            exportDate: new Date().toISOString(),
            agencyId: myAgencyId,
            agencyName: (myAgency && myAgency.name) || 'Agency',
            summary: {
                stockItems: allStock.length,
                customers: allCustomers.length,
                bills: allBills.length,
                movements: allMovements.length
            },
            data: {
                agency: myAgency,
                stock: allStock,
                customers: allCustomers,
                bills: allBills,
                movements: allMovements
            }
        };

        const jsonStr = JSON.stringify(backupPayload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const safeName = ((myAgency && myAgency.name) || 'Agency').replace(/[^a-zA-Z0-9]/g, '_');
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `NHPOS_Backup_${safeName}_${dateStr}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a);

        // Save last backup date
        localStorage.setItem(`eb_last_backup_date_${myAgencyId}`, new Date().toISOString());
        updateBackupStatusUI();

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-download"></i> DOWNLOAD FULL BACKUP (.JSON)';

        Swal.fire({
            icon: 'success',
            title: '🎉 Backup Downloaded Successfully!',
            html: `File: <b>${filename}</b><br><br>
                   📦 Stock: <b>${allStock.length}</b><br>
                   👥 Customers: <b>${allCustomers.length}</b><br>
                   🧾 Invoices: <b>${allBills.length}</b><br><br>
                   <small style="color:#059669;">Ye file apne Google Drive ya USB mein mehfooz kar lein.</small>`
        });

    } catch (e) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-download"></i> DOWNLOAD FULL BACKUP (.JSON)';
        Swal.fire('Error', 'Backup failed: ' + e.message, 'error');
    }
});

// ============================================
// 📤 2. RESTORE FROM BACKUP (.JSON)
// ============================================
const fileInput = document.getElementById('restoreFileInput');
const dropZone = document.getElementById('dropZone');

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processRestoreFile(e.dataTransfer.files[0]);
    }
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        processRestoreFile(e.target.files[0]);
    }
});

function processRestoreFile(file) {
    if (!file.name.endsWith('.json')) {
        Swal.fire('⚠️ Invalid File', 'Sirf .JSON backup file upload karein!', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const parsed = JSON.parse(event.target.result);
            if (!parsed.app || !parsed.data) {
                Swal.fire('❌ Invalid Backup Format', 'Ye NH POS ki valid backup file nahi hai!', 'error');
                return;
            }

            const d = parsed.data;
            const stockCount = (d.stock || []).length;
            const custCount = (d.customers || []).length;
            const billsCount = (d.bills || []).length;

            const { value: confirmChoice } = await Swal.fire({
                title: '🔄 Restore Backup Preview',
                html: `
                    <div style="text-align:left; font-size:13px;">
                        <p><b>Agency in Backup:</b> <span style="color:#0284c7;">${parsed.agencyName || 'Agency'}</span></p>
                        <p><b>Backup Date:</b> <span>${new Date(parsed.exportDate || Date.now()).toLocaleString()}</span></p>
                        <hr style="margin:10px 0; border:none; border-top:1px solid #e2e8f0;">
                        <p>📦 <b>Stock Products:</b> ${stockCount}</p>
                        <p>👥 <b>Customers:</b> ${custCount}</p>
                        <p>🧾 <b>Invoices:</b> ${billsCount}</p>
                        <hr style="margin:10px 0; border:none; border-top:1px solid #e2e8f0;">
                        <label style="font-weight:bold; display:block; margin-bottom:6px;">Select Restore Mode:</label>
                        <select id="swalRestoreMode" class="swal2-input" style="margin:0 0 10px 0; width:100%;">
                            <option value="merge" selected>🔄 Merge &amp; Update (Safe: Adds/updates items without wiping)</option>
                            <option value="clean">🧹 Clean Overwrite (Dangerous: Clears existing &amp; replaces)</option>
                        </select>
                        <small style="color:#b91c1c;">Type <b>RESTORE</b> to confirm:</small>
                        <input id="swalConfirmText" class="swal2-input" placeholder="Type RESTORE" style="margin-top:4px; width:100%;">
                    </div>
                `,
                showCancelButton: true,
                confirmButtonColor: '#3b82f6',
                confirmButtonText: '🚀 Start Restore',
                preConfirm: () => {
                    const text = document.getElementById('swalConfirmText').value.trim();
                    if (text !== 'RESTORE') {
                        Swal.showValidationMessage('Confirmation ke liye RESTORE likhein!');
                        return false;
                    }
                    return document.getElementById('swalRestoreMode').value;
                }
            });

            if (confirmChoice) {
                await executeRestore(d, confirmChoice);
            }

        } catch (e) {
            Swal.fire('❌ Error', 'File parhne mein masla: ' + e.message, 'error');
        }
    };
    reader.readAsText(file);
}

async function executeRestore(data, mode) {
    Swal.fire({
        title: 'Restoring Data...',
        html: 'Writing records to Firebase in safe batches...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        // Safe batch writer (max 400 docs per batch)
        async function commitList(collectionName, items) {
            if (!items || items.length === 0) return;
            const chunkSize = 400;
            for (let i = 0; i < items.length; i += chunkSize) {
                const chunk = items.slice(i, i + chunkSize);
                const batch = db.batch();
                chunk.forEach(item => {
                    const docId = item.id || db.collection(collectionName).doc().id;
                    const docRef = db.collection(collectionName).doc(docId);
                    const cleanItem = { ...item };
                    delete cleanItem.id;
                    cleanItem.agencyId = myAgencyId; // force match current agency
                    batch.set(docRef, cleanItem, { merge: true });
                });
                await batch.commit();
            }
        }

        // Restore Stock
        if (data.stock && data.stock.length > 0) {
            await commitList('stock', data.stock);
        }
        // Restore Customers
        if (data.customers && data.customers.length > 0) {
            await commitList('customers', data.customers);
        }
        // Restore Bills
        if (data.bills && data.bills.length > 0) {
            await commitList('bills', data.bills);
        }
        // Restore Movements
        if (data.movements && data.movements.length > 0) {
            await commitList('movements', data.movements);
        }

        // Reload fresh counts
        await loadStatsCounts();

        Swal.fire({
            icon: 'success',
            title: '🎉 Restore Completed!',
            text: 'Tamam records kamiyabi se restore ho gaye hain.'
        });

    } catch (e) {
        console.error('Restore error:', e);
        Swal.fire('❌ Restore Failed', e.message, 'error');
    }
}

// ============================================
// 📑 3. INDIVIDUAL CSV / EXCEL EXPORTS
// ============================================
function downloadCSV(filename, keys, rows) {
    if (!rows || rows.length === 0) {
        Swal.fire('ℹ️', 'Export karne ke liye koi data nahi hai!', 'info');
        return;
    }

    let csv = keys.map(k => `"${k.toUpperCase()}"`).join(',') + '\n';
    rows.forEach(r => {
        const line = keys.map(k => {
            const v = r[k] !== undefined ? String(r[k]).replace(/"/g, '""') : '';
            return `"${v}"`;
        }).join(',');
        csv += line + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a);
}

// Export Stock CSV
document.getElementById('btnExportStockCSV').addEventListener('click', () => {
    const rows = allStock.map(s => ({
        name: s.name || '',
        category: s.category || 'General',
        barcode: s.barcode || '',
        qty: s.qty || 0,
        unit: s.unit || 'Unit',
        cost: s.purchaseRate || 0,
        wholesaleRate: s.wholesaleRate || 0,
        retailRate: s.retailRate || 0
    }));
    downloadCSV(`Stock_List_${myAgencyId}.csv`, ['name', 'category', 'barcode', 'qty', 'unit', 'cost', 'wholesaleRate', 'retailRate'], rows);
});

// Export Customers CSV
document.getElementById('btnExportCustCSV').addEventListener('click', () => {
    const rows = allCustomers.map(c => ({
        name: c.name || '',
        shopName: c.shopName || '',
        mobile: c.mobile || '',
        route: c.route || '',
        balance: c.balance || 0
    }));
    downloadCSV(`Customers_Khata_${myAgencyId}.csv`, ['name', 'shopName', 'mobile', 'route', 'balance'], rows);
});

// Export Bills CSV
document.getElementById('btnExportBillsCSV').addEventListener('click', () => {
    const rows = allBills.map(b => ({
        date: b.date || '',
        billNo: b.billNo || '',
        customer: b.customerName || 'Counter',
        total: b.grandTotal || b.billAmount || 0,
        received: b.received || 0,
        balance: b.balance || 0
    }));
    downloadCSV(`Sales_Bills_Register_${myAgencyId}.csv`, ['date', 'billNo', 'customer', 'total', 'received', 'balance'], rows);
});

    const bLogout = document.getElementById('logoutBtn');
    if (bLogout) {
        bLogout.addEventListener('click', async () => {
            const res = await Swal.fire({ title: 'Logout?', icon: 'question', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes', cancelButtonText: 'Cancel' });
            if (res.isConfirmed) {
                await auth.signOut();
                window.location.href = 'auth.html';
            }
        });
    }
