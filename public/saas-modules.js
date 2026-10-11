// ==========================================================================
// 💎 EASY BILL GENERATOR — SAAS PACKAGES & MODULE PAYWALL REGISTRY (v1.0)
// 🎯 RULES IMPLEMENTED:
// 1. Premium & locked modules GHAIB NA HOON (Do NOT disappear)
// 2. Instead, display a LOCK 🔒 icon and lock pill
// 3. When package ends or fee unpaid, modules lock gracefully
// 4. Clicking locked module opens rich Upgrade / Fee Payment modal
// 5. Super Admin packages with prices & modules integrated
// ==========================================================================

(function initSaaSModules() {
    // 1️⃣ ALL SYSTEM MODULES SPECIFICATION
    const MODULES = {
        'dashboard': {
            id: 'dashboard',
            nameEn: 'Dashboard',
            nameUr: 'ڈیش بورڈ',
            icon: 'fa-chart-line',
            url: 'dashboard.html',
            isCore: true,
            minTier: 'free',
            description: 'Main business overview, sales summary and rapid actions.'
        },
        'bills': {
            id: 'bills',
            nameEn: 'Create New Bill',
            nameUr: 'نیا بل بنائیں',
            icon: 'fa-file-invoice-dollar',
            url: 'bills.html',
            isCore: true,
            minTier: 'free',
            description: 'Fast wholesale invoicing, receipt printing and order booking.'
        },
        'customers': {
            id: 'customers',
            nameEn: 'Customer Khata & Ledgers',
            nameUr: 'گاہک و کھاتہ لیجر',
            icon: 'fa-user-friends',
            url: 'customers.html',
            isCore: true,
            minTier: 'free',
            description: 'Customer credit books, recovery tracker, and PDF ledger share.'
        },
        'stock': {
            id: 'stock',
            nameEn: 'Stock & Inventory Manager',
            nameUr: 'اسٹاک و گودام مینیجر',
            icon: 'fa-boxes-stacked',
            url: 'stock.html',
            isCore: true,
            minTier: 'free',
            description: 'Warehouse items, purchase rates, barcodes, and trade schemes.'
        },
        'booker_orders': {
            id: 'booker_orders',
            nameEn: 'Booker Orders & Dispatch',
            nameUr: 'بکر آرڈرز و ترسیل',
            icon: 'fa-clipboard-check',
            url: 'booker-orders.html',
            isCore: false,
            minTier: 'starter_single',
            description: 'Field order bookers, live booking queue, and dispatch approval.'
        },
        'delivery_returns': {
            id: 'delivery_returns',
            nameEn: 'Delivery & Van Dispatch',
            nameUr: 'وین ڈسپیچ و ترسیل',
            icon: 'fa-truck-loading',
            url: 'delivery-returns.html',
            isCore: false,
            minTier: 'starter_single',
            description: 'Delivery vehicle dispatch, driver load sheet, and return inwards.'
        },
        'claims': {
            id: 'claims',
            nameEn: 'Damage, Expire & Claims',
            nameUr: 'کلیم و زائد المیعاد مال',
            icon: 'fa-triangle-exclamation',
            url: 'delivery-returns.html?tab=claims',
            isCore: false,
            minTier: 'starter_single',
            description: 'Product expiry claims, damaged stock logging and vendor adjustments.'
        },
        'expenses': {
            id: 'expenses',
            nameEn: 'Daily Expenses Register',
            nameUr: 'روزانہ کاروباری اخراجات',
            icon: 'fa-wallet',
            url: 'expenses.html',
            isCore: false,
            minTier: 'starter_single',
            description: 'Track rent, fuel, salaries, vehicle maintenance and petty cash.'
        },
        'alerts': {
            id: 'alerts',
            nameEn: 'Low Stock Alerts & Reorder',
            nameUr: 'کم اسٹاک الرٹس و ری آرڈر',
            icon: 'fa-bell',
            url: 'alerts.html',
            isCore: false,
            minTier: 'starter_single',
            description: 'Smart warehouse warnings, shortage notifications and purchase orders.'
        },
        'reports': {
            id: 'reports',
            nameEn: 'Sales & Business Reports',
            nameUr: 'کاروباری رپورٹس و سیلز',
            icon: 'fa-chart-column',
            url: 'reports.html',
            isCore: false,
            minTier: 'starter_single',
            description: 'Item-wise sales trends, dead stock, top sellers, and Excel export.'
        },
        'profit': {
            id: 'profit',
            nameEn: 'Profit Analytics & COGS',
            nameUr: 'منافع کا تفصیلی تجزیہ',
            icon: 'fa-sack-dollar',
            url: 'profit.html',
            isCore: false,
            minTier: 'starter_single',
            description: 'Gross & net profit analysis, margin percentages, and daily P&L calculations.'
        },
        'owner': {
            id: 'owner',
            nameEn: 'Staff & Bookers Management',
            nameUr: 'اسٹاف و سیلز ٹیم مینیجر',
            icon: 'fa-users',
            url: 'owner.html',
            isCore: false,
            minTier: 'starter_single',
            description: 'Field staff accounts, custom PINs, permissions and device controls.'
        },
        'backup': {
            id: 'backup',
            nameEn: 'Cloud Backup & JSON Restore',
            nameUr: 'بیک اپ و ڈیٹا بحالی',
            icon: 'fa-cloud-arrow-up',
            url: 'backup.html',
            isCore: false,
            minTier: 'starter_single',
            description: 'One-click full business backup snapshots and disaster recovery.'
        },
        'multi_agency': {
            id: 'multi_agency',
            nameEn: 'Multi-Agency Control Hub',
            nameUr: 'ملٹی برانچ کنٹرول ہب',
            icon: 'fa-network-wired',
            url: 'multi-agency.html',
            isCore: false,
            minTier: 'multi_pro',
            description: 'Connect multiple cities, central warehouse sync, and inter-branch transfers.'
        },
        'settings': {
            id: 'settings',
            nameEn: 'Agency Settings & POS',
            nameUr: 'ایجنسی سیٹنگز و پرنٹر',
            icon: 'fa-gear',
            url: 'settings.html',
            isCore: true,
            minTier: 'free',
            description: 'Invoice templates, thermal printer settings, and business profile.'
        }
    };

    // 2️⃣ MASTER SAAS PACKAGES & DEFAULT PRICING
    let SAAS_PACKAGES = {
        'free': {
            id: 'free',
            nameEn: 'Free Starter',
            nameUr: 'مفت بنیادی پیکیج',
            fee: 0,
            badgeColor: '#0284c7',
            tierRank: 0,
            limits: { maxBranches: 1, maxItems: 50, monthlyBills: 150, maxBookers: 1 },
            features: [
                '1 Branch / Store',
                'Up to 50 Stock Items',
                'Up to 150 Monthly Bills',
                'Basic Customer Khata'
            ]
        },
        'starter_single': {
            id: 'starter_single',
            nameEn: 'Single Agency Pro',
            nameUr: 'سنگل ایجنسی پرو',
            fee: 2000,
            badgeColor: '#10b981',
            tierRank: 1,
            limits: { maxBranches: 1, maxItems: 500, monthlyBills: 99999, maxBookers: 3 },
            features: [
                'Unlimited Monthly Invoices',
                'Up to 500 Stock Items',
                '3 Field Order Bookers',
                'Profit & Loss Analytics',
                'Van Dispatch & Returns',
                'Daily Expenses & Reports',
                'Cloud Backup & Low Stock Alerts'
            ]
        },
        'wholesale_dist': {
            id: 'wholesale_dist',
            nameEn: 'Wholesale Distribution Pro',
            nameUr: 'ہول سیل ڈسٹری بیوشن پرو',
            fee: 3500,
            badgeColor: '#f59e0b',
            tierRank: 2,
            limits: { maxBranches: 1, maxItems: 1500, monthlyBills: 99999, maxBookers: 6 },
            features: [
                'All Single Agency Pro Features',
                'Up to 1,500 Stock Items',
                '6 Field Order Bookers',
                'Wholesale Bulk Pricing & Trade Offers',
                'Damage & Vendor Claims Hub'
            ]
        },
        'multi_pro': {
            id: 'multi_pro',
            nameEn: 'Multi-Agency Pro',
            nameUr: 'ملٹی برانچ پرو',
            fee: 5000,
            badgeColor: '#8b5cf6',
            tierRank: 3,
            limits: { maxBranches: 3, maxItems: 3000, monthlyBills: 99999, maxBookers: 12 },
            features: [
                'Up to 3 Connected Branches / Depots',
                'Multi-Agency Comparison & Transfer',
                'Up to 3,000 Stock Items',
                '12 Field Order Bookers',
                'Central Stock Visibility'
            ]
        },
        'enterprise_multi': {
            id: 'enterprise_multi',
            nameEn: 'Enterprise Mega Multi',
            nameUr: 'انٹرپرائز لامحدود پیکیج',
            fee: 10000,
            badgeColor: '#db2777',
            tierRank: 4,
            limits: { maxBranches: 10, maxItems: 99999, monthlyBills: 99999, maxBookers: 50 },
            features: [
                'Up to 10 Branches / Megastores',
                'Unlimited Stock Items & Bills',
                '50 Field Order Bookers',
                'VIP Super Admin Priority Support',
                'Full Custom ERP Permissions'
            ]
        }
    };

    // Sync packages from Firestore if initialized
    async function syncPackagesFromCloud(db) {
        if (!db) return;
        try {
            const snap = await db.collection('packages').get();
            if (!snap.empty) {
                snap.forEach(d => {
                    const data = d.data();
                    if (SAAS_PACKAGES[d.id]) {
                        SAAS_PACKAGES[d.id] = { ...SAAS_PACKAGES[d.id], ...data };
                    } else {
                        SAAS_PACKAGES[d.id] = data;
                    }
                });
            }
        } catch (e) {
            console.warn('SaaS Packages cloud sync:', e.message);
        }
    }

    // 3️⃣ EVALUATE AGENCY SUBSCRIPTION & PACKAGE STATE
    function evaluateAgency(agencyData) {
        if (!agencyData) {
            return {
                tier: 'free',
                isPaid: false,
                isExpired: false,
                isSuspended: false,
                daysLeft: 0,
                expiry: '2026-12-31',
                fee: 0,
                name: 'My Business'
            };
        }

        const pkgId = agencyData.packageId || 'free';
        const isPaid = pkgId !== 'free';
        const expiry = agencyData.subscriptionExpiry || agencyData.expiryDate || '2026-12-31';
        const todayStr = new Date().toISOString().slice(0, 10);
        const isSuspended = agencyData.status === 'suspended' || agencyData.isSuspended === true;

        let isExpired = false;
        let daysLeft = 0;

        if (isPaid && expiry) {
            isExpired = expiry < todayStr;
            const diffTime = new Date(expiry).getTime() - new Date(todayStr).getTime();
            daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        return {
            tier: pkgId,
            isPaid,
            isExpired,
            isSuspended,
            daysLeft: Math.max(0, daysLeft),
            expiry,
            fee: Number(agencyData.monthlyFee !== undefined ? agencyData.monthlyFee : (SAAS_PACKAGES[pkgId] ? SAAS_PACKAGES[pkgId].fee : 0)),
            name: agencyData.name || 'My Business'
        };
    }

    // 4️⃣ MODULE ACCESS & LOCK CHECK LOGIC
    function checkModuleAccess(moduleId, agencyData, userRole, customPermissions) {
        // Super Admin always has full access
        if (userRole === 'super-admin') {
            return {
                allowed: true,
                locked: false,
                reason: 'super_admin',
                badgeText: '',
                module: MODULES[moduleId] || { id: moduleId, nameEn: moduleId, nameUr: moduleId }
            };
        }

        const mod = MODULES[moduleId] || {
            id: moduleId,
            nameEn: moduleId,
            nameUr: moduleId,
            isCore: false,
            minTier: 'starter_single'
        };

        const state = evaluateAgency(agencyData);

        // A. If Account is Suspended
        if (state.isSuspended) {
            return {
                allowed: false,
                locked: true,
                reason: 'suspended',
                badgeText: 'SUSPENDED',
                lockReasonUr: 'آپ کا اکاؤنٹ عارضی طور پر سسپنڈ ہے',
                module: mod
            };
        }

        // A2. Master 1-Click Unlock for Agency or Super Admin Bypass
        if (agencyData && (agencyData.allModulesUnlocked === true || agencyData.unlockAll === true || agencyData.packageId === 'enterprise_multi')) {
            return {
                allowed: true,
                locked: false,
                reason: 'master_unlocked',
                badgeText: '',
                module: mod
            };
        }

        // B. Check Explicit Permissions Toggle (if admin unlocked or locked)
        if (customPermissions && typeof customPermissions === 'object') {
            const permKey = moduleId === 'delivery_returns' || moduleId === 'claims' ? 'delivery_returns' : moduleId;
            if (customPermissions[permKey] === false) {
                return {
                    allowed: false,
                    locked: true,
                    reason: 'admin_locked',
                    badgeText: 'LOCKED',
                    lockReasonUr: 'یہ ماڈیول ایڈمن کی طرف سے لاک کیا گیا ہے',
                    module: mod
                };
            }
            // If explicitly allowed in permissions, grant access immediately!
            if (customPermissions[permKey] === true || customPermissions['all'] === true) {
                return {
                    allowed: true,
                    locked: false,
                    reason: 'permission_granted',
                    badgeText: '',
                    module: mod
                };
            }
        }

        // C. Check Expiry (Fee Unpaid / Package Ended)
        if (state.isExpired) {
            // Core basic modules (Dashboard, Bills, Customers, basic stock, settings) remain accessible
            // Non-core / Premium modules are LOCKED with prominent 🔒 Lock Badge!
            if (!mod.isCore) {
                return {
                    allowed: false,
                    locked: true,
                    reason: 'package_expired',
                    badgeText: 'PRO',
                    lockReasonUr: 'پیکیج کی مدت ختم ہو چکی ہے (فیس ادا کریں)',
                    module: mod
                };
            }
        }

        // D. Check Package Tier Requirement (e.g. Free Tier trying to access Pro / Multi)
        const currentRank = (SAAS_PACKAGES[state.tier] && SAAS_PACKAGES[state.tier].tierRank !== undefined)
            ? SAAS_PACKAGES[state.tier].tierRank
            : (state.tier === 'free' ? 0 : 1);

        const requiredRank = (SAAS_PACKAGES[mod.minTier] && SAAS_PACKAGES[mod.minTier].tierRank !== undefined)
            ? SAAS_PACKAGES[mod.minTier].tierRank
            : (mod.minTier === 'multi_pro' ? 3 : 1);

        if (!mod.isCore && currentRank < requiredRank) {
            return {
                allowed: false,
                locked: true,
                reason: 'tier_required',
                badgeText: 'PRO',
                lockReasonUr: requiredRank >= 3 ? 'اس کے لیے Multi-Agency Pro پیکیج درکار ہے' : 'اس کے لیے Pro پیکیج درکار ہے',
                requiredTier: mod.minTier,
                module: mod
            };
        }

        // Allowed!
        return {
            allowed: true,
            locked: false,
            reason: 'ok',
            badgeText: '',
            module: mod
        };
    }

    // 5️⃣ RICH INTERACTIVE UPGRADE / FEE PAYMENT MODAL
    async function showUpgradeModal(moduleId, agencyData, userProfile) {
        const mod = MODULES[moduleId] || {
            id: moduleId,
            nameEn: 'Premium Feature',
            nameUr: 'پریمیم فیچر',
            icon: 'fa-lock',
            description: 'Advanced wholesale feature.'
        };

        const state = evaluateAgency(agencyData);
        const access = checkModuleAccess(moduleId, agencyData, userProfile ? userProfile.role : 'owner', agencyData ? agencyData.permissions : null);

        let headlineUr = '🔒 یہ فیچر لاک ہے — پیکیج ایکٹیویٹ کریں';
        let detailUr = 'اس ماڈیول کو استعمال کرنے کے لیے مطلوبہ پیکیج ایکٹیو کروائیں یا ماہانہ فیس ادا کریں۔';

        if (access.reason === 'package_expired') {
            headlineUr = '⚠️ پیکیج ختم ہو چکا ہے (فیس ادا کریں)';
            detailUr = `آپ کا <b>${(SAAS_PACKAGES[state.tier] || {}).nameEn || state.tier.toUpperCase()}</b> پیکیج ختم ہو چکا ہے۔ ماہانہ فیس ادا کر کے سروس فوری طور پر بحال کروائیں تاکہ آپ کے تمام پریمیم فیچرز ان لاک ہو سکیں۔`;
        } else if (access.reason === 'tier_required') {
            headlineUr = '⭐ پریمیم فیچر (پیکیج اپ گریڈ کریں)';
            detailUr = `یہ فیچر موجودہ <b>${(SAAS_PACKAGES[state.tier] || {}).nameEn || 'Free'}</b> پیکیج میں شامل نہیں ہے۔ نیچے دیے گئے پیکیجز میں سے انتخاب کر کے اپ گریڈ کریں۔`;
        } else if (access.reason === 'admin_locked') {
            headlineUr = '🔒 سپر ایڈمن لاک';
            detailUr = 'یہ ماڈیول سپر ایڈمن کی طرف سے آف کیا گیا ہے۔ براہ کرم سپر ایڈمن سے رابطہ کر کے اس کو ان لاک کروائیں۔';
        }

        // Prepare Packages Grid HTML
        let pkgGridHtml = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:10px; margin:16px 0; text-align:left;">
        `;

        for (const [pId, p] of Object.entries(SAAS_PACKAGES)) {
            if (pId === 'free') continue; // Don't show free in upgrade options
            const isCurrent = state.tier === pId && !state.isExpired;
            const lim = p.limits || {};
            const billsText = (lim.monthlyBills && lim.monthlyBills >= 90000) ? 'لامحدود (Unlimited Bills)' : `${(lim.monthlyBills || 150).toLocaleString()} Bills/mo`;
            const itemsText = (lim.maxItems && lim.maxItems >= 90000) ? 'لامحدود (Unlimited Items)' : `${(lim.maxItems || 50).toLocaleString()} Items`;
            const bookersText = `${lim.maxBookers || 1} Order Booker${(lim.maxBookers || 1) > 1 ? 's' : ''}`;
            const branchesText = `${lim.maxBranches || 1} Branch${(lim.maxBranches || 1) > 1 ? 'es' : ''}`;

            pkgGridHtml += `
            <div style="border:1.5px solid ${isCurrent ? '#10b981' : '#cbd5e1'}; border-radius:12px; padding:12px; background:${isCurrent ? '#f0fdf4' : '#fff'}; position:relative; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                ${isCurrent ? '<span style="position:absolute; top:8px; right:8px; font-size:9.5px; background:#10b981; color:#fff; padding:2px 6px; border-radius:10px; font-weight:800;">ACTIVE</span>' : ''}
                <div style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:2px;">${p.nameEn}</div>
                <div style="font-size:11px; color:#64748b; margin-bottom:6px;">${p.nameUr || ''}</div>
                <div style="font-size:18px; font-weight:900; color:#0284c7; margin-bottom:8px;">
                    Rs ${Number(p.fee || 0).toLocaleString()} <span style="font-size:11px; font-weight:normal; color:#64748b;">/ mo</span>
                </div>
                
                <!-- Package Limits Grid -->
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:6px 8px; margin-bottom:8px; font-size:10.5px; color:#334155; line-height:1.5;">
                    <div>📄 <b>بلز لمٹ:</b> <span style="color:#0284c7; font-weight:700;">${billsText}</span></div>
                    <div>📦 <b>آئٹم لمٹ:</b> <span style="color:#059669; font-weight:700;">${itemsText}</span></div>
                    <div>👥 <b>بکر لمٹ:</b> <span style="color:#d97706; font-weight:700;">${bookersText}</span></div>
                    <div>🏢 <b>برانچز:</b> <span style="color:#6366f1; font-weight:700;">${branchesText}</span></div>
                </div>

                <ul style="font-size:11px; color:#475569; padding-left:16px; margin:0 0 6px 0; line-height:1.35;">
                    ${(p.features || []).slice(0, 3).map(f => `<li>${f}</li>`).join('')}
                </ul>
            </div>
            `;
        }
        pkgGridHtml += '</div>';

        const developerWhatsAppHtml = `
        <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:12px; padding:12px 14px; margin:12px 0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; text-align:left;">
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:42px; height:42px; border-radius:50%; background:#25D366; color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; box-shadow:0 3px 8px rgba(37,211,102,0.3);">
                    <i class="fab fa-whatsapp"></i>
                </div>
                <div>
                    <div style="font-size:12px; font-weight:800; color:#14532d;">ڈویلپر واٹس ایپ رابطہ (Developer Contact):</div>
                    <div style="font-size:16px; font-weight:900; color:#16a34a; letter-spacing:0.5px;">+923346800959</div>
                    <div style="font-size:11px; color:#64748b;">پیکیج لمٹس کم/زیادہ کرنے، تجدید اور کسٹم فیچرز کے لیے فوری رابطہ کریں</div>
                </div>
            </div>
            <a href="https://wa.me/923346800959?text=${encodeURIComponent(`السلام علیکم ڈویلپر صاحب!\nمیری ایجنسی: *${state.name}*\nموجودہ پیکیج: *${state.tier}*\nمجھے پیکیج کی قیمت یا بلز/بکرز/آئٹم لمٹ کے بارے میں رابطہ کرنا ہے۔`)}" target="_blank" style="background:#25D366; color:#fff; font-size:13px; font-weight:800; padding:8px 16px; border-radius:8px; text-decoration:none; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(37,211,102,0.35);">
                <i class="fab fa-whatsapp"></i> Chat WhatsApp
            </a>
        </div>
        `;

        const modalHtml = `
        <div style="text-align:center; font-family:'Segoe UI', Tahoma, sans-serif; padding:4px;">
            <div style="display:inline-flex; width:64px; height:64px; border-radius:50%; background:#fef3c7; color:#d97706; font-size:28px; align-items:center; justify-content:center; margin-bottom:12px; box-shadow:0 4px 12px rgba(217, 119, 6, 0.2);">
                <i class="fas ${mod.icon}"></i>
            </div>
            <h3 style="margin:0 0 4px 0; font-size:20px; font-weight:800; color:#0f172a;">
                ${mod.nameEn} <span style="font-size:16px; color:#64748b;">(${mod.nameUr})</span>
            </h3>
            <div style="display:inline-block; margin-bottom:12px; padding:3px 10px; background:#fee2e2; color:#b91c1c; border-radius:12px; font-size:12px; font-weight:800;">
                ${headlineUr}
            </div>
            <p style="font-size:13px; color:#475569; line-height:1.6; margin:0 0 8px 0;">
                ${detailUr}
            </p>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px; font-size:12px; color:#334155; margin-bottom:8px; text-align:left;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>🏢 Agency: <b>${state.name}</b></span>
                    <span>Status: <b style="color:${state.isExpired ? '#ef4444' : '#10b981'};">${state.isExpired ? 'EXPIRED' : state.tier.toUpperCase()}</b></span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span>📅 Valid Till: <b>${state.expiry}</b></span>
                    <span>💵 Current Fee: <b>Rs ${state.fee.toLocaleString()}</b></span>
                </div>
            </div>

            <!-- Developer WhatsApp Banner -->
            ${developerWhatsAppHtml}

            <div style="font-size:13px; font-weight:800; color:#0f172a; margin-top:10px; text-align:left;">
                💼 دستیاب پیکیجز، فیس اور لمٹس (Available Packages & Limits):
            </div>
            ${pkgGridHtml}

            <div style="background:#e0f2fe; border:1px solid #bae6fd; border-radius:10px; padding:10px; font-size:12px; color:#0369a1; text-align:left; margin-top:6px;">
                💡 <b>نوٹ:</b> سپر ایڈمن کسی بھی پیکیج کے بلز، آرڈر بکر، اور آئٹم لمٹس اور فیس میں حسب ضرورت اضافہ یا کمی کر سکتا ہے۔
            </div>
        </div>
        `;

        if (typeof Swal === 'undefined') {
            alert(`${mod.nameEn} is locked. Contact Super Admin to upgrade.`);
            return;
        }

        const res = await Swal.fire({
            html: modalHtml,
            width: '680px',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '<i class="fab fa-whatsapp"></i> واٹس ایپ ڈویلپر (+923346800959)',
            confirmButtonColor: '#25D366',
            denyButtonText: '<i class="fas fa-paper-plane"></i> اپ گریڈ درخواست بھیجیں',
            denyButtonColor: '#0284c7',
            cancelButtonText: 'بند کریں (Close)',
            cancelButtonColor: '#64748b'
        });

        // 🟢 ACTION 1: WHATSAPP DEVELOPER (+923346800959)
        if (res.isConfirmed) {
            const agencyName = state.name;
            const message = encodeURIComponent(
                `السلام علیکم ڈویلپر صاحب!\n\n` +
                `میری ایجنسی: *${agencyName}*\n` +
                `اکاؤنٹ اسٹیٹس: *${state.isExpired ? 'Expired' : state.tier}*\n` +
                `ماڈیول یا پیکیج لمٹ اپ گریڈ درکار ہے: *${mod.nameEn} (${mod.nameUr})*\n\n` +
                `براہ کرم فیس اور پیکیج ایکٹیویشن کی معلومات فراہم فرمائیں۔ شکریہ!`
            );
            const developerPhone = '923346800959';
            window.open(`https://wa.me/${developerPhone}?text=${message}`, '_blank');
        }

        // 🔵 ACTION 2: SEND IN-APP UPGRADE REQUEST
        if (res.isDenied) {
            await submitUpgradeRequest(mod, state, agencyData, userProfile);
        }
    }

    // 6️⃣ SUBMIT UPGRADE REQUEST TO FIRESTORE
    async function submitUpgradeRequest(mod, state, agencyData, userProfile) {
        const { value: reqData } = await Swal.fire({
            title: '📩 فیس ادائیگی یا اپ گریڈ درخواست',
            html: `
                <div style="text-align:left; font-size:13px;">
                    <label><b>مطلوبہ پیکیج منتخب کریں (Select Target Package):</b></label>
                    <select id="reqPkgSelect" class="swal2-input" style="margin-top:4px; margin-bottom:12px;">
                        <option value="starter_single">🏪 Single Agency Pro (Rs. 2,000 / mo)</option>
                        <option value="wholesale_dist">📦 Wholesale Distribution Pro (Rs. 3,500 / mo)</option>
                        <option value="multi_pro">🏢 Multi-Agency Pro (Rs. 5,000 / mo)</option>
                        <option value="enterprise_multi">👑 Enterprise Mega Multi (Rs. 10,000 / mo)</option>
                    </select>

                    <label><b>ادائیگی کی رسید یا Trx ID (Payment Reference / Note):</b></label>
                    <input type="text" id="reqTrxId" class="swal2-input" placeholder="e.g. JazzCash / EasyPaisa Trx ID یا نوٹ" style="margin-top:4px;">
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '✅ درخواست بھیجیں (Submit)',
            confirmButtonColor: '#10b981',
            preConfirm: () => {
                return {
                    packageId: document.getElementById('reqPkgSelect').value,
                    trxId: (document.getElementById('reqTrxId').value || '').trim()
                };
            }
        });

        if (reqData) {
            Swal.fire({ title: 'درخواست بھیجی جا رہی ہے...', didOpen: () => Swal.showLoading() });
            try {
                if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
                    const db = firebase.firestore();
                    const agencyId = (agencyData && agencyData.id) || localStorage.getItem('eb_active_agencyId') || 'unknown';

                    await db.collection('upgradeRequests').add({
                        agencyId: agencyId,
                        agencyName: state.name,
                        userEmail: (userProfile && userProfile.email) || 'unknown',
                        currentTier: state.tier,
                        requestedPackageId: reqData.packageId,
                        paymentNote: reqData.trxId,
                        requestedModule: mod.id,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    });

                    Swal.fire({
                        icon: 'success',
                        title: '🎉 درخواست کامیابی سے بھیج دی گئی!',
                        html: `سپر ایڈمن کو آپ کی اپ گریڈ درخواست موصول ہو گئی ہے۔ جیسے ہی فیس تصدیق ہو گی، آپ کا ماڈیول <b>${mod.nameEn}</b> فوری طور پر ان لاک ہو جائے گا۔`
                    });
                } else {
                    Swal.fire('درخواست محفوظ ہو گئی!', 'سپر ایڈمن جلد رابطہ کرے گا۔', 'success');
                }
            } catch (e) {
                console.error('Submit request error:', e);
                Swal.fire('Error', 'درخواست بھیجنے میں مسئلہ: ' + e.message, 'error');
            }
        }
    }

    // 7️⃣ PAGE-LEVEL PAYWALL OVERLAY FOR DIRECT NAVIGATION
    function enforcePagePaywall(moduleId, containerSelector, agencyData, userRole, profile) {
        const access = checkModuleAccess(moduleId, agencyData, userRole, agencyData ? agencyData.permissions : null);
        if (access.allowed) return false; // Not locked, proceed normally

        const targetContainer = document.querySelector(containerSelector || '.panel-container, .dashboard-container, .vyapar-container, main, body');
        if (!targetContainer) return true;

        const mod = access.module;
        const state = evaluateAgency(agencyData);

        const overlay = document.createElement('div');
        overlay.id = 'ebPageLockOverlay';
        overlay.style.cssText = `
            background: #fff;
            border: 2px solid #f59e0b;
            border-radius: 16px;
            padding: 35px 25px;
            max-width: 680px;
            margin: 30px auto;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            font-family: 'Segoe UI', Tahoma, sans-serif;
        `;

        overlay.innerHTML = `
            <div style="font-size: 55px; margin-bottom: 12px;">🔒</div>
            <h2 style="color: #0f172a; margin: 0 0 6px 0; font-size: 24px; font-weight: 900;">
                ${mod.nameEn} Locked
            </h2>
            <h4 style="color: #d97706; margin: 0 0 12px 0; font-size: 16px;">
                ${access.lockReasonUr || 'یہ ماڈیول لاک ہے'}
            </h4>
            <p style="color: #64748b; font-size: 13.5px; line-height: 1.6; max-width: 520px; margin: 0 auto 20px;">
                اس ماڈیول (<b>${mod.nameUr}</b>) کو استعمال کرنے کے لیے آپ کا پیکیج فعال ہونا ضروری ہے۔ 
                اگر آپ کا پیکیج ختم ہو چکا ہے تو ماہانہ فیس ادا کر کے یا سپر ایڈمن سے رابطہ کر کے فوری ان لاک کروائیں۔
            </p>

            <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap; margin-bottom: 20px;">
                <button type="button" id="ebOverlayUpgradeBtn" style="background: #10b981; color: #fff; border: none; padding: 12px 22px; border-radius: 10px; font-weight: bold; cursor: pointer; font-size: 14px; display:inline-flex; align-items:center; gap:8px;">
                    <i class="fas fa-unlock"></i> View Packages &amp; Unlock
                </button>
                <a href="https://wa.me/923346800959?text=${encodeURIComponent(`Assalam-o-Alaikum! Please unlock ${mod.nameEn} for agency: ${state.name}`)}" target="_blank" style="background: #25D366; color: #fff; border: none; padding: 12px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; font-size: 14px; display:inline-flex; align-items:center; gap:8px; text-decoration:none;">
                    <i class="fab fa-whatsapp"></i> WhatsApp (+923346800959)
                </a>
                <button type="button" onclick="window.location.href='dashboard.html'" style="background: #0f172a; color: #fff; border: none; padding: 12px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; font-size: 14px; display:inline-flex; align-items:center; gap:8px;">
                    <i class="fas fa-home"></i> Dashboard
                </button>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 12px; color: #64748b; max-width: 480px; margin: 0 auto;">
                Agency: <b>${state.name}</b> &nbsp;|&nbsp; Current Status: <b style="color:${state.isExpired ? '#ef4444' : '#0284c7'};">${state.isExpired ? 'EXPIRED' : state.tier.toUpperCase()}</b>
                &nbsp;|&nbsp; Developer: <b style="color:#16a34a;">+923346800959</b>
            </div>
        `;

        targetContainer.innerHTML = '';
        targetContainer.appendChild(overlay);

        document.getElementById('ebOverlayUpgradeBtn').addEventListener('click', () => {
            showUpgradeModal(moduleId, agencyData, profile);
        });

        return true;
    }

    // 8️⃣ EXPOSE GLOBALLY
    window.SaaSModules = {
        MODULES,
        SAAS_PACKAGES,
        evaluateAgency,
        checkModuleAccess,
        showUpgradeModal,
        submitUpgradeRequest,
        enforcePagePaywall,
        syncPackagesFromCloud
    };
})();
