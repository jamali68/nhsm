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

// 📱 Interactive List View & Visual Catalogue State (Initialized at top to prevent TDZ)
let catProducts = [];
let catIndex = 0;
let catActiveCategory = 'all';
let catSearchQuery = '';
let catCart = {}; // { [stockId]: { item, qty, rate, total, freeQty, schemeDiscount } }

// State for Interactive List View (View 1)
let listFilterState = {
    search: '',
    category: 'all',
    filter: 'all' // 'all' | 'offers' | 'booked'
};

// ============================================
// 📕 ORDER BOOKER MODE DETECTOR & RECOVERY ENGINE (TOP-LEVEL GLOBAL)
// ============================================
function isOrderBookerMode() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const m = urlParams.get('mode');
        if (m === 'booker' || m === 'order') return true;
        if (m === 'admin' || m === 'pos' || m === 'counter' || m === 'direct') return false;
        if (typeof myUser !== 'undefined' && myUser && myUser.role) {
            return myUser.role === 'booker';
        }
        const storedRole = localStorage.getItem('eb_user_role');
        if (storedRole === 'booker') return true;
        if (storedRole && storedRole !== 'booker') return false;
    } catch (e) {}
    return false;
}
window.isOrderBookerMode = isOrderBookerMode;

function applyBookerModeUI() {
    const isBooker = isOrderBookerMode();
    const regTotals = document.getElementById('regularBillTotalsBox');
    const bookerSec = document.getElementById('bookerRecoverySection');
    const bActions = document.getElementById('billActionBtnsContainer');
    const brandSub = document.querySelector('.brand-sub');
    const topSwitcher = document.getElementById('bookingModeToggleBar');
    const adminModeBadge = document.getElementById('adminModeBadge');
    const interactiveList = document.getElementById('interactiveListSection');
    const interactiveContainer = document.getElementById('interactiveProductsContainer');
    const adminPosSection = document.getElementById('adminPosTableSection');
    const manualRowsWrapper = document.getElementById('manualRowsWrapper');
    const listSticky = document.getElementById('listStickyBottomBar');
    const catSticky = document.getElementById('catStickyBar');
    const topRecoveryBar = document.getElementById('topCustKhataRecoveryBar');
    const bookerCustNotice = document.getElementById('bookerCustNotice');
    const catSection = document.getElementById('catalogueOrderSection');

    if (isBooker) {
        // 📕 ORDER BOOKER MODE (as in User's Screenshot)
        document.body.classList.add('is-order-booker-mode');
        document.body.classList.remove('is-admin-mode');

        if (topSwitcher) topSwitcher.style.display = 'inline-flex';
        if (adminModeBadge) adminModeBadge.style.display = 'none';

        // Show Booker interactive product card list
        if (interactiveList) interactiveList.style.display = 'block';
        if (interactiveContainer) interactiveContainer.style.display = 'flex';

        // Hide Admin manual table rows & classic section
        if (adminPosSection) adminPosSection.style.display = 'none';
        if (manualRowsWrapper) manualRowsWrapper.style.display = 'none';

        // Hide regular financial totals from list view (Subtotal, Discount, Tax, Net Payable)
        if (regTotals) regTotals.style.display = 'none';
        if (bookerSec) bookerSec.style.display = 'none';
        if (bActions) bActions.style.display = 'none';

        // Booker Notice & Recovery Bar
        if (bookerCustNotice) bookerCustNotice.style.display = selectedCustomer ? 'none' : 'flex';
        if (topRecoveryBar) topRecoveryBar.style.display = selectedCustomer ? 'flex' : 'none';

        if (brandSub) brandSub.innerText = `📕 Order Booker Mode: ${(myUser && myUser.name) || 'Staff'}`;
    } else {
        // 🏢 ADMIN / AGENCY OWNER / COUNTER SALE MODE (Previous Classic Design)
        document.body.classList.add('is-admin-mode');
        document.body.classList.remove('is-order-booker-mode');

        // Hide Order Booker top switcher, show Admin Mode badge
        if (topSwitcher) topSwitcher.style.display = 'none';
        if (adminModeBadge) adminModeBadge.style.display = 'inline-flex';
        if (catSection) catSection.style.display = 'none';

        // Hide Order Booker interactive product cards & sticky bottom cart
        if (interactiveList) interactiveList.style.display = 'none';
        if (interactiveContainer) interactiveContainer.style.display = 'none';
        if (listSticky) listSticky.style.display = 'none';
        if (catSticky) catSticky.style.display = 'none';
        if (topRecoveryBar) topRecoveryBar.style.display = 'none';
        if (bookerCustNotice) bookerCustNotice.style.display = 'none';
        if (bookerSec) bookerSec.style.display = 'none';

        // SHOW Admin Classic Rows Table
        if (adminPosSection) adminPosSection.style.display = 'block';
        if (manualRowsWrapper) manualRowsWrapper.style.display = 'block';

        // Ensure at least one item row exists in #itemsRows
        const rowsDiv = document.getElementById('itemsRows');
        if (rowsDiv && rowsDiv.children.length === 0) {
            try { addRow(); } catch (e) {}
        }

        // SHOW Full Financial Totals Box (Subtotal, Discount, Prev Khata, Tax, Grand Total, Cash Received, Remaining Balance)
        if (regTotals) regTotals.style.display = 'block';

        // SHOW Admin Action Buttons (Save & Direct Print, Save Invoice, New Bill)
        if (bActions) bActions.style.display = 'flex';

        if (brandSub) brandSub.innerText = `🏢 Counter POS Billing: ${(myAgency && myAgency.name) || (myUser && myUser.name) || 'Admin'}`;
    }
}
window.applyBookerModeUI = applyBookerModeUI;

