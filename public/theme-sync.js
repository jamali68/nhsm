// Global Theme & Module Communication Handler for Easy Bill Generator
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

    // 📱 PWA Service Worker Registration & Offline App Cache
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then((registration) => {
                    registration.onupdatefound = () => {
                        const installingWorker = registration.installing;
                        if (installingWorker) {
                            installingWorker.onstatechange = () => {
                                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('[PWA] New offline version available.');
                                }
                            };
                        }
                    };
                })
                .catch((err) => {
                    console.warn('[PWA] ServiceWorker registration failed:', err.message);
                });
        });
    }

    // 📲 PWA Install Engine & Floating Prompt Banner
    let deferredInstallPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent default mini-infobar
        e.preventDefault();
        deferredInstallPrompt = e;
        window.deferredInstallPrompt = e;

        // If not dismissed recently, show sleek floating install banner
        const isDismissed = sessionStorage.getItem('eb_pwa_banner_dismissed') === 'true';
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

        if (!isDismissed && !isStandalone) {
            renderPwaInstallBanner();
        }

        // Notify other components (e.g. sidebar or settings)
        window.dispatchEvent(new CustomEvent('eb-pwa-ready'));
    });

    window.addEventListener('appinstalled', () => {
        console.log('[PWA] EasyBill App was successfully installed!');
        deferredInstallPrompt = null;
        window.deferredInstallPrompt = null;
        const banner = document.getElementById('ebPwaInstallBanner');
        if (banner) banner.remove();
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true, position: 'top-end', timer: 3000,
                icon: 'success', title: '🎉 EasyBill App successfully installed!'
            });
        }
    });

    function renderPwaInstallBanner() {
        if (document.getElementById('ebPwaInstallBanner')) return;
        const banner = document.createElement('div');
        banner.id = 'ebPwaInstallBanner';
        banner.style.cssText = 'position:fixed; bottom:16px; left:50%; transform:translateX(-50%); background:#0f172a; color:#fff; padding:12px 16px; border-radius:14px; box-shadow:0 12px 32px rgba(0,0,0,0.5); z-index:999999; display:flex; align-items:center; gap:12px; border:1px solid #334155; max-width:94%; width:440px; animation:slideUpPwa 0.35s ease-out;';
        
        banner.innerHTML = `
            <img src="/icon-192.png" alt="EasyBill" style="width:40px; height:40px; border-radius:10px; flex-shrink:0; object-fit:cover; border:1px solid #475569;">
            <div style="flex:1; min-width:0;">
                <div style="font-weight:800; font-size:13px; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    📲 Install EasyBill App
                </div>
                <div style="font-size:11px; color:#94a3b8; line-height:1.2;">
                    آف لائن بلنگ اور ایک کلک سے ایپ کھولنے کے لیے
                </div>
            </div>
            <button id="ebPwaBannerInstallBtn" style="background:#10b981; color:#fff; border:none; padding:7px 14px; border-radius:8px; font-weight:800; font-size:12px; cursor:pointer; flex-shrink:0; box-shadow:0 2px 8px rgba(16,185,129,0.3);">
                انسٹال کریں
            </button>
            <button id="ebPwaBannerCloseBtn" aria-label="Close" style="background:transparent; color:#94a3b8; border:none; font-size:20px; line-height:1; cursor:pointer; padding:0 4px; flex-shrink:0;">
                &times;
            </button>
        `;

        // Inject keyframes if missing
        if (!document.getElementById('eb-pwa-keyframes')) {
            const kf = document.createElement('style');
            kf.id = 'eb-pwa-keyframes';
            kf.textContent = '@keyframes slideUpPwa { from { transform: translate(-50%, 100px); opacity:0; } to { transform: translate(-50%, 0); opacity:1; } }';
            document.head.appendChild(kf);
        }

        document.body.appendChild(banner);

        document.getElementById('ebPwaBannerInstallBtn').addEventListener('click', () => {
            window.installEasyBillPWA();
        });

        document.getElementById('ebPwaBannerCloseBtn').addEventListener('click', () => {
            banner.remove();
            sessionStorage.setItem('eb_pwa_banner_dismissed', 'true');
        });
    }

    // Global install helper callable from any button
    window.installEasyBillPWA = async function() {
        const promptEvent = deferredInstallPrompt || window.deferredInstallPrompt;
        if (promptEvent) {
            promptEvent.prompt();
            const choiceResult = await promptEvent.userChoice;
            if (choiceResult.outcome === 'accepted') {
                console.log('[PWA] User accepted installation prompt');
                const banner = document.getElementById('ebPwaInstallBanner');
                if (banner) banner.remove();
            } else {
                console.log('[PWA] User dismissed installation');
            }
            deferredInstallPrompt = null;
            window.deferredInstallPrompt = null;
        } else {
            // Check if already installed
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
            if (isStandalone) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'info',
                        title: '📱 EasyBill پہلے سے انسٹال ہے!',
                        text: 'یہ ایپ آپ کے موبائل کی ہوم اسکرین پر موجود ہے۔'
                    });
                } else {
                    alert('EasyBill App is already installed on your device!');
                }
                return;
            }

            // Guidance modal for Chrome / Safari
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: '📲 Install EasyBill App',
                    html: isIOS
                        ? `<div style="text-align:left; font-size:13px; line-height:1.6;">
                            <b>iPhone / iPad (Safari) پر انسٹال کرنے کا طریقہ:</b><br><br>
                            1. براؤزر کے نیچے <b>Share</b> بٹن <i class="fas fa-arrow-up-from-bracket"></i> پر کلک کریں۔<br>
                            2. نیچے اسکرول کر کے <b>"Add to Home Screen"</b> منتخب کریں۔<br>
                            3. اوپر <b>"Add"</b> پر کلک کریں!
                           </div>`
                        : `<div style="text-align:left; font-size:13px; line-height:1.6;">
                            <b>Android Chrome پر انسٹال کرنے کا طریقہ:</b><br><br>
                            1. براؤزر کے اوپر یا نیچے <b>تین نقطوں (Three Dots ⋮)</b> پر کلک کریں۔<br>
                            2. مینو میں سے <b>"Install app"</b> یا <b>"Add to Home screen"</b> پر ٹیپ کریں۔<br>
                            3. <b>Install</b> پر کلک کریں — ایپ خود بخود موبائل میں انسٹال ہو جائے گی!
                           </div>`,
                    icon: 'info',
                    confirmButtonText: 'سمجھ گیا (OK)',
                    confirmButtonColor: '#0284c7'
                });
            } else {
                alert("کروم کے تین نقطوں (⋮) پر کلک کر کے 'Install app' یا 'Add to Home screen' پر ٹیپ کریں!");
            }
        }
    };
})();


