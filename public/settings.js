// ============================================
// ⚙️ EASY BILL GENERATOR — SETTINGS CONTROLLER (PHASE 10)
// ✅ Agency Profile, Branding & Tax/NTN Setup
// ✅ Invoicing, Thermal POS Width (58mm/80mm) & Terms
// ✅ Default Price Mode (Wholesale vs Retail) & Bill Prefixes
// ✅ Low Stock Alert Thresholds & Auto-Deduction Rules
// ✅ Password Management & Device Cache Reset
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

// ============================================
// 🛡️ AUTH GUARD & LOAD SETTINGS
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

        myAgencyId = myUser.agencyId || localStorage.getItem('eb_active_agencyId');
        if (myAgencyId) {
            localStorage.setItem('eb_active_agencyId', myAgencyId);
        }

        if (!myAgencyId) {
            window.location.href = 'profile.html';
            return;
        }

        const isBooker = (myUser.role === 'booker');
        if (isBooker) {
            // Hide administrative / owner-only tabs for Booker
            const adminTabs = ['secProfile', 'secInvoice', 'secInventory', 'secSecurity'];
            adminTabs.forEach(tid => {
                const b = document.querySelector(`.settings-tab-btn[data-target="${tid}"]`);
                if (b) b.style.display = 'none';
                const s = document.getElementById(tid);
                if (s) {
                    s.style.display = 'none';
                    s.classList.remove('active');
                }
            });
            const syncBtn = document.querySelector('[data-target="secSyncSchedule"]');
            if (syncBtn) {
                syncBtn.classList.add('active');
                syncBtn.innerHTML = '<i class="fas fa-cloud-arrow-down"></i> Cloud Sync & Shift Schedule (Booker)';
            }
            const syncSec = document.getElementById('secSyncSchedule');
            if (syncSec) {
                syncSec.classList.add('active');
                syncSec.style.display = 'block';
            }
        }

        const agDoc = await db.collection('agencies').doc(myAgencyId).get();
        if (agDoc.exists) {
            myAgency = agDoc.data();
            const h = document.getElementById('agencyNameHeader');
            if (h && myAgency.name) {
                h.innerText = isBooker 
                    ? `🏢 ${myAgency.name} — Order Booker Mode: ${myUser.name || 'Staff'}` 
                    : `🏢 ${myAgency.name}`;
            }
            if (!isBooker) {
                populateSettingsFields();
            }
        }

        setupTabNav();
        initSyncDashboardUI();

        // Direct navigation from topbar cloud icon (e.g. ?tab=sync or ?tab=secSyncSchedule)
        const urlParams = new URLSearchParams(window.location.search);
        const targetTab = urlParams.get('tab');
        if (isBooker || targetTab === 'sync' || targetTab === 'secSyncSchedule') {
            const syncTabBtn = document.querySelector('[data-target="secSyncSchedule"]');
            if (syncTabBtn) syncTabBtn.click();
            const sec = document.getElementById('secSyncSchedule');
            if (sec) sec.scrollIntoView({ behavior: 'smooth' });
        }

        if (window.hideNHLoader) {
            window.hideNHLoader();
        }

    } catch (e) {
        console.error('Settings init error:', e);
        if (window.hideNHLoader) window.hideNHLoader();
    }
});

// ============================================
// 📑 TAB NAVIGATION
// ============================================
function setupTabNav() {
    const btns = document.querySelectorAll('.settings-tab-btn');
    const sections = document.querySelectorAll('.settings-section');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            sections.forEach(s => {
                s.classList.remove('active');
                if (myUser && myUser.role === 'booker' && s.id !== 'secSyncSchedule') {
                    s.style.display = 'none';
                }
            });

            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.target);
            if (target) {
                target.classList.add('active');
                target.style.display = 'block';
            }
        });
    });

    // Check URL parameters for direct tab navigation (e.g. ?tab=sync or ?tab=secSyncSchedule)
    const urlParams = new URLSearchParams(window.location.search);
    const targetTab = urlParams.get('tab');
    if (targetTab === 'sync' || targetTab === 'secSyncSchedule') {
        const syncTabBtn = document.querySelector('[data-target="secSyncSchedule"]');
        if (syncTabBtn) syncTabBtn.click();
    }
}

