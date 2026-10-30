// ==========================================================================
// 🛡️ EASY BILL GENERATOR — ENTERPRISE SECURITY SHIELD & DOMAIN GUARD (v2.0)
// ✅ Anti-Cloning & Domain Lock (غیر مجاز کاپی، چوری اور سرور ہائی جیکنگ سے تحفظ)
// ✅ Anti-Inspect, Anti-Save & DevTools Keyboard Shortcut Shield
// ✅ Anti-Scrape, Anti-Drag & Right-Click Disabler
// ✅ Iframe Clickjacking Protection & Tamper Detection
// ✅ Data Integrity & Emergency Token Purge on Unauthorized Clones
// ==========================================================================

(function initEnterpriseAppGuard() {
    'use strict';

    // 1️⃣ AUTHORIZED DOMAINS WHITELIST
    // Authorized platforms: Localhost, Google Cloud Run, Netlify, Firebase, GitHub Pages, Vercel
    const ALLOWED_DOMAIN_PATTERNS = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        /\.run\.app$/,          // Google AI Studio Cloud Run preview environments
        /\.googleusercontent\.com$/, // Google cloud preview environments
        /\.cloudworkstations\.dev$/,
        /\.google\.com$/,
        /\.netlify\.app$/,      // Official Netlify hosting
        /\.web\.app$/,          // Official Firebase hosting
        /\.firebaseapp\.com$/,  // Official Firebase domain
        /\.github\.io$/,        // Official GitHub Pages deployment
        /\.vercel\.app$/        // Official Vercel hosting
        // Custom domain pattern dynamically loaded or added via EB_GUARD.addAllowedDomain
    ];

    // Check if custom allowed domain was registered by Super Admin / Licensee
    try {
        const customAllowed = localStorage.getItem('eb_custom_allowed_domain');
        if (customAllowed) {
            ALLOWED_DOMAIN_PATTERNS.push(customAllowed.toLowerCase().trim());
        }
    } catch (_) {}

    const currentHost = (window.location.hostname || '').toLowerCase();

    // Check if current domain is authorized
    function isDomainAuthorized(host) {
        if (!host) return true; // file:// or embedded environments with null host
        return ALLOWED_DOMAIN_PATTERNS.some(pattern => {
            if (typeof pattern === 'string') {
                return host === pattern || host.endsWith('.' + pattern);
            }
            if (pattern instanceof RegExp) {
                return pattern.test(host);
            }
            return false;
        });
    }

    const isAuthorized = isDomainAuthorized(currentHost);
    const isDevelopment = currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '0.0.0.0';

    // 2️⃣ DOMAIN LOCK TRIGGER: If someone steals and hosts on unauthorized domain
    if (!isAuthorized) {
        console.error('⛔ [Security Shield] Unauthorized domain deployment detected! Domain:', currentHost);

        // Security wipe: Immediately clear any active session / cached tokens
        try {
            sessionStorage.clear();
            localStorage.removeItem('eb_active_agency');
            localStorage.removeItem('eb_user_role');
            localStorage.removeItem('eb_agency_name');
        } catch (_) {}

        // Wipe page content and show permanent Lockout Screen
        function applyLockout() {
            document.documentElement.innerHTML = `
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>🔒 Unauthorized License — NH POS</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body {
                        background: #090d16;
                        color: #f8fafc;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                    }
                    .lock-card {
                        background: #111827;
                        border: 2px solid #ef4444;
                        border-radius: 20px;
                        max-width: 580px;
                        width: 100%;
                        padding: 35px 28px;
                        text-align: center;
                        box-shadow: 0 25px 50px -12px rgba(239, 68, 68, 0.25);
                    }
                    .icon-shield {
                        font-size: 58px;
                        margin-bottom: 15px;
                        animation: pulse 2s infinite ease-in-out;
                    }
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.08); }
                    }
                    h1 {
                        color: #ef4444;
                        font-size: 22px;
                        font-weight: 900;
                        letter-spacing: 0.5px;
                        margin-bottom: 6px;
                    }
                    h3 {
                        color: #fbbf24;
                        font-size: 16px;
                        font-weight: 700;
                        margin-bottom: 16px;
                        direction: rtl;
                    }
                    p.desc-en {
                        color: #94a3b8;
                        font-size: 13.5px;
                        line-height: 1.6;
                        margin-bottom: 12px;
                    }
                    p.desc-ur {
                        color: #cbd5e1;
                        font-size: 14px;
                        line-height: 1.8;
                        margin-bottom: 22px;
                        direction: rtl;
                    }
                    .badge-info {
                        background: #1f2937;
                        border: 1px solid #374151;
                        border-radius: 10px;
                        padding: 12px;
                        font-size: 12.5px;
                        color: #93c5fd;
                        margin-bottom: 22px;
                        word-break: break-all;
                    }
                    .btn-wa {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        background: #25d366;
                        color: #ffffff;
                        text-decoration: none;
                        font-weight: 800;
                        font-size: 15px;
                        padding: 14px 28px;
                        border-radius: 12px;
                        box-shadow: 0 10px 20px rgba(37, 211, 102, 0.3);
                        transition: transform 0.2s;
                    }
                    .btn-wa:hover {
                        transform: translateY(-2px);
                    }
                    .footer-txt {
                        margin-top: 20px;
                        font-size: 11.5px;
                        color: #64748b;
                    }
                </style>
            </head>
            <body>
                <div class="lock-card">
                    <div class="icon-shield">🔒</div>
                    <h1>UNLICENSED COPY DETECTED</h1>
                    <h3>غیر مجاز ڈومین — سافٹ ویئر کاپی رائٹ لاک</h3>
                    <p class="desc-en">
                        This deployment of <b>NH POS System</b> is running on an unauthorized domain or server.
                        All cloud sync and operations have been halted to protect software integrity.
                    </p>
                    <p class="desc-ur">
                        یہ سافٹ ویئر <b>NH POS</b> کے اصل مالک کے لیے محفوظ اور رجسٹرڈ ہے۔ 
                        اسے کسی دوسری ڈومین، سرور یا پی سی پر بغیر لائسنس چلانا قانوناً منع ہے۔ برائے تصدیق ڈویلپر سے رابطہ کریں۔
                    </p>
                    <div class="badge-info">
                        🚫 Blocked Domain: <strong>${window.location.hostname || 'Unknown Host'}</strong> &nbsp;|&nbsp; Status: <strong>Blocked (403 Unauthorized)</strong>
                    </div>
                    <a href="https://wa.me/923346800959?text=Hello%20Developer,%20I%20need%20an%20official%20license%20key%20for%20NH%20POS%20for%20domain:%20${encodeURIComponent(window.location.hostname)}" target="_blank" rel="noopener noreferrer" class="btn-wa">
                        <span>💬 Contact Developer for License (+92 334 6800959)</span>
                    </a>
                    <div class="footer-txt">
                        NH POS &copy; All Rights Reserved. Proprietary Commercial Software.
                    </div>
                </div>
            </body>
            `;
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyLockout);
        } else {
            applyLockout();
        }

        // Halt further script parsing
        window.stop();
        return;
    }

    // 3️⃣ ANTI-INSPECT & SHORTCUT SHIELD (Active across Production)
    if (!isDevelopment) {
        // A. Disable Right-Click Context Menu
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        }, { passive: false });

        // B. Intercept DevTools and Source-View Shortcuts
        document.addEventListener('keydown', function(e) {
            // F12
            if (e.key === 'F12') {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Ctrl+Shift+I / J / C (Inspect Element & Console)
            if (e.ctrlKey && e.shiftKey && (
                e.key === 'I' || e.key === 'i' ||
                e.key === 'J' || e.key === 'j' ||
                e.key === 'C' || e.key === 'c'
            )) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Cmd+Option+I / J / C on macOS
            if (e.metaKey && e.altKey && (
                e.key === 'I' || e.key === 'i' ||
                e.key === 'J' || e.key === 'j' ||
                e.key === 'C' || e.key === 'c'
            )) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Ctrl+U or Cmd+Option+U (View Page Source)
            if ((e.ctrlKey || (e.metaKey && e.altKey)) && (e.key === 'u' || e.key === 'U')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Ctrl+S / Cmd+S (Save Page to Disk - Anti-Offline Scraping)
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }, { capture: true });

        // C. Prevent dragging sensitive elements
        document.addEventListener('dragstart', function(e) {
            if (e.target && (e.target.tagName === 'IMG' || e.target.classList.contains('no-drag'))) {
                e.preventDefault();
            }
        });
    }

    // 4️⃣ ANTI-CLICKJACKING / IFRAME HIJACK GUARD
    // Protect against malicious 3rd party websites framing the app to steal logins
    try {
        if (window.top !== window.self) {
            const parentHost = (document.referrer ? new URL(document.referrer).hostname : '').toLowerCase();
            const isParentAuthorized = !parentHost || isDomainAuthorized(parentHost);
            if (!isParentAuthorized) {
                window.top.location = window.self.location.href;
            }
        }
    } catch (_) {
        // Cross-origin iframe detected that blocked location access
        try {
            if (window.top !== window.self && !isDevelopment) {
                window.top.location = window.self.location.href;
            }
        } catch (_) {}
    }

    // 5️⃣ CONSOLE COPYRIGHT WATERMARK & TAMPER WARNING
    try {
        const consoleStyleTitle = 'background: #ef4444; color: #ffffff; font-size: 16px; font-weight: 900; padding: 6px 12px; border-radius: 4px;';
        const consoleStyleText = 'color: #38bdf8; font-size: 12px; font-weight: 600; line-height: 1.5;';
        console.log('%c🛑 STOP! SECURITY & COPYRIGHT NOTICE', consoleStyleTitle);
        console.log(
            '%cNH POS & Customer Ledger System\n' +
            'Proprietary Software — All rights reserved.\n' +
            'Unauthorized reproduction, scraping, reverse-engineering, or hosting\n' +
            'without a valid license is strictly prohibited.\n' +
            '📞 Official Developer WhatsApp Support: +923346800959',
            consoleStyleText
        );
    } catch (_) {}

    // 6️⃣ EXPOSE GLOBAL GUARD INTERFACE (WITH LAYER 6 SERVERLESS SHIELD)
    window.EB_GUARD = {
        version: '5.3.0-enterprise-shield-layer6',
        layer6: 'Netlify-Serverless-Active',
        isAuthorized: isAuthorized,
        host: currentHost,
        developerContact: '+923346800959',
        addAllowedDomain: function(domain) {
            if (!domain) return;
            ALLOWED_DOMAIN_PATTERNS.push(domain.toLowerCase().trim());
            try {
                localStorage.setItem('eb_custom_allowed_domain', domain.toLowerCase().trim());
            } catch (_) {}
        },
        // 🔒 Layer 6: Call Netlify Serverless API for anti-tamper bill signing
        signInvoice: async function(invoiceData) {
            try {
                const res = await fetch('/api/secure-api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'sign-invoice',
                        billNumber: invoiceData.billNumber,
                        totalAmount: invoiceData.totalAmount,
                        date: invoiceData.date,
                        agencyId: invoiceData.agencyId
                    })
                });
                if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
                    const data = await res.json();
                    return data.signature || null;
                }
            } catch (_) {}
            return null;
        },
        // 🔒 Layer 6: Ping Serverless Integrity Vault
        pingServerlessShield: async function() {
            try {
                const res = await fetch('/api/secure-api?action=health');
                if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
                    const data = await res.json();
                    return data;
                }
            } catch (_) {}
            return { status: 'offline-mode' };
        }
    };
})();
