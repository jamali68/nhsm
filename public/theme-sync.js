// 🏷️ Central Application Version (Single source of truth)
window.EASYBILL_VERSION = '5.3.0';

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

// ==========================================================================
// 🚫 PERMANENTLY SUPPRESS & REMOVE NETLIFY BADGE / DRAWER (Anti-Badge Engine)
// ==========================================================================
(function purgeNetlifyBadge() {
    const styleId = 'nh-suppress-netlify-badge-styles';

    function injectBlockingStyles() {
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* 🚫 Hide all Netlify injected elements, drawer, badge and feedback widget */
            netlify-drawer-root,
            #netlify-drawer-root,
            netlify-drawer,
            .netlify-drawer,
            .netlify-badge,
            [data-netlify-deploy-id],
            [class*="netlify-drawer"],
            [class*="netlify-badge"],
            [class*="NetlifyBadge"],
            [id*="netlify-drawer"],
            [id*="netlify-badge"],
            iframe[src*="netlify"],
            iframe[id*="netlify"],
            div[style*="z-index"][style*="bottom:"][style*="right:"]:has(a[href*="netlify.com"]),
            div[style*="z-index"][style*="bottom"][style*="right"]:has(svg),
            div[style*="fixed"][style*="bottom"]:has(a[href*="netlify.com"]),
            div[style*="fixed"][style*="bottom"]:has(a[href*="netlify"]),
            a[href*="netlify.com"][style*="fixed"],
            a[href*="netlify.com"][style*="absolute"],
            a[href*="netlify.com"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                width: 0 !important;
                height: 0 !important;
                max-width: 0 !important;
                max-height: 0 !important;
                overflow: hidden !important;
                position: absolute !important;
                top: -99999px !important;
                left: -99999px !important;
                z-index: -99999 !important;
            /* 🔝 SweetAlert2 Popups: ALWAYS IN FRONT OF ALL SIDEBARS & MENUS */
            .swal2-container {
                z-index: 99999999 !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }
    injectBlockingStyles();

    function purge() {
        // 1. Selector-based removal
        const selectors = [
            'netlify-drawer-root',
            '#netlify-drawer-root',
            'netlify-drawer',
            '.netlify-drawer',
            '.netlify-badge',
            '[data-netlify-deploy-id]',
            '[class*="netlify-drawer"]',
            '[class*="netlify-badge"]',
            '[class*="NetlifyBadge"]',
            'iframe[src*="netlify"]',
            'iframe[id*="netlify"]'
        ];
        try {
            document.querySelectorAll(selectors.join(',')).forEach(el => {
                try {
                    if (el.shadowRoot) {
                        try { el.shadowRoot.innerHTML = ''; } catch (_) {}
                    }
                    el.remove();
                } catch (_) {
                    el.style.setProperty('display', 'none', 'important');
                }
            });
        } catch (_) {}

        // 2. Text and Link-based purge for floating button
        try {
            const elements = document.querySelectorAll('div, a, span, button');
            for (let i = 0; i < elements.length; i++) {
                const el = elements[i];
                const text = (el.innerText || el.textContent || '').trim();
                const isNetlifyText = text === 'Powered by Netlify' || (text.includes('Powered by') && text.includes('Netlify'));
                const isNetlifyLink = el.tagName === 'A' && el.href && (el.href.includes('netlify.com') || el.href.includes('netlify.app'));

                if (isNetlifyText || (isNetlifyLink && (el.closest('[style*="fixed"], [style*="absolute"]') || (el.className && el.className.includes && el.className.includes('netlify'))))) {
                    let container = el;
                    // Traverse up to find the fixed/absolute floating badge container
                    while (container.parentElement && container.parentElement !== document.body && container.parentElement !== document.documentElement) {
                        const style = window.getComputedStyle ? window.getComputedStyle(container.parentElement) : null;
                        if (style && (style.position === 'fixed' || style.position === 'absolute')) {
                            container = container.parentElement;
                            break;
                        }
                        container = container.parentElement;
                    }
                    if (container && container !== document.body && container !== document.documentElement) {
                        try { container.remove(); } catch (_) { container.style.setProperty('display', 'none', 'important'); }
                    } else {
                        try { el.remove(); } catch (_) { el.style.setProperty('display', 'none', 'important'); }
                    }
                }
            }
        } catch (_) {}
    }

    // Run purge immediately
    purge();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectBlockingStyles();
            purge();
        });
    }

    window.addEventListener('load', () => {
        injectBlockingStyles();
        purge();
    });

    // Observer for late edge injections
    try {
        const observer = new MutationObserver(() => {
            purge();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}

    // Polling safety check (runs frequently during page boot)
    let count = 0;
    const interval = setInterval(() => {
        purge();
        count++;
        if (count > 40) clearInterval(interval);
    }, 250);
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
            const isSubpath = window.location.pathname.startsWith('/nhsm/');
            const swPath = isSubpath ? '/nhsm/sw.js' : 'sw.js';
            const swScope = isSubpath ? '/nhsm/' : './';
            navigator.serviceWorker.register(swPath, { scope: swScope })
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
        // Never show inside an iframe (browsers block iframes from installing PWAs)
        if (window.self !== window.top) return;

        if (isRunningStandalone()) return;

        // Check if recently dismissed (within 30 mins)
        const dismissedAt = localStorage.getItem('nhpos_install_dismissed_at');
        if (dismissedAt && (Date.now() - parseInt(dismissedAt, 10)) < 30 * 60 * 1000) {
            return;
        }

        if (document.getElementById('nhposPwaInstallBanner')) return;

        const banner = document.createElement('div');
        banner.id = 'nhposPwaInstallBanner';
        banner.innerHTML = `
            <div style="position:fixed; bottom:18px; left:16px; right:16px; max-width:420px; margin:0 auto; z-index:9999999; background:#0E0F09; color:#f8fafc; border-radius:18px; padding:12px 14px; box-shadow:0 12px 36px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(16,185,129,0.35); display:flex; align-items:center; justify-content:space-between; gap:12px; font-family:'Segoe UI',Roboto,Helvetica,sans-serif; animation:nhposSlideUp 0.35s ease-out; backdrop-filter:blur(10px);">
                <div style="display:flex; align-items:center; gap:11px; min-width:0;">
                    <img src="icon-192.png" alt="NH POS" style="width:44px; height:44px; border-radius:12px; object-fit:cover; flex-shrink:0; box-shadow:0 3px 10px rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.15);">
                    <div style="min-width:0;">
                        <div style="font-weight:800; font-size:14px; color:#ffffff; display:flex; align-items:center; gap:6px;">
                            <span>NH POS App</span>
                            <span style="font-size:10px; font-weight:800; background:#064e3b; color:#34d399; padding:1.5px 6px; border-radius:6px; letter-spacing:0.5px; border:1px solid rgba(52,211,153,0.3);">PWA</span>
                        </div>
                        <div style="font-size:11.5px; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
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

// ==========================================================================
// 🌟 NH POS GLOBAL BRANDED LOADER (Circular Logo + Spinning Wheel + Blurred Backdrop)
// ==========================================================================
(function initNHGlobalLoader() {
    let loaderEl = null;
    let safetyTimer = null;

    function getOrCreateLoader() {
        if (loaderEl && document.contains && document.contains(loaderEl)) return loaderEl;
        loaderEl = document.getElementById('nhGlobalLoader');
        if (loaderEl) return loaderEl;

        loaderEl = document.createElement('div');
        loaderEl.id = 'nhGlobalLoader';
        loaderEl.setAttribute('role', 'status');
        loaderEl.setAttribute('aria-live', 'polite');
        loaderEl.style.cssText = 'position:fixed; inset:0; width:100vw; height:100vh; background:rgba(10, 15, 29, 0.78); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); z-index:99999999; display:flex; align-items:center; justify-content:center; opacity:0; visibility:hidden; transition:opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.25s ease; user-select:none; pointer-events:none;';

        loaderEl.innerHTML = `
            <style>
                @keyframes nhWheelSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes nhLogoPulse {
                    0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(16, 185, 129, 0.4), 0 0 40px rgba(16, 185, 129, 0.15); }
                    50% { transform: scale(1.03); box-shadow: 0 0 30px rgba(16, 185, 129, 0.65), 0 0 55px rgba(16, 185, 129, 0.3); }
                }
                .nh-loader-glass-card {
                    background: rgba(23, 32, 51, 0.90);
                    border: 1.5px solid rgba(255, 255, 255, 0.12);
                    border-radius: 24px;
                    padding: 32px 36px 28px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    max-width: 90vw;
                    width: 310px;
                    box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.65), 0 0 35px rgba(16, 185, 129, 0.18);
                    transform: scale(0.94);
                    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                #nhGlobalLoader.nh-active .nh-loader-glass-card {
                    transform: scale(1);
                }
                .nh-round-logo-frame {
                    width: 86px;
                    height: 86px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 3.5px solid #10b981;
                    animation: nhLogoPulse 2.8s infinite ease-in-out;
                    background: #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 16px;
                    flex-shrink: 0;
                }
                .nh-round-logo-frame img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 50%;
                    display: block;
                }
                .nh-spinning-wheel {
                    width: 38px;
                    height: 38px;
                    border: 3.5px solid rgba(255, 255, 255, 0.16);
                    border-top-color: #10b981;
                    border-right-color: #34d399;
                    border-radius: 50%;
                    animation: nhWheelSpin 0.75s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    margin-bottom: 14px;
                    flex-shrink: 0;
                }
            </style>
            <div class="nh-loader-glass-card">
                <!-- 🛡️ Circular Round NH POS Logo -->
                <div class="nh-round-logo-frame">
                    <img src="icon-192.png" alt="NH POS" onerror="this.src='apple-touch-icon.png'">
                </div>
                <!-- 🔄 Animated Gool Gool Spinning Wheel -->
                <div class="nh-spinning-wheel"></div>
                <!-- 📝 Loading Text -->
                <div id="nhLoaderHeading" style="font-family:'Segoe UI',Roboto,-apple-system,sans-serif; font-size:16px; font-weight:800; color:#ffffff; letter-spacing:0.3px; line-height:1.3;">
                    System is Loading...
                </div>
                <div id="nhLoaderSubheading" style="font-family:'Segoe UI',Roboto,-apple-system,sans-serif; font-size:12px; font-weight:600; color:#6ee7b7; margin-top:5px; letter-spacing:0.2px;">
                    براہِ کرم انتظار فرمائیں (Please wait)
                </div>
            </div>
        `;

        const targetParent = document.body || document.documentElement;
        if (targetParent) {
            targetParent.appendChild(loaderEl);
        }
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', () => {
                if (document.body && loaderEl.parentNode !== document.body) {
                    document.body.appendChild(loaderEl);
                }
            });
        }
        return loaderEl;
    }

    window.showNHLoader = function(title, subtitle) {
        const el = getOrCreateLoader();
        if (!el) return;
        const h = el.querySelector('#nhLoaderHeading');
        const s = el.querySelector('#nhLoaderSubheading');
        if (h && title) h.innerText = title;
        if (s && subtitle) s.innerText = subtitle;
        el.classList.add('nh-active');
        el.style.opacity = '1';
        el.style.visibility = 'visible';
        el.style.pointerEvents = 'all';

        // Auto-dismiss safety timer (10s max) to guarantee UI is never frozen if offline
        if (safetyTimer) clearTimeout(safetyTimer);
        safetyTimer = setTimeout(() => {
            window.hideNHLoader();
        }, 10000);
    };

    window.hideNHLoader = function() {
        if (safetyTimer) clearTimeout(safetyTimer);
        const el = document.getElementById('nhGlobalLoader');
        if (el) {
            el.classList.remove('nh-active');
            el.style.opacity = '0';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
        }
        // Also hide legacy overlays if present
        const oldDashOverlay = document.getElementById('loadingOverlay');
        if (oldDashOverlay) {
            oldDashOverlay.style.opacity = '0';
            setTimeout(() => { oldDashOverlay.style.display = 'none'; }, 200);
        }
        const mainCard = document.getElementById('mainCard');
        if (mainCard && mainCard.style.display === 'none') {
            mainCard.style.display = 'block';
        }
    };

    // 🚀 Auto-show loader on app pages so user never sees empty 0 0 0 skeleton
    const curPath = window.location.pathname.toLowerCase();
    const isPublicPage = curPath.endsWith('/landing.html') || 
                         curPath.endsWith('/auth.html') || 
                         curPath === '/' || 
                         curPath === '';

    if (!isPublicPage) {
        // Show immediately while DOM and scripts are parsing
        window.showNHLoader('System is Loading...', 'براہِ کرم انتظار فرمائیں (Please wait)');
    }

    // On public pages only, auto-hide on load
    window.addEventListener('load', () => {
        if (isPublicPage) {
            setTimeout(() => {
                window.hideNHLoader();
            }, 200);
        }
    });
})();