// ============================================
// 📥 PRE-FILL SETTINGS
// ============================================
function populateSettingsFields() {
    if (!myAgency) return;

    // Profile & Identity
    document.getElementById('setAgencyName').value = myAgency.name || '';
    document.getElementById('setAgencyTagline').value = myAgency.tagline || myAgency.slogan || '';
    document.getElementById('setBizType').value = myAgency.businessType || 'general';
    document.getElementById('setCity').value = myAgency.city || '';
    document.getElementById('setMobile').value = myAgency.mobile || myAgency.ownerMobile || '';
    document.getElementById('setPhone').value = myAgency.phone || '';
    document.getElementById('setAddress').value = myAgency.address || '';
    document.getElementById('setNTN').value = myAgency.ntn || '';
    document.getElementById('setShowNTN').checked = myAgency.showNTN === true;

    // Invoicing & POS
    document.getElementById('setDefaultTemplate').value = myAgency.defaultTemplate || 'template4';
    document.getElementById('setThermalWidth').value = myAgency.thermalPaperWidth || localStorage.getItem('eb_thermal_width') || '80';
    const billLangEl = document.getElementById('setDefaultBillLanguage');
    if (billLangEl) billLangEl.value = myAgency.billLanguage || localStorage.getItem('eb_bill_language') || 'en';
    document.getElementById('setDefaultPriceMode').value = myAgency.defaultPriceMode || 'wholesale';
    document.getElementById('setBillPrefix').value = (myAgency.billPrefixes && myAgency.billPrefixes.stock) || 'STK-';
    document.getElementById('setInvoiceFooter').value = myAgency.invoiceFooter || 'مال واپس یا تبدیل 3 دن میں ہو سکتا ہے۔ کیش واپس نہیں ہوگا۔';

    // Inventory & Rules
    document.getElementById('setDefaultLowStock').value = myAgency.defaultLowStockLimit !== undefined ? myAgency.defaultLowStockLimit : 10;
    document.getElementById('setAutoDeductStock').checked = myAgency.autoDeductStock !== false;

    // Software Language Mode
    const savedLang = localStorage.getItem('eb_app_language') || myAgency.languageMode || 'en';
    if (savedLang === 'en-ur') {
        const urBtn = document.getElementById('langUrduMix');
        if (urBtn) urBtn.checked = true;
    } else {
        const enBtn = document.getElementById('langEnglish');
        if (enBtn) enBtn.checked = true;
    }

    // Select Customer Type Pop-up Mode (Default: hide)
    const savedPopupMode = localStorage.getItem('eb_cust_type_popup') || myAgency.custTypePopupMode || 'hide';
    if (savedPopupMode === 'show') {
        const showR = document.getElementById('custTypePopupShow');
        if (showR) showR.checked = true;
    } else {
        const hideR = document.getElementById('custTypePopupHide');
        if (hideR) hideR.checked = true;
    }

    // 🇵🇰 FBR Tax Rates (Default OFF)
    const filerTaxRateEl = document.getElementById('setFilerTaxRate');
    if (filerTaxRateEl) filerTaxRateEl.value = (myAgency.filerTaxRate !== undefined) ? myAgency.filerTaxRate : 1.5;
    const nonFilerTaxRateEl = document.getElementById('setNonFilerTaxRate');
    if (nonFilerTaxRateEl) nonFilerTaxRateEl.value = (myAgency.nonFilerTaxRate !== undefined) ? myAgency.nonFilerTaxRate : 3.0;
    const enableFbrTaxEl = document.getElementById('setEnableFbrTax');
    const isFbrActive = (myAgency.enableFbrTax === true);
    if (enableFbrTaxEl) {
        enableFbrTaxEl.checked = isFbrActive;
        updateFbrTaxBoxTheme(isFbrActive);
    }

    // 🖨️ Populate Bill Print Customization Checkboxes
    const ps = (window.ebPrintEngine && window.ebPrintEngine.getEffectivePrintSettings)
        ? window.ebPrintEngine.getEffectivePrintSettings(myAgency)
        : (myAgency.printSettings || {});

    const setChk = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = (val !== false);
    };

    setChk('chkShowLogo', ps.showLogo);
    setChk('chkShowAgencyName', ps.showAgencyName);
    setChk('chkShowOwnerName', ps.showOwnerName);
    setChk('chkShowMobiles', ps.showMobiles);
    setChk('chkShowAddress', ps.showAddress);
    setChk('chkShowNTN', ps.showNTN);
    setChk('chkShowLicence', ps.showLicence);
    setChk('chkShowPayType', ps.showPayType);

    setChk('chkShowCustomerName', ps.showCustomerName);
    setChk('chkShowCustomerPhone', ps.showCustomerPhone);
    setChk('chkShowCustomerAddress', ps.showCustomerAddress);
    setChk('chkShowCustomerRoute', ps.showCustomerRoute);
    setChk('chkShowCustomerNTN', ps.showCustomerNTN);

    setChk('chkShowBillNo', ps.showBillNo);
    setChk('chkShowDate', ps.showDate);
    setChk('chkShowTime', ps.showTime);
    setChk('chkShowBookerName', ps.showBookerName);
    setChk('chkShowSupplierName', ps.showSupplierName);

    setChk('chkShowTax', ps.showTax);
    setChk('chkShowPreviousBalance', ps.showPreviousBalance);
    setChk('chkShowReceivedAmount', ps.showReceivedAmount);
    setChk('chkShowBalance', ps.showBalance);

    setChk('chkShowTermsAndConditions', ps.showTermsAndConditions);
    setChk('chkShowSignatureCustomer', ps.showSignatureCustomer);
    setChk('chkShowSignatureBooker', ps.showSignatureBooker);
    setChk('chkShowSignatureAuthorized', ps.showSignatureAuthorized);

    // ⚡ Cloud Sync Settings
    populateSyncSettingsFields();
}

