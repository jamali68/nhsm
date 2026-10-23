// 🏷️ Central Application Version (Single source of truth)
window.EASYBILL_VERSION = '4.3.1';

// 🔄 Live Version Synchronization with manifest.json
(function syncManifestVersion() {
    if (typeof window !== 'undefined' && window.fetch) {
        fetch('manifest.json?t=' + Date.now(), { cache: 'no-cache' })
            .then(function(r) {
                if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
                    return r.json();
                }
                return null;
            })
            .then(function(m) {
                if (m && m.version) {
                    window.EASYBILL_VERSION = m.version;
                    var els = document.querySelectorAll('.eb-sidebar-version, [data-app-version]');
                    els.forEach(function(el) {
                        el.textContent = 'Version ' + m.version;
                    });
                }
            })
            .catch(function() {});
    }
})();

(function initGlobalTheme() {
    // 🛡️ Ensure App Guard & Domain Lock is loaded across all pages
    if (!document.getElementById('eb-app-guard-script') && typeof window.EB_GUARD === 'undefined') {
        const guardScript = document.createElement('script');
        guardScript.id = 'eb-app-guard-script';
        guardScript.async = false;
        guardScript.src = 'app-guard.js';
        (document.head || document.documentElement).appendChild(guardScript);
    }

    const STORAGE_KEY = 'eb_theme_mode';
    
    // Read saved theme preference (default to dark as established by app shell, or light if specified)
    function getSavedTheme() {
        return localStorage.getItem(STORAGE_KEY) || 'dark';
    }

    function applyLanguage(lang) {
        const activeLang = lang || localStorage.getItem('eb_app_language') || 'en';
        document.documentElement.setAttribute('data-lang', activeLang);
    }

    function applyTheme(theme) {
        const validThemes = ['dark', 'night', 'light', 'theme-green', 'theme-red', 'theme-blue', 'theme-purple', 'theme-yellow', 'theme-orange'];
        const activeTheme = theme || 'dark';
        
        // Remove all previous theme classes
        document.documentElement.classList.remove('dark-theme', 'theme-green', 'theme-red', 'theme-blue', 'theme-purple', 'theme-yellow', 'theme-orange');
        if (document.body) {
            document.body.classList.remove('dark-theme', 'theme-green', 'theme-red', 'theme-blue', 'theme-purple', 'theme-yellow', 'theme-orange');
        }

        if (activeTheme === 'dark' || activeTheme === 'night') {
            document.documentElement.classList.add('dark-theme');
            document.documentElement.setAttribute('data-theme', 'dark');
            if (document.body) {
                document.body.classList.add('dark-theme');
                document.body.setAttribute('data-theme', 'dark');
            }
        } else if (activeTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            if (document.body) {
                document.body.setAttribute('data-theme', 'light');
            }
        } else {
            // Preset for future themes
            document.documentElement.classList.add(activeTheme);
            document.documentElement.setAttribute('data-theme', activeTheme);
            if (document.body) {
                document.body.classList.add(activeTheme);
                document.body.setAttribute('data-theme', activeTheme);
            }
        }
    }

    // Apply immediately to prevent flash
    const currentTheme = getSavedTheme();
    applyTheme(currentTheme);
    applyLanguage();

    // Notify parent window when module is loaded and ready
    function notifyParentModuleReady() {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'MODULE_STATUS',
                status: 'connected',
                module: window.location.pathname.split('/').pop() || 'dashboard.html',
                timestamp: Date.now()
            }, '*');
        }
    }

    // Apply when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            applyTheme(getSavedTheme());
            applyLanguage();
            notifyParentModuleReady();
        });
    } else {
        applyTheme(currentTheme);
        applyLanguage();
        notifyParentModuleReady();
    }

    // Also notify on window load event
    window.addEventListener('load', notifyParentModuleReady);

    // Listen for theme change message from parent window / iframe
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'THEME_CHANGED') {
            applyTheme(event.data.theme);
        } else if (event.data && event.data.type === 'PING_MODULE') {
            notifyParentModuleReady();
        }
    });

    // Listen for online / offline events
    window.addEventListener('online', () => {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'MODULE_NETWORK',
                online: true,
                module: window.location.pathname.split('/').pop() || 'dashboard.html'
            }, '*');
        }
    });

    window.addEventListener('offline', () => {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'MODULE_NETWORK',
                online: false,
                module: window.location.pathname.split('/').pop() || 'dashboard.html'
            }, '*');
        }
    });

    // Also listen to storage events across tabs
    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY && event.newValue) {
            applyTheme(event.newValue);
        }
    });

    // Expose helpers globally
    window.ebTheme = {
        getTheme: getSavedTheme,
        setTheme: (newTheme) => {
            localStorage.setItem(STORAGE_KEY, newTheme);
            applyTheme(newTheme);
        },
        toggleTheme: () => {
            const next = getSavedTheme() === 'dark' ? 'light' : 'dark';
            localStorage.setItem(STORAGE_KEY, next);
            applyTheme(next);
            return next;
        }
    };

    window.ebLang = {
        getLang: () => localStorage.getItem('eb_app_language') || 'en',
        setLang: (newLang) => {
            localStorage.setItem('eb_app_language', newLang);
            applyLanguage(newLang);
            window.dispatchEvent(new CustomEvent('eb-lang-changed', { detail: { lang: newLang } }));
        },
        toggleLang: () => {
            const current = localStorage.getItem('eb_app_language') || 'en';
            const next = current === 'en-ur' ? 'en' : 'en-ur';
            localStorage.setItem('eb_app_language', next);
            applyLanguage(next);
            window.dispatchEvent(new CustomEvent('eb-lang-changed', { detail: { lang: next } }));
            return next;
        }
    };

    // 📱 PWA Service Worker Registration & Live Version Deployment (Active Everywhere)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then((registration) => {
                    // Check for updates on page load
                    try { registration.update(); } catch (_) {}

                    registration.onupdatefound = () => {
                        const installingWorker = registration.installing;
                        if (installingWorker) {
                            installingWorker.onstatechange = () => {
                                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('[PWA] New version installed! Activating immediately...');
                                    installingWorker.postMessage({ type: 'SKIP_WAITING' });
                                }
                            };
                        }
                    };
                })
                .catch((err) => {
                    console.warn('[PWA] ServiceWorker registration info:', err.message);
                });
        });
    }

    // 📲 PWA Install Event Handler & Auto-Badge Engine
    let deferredInstallPrompt = null;

    // Detect standalone mode (already installed)
    function isRunningStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true ||
               document.referrer.includes('android-app://');
    }

    // Function to render floating auto-install badge if not yet installed
    function showAutoInstallBadge() {
        if (isRunningStandalone()) return;
        if (localStorage.getItem('nhpos_pwa_installed') === 'true') return;

        // Check if recently dismissed (within 4 hours)
        const dismissedAt = localStorage.getItem('nhpos_install_dismissed_at');
        if (dismissedAt && (Date.now() - parseInt(dismissedAt, 10)) < 4 * 60 * 60 * 1000) {
            return;
        }

        if (document.getElementById('nhposPwaInstallBanner')) return;

        const banner = document.createElement('div');
        banner.id = 'nhposPwaInstallBanner';
        banner.innerHTML = `
            <div style="position:fixed; bottom:18px; left:16px; right:16px; max-width:420px; margin:0 auto; z-index:9999999; background:#ffffff; color:#0f172a; border-radius:18px; padding:12px 14px; box-shadow:0 12px 36px rgba(0,0,0,0.22), 0 0 0 1.5px rgba(21,128,61,0.25); display:flex; align-items:center; justify-content:space-between; gap:12px; font-family:'Segoe UI',Roboto,Helvetica,sans-serif; animation:nhposSlideUp 0.35s ease-out; backdrop-filter:blur(8px);">
                <div style="display:flex; align-items:center; gap:11px; min-width:0;">
                    <img src="/icon-192.png" alt="NH POS" style="width:44px; height:44px; border-radius:12px; object-fit:cover; flex-shrink:0; box-shadow:0 3px 10px rgba(0,0,0,0.12); border:1px solid rgba(0,0,0,0.06);">
                    <div style="min-width:0;">
                        <div style="font-weight:800; font-size:14px; color:#0f172a; display:flex; align-items:center; gap:6px;">
                            <span>NH POS App</span>
                            <span style="font-size:10px; font-weight:800; background:#dcfce7; color:#15803d; padding:1.5px 6px; border-radius:6px; letter-spacing:0.5px;">PWA</span>
                        </div>
                        <div style="font-size:11.5px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            فاسٹ آف لائن اور ہوم اسکرین انسٹال
                        </div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                    <button type="button" id="nhposInstallActionBtn" style="background:#15803d; color:#ffffff; font-weight:800; font-size:12.5px; padding:8px 14px; border-radius:10px; border:none; cursor:pointer; display:flex; align-items:center; gap:5px; box-shadow:0 3px 10px rgba(21,128,61,0.35); transition:all 0.2s;">
                        <span>📲 Install</span>
                    </button>
                    <button type="button" id="nhposDismissActionBtn" style="background:transparent; border:none; color:#94a3b8; font-size:18px; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; line-height:1;" title="Dismiss">
                        ✕
                    </button>
                </div>
            </div>
            <style>
                @keyframes nhposSlideUp {
                    from { transform: translateY(80px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                #nhposInstallActionBtn:hover {
                    background: #166534 !important;
                    transform: scale(1.03);
                }
            </style>
        `;
        document.body.appendChild(banner);

        const installBtn = document.getElementById('nhposInstallActionBtn');
        if (installBtn) {
            installBtn.onclick = function() {
                window.installNHPOSApp();
            };
        }

        const dismissBtn = document.getElementById('nhposDismissActionBtn');
        if (dismissBtn) {
            dismissBtn.onclick = function() {
                banner.remove();
                localStorage.setItem('nhpos_install_dismissed_at', Date.now().toString());
            };
        }
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent default mini-infobar so our custom banner can show
        e.preventDefault();
        deferredInstallPrompt = e;
        window.deferredInstallPrompt = e;
        window.dispatchEvent(new CustomEvent('eb-pwa-ready'));

        // Automatically display the install badge
        showAutoInstallBadge();
    });

    window.addEventListener('appinstalled', () => {
        console.log('[PWA] NH POS was successfully installed!');
        localStorage.setItem('eb_pwa_installed', 'true');
        localStorage.setItem('nhpos_pwa_installed', 'true');
        deferredInstallPrompt = null;
        window.deferredInstallPrompt = null;
        const banner = document.getElementById('nhposPwaInstallBanner');
        if (banner) banner.remove();
        window.dispatchEvent(new CustomEvent('eb-pwa-state-changed'));

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: '🎉 NH POS کامیابی سے انسٹال ہو گئی!',
                text: 'اب ایپ آپ کے موبائل کی ہوم اسکرین پر عام ایپس کی طرح دستیاب ہے۔',
                timer: 4000,
                showConfirmButton: false
            });
        }
    });

    // Listen for parent messages (when inside iframe shell)
    window.addEventListener('message', (event) => {
        if (!event.data) return;
        if (event.data.type === 'PWA_INSTALLED_SUCCESS') {
            localStorage.setItem('eb_pwa_installed', 'true');
            localStorage.setItem('nhpos_pwa_installed', 'true');
            const banner = document.getElementById('nhposPwaInstallBanner');
            if (banner) banner.remove();
        } else if (event.data.type === 'PWA_SHOW_GUIDE') {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: '📲 Install NH POS App',
                    html: isIOS
                        ? `<div style="text-align:left; font-size:13px; line-height:1.6;">
                            <b>iPhone / iPad (Safari) پر انسٹال کرنے کا طریقہ:</b><br><br>
                            1. براؤزر کے نیچے <b>Share</b> بٹن پر کلک کریں۔<br>
                            2. نیچے اسکرول کر کے <b>"Add to Home Screen"</b> منتخب کریں۔<br>
                            3. اوپر <b>"Add"</b> پر کلک کریں — ایپ ہوم اسکرین پر آ جائے گی!
                           </div>`
                        : `<div style="text-align:left; font-size:13px; line-height:1.6;">
                            <b>Android Chrome / PC پر انسٹال کرنے کا طریقہ:</b><br><br>
                            1. براؤزر کے اوپر یا نیچے <b>تین نقطوں (Three Dots ⋮)</b> پر کلک کریں۔<br>
                            2. مینو میں سے <b>"Install app"</b> یا <b>"Add to Home screen"</b> پر ٹیپ کریں۔<br>
                            3. <b>Install</b> پر کلک کریں — ایپ خود بخود موبائل میں انسٹال ہو جائے گی!
                           </div>`,
                    icon: 'info',
                    confirmButtonText: 'سمجھ گیا (OK)',
                    confirmButtonColor: '#15803d'
                });
            }
        }
    });

    // Auto-prompt badge after 2.5 seconds on mobile / desktop if not installed
    setTimeout(() => {
        if (!isRunningStandalone()) {
            showAutoInstallBadge();
        }
    }, 2500);

    // Global install helper callable from any button (alias both names)
    window.installNHPOSApp = async function() {
        // 1. If running inside an iframe, delegate install gesture to top-level window
        if (window.self !== window.top) {
            try {
                window.parent.postMessage({ type: 'PWA_TRIGGER_INSTALL' }, '*');
                return;
            } catch (err) {
                console.warn('[PWA] Parent postMessage error:', err);
            }
        }

        const promptEvent = deferredInstallPrompt || window.deferredInstallPrompt;
        if (promptEvent) {
            try {
                await promptEvent.prompt();
                const choiceResult = await promptEvent.userChoice;
                if (choiceResult && choiceResult.outcome === 'accepted') {
                    console.log('[PWA] User accepted installation prompt');
                    localStorage.setItem('eb_pwa_installed', 'true');
                    localStorage.setItem('nhpos_pwa_installed', 'true');
                    const banner = document.getElementById('nhposPwaInstallBanner');
                    if (banner) banner.remove();
                    window.dispatchEvent(new CustomEvent('eb-pwa-state-changed'));
                }
            } catch (e) {
                console.warn('[PWA] prompt error:', e);
            }
            deferredInstallPrompt = null;
            window.deferredInstallPrompt = null;
            return;
        }

        // 2. Check if already installed
        if (isRunningStandalone()) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'info',
                    title: '📱 NH POS پہلے سے انسٹال ہے!',
                    text: 'یہ ایپ آپ کے موبائل کی ہوم اسکرین پر موجود ہے۔'
                });
            } else {
                alert('NH POS App is already installed on your device!');
            }
            return;
        }

        // 3. Guidance modal for Chrome / Safari (top window only)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: '📲 Install NH POS App',
                html: isIOS
                    ? `<div style="text-align:left; font-size:13px; line-height:1.6;">
                        <b>iPhone / iPad (Safari) پر انسٹال کرنے کا طریقہ:</b><br><br>
                        1. براؤزر کے نیچے <b>Share</b> بٹن <i class="fas fa-arrow-up-from-bracket"></i> پر کلک کریں۔<br>
                        2. نیچے اسکرول کر کے <b>"Add to Home Screen"</b> منتخب کریں۔<br>
                        3. اوپر <b>"Add"</b> پر کلک کریں — ایپ ہوم اسکرین پر آ جائے گی!
                       </div>`
                    : `<div style="text-align:left; font-size:13px; line-height:1.6;">
                        <b>Android Chrome / PC پر انسٹال کرنے کا طریقہ:</b><br><br>
                        1. براؤزر کے اوپر یا نیچے <b>تین نقطوں (Three Dots ⋮)</b> پر کلک کریں۔<br>
                        2. مینو میں سے <b>"Install app"</b> یا <b>"Add to Home screen"</b> پر ٹیپ کریں۔<br>
                        3. <b>Install</b> پر کلک کریں — ایپ خود بخود موبائل میں انسٹال ہو جائے گی!
                       </div>`,
                icon: 'info',
                confirmButtonText: 'سمجھ گیا (OK)',
                confirmButtonColor: '#15803d'
            });
        } else {
            alert("کروم کے تین نقطوں (⋮) پر کلک کر کے 'Install app' یا 'Add to Home screen' پر ٹیپ کریں!");
        }
    };

    // Backward-compatible alias
    window.installEasyBillPWA = window.installNHPOSApp;
})();


