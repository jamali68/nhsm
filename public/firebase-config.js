// ==========================================================================
// 🔌 EASY BILL GENERATOR — CENTRAL FIREBASE CONFIGURATION
// Kisi bhi client ya hosting (Netlify/Vercel/PC) par sirf is file mein
// Firebase key update karne se pura project chal jaye ga!
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

// Initialize if firebase is present on window
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    // Offline persistence enable karo ta k internet na hone par bhi data safe rahay
    try {
        firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('Firestore persistence failed: Multiple tabs open');
            } else if (err.code === 'unimplemented') {
                console.warn('Firestore persistence not supported by browser');
            }
        });
    } catch (e) {
        console.warn('Offline persistence info:', e);
    }
}

window.ebFirebaseConfig = firebaseConfig;