// ============================================
// 🎨 DYNAMIC FBR TAX BOX THEME (GREEN vs GREY)
// ============================================
function updateFbrTaxBoxTheme(isEnabled) {
    const box = document.getElementById('fbrTaxSettingsBox');
    const badge = document.getElementById('fbrTaxStatusBadge');
    const title = document.getElementById('fbrTaxBoxTitle');
    const titleIcon = title ? title.querySelector('i') : null;
    const desc = document.getElementById('fbrTaxDesc');
    const sub = document.getElementById('fbrTaxBoxSub');
    const inputsWrap = document.getElementById('fbrTaxInputsContainer');
    const filerInp = document.getElementById('setFilerTaxRate');
    const nonFilerInp = document.getElementById('setNonFilerTaxRate');
    const lblFiler = document.getElementById('lblFilerRate');
    const lblNonFiler = document.getElementById('lblNonFilerRate');

    if (!box) return;

    if (isEnabled) {
        // 🟢 ACTIVE GREEN STYLING (FBR Tax System ON)
        box.style.background = '#f0fdf4';
        box.style.border = '1.5px solid #86efac';
        box.style.boxShadow = '0 3px 12px rgba(22, 163, 74, 0.08)';
        if (title) title.style.color = '#166534';
        if (titleIcon) titleIcon.style.color = '#16a34a';
        if (sub) sub.style.color = '#15803d';
        if (desc) desc.style.color = '#334155';
        if (badge) {
            badge.style.background = '#dcfce7';
            badge.style.color = '#15803d';
            badge.style.border = '1px solid #86efac';
            badge.innerHTML = '🟢 ON (فعال — 1.5% فائلر / 3% نان فائلر ٹیکس لاگو)';
        }
        if (inputsWrap) {
            inputsWrap.style.opacity = '1';
            inputsWrap.style.pointerEvents = 'auto';
        }
        if (filerInp) {
            filerInp.disabled = false;
            filerInp.style.background = '#ffffff';
            filerInp.style.border = '1px solid #86efac';
            filerInp.style.color = '#166534';
        }
        if (nonFilerInp) {
            nonFilerInp.disabled = false;
            nonFilerInp.style.background = '#ffffff';
            nonFilerInp.style.border = '1px solid #fca5a5';
            nonFilerInp.style.color = '#b91c1c';
        }
        if (lblFiler) lblFiler.style.color = '#15803d';
        if (lblNonFiler) lblNonFiler.style.color = '#b91c1c';
    } else {
        // ⚪ INACTIVE GREY STYLING (Pure Simple Inventory / Billing - OFF)
        box.style.background = '#f8fafc';
        box.style.border = '1.5px solid #cbd5e1';
        box.style.boxShadow = 'none';
        if (title) title.style.color = '#475569';
        if (titleIcon) titleIcon.style.color = '#64748b';
        if (sub) sub.style.color = '#64748b';
        if (desc) desc.style.color = '#64748b';
        if (badge) {
            badge.style.background = '#f1f5f9';
            badge.style.color = '#64748b';
            badge.style.border = '1px solid #cbd5e1';
            badge.innerHTML = '🔴 OFF (غیر فعال — سادہ بلنگ بغیر ٹیکس)';
        }
        if (inputsWrap) {
            inputsWrap.style.opacity = '0.55';
            inputsWrap.style.pointerEvents = 'none';
        }
        if (filerInp) {
            filerInp.disabled = true;
            filerInp.style.background = '#f1f5f9';
            filerInp.style.border = '1px solid #cbd5e1';
            filerInp.style.color = '#64748b';
        }
        if (nonFilerInp) {
            nonFilerInp.disabled = true;
            nonFilerInp.style.background = '#f1f5f9';
            nonFilerInp.style.border = '1px solid #cbd5e1';
            nonFilerInp.style.color = '#64748b';
        }
        if (lblFiler) lblFiler.style.color = '#64748b';
        if (lblNonFiler) lblNonFiler.style.color = '#64748b';
    }
}

