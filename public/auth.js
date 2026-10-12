// ============================================
// 🔐 EASY BILL GENERATOR — AUTH SYSTEM (v3)
// ✅ Login + Signup (Pehla user = SUPER ADMIN)
// ✅ Google Login (Continue with Google)
// ✅ Bilingual (English/Urdu)
// ✅ Crash-proof (DOMContentLoaded wrapper)
// ✅ Naam: Easy Bill Generator
// ============================================

// ⚠️ AAP KA CONFIG (multupos project)
const firebaseConfig = {
    apiKey: "AIzaSyDDwKWcixoUThCJQqiVoBcUVsJZI60h43Q",
    authDomain: "multipos-ed91a.firebaseapp.com",
    projectId: "multipos-ed91a",
    storageBucket: "multipos-ed91a.firebasestorage.app",
    messagingSenderId: "862649586987",
    appId: "1:862649586987:web:599772124e4e29404ca16e",
    measurementId: "G-QPCP7S5Q5L"
};

// ============================================
// 🌐 TRANSLATIONS
// ============================================
const AUTH_TEXTS = {
    en: {
        appTitle: "Easy Bill Generator",
        appSubtitle: "Smart Business Management",
        tabLogin: "Login",
        tabSignup: "Sign Up",
        loginBtn: "Login to POS",
        signupBtn: "Create Account — FREE",
        googleBtn: "Continue with Google (Owner Only)",
        staffNoticeTitle: "Field Staff (Order Booker & Supplier) Login:",
        staffNoticeDesc: "Enter your Admin-assigned <b>Email or Mobile</b> and <b>Password</b> (e.g. <code>123456</code>), then click <b>Login</b> below.",
        ownerOnlyDivider: "For Business Owners Only",
        staffHelperNote: "⚠️ Order Bookers & Suppliers please log in using Email/Mobile and Password above",
        bizSection: "🏢 Business Information",
        accSection: "🔐 Account Details",
        selectType: "Select Business Type *",
        msgBizName: "Business Name is required!",
        msgBizType: "Please select a Business Type!",
        msgAgencyDone: "🎉 Agency created! Welcome to Free Package!",
        signupNote: "🚀 Use HN Software — Starting Free of Cost!",
        msgCreated: "Account created! Setup complete ✅",
        msgNoMatch: "Passwords do not match!",
        msgShort: "Password must be at least 6 characters!",
        msgWrongPass: "Incorrect email, mobile or password!",
        msgExists: "This email is already registered! Please Login.",
        msgTooMany: "Too many attempts. Please try again later.",
        msgNetwork: "Network error. Please check your internet connection.",
        msgGeneric: "Something went wrong. Please try again.",
        msgFirebaseLoad: "⚠️ Firebase service failed to load — Please check internet and refresh!"
    },
    ur: {
        appTitle: "ایزی بل جنریٹر",
        appSubtitle: "سمارٹ بزنس مینجمنٹ",
        tabLogin: "لاگ اِن",
        tabSignup: "نیا اکاؤنٹ",
        loginBtn: "لاگ اِن کریں",
        signupBtn: "اکاؤنٹ بنائیں — مفت",
        googleBtn: "گوگل کے ساتھ جاری رکھیں (صرف اونر)",
        staffNoticeTitle: "فیلڈ اسٹاف (بکر اور سپلائر) لاگ اِن:",
        staffNoticeDesc: "ایڈمن کا دیا ہوا <b>ای میل یا فون نمبر</b> اور <b>پاسورڈ</b> (مثلاً <code>123456</code>) لکھ کر نیچے سبز بٹن <b>Login</b> دبائیں۔",
        ownerOnlyDivider: "صرف بزنس اونر کے لیے",
        staffHelperNote: "⚠️ بکر اور سپلائر اوپر ای میل/موبائل اور پاسورڈ درج کر کے لاگ اِن کریں",
        bizSection: "🏢 کاروبار کی معلومات",
        accSection: "🔐 اکاؤنٹ کی تفصیلات",
        selectType: "کاروبار کی قسم منتخب کریں *",
        msgBizName: "کاروبار کا نام لازمی ہے!",
        msgBizType: "کاروبار کی قسم منتخب کریں!",
        msgAgencyDone: "🎉 ایجنسی بن گئی! فری پیکج میں خوش آمدید!",
        signupNote: "🚀 HN سافٹ ویئر استعمال کریں — بالکل مفت شروع کریں (Free of Cost)!",
        msgCreated: "اکاؤنٹ بن گیا! سیٹ اپ مکمل ✅",
        msgNoMatch: "پاس ورڈ میچ نہیں ہو رہے!",
        msgShort: "پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے!",
        msgWrongPass: "ای میل یا پاس ورڈ غلط ہے!",
        msgExists: "یہ ای میل پہلے سے رجسٹرڈ ہے! لاگ اِن کریں۔",
        msgTooMany: "بہت زیادہ کوششیں۔ تھوڑی دیر بعد کوشش کریں۔",
        msgNetwork: "انٹرنیٹ کا مسئلہ ہے۔ چیک کریں۔",
        msgGeneric: "کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔",
        msgFirebaseLoad: "⚠️ فائر بیس لوڈ نہیں ہوا — انٹرنیٹ چیک کریں اور ریفریش کریں!"
    }
};