function updateBookerRecoveryRemaining() {
    const prevBal = selectedCustomer ? parseFloat(selectedCustomer.balance || 0) : 0;
    const rcvInp = document.getElementById('bookerQuickReceivedInput');
    const rcvVal = rcvInp ? (parseFloat(rcvInp.value) || 0) : 0;
    const remBal = Math.max(0, prevBal - rcvVal);

    const remEl = document.getElementById('bookerRemainingKhataDisplay');
    if (remEl) {
        remEl.innerText = 'Rs ' + remBal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    const sumRec = document.getElementById('sumReceived');
    if (sumRec) {
        sumRec.value = rcvVal;
    }
}
window.updateBookerRecoveryRemaining = updateBookerRecoveryRemaining;

window.applyBookerQuickAmt = function(amt) {
    const rcvInp = document.getElementById('bookerQuickReceivedInput');
    if (!rcvInp) return;
    if (amt === 0) {
        rcvInp.value = '';
    } else {
        const current = parseFloat(rcvInp.value) || 0;
        rcvInp.value = (current + amt).toString();
    }
    updateBookerRecoveryRemaining();
};

window.applyBookerQuickFullAmt = function() {
    const rcvInp = document.getElementById('bookerQuickReceivedInput');
    if (!rcvInp) return;
    const prevBal = selectedCustomer ? parseFloat(selectedCustomer.balance || 0) : 0;
    rcvInp.value = Math.max(0, prevBal).toString();
    updateBookerRecoveryRemaining();
};

window.clearSelectedCustomer = function() {
    selectedCustomer = null;
    updateLockState();
    const custInput = document.getElementById('custNameInput');
    const catInput = document.getElementById('catCustInput');
    const custSuggest = document.getElementById('custSuggest');
    const catSuggest = document.getElementById('catCustSuggest');
    const custInfoBox = document.getElementById('custInfoBox');
    const catInfo = document.getElementById('catCustInfo');
    const topRecoveryBar = document.getElementById('topCustKhataRecoveryBar');

    if (custInput) custInput.value = '';
    if (catInput) catInput.value = '';
    if (custSuggest) custSuggest.classList.remove('show');
    if (catSuggest) catSuggest.classList.remove('show');
    if (custInfoBox) {
        custInfoBox.innerHTML = '';
        custInfoBox.classList.remove('show');
        custInfoBox.style.display = 'none';
    }
    if (catInfo) catInfo.style.display = 'none';
    if (topRecoveryBar) topRecoveryBar.style.display = 'none';

    const bCustBadge = document.getElementById('bookerSelectedCustBadge');
    if (bCustBadge) bCustBadge.innerText = '👤 No shopkeeper selected';
    const bPending = document.getElementById('bookerPendingKhataDisplay');
    if (bPending) bPending.innerText = 'Rs 0.00';
    const bRem = document.getElementById('bookerRemainingKhataDisplay');
    if (bRem) bRem.innerText = 'Rs 0.00';
    const bInp = document.getElementById('bookerQuickReceivedInput');
    if (bInp) bInp.value = '';

    calcTotals();
    syncCatCartToTotals();
    if (typeof renderInteractiveProductList === 'function') {
        renderInteractiveProductList();
    }
};

async function openDirectRecoveryModal() {
    if (!selectedCustomer) {
        Swal.fire({
            icon: 'warning',
            title: 'Select Shopkeeper First',
            text: 'پہلے اوپر دکان دار کا نام منتخب کریں جس سے رقم وصول کرنی ہے!',
            confirmButtonColor: '#0284c7'
        });
        window.focusShopkeeperInput();
        return;
    }

    const c = selectedCustomer;
    const currentBal = parseFloat(c.balance || 0);

    const { value: formValues } = await Swal.fire({
        title: '💵 Receive Payment / ریکوری وصول کریں',
        html: `
            <div style="text-align:left; font-size:12.5px; line-height:1.6; margin-bottom:12px; background:#f8fafc; padding:10px 14px; border-radius:8px; border:1px solid #e2e8f0;">
                <div>👤 <b>Customer:</b> ${c.name} ${c.shopName ? `(${c.shopName})` : ''}</div>
                <div>📱 <b>Mobile:</b> ${c.mobile || '-'}</div>
                <div>💰 <b>Pending Khata:</b> <b style="color:#b45309; font-size:15px;">Rs ${currentBal.toLocaleString()}</b></div>
            </div>
            <div style="text-align:left; margin-bottom:8px;">
                <label style="font-size:12px; font-weight:800; color:#334155;">Amount Received (وصول شدہ رقم) *</label>
                <input id="swalPayAmount" type="number" min="1" step="1" placeholder="Enter amount (e.g. 5000)" 
                       style="width:100%; font-size:18px; font-weight:900; color:#15803d; padding:8px 10px; border:2px solid #86efac; border-radius:8px; margin-top:4px; box-sizing:border-box;">
            </div>
            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:12px;">
                <button type="button" class="quick-rec-chip" onclick="document.getElementById('swalPayAmount').value = 1000">+1,000</button>
                <button type="button" class="quick-rec-chip" onclick="document.getElementById('swalPayAmount').value = 2000">+2,000</button>
                <button type="button" class="quick-rec-chip" onclick="document.getElementById('swalPayAmount').value = 5000">+5,000</button>
                <button type="button" class="quick-rec-chip" onclick="document.getElementById('swalPayAmount').value = 10000">+10,000</button>
                <button type="button" class="quick-rec-chip full" onclick="document.getElementById('swalPayAmount').value = ${currentBal}">Full (${currentBal.toLocaleString()})</button>
            </div>
            <div style="text-align:left; margin-bottom:8px;">
                <label style="font-size:11.5px; font-weight:700; color:#475569;">Payment Method (طریقہ ادائیگی)</label>
                <select id="swalPayMethod" style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; margin-top:4px; font-size:13px; font-weight:600; box-sizing:border-box;">
                    <option value="Cash" selected>💵 Cash (نقد)</option>
                    <option value="Bank Transfer">🏦 Bank Transfer</option>
                    <option value="EasyPaisa / JazzCash">📱 EasyPaisa / JazzCash</option>
                    <option value="Cheque">📜 Cheque</option>
                </select>
            </div>
            <div style="text-align:left;">
                <label style="font-size:11.5px; font-weight:700; color:#475569;">Notes / Remarks (تفصیل)</label>
                <input id="swalPayNote" type="text" placeholder="e.g. Field recovery by order booker" 
                       style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; margin-top:4px; font-size:12px; box-sizing:border-box;">
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        confirmButtonText: '💾 Save Payment (محفوظ کریں)',
        cancelButtonText: 'Cancel',
        didOpen: () => {
            const inp = document.getElementById('swalPayAmount');
            if (inp) {
                const quickVal = parseFloat(document.getElementById('bookerQuickReceivedInput')?.value) || 0;
                if (quickVal > 0) inp.value = quickVal;
                inp.focus();
            }
        },
        preConfirm: () => {
            const amt = parseFloat(document.getElementById('swalPayAmount').value);
            if (!amt || amt <= 0) {
                Swal.showValidationMessage('Raqam likhna lazmi hai!');
                return false;
            }
            return {
                amount: amt,
                method: document.getElementById('swalPayMethod').value,
                note: document.getElementById('swalPayNote').value.trim()
            };
        }
    });

    if (!formValues) return;
    await executeDirectRecoveryPayment(c, formValues.amount, formValues.method, formValues.note);
}
window.openDirectRecoveryModal = openDirectRecoveryModal;

async function saveBookerDirectPayment() {
    if (!selectedCustomer) {
        Swal.fire({
            icon: 'warning',
            title: 'Select Shopkeeper First',
            text: 'پہلے اوپر دکان دار منتخب کریں جس سے رقم وصول کرنی ہے۔',
            confirmButtonColor: '#0284c7'
        });
        window.focusShopkeeperInput();
        return;
    }

    const rcvInp = document.getElementById('bookerQuickReceivedInput');
    const amount = rcvInp ? (parseFloat(rcvInp.value) || 0) : 0;
    if (amount <= 0) {
        openDirectRecoveryModal();
        return;
    }

    await executeDirectRecoveryPayment(selectedCustomer, amount, 'Cash', 'Direct Field Recovery');
}
window.saveBookerDirectPayment = saveBookerDirectPayment;

async function executeDirectRecoveryPayment(c, amount, method = 'Cash', note = '') {
    const currentBal = parseFloat(c.balance || 0);
    const newBal = currentBal - amount;
    const pBillNo = 'PAY-' + Math.floor(10000 + Math.random() * 90000);
    const nowIso = new Date().toISOString();
    const dateStr = nowIso.slice(0, 10);
    const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const payDoc = {
        billNo: pBillNo,
        type: 'payment',
        agencyId: myAgencyId,
        createdBy: myUid,
        bookerName: (myUser && myUser.name) || 'Order Booker',
        bookerMobile: (myUser && myUser.mobile) || '',
        customerId: c.id,
        customerName: c.name,
        customerMobile: c.mobile || '',
        customerShop: c.shopName || '',
        paymentAmount: amount,
        paymentMethod: method,
        note: note || 'Field recovery without order booking',
        items: [{
            name: `Payment Recovery (${method})${note ? ' - ' + note : ''}`,
            qty: 1,
            rate: amount,
            total: amount
        }],
        subTotal: 0,
        discount: 0,
        grandTotal: 0,
        received: amount,
        previousBalance: currentBal,
        balance: newBal,
        date: dateStr,
        time: timeStr,
        createdAt: nowIso
    };

    // 1. If online write to Firestore, else offline queue
    if (navigator.onLine && typeof db !== 'undefined') {
        try {
            await db.collection('customers').doc(c.id).update({
                balance: newBal,
                lastPaymentAt: nowIso,
                lastPaymentAmount: amount,
                updatedAt: nowIso
            });
            const ref = await db.collection('bills').add(payDoc);
            payDoc.id = ref.id;
        } catch (err) {
            console.warn('Online recovery save failed, falling back to offline queue:', err);
            await saveOfflineBill({ ...payDoc, id: 'off_pay_' + Date.now(), localId: 'off_pay_' + Date.now() });
        }
    } else {
        await saveOfflineBill({ ...payDoc, id: 'off_pay_' + Date.now(), localId: 'off_pay_' + Date.now() });
    }

    // 2. Update in-memory customer and local customer cache
    c.balance = newBal;
    selectedCustomer.balance = newBal;
    const cacheIdx = allMyCustomers.findIndex(x => x.id === c.id);
    if (cacheIdx !== -1) {
        allMyCustomers[cacheIdx].balance = newBal;
    }
    if (myAgencyId) {
        try {
            localStorage.setItem(`eb_cust_cache_${myAgencyId}`, JSON.stringify(allMyCustomers));
        } catch (e) {}
    }

    // 3. Update all UI elements on screen
    const topKhata = document.getElementById('topCustKhataAmount');
    if (topKhata) topKhata.innerText = 'Rs ' + newBal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const bPending = document.getElementById('bookerPendingKhataDisplay');
    if (bPending) bPending.innerText = 'Rs ' + newBal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const bInp = document.getElementById('bookerQuickReceivedInput');
    if (bInp) bInp.value = '';

    const bRem = document.getElementById('bookerRemainingKhataDisplay');
    if (bRem) bRem.innerText = 'Rs ' + newBal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Refresh chips & catalogue
    selectCustomerObject(c);

    // 4. Show success alert with WhatsApp & Print receipt buttons
    Swal.fire({
        icon: 'success',
        title: '✅ رقم وصول ہو گئی!',
        html: `
            <div style="font-size:13.5px; line-height:1.7; text-align:left; background:#f0fdf4; border:1px solid #bbf7d0; padding:12px; border-radius:8px; margin:8px 0;">
                <div><b>Voucher No:</b> <span style="color:#0284c7; font-weight:800;">${pBillNo}</span></div>
                <div><b>Customer:</b> ${c.name} ${c.shopName ? `(${c.shopName})` : ''}</div>
                <div><b>Amount Received:</b> <span style="color:#16a34a; font-weight:900; font-size:16px;">Rs ${amount.toLocaleString()}</span></div>
                <div><b>New Remaining Balance:</b> <span style="color:#b45309; font-weight:900; font-size:16px;">Rs ${newBal.toLocaleString()}</span></div>
            </div>
            <div style="display:flex; gap:8px; justify-content:center; margin-top:10px; flex-wrap:wrap;">
                <button type="button" id="btnShareWaRecovery" class="swal2-confirm swal2-styled" style="background:#25D366; font-size:12px; padding:8px 14px;">
                    <i class="fab fa-whatsapp"></i> WhatsApp Receipt
                </button>
                <button type="button" id="btnPrintVoucherRecovery" class="swal2-confirm swal2-styled" style="background:#0284c7; font-size:12px; padding:8px 14px;">
                    <i class="fas fa-print"></i> Print Receipt
                </button>
            </div>
        `,
        confirmButtonColor: '#10b981',
        confirmButtonText: 'Done / نیا کسٹمر منتخب کریں',
        didOpen: () => {
            const btnWa = document.getElementById('btnShareWaRecovery');
            if (btnWa) {
                btnWa.addEventListener('click', () => {
                    shareDirectPaymentWhatsApp(payDoc, c);
                });
            }
            const btnPr = document.getElementById('btnPrintVoucherRecovery');
            if (btnPr) {
                btnPr.addEventListener('click', () => {
                    printDirectPaymentReceipt(payDoc, c);
                });
            }
        }
    });
}
window.executeDirectRecoveryPayment = executeDirectRecoveryPayment;

function shareDirectPaymentWhatsApp(pay, c) {
    const mob = (c.mobile || '').replace(/[^0-9]/g, '');
    const amt = parseFloat(pay.received || pay.paymentAmount || 0);
    const bal = parseFloat(pay.balance !== undefined ? pay.balance : (c.balance || 0));
    const lines = [];
    lines.push(`💵 *PAYMENT RECEIPT / رسید وصولی*`);
    lines.push(`🏢 *${(myAgency && myAgency.name) || 'Easy Bill POS'}*`);
    lines.push(`🧾 Receipt No: *${pay.billNo}*`);
    lines.push(`👤 Customer: *${c.name}* ${c.shopName ? '(' + c.shopName + ')' : ''}`);
    lines.push(`📅 Date: ${pay.date || '-'} ${pay.time || ''}`);
    lines.push('-----------------------------');
    lines.push(`💰 *Amount Received: Rs ${Math.round(amt).toLocaleString()}*`);
    lines.push(`💳 Mode: ${pay.paymentMethod || 'Cash'}`);
    if (pay.note) lines.push(`📝 Remarks: ${pay.note}`);
    lines.push('-----------------------------');
    lines.push(`⚖️ *Remaining Balance: Rs ${Math.round(bal).toLocaleString()}*`);
    lines.push(`🙏 Wasooli ki tasdeeq ki jati hai. Shukriya!`);

    const text = encodeURIComponent(lines.join('\n'));
    const url = mob 
        ? `https://api.whatsapp.com/send?phone=${mob.startsWith('0') ? '92' + mob.substring(1) : mob}&text=${text}`
        : `https://api.whatsapp.com/send?text=${text}`;
    window.open(url, '_blank');
}
window.shareDirectPaymentWhatsApp = shareDirectPaymentWhatsApp;

function printDirectPaymentReceipt(pay, c) {
    const agencyName = (myAgency && myAgency.name) ? myAgency.name : 'Easy Bill POS';
    const agencyPhone = (myAgency && myAgency.mobile) ? myAgency.mobile : '';
    const amt = parseFloat(pay.received || pay.paymentAmount || 0);
    const bal = parseFloat(pay.balance !== undefined ? pay.balance : (c.balance || 0));
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Receipt - ${pay.billNo}</title>
        <style>
            @media print { @page { size: 80mm auto; margin: 4mm; } }
            body { font-family: monospace, sans-serif; font-size: 12px; margin: 0; padding: 10px; color: #000; }
            .tc { text-align: center; }
            .b { font-weight: bold; }
            .hr { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .amt-box { border: 2px solid #000; padding: 6px; text-align: center; font-size: 14px; font-weight: bold; margin: 8px 0; }
        </style>
    </head>
    <body>
        <div class="tc b" style="font-size:15px;">${agencyName}</div>
        <div class="tc">${agencyPhone ? 'Ph: ' + agencyPhone : ''}</div>
        <div class="tc b" style="margin-top:4px;">*** CASH RECEIPT VOUCHER ***</div>
        <div class="hr"></div>
        <div class="row"><span>Voucher No:</span><b>${pay.billNo}</b></div>
        <div class="row"><span>Date:</span><span>${pay.date} ${pay.time || ''}</span></div>
        <div class="row"><span>Customer:</span><b>${c.name} ${c.shopName ? '(' + c.shopName + ')' : ''}</b></div>
        <div class="row"><span>Payment Mode:</span><b>${pay.paymentMethod || 'Cash'}</b></div>
        <div class="amt-box">AMOUNT: Rs ${Math.round(amt).toLocaleString()} /-</div>
        <div class="row"><span>Remaining Balance:</span><b>Rs ${Math.round(bal).toLocaleString()}</b></div>
        <div class="hr"></div>
        <div class="tc" style="font-size:10px;">Thank you for your payment!</div>
        <script>
            window.onload = function() { window.print(); }
        </script>
    </body>
    </html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
}
window.printDirectPaymentReceipt = printDirectPaymentReceipt;

window.handleBookFieldOrderClick = function() {
    if (!selectedCustomer) {
        Swal.fire({
            icon: 'warning',
            title: 'Select Shopkeeper First',
            text: 'آرڈر بکنگ کے لیے پہلے اوپر دکان دار منتخب کریں!',
            confirmButtonColor: '#0284c7'
        });
        window.focusShopkeeperInput();
        return;
    }
    const entries = Object.values(catCart).filter(e => e.qty > 0);
    if (entries.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'No Items Added',
            html: `
                <div>آرڈر بکنگ کے لیے لسٹ میں سے آئٹمز شامل کریں۔</div>
                <div style="font-size:12px; color:#64748b; margin-top:6px;">
                    اگر کسٹمر نے نیا آرڈر نہیں دیا بلکہ صرف پچھلے کھاتے کی رقم دی ہے تو نیچے <b>"Receive Payment (رقم وصول کریں)"</b> پر کلک کریں۔
                </div>
            `,
            confirmButtonColor: '#10b981',
            confirmButtonText: '💵 Receive Payment Instead',
            showCancelButton: true,
            cancelButtonText: 'Add Items'
        }).then(r => {
            if (r.isConfirmed) {
                openDirectRecoveryModal();
            }
        });
        return;
    }
    openCatalogueReviewModal();
};

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
// 📶 OFFLINE QUEUE HELPERS (POWERED BY INDEXEDDB + LOCALSTORAGE MIRROR)
// ============================================
let cachedOfflineOrders = [];

function getOfflineQueueKey() {
    return `eb_offline_orders_${myAgencyId || 'default'}`;
}

function getOfflineOrders() {
    if (Array.isArray(cachedOfflineOrders) && cachedOfflineOrders.length > 0) {
        return cachedOfflineOrders;
    }
    try {
        const val = localStorage.getItem(getOfflineQueueKey());
        cachedOfflineOrders = val ? JSON.parse(val) : [];
        return cachedOfflineOrders;
    } catch (e) {
        return [];
    }
}

async function initOfflineBillsFromDB() {
    try {
        if (window.BillsDB) {
            const list = await window.BillsDB.getPendingBills(myAgencyId);
            if (Array.isArray(list)) {
                cachedOfflineOrders = list;
            }
        } else {
            getOfflineOrders();
        }
    } catch (e) {
        console.warn('initOfflineBillsFromDB error:', e);
        getOfflineOrders();
    }
    updateOfflineQueueUI();
}

async function saveOfflineBill(billData) {
    if (!billData.localId) {
        billData.localId = 'bill_off_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }
    billData.isOffline = true;
    billData.syncStatus = 'pending';
    billData.agencyId = billData.agencyId || myAgencyId || 'default';
    billData.savedAt = billData.savedAt || new Date().toISOString();

    // 1. Save to IndexedDB
    if (window.BillsDB) {
        try {
            await window.BillsDB.savePendingBill(billData);
        } catch (e) {
            console.warn('BillsDB.savePendingBill error:', e);
        }
    }

    // 2. Update cached array
    const idx = cachedOfflineOrders.findIndex(x => (x.localId && x.localId === billData.localId) || (x.billNo && x.billNo === billData.billNo));
    if (idx >= 0) {
        cachedOfflineOrders[idx] = billData;
    } else {
        cachedOfflineOrders.push(billData);
    }

    // 3. Mirror to localStorage
    try {
        localStorage.setItem(getOfflineQueueKey(), JSON.stringify(cachedOfflineOrders));
    } catch (e) {}

    updateOfflineQueueUI();
    return billData;
}

async function saveOfflineOrders(orders) {
    cachedOfflineOrders = Array.isArray(orders) ? orders : [];
    try {
        localStorage.setItem(getOfflineQueueKey(), JSON.stringify(cachedOfflineOrders));
    } catch (e) {}

    if (window.BillsDB && Array.isArray(orders)) {
        for (const ord of orders) {
            try {
                await window.BillsDB.savePendingBill(ord);
            } catch (e) {}
        }
    }
    updateOfflineQueueUI();
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

// 📦 OFFLINE QUEUE MODAL CONTROLS
function openOfflineQueueModal() {
    const modal = document.getElementById('offlineQueueModal');
    if (!modal) return;
    renderOfflineQueueList();
    modal.style.display = 'flex';
}

function closeOfflineQueueModal() {
    const modal = document.getElementById('offlineQueueModal');
    if (modal) modal.style.display = 'none';
}

async function renderOfflineQueueList() {
    const container = document.getElementById('offlineBillsListContainer');
    const emptyState = document.getElementById('offlineEmptyState');
    if (!container) return;

    let orders = [];
    if (window.BillsDB) {
        try {
            orders = await window.BillsDB.getPendingBills(myAgencyId);
        } catch (e) {
            orders = getOfflineOrders();
        }
    } else {
        orders = getOfflineOrders();
    }

    if (!orders || orders.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    let html = '';
    orders.forEach((b, idx) => {
        const custName = b.customerName || (b.customer && b.customer.name) || 'Counter Sale';
        const billTotal = parseFloat(b.billAmount || b.grandTotal || 0).toLocaleString();
        const itemCount = Array.isArray(b.items) ? b.items.length : 0;
        const timeStr = b.time || (b.savedAt ? new Date(b.savedAt).toLocaleTimeString() : '');
        const dateStr = b.date || (b.savedAt ? new Date(b.savedAt).toLocaleDateString() : '');
        const orderTypeLbl = b.orderType === 'field_order' 
            ? '<span style="background:#fef3c7; color:#92400e; font-size:10px; font-weight:800; padding:2px 6px; border-radius:6px;">📕 Field Order</span>'
            : '<span style="background:#e0f2fe; color:#0369a1; font-size:10px; font-weight:800; padding:2px 6px; border-radius:6px;">🏢 Direct Bill</span>';

        html += `
        <div style="background:#fff; border:1.5px solid #e2e8f0; border-radius:12px; padding:12px 14px; box-shadow:0 1px 3px rgba(0,0,0,0.03); display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <div style="flex:1; min-width:200px;">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                    <span style="font-weight:900; color:#0f172a; font-size:14px;">${b.billNo || ('Bill #' + (idx + 1))}</span>
                    ${orderTypeLbl}
                    <span style="background:#dcfce7; color:#166534; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:6px;">IndexedDB</span>
                </div>
                <div style="font-size:13px; font-weight:800; color:#334155;">
                    👤 ${custName}
                </div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">
                    📦 ${itemCount} Item(s) &bull; 📅 ${dateStr} ${timeStr}
                </div>
            </div>
            <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                <div style="font-size:16px; font-weight:900; color:#0284c7;">
                    Rs ${billTotal}
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="btn-print-off-bill" data-idx="${idx}" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; padding:5px 10px; border-radius:6px; font-size:11.5px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                        <i class="fas fa-print"></i> Print
                    </button>
                    <button type="button" class="btn-del-off-bill" data-id="${b.localId || b.id || b.billNo}" style="background:#fee2e2; color:#ef4444; border:1px solid #fecaca; padding:5px 10px; border-radius:6px; font-size:11.5px; font-weight:bold; cursor:pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;

    // Attach listeners
    container.querySelectorAll('.btn-print-off-bill').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            if (orders[idx]) {
                printBillDirectly(orders[idx]);
            }
        });
    });

    container.querySelectorAll('.btn-del-off-bill').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const res = await Swal.fire({
                title: 'بل ڈیلیٹ کریں؟',
                text: 'کیا آپ واقعی یہ آف لائن بل ضائع کرنا چاہتے ہیں؟',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                confirmButtonText: 'ہاں، ڈیلیٹ کریں',
                cancelButtonText: 'کینسل'
            });
            if (res.isConfirmed) {
                if (window.BillsDB) {
                    await window.BillsDB.removePendingBill(id, myAgencyId);
                }
                cachedOfflineOrders = cachedOfflineOrders.filter(x => x.localId !== id && x.id !== id && x.billNo !== id);
                try {
                    localStorage.setItem(getOfflineQueueKey(), JSON.stringify(cachedOfflineOrders));
                } catch(e) {}
                updateOfflineQueueUI();
                renderOfflineQueueList();
                Swal.fire('Deleted', 'آف لائن بل حذف کر دیا گیا', 'success');
            }
        });
    });
}

// Bind offline modal button triggers
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('viewOfflineQueueBtn')?.addEventListener('click', openOfflineQueueModal);
    document.getElementById('closeOfflineModalBtn')?.addEventListener('click', closeOfflineQueueModal);
    document.getElementById('closeOfflineModalFooterBtn')?.addEventListener('click', closeOfflineQueueModal);
    document.getElementById('modalSyncOfflineBtn')?.addEventListener('click', () => {
        closeOfflineQueueModal();
        syncAllOfflineOrders(true);
    });
    document.getElementById('clearOfflineQueueBtn')?.addEventListener('click', async () => {
        const res = await Swal.fire({
            title: 'سارے آف لائن بلز کلیئر کریں؟',
            text: 'تمام غیر محفوظ شدہ آف لائن بلز لوکل IndexedDB سے ختم ہو جائیں گے۔',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'ہاں، سب کلیئر کریں',
            cancelButtonText: 'منسوخ'
        });
        if (res.isConfirmed) {
            if (window.BillsDB) {
                await window.BillsDB.clearAllPendingBills(myAgencyId);
            }
            cachedOfflineOrders = [];
            localStorage.removeItem(getOfflineQueueKey());
            updateOfflineQueueUI();
            renderOfflineQueueList();
            Swal.fire('Cleared', 'تمام آف لائن بلز صاف کر دیے گئے', 'success');
        }
    });
});

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
        if (myUser && myUser.role) {
            localStorage.setItem('eb_user_role', myUser.role);
        }

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

        // 📕 Apply Booker Mode vs Direct Sale UI
        applyBookerModeUI();

        // Setup rate tier buttons
        try {
            setupRateTiers();
        } catch (e) {
            console.warn('setupRateTiers error:', e);
        }

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
            const rowsDiv = document.getElementById('itemsRows');
            if (rowsDiv && rowsDiv.children.length === 0) {
                addRow();
            }
        } catch (e) {
            console.warn('addRow error:', e);
        }

        // Setup Offline queue listener & IndexedDB Pending Bills
        try {
            updateNetworkStatus();
            initOfflineBillsFromDB();
        } catch (e) {
            console.warn('updateNetworkStatus error:', e);
        }

        // 📱 Initialize Visual Catalogue Order Booking System
        try {
            initVisualCatalogue();
        } catch (e) {
            console.warn('initVisualCatalogue error:', e);
        }
        try {
            updateLockState();
        } catch (e) {
            console.warn('updateLockState error:', e);
        }

    } catch (error) {
        console.error('Bills init error:', error);
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
    if (typeof renderInteractiveProductList === 'function') {
        renderInteractiveProductList();
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
// 🔒 SECTION LOCK STATE (ORDER BOOKER PRO)
function updateLockState() {
    const isBooker = myUser && myUser.role === 'booker';
    // Only Order Bookers have the items locked/grayed out when no shopkeeper is selected.
    // Admin, owner, and managers are NEVER locked and can make Counter Sale bills freely.
    const isLocked = isBooker && !selectedCustomer;
    
    const interactiveList = document.getElementById('interactiveListSection');
    const manualRows = document.getElementById('manualRowsWrapper');
    const itemsRows = document.getElementById('itemsRows');
    const addItemBtn = document.getElementById('addItemRowBtn');
    const bookerCustNotice = document.getElementById('bookerCustNotice');
    const catCard = document.getElementById('catCard');
    const catQtyBox = document.querySelector('.cat-qty-box');
    
    if (isLocked) {
        if (interactiveList) interactiveList.classList.add('section-locked');
        if (manualRows) manualRows.classList.add('section-locked');
        if (itemsRows) itemsRows.classList.add('section-locked');
        if (catCard) catCard.classList.add('section-locked');
        if (catQtyBox) catQtyBox.classList.add('section-locked');
        if (addItemBtn) addItemBtn.disabled = true;
        if (bookerCustNotice) bookerCustNotice.style.display = 'flex';
    } else {
        if (interactiveList) interactiveList.classList.remove('section-locked');
        if (manualRows) manualRows.classList.remove('section-locked');
        if (itemsRows) itemsRows.classList.remove('section-locked');
        if (catCard) catCard.classList.remove('section-locked');
        if (catQtyBox) catQtyBox.classList.remove('section-locked');
        if (addItemBtn) addItemBtn.disabled = false;
        if (bookerCustNotice) bookerCustNotice.style.display = 'none';
    }
}

function selectCustomerObject(c) {
    if (!c) return;
    selectedCustomer = c;
    updateLockState();
    const custInput = document.getElementById('custNameInput');
    const catInput = document.getElementById('catCustInput');
    const custSuggest = document.getElementById('custSuggest');
    const catSuggest = document.getElementById('catCustSuggest');
    const custInfoBox = document.getElementById('custInfoBox');

    if (custInput) custInput.value = c.name;
    if (catInput) catInput.value = c.name;
    if (custSuggest) custSuggest.classList.remove('show');
    if (catSuggest) catSuggest.classList.remove('show');

    // 🎯 AUTO-SELECT WHOLESALE vs RETAIL BASED ON CUSTOMER TYPE!
    if (c.customerType === 'wholesale') {
        setRateTier('wholesale', true);
    } else if (c.customerType === 'retail') {
        setRateTier('retail', true);
    }

    // 🇵🇰 NTN & FBR Filer / Non-Filer badge
    const ntnVal = c.ntn || c.custNTN || '';
    const isFiler = c.fbrStatus === 'filer' || (ntnVal && c.fbrStatus !== 'non-filer');
    const prevBal = parseFloat(c.balance || 0);

    let info = '<div class="cust-chips-wrap">';
    const displayName = c.name || c.shopName || 'Customer';
    const displayShop = (c.shopName && c.shopName !== displayName) ? ` (${c.shopName})` : '';
    info += `<span class="c-chip c-chip-shop"><i class="fas fa-user-check"></i> <b>${displayName}${displayShop}</b></span>`;

    if (c.mobile) {
        info += `<span class="c-chip c-chip-phone"><i class="fas fa-phone"></i> ${c.mobile}</span>`;
    }
    if (c.route) {
        info += `<span class="c-chip c-chip-route"><i class="fas fa-map-marker-alt"></i> ${c.route}</span>`;
    }
    if (c.customerType) {
        info += `<span class="c-chip ${c.customerType === 'retail' ? 'tier-retail' : 'tier-wholesale'}">${c.customerType === 'retail' ? '🏷️ Retail' : '🏪 Wholesale'}</span>`;
    }
    if (c.fbrStatus || ntnVal) {
        info += `<span class="c-chip ${isFiler ? 'filer-yes' : 'filer-no'}">${isFiler ? '🟢 Filer' : '🔴 Non-Filer'}</span>`;
    }
    info += `<span class="c-chip c-chip-balance" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a;" title="Previous Balance: Rs ${prevBal.toLocaleString()}">💰 Khata: <b>Rs ${prevBal.toLocaleString()}</b></span>`;
    info += `<button type="button" onclick="clearSelectedCustomer()" style="background:transparent; border:none; color:#ef4444; font-size:10px; font-weight:800; cursor:pointer; padding:1px 6px; margin-left:auto; display:inline-flex; align-items:center; gap:2px;"><i class="fas fa-times-circle"></i> Change</button>`;
    info += '</div>';

    if (custInfoBox) {
        custInfoBox.innerHTML = info;
        custInfoBox.classList.add('show');
        custInfoBox.style.display = 'block';
    }

    // Update Top Khata & Quick Payment Bar (Shown for Booker)
    const topRecoveryBar = document.getElementById('topCustKhataRecoveryBar');
    const topKhataAmt = document.getElementById('topCustKhataAmount');
    if (topRecoveryBar) {
        topRecoveryBar.style.display = isOrderBookerMode() ? 'flex' : 'none';
    }
    if (topKhataAmt) {
        topKhataAmt.innerText = 'Rs ' + prevBal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    // Update Totals box Previous Khata row immediately
    try { calcTotals(); } catch (e) {}

    // Update Booker Recovery Section (below items in list view)
    const bBadge = document.getElementById('bookerSelectedCustBadge');
    if (bBadge) {
        bBadge.innerHTML = `👤 <b>${displayName}${displayShop}</b>`;
    }
    const bPending = document.getElementById('bookerPendingKhataDisplay');
    if (bPending) {
        bPending.innerText = 'Rs ' + prevBal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    updateBookerRecoveryRemaining();

    if (typeof syncCatalogueCustomer === 'function') {
        syncCatalogueCustomer(c);
    }

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

    calcTotals();
    if (typeof renderInteractiveProductList === 'function') {
        renderInteractiveProductList();
    }
}


const DEFAULT_AGENCY_CUSTOMERS = [
    {
        name: "Madina General Store (چوہدری اکرم)",
        shopName: "Madina Store",
        mobile: "03001234567",
        customerType: "wholesale",
        route: "Main Bazar",
        city: "City",
        balance: 12500,
        ntn: "1234567-8",
        fbrStatus: "filer"
    },
    {
        name: "Bismillah Karyana (حاجی اسلم)",
        shopName: "Bismillah Super Store",
        mobile: "03217654321",
        customerType: "wholesale",
        route: "Model Town",
        city: "City",
        balance: 4500,
        ntn: "",
        fbrStatus: "non-filer"
    },
    {
        name: "Al-Rehman Traders (محمد عثمان)",
        shopName: "Al-Rehman Mart",
        mobile: "03339876543",
        customerType: "wholesale",
        route: "College Road",
        city: "City",
        balance: 0,
        ntn: "7654321-0",
        fbrStatus: "filer"
    },
    {
        name: "Tariq Karyana Store (طارق سیٹھ)",
        shopName: "Tariq Traders",
        mobile: "03456789012",
        customerType: "retail",
        route: "Station Road",
        city: "City",
        balance: 8200,
        ntn: "",
        fbrStatus: "non-filer"
    }
];

function handlePopulatedCustomers(custList) {
    if (!Array.isArray(custList) || custList.length === 0) {
        allMyCustomers = DEFAULT_AGENCY_CUSTOMERS.map((c, i) => ({
            ...c,
            id: 'cust_seed_' + i,
            agencyId: myAgencyId || 'default'
        }));
    } else {
        allMyCustomers = custList;
    }
    if (myAgencyId) {
        localStorage.setItem(`eb_cust_cache_${myAgencyId}`, JSON.stringify(allMyCustomers));
        if (window.BillsDB) {
            window.BillsDB.cacheCustomers(myAgencyId, allMyCustomers);
        }
    }
}

function loadCustomers() {
    // 1. Try local cache first
    try {
        const cached = localStorage.getItem(`eb_cust_cache_${myAgencyId}`);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                allMyCustomers = parsed;
            }
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

    // 1b. Try IndexedDB if in-memory list is still empty
    if (allMyCustomers.length === 0 && window.BillsDB) {
        window.BillsDB.getCachedCustomers(myAgencyId).then(list => {
            if (Array.isArray(list) && list.length > 0 && allMyCustomers.length === 0) {
                allMyCustomers = list;
                checkPreselect();
            }
        }).catch(() => {});
    }

    if (!myAgencyId) {
        if (allMyCustomers.length === 0) handlePopulatedCustomers([]);
        return;
    }

    db.collection('customers')
        .where('agencyId', '==', myAgencyId)
        .get()
        .then((snap) => {
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            if (list.length > 0) {
                handlePopulatedCustomers(list);
            } else {
                db.collection('customers').limit(50).get().then(snap2 => {
                    const list2 = [];
                    snap2.forEach(d => {
                        const data = d.data();
                        if (!data.agencyId || data.agencyId === myAgencyId || data.agencyId === 'default') {
                            list2.push({ id: d.id, ...data });
                        }
                    });
                    handlePopulatedCustomers(list2.length > 0 ? list2 : []);
                    checkPreselect();
                }).catch(() => handlePopulatedCustomers([]));
            }
            checkPreselect();
        })
        .catch((e) => {
            console.warn('Customers load:', e.code);
            if (allMyCustomers.length === 0) handlePopulatedCustomers([]);
            checkPreselect();
        });
}

// Customer Input Autocomplete
const custInput = document.getElementById('custNameInput');
const custSuggest = document.getElementById('custSuggest');
const custInfoBox = document.getElementById('custInfoBox');

function renderCustomerSuggestions(matches) {
    if (!custSuggest) return;
    if (!matches || matches.length === 0) {
        custSuggest.classList.remove('show');
        return;
    }
    let html = '';
    matches.slice(0, 8).forEach(c => {
        const typeBadge = c.customerType === 'retail'
            ? `<span style="font-size:10px; font-weight:800; padding:2px 7px; border-radius:10px; background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; margin-left:6px;">🏷️ RETAIL</span>`
            : `<span style="font-size:10px; font-weight:800; padding:2px 7px; border-radius:10px; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; margin-left:6px;">🏪 WHOLESALE</span>`;
        html += `
        <div class="suggest-item" data-id="${c.id}" style="padding:9px 12px; cursor:pointer; border-bottom:1px solid #f1f5f9;">
            <b>👤 ${c.name}</b> ${c.shopName ? `(${c.shopName})` : ''} ${typeBadge}<br>
            <span class="s-sub" style="font-size:11px; color:#64748b;">
                ${c.mobile ? '📱 ' + c.mobile : ''} 
                ${c.route ? ' | 🛣️ ' + c.route : ''}
                | 💰 Bal: <b>Rs ${(c.balance || 0).toLocaleString()}</b>
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
}

custInput?.addEventListener('focus', function() {
    if (!this.value.trim() && allMyCustomers.length > 0) {
        renderCustomerSuggestions(allMyCustomers);
    }
});

custInput?.addEventListener('input', function() {
    const val = this.value.toLowerCase().trim();
    if (!val) {
        selectedCustomer = null;
        updateLockState();
        if (custInfoBox) custInfoBox.classList.remove('show');
        const catInput = document.getElementById('catCustInput');
        if (catInput) catInput.value = '';
        const catInfo = document.getElementById('catCustInfo');
        if (catInfo) catInfo.style.display = 'none';
        calcTotals();
        syncCatCartToTotals();
        renderCustomerSuggestions(allMyCustomers);
        return;
    }

    const matches = allMyCustomers.filter(c =>
        (c.name || '').toLowerCase().includes(val) ||
        (c.mobile || '').includes(val) ||
        (c.shopName || '').toLowerCase().includes(val) ||
        (c.route || '').toLowerCase().includes(val)
    );

    renderCustomerSuggestions(matches);
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
// ============================================
// 📦 STOCK LOADING & DEFAULT AGENCY ITEMS ENGINE
// ============================================
const DEFAULT_AGENCY_ITEMS = [
    {
        name: "Super Basmati Rice 5kg (کرنل باسمتی چاول)",
        category: "Rice & Grains",
        rate: 1450,
        wholesaleRate: 1450,
        retailRate: 1600,
        purchaseRate: 1300,
        unit: "bag",
        qty: 85,
        barcode: "896400112233",
        hasScheme: true,
        schemeType: "buy_x_get_y",
        schemeLabel: "Buy 10 Bags Get 1 Bag Free (10 پر 1 فری)",
        schemeMinQty: 10,
        schemeValue: 1,
        schemeMinAmount: 14500,
        photoUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80"
    },
    {
        name: "Habib Cooking Oil 5 Liter Can (حبیب کوکنگ آئل)",
        category: "Oil & Ghee",
        rate: 2650,
        wholesaleRate: 2650,
        retailRate: 2850,
        purchaseRate: 2450,
        unit: "can",
        qty: 45,
        barcode: "896400223344",
        hasScheme: true,
        schemeType: "flat_discount",
        schemeLabel: "Special Rs 150 Cash OFF on 2 Cans",
        schemeMinQty: 2,
        schemeValue: 150,
        schemeMinAmount: 5300,
        photoUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80"
    },
    {
        name: "Mezan Banaspati Ghee 1kg Pouch (میزان گھی)",
        category: "Oil & Ghee",
        rate: 490,
        wholesaleRate: 490,
        retailRate: 530,
        purchaseRate: 440,
        unit: "packet",
        qty: 120,
        barcode: "896400334455",
        hasScheme: true,
        schemeType: "percent_discount",
        schemeLabel: "5% Extra Discount on 1 Carton (16kg)",
        schemeMinQty: 16,
        schemeValue: 5,
        schemeMinAmount: 7840,
        photoUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&auto=format&fit=crop&q=80"
    },
    {
        name: "Supreme White Sugar 50kg (پریمیم سفید چینی بوری)",
        category: "Sugar & Sweeteners",
        rate: 6800,
        wholesaleRate: 6800,
        retailRate: 7200,
        purchaseRate: 6450,
        unit: "bag",
        qty: 30,
        barcode: "896400445566",
        hasScheme: true,
        schemeType: "flat_discount",
        schemeLabel: "Bulk Wholesale Rate (Rs 200 OFF on 3 Bags)",
        schemeMinQty: 3,
        schemeValue: 200,
        schemeMinAmount: 20400,
        photoUrl: "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=400&auto=format&fit=crop&q=80"
    },
    {
        name: "Chakki Fresh Atta 10kg Bag (چکی خالص آٹا)",
        category: "Flour & Atta",
        rate: 1250,
        wholesaleRate: 1250,
        retailRate: 1380,
        purchaseRate: 1120,
        unit: "bag",
        qty: 90,
        barcode: "896400556677",
        hasScheme: true,
        schemeType: "flat_discount",
        schemeLabel: "Rs 100 Discount on 5 Bags Order",
        schemeMinQty: 5,
        schemeValue: 100,
        schemeMinAmount: 6250,
        photoUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80"
    },
    {
        name: "Tapal Danedar Tea 950g Pouch (ٹپال دانے دار چائے)",
        category: "Tea & Beverages",
        rate: 1520,
        wholesaleRate: 1520,
        retailRate: 1680,
        purchaseRate: 1380,
        unit: "packet",
        qty: 60,
        barcode: "896400667788",
        hasScheme: true,
        schemeType: "flat_discount",
        schemeLabel: "Special Scheme Rs 120 OFF on 6 Packs",
        schemeMinQty: 6,
        schemeValue: 120,
        schemeMinAmount: 9120,
        photoUrl: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80"
    },
    {
        name: "Dal Chana Special 1kg (دال چنا موٹی اسپیشل)",
        category: "Pulses & Lentils",
        rate: 285,
        wholesaleRate: 285,
        retailRate: 320,
        purchaseRate: 250,
        unit: "kg",
        qty: 150,
        barcode: "896400778899",
        hasScheme: false,
        schemeLabel: "",
        photoUrl: "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=400&auto=format&fit=crop&q=80"
    },
    {
        name: "Olpers Milk 1 Liter Pack x 12 (اولپرز دودھ کاٹن)",
        category: "Dairy & Milk",
        rate: 3250,
        wholesaleRate: 3250,
        retailRate: 3480,
        purchaseRate: 3000,
        unit: "carton",
        qty: 40,
        barcode: "896400889900",
        hasScheme: true,
        schemeType: "buy_x_get_y",
        schemeLabel: "Buy 10 Cartons Get 1 Free (10 پر 1 فری)",
        schemeMinQty: 10,
        schemeValue: 1,
        schemeMinAmount: 32500,
        photoUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&auto=format&fit=crop&q=80"
    },
    {
        name: "Fast Charger 25W Type-C (فاسٹ چارجر 25 واٹ)",
        category: "Mobile Accessories",
        rate: 550,
        wholesaleRate: 550,
        retailRate: 850,
        purchaseRate: 380,
        unit: "pcs",
        qty: 70,
        barcode: "896400990011",
        hasScheme: true,
        schemeType: "buy_x_get_y",
        schemeLabel: "Buy 10 Pcs Get 2 Free (10 پر 2 مفت)",
        schemeMinQty: 10,
        schemeValue: 2,
        schemeMinAmount: 5500,
        photoUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400&auto=format&fit=crop&q=80"
    },
    {
        name: "High Bass Earphones / Handsfree (ہینڈز فری پریمیم)",
        category: "Mobile Accessories",
        rate: 190,
        wholesaleRate: 190,
        retailRate: 350,
        purchaseRate: 120,
        unit: "pcs",
        qty: 120,
        barcode: "896400001122",
        hasScheme: true,
        schemeType: "buy_x_get_y",
        schemeLabel: "Buy 20 Pcs Get 3 Free (20 پر 3 مفت)",
        schemeMinQty: 20,
        schemeValue: 3,
        schemeMinAmount: 3800,
        photoUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&auto=format&fit=crop&q=80"
    }
];

function handlePopulatedStock(itemsList) {
    if (!Array.isArray(itemsList) || itemsList.length === 0) {
        // Auto-seed standard store catalog so user never sees '0 products' error!
        allMyStock = DEFAULT_AGENCY_ITEMS.map((it, idx) => ({
            ...it,
            id: 'stk_seed_' + idx,
            agencyId: myAgencyId || 'default'
        }));
        if (myAgencyId && db) {
            try {
                const batch = db.batch();
                DEFAULT_AGENCY_ITEMS.forEach(it => {
                    const docRef = db.collection('stock').doc();
                    batch.set(docRef, { ...it, id: docRef.id, agencyId: myAgencyId, createdAt: new Date().toISOString() });
                });
                batch.commit().catch(e => console.warn('Auto-seed save:', e));
            } catch (e) {}
        }
    } else {
        allMyStock = itemsList.map((it, idx) => ({
            ...it,
            id: String(it.id || it._id || it.stockId || ('stk_' + idx))
        }));
    }
    allMyStock.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (myAgencyId) {
        localStorage.setItem(`eb_stock_cache_${myAgencyId}`, JSON.stringify({ items: allMyStock, timestamp: new Date().toISOString() }));
        if (window.BillsDB) {
            window.BillsDB.cacheStock(myAgencyId, allMyStock);
        }
    }
    if (typeof refreshCatalogueData === 'function') {
        refreshCatalogueData();
    }
}

function loadStock() {
    // 1. Try local stock cache (Quota shield)
    try {
        const cached = localStorage.getItem(`eb_stock_cache_${myAgencyId}`);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed.items) && parsed.items.length > 0) {
                allMyStock = parsed.items.map((it, idx) => ({
                    ...it,
                    id: String(it.id || it._id || it.stockId || ('stk_' + idx))
                }));
            }
        }
    } catch (e) {}

    // 1b. Try IndexedDB cached stock if in-memory list is still empty
    if (allMyStock.length === 0 && window.BillsDB) {
        window.BillsDB.getCachedStock(myAgencyId).then(items => {
            if (Array.isArray(items) && items.length > 0 && allMyStock.length === 0) {
                allMyStock = items;
                if (typeof refreshCatalogueData === 'function') refreshCatalogueData();
            }
        }).catch(() => {});
    }

    if (allMyStock.length > 0 && typeof refreshCatalogueData === 'function') {
        refreshCatalogueData();
    }

    // 2. Fetch fresh stock from Firestore (Smart with fallback)
    if (!myAgencyId) {
        if (allMyStock.length === 0) handlePopulatedStock([]);
        return;
    }

    db.collection('stock')
        .where('agencyId', '==', myAgencyId)
        .get()
        .then((snap) => {
            const items = [];
            snap.forEach(d => {
                const item = { ...d.data(), id: String(d.id || d.data().id || ('stk_' + items.length)) };
                if (item.retailRate === undefined) item.retailRate = item.rate || 0;
                if (item.wholesaleRate === undefined) item.wholesaleRate = item.rate || 0;
                items.push(item);
            });

            if (items.length > 0) {
                handlePopulatedStock(items);
            } else {
                // Check if stock exists without agencyId filter or under general
                db.collection('stock').limit(100).get().then(snap2 => {
                    const items2 = [];
                    snap2.forEach(d => {
                        const it = { ...d.data(), id: String(d.id || d.data().id || ('stk_' + items2.length)) };
                        if (!it.agencyId || it.agencyId === myAgencyId || it.agencyId === 'default') {
                            if (it.retailRate === undefined) it.retailRate = it.rate || 0;
                            if (it.wholesaleRate === undefined) it.wholesaleRate = it.rate || 0;
                            items2.push(it);
                        }
                    });
                    if (items2.length > 0) {
                        handlePopulatedStock(items2);
                    } else {
                        handlePopulatedStock([]); // Auto-seed standard items!
                    }
                }).catch(() => handlePopulatedStock([]));
            }
        })
        .catch((e) => {
            console.warn('Stock load error:', e);
            if (allMyStock.length === 0) handlePopulatedStock([]);
        });
}

// ⚡ Listen for central CloudSync updates
window.addEventListener('eb-data-synced', (e) => {
    if (e.detail && e.detail.agencyId === myAgencyId) {
        if (Array.isArray(e.detail.stock) && e.detail.stock.length > 0) {
            allMyStock = e.detail.stock;
            if (typeof refreshCatalogueData === 'function') refreshCatalogueData();
        }
        if (Array.isArray(e.detail.customers) && e.detail.customers.length > 0) {
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
window.openCameraScanner = openCameraScanner;
window.closeCameraScanner = closeCameraScanner;

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
    const isBooker = isOrderBookerMode();
    const totalPayable = isBooker ? currentBillTotal : (prevBal + currentBillTotal);
    const received = isBooker ? 0 : (parseFloat(document.getElementById('sumReceived').value) || 0);
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
async function executeSaveBill(forceFieldOrder = false, directPrint = false) {
    // Ensure all booked items from List View / Visual Catalogue are synced into itemsRows ONLY for Booker
    if (isOrderBookerMode()) {
        syncCatCartToTableRows();
    }

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

    const isBookerMode = forceFieldOrder || (myUser && myUser.role === 'booker');
    if (isBookerMode && !selectedCustomer) {
        Swal.fire({
            icon: 'warning',
            title: getAppLanguage() === 'en-ur' ? 'دکان دار منتخب کریں' : 'Select Shopkeeper First',
            text: getAppLanguage() === 'en-ur' 
                ? 'آرڈر بکنگ کے لیے پہلے اوپر دکان دار کا نام منتخب کرنا لازمی ہے۔' 
                : 'Please select a shopkeeper above before booking the order.'
        });
        window.focusShopkeeperInput();
        return;
    }

    const rawCustVal = (document.getElementById('custNameInput')?.value || '').trim();
    // For Admin: Counter Sale is automatically used if no customer is selected
    const customerName = selectedCustomer ? selectedCustomer.name : (rawCustVal || 'Counter Sale');
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
    const savePrintBtn = document.getElementById('saveAndPrintBillBtn');
    const bookBtn = document.getElementById('bookFieldOrderBtn');
    if (saveBtn) saveBtn.disabled = true;
    if (savePrintBtn) savePrintBtn.disabled = true;
    if (bookBtn) bookBtn.disabled = true;

    const bookerName = (myUser && myUser.name) ? myUser.name : ((myUser && myUser.email) ? myUser.email.split('@')[0] : 'Staff');
    const bookerMobile = (myUser && myUser.mobile) || '';
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

    // 🌐 CASE 1: OFFLINE MODE (Saved to Local Queue via IndexedDB)
    if (!navigator.onLine) {
        billData.billNo = (isBookerMode ? 'ORD-OFF-' : 'OFF-') + (getOfflineOrders().length + 1) + '-' + Date.now().toString().slice(-4);
        billData.isOffline = true;

        await saveOfflineBill(billData);

        // Adjust local stock cache immediately only if direct sale
        if (!isBookerMode) {
            items.forEach(it => {
                if (it.stockId) {
                    const s = allMyStock.find(x => x.id === it.stockId);
                    if (s) s.qty = (s.qty || 0) - it.qty;
                }
            });
            localStorage.setItem(`eb_stock_cache_${myAgencyId}`, JSON.stringify({ items: allMyStock, timestamp: new Date().toISOString() }));
            if (window.BillsDB) {
                window.BillsDB.cacheStock(myAgencyId, allMyStock);
            }

            if (selectedCustomer) {
                selectedCustomer.balance = balance;
            }
        }

        showSuccessScreen(billData, true);
        if (saveBtn) saveBtn.disabled = false;
        if (savePrintBtn) savePrintBtn.disabled = false;
        if (bookBtn) bookBtn.disabled = false;

        if (directPrint) {
            try {
                printBillDirectly(billData);
            } catch (pErr) {
                console.warn('Direct print error:', pErr);
            }
        }
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
        if (savePrintBtn) savePrintBtn.disabled = false;
        if (bookBtn) bookBtn.disabled = false;

        // 🖨️ DIRECT PRINT IF REQUESTED BY ADMIN
        if (directPrint) {
            try {
                printBillDirectly(billData);
            } catch (pErr) {
                console.warn('Direct print error:', pErr);
            }
        }

    } catch (error) {
        if (saveBtn) saveBtn.disabled = false;
        if (savePrintBtn) savePrintBtn.disabled = false;
        if (bookBtn) bookBtn.disabled = false;
        console.error('Invoice save error:', error);

        // Network loss fallback to IndexedDB
        const isNetworkErr = !navigator.onLine || 
            (error && (error.code === 'unavailable' || error.message?.includes('offline') || error.message?.includes('network') || error.message?.includes('client is offline')));

        if (isNetworkErr) {
            billData.billNo = (isBookerMode ? 'ORD-OFF-' : 'OFF-') + (getOfflineOrders().length + 1) + '-' + Date.now().toString().slice(-4);
            billData.isOffline = true;
            await saveOfflineBill(billData);

            if (!isBookerMode) {
                items.forEach(it => {
                    if (it.stockId) {
                        const s = allMyStock.find(x => x.id === it.stockId);
                        if (s) s.qty = (s.qty || 0) - it.qty;
                    }
                });
                if (window.BillsDB) window.BillsDB.cacheStock(myAgencyId, allMyStock);
                if (selectedCustomer) selectedCustomer.balance = balance;
            }

            showSuccessScreen(billData, true);
            Swal.fire({
                icon: 'warning',
                title: '📶 Offline Saved (IndexedDB)',
                html: `انٹرنیٹ کنکشن منقطع ہونے کی وجہ سے بل لوکل <b>IndexedDB</b> میں محفوظ کر دیا گیا ہے۔<br><br>بل ریفرنس نمبر: <b>${billData.billNo}</b><br>انٹرنیٹ بحال ہونے پر یہ کلاؤڈ پر سنک ہو جائے گا۔`,
                confirmButtonColor: '#d97706'
            });

            if (directPrint) {
                try { printBillDirectly(billData); } catch (e) {}
            }
            return;
        }

        Swal.fire('❌ Error', 'Bill save fail: ' + (error.code || error.message), 'error');
    }
}

// 🖨️ DIRECT BILL PRINT HELPER (Works in Iframe & Desktop/Mobile browsers)
function printBillDirectly(b) {
    const bill = b || lastSavedBill;
    if (!bill) return;

    const tplSelect = document.getElementById('ssTemplateSelect');
    const selectedTemplate = tplSelect ? tplSelect.value : ((typeof myAgency !== 'undefined' && myAgency && myAgency.defaultTemplate) ? myAgency.defaultTemplate : 'template8');

    let billHTML = '';
    try {
        billHTML = (window.buildBillHTML) 
            ? window.buildBillHTML(bill, selectedTemplate)
            : buildFallbackHTML(bill);
    } catch (e) {
        billHTML = buildFallbackHTML(bill);
    }

    try {
        let printIframe = document.getElementById('directPrintIframe');
        if (!printIframe) {
            printIframe = document.createElement('iframe');
            printIframe.id = 'directPrintIframe';
            printIframe.style.position = 'fixed';
            printIframe.style.right = '0';
            printIframe.style.bottom = '0';
            printIframe.style.width = '0';
            printIframe.style.height = '0';
            printIframe.style.border = '0';
            document.body.appendChild(printIframe);
        }
        const doc = printIframe.contentWindow.document;
        doc.open();
        doc.write(billHTML);
        doc.close();
        setTimeout(() => {
            try {
                printIframe.contentWindow.focus();
                printIframe.contentWindow.print();
            } catch (eP) {
                const win = window.open('', '_blank', 'width=800,height=700');
                if (win) {
                    win.document.write(billHTML);
                    win.document.close();
                    setTimeout(() => win.print(), 800);
                }
            }
        }, 500);
    } catch (e) {
        const win = window.open('', '_blank', 'width=800,height=700');
        if (win) {
            win.document.write(billHTML);
            win.document.close();
            setTimeout(() => win.print(), 800);
        }
    }
}
window.printBillDirectly = printBillDirectly;

// Bind Admin and Booker Button Listeners
document.getElementById('saveAndPrintBillBtn')?.addEventListener('click', () => executeSaveBill(false, true));
document.getElementById('saveBillBtn')?.addEventListener('click', () => executeSaveBill(false, false));
document.getElementById('adminNewBillBtn')?.addEventListener('click', () => {
    selectedCustomer = null;
    const custInput = document.getElementById('custNameInput');
    if (custInput) custInput.value = '';
    const custInfoBox = document.getElementById('custInfoBox');
    if (custInfoBox) {
        custInfoBox.innerHTML = '';
        custInfoBox.style.display = 'none';
    }
    const rowsDiv = document.getElementById('itemsRows');
    if (rowsDiv) {
        rowsDiv.innerHTML = '';
        try { addRow(); } catch(e){}
    }
    const sumDisc = document.getElementById('sumDiscount');
    if (sumDisc) sumDisc.value = '0';
    const sumRec = document.getElementById('sumReceived');
    if (sumRec) sumRec.value = '0';
    const taxCheck = document.getElementById('taxEnabled');
    if (taxCheck) taxCheck.checked = false;
    const taxRate = document.getElementById('taxRate');
    if (taxRate) taxRate.value = '0';
    calcTotals();
    previewBillNo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('bookFieldOrderBtn')?.addEventListener('click', () => {
    if (typeof catCart !== 'undefined' && Object.keys(catCart).length > 0) {
        openOrderRecheckModal();
    } else {
        executeSaveBill(true);
    }
});

// ============================================
// 🔄 SYNC OFFLINE ORDERS TO FIRESTORE (INDEXEDDB -> CLOUD)
// ============================================
async function syncAllOfflineOrders(isManual = true) {
    let orders = [];
    if (window.BillsDB) {
        try {
            orders = await window.BillsDB.getPendingBills(myAgencyId);
        } catch (e) {
            orders = getOfflineOrders();
        }
    } else {
        orders = getOfflineOrders();
    }

    if (!orders || orders.length === 0) {
        if (isManual) Swal.fire('ℹ️', 'Koi offline order pending nahi hai!', 'info');
        return;
    }

    if (!navigator.onLine) {
        Swal.fire('⚠️', 'Internet connection nahi hai! Online ho kar sync karein.', 'warning');
        return;
    }

    const btn = document.getElementById('syncOfflineNowBtn');
    const modalSyncBtn = document.getElementById('modalSyncOfflineBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    }
    if (modalSyncBtn) {
        modalSyncBtn.disabled = true;
        modalSyncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    }

    let syncedCount = 0;
    try {
        for (const ord of orders) {
            const liveBillNo = await getNextLiveBillNo();
            const batch = db.batch();

            const billToSync = { ...ord };
            const oldLocalId = billToSync.localId || billToSync.id || billToSync.billNo;
            billToSync.billNo = liveBillNo;
            delete billToSync.isOffline;
            delete billToSync.syncStatus;
            delete billToSync.localId;

            const billRef = db.collection('bills').doc();
            batch.set(billRef, billToSync);

            // Deduct stock if not a booker pending approval
            if (billToSync.orderType !== 'field_order') {
                (billToSync.items || []).forEach(it => {
                    if (it.stockId) {
                        batch.update(db.collection('stock').doc(it.stockId), {
                            qty: firebase.firestore.FieldValue.increment(-it.qty),
                            updatedAt: new Date().toISOString()
                        });
                    }
                });
            }

            // Update customer balance
            if (billToSync.customerId) {
                batch.update(db.collection('customers').doc(billToSync.customerId), {
                    balance: billToSync.balance,
                    lastBillNo: liveBillNo,
                    lastBillAt: new Date().toISOString()
                });
            }

            await batch.commit();
            syncedCount++;

            // Remove synced bill from IndexedDB immediately
            if (window.BillsDB) {
                try {
                    await window.BillsDB.removePendingBill(oldLocalId, myAgencyId);
                } catch(remErr) {}
            }
        }

        // Clear offline orders queue completely
        if (window.BillsDB) {
            await window.BillsDB.clearAllPendingBills(myAgencyId);
        }
        cachedOfflineOrders = [];
        localStorage.removeItem(getOfflineQueueKey());
        updateOfflineQueueUI();
        if (typeof renderOfflineQueueList === 'function') {
            renderOfflineQueueList();
        }

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
        if (modalSyncBtn) {
            modalSyncBtn.disabled = false;
            modalSyncBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sync All to Cloud';
        }
    }
}

document.getElementById('syncOfflineNowBtn')?.addEventListener('click', () => syncAllOfflineOrders(true));

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

    if (window.resetForNextOrder) {
        window.resetForNextOrder();
    } else {
        document.getElementById('custNameInput').value = '';
        document.getElementById('custInfoBox').classList.remove('show');
        document.getElementById('custInfoBox').innerHTML = '';
        selectedCustomer = null;
        updateLockState();

        document.getElementById('sumDiscount').value = '0';
        document.getElementById('sumReceived').value = '0';
        document.getElementById('taxEnabled').checked = false;
        document.getElementById('taxRate').value = '0';

        document.getElementById('itemsRows').innerHTML = '';
        addRow();
        previewBillNo();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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

// (catProducts, catIndex, catActiveCategory, catSearchQuery, catCart, listFilterState initialized at top of file)

// ============================================
// 🌐 LANGUAGE MANAGER (ENGLISH DEFAULT / URDU+ENGLISH)
// ============================================
function getAppLanguage() {
    return localStorage.getItem('eb_app_language') || document.documentElement.getAttribute('data-lang') || 'en';
}

function setAppLanguage(lang) {
    const nextLang = (lang === 'en-ur' || lang === 'ur') ? 'en-ur' : 'en';
    localStorage.setItem('eb_app_language', nextLang);
    document.documentElement.setAttribute('data-lang', nextLang);
    if (document.body) document.body.setAttribute('data-lang', nextLang);

    const toggleBtnText = document.getElementById('langToggleText');
    if (toggleBtnText) {
        toggleBtnText.innerText = nextLang === 'en' ? 'English' : '🇵🇰 اردو + English';
    }

    applyLanguageLabels();
    renderInteractiveProductList();
    renderCatalogueItem();
}

function applyLanguageLabels() {
    const isUrdu = getAppLanguage() === 'en-ur';

    // Top view labels
    const lblList = document.getElementById('lblViewList');
    if (lblList) {
        lblList.innerText = isUrdu ? 'لسٹ ویو (List View)' : 'List View';
    }
    const lblCat = document.getElementById('lblViewCatalogue');
    if (lblCat) {
        lblCat.innerText = isUrdu ? 'ویژول کیٹلاگ (Catalogue)' : 'Visual Catalogue';
    }

    // Rate tier buttons
    const btnWholesale = document.getElementById('btnWholesaleRate');
    if (btnWholesale) {
        btnWholesale.innerHTML = isUrdu 
            ? '<i class="fas fa-store"></i> 🏪 ہول سیل ریٹ (Wholesale)' 
            : '<i class="fas fa-store"></i> Wholesale Rate';
    }
    const btnRetail = document.getElementById('btnRetailRate');
    if (btnRetail) {
        btnRetail.innerHTML = isUrdu 
            ? '<i class="fas fa-tag"></i> 🏷️ پرچون ریٹ (Retail)' 
            : '<i class="fas fa-tag"></i> Retail Rate';
    }

    // Save buttons
    const saveBillBtn = document.getElementById('saveBillBtn');
    if (saveBillBtn) {
        saveBillBtn.innerHTML = isUrdu 
            ? '<i class="fas fa-check-circle"></i> 💾 کاؤنٹر سیل انوائس (Direct Sale)' 
            : '<i class="fas fa-check-circle"></i> 💾 DIRECT SALE INVOICE';
    }
    const bookOrderBtn = document.getElementById('bookFieldOrderBtn');
    if (bookOrderBtn) {
        bookOrderBtn.innerHTML = isUrdu 
            ? '<i class="fas fa-clipboard-check"></i> 📥 فیلڈ آرڈر بکنگ (Book Field Order)' 
            : '<i class="fas fa-clipboard-check"></i> 📥 BOOK FIELD ORDER';
    }

    // Search placeholders
    const listSearch = document.getElementById('listSearchInput');
    if (listSearch) {
        listSearch.placeholder = isUrdu 
            ? '🔍 پروڈکٹ نام، بارکوڈ یا برانڈ سرچ کریں...' 
            : 'Quick search product name, brand or barcode...';
    }
    const catSearch = document.getElementById('catSearchInput');
    if (catSearch) {
        catSearch.placeholder = isUrdu 
            ? '🔍 کیٹلاگ میں پروڈکٹ سرچ کریں...' 
            : 'Quick search catalogue products...';
    }

    // Filter pill labels
    const tAll = document.querySelector('.t-all');
    if (tAll) tAll.innerText = isUrdu ? 'تمام پروڈکٹس' : 'All Products';
    const tOffers = document.querySelector('.t-offers');
    if (tOffers) tOffers.innerText = isUrdu ? 'خصوصی آفرز' : 'Active Offers';
    const tBooked = document.querySelector('.t-booked');
    if (tBooked) tBooked.innerText = isUrdu ? 'بک شدہ آئٹمز' : 'Booked in Cart';

    // Customer & Booker Notice Labels
    const custLabel = document.querySelector('#billFormCard .form-group label');
    if (custLabel) {
        custLabel.innerHTML = isUrdu 
            ? '👤 گاہک / دکان دار منتخب کریں (یا کاؤنٹر سیل) <span class="ur-sub">/ Select Shopkeeper or Counter Sale</span>' 
            : '👤 Select Customer / Shop (or Counter Sale)';
    }
    const bookerNoticeText = document.getElementById('bookerNoticeText');
    if (bookerNoticeText) {
        bookerNoticeText.innerHTML = isUrdu
            ? 'آئٹمز منتخب کرنے کے لیے پہلے اوپر دکان دار منتخب کریں <span class="ur-sub">/ Select Shopkeeper First</span>'
            : 'Please select a shopkeeper above to choose items';
    }
}

function initLanguageManager() {
    const btnToggle = document.getElementById('btnLangToggle');
    if (btnToggle) {
        btnToggle.addEventListener('click', () => {
            const cur = getAppLanguage();
            setAppLanguage(cur === 'en' ? 'en-ur' : 'en');
        });
    }
    setAppLanguage(getAppLanguage());
}

// ============================================
// 🎁 PRO SCHEME & OFFER CALCULATION ENGINE
// ============================================
function computeItemOffer(item, qty, rate, isUrdu) {
    if (!item.hasScheme) {
        return {
            hasOffer: false,
            isUnlocked: false,
            discount: 0,
            freeUnits: 0,
            badgeHtml: ''
        };
    }

    // Determine target limit / threshold in Rupees
    let threshold = parseFloat(item.schemeMinAmount || item.schemeMinSpend);
    if (!threshold) {
        if (item.schemeType === 'flat_discount' && parseFloat(item.schemeMinQty) >= 50) {
            threshold = parseFloat(item.schemeMinQty);
        } else if (item.schemeMinQty) {
            threshold = (parseFloat(item.schemeMinQty) || 10) * (rate || 1);
        } else {
            const m = (item.schemeLabel || '').match(/(?:rs\.?|pkr|on|\+)\s*(\d{3,6})/i) || (item.schemeLabel || '').match(/(\d{3,6})/);
            threshold = m ? parseFloat(m[1]) : 2000;
        }
    }
    if (threshold <= 0) threshold = 2000;

    const currentSpend = (parseFloat(qty) || 0) * (rate || 0);
    const isUnlocked = qty > 0 && currentSpend >= threshold;

    let discount = 0;
    let freeUnits = 0;
    let trackerText = '';
    let trackerClass = 'pending';

    const schemeTitle = item.schemeLabel || (isUrdu ? 'خصوصی تجارتی آفر' : 'Special Trade Offer');

    if (qty === 0) {
        trackerClass = 'pending';
        trackerText = isUrdu 
            ? `کم از کم: Rs ${Math.round(threshold).toLocaleString()}` 
            : `Min order: Rs ${Math.round(threshold).toLocaleString()}`;
    } else if (currentSpend < threshold) {
        // Pending: Not reached yet. No discount awarded!
        const rem = threshold - currentSpend;
        trackerClass = 'pending';
        trackerText = isUrdu 
            ? `⚡ آفر کے لیے Rs ${Math.round(rem).toLocaleString()} باقی ہیں` 
            : `⚡ Rs ${Math.round(rem).toLocaleString()} remaining for offer`;
    } else {
        // Unlocked! Award benefit
        trackerClass = 'unlocked';
        if (item.schemeType === 'buy_x_get_y') {
            const minQ = parseFloat(item.schemeMinQty) || 10;
            const sVal = parseFloat(item.schemeValue) || 1;
            freeUnits = Math.max(1, Math.floor(qty / minQ)) * sVal;
            trackerText = isUrdu 
                ? `🎉 +${freeUnits} فری یونٹس لاگو!` 
                : `🎉 +${freeUnits} Free Units Unlocked!`;
        } else if (item.schemeType === 'flat_discount' || item.schemeType === 'cash_discount') {
            const sVal = parseFloat(item.schemeValue) || 150;
            discount = sVal;
            trackerText = isUrdu 
                ? `🎉 Rs ${sVal} رعایت لاگو!` 
                : `🎉 Rs ${sVal} Discount Applied!`;
        } else if (item.schemeType === 'percent_discount') {
            const pct = parseFloat(item.schemeValue) || 10;
            discount = (currentSpend * pct) / 100;
            trackerText = isUrdu 
                ? `🎉 ${pct}% رعایت (Rs ${Math.round(discount)}) لاگو!` 
                : `🎉 ${pct}% OFF (Rs ${Math.round(discount)}) Applied!`;
        } else {
            const sVal = parseFloat(item.schemeValue) || 100;
            discount = sVal;
            trackerText = isUrdu 
                ? `🎉 آفر فعال! Rs ${sVal} رعایت` 
                : `🎉 Offer Unlocked! Rs ${sVal} OFF`;
        }
    }

    const badgeHtml = `
        <div class="list-offer-badge-green" title="${schemeTitle}">
            <div class="list-offer-title-green">
                <span>🎁</span> <span>${schemeTitle}</span>
            </div>
            <div class="list-offer-tracker ${trackerClass}">
                ${trackerText}
            </div>
        </div>
    `;

    return {
        hasOffer: true,
        isUnlocked,
        discount,
        freeUnits,
        badgeHtml
    };
}

// ============================================
// 📋 INTERACTIVE LIST VIEW RENDERER (ORDER BOOKER ONLY)
// ============================================
function renderInteractiveProductList() {
    if (!isOrderBookerMode()) return;
    const container = document.getElementById('interactiveProductsContainer');
    if (!container) return;

    const isUrdu = getAppLanguage() === 'en-ur';

    // Filter allMyStock
    const filtered = allMyStock.filter(item => {
        // Category filter
        if (listFilterState.category !== 'all' && item.category !== listFilterState.category) {
            return false;
        }
        // Search query filter
        if (listFilterState.search) {
            const nameMatch = String(item.name || '').toLowerCase().includes(listFilterState.search);
            const barcodeMatch = String(item.barcode || '').toLowerCase().includes(listFilterState.search);
            const catMatch = String(item.category || '').toLowerCase().includes(listFilterState.search);
            if (!nameMatch && !barcodeMatch && !catMatch) return false;
        }
        // Quick filter pills
        if (listFilterState.filter === 'offers') {
            if (!item.hasScheme) return false;
        } else if (listFilterState.filter === 'booked') {
            if (!catCart[item.id] || catCart[item.id].qty <= 0) return false;
        }
        return true;
    });

    // Update filter counts
    const countAllEl = document.getElementById('listFilterCountAll');
    if (countAllEl) countAllEl.innerText = allMyStock.length;
    const countOffersEl = document.getElementById('listFilterCountOffers');
    if (countOffersEl) countOffersEl.innerText = allMyStock.filter(x => x.hasScheme).length;
    const countBookedEl = document.getElementById('listFilterCountBooked');
    if (countBookedEl) countBookedEl.innerText = Object.values(catCart).filter(e => e.qty > 0).length;

    const statsEl = document.getElementById('listProductsStats');
    if (statsEl) {
        statsEl.innerText = isUrdu 
            ? `دکھائے گئے: ${filtered.length} / ${allMyStock.length} پروڈکٹس` 
            : `Showing ${filtered.length} of ${allMyStock.length} products`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:30px 15px; color:#94a3b8; background:#fff; border:1px dashed #cbd5e1; border-radius:12px;">
                <i class="fas fa-boxes-stacked" style="font-size:38px; color:#cbd5e1; margin-bottom:8px;"></i>
                <div style="font-size:14px; font-weight:800; color:#475569;">
                    ${isUrdu ? 'کوئی پروڈکٹ نہیں ملا' : 'No matching products found'}
                </div>
                <div style="font-size:12px;">
                    ${isUrdu ? 'تلاش یا فلٹر تبدیل کر کے دوبارہ دیکھیں' : 'Try searching with another name or clear filters'}
                </div>
            </div>
        `;
        return;
    }

    let html = '';
    filtered.forEach((item, idx) => {
        const itemId = String(item.id || item._id || item.stockId || ('stk_' + idx));
        item.id = itemId;
        const booked = catCart[itemId] 
            || (item.id && catCart[String(item.id)]) 
            || (item.name ? Object.values(catCart).find(e => e.item && e.item.name === item.name) : null);
        const qty = booked ? booked.qty : 0;
        const rate = activeRateTier === 'wholesale' 
            ? (item.wholesaleRate || item.rate || 0) 
            : (item.retailRate || item.rate || 0);

        const offer = computeItemOffer(item, qty, rate, isUrdu);
        const cardClass = qty > 0 ? 'list-item-card booked' : 'list-item-card';

        const availQty = item.qty || 0;
        const stockColor = availQty <= 0 ? 'stock-out' : (availQty <= 10 ? 'stock-low' : 'stock-ok');

        const thumbHtml = item.photoUrl 
            ? `<img src="${item.photoUrl}" alt="${item.name}" loading="lazy">` 
            : `<i class="fas fa-box" style="font-size:22px; color:#cbd5e1;"></i>`;

        html += `
        <div class="${cardClass}" id="listCard-${itemId}">
            <!-- Left: Thumbnail + Item Details -->
            <div class="list-item-left">
                <div class="list-item-thumb">
                    ${thumbHtml}
                </div>
                <div class="list-item-info">
                    <div class="list-item-title" title="${item.name}">
                        <span>${item.name}</span> ${item.barcode ? `<span class="list-item-barcode">[${item.barcode}]</span>` : ''}
                    </div>
                    <div class="list-item-meta">
                        <span class="list-item-rate">Rs ${Number(rate).toLocaleString()}</span>
                        <span class="list-item-unit">/ ${UNIT_LBL(item.unit)}</span>
                        <span class="stock-badge ${stockColor}">
                            ${isUrdu ? 'دستیاب:' : 'Stock:'} <b>${availQty}</b>
                        </span>
                    </div>
                </div>
            </div>

            <!-- Center: Offer / Scheme Title & Target Tracker (Only if offer exists) -->
            ${offer.hasOffer ? `
            <div class="list-item-center">
                ${offer.badgeHtml}
            </div>` : ''}

            <!-- Right: Shopping Tokari Icon (when unbooked) OR Plus/Minus Counter -->
            <div class="list-item-right">
                ${qty === 0 ? `
                    <button type="button" class="list-tokari-btn" data-stock-id="${itemId}" data-item-name="${encodeURIComponent(item.name || '')}" onclick="event.stopPropagation(); window.bookListItem(this.getAttribute('data-stock-id'), 1, decodeURIComponent(this.getAttribute('data-item-name') || ''))" title="${isUrdu ? 'آرڈر میں شامل کریں' : 'Book this item'}">
                        <i class="fas fa-shopping-cart" style="pointer-events:none;"></i>
                    </button>
                ` : `
                    <div class="list-counter-box" onclick="event.stopPropagation();">
                        <button type="button" class="list-counter-btn minus" data-stock-id="${itemId}" onclick="event.stopPropagation(); window.decrementListItem(this.getAttribute('data-stock-id'))" title="Decrease Qty">-</button>
                        <input type="number" min="0" value="${qty}" class="list-counter-val" data-stock-id="${itemId}" onchange="window.changeListItemQty(this.getAttribute('data-stock-id'), this.value)" aria-label="Booked Quantity">
                        <button type="button" class="list-counter-btn plus" data-stock-id="${itemId}" onclick="event.stopPropagation(); window.incrementListItem(this.getAttribute('data-stock-id'))" title="Increase Qty">+</button>
                    </div>
                `}
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
}

// ============================================
// 🔢 LIST ITEM BOOKING & COUNTER ACTIONS
// ============================================
window.focusShopkeeperInput = function() {
    const isCat = document.getElementById('catalogueOrderSection')?.style.display === 'block';
    const inp = isCat ? document.getElementById('catCustInput') : document.getElementById('custNameInput');
    if (inp) {
        inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inp.focus();
    }
};

window.scrollToListTotals = function() {
    const totalsBox = document.querySelector('#billFormCard .totals-box') || document.getElementById('billActionBtnsContainer');
    if (totalsBox) {
        totalsBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

function updateListStickyBar(count = 0, units = 0, total = 0) {
    const bar = document.getElementById('listStickyBottomBar');
    const countEl = document.getElementById('listStickyCount');
    const unitsEl = document.getElementById('listStickyUnits');
    const totalEl = document.getElementById('listStickyTotal');
    if (!bar) return;

    const isListMode = document.getElementById('billFormCard')?.style.display !== 'none';
    if (isListMode) {
        bar.style.display = 'flex';
        if (countEl) countEl.innerText = count || 0;
        if (unitsEl) unitsEl.innerText = units || 0;
        if (totalEl) totalEl.innerText = Number(total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
        bar.style.display = 'none';
    }
}

function bookListItem(stockId, qty = 1, optName = '') {
    try {
        const isBooker = myUser && myUser.role === 'booker';
        
        // Auto-resolve customer if shopkeeper name is present in input
        if (!selectedCustomer && custInput && custInput.value.trim()) {
            const val = custInput.value.trim().toLowerCase();
            const found = allMyCustomers.find(c => (c.name || '').toLowerCase() === val || (c.shopName || '').toLowerCase() === val);
            if (found) {
                selectedCustomer = found;
            } else {
                selectedCustomer = {
                    id: 'temp_cust_' + Date.now(),
                    name: custInput.value.trim(),
                    customerType: activeRateTier || 'retail',
                    balance: 0
                };
            }
            updateLockState();
        }

        if (isBooker && !selectedCustomer) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: getAppLanguage() === 'en-ur' 
                    ? 'پہلے اوپر دکان دار منتخب کریں!' 
                    : 'Please select a shopkeeper above first!',
                showConfirmButton: false,
                timer: 2400
            });
            window.focusShopkeeperInput();
            return;
        }

        // Comprehensive match by ID, string ID, barcode, or name
        let item = allMyStock.find(x => String(x.id) === String(stockId))
                || allMyStock.find(x => x.id == stockId)
                || (optName && allMyStock.find(x => x.name === optName))
                || allMyStock.find(x => x.name === stockId)
                || allMyStock.find(x => x.barcode && String(x.barcode) === String(stockId));

        if (!item && allMyStock.length > 0) {
            const numIdx = parseInt(stockId, 10);
            if (!isNaN(numIdx) && allMyStock[numIdx]) {
                item = allMyStock[numIdx];
            }
        }

        if (!item) {
            console.warn('bookListItem: item not found for stockId:', stockId, 'optName:', optName);
            return;
        }

        const targetId = String(item.id || stockId);

        const rate = activeRateTier === 'wholesale' 
            ? (item.wholesaleRate || item.rate || 0) 
            : (item.retailRate || item.rate || 0);

        const isUrdu = getAppLanguage() === 'en-ur';
        const offer = computeItemOffer(item, qty, rate, isUrdu);

        catCart[targetId] = {
            item: item,
            qty: qty,
            rate: rate,
            total: qty * rate,
            freeQty: offer.freeUnits || 0,
            schemeDiscount: offer.discount || 0
        };

        syncCatCartToTotals();
        renderInteractiveProductList();
        try { renderCatalogueItem(); } catch (e) {}
    } catch (err) {
        console.error('bookListItem error:', err);
    }
}

function incrementListItem(stockId) {
    const isBooker = myUser && myUser.role === 'booker';
    if (isBooker && !selectedCustomer) {
        window.focusShopkeeperInput();
        return;
    }
    const item = allMyStock.find(x => String(x.id) === String(stockId)) || allMyStock.find(x => x.name === stockId);
    const targetId = item ? String(item.id || stockId) : String(stockId);

    let entryKey = targetId;
    if (!catCart[entryKey] && item && item.name) {
        const foundKey = Object.keys(catCart).find(k => catCart[k].item && catCart[k].item.name === item.name);
        if (foundKey) entryKey = foundKey;
    }
    const entry = catCart[entryKey];
    const currentQty = entry ? entry.qty : 0;
    bookListItem(entryKey, currentQty + 1);
}

function decrementListItem(stockId) {
    const item = allMyStock.find(x => String(x.id) === String(stockId)) || allMyStock.find(x => x.name === stockId);
    const targetId = item ? String(item.id || stockId) : String(stockId);

    let entryKey = targetId;
    if (!catCart[entryKey] && item && item.name) {
        const foundKey = Object.keys(catCart).find(k => catCart[k].item && catCart[k].item.name === item.name);
        if (foundKey) entryKey = foundKey;
    }
    const entry = catCart[entryKey];
    if (!entry) return;

    if (entry.qty <= 1) {
        // Return to 0 -> Restore the Tokari Shopping Icon!
        delete catCart[entryKey];
        syncCatCartToTotals();
        renderInteractiveProductList();
        try { renderCatalogueItem(); } catch (e) {}
    } else {
        bookListItem(entryKey, entry.qty - 1);
    }
}

function changeListItemQty(stockId, val) {
    const isBooker = myUser && myUser.role === 'booker';
    if (isBooker && !selectedCustomer) {
        window.focusShopkeeperInput();
        return;
    }
    const item = allMyStock.find(x => String(x.id) === String(stockId)) || allMyStock.find(x => x.name === stockId);
    const targetId = item ? String(item.id || stockId) : String(stockId);

    let entryKey = targetId;
    if (!catCart[entryKey] && item && item.name) {
        const foundKey = Object.keys(catCart).find(k => catCart[k].item && catCart[k].item.name === item.name);
        if (foundKey) entryKey = foundKey;
    }

    const q = Math.max(0, parseFloat(val) || 0);
    if (q === 0) {
        delete catCart[entryKey];
        syncCatCartToTotals();
        renderInteractiveProductList();
        try { renderCatalogueItem(); } catch (e) {}
    } else {
        bookListItem(entryKey, q);
    }
}

window.bookListItem = bookListItem;
window.incrementListItem = incrementListItem;
window.decrementListItem = decrementListItem;
window.changeListItemQty = changeListItemQty;

// Sync catCart to Totals & Rows
function syncCatCartToTotals() {
    const isUrdu = getAppLanguage() === 'en-ur';
    let subTotal = 0;
    let totalDiscount = 0;
    let totalUnits = 0;

    Object.values(catCart).forEach(entry => {
        const rate = activeRateTier === 'wholesale' 
            ? (entry.item.wholesaleRate || entry.item.rate || 0) 
            : (entry.item.retailRate || entry.item.rate || 0);
        entry.rate = rate;
        entry.total = entry.qty * rate;

        const offer = computeItemOffer(entry.item, entry.qty, entry.rate, isUrdu);
        entry.schemeDiscount = offer.discount || 0;
        entry.freeQty = offer.freeUnits || 0;

        subTotal += entry.total;
        totalDiscount += entry.schemeDiscount;
        totalUnits += entry.qty;
    });

    const sumSubEl = document.getElementById('sumSubTotal');
    if (sumSubEl) sumSubEl.innerText = subTotal.toFixed(2);

    const sumDiscInp = document.getElementById('sumDiscount');
    if (sumDiscInp) {
        sumDiscInp.value = totalDiscount.toFixed(2);
    }

    const prevBal = selectedCustomer ? (selectedCustomer.balance || 0) : 0;
    const sumPrevEl = document.getElementById('sumPrevBalance');
    if (sumPrevEl) sumPrevEl.innerText = prevBal.toFixed(2);

    // Grand total
    const grand = Math.max(0, (subTotal - totalDiscount) + prevBal);
    const sumGrandEl = document.getElementById('sumGrand');
    if (sumGrandEl) sumGrandEl.innerText = grand.toFixed(2);

    const received = parseFloat(document.getElementById('sumReceived')?.value) || 0;
    const balance = Math.max(0, grand - received);
    const sumBalEl = document.getElementById('sumBalance');
    if (sumBalEl) sumBalEl.innerText = balance.toFixed(2);

    // Sync to sticky bar (shows count, units, and booked items order total)
    const bookedOrderTotal = Math.max(0, subTotal - totalDiscount);
    updateCatalogueStickyBar();
    updateListStickyBar(Object.keys(catCart).length, totalUnits, bookedOrderTotal);

    // Sync to Booker Review & Book Order button
    const bookedEntries = Object.values(catCart).filter(e => e.qty > 0);
    const bCartTag = document.getElementById('bookerCartItemsSummaryTag');
    if (bCartTag) {
        bCartTag.innerText = bookedEntries.length > 0 
            ? `(${bookedEntries.length} Items - Rs ${Math.round(bookedOrderTotal).toLocaleString()})` 
            : `(0 Items)`;
    }

    // Sync to itemsRows for background printing/invoice compatibility
    syncCatCartToTableRows();
}

function initInteractiveListView() {
    // 0. Booker Quick Recovery Input listener
    const bQuickInp = document.getElementById('bookerQuickReceivedInput');
    if (bQuickInp && !bQuickInp.dataset.bound) {
        bQuickInp.dataset.bound = 'true';
        bQuickInp.addEventListener('input', updateBookerRecoveryRemaining);
    }

    // 1. Search input
    const searchInp = document.getElementById('listSearchInput');
    if (searchInp) {
        searchInp.addEventListener('input', function() {
            listFilterState.search = this.value.toLowerCase().trim();
            renderInteractiveProductList();
        });
    }

    // 2. Filter Pills (All / Offers / Booked)
    const filterTabs = document.querySelectorAll('#listFilterTabs .list-filter-pill');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            listFilterState.filter = this.dataset.filter || 'all';
            renderInteractiveProductList();
        });
    });

    // 3. Manual row expander
    const toggleManualBtn = document.getElementById('toggleManualRowsBtn');
    const manualWrapper = document.getElementById('manualRowsWrapper');
    if (toggleManualBtn && manualWrapper) {
        toggleManualBtn.addEventListener('click', () => {
            const isHidden = manualWrapper.style.display === 'none';
            manualWrapper.style.display = isHidden ? 'block' : 'none';
            toggleManualBtn.innerHTML = isHidden 
                ? '<i class="fas fa-chevron-up"></i> Hide Manual Items' 
                : '<i class="fas fa-pen-to-square"></i> + Add Custom Manual Item';
        });
    }

    // 4. Delegated Click Listener for Interactive Products Container (Mobile Safe)
    const prodContainer = document.getElementById('interactiveProductsContainer');
    if (prodContainer && !prodContainer.dataset.delegated) {
        prodContainer.dataset.delegated = 'true';
        prodContainer.addEventListener('click', function(e) {
            const tokariBtn = e.target.closest('.list-tokari-btn');
            if (tokariBtn) {
                e.preventDefault();
                e.stopPropagation();
                const sid = tokariBtn.dataset.stockId || tokariBtn.getAttribute('data-stock-id');
                const sname = tokariBtn.dataset.itemName ? decodeURIComponent(tokariBtn.dataset.itemName) : '';
                if (sid && window.bookListItem) window.bookListItem(sid, 1, sname);
                return;
            }
            const minusBtn = e.target.closest('.list-counter-btn.minus');
            if (minusBtn) {
                e.preventDefault();
                e.stopPropagation();
                const sid = minusBtn.dataset.stockId || minusBtn.getAttribute('data-stock-id');
                if (sid && window.decrementListItem) window.decrementListItem(sid);
                return;
            }
            const plusBtn = e.target.closest('.list-counter-btn.plus');
            if (plusBtn) {
                e.preventDefault();
                e.stopPropagation();
                const sid = plusBtn.dataset.stockId || plusBtn.getAttribute('data-stock-id');
                if (sid && window.incrementListItem) window.incrementListItem(sid);
                return;
            }
        });
    }
}

function initVisualCatalogue() {
    // 0. Setup Language Manager
    initLanguageManager();

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

    // 3. Setup Interactive List View (View 1)
    initInteractiveListView();

    // 4. View Switcher setup (Radio Buttons: List View Default)
    const radioTable = document.getElementById('radioSwitchTable');
    const radioCat = document.getElementById('radioSwitchCatalogue');
    const catSec = document.getElementById('catalogueOrderSection');
    const tabSec = document.getElementById('billFormCard');

    const tabList = document.getElementById('lblViewListContainer');
    const tabCat = document.getElementById('lblViewCatalogueContainer');

    function switchViewMode(mode) {
        const listSticky = document.getElementById('listStickyBottomBar');
        if (mode === 'catalogue') {
            if (radioCat) radioCat.checked = true;
            if (radioTable) radioTable.checked = false;
            if (tabCat) tabCat.classList.add('active');
            if (tabList) tabList.classList.remove('active');
            if (catSec) catSec.style.display = 'block';
            if (tabSec) tabSec.style.display = 'none';
            if (listSticky) listSticky.style.display = 'none';
            renderCatalogueItem();
            updateCatalogueStickyBar();
            updateLockState();
        } else {
            if (radioTable) radioTable.checked = true;
            if (radioCat) radioCat.checked = false;
            if (tabList) tabList.classList.add('active');
            if (tabCat) tabCat.classList.remove('active');
            if (tabSec) tabSec.style.display = 'block';
            if (catSec) catSec.style.display = 'none';
            renderInteractiveProductList();
            syncCatCartToTotals();
            updateLockState();
        }
    }

    if (tabList) {
        tabList.addEventListener('click', () => switchViewMode('table'));
    }
    if (tabCat) {
        tabCat.addEventListener('click', () => switchViewMode('catalogue'));
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
        // DEFAULT IS ALWAYS LIST VIEW!
        switchViewMode('table');
    }

    // 5. Shopkeeper Selection & Autocomplete
    setupCatalogueCustomerPicker();

    // 6. Navigation Controls (Next, Back, Arrows, Swipe, Keys)
    setupCatalogueNavigation();

    // 7. Quantity Controls (Plus, Minus, Typing)
    setupCatalogueQuantityControls();

    // 8. Search Input for catalogue
    const catSearchInp = document.getElementById('catSearchInput');
    if (catSearchInp) {
        catSearchInp.addEventListener('input', function() {
            catSearchQuery = this.value.toLowerCase().trim();
            catIndex = 0;
            refreshCatalogueData();
        });
    }

    // 9. Sticky Bottom Bar & Review Modal
    setupCatalogueReviewModal();

    // 10. Initial data refresh
    refreshCatalogueData();
}

function updateCatalogueRateTier() {
    const isUrdu = getAppLanguage() === 'en-ur';
    const badge = document.getElementById('catPriceTierBadge');
    if (badge) {
        if (activeRateTier === 'wholesale') {
            badge.innerText = isUrdu ? '🏪 ہول سیل ریٹ (Wholesale)' : '🏪 Wholesale Rate';
            badge.style.background = '#e0f2fe';
            badge.style.color = '#0369a1';
            badge.style.borderColor = '#bae6fd';
        } else {
            badge.innerText = isUrdu ? '🏷️ پرچون ریٹ (Retail)' : '🏷️ Retail Rate';
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
    renderInteractiveProductList();
    syncCatCartToTotals();
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
            selectedCustomer = null;
            updateLockState();
            custSuggest.classList.remove('show');
            const mainCustInput = document.getElementById('custNameInput');
            if (mainCustInput) mainCustInput.value = '';
            const mainCustInfo = document.getElementById('custInfoBox');
            if (mainCustInfo) mainCustInfo.classList.remove('show');
            if (custInfo) custInfo.style.display = 'none';
            calcTotals();
            syncCatCartToTotals();
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
        let info = '<div class="cust-chips-wrap">';
        const catDispName = c.name || c.shopName || 'Customer';
        const catDispShop = (c.shopName && c.shopName !== catDispName) ? ` (${c.shopName})` : '';
        info += `<span class="c-chip c-chip-shop"><i class="fas fa-user-check"></i> <b>${catDispName}${catDispShop}</b></span>`;
        if (c.mobile) {
            info += `<span class="c-chip c-chip-phone"><i class="fas fa-phone"></i> ${c.mobile}</span>`;
        }
        if (c.route) {
            info += `<span class="c-chip c-chip-route"><i class="fas fa-map-marker-alt"></i> ${c.route}</span>`;
        }
        if (c.customerType) {
            info += `<span class="c-chip ${c.customerType === 'retail' ? 'tier-retail' : 'tier-wholesale'}">${c.customerType === 'retail' ? '🏷️ Retail' : '🏪 Wholesale'}</span>`;
        }
        if (prevBal > 0) {
            info += `<span class="c-chip c-chip-balance" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a;" title="Previous Balance: Rs ${prevBal.toLocaleString()}">💰 Khata: <b>Rs ${prevBal.toLocaleString()}</b></span>`;
        }
        info += '</div>';
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

    // Fullscreen portrait showcase on photo click (Booker presenting to shopkeeper)
    const photoFrame = document.getElementById('catPhotoFrame');
    if (photoFrame) {
        photoFrame.addEventListener('click', () => {
            if (!catProducts || catProducts.length === 0) return;
            const item = catProducts[catIndex];
            if (item && item.photoUrl) {
                showCataloguePhotoFullscreen(item);
            }
        });
    }
}

function showCataloguePhotoFullscreen(item) {
    const rate = activeRateTier === 'wholesale' 
        ? (item.wholesaleRate || item.rate || 0) 
        : (item.retailRate || item.rate || 0);

    const schemeBadge = item.hasScheme ? `
        <div style="background:#fdf4ff; color:#a21caf; border:1px solid #f0abfc; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:800; display:inline-flex; align-items:center; gap:6px; margin-top:8px;">
            🎁 ${item.schemeLabel || 'Trade Scheme Active'}
        </div>` : '';

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            html: `
                <div style="position:relative; text-align:center;">
                    <div style="font-size:18px; font-weight:900; color:#0f172a; margin-bottom:8px; line-height:1.3;">
                        ${item.name}
                    </div>
                    <div style="display:inline-block; width:100%; max-width:340px; aspect-ratio:3/4; border-radius:18px; overflow:hidden; border:2px solid #cbd5e1; box-shadow:0 8px 28px rgba(0,0,0,0.2); background:#0f172a;">
                        <img src="${item.photoUrl}" alt="${item.name}" style="width:100%; height:100%; object-fit:cover; display:block;">
                    </div>
                    <div style="margin-top:12px; display:flex; justify-content:center; align-items:center; gap:12px; flex-wrap:wrap;">
                        <span style="font-size:17px; font-weight:900; color:#0284c7;">Rs ${Number(rate).toLocaleString()} / ${UNIT_LBL(item.unit)}</span>
                        <span style="font-size:12px; font-weight:800; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; padding:3px 10px; border-radius:20px;">Available: ${item.qty || 0} ${UNIT_LBL(item.unit)}</span>
                    </div>
                    ${schemeBadge}
                    <div style="margin-top:8px; font-size:10px; color:#94a3b8;">
                        📐 Catalog Portrait View (600×800 px HD)
                    </div>
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true,
            background: '#ffffff',
            padding: '16px'
        });
    }
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
    // 1. Populate Category Chips dynamically from allMyStock for Catalogue
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

    // 2. Populate Category Chips for Interactive List View
    const listChipsContainer = document.getElementById('listCategoryChips');
    if (listChipsContainer) {
        const categories = new Set();
        allMyStock.forEach(it => {
            const c = String(it.category || '').trim();
            if (c) categories.add(c);
        });

        let listChipsHtml = `<button type="button" class="cat-chip ${listFilterState.category === 'all' ? 'active' : ''}" data-cat="all">📂 All Categories</button>`;
        categories.forEach(cat => {
            const count = allMyStock.filter(x => x.category === cat).length;
            const isAct = listFilterState.category === cat ? 'active' : '';
            listChipsHtml += `<button type="button" class="cat-chip ${isAct}" data-cat="${cat}">${cat} (${count})</button>`;
        });
        listChipsContainer.innerHTML = listChipsHtml;

        listChipsContainer.querySelectorAll('.cat-chip').forEach(btn => {
            btn.addEventListener('click', function() {
                listChipsContainer.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                listFilterState.category = this.dataset.cat;
                renderInteractiveProductList();
            });
        });
    }

    filterAndRenderCatalogue();
    renderInteractiveProductList();
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
    if (!item) return;
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
    const zoomHint = document.getElementById('catPhotoZoomHint');
    if (item.photoUrl) {
        if (imgEl) {
            imgEl.src = item.photoUrl;
            imgEl.alt = item.name || 'Product Photo';
            imgEl.style.display = 'block';
        }
        if (phEl) phEl.style.display = 'none';
        if (zoomHint) zoomHint.style.display = 'inline-flex';
    } else {
        if (imgEl) imgEl.style.display = 'none';
        if (phEl) {
            phEl.style.display = 'block';
            phEl.innerHTML = `
                <i class="fas fa-box-open" style="font-size:64px; color:#cbd5e1; margin-bottom:8px;"></i>
                <div style="font-size:13px; font-weight:700; color:#94a3b8;">${item.name || 'No Photo'}</div>
            `;
        }
        if (zoomHint) zoomHint.style.display = 'none';
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
    const isBooker = myUser && myUser.role === 'booker';
    if (isBooker && !selectedCustomer) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: getAppLanguage() === 'en-ur' 
                ? 'پہلے اوپر دکان دار منتخب کریں!' 
                : 'Please select a shopkeeper above first!',
            showConfirmButton: false,
            timer: 2400
        });
        window.focusShopkeeperInput();
        return;
    }

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
    // Keep classic table rows in sync with catalogue cart (ONLY FOR BOOKER)
    if (!isOrderBookerMode()) {
        return;
    }
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
    const isUrdu = getAppLanguage() === 'en-ur';
    const entries = Object.values(catCart);
    if (entries.length === 0) {
        Swal.fire({
            icon: 'info',
            title: isUrdu ? 'آرڈر خالی ہے!' : 'No Items Booked Yet!',
            text: isUrdu 
                ? 'پہلے پروڈکٹ لسٹ میں سے ٹوکری (🛒) پر کلک کر کے آرڈر کے آئٹمز شامل کریں۔' 
                : 'Please click the shopping cart icon on items to add them to your order first.',
            confirmButtonColor: '#0284c7'
        });
        return;
    }

    const isBooker = isOrderBookerMode();
    if (isBooker && !selectedCustomer) {
        Swal.fire({
            icon: 'warning',
            title: isUrdu ? 'دکان دار منتخب کریں' : 'Select Shopkeeper First',
            text: isUrdu 
                ? 'آرڈر فائنل کرنے کے لیے پہلے اوپر دکان دار کا نام منتخب کرنا لازمی ہے۔' 
                : 'Please select a shopkeeper first before finalizing the order.',
            confirmButtonColor: '#0284c7'
        });
        window.focusShopkeeperInput();
        return;
    }

    const modal = document.getElementById('catReviewModal');
    const custNameEl = document.getElementById('catReviewCustName');
    const custDetailsEl = document.getElementById('catReviewCustDetails');
    const listEl = document.getElementById('catReviewItemsList');
    const subtotalEl = document.getElementById('catReviewSubtotal');
    const discountEl = document.getElementById('catReviewDiscount');
    const discountRow = document.getElementById('catReviewDiscountRow');
    const prevBalEl = document.getElementById('catReviewPrevBal');
    const grandEl = document.getElementById('catReviewGrand');
    const badgeEl = document.getElementById('catReviewItemsCountBadge');

    // Customer display
    if (selectedCustomer) {
        if (custNameEl) custNameEl.innerHTML = `👤 <b>${selectedCustomer.name}</b> ${selectedCustomer.shopName ? `<span style="color:#0284c7;">(${selectedCustomer.shopName})</span>` : ''}`;
        if (custDetailsEl) {
            custDetailsEl.innerHTML = `📱 ${selectedCustomer.mobile || 'No Mobile'} | 🛣️ Route: <b>${selectedCustomer.route || 'General Route'}</b> | 🏷️ Rate: <b>${(activeRateTier || 'wholesale').toUpperCase()}</b>`;
        }
    } else {
        const rawCust = (document.getElementById('custNameInput')?.value || '').trim();
        if (custNameEl) custNameEl.innerText = rawCust ? `👤 ${rawCust}` : '👤 Counter / Spot Sale (کاؤنٹر سیل)';
        if (custDetailsEl) custDetailsEl.innerHTML = '🏢 Direct Sale Mode | 🏷️ Rate: ' + (activeRateTier || 'wholesale').toUpperCase();
    }

    // Render items list with live +/- counters for instant recheck
    let html = '';
    let subtotal = 0;
    let totalDiscount = 0;
    let totalUnits = 0;

    entries.forEach(entry => {
        const item = entry.item;
        const lineTotal = entry.qty * entry.rate;
        subtotal += lineTotal;
        totalDiscount += (entry.schemeDiscount || 0);
        totalUnits += entry.qty;

        const thumb = item.photoUrl 
            ? `<img src="${item.photoUrl}" style="width:38px; height:38px; border-radius:8px; object-fit:cover; flex-shrink:0; border:1px solid #cbd5e1;">`
            : `<div style="width:38px; height:38px; border-radius:8px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#94a3b8; border:1px solid #e2e8f0;"><i class="fas fa-box" style="font-size:18px;"></i></div>`;

        let schemeBadge = '';
        if (entry.freeQty > 0) {
            schemeBadge = `<span style="background:#fdf4ff; color:#a21caf; border:1px solid #f0abfc; padding:2px 6px; border-radius:6px; font-size:10px; font-weight:800;">🎁 +${entry.freeQty} FREE</span>`;
        } else if (entry.schemeDiscount > 0) {
            schemeBadge = `<span style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; padding:2px 6px; border-radius:6px; font-size:10px; font-weight:800;">🏷️ -Rs ${entry.schemeDiscount} OFF</span>`;
        }

        html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 10px; border-bottom:1px solid #e2e8f0; background:#ffffff; border-radius:10px; margin-bottom:6px; gap:8px;">
            <div style="display:flex; align-items:center; gap:9px; flex:1; min-width:0;">
                ${thumb}
                <div style="min-width:0;">
                    <div style="font-weight:800; font-size:13px; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.name}">${item.name}</div>
                    <div style="font-size:11px; color:#64748b; display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:2px;">
                        <span>Rs ${Number(entry.rate).toLocaleString()} / ${UNIT_LBL(item.unit)}</span>
                        ${schemeBadge}
                    </div>
                </div>
            </div>

            <!-- Quantity Counter for Instant Recheck Adjustment -->
            <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                <button type="button" onclick="decrementListItem('${item.id}'); openCatalogueReviewModal();" style="width:28px; height:28px; border-radius:7px; border:1px solid #cbd5e1; background:#f1f5f9; font-weight:900; font-size:15px; cursor:pointer; color:#334155; display:flex; align-items:center; justify-content:center;" title="Decrease Qty">-</button>
                <span style="min-width:28px; text-align:center; font-weight:900; font-size:14px; color:#0f172a;">${entry.qty}</span>
                <button type="button" onclick="incrementListItem('${item.id}'); openCatalogueReviewModal();" style="width:28px; height:28px; border-radius:7px; border:1px solid #10b981; background:#10b981; font-weight:900; font-size:15px; cursor:pointer; color:#fff; display:flex; align-items:center; justify-content:center;" title="Increase Qty">+</button>
            </div>

            <div style="text-align:right; flex-shrink:0; min-width:72px;">
                <div style="font-weight:900; font-size:13.5px; color:#15803d;">Rs ${lineTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                <button type="button" onclick="removeCatItem('${item.id}');" style="background:none; border:none; color:#ef4444; font-size:11px; font-weight:700; cursor:pointer; padding:2px 0;">🗑️ Remove</button>
            </div>
        </div>`;
    });

    if (listEl) listEl.innerHTML = html;
    if (badgeEl) badgeEl.innerText = `${entries.length} items (${totalUnits} units)`;

    const prevBal = selectedCustomer ? (selectedCustomer.balance || 0) : 0;
    const finalBill = Math.max(0, subtotal - totalDiscount);
    const grand = isBooker ? finalBill : (prevBal + finalBill);

    if (subtotalEl) subtotalEl.innerText = subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (discountEl) discountEl.innerText = totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (discountRow) discountRow.style.display = totalDiscount > 0 ? 'flex' : 'none';

    // Hide or show balance rows based on Booker role
    const catPrevRow = document.getElementById('catReviewPrevBalRow');
    const catRecRow = document.getElementById('catReviewReceivedRow');
    const catBalRow = document.getElementById('catReviewBalanceRow');
    if (isBooker) {
        if (catPrevRow) catPrevRow.style.display = 'none';
        if (catRecRow) catRecRow.style.display = 'none';
        if (catBalRow) catBalRow.style.display = 'none';
    } else {
        if (catPrevRow) catPrevRow.style.display = 'flex';
        if (catRecRow) catRecRow.style.display = 'flex';
        if (catBalRow) catBalRow.style.display = 'flex';
    }

    if (prevBalEl) prevBalEl.innerText = prevBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (grandEl) grandEl.innerText = grand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const recInput = document.getElementById('catReviewReceived');
    const balEl = document.getElementById('catReviewBalance');
    if (recInput) {
        if (isBooker) {
            recInput.value = '0';
        } else if (!recInput.dataset.touched) {
            recInput.value = '0';
        }
        const recalculateBalance = () => {
            const r = parseFloat(recInput.value) || 0;
            const b = Math.max(0, grand - r);
            if (balEl) balEl.innerText = b.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };
        recInput.oninput = () => {
            recInput.dataset.touched = 'true';
            recalculateBalance();
        };
        recalculateBalance();
    }

    if (modal) modal.style.display = 'flex';
}
window.openOrderRecheckModal = openCatalogueReviewModal;
window.openCatalogueReviewModal = openCatalogueReviewModal;

window.removeCatItem = function(stockId) {
    if (catCart[stockId]) {
        delete catCart[stockId];
        renderInteractiveProductList();
        renderCatalogueItem();
        syncCatCartToTotals();
        updateCatalogueStickyBar();
        if (Object.keys(catCart).length === 0) {
            const modal = document.getElementById('catReviewModal');
            if (modal) modal.style.display = 'none';
        } else {
            openCatalogueReviewModal();
        }
    }
};

// 🔄 RESET SCREEN FRESH FOR BOOKING NEXT CUSTOMER'S ORDER
window.resetForNextOrder = function() {
    catCart = {};
    selectedCustomer = null;
    const custInput = document.getElementById('custNameInput');
    if (custInput) custInput.value = '';
    const custInfoBox = document.getElementById('custInfoBox');
    if (custInfoBox) {
        custInfoBox.classList.remove('show');
        custInfoBox.innerHTML = '';
        custInfoBox.style.display = 'none';
    }
    const catCustInfo = document.getElementById('catCustInfo');
    if (catCustInfo) catCustInfo.style.display = 'none';
    
    // Clear financial inputs
    const sumDisc = document.getElementById('sumDiscount');
    if (sumDisc) sumDisc.value = '0';
    const sumRec = document.getElementById('sumReceived');
    if (sumRec) sumRec.value = '0';
    const taxEn = document.getElementById('taxEnabled');
    if (taxEn) taxEn.checked = false;
    const taxR = document.getElementById('taxRate');
    if (taxR) taxR.value = '0';

    const itemsRows = document.getElementById('itemsRows');
    if (itemsRows) itemsRows.innerHTML = '';
    
    // Refresh interactive list and catalogue
    renderInteractiveProductList();
    renderCatalogueItem();
    syncCatCartToTotals();
    updateCatalogueStickyBar();
    updateListStickyBar(0, 0, 0);
    updateLockState();
    previewBillNo();

    // Reset recovery input in modal
    const recInput = document.getElementById('catReviewReceived');
    if (recInput) {
        recInput.value = '0';
        delete recInput.dataset.touched;
    }

    // Scroll to top shopkeeper search so booker is immediately ready
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
        if (custInput) custInput.focus();
    }, 300);
};

async function submitCatalogueFieldOrder() {
    const entries = Object.values(catCart);
    if (entries.length === 0) {
        Swal.fire('آرڈر خالی ہے', 'براہ کرم کم از کم 1 آئٹم شامل کریں۔', 'warning');
        return;
    }

    const isBooker = myUser && myUser.role === 'booker';
    if (isBooker && !selectedCustomer) {
        Swal.fire({
            icon: 'warning',
            title: 'دکان دار منتخب کریں',
            text: 'آرڈر محفوظ کرنے کے لیے پہلے اوپر دکان دار کا نام منتخب کرنا لازمی ہے۔',
            confirmButtonColor: '#0284c7'
        });
        window.focusShopkeeperInput();
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
            // Save directly to 'bills' collection
            const billRef = db.collection('bills').doc();
            orderData.id = billRef.id;
            await billRef.set(orderData);

            // Also mirror in 'orders' collection
            try {
                await db.collection('orders').doc(billRef.id).set(orderData);
            } catch (eOrd) {}

            // Update customer balance in Firestore
            if (selectedCustomer && selectedCustomer.id) {
                try {
                    db.collection('customers').doc(selectedCustomer.id).update({
                        balance: netBalance,
                        lastOrderDate: new Date().toISOString()
                    });
                } catch(eCust) {}
            }
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

        // Close modal
        if (modal) modal.style.display = 'none';

        // Update local customer balance
        if (selectedCustomer) {
            selectedCustomer.balance = netBalance;
        }

        await Swal.fire({
            title: '✅ فیلڈ آرڈر کامیابی سے بک ہو گیا!',
            html: `
                <div style="text-align:center; font-size:14px; line-height:1.8;">
                    <div style="font-size:24px; font-weight:900; color:#d97706; margin-bottom:8px;">${orderNo}</div>
                    <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:10px; padding:10px; color:#92400e; margin-bottom:10px;">
                        ⏳ <b>Admin Approval Pending (ایڈمن منظوری کا منتظر)</b><br>
                        یہ آرڈر کامیابی کے ساتھ ایڈمن پورٹل میں محفوظ ہو چکا ہے۔ ایڈمن کی منظوری کے بعد بل پرنٹ اور سپلائر کی ترسیل شروع ہوگی۔
                    </div>
                    <div>👤 <b>دکان دار:</b> ${orderData.customerName} ${orderData.customerShop ? `(${orderData.customerShop})` : ''}</div>
                    <div>📦 <b>کل اشیاء:</b> ${orderData.itemCount} (${orderData.totalUnits} Units) ${orderData.totalFreeUnits ? `+ 🎁 ${orderData.totalFreeUnits} Free Units` : ''}</div>
                    <div>💰 <b>کل واجب الادا:</b> Rs ${orderData.grandTotal.toLocaleString()}</div>
                    ${receivedAmt > 0 ? `<div>💵 <b>وصول شدہ رقم (ریکوری):</b> <span style="color:#16a34a; font-weight:bold;">Rs ${receivedAmt.toLocaleString()}</span> &nbsp;|&nbsp; نیا بقایا: <b>Rs ${netBalance.toLocaleString()}</b></div>` : ''}
                </div>
            `,
            icon: 'success',
            confirmButtonColor: '#16a34a',
            confirmButtonText: '➕ اگلا نیا آرڈر بک کریں (Next Order)'
        });

        // 🔄 Reset screen completely for next order
        window.resetForNextOrder();

    } catch (err) {
        console.error('Order booking error:', err);
        Swal.fire('خرابی', 'آرڈر محفوظ نہیں ہو سکا: ' + (err.message || err), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> <span>BOOK ORDER / CONFIRM <span class="ur-sub">(آرڈر فائنل / بک کریں)</span></span>';
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
            // Offline support via IndexedDB
            payDoc.isOffline = true;
            await saveOfflineBill(payDoc);
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