// Real-time switch toggle listener
const fbrToggleSwitch = document.getElementById('setEnableFbrTax');
if (fbrToggleSwitch) {
    fbrToggleSwitch.addEventListener('change', function() {
        updateFbrTaxBoxTheme(this.checked);
    });
}

// ============================================
// 💾 SAVE PROFILE & BRANDING
// ============================================
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('setAgencyName').value.trim();
    const tagline = document.getElementById('setAgencyTagline').value.trim();
    const bizType = document.getElementById('setBizType').value;
    const city = document.getElementById('setCity').value.trim();
    const mobile = document.getElementById('setMobile').value.trim();
    const phone = document.getElementById('setPhone').value.trim();
    const address = document.getElementById('setAddress').value.trim();
    const ntn = document.getElementById('setNTN').value.trim();
    const showNTN = document.getElementById('setShowNTN').checked;
    const langMode = document.querySelector('input[name="appLanguageMode"]:checked')?.value || 'en';

    if (!name) {
        Swal.fire('⚠️', 'Business Name lazmi hai!', 'warning');
        return;
    }

    try {
        await db.collection('agencies').doc(myAgencyId).update({
            name: name,
            tagline: tagline,
            businessType: bizType,
            city: city,
            mobile: mobile,
            phone: phone,
            address: address,
            ntn: ntn,
            showNTN: showNTN,
            languageMode: langMode,
            updatedAt: new Date().toISOString()
        });

        // Update local storage cache
        localStorage.setItem(`eb_agency_name_${myAgencyId}`, name);
        localStorage.setItem('eb_app_language', langMode);
        document.documentElement.setAttribute('data-lang', langMode);

        const h = document.getElementById('agencyNameHeader');
        if (h) h.innerText = `🏢 ${name}`;

        Swal.fire({
            toast: true, position: 'top-end', showConfirmButton: false,
            timer: 1800, icon: 'success', title: '✅ Agency Profile & Language Saved!'
        });

    } catch (err) {
        Swal.fire('Error', 'Save failed: ' + err.message, 'error');
    }
});