let authLang = localStorage.getItem('auth_lang') || 'en';
let auth = null, db = null, firebaseReady = false;

// ============================================
// 🚀 SAB KUCH DOMContentLoaded KE ANDAR (crash-proof!)
// ============================================
document.addEventListener('DOMContentLoaded', function() {

    // -------------------------------------------
    // 🔥 FIREBASE INIT (safety check ke sath)
    // -------------------------------------------
    const msgEl = document.getElementById('authMessage');
    try {
        if (typeof firebase === 'undefined') {
            throw new Error(AUTH_TEXTS[authLang].msgFirebaseLoad);
        }
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        try {
            db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
        } catch (_) {}
        firebaseReady = true;
    } catch (e) {
        // 🔴 Visible error — chupchaap marne ke bajaye batao!
        if (msgEl) {
            msgEl.innerText = e.message;
            msgEl.style.color = '#e74c3c';
        }
        console.error('Firebase Init Error:', e);
    }

    const T = () => AUTH_TEXTS[authLang];

    // -------------------------------------------
    // 📢 MESSAGE HELPER
    // -------------------------------------------
    function showAuthMsg(msgKey, type = 'error') {
        const el = document.getElementById('authMessage');
        el.innerText = T()[msgKey] || msgKey;
        el.style.color = type === 'error' ? '#e74c3c' : '#27ae60';
    }

    function btnLoading(btnId, loading) {
        document.getElementById(btnId).disabled = loading;
    }

    // -------------------------------------------
    // 🔥 FIREBASE ERROR TRANSLATOR
    // -------------------------------------------
    function translateFirebaseError(error) {
        switch (error.code) {
            case 'auth/invalid-email': return 'msgGeneric';
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential': return 'msgWrongPass';
            case 'auth/email-already-in-use': return 'msgExists';
            case 'auth/weak-password': return 'msgShort';
            case 'auth/too-many-requests': return 'msgTooMany';
            case 'auth/network-request-failed': return 'msgNetwork';
            default: return 'msgGeneric';
        }
    }

    // -------------------------------------------
    // 🌐 LANGUAGE SWITCHER
    // -------------------------------------------
    function setAuthLang(lang) {
        authLang = lang;
        localStorage.setItem('auth_lang', lang);
        const L = AUTH_TEXTS[lang];

        // data-i18n elements update
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (L[key]) {
                if (L[key].includes('<')) {
                    el.innerHTML = L[key];
                } else {
                    el.innerText = L[key];
                }
            }
        });

        // Placeholders
        const elLoginEmail = document.getElementById('loginEmail');
        if (elLoginEmail) elLoginEmail.placeholder = lang === 'ur' ? 'ای میل یا موبائل / یوزر نیم' : 'Email or Mobile / Username';
        const elLoginPass = document.getElementById('loginPassword');
        if (elLoginPass) elLoginPass.placeholder = lang === 'ur' ? 'پاس ورڈ' : 'Password';
        const elBizName = document.getElementById('bizName');
        if (elBizName) elBizName.placeholder = lang === 'ur' ? 'کاروبار کا نام *' : 'Business Name *';
        const elBizMobile = document.getElementById('bizMobile');
        if (elBizMobile) elBizMobile.placeholder = lang === 'ur' ? 'موبائل نمبر (اختیاری)' : 'Mobile Number (optional)';
        const elBizCity = document.getElementById('bizCity');
        if (elBizCity) elBizCity.placeholder = lang === 'ur' ? 'شہر (اختیاری)' : 'City (optional)';
        const elOwnerName = document.getElementById('ownerName');
        if (elOwnerName) elOwnerName.placeholder = lang === 'ur' ? 'آپ کا مکمل نام (اختیاری)' : 'Your Full Name (optional)';
        const elSignupEmail = document.getElementById('signupEmail');
        if (elSignupEmail) elSignupEmail.placeholder = 'Email';
        const elSignupPass = document.getElementById('signupPassword');
        if (elSignupPass) elSignupPass.placeholder = lang === 'ur' ? 'پاس ورڈ (کم از کم 6 حروف)' : 'Password (min 6 characters)';
        const elSignupConfirm = document.getElementById('signupConfirm');
        if (elSignupConfirm) elSignupConfirm.placeholder = lang === 'ur' ? 'پاس ورڈ دوبارہ لکھیں' : 'Confirm Password';

        // Direction (RTL/LTR)
        document.getElementById('authWrapper').setAttribute('dir', lang === 'ur' ? 'rtl' : 'ltr');

        // Language buttons active state
        document.getElementById('langEn').classList.toggle('active', lang === 'en');
        document.getElementById('langUr').classList.toggle('active', lang === 'ur');
    }

    // Apply language on startup
    setAuthLang(authLang);

    document.getElementById('langEn').addEventListener('click', () => setAuthLang('en'));
    document.getElementById('langUr').addEventListener('click', () => setAuthLang('ur'));

    // -------------------------------------------
    // 🔄 TAB SWITCHING (Login ↔ Signup)
    // -------------------------------------------
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    });

    tabSignup.addEventListener('click', () => {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        signupForm.style.display = 'block';
        loginForm.style.display = 'none';
    });

    // -------------------------------------------
    // 👁️ PASSWORD TOGGLE
    // -------------------------------------------
    document.querySelectorAll('.toggle-pass').forEach(eye => {
        eye.addEventListener('click', function() {
            const input = document.getElementById(this.dataset.target);
            input.type = input.type === 'password' ? 'text' : 'password';
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    });

    // -------------------------------------------
    // 📝 SIGNUP — PEHLA USER = SUPER ADMIN
    // -------------------------------------------
        signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        document.getElementById('authMessage').innerText = '';

        // Firebase ready check
        if (!firebaseReady) return showAuthMsg('msgFirebaseLoad');

        // 🆕 Business fields bhi collect karo!
        const bizName = document.getElementById('bizName').value.trim();
        const bizType = document.getElementById('bizType').value;
        const bizMobile = document.getElementById('bizMobile').value.trim();
        const bizCity = document.getElementById('bizCity').value.trim();
        const ownerName = document.getElementById('ownerName').value.trim();

        const email = document.getElementById('signupEmail').value.trim();
        const pass = document.getElementById('signupPassword').value;
        const confirm = document.getElementById('signupConfirm').value;

        // ✅ Validations (Business Name + Type LAZMI!)
        if (!bizName) return showAuthMsg('msgBizName');
        if (!bizType) return showAuthMsg('msgBizType');
        if (pass.length < 6) return showAuthMsg('msgShort');
        if (pass !== confirm) return showAuthMsg('msgNoMatch');

        btnLoading('signupBtn', true);

        try {
            // 1. Pehla user check (pehla = super-admin, baqi = owner)
            let role = 'owner';
            try {
                const usersSnap = await db.collection('users').limit(1).get();
                if (usersSnap.empty) role = 'super-admin';
            } catch (ruleErr) {
                console.warn('Read check:', ruleErr);
            }

            // 2. Firebase Auth — user create
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            const uid = cred.user.uid;

            // 3. 🆕 AGENCY CREATE (Self-Service Unlimited Capacity — No waiting for Super Admin!)
            let agencyId = null;
            if (role === 'owner') {
                const today = new Date();
                today.setDate(today.getDate() + 30);
                const expiryStr = today.toISOString().slice(0, 10);

                const agencyRef = await db.collection('agencies').add({
                    name: bizName,
                    businessType: bizType,
                    mobile: bizMobile || '',
                    city: bizCity || '',
                    packageId: 'free',
                    monthlyFee: 0,
                    subscriptionExpiry: expiryStr,
                    subscriptionStatus: 'active',
                    status: 'active',
                    ownerUid: uid,
                    ownerEmail: email,
                    limits: {
                        monthlyBills: 150,
                        maxItems: 50,
                        maxBookers: 1,
                        maxBranches: 1
                    },
                    createdAt: new Date().toISOString()
                });
                agencyId = agencyRef.id;
            }

            // 4. User profile save (agency linked!)
            await db.collection('users').doc(uid).set({
                email: email,
                name: ownerName || bizName + ' (Owner)',
                role: role,
                loginMethod: 'email',
                agencyId: role === 'super-admin' ? 'super-admin-hq' : agencyId,
                packageId: 'free',
                permissions: { instant: true, stock: true },
                createdAt: new Date().toISOString(),
                createdBy: role === 'super-admin' ? 'system-first' : 'signup'
            });

            // ✅ Success!
            btnLoading('signupBtn', false);
            
            const T2 = T();
            await Swal.fire({
                icon: 'success',
                title: role === 'super-admin' ? T2.msgCreated : T2.msgAgencyDone,
                text: role === 'owner' ? `🏢 ${bizName} — Active & Ready to use!` : '',
                timer: 3000,
                showConfirmButton: false,
                timerProgressBar: true
            });

            window.location.href = 'dashboard.html';

        } catch (error) {
            btnLoading('signupBtn', false);
            showAuthMsg(translateFirebaseError(error));
            console.error('Signup Error:', error);
        }
    });

    // -------------------------------------------
    // 🔑 LOGIN (Email, Mobile, or Staff ID + Password)
    // -------------------------------------------
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        document.getElementById('authMessage').innerText = '';

        if (!firebaseReady) return showAuthMsg('msgFirebaseLoad');

        const inputRaw = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPassword').value;

        btnLoading('loginBtn', true);

        try {
            let emailToUse = inputRaw.toLowerCase();

            // 🔍 Smart Identifier Resolution (Email, Mobile, or Username)
            if (!emailToUse.includes('@')) {
                const cleanPhone = inputRaw.replace(/\D/g, '');
                try {
                    // Try mobile match
                    let uSnap = await db.collection('users').where('mobile', '==', inputRaw).limit(1).get();
                    if (uSnap.empty && cleanPhone) {
                        uSnap = await db.collection('users').where('mobile', '==', cleanPhone).limit(1).get();
                    }
                    if (!uSnap.empty) {
                        emailToUse = uSnap.docs[0].data().email || emailToUse;
                    } else {
                        // Try matching normalized email
                        emailToUse = inputRaw.replace(/[^a-zA-Z0-9]/g, '') + '@tajkaryana.com';
                    }
                } catch (resErr) {
                    console.warn('Smart login resolver note:', resErr);
                    emailToUse = inputRaw.replace(/[^a-zA-Z0-9]/g, '') + '@tajkaryana.com';
                }
            }

            // Attempt Login
            try {
                await auth.signInWithEmailAndPassword(emailToUse, pass);
            } catch (authErr) {
                // 🛠️ Self-healing fallback: If staff exists in Firestore with matching tempPassword, auto-create in Auth!
                if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
                    const staffSnap = await db.collection('users').where('email', '==', emailToUse).limit(1).get();
                    if (!staffSnap.empty) {
                        const sData = staffSnap.docs[0].data();
                        if (sData.tempPassword && sData.tempPassword === pass) {
                            await auth.createUserWithEmailAndPassword(emailToUse, pass);
                        } else {
                            throw authErr;
                        }
                    } else {
                        throw authErr;
                    }
                } else {
                    throw authErr;
                }
            }

            let targetUrl = 'dashboard.html';
            const curUser = auth.currentUser;
            if (curUser) {
                if (curUser.email === 'aliimtiaz1126@gmail.com') {
                    targetUrl = 'admin.html';
                } else {
                    try {
                        const uDoc = await db.collection('users').doc(curUser.uid).get();
                        if (uDoc.exists && uDoc.data().role === 'super-admin') {
                            targetUrl = 'admin.html';
                        }
                    } catch (eR) {
                        console.warn('Role redirect check:', eR);
                    }
                }
            }

            btnLoading('loginBtn', false);
            window.location.href = targetUrl;
        } catch (error) {
            btnLoading('loginBtn', false);
            showAuthMsg(translateFirebaseError(error));
            console.error('Login Error:', error);
        }
    });

    // -------------------------------------------
    // 🌐 GOOGLE LOGIN (Continue with Google)
    // ============================================
    async function handleGoogleLogin() {
        if (!firebaseReady) return showAuthMsg('msgFirebaseLoad');

        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        try {
            const cred = await auth.signInWithPopup(provider);
            const user = cred.user;
            const uid = user.uid;

            // Check: Pehla user? → Super Admin. Naya? → profile banao
            const userDoc = await db.collection('users').doc(uid).get();

            if (!userDoc.exists) {
                // 🆕 Naya Google user — profile banao
                let role = 'owner';
                try {
                    const usersSnap = await db.collection('users').limit(1).get();
                    if (usersSnap.empty) role = 'super-admin';
                } catch (e) {
                    console.warn('Rules read issue:', e);
                }

                const displayName = user.displayName || user.email.split('@')[0];

                await db.collection('users').doc(uid).set({
                    email: user.email,
                    name: displayName,
                    role: role,
                    loginMethod: 'google',
                    agencyId: role === 'super-admin' ? 'super-admin-hq' : null,
                    permissions: { instant: true, stock: true },
                    createdAt: new Date().toISOString()
                });
            }
            // (Profile already hai — sirf login, kuch nahi karna)

            let targetUrl = 'dashboard.html';
            if (user.email === 'aliimtiaz1126@gmail.com') {
                targetUrl = 'admin.html';
            } else {
                try {
                    const uDoc = await db.collection('users').doc(uid).get();
                    if (uDoc.exists && uDoc.data().role === 'super-admin') {
                        targetUrl = 'admin.html';
                    }
                } catch (eG) {
                    console.warn(eG);
                }
            }
            window.location.href = targetUrl;

        } catch (error) {
            if (error.code === 'auth/popup-closed-by-user') {
                return; // User ne popup band kiya — koi masla nahi
            }
            if (error.code === 'auth/popup-blocked') {
                // Popup blocked — redirect method try karo
                try {
                    await auth.signInWithRedirect(provider);
                } catch (e2) {
                    showAuthMsg('msgGeneric');
                }
                return;
            }
            console.error('Google Login Error:', error);
            showAuthMsg('msgGeneric');
        }
    }

    const gLoginBtn = document.getElementById('googleLoginBtn');
    if (gLoginBtn) gLoginBtn.addEventListener('click', handleGoogleLogin);

    const gSignupBtn = document.getElementById('googleSignupBtn');
    if (gSignupBtn) gSignupBtn.addEventListener('click', handleGoogleLogin);
    // (Dono buttons same kaam — login/signup auto handle!)

    // -------------------------------------------
    // 🔄 AUTO-LOGIN & REDIRECT CHECK
    // -------------------------------------------
    if (firebaseReady) {
        // Handle redirect result if signInWithRedirect was triggered (e.g. on mobile/restricted popups)
        auth.getRedirectResult().then(async (result) => {
            if (result && result.user) {
                const user = result.user;
                const uid = user.uid;
                const userDoc = await db.collection('users').doc(uid).get();
                if (!userDoc.exists) {
                    let role = 'owner';
                    try {
                        const usersSnap = await db.collection('users').limit(1).get();
                        if (usersSnap.empty) role = 'super-admin';
                    } catch (e) {
                        console.warn(e);
                    }
                    const displayName = user.displayName || user.email.split('@')[0];
                    await db.collection('users').doc(uid).set({
                        email: user.email,
                        name: displayName,
                        role: role,
                        loginMethod: 'google',
                        agencyId: role === 'super-admin' ? 'super-admin-hq' : null,
                        permissions: { instant: true, stock: true },
                        createdAt: new Date().toISOString()
                    });
                }
                let targetUrl = 'dashboard.html';
                if (user.email === 'aliimtiaz1126@gmail.com') {
                    targetUrl = 'admin.html';
                } else {
                    try {
                        const uDoc = await db.collection('users').doc(uid).get();
                        if (uDoc.exists && uDoc.data().role === 'super-admin') {
                            targetUrl = 'admin.html';
                        }
                    } catch (eG) {
                        console.warn(eG);
                    }
                }
                window.location.href = targetUrl;
            }
        }).catch((err) => {
            console.warn('Redirect result check:', err);
        });

        auth.onAuthStateChanged((user) => {
            if (user) {
                window.location.href = user.email === 'aliimtiaz1126@gmail.com' ? 'admin.html' : 'dashboard.html';
            }
        });
    }

    // -------------------------------------------
    // 🚀 INIT LANGUAGE
    // -------------------------------------------
    setAuthLang(authLang);
});
