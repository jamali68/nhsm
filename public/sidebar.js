// ============================================
// 🧭 EASY BILL GENERATOR — SIDEBAR SYSTEM (v2)
// ✅ Mobile: Hamburger + slide-in
// ✅ PC: Permanent sidebar (250px)
// ✅ Profile: Sidebar neeche + Top-right avatar
// ✅ Theme toggle: Quick dark/light toggle
// ✅ Role-aware menu (Booker ko limited)
// ============================================

window.EASYBILL_VERSION = window.EASYBILL_VERSION || '4.0.0';

(function initSidebar() {
    // Inject dark-theme.css link dynamically if not present
    if (!document.getElementById('eb-dark-theme-style')) {
        const link = document.createElement('link');
        link.id = 'eb-dark-theme-style';
        link.rel = 'stylesheet';
        link.href = 'dark-theme.css';
        document.head.appendChild(link);
    }

    // Inject sync-engine.js dynamically if not present
    if (!window.CloudSync && !document.getElementById('eb-sync-engine-script')) {
        const script = document.createElement('script');
        script.id = 'eb-sync-engine-script';
        script.src = 'sync-engine.js';
        document.head.appendChild(script);
    }

    // Inject saas-modules.js dynamically if not present
    if (!window.SaaSModules && !document.getElementById('eb-saas-modules-script')) {
        const script = document.createElement('script');
        script.id = 'eb-saas-modules-script';
        script.src = 'saas-modules.js';
        document.head.appendChild(script);
    }

    function getModuleIdFromUrl(url) {
        if (!url) return null;
        if (url.includes('profit.html')) return 'profit';
        if (url.includes('multi-agency.html')) return 'multi_agency';
        if (url.includes('delivery-returns.html')) {
            return url.includes('claims') ? 'claims' : 'delivery_returns';
        }
        if (url.includes('booker-orders.html')) return 'booker_orders';
        if (url.includes('owner.html')) return 'owner';
        if (url.includes('backup.html')) return 'backup';
        if (url.includes('expenses.html')) return 'expenses';
        if (url.includes('alerts.html')) return 'alerts';
        if (url.includes('reports.html')) return 'reports';
        if (url.includes('stock.html')) return 'stock';
        if (url.includes('customers.html')) return 'customers';
        if (url.includes('bills.html')) return 'bills';
        if (url.includes('settings.html')) return 'settings';
        if (url.includes('dashboard.html')) return 'dashboard';
        return null;
    }

    // Helper: Split English title and Urdu subtitle
    function splitEnUrText(rawText) {
        if (!rawText) return { en: '', ur: '' };
        const spanMatch = rawText.match(/^(.*?)(?:<span class=["']ur-sub["']>([^<]*)<\/span>)?$/i);
        if (spanMatch && spanMatch[2]) {
            return {
                en: spanMatch[1].trim(),
                ur: spanMatch[2].trim()
            };
        }
        return { en: rawText.trim(), ur: '' };
    }

    // Apply saved language (English default vs English + Urdu mix)
    const savedLang = localStorage.getItem('eb_app_language') || 'en';
    document.documentElement.setAttribute('data-lang', savedLang);
    if (document.body) document.body.setAttribute('data-lang', savedLang);

    // Apply saved theme
    const savedTheme = localStorage.getItem('eb_theme_mode') || 'dark';
    if (savedTheme === 'dark' || savedTheme === 'night') {
        document.documentElement.classList.add('dark-theme');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-theme');
        document.body.setAttribute('data-theme', 'dark');
    } else if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark-theme');
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.classList.remove('dark-theme');
        document.body.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.classList.add(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.body.classList.add(savedTheme);
        document.body.setAttribute('data-theme', savedTheme);
    }

    // 1️⃣ CONFIG: Menu items
    const MENU = [
        {
            title: 'MAIN <span class="ur-sub">(مین مینو)</span>',
            items: [
                { icon: 'fa-chart-line', text: 'Dashboard <span class="ur-sub">(ڈیش بورڈ)</span>', url: 'dashboard.html', roles: ['super-admin', 'owner', 'booker'] },
                { icon: 'fa-file-invoice-dollar', text: 'Create New Bill <span class="ur-sub">(نیا بل بنائیں)</span>', url: 'bills.html', roles: ['super-admin', 'owner', 'booker'] },
            ]
        },
        {
            title: 'MANAGEMENT <span class="ur-sub">(انتظامیہ)</span>',
            items: [
                { icon: 'fa-clipboard-check', text: 'Booker Orders & Dispatch <span class="ur-sub">(بکر آرڈرز و ترسیل)</span>', url: 'booker-orders.html', roles: ['super-admin', 'owner', 'booker'] },
                { icon: 'fa-truck-loading', text: 'Delivery & Returns <span class="ur-sub">(وین ڈسپیچ و واپسی)</span>', url: 'delivery-returns.html', roles: ['super-admin', 'owner', 'supplier', 'booker'] },
                { icon: 'fa-triangle-exclamation', text: 'Damage, Expire & Claims <span class="ur-sub">(کلیم و زائد المیعاد)</span>', url: 'delivery-returns.html?tab=claims', roles: ['super-admin', 'owner', 'supplier', 'booker'] },
                { icon: 'fa-user-friends', text: 'Customers <span class="ur-sub">(گاہک و کھاتہ)</span>', url: 'customers.html', roles: ['super-admin', 'owner', 'booker'] },
                { icon: 'fa-boxes-stacked', text: 'Stock Manager <span class="ur-sub">(اسٹاک و گودام)</span>', url: 'stock.html', roles: ['super-admin', 'owner'] },
                { icon: 'fa-wallet', text: 'Daily Expenses <span class="ur-sub">(روزانہ اخراجات)</span>', url: 'expenses.html', roles: ['super-admin', 'owner'] },
                { icon: 'fa-bell', text: 'Low Stock Alerts <span class="ur-sub">(کم اسٹاک الرٹس)</span>', url: 'alerts.html', roles: ['super-admin', 'owner'] },
                { icon: 'fa-network-wired', text: 'Multi-Agency Hub <span class="ur-sub">(ملٹی ایجنسی کنٹرول)</span>', url: 'multi-agency.html', roles: ['super-admin', 'owner'] },
                { icon: 'fa-users', text: 'Staff & Bookers <span class="ur-sub">(اسٹاف و سیلز ٹیم)</span>', url: 'owner.html', roles: ['super-admin', 'owner'] },
                { icon: 'fa-building', text: 'Agencies <span class="ur-sub">(تمام برانچز)</span>', url: 'admin.html', roles: ['super-admin'] },
            ]
        },
        {
            title: 'REPORTS <span class="ur-sub">(کاروباری رپورٹس)</span>',
            items: [
                { icon: 'fa-sack-dollar', text: 'Profit Analytics <span class="ur-sub">(منافع کا تجزیہ)</span>', url: 'profit.html', roles: ['super-admin', 'owner'], phase: 'PROFIT' },
                { icon: 'fa-chart-column', text: 'Sales Reports <span class="ur-sub">(سیلز رپورٹس)</span>', url: 'reports.html?tab=sales', roles: ['super-admin', 'owner', 'booker'] },
                { icon: 'fa-trophy', text: 'Best Sellers <span class="ur-sub">(زیادہ بکنے والا سامان)</span>', url: 'reports.html?tab=bestsellers', roles: ['super-admin', 'owner'] },
                { icon: 'fa-hourglass-half', text: 'Slow & Dead Stock <span class="ur-sub">(سست و رکا ہوا مال)</span>', url: 'reports.html?tab=slow', roles: ['super-admin', 'owner'] },
                { icon: 'fa-rotate-left', text: 'Claims & Returns <span class="ur-sub">(کلیمز و واپسی مال)</span>', url: 'reports.html?tab=claims', roles: ['super-admin', 'owner'] },
                { icon: 'fa-triangle-exclamation', text: 'Damage & Lost <span class="ur-sub">(خراب و ضائع شدہ مال)</span>', url: 'reports.html?tab=damage', roles: ['super-admin', 'owner'] },
            ]
        },
        {
            title: 'SETTINGS <span class="ur-sub">(ترتیبات و سیٹنگز)</span>',
            items: [
                { icon: 'fa-cloud-arrow-up', text: 'Backup & Restore <span class="ur-sub">(بیک اپ و ڈیٹا بحالی)</span>', url: 'backup.html', roles: ['super-admin', 'owner'] },
                { icon: 'fa-gear', text: 'Settings <span class="ur-sub">(ایجنسی سیٹنگز)</span>', url: 'settings.html', roles: ['super-admin', 'owner'] },
                { icon: 'fa-cloud-arrow-down', text: 'Cloud Sync & Shifts <span class="ur-sub">(کلاؤڈ سنک و شفٹس)</span>', url: 'settings.html?tab=secSyncSchedule', roles: ['booker'] },
            ]
        }
    ];

    // 👑 DEDICATED SUPER ADMIN SAAS PLATFORM SUITE MENU
    const SUPER_ADMIN_MENU = [
        {
            title: 'SAAS PLATFORM <span class="ur-sub">(سپر ایڈمن کنٹرول روم)</span>',
            items: [
                { icon: 'fa-gauge-high', text: 'Executive Dashboard <span class="ur-sub">(پلیٹ فارم جائزہ)</span>', url: 'admin.html', roles: ['super-admin'] },
                { icon: 'fa-trophy', text: 'Store Intelligence & Rankings <span class="ur-sub">(رینکنگ و کارکردگی)</span>', url: 'admin.html#tabLeaderboard', roles: ['super-admin'] },
                { icon: 'fa-building', text: 'Client Stores & Governance <span class="ur-sub">(تمام رجسٹرڈ دکانیں)</span>', url: 'admin.html#tabAgencies', roles: ['super-admin'] },
                { icon: 'fa-cubes', text: 'Customizable Packages <span class="ur-sub">(پیکیجز و کسٹمائزیشن)</span>', url: 'admin.html#tabPackages', roles: ['super-admin'] },
                { icon: 'fa-inbox', text: 'Upgrade Requests <span class="ur-sub">(پیکیج اپ گریڈ درخواستیں)</span>', url: 'admin.html#tabRequests', roles: ['super-admin'] },
                { icon: 'fa-plus-circle', text: 'Register New Store <span class="ur-sub">(نئی دکان رجسٹریشن)</span>', url: 'admin.html#tabCreateAgency', roles: ['super-admin'] },
            ]
        },
        {
            title: 'SYSTEM & LOGS <span class="ur-sub">(سسٹم و ڈیٹا لاگز)</span>',
            items: [
                { icon: 'fa-money-bill-wave', text: 'Subscriptions & Revenue <span class="ur-sub">(ماہانہ فیس لاگ)</span>', url: 'admin.html#tabOverview', roles: ['super-admin'] },
                { icon: 'fa-cloud-arrow-up', text: 'Cloud Data Backup <span class="ur-sub">(بیک اپ و ڈیٹا بحالی)</span>', url: 'backup.html', roles: ['super-admin'] },
            ]
        }
    ];

    // 2️⃣ CSS INJECT
    const style = document.createElement('style');
    style.textContent = `
        /* ========== SIDEBAR STYLES ========== */
        .eb-sidebar {
            position: fixed;
            top: 0; left: -295px;
            width: 280px; height: 100vh;
            max-width: 86vw;
            background: #1e293b;
            color: #fff;
            z-index: 99998;
            transition: left 0.3s ease;
            overflow-y: auto;
            box-shadow: 5px 0 20px rgba(0,0,0,0.3);
            border-right: 1px solid rgba(255,255,255,0.08);
        }
        .eb-sidebar.open { left: 0; }
        
        .eb-sidebar-header {
            padding: 20px 18px 15px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .eb-sidebar-brand {
            display: flex; align-items: center; gap: 10px;
            margin-bottom: 8px;
        }
        .eb-sidebar-logo {
            background: #10b981;
            width: 40px; height: 40px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px;
        }
        .eb-sidebar-appname { font-size: 16px; font-weight: bold; }
        .eb-sidebar-agency {
            font-size: 12px; 
            color: #94a3b8;
            padding-left: 50px;
            word-break: break-word;
        }
        .eb-sidebar-version {
            font-size: 10px;
            color: #64748b;
            padding-left: 50px;
        }

        .eb-menu-section-title {
            font-size: 10px;
            letter-spacing: 1.5px;
            color: #64748b;
            padding: 14px 18px 6px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .eb-sec-ur {
            font-size: 10.5px;
            letter-spacing: 0;
            color: #94a3b8;
            font-weight: normal;
        }
        .eb-menu-item {
            display: flex;
            align-items: center;
            gap: 11px;
            padding: 8px 14px;
            color: #cbd5e1;
            text-decoration: none;
            font-size: 13.5px;
            cursor: pointer;
            transition: all 0.15s;
            border-left: 3px solid transparent;
            min-height: 40px;
        }
        .eb-menu-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .eb-menu-item.active {
            background: rgba(16, 185, 129, 0.15);
            border-left-color: #10b981;
            color: #fff;
            font-weight: bold;
        }
        .eb-menu-item > i:first-child {
            width: 18px;
            text-align: center;
            font-size: 14px;
            flex-shrink: 0;
            color: #94a3b8;
            transition: color 0.15s;
        }
        .eb-menu-item:hover > i:first-child,
        .eb-menu-item.active > i:first-child {
            color: #10b981;
        }
        .eb-menu-item.locked > i:first-child {
            color: #ef4444;
        }

        .eb-item-content {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .eb-item-topline {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
            width: 100%;
        }
        .eb-item-en {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 13px;
            font-weight: 500;
            color: #cbd5e1;
            line-height: 1.25;
            flex: 1;
            min-width: 0;
        }
        .eb-menu-item:hover .eb-item-en,
        .eb-menu-item.active .eb-item-en {
            color: #ffffff;
        }
        .eb-menu-item.active .eb-item-en {
            font-weight: 700;
        }
        .eb-item-ur {
            font-size: 11px;
            color: #94a3b8;
            line-height: 1.25;
            margin-top: 1.5px;
            direction: rtl;
            text-align: left;
            font-family: 'Segoe UI', system-ui, Tahoma, sans-serif;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .eb-menu-item:hover .eb-item-ur {
            color: #cbd5e1;
        }
        .eb-menu-item.active .eb-item-ur {
            color: #6ee7b7;
        }

        /* Language visibility controls */
        html[data-lang="en"] .eb-item-ur,
        html:not([data-lang="en-ur"]) .eb-item-ur,
        html[data-lang="en"] .eb-sec-ur,
        html:not([data-lang="en-ur"]) .eb-sec-ur {
            display: none !important;
        }
        html[data-lang="en-ur"] .eb-item-ur {
            display: block !important;
        }
        html[data-lang="en-ur"] .eb-sec-ur {
            display: inline-block !important;
        }

        .eb-phase-tag {
            margin-left: auto;
            flex-shrink: 0;
            font-size: 9px;
            background: #f59e0b;
            color: #fff;
            padding: 1.5px 5.5px;
            border-radius: 4px;
            font-weight: bold;
            white-space: nowrap;
            line-height: 1.2;
        }
        .eb-menu-item.locked {
            opacity: 0.95;
            cursor: pointer;
            border-left-color: rgba(239, 68, 68, 0.4);
        }
        .eb-menu-item.locked:hover {
            background: rgba(239, 68, 68, 0.08);
            color: #fff;
        }
        .eb-lock-pill {
            margin-left: auto;
            flex-shrink: 0;
            white-space: nowrap;
            font-size: 9px;
            background: rgba(239, 68, 68, 0.18);
            border: 1px solid rgba(239, 68, 68, 0.6);
            padding: 2px 5px;
            border-radius: 4px;
            height: 18px;
            display: inline-flex;
            align-items: center;
            gap: 3.5px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
            line-height: 1;
        }
        .eb-lock-pill .eb-red-lock {
            color: #ef4444 !important;
            font-size: 8.5px !important;
            width: auto !important;
            line-height: 1 !important;
        }
        .eb-lock-pill .eb-lock-txt {
            color: #ffffff !important;
            font-size: 9px !important;
            font-weight: 800 !important;
            letter-spacing: 0.3px;
            line-height: 1 !important;
            text-transform: uppercase;
        }

        /* Theme Dropup inside sidebar (Opens upwards) */
        .eb-theme-dropup-container {
            position: relative;
            width: 100%;
        }
        .eb-theme-toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 9px 18px;
            border-top: 1px solid rgba(255,255,255,0.08);
            margin-top: 6px;
            font-size: 13px;
            color: #cbd5e1;
            position: relative;
        }
        .eb-theme-dropup-menu {
            display: none;
            position: absolute;
            bottom: calc(100% + 4px);
            left: 10px;
            right: 10px;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 6px;
            box-shadow: 0 -10px 25px rgba(0,0,0,0.6);
            z-index: 10005;
            max-height: 290px;
            overflow-y: auto;
        }
        .eb-theme-dropup-menu.show {
            display: block;
            animation: ebDropupAnim 0.16s ease-out;
        }
        @keyframes ebDropupAnim {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .eb-theme-option {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 7px 10px;
            border-radius: 8px;
            font-size: 12px;
            color: #f1f5f9;
            cursor: pointer;
            transition: all 0.15s;
            user-select: none;
            margin-bottom: 2px;
        }
        .eb-theme-option:hover {
            background: rgba(255,255,255,0.1);
        }
        .eb-theme-option.active {
            background: rgba(56, 189, 248, 0.18);
            color: #38bdf8;
            font-weight: 800;
        }
        .eb-theme-soon-badge {
            font-size: 9px;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 6px;
            background: rgba(245, 158, 11, 0.2);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.4);
            letter-spacing: 0.3px;
            white-space: nowrap;
        }
        .eb-lang-toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 18px;
            font-size: 13px;
            color: #cbd5e1;
        }
        .eb-theme-btn {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.18);
            color: #fff;
            padding: 5px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: background 0.2s;
        }
        .eb-theme-btn:hover {
            background: rgba(255,255,255,0.22);
        }
        .eb-lang-btn {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.15);
            color: #fff;
            padding: 4px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            transition: all 0.2s;
        }
        .eb-lang-btn:hover {
            background: #0284c7;
            border-color: #38bdf8;
        }


        /* Profile section (sidebar neeche) */
        .eb-sidebar-profile {
            padding: 15px 18px;
            border-top: 1px solid rgba(255,255,255,0.1);
            margin-top: 5px;
        }
        .eb-profile-link {
            display: flex; align-items: center; gap: 12px;
            color: #cbd5e1; text-decoration: none;
            font-size: 14px;
            padding: 8px;
            border-radius: 8px;
            transition: all 0.15s;
        }
        .eb-profile-link:hover { background: rgba(255,255,255,0.08); color: #fff; }

        /* ========== OVERLAY (mobile) ========== */
        .eb-sidebar-overlay {
            position: fixed;
            top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.6);
            z-index: 99997;
            display: none;
        }
        .eb-sidebar-overlay.show { display: block; }

        /* ========== 🔝 UNIVERSAL SOLID STICKY TOPBAR (Dark Navy Sleek) ========== */
        .eb-universal-topbar {
            position: sticky;
            top: 0; left: 0; right: 0;
            width: 100%;
            height: 54px;
            background: #1e293b;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            z-index: 99990;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 14px;
            box-sizing: border-box;
            box-shadow: 0 2px 10px rgba(0,0,0,0.12);
        }
        .eb-topbar-left {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
            flex: 1;
        }
        .eb-topbar-brand {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
        }
        .eb-topbar-icon {
            width: 36px; height: 36px;
            border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            font-size: 18px;
            color: #fff;
            flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        }
        .eb-topbar-title-group {
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-width: 0;
            line-height: 1.2;
            overflow: hidden;
        }
        .eb-topbar-title {
            font-size: 15px;
            font-weight: 800;
            color: #ffffff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            letter-spacing: -0.2px;
        }
        .eb-topbar-sub {
            font-size: 11px;
            color: #94a3b8;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-top: 1px;
        }
        .eb-topbar-btn {
            width: 36px; height: 36px;
            border-radius: 9px;
            background: rgba(255, 255, 255, 0.12);
            border: 1px solid rgba(255, 255, 255, 0.2);
            display: flex; align-items: center; justify-content: center;
            color: #fff;
            font-size: 15px;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s;
            flex-shrink: 0;
        }
        .eb-topbar-btn:hover {
            transform: scale(1.04);
            background: rgba(255, 255, 255, 0.22);
            color: #fff;
        }
        .eb-topbar-right {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }
        .eb-topbar-sync {
            position: relative;
        }
        .eb-sync-badge {
            position: absolute;
            top: 4px; right: 4px;
            width: 9px; height: 9px;
            background: #10b981;
            border-radius: 50%;
            border: 2px solid #1e293b;
            transition: background 0.3s;
        }
        .eb-topbar-bell {
            position: relative;
            border-radius: 50% !important;
        }
        .eb-bell-badge {
            position: absolute;
            top: -3px; right: -3px;
            background: #ef4444;
            color: #fff;
            font-size: 10px;
            font-weight: 800;
            padding: 2px 5px;
            border-radius: 10px;
            min-width: 17px;
            text-align: center;
            border: 2px solid #1e293b;
            line-height: 1;
        }
        .eb-avatar-btn {
            border-radius: 50% !important;
            background: #10b981 !important;
            color: #ffffff !important;
            font-size: 14px !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        .eb-avatar-btn:hover {
            background: #059669 !important;
            color: #ffffff !important;
            transform: scale(1.05);
        }
        .eb-install-btn {
            background: linear-gradient(135deg, #10b981, #059669) !important;
            color: #ffffff !important;
            font-weight: 800 !important;
            font-size: 11.5px !important;
            border: 1px solid #34d399 !important;
            border-radius: 8px !important;
            padding: 0 10px !important;
            height: 32px !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 5px !important;
            animation: pulseInstall 2.2s infinite ease-in-out;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(16, 185, 129, 0.45);
            white-space: nowrap !important;
            transition: all 0.25s ease;
        }
        .eb-install-btn:hover {
            transform: translateY(-1px) scale(1.03);
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.6);
        }
        .eb-install-btn.is-installed {
            background: #064e3b !important;
            color: #34d399 !important;
            border: 1.5px solid #059669 !important;
            animation: none !important;
            box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3) !important;
        }
        @keyframes pulseInstall {
            0%, 100% { transform: scale(1); box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4); }
            50% { transform: scale(1.04); box-shadow: 0 4px 14px rgba(16, 185, 129, 0.7); }
        }
        .eb-offline-badge {
            background: #ef4444;
            color: #fff;
            font-size: 10px;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 5px;
            display: none;
            align-items: center;
            gap: 3px;
            border: 1px solid #fca5a5;
        }
        .eb-pkg-pill {
            font-size: 8.5px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            display: inline-flex;
            align-items: center;
            line-height: 1.2;
        }
        .eb-pkg-free { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
        .eb-pkg-paid { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
        .eb-pkg-expired { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }


        /* 🚫 Eliminate duplicate headers and excessive gaps on all pages */
        .panel-topbar, #topBar, .top-bar, .top-nav-bar, header.panel-topbar, div.top-bar {
            display: none !important;
        }
        body {
            padding-top: 0 !important;
            margin-top: 0 !important;
        }
        .eb-page-content {
            padding-top: 0 !important;
        }
        .panel-container, .dashboard-container, .vyapar-container {
            margin-top: 8px !important;
        }

        /* ========== PC: PERMANENT SIDEBAR ========== */
        @media (min-width: 992px) {
            .eb-sidebar { left: 0; }
            .eb-sidebar-overlay { display: none !important; }
            .eb-page-content {
                margin-left: 270px !important;
                padding-top: 0 !important;
            }
            .eb-universal-topbar {
                margin-left: 270px;
                width: calc(100% - 270px);
            }
            .eb-universal-topbar #ebHamburgerBtn {
                display: none !important;
            }
        }
    `;
    document.head.appendChild(style);

    // 3️⃣ PROFILE DATA FETCH & PACKAGE STATUS
    const cachedAgencyId = localStorage.getItem('eb_active_agencyId') || '';
    let myProfile = { name: 'User', role: 'owner', agencyName: '', agencyId: cachedAgencyId };
    let myAgencyData = null;
    let agencyPackageState = {
        tier: 'free',       // 'free', 'starter_single', 'wholesale_dist', 'multi_pro', 'enterprise_multi'
        isPaid: false,
        isExpired: false,
        daysLeft: 0,
        statusText: 'Free Starter'
    };

    function evaluatePackageStatus(agency) {
        if (!agency) {
            // Check local cache
            try {
                const cachedPkg = JSON.parse(localStorage.getItem(`eb_pkg_state_${cachedAgencyId}`) || 'null');
                if (cachedPkg) return cachedPkg;
            } catch (e) {}
            return agencyPackageState;
        }

        const pkgId = agency.packageId || 'free';
        const isPaid = pkgId !== 'free';
        const expiry = agency.subscriptionExpiry || agency.expiryDate;
        const todayStr = new Date().toISOString().slice(0, 10);
        let isExpired = false;
        let daysLeft = 0;

        if (isPaid && expiry) {
            isExpired = expiry < todayStr;
            const diffTime = new Date(expiry).getTime() - new Date().getTime();
            daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        const state = {
            tier: pkgId,
            isPaid,
            isExpired,
            daysLeft: Math.max(0, daysLeft),
            statusText: !isPaid 
                ? 'Free' 
                : (isExpired ? 'Paid (Expired ⚠️ Shifted to Free)' : `Paid Pro (${daysLeft}d left)`)
        };

        if (agency.id || cachedAgencyId) {
            localStorage.setItem(`eb_pkg_state_${agency.id || cachedAgencyId}`, JSON.stringify(state));
        }

        return state;
    }
    
    // ⚡ INSTANT SIDEBAR RENDER (0ms latency from session cache)
    try {
        const cachedProfileStr = sessionStorage.getItem('eb_user_profile');
        const cachedAgencyStr = sessionStorage.getItem('eb_agency_data');
        if (cachedProfileStr) {
            myProfile = JSON.parse(cachedProfileStr);
            if (cachedAgencyStr) {
                myAgencyData = JSON.parse(cachedAgencyStr);
                agencyPackageState = evaluatePackageStatus(myAgencyData);
            }
            window.__myAgencyData = myAgencyData;
            window.__myProfile = myProfile;
            renderSidebar();
            updateAvatar();
            updatePackageBadgeInTopBar();
        }
    } catch (_) {}

    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
        const auth = firebase.auth();
        const db = firebase.firestore();

        // Enable Firestore IndexedDB Persistence for ultra-fast local reads
        try {
            db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
        } catch (_) {}
        
        auth.onAuthStateChanged(async (user) => {
            if (!user) return;
            try {
                const doc = await db.collection('users').doc(user.uid).get();
                if (doc.exists) {
                    myProfile = doc.data();
                    if (myProfile.agencyId) {
                        localStorage.setItem('eb_active_agencyId', myProfile.agencyId);
                    }
                } else {
                    myProfile.name = user.email.split('@')[0];
                }

                // Cache user profile for 0ms instant load on subsequent navigations
                try {
                    sessionStorage.setItem('eb_user_profile', JSON.stringify(myProfile));
                } catch (_) {}

                // Fetch Agency Package & Subscription Expiry
                const activeAgId = myProfile.agencyId || localStorage.getItem('eb_active_agencyId');
                if (activeAgId && activeAgId !== 'super-admin-hq') {
                    try {
                        const agDoc = await db.collection('agencies').doc(activeAgId).get();
                        if (agDoc.exists) {
                            myAgencyData = agDoc.data();
                            myAgencyData.id = agDoc.id;
                            if (myAgencyData.name) myProfile.agencyName = myAgencyData.name;
                            if (myAgencyData.city) myProfile.city = myAgencyData.city;
                            agencyPackageState = evaluatePackageStatus(myAgencyData);

                            try {
                                sessionStorage.setItem('eb_agency_data', JSON.stringify(myAgencyData));
                            } catch (_) {}

                            // ⛔ Check if agency is suspended / frozen by Super Admin
                            if (myProfile.role !== 'super-admin' && (myAgencyData.status === 'suspended' || myAgencyData.isSuspended === true)) {
                                document.body.innerHTML = `
                                <div style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:#0f172a; color:#fff; display:flex; align-items:center; justify-content:center; z-index:9999999; padding:20px; text-align:center; font-family:'Segoe UI',sans-serif;">
                                    <div style="background:#1e293b; border:2px solid #ef4444; border-radius:18px; padding:35px 25px; max-width:500px; box-shadow:0 25px 50px rgba(0,0,0,0.5);">
                                        <div style="font-size:55px; margin-bottom:12px;">⏸️</div>
                                        <h2 style="color:#ef4444; margin:0 0 10px 0; font-size:22px; font-weight:900;">ACCOUNT TEMPORARILY SUSPENDED</h2>
                                        <h4 style="color:#f8fafc; margin:0 0 14px 0; font-size:15px;">اکاؤنٹ عارضی طور پر سسپنڈ ہے</h4>
                                        <p style="color:#94a3b8; font-size:13px; line-height:1.6; margin:0 0 20px 0;">
                                            آپ کا سافٹ ویئر اکاؤنٹ ایڈمنسٹریٹر کی طرف سے عارضی طور پر سسپنڈ کر دیا گیا ہے۔ برائے مہربانی ماہانہ فیس کی ادائیگی یا سروس بحالی کے لیے سپر ایڈمن سے رابطہ کریں۔
                                        </p>
                                        <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; padding:12px; font-size:12px; color:#cbd5e1; margin-bottom:18px;">
                                            Agency: <b>${myAgencyData.name || 'Your Agency'}</b> &nbsp;|&nbsp; Status: <b style="color:#ef4444;">FROZEN</b>
                                        </div>
                                        <button onclick="location.href='auth.html'" style="background:#ef4444; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer;">
                                            🚪 Logout &amp; Go Back
                                        </button>
                                    </div>
                                </div>`;
                                return;
                            }
                        }
                    } catch (eAg) {
                        console.warn('Agency fetch in sidebar:', eAg);
                        agencyPackageState = evaluatePackageStatus(null);
                    }
                }

                window.__myAgencyData = myAgencyData;
                window.__myProfile = myProfile;

                renderSidebar();
                updateAvatar();
                updatePackageBadgeInTopBar();

                // ⚡ Auto-check Cloud Sync & Quota Protection
                if (window.CloudSync && activeAgId) {
                    window.CloudSync.checkAndAutoSync(activeAgId, db);
                    window.CloudSync.updateTopBarIndicator(activeAgId);
                }
            } catch (e) {
                console.warn('Sidebar profile fetch:', e);
                agencyPackageState = evaluatePackageStatus(null);
                window.__myAgencyData = myAgencyData;
                window.__myProfile = myProfile;
                renderSidebar();
            }
        });
    } else {
        agencyPackageState = evaluatePackageStatus(null);
        window.__myAgencyData = myAgencyData;
        window.__myProfile = myProfile;
        renderSidebar();
    }


    // 4️⃣ SIDEBAR RENDER
    function renderSidebar() {
        const existingSidebar = document.getElementById('ebSidebar');
        if (existingSidebar) {
            existingSidebar.remove();
        }
        const existingOverlay = document.getElementById('ebSidebarOverlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        const currentUserEmail = (myProfile && myProfile.email) || (window.firebase && firebase.auth().currentUser && firebase.auth().currentUser.email) || '';
        const isSuperAdmin = myProfile.role === 'super-admin' || currentUserEmail === 'aliimtiaz1126@gmail.com';
        const role = isSuperAdmin ? 'super-admin' : (myProfile.role || 'owner');
        const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';

        const sidebar = document.createElement('div');
        sidebar.className = 'eb-sidebar';
        sidebar.id = 'ebSidebar';

        const agencyTitleText = isSuperAdmin
            ? '👑 SaaS Master Platform'
            : `🏢 ${myProfile.agencyName || myProfile.name || 'My Business'}`;

        let menuHtml = `<div class="eb-sidebar-header">
            <div class="eb-sidebar-brand">
                <div class="eb-sidebar-logo">${isSuperAdmin ? '👑' : '⚡'}</div>
                <div class="eb-sidebar-appname">${isSuperAdmin ? 'Easy Bill Super Admin' : 'Easy Bill Generator'}</div>
            </div>
            <div class="eb-sidebar-agency">${agencyTitleText}</div>
            <div class="eb-sidebar-version">Version ${window.EASYBILL_VERSION || '4.0.0'}</div>
        </div>`;

        const activeMenuList = isSuperAdmin ? SUPER_ADMIN_MENU : MENU;

        activeMenuList.forEach(section => {
            const allowedItems = section.items.filter(it => {
                if (isSuperAdmin) return it.roles.includes('super-admin');
                // Roles check: admin only pages stay hidden from non-super-admins
                if (!it.roles.includes(role)) return false;

                // Booker specific permissions set by their employer owner
                if (role === 'booker' && myProfile && myProfile.permissions) {
                    if (it.url.includes('customers.html') && myProfile.permissions.customers === false) return false;
                    if (it.url.includes('stock.html') && !myProfile.permissions.stock) return false;
                }

                // 🔒 IMPORTANT USER REQUIREMENT:
                // For owner: DO NOT HIDE ANY MODULE! ("wo modules ghaib na hoon balkay un per lock 🔒 ban jayeen")
                // All premium, pro, or expired modules stay visible, but display a lock pill!
                return true;
            });
            if (allowedItems.length === 0) return;

            const secParsed = splitEnUrText(section.title);
            menuHtml += `<div class="eb-menu-section-title">
                <span>${secParsed.en || section.title}</span>
                ${secParsed.ur ? `<span class="eb-sec-ur ur-sub">${secParsed.ur}</span>` : ''}
            </div>`;
            
            allowedItems.forEach(item => {
                const isActive = currentPath === item.url ? 'active' : '';
                const modId = getModuleIdFromUrl(item.url);

                // 🛡️ Evaluate SaaS Lock Status
                let isLocked = false;
                let lockBadge = '';
                if (modId && window.SaaSModules) {
                    const access = window.SaaSModules.checkModuleAccess(
                        modId,
                        myAgencyData,
                        role,
                        myAgencyData ? myAgencyData.permissions : null
                    );
                    if (access.locked) {
                        isLocked = true;
                        // Single RED lock icon, pure WHITE "PRO" text, compact single-line badge
                        lockBadge = `<span class="eb-lock-pill"><i class="fas fa-lock eb-red-lock"></i><span class="eb-lock-txt">PRO</span></span>`;
                    }
                }

                let phaseTag = item.phase ? `<span class="eb-phase-tag">${item.phase}</span>` : '';
                let itemText = item.text;
                let itemIcon = item.icon;
                if (role === 'booker' && item.url === 'bills.html') {
                    itemText = 'Book Order <span class="ur-sub">(آرڈر بک کریں)</span>';
                    itemIcon = 'fa-clipboard-check';
                }
                
                const parsed = splitEnUrText(itemText);
                const enLabel = parsed.en || itemText;
                const urLabel = parsed.ur || '';
                const tagOrLock = isLocked ? lockBadge : phaseTag;

                if (isLocked) {
                    menuHtml += `
                    <a class="eb-menu-item locked" data-locked="true" data-mod-id="${modId}" title="Locked Feature: Click to view packages & unlock" onclick="event.preventDefault(); window.SaaSModules && window.SaaSModules.showUpgradeModal('${modId}', window.__myAgencyData, window.__myProfile);">
                        <i class="fas ${itemIcon}"></i>
                        <div class="eb-item-content">
                            <div class="eb-item-topline">
                                <span class="eb-item-en">${enLabel}</span>
                                ${tagOrLock}
                            </div>
                            ${urLabel ? `<span class="eb-item-ur ur-sub">${urLabel}</span>` : ''}
                        </div>
                    </a>`;
                } else {
                    menuHtml += `
                    <a class="eb-menu-item ${isActive}" href="${item.url === '#install-pwa' ? 'javascript:void(0)' : item.url}" ${item.url === '#install-pwa' ? 'onclick="window.installEasyBillPWA && window.installEasyBillPWA(); return false;"' : ''}>
                        <i class="fas ${itemIcon}"></i>
                        <div class="eb-item-content">
                            <div class="eb-item-topline">
                                <span class="eb-item-en">${enLabel}</span>
                                ${tagOrLock}
                            </div>
                            ${urLabel ? `<span class="eb-item-ur ur-sub">${urLabel}</span>` : ''}
                        </div>
                    </a>`;
                }
            });
        });

        // 🛡️ If the user navigated directly to a locked page URL, trigger paywall
        const activeModId = getModuleIdFromUrl(currentPath);
        if (activeModId && role !== 'super-admin' && window.SaaSModules) {
            const pageAccess = window.SaaSModules.checkModuleAccess(
                activeModId,
                myAgencyData,
                role,
                myAgencyData ? myAgencyData.permissions : null
            );
            if (pageAccess && pageAccess.locked) {
                setTimeout(() => {
                    window.SaaSModules.enforcePagePaywall(activeModId, null, myAgencyData, role, myProfile);
                }, 150);
            }
        }


        // Theme toggle dropup row + Profile + Logout
        const currentThemeNow = localStorage.getItem('eb_theme_mode') || 'dark';
        const isDark = currentThemeNow === 'dark' || currentThemeNow === 'night';
        const currentLangNow = localStorage.getItem('eb_app_language') || 'en';
        const isUrduMix = currentLangNow === 'en-ur';

        menuHtml += `
        <div class="eb-lang-toggle-row">
            <span><span>🌐 Language <span class="ur-sub">(زبان)</span></span></span>
            <button class="eb-lang-btn" id="ebSidebarLangToggle" title="Toggle English / Urdu Mix">
                <span id="ebSidebarLangText">${isUrduMix ? 'English + اردو' : 'English Only'}</span>
            </button>
        </div>
        <div class="eb-theme-dropup-container">
            <!-- 🎨 Dropup Menu (Opens Upwards) -->
            <div class="eb-theme-dropup-menu" id="ebThemeDropupMenu">
                <div style="font-size:10px; font-weight:800; color:#94a3b8; text-transform:uppercase; padding:4px 8px 6px; letter-spacing:0.5px;">
                    Select Theme <span class="ur-sub">(تھیم منتخب کریں)</span>
                </div>
                <div class="eb-theme-option ${isDark ? 'active' : ''}" data-theme-val="dark">
                    <span>🌙 Dark / Night Mode <span class="ur-sub">(ڈارک موڈ)</span></span>
                    ${isDark ? '<i class="fas fa-check" style="color:#38bdf8;"></i>' : '<span style="font-size:10px; color:#10b981; font-weight:800;">Active</span>'}
                </div>
                <div class="eb-theme-option ${!isDark ? 'active' : ''}" data-theme-val="light">
                    <span>☀️ Light Mode <span class="ur-sub">(لائٹ موڈ)</span></span>
                    ${!isDark ? '<i class="fas fa-check" style="color:#38bdf8;"></i>' : '<span style="font-size:10px; color:#10b981; font-weight:800;">Active</span>'}
                </div>
                <div class="eb-theme-option" data-theme-val="theme-green" data-theme-name="Emerald Green" data-soon="true">
                    <span>🟢 Emerald Green <span class="ur-sub">(سبز تھیم)</span></span>
                    <span class="eb-theme-soon-badge">Coming Soon <span class="ur-sub">(جلد)</span></span>
                </div>
                <div class="eb-theme-option" data-theme-val="theme-red" data-theme-name="Ruby Red" data-soon="true">
                    <span>🔴 Ruby Red <span class="ur-sub">(سرخ تھیم)</span></span>
                    <span class="eb-theme-soon-badge">Coming Soon <span class="ur-sub">(جلد)</span></span>
                </div>
                <div class="eb-theme-option" data-theme-val="theme-blue" data-theme-name="Royal Blue" data-soon="true">
                    <span>🔵 Royal Blue <span class="ur-sub">(نیلا تھیم)</span></span>
                    <span class="eb-theme-soon-badge">Coming Soon <span class="ur-sub">(جلد)</span></span>
                </div>
                <div class="eb-theme-option" data-theme-val="theme-purple" data-theme-name="Amethyst Purple" data-soon="true">
                    <span>🟣 Amethyst Purple <span class="ur-sub">(جامنی تھیم)</span></span>
                    <span class="eb-theme-soon-badge">Coming Soon <span class="ur-sub">(جلد)</span></span>
                </div>
                <div class="eb-theme-option" data-theme-val="theme-yellow" data-theme-name="Amber Gold" data-soon="true">
                    <span>🟡 Amber Gold <span class="ur-sub">(سنہری پیلا)</span></span>
                    <span class="eb-theme-soon-badge">Coming Soon <span class="ur-sub">(جلد)</span></span>
                </div>
                <div class="eb-theme-option" data-theme-val="theme-orange" data-theme-name="Sunset Orange" data-soon="true">
                    <span>🟠 Sunset Orange <span class="ur-sub">(نارنجی تھیم)</span></span>
                    <span class="eb-theme-soon-badge">Coming Soon <span class="ur-sub">(جلد)</span></span>
                </div>
            </div>

            <div class="eb-theme-toggle-row">
                <span><span>🎨 Theme <span class="ur-sub">(تھیم)</span></span></span>
                <button class="eb-theme-btn" id="ebSidebarThemeToggle" type="button" title="Select Theme / تھیم منتخب کریں">
                    <i class="fas ${isDark ? 'fa-moon' : 'fa-sun'}"></i>
                    <span id="ebSidebarThemeText">${isDark ? 'Dark / Night' : 'Light Mode'}</span>
                    <i class="fas fa-chevron-up" style="font-size:9px; margin-left:3px; opacity:0.8;"></i>
                </button>
            </div>
        </div>
        <div class="eb-sidebar-profile">
            <a class="eb-profile-link" href="profile.html">
                <i class="fas fa-user-circle" style="font-size:20px;"></i>
                <div class="eb-item-content">
                    <div class="eb-item-topline">
                        <span class="eb-item-en">My Profile</span>
                    </div>
                    <span class="eb-item-ur ur-sub">(پروفائل)</span>
                </div>
            </a>
            <a class="eb-profile-link" href="#" id="ebSidebarLogout">
                <i class="fas fa-sign-out-alt" style="font-size:20px; color:#ef4444;"></i>
                <div class="eb-item-content">
                    <div class="eb-item-topline">
                        <span class="eb-item-en" style="color:#ef4444;">Logout</span>
                    </div>
                    <span class="eb-item-ur ur-sub" style="color:#f87171;">(لاگ آؤٹ)</span>
                </div>
            </a>
        </div>`;


        sidebar.innerHTML = menuHtml;
        document.body.appendChild(sidebar);

        // Overlay
        const overlay = document.createElement('div');
        overlay.className = 'eb-sidebar-overlay';
        overlay.id = 'ebSidebarOverlay';
        document.body.appendChild(overlay);

        // Toggle function
        const toggleSidebar = () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('show');
        };
        overlay.addEventListener('click', toggleSidebar);

        // 🔝 INJECT SOLID STICKY UNIVERSAL TOPBAR ON ALL PAGES (Dark Navy Sleek)
        const PAGE_CONFIG = {
            'dashboard.html': { title: role === 'booker' ? 'Order Booker Portal <span class="ur-sub">(بکر پورٹل)</span>' : 'Business Dashboard <span class="ur-sub">(ڈیش بورڈ)</span>', icon: '⚡', color: '#10b981' },
            'bills.html': { title: role === 'booker' ? 'Book Order <span class="ur-sub">(آرڈر بکنگ)</span>' : 'Create New Bill <span class="ur-sub">(نیا بل)</span>', icon: '🧾', color: '#0284c7' },
            'booker-orders.html': { title: role === 'booker' ? 'Booker Orders & Dispatch <span class="ur-sub">(بکر آرڈرز)</span>' : 'Booker Orders & Dispatch Hub <span class="ur-sub">(بکر آرڈرز ہب)</span>', icon: '📋', color: '#0284c7' },
            'customers.html': { title: 'Customers & Khata Ledger <span class="ur-sub">(گاہک و کھاتہ)</span>', icon: '👥', color: '#0284c7' },
            'stock.html': { title: 'Stock & Inventory Manager <span class="ur-sub">(اسٹاک و گودام)</span>', icon: '📦', color: '#f59e0b' },
            'expenses.html': { title: 'Business Expenses Manager <span class="ur-sub">(کاروباری اخراجات)</span>', icon: '💸', color: '#ef4444' },
            'alerts.html': { title: 'Low Stock Alerts & Reorder <span class="ur-sub">(کم اسٹاک الرٹس)</span>', icon: '🔔', color: '#ef4444' },
            'delivery-returns.html': { title: 'Van Dispatch & Returns Hub <span class="ur-sub">(وین ڈسپیچ و ترسیل)</span>', icon: '🚚', color: '#8b5cf6' },
            'multi-agency.html': { title: 'Multi-Agency Control Hub <span class="ur-sub">(ملٹی برانچ کنٹرول)</span>', icon: '🌐', color: '#10b981' },
            'owner.html': { title: 'Staff & Bookers <span class="ur-sub">(اسٹاف و سیلز ٹیم)</span>', icon: '👥', color: '#0284c7' },
            'admin.html': { title: '👑 SaaS Platform Administration <span class="ur-sub">(سپر ایڈمن کنٹرول روم)</span>', icon: '👑', color: '#8b5cf6' },
            'reports.html': { title: 'Reports & Analytics <span class="ur-sub">(کاروباری رپورٹس)</span>', icon: '📈', color: '#059669' },
            'backup.html': { title: 'Backup & Restore <span class="ur-sub">(بیک اپ و ڈیٹا بحالی)</span>', icon: '💾', color: '#0284c7' },
            'settings.html': { title: role === 'booker' ? 'Cloud Sync & Shifts <span class="ur-sub">(کلاؤڈ سنک و شفٹس)</span>' : 'Agency Settings <span class="ur-sub">(ایجنسی سیٹنگز)</span>', icon: role === 'booker' ? '☁️' : '⚙️', color: '#0284c7' },
            'profile.html': { title: 'My Account Profile <span class="ur-sub">(اکاؤنٹ پروفائل)</span>', icon: '👤', color: '#10b981' }
        };

        const activeFile = window.location.pathname.split('/').pop() || 'index.html';
        const pageConf = PAGE_CONFIG[activeFile] || { title: (document.title ? document.title.replace('Easy Bill Generator — ', '') : 'Easy Bill'), icon: '⚡', color: '#10b981' };

        const agencyTitle = isSuperAdmin ? 'SaaS Master Platform' : (myProfile.agencyName || (myProfile.name ? myProfile.name : 'Easy Bill Enterprise'));
        const agencyCity = isSuperAdmin ? 'Master Platform HQ' : (myProfile.city || myProfile.depot || '');
        const agencySubtitle = agencyCity ? `${agencyTitle} • ${agencyCity}` : agencyTitle;
        const userInitial = (myProfile.name || 'User').charAt(0).toUpperCase();

        let topBar = document.getElementById('ebUniversalTopBar');
        if (!topBar) {
            topBar = document.createElement('header');
            topBar.className = 'eb-universal-topbar';
            topBar.id = 'ebUniversalTopBar';
            topBar.innerHTML = `
                <div class="eb-topbar-left">
                    <button type="button" class="eb-topbar-btn" id="ebHamburgerBtn" title="Menu" aria-label="Toggle Menu">
                        <i class="fas fa-bars"></i>
                    </button>
                    <div class="eb-topbar-brand">
                        <div class="eb-topbar-icon" id="ebTopIcon" style="background: ${pageConf.color};">${pageConf.icon}</div>
                        <div class="eb-topbar-title-group">
                            <div class="eb-topbar-title" id="ebTopPageTitle">${pageConf.title}</div>
                            <div class="eb-topbar-sub" id="ebTopSubtitle">${agencySubtitle}</div>
                        </div>
                    </div>
                </div>
                <div class="eb-topbar-right">
                    <!-- 📴 Offline Indicator Badge -->
                    <div class="eb-offline-badge" id="ebTopOfflineBadge" title="Working offline with cached data">
                        <span>⚡</span>
                        <span>OFFLINE</span>
                    </div>

                    <!-- 📦 Package Tier Indicator -->
                    ${isSuperAdmin 
                        ? '<span class="eb-pkg-pill" style="background:linear-gradient(135deg, #8b5cf6, #6366f1); color:#fff; font-weight:800; border:1px solid #c084fc;">👑 SUPER ADMIN</span>'
                        : `<span class="eb-pkg-pill ${agencyPackageState.isExpired ? 'eb-pkg-expired' : (agencyPackageState.isPaid ? 'eb-pkg-paid' : 'eb-pkg-free')}" id="ebTopPkgPill" title="${agencyPackageState.statusText}">
                            ${agencyPackageState.isExpired ? 'EXPIRED' : (agencyPackageState.isPaid ? 'PRO' : 'FREE')}
                           </span>`}

                    <button type="button" class="eb-topbar-btn eb-topbar-sync" id="ebTopSyncBtn" title="⚡ Cloud Sync & Quota Protection">
                        <i class="fas fa-cloud"></i>
                        <span class="eb-sync-badge" id="ebTopSyncDot"></span>
                    </button>
                    <a class="eb-topbar-btn eb-topbar-bell" href="alerts.html" title="Low Stock Alerts">
                        <i class="fas fa-bell"></i>
                        <span class="eb-bell-badge" id="ebSidebarBellBadge" style="display:none;">0</span>
                    </a>
                    <a class="eb-topbar-btn eb-avatar-btn" href="profile.html" title="My Profile" id="ebTopAvatarBtn">
                        <i class="fas fa-user"></i>
                    </a>
                </div>


            `;
            document.body.prepend(topBar);
        } else {
            const titleEl = document.getElementById('ebTopPageTitle');
            if (titleEl) titleEl.innerHTML = pageConf.title;
            const subEl = document.getElementById('ebTopSubtitle');
            if (subEl) subEl.innerText = agencySubtitle;
            const iconEl = document.getElementById('ebTopIcon');
            if (iconEl) {
                iconEl.innerText = pageConf.icon;
                iconEl.style.background = pageConf.color;
            }
        }

        const hamburgerBtn = document.getElementById('ebHamburgerBtn');
        if (hamburgerBtn) hamburgerBtn.addEventListener('click', toggleSidebar);
        const topbarMenuBtns = document.querySelectorAll('.topbar-menu-btn, #dashMenuBtn');
        topbarMenuBtns.forEach(btn => btn.addEventListener('click', toggleSidebar));

        // ⚡ Cloud Sync trigger from topbar: Direct Navigation to Cloud Sync & Shift Schedule in Settings
        const topSyncBtn = document.getElementById('ebTopSyncBtn');
        if (topSyncBtn) {
            topSyncBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const currentFile = (window.location.pathname.split('/').pop() || '').split('?')[0];
                if (currentFile === 'settings.html') {
                    const syncTabBtn = document.querySelector('[data-target="secSyncSchedule"]');
                    if (syncTabBtn) {
                        syncTabBtn.click();
                        const sec = document.getElementById('secSyncSchedule');
                        if (sec) sec.scrollIntoView({ behavior: 'smooth' });
                    }
                } else {
                    window.location.href = 'settings.html?tab=secSyncSchedule';
                }
            });
        }
        const activeAgId = myProfile.agencyId || localStorage.getItem('eb_active_agencyId');
        if (window.CloudSync && activeAgId) {
            window.CloudSync.updateTopBarIndicator(activeAgId);
        }

        // Package Pill click: Open package matrix & developer WhatsApp modal
        const topPkgPill = document.getElementById('ebTopPkgPill');
        if (topPkgPill) {
            topPkgPill.style.cursor = 'pointer';
            topPkgPill.addEventListener('click', () => {
                if (window.SaaSModules) {
                    window.SaaSModules.showUpgradeModal('dashboard', window.__myAgencyData, window.__myProfile);
                }
            });
        }

        // Sync badge count
        syncLowStockBadge();

        // Language Toggle Click Handlers (English Default vs Urdu Mix)
        const toggleLanguageMode = () => {
            const currentLang = localStorage.getItem('eb_app_language') || 'en';
            const nextLang = currentLang === 'en-ur' ? 'en' : 'en-ur';
            localStorage.setItem('eb_app_language', nextLang);
            document.documentElement.setAttribute('data-lang', nextLang);
            if (document.body) document.body.setAttribute('data-lang', nextLang);

            // Update UI buttons
            const isNowUrdu = nextLang === 'en-ur';
            const topText = document.getElementById('ebTopLangText');
            if (topText) topText.innerText = isNowUrdu ? 'اردو' : 'EN';
            const sideText = document.getElementById('ebSidebarLangText');
            if (sideText) sideText.innerText = isNowUrdu ? 'English + اردو' : 'English Only';
            const pageLangLabel = document.getElementById('currentLangLabel');
            if (pageLangLabel) pageLangLabel.innerText = isNowUrdu ? 'Language: Urdu Mix (مکس)' : 'Language: English';

            // Broadcast to other components or frames
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'LANG_CHANGED', lang: nextLang }, '*');
            }

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 1600,
                    icon: 'success',
                    title: isNowUrdu ? '🌐 English + Urdu Mix Activated' : '🌐 English Only (Default) Activated'
                });
            }
            return nextLang;
        };

        window.toggleLanguageMode = toggleLanguageMode;


        const topLangBtn = document.getElementById('ebTopLangBtn');
        if (topLangBtn) topLangBtn.addEventListener('click', toggleLanguageMode);

        const sidebarLangBtn = document.getElementById('ebSidebarLangToggle');
        if (sidebarLangBtn) sidebarLangBtn.addEventListener('click', toggleLanguageMode);

        // 🎨 Theme Dropup Toggle & Selection Handlers (Opens Upwards)
        const themeBtn = document.getElementById('ebSidebarThemeToggle');
        const themeDropup = document.getElementById('ebThemeDropupMenu');

        if (themeBtn && themeDropup) {
            themeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                themeDropup.classList.toggle('show');
            });

            // Handle clicking theme options
            themeDropup.querySelectorAll('.eb-theme-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isSoon = option.dataset.soon === 'true';
                    const themeVal = option.dataset.themeVal;
                    const themeName = option.dataset.themeName || themeVal;

                    if (isSoon) {
                        themeDropup.classList.remove('show');
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                title: `🎨 ${themeName}`,
                                html: `<b>Coming Soon!</b><br><span style="font-size:13px; color:#64748b;">یہ تھیم اگلی اپ ڈیٹ میں مکمل طور پر دستیاب ہو جائے گی۔</span>`,
                                icon: 'info',
                                confirmButtonColor: '#0284c7',
                                confirmButtonText: 'ٹھیک ہے (OK)'
                            });
                        }
                        return;
                    }

                    // Apply active theme
                    localStorage.setItem('eb_theme_mode', themeVal);
                    if (window.ebTheme && typeof window.ebTheme.setTheme === 'function') {
                        window.ebTheme.setTheme(themeVal);
                    } else {
                        if (themeVal === 'dark' || themeVal === 'night') {
                            document.documentElement.classList.add('dark-theme');
                            document.documentElement.setAttribute('data-theme', 'dark');
                            document.body.classList.add('dark-theme');
                            document.body.setAttribute('data-theme', 'dark');
                        } else {
                            document.documentElement.classList.remove('dark-theme');
                            document.documentElement.setAttribute('data-theme', 'light');
                            document.body.classList.remove('dark-theme');
                            document.body.setAttribute('data-theme', 'light');
                        }
                    }

                    // Update button UI
                    const btnText = document.getElementById('ebSidebarThemeText');
                    const btnIcon = themeBtn.querySelector('i:first-child');
                    const isNowDark = themeVal === 'dark' || themeVal === 'night';
                    if (btnText) btnText.innerText = isNowDark ? 'Dark / Night' : 'Light Mode';
                    if (btnIcon) btnIcon.className = isNowDark ? 'fas fa-moon' : 'fas fa-sun';

                    // Update active checkmarks in dropup
                    themeDropup.querySelectorAll('.eb-theme-option').forEach(opt => {
                        opt.classList.toggle('active', opt.dataset.themeVal === themeVal);
                    });

                    themeDropup.classList.remove('show');

                    // Post message to top frame if embedded
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({ type: 'THEME_CHANGED', theme: themeVal }, '*');
                    }
                });
            });

            // Close dropup when clicking outside
            document.addEventListener('click', (e) => {
                if (!themeDropup.contains(e.target) && e.target !== themeBtn && !themeBtn.contains(e.target)) {
                    themeDropup.classList.remove('show');
                }
            });
        }

        // Logout event
        const logoutLink = document.getElementById('ebSidebarLogout');
        if (logoutLink) {
            logoutLink.addEventListener('click', async (e) => {
                e.preventDefault();
                const result = await Swal.fire({
                    title: 'Logout?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#ef4444',
                    confirmButtonText: 'Haan',
                    cancelButtonText: 'Cancel'
                });
                if (result.isConfirmed && typeof firebase !== 'undefined') {
                    await firebase.auth().signOut();
                    window.location.href = 'auth.html';
                }
            });
        }

        // Content shifting for main containers
        document.querySelectorAll('.panel-container, .dashboard-container, .vyapar-container, .panel-topbar').forEach(el => {
            el.classList.add('eb-page-content');
        });
    }

    // 5️⃣ AVATAR UPDATE
    function updateAvatar() {
        const avatar = document.querySelector('.eb-profile-avatar');
        if (avatar && myProfile.name) {
            avatar.innerText = myProfile.name.charAt(0).toUpperCase();
        }
    }

    // 6️⃣ 🔔 LOW STOCK BADGE SYNC
    function syncLowStockBadge() {
        const badges = [
            document.getElementById('ebSidebarBellBadge'),
            document.getElementById('dashBellBadge')
        ].filter(Boolean);
        if (badges.length === 0) return;

        const agencyId = myProfile.agencyId || localStorage.getItem('eb_active_agencyId');
        if (!agencyId) return;

        // 1. Read cached count first (0 reads quota shield)
        const cachedCount = localStorage.getItem(`eb_low_stock_count_${agencyId}`);
        if (cachedCount && Number(cachedCount) > 0) {
            badges.forEach(b => {
                b.innerText = cachedCount;
                b.style.display = 'block';
            });
        }

        // 2. Also check stock cache
        try {
            const raw = localStorage.getItem(`eb_stock_cache_${agencyId}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed.items)) {
                    let c = 0;
                    parsed.items.forEach(it => {
                        const q = Number(it.qty || 0);
                        const lim = it.lowStockLimit !== undefined ? Number(it.lowStockLimit) : 10;
                        if (q <= lim) c++;
                    });
                    if (c > 0) {
                        badges.forEach(b => {
                            b.innerText = c;
                            b.style.display = 'block';
                        });
                        localStorage.setItem(`eb_low_stock_count_${agencyId}`, c);
                    } else {
                        badges.forEach(b => b.style.display = 'none');
                    }
                }
            }
        } catch (e) {}
    }

    window.ebSidebar = { toggle: toggleSidebar, refresh: renderSidebar, syncBadge: syncLowStockBadge };
})();