// ============================================
// 💾 SAVE INVOICING & POS PREFERENCES
// ============================================
document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const defaultTemplate = document.getElementById('setDefaultTemplate').value;
    const thermalPaperWidth = document.getElementById('setThermalWidth').value;
    const billLanguage = document.getElementById('setDefaultBillLanguage')?.value || 'en';
    const defaultPriceMode = document.getElementById('setDefaultPriceMode').value;
    const prefix = document.getElementById('setBillPrefix').value.trim().toUpperCase() || 'STK-';
    const invoiceFooter = document.getElementById('setInvoiceFooter').value.trim();
    const custTypePopupMode = document.querySelector('input[name="custTypePopupMode"]:checked')?.value || 'hide';
    const filerTaxRate = parseFloat(document.getElementById('setFilerTaxRate')?.value) || 0;
    const nonFilerTaxRate = parseFloat(document.getElementById('setNonFilerTaxRate')?.value) || 0;
    const enableFbrTax = document.getElementById('setEnableFbrTax')?.checked || false;

    // 🖨️ Collect Print Customization Checkbox States
    const getChk = (id) => {
        const el = document.getElementById(id);
        return el ? el.checked : true;
    };

    const printSettings = {
        showLogo: getChk('chkShowLogo'),
        showAgencyName: getChk('chkShowAgencyName'),
        showOwnerName: getChk('chkShowOwnerName'),
        showMobiles: getChk('chkShowMobiles'),
        showAddress: getChk('chkShowAddress'),
        showNTN: getChk('chkShowNTN'),
        showLicence: getChk('chkShowLicence'),
        showPayType: getChk('chkShowPayType'),

        showCustomerName: getChk('chkShowCustomerName'),
        showCustomerPhone: getChk('chkShowCustomerPhone'),
        showCustomerAddress: getChk('chkShowCustomerAddress'),
        showCustomerRoute: getChk('chkShowCustomerRoute'),
        showCustomerNTN: getChk('chkShowCustomerNTN'),

        showBillNo: getChk('chkShowBillNo'),
        showDate: getChk('chkShowDate'),
        showTime: getChk('chkShowTime'),
        showBookerName: getChk('chkShowBookerName'),
        showSupplierName: getChk('chkShowSupplierName'),

        showSubTotal: true,
        showDiscount: true,
        showTax: getChk('chkShowTax'),
        showGrandTotal: true,
        showPreviousBalance: getChk('chkShowPreviousBalance'),
        showReceivedAmount: getChk('chkShowReceivedAmount'),
        showBalance: getChk('chkShowBalance'),

        showTermsAndConditions: getChk('chkShowTermsAndConditions'),
        showSignatureCustomer: getChk('chkShowSignatureCustomer'),
        showSignatureBooker: getChk('chkShowSignatureBooker'),
        showSignatureAuthorized: getChk('chkShowSignatureAuthorized')
    };

    try {
        await db.collection('agencies').doc(myAgencyId).update({
            defaultTemplate: defaultTemplate,
            thermalPaperWidth: thermalPaperWidth,
            billLanguage: billLanguage,
            defaultPriceMode: defaultPriceMode,
            'billPrefixes.stock': prefix,
            invoiceFooter: invoiceFooter,
            custTypePopupMode: custTypePopupMode,
            filerTaxRate: filerTaxRate,
            nonFilerTaxRate: nonFilerTaxRate,
            enableFbrTax: enableFbrTax,
            printSettings: printSettings,
            updatedAt: new Date().toISOString()
        });

        localStorage.setItem('eb_cust_type_popup', custTypePopupMode);
        localStorage.setItem('eb_enable_fbr_tax', enableFbrTax ? 'yes' : 'no');
        localStorage.setItem('eb_filer_tax_rate', String(filerTaxRate));
        localStorage.setItem('eb_nonfiler_tax_rate', String(nonFilerTaxRate));
        localStorage.setItem('eb_print_settings', JSON.stringify(printSettings));
        localStorage.setItem('eb_thermal_width', thermalPaperWidth);
        localStorage.setItem('eb_bill_language', billLanguage);

        Swal.fire({
            toast: true, position: 'top-end', showConfirmButton: false,
            timer: 1800, icon: 'success', title: '✅ Invoicing & FBR Tax Settings Saved!'
        });

    } catch (err) {
        Swal.fire('Error', 'Save failed: ' + err.message, 'error');
    }
});

// ============================================
// 💾 SAVE INVENTORY RULES
// ============================================
document.getElementById('inventoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const defaultLowStockLimit = parseInt(document.getElementById('setDefaultLowStock').value) || 10;
    const autoDeductStock = document.getElementById('setAutoDeductStock').checked;

    try {
        await db.collection('agencies').doc(myAgencyId).update({
            defaultLowStockLimit: defaultLowStockLimit,
            autoDeductStock: autoDeductStock,
            updatedAt: new Date().toISOString()
        });

        Swal.fire({
            toast: true, position: 'top-end', showConfirmButton: false,
            timer: 1800, icon: 'success', title: '✅ Inventory Rules Saved!'
        });

    } catch (err) {
        Swal.fire('Error', 'Save failed: ' + err.message, 'error');
    }
});

// ============================================
// 🔑 CHANGE PASSWORD
// ============================================
document.getElementById('btnChangePassword').addEventListener('click', async () => {
    const { value: newPassword } = await Swal.fire({
        title: '🔑 Change Password',
        input: 'password',
        inputLabel: 'Enter New Password (min 6 characters)',
        inputPlaceholder: 'New Password',
        showCancelButton: true,
        confirmButtonText: 'Update Password',
        confirmButtonColor: '#3b82f6',
        inputValidator: (val) => {
            if (!val || val.length < 6) return 'Password min 6 characters ka hona chahiye!';
        }
    });

    if (newPassword) {
        try {
            await auth.currentUser.updatePassword(newPassword);
            Swal.fire('✅ Success', 'Aap ka password kamiyabi se update ho gaya hai!', 'success');
        } catch (e) {
            Swal.fire('❌ Error', 'Password update fail: ' + e.message, 'error');
        }
    }
});

// ============================================
// 🧹 CLEAR OFFLINE CACHE
// ============================================
document.getElementById('btnClearCache').addEventListener('click', async () => {
    const res = await Swal.fire({
        title: '🧹 Reset Device Offline Cache?',
        text: 'Is se device ka purana cache saaf ho jayega aur Firebase se fresh data load hoga.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Yes, Reset Cache'
    });

    if (res.isConfirmed) {
        // Clear all eb_ localStorage items
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('eb_')) {
                localStorage.removeItem(key);
            }
        });

        Swal.fire({
            icon: 'success',
            title: 'Cache Cleared!',
            text: 'Fresh data load kiya ja raha hai...',
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            window.location.reload();
        });
    }
});

    const setLogout = document.getElementById('logoutBtn');
    if (setLogout) {
        setLogout.addEventListener('click', async () => {
            const res = await Swal.fire({ title: 'Logout?', icon: 'question', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes', cancelButtonText: 'Cancel' });
            if (res.isConfirmed) {
                await auth.signOut();
                window.location.href = 'auth.html';
            }
        });
    }

// ============================================
// ⚡ CLOUD SYNC & SHIFT CONTROLLER
// ============================================
function populateSyncSettingsFields() {
    initSyncDashboardUI();
}

let syncClockTimer = null;
function initSyncDashboardUI() {
    if (!window.CloudSync) return;
    const activeAgId = myAgencyId || (myUser && myUser.agencyId) || localStorage.getItem('eb_active_agencyId');

    function renderDashboard() {
        const currentAgId = myAgencyId || (myUser && myUser.agencyId) || localStorage.getItem('eb_active_agencyId');
        const status = window.CloudSync.getSyncStatus(currentAgId);
        const clockEl = document.getElementById('secSyncClockDisplay');
        const shiftNameEl = document.getElementById('secSyncShiftNameDisplay');
        const badgeEl = document.getElementById('secSyncStatusBadge');
        const countdownEl = document.getElementById('secSyncCountdown');
        const lastTimeEl = document.getElementById('secSyncLastTimeDisplay');
        const readsSavedEl = document.getElementById('secSyncReadsSavedDisplay');
        const netEl = document.getElementById('secSyncNetStatusDisplay');

        if (clockEl) clockEl.innerText = status.pkt.formattedTime;
        if (shiftNameEl) shiftNameEl.innerText = status.pkt.shiftTitle;
        if (countdownEl) countdownEl.innerText = status.pkt.nextShiftIn;
        if (lastTimeEl) lastTimeEl.innerText = status.lastFormatted;
        if (readsSavedEl) readsSavedEl.innerText = `${status.readsSaved.toLocaleString()} reads`;

        if (netEl) {
            const isOnline = navigator.onLine;
            netEl.innerHTML = isOnline 
                ? '<span style="color:#34d399; font-weight:800;">🟢 Online</span>' 
                : '<span style="color:#f87171; font-weight:800;">🔴 Offline (Connect to sync)</span>';
        }

        if (badgeEl) {
            if (status.isShiftSynced) {
                badgeEl.style.background = '#10b981';
                badgeEl.innerText = '✅ 1 of 1 Refresh Used (Cached)';
            } else {
                badgeEl.style.background = '#0284c7';
                badgeEl.innerText = '⚡ 1 Refresh Available';
            }
        }
    }

    renderDashboard();
    if (syncClockTimer) clearInterval(syncClockTimer);
    syncClockTimer = setInterval(renderDashboard, 1000);

    window.addEventListener('online', renderDashboard);
    window.addEventListener('offline', renderDashboard);
}

// 🔄 Manual Refresh Button in Settings Tab
const btnSecSyncNow = document.getElementById('btnSecSyncNow');
if (btnSecSyncNow) {
    btnSecSyncNow.addEventListener('click', async () => {
        if (!window.CloudSync) return;
        const currentAgId = myAgencyId || (myUser && myUser.agencyId) || localStorage.getItem('eb_active_agencyId');

        // 1. Offline Check
        if (!navigator.onLine) {
            Swal.fire({
                icon: 'warning',
                title: 'You Are Offline',
                text: 'Internet connection required. Please connect to the internet first to refresh cloud data.',
                confirmButtonColor: '#0284c7'
            });
            return;
        }

        if (!currentAgId) {
            Swal.fire({
                icon: 'info',
                title: 'Sync Notice',
                text: 'Agency account details are loading. Please try again in a moment.',
                confirmButtonColor: '#0284c7'
            });
            return;
        }

        // 2. Strict 1-Refresh-Per-Shift Check
        const status = window.CloudSync.getSyncStatus(currentAgId);
        if (status.isShiftSynced) {
            Swal.fire({
                icon: 'info',
                title: 'Shift Refresh Limit Reached',
                html: `
                    <div style="font-size:13px; color:#334155; line-height:1.6; text-align:left;">
                        <p style="margin:0 0 10px 0;">
                            <b>You have already refreshed data for this shift:</b><br>
                            <span style="color:#0284c7; font-weight:700;">${status.pkt.shiftTitle}</span>
                        </p>
                        <div style="background:#f1f5f9; border-left:4px solid #0284c7; padding:10px 12px; border-radius:4px; margin-bottom:12px;">
                            Only <b>1 refresh</b> is permitted per shift to protect database quotas.<br>
                            Next shift refresh unlocks in: <b style="color:#0f172a;">${status.pkt.nextShiftIn}</b>
                        </div>
                        <span style="font-size:12px; color:#64748b;">
                            All current stock and customer records are safely stored locally with instant access.
                        </span>
                    </div>
                `,
                confirmButtonText: 'OK',
                confirmButtonColor: '#0284c7'
            });
            return;
        }

        // 3. Perform Sync
        const originalText = btnSecSyncNow.innerHTML;
        btnSecSyncNow.disabled = true;
        btnSecSyncNow.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';

        try {
            await window.CloudSync.syncShiftData(currentAgId, { db, silent: false });
            initSyncDashboardUI();
        } catch (e) {
            console.error('Manual sync failed:', e);
            Swal.fire({
                icon: 'error',
                title: 'Sync Error',
                text: e.message || 'Failed to sync with cloud.',
                confirmButtonColor: '#ef4444'
            });
        } finally {
            btnSecSyncNow.disabled = false;
            btnSecSyncNow.innerHTML = originalText;
        }
    });
}

