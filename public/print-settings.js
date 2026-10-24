// ==========================================================================
// 🎨 EASY BILL GENERATOR — PRINT SETTINGS & CHECKBOX CONTROLS ENGINE
// Allows setting agency-level and user-level checkboxes for print fields
// and manages package-based allowed templates.
// ==========================================================================

const DEFAULT_PRINT_SETTINGS = {
    // Agency Header Elements
    showLogo: true,
    showAgencyName: true,
    showOwnerName: true,
    showMobiles: true,
    showAddress: true,
    showCity: true,
    showNTN: true,
    showLicence: true,
    showPayType: true,

    // Bill Meta & Dispatch
    showBillNo: true,
    showDate: true,
    showTime: true,
    showBookerName: true,
    showSupplierName: true,
    showRouteName: true,
    showDeliveryMan: true,

    // Customer Elements
    showCustomerName: true,
    showCustomerPhone: true,
    showCustomerAddress: true,
    showCustomerNTN: true,
    showCustomerRoute: true,
    showCustomerFbrStatus: true,

    // Items Table Columns
    showItemSno: true,
    showItemName: true,
    showItemPack: false,
    showItemQty: true,
    showItemRate: true,
    showItemDiscount: false,
    showItemTotal: true,

    // Totals Section & FBR Tax
    showSubTotal: true,
    showDiscount: true,
    showTax: true,
    showGrandTotal: true,
    showPreviousBalance: true,
    showReceivedAmount: true,
    showBalance: true,

    // Footer Elements
    showThankYouNote: true,
    showTermsAndConditions: true,
    showSignatureAuthorized: true,
    showSignatureCustomer: true,
    showSignatureBooker: true,
    showAppWatermark: false,
    thermalWidth: '80' // Default: 80mm standard desktop POS
};

// Available Templates Catalog
const BILL_TEMPLATES_CATALOG = [
    {
        id: 'template8',
        name: '🇵🇰 Classic Wholesale Urdu Grid (Legal Half-Cut 8.5"x7")',
        desc: 'Authentic Pakistani wholesale market grid with Ctn/Box count, Sabqa/Mojooda Baqaya, Booker, Route & FBR NTN (Legal 2-Half Page)',
        recommended: true
    },
    {
        id: 'template7',
        name: '📦 FMCG Corporate Distribution Invoice (A4 Standard)',
        desc: 'Market standard corporate dispatch invoice with Carton Size, Trade Offer, Tax breakdown & SDR/Credit Balance',
        recommended: true
    },
    {
        id: 'template4',
        name: '⚡ Modern Minimal / Table Invoice (Clean English)',
        desc: 'Sleek corporate header with auto-scaling shop title and clean table layout',
        recommended: true
    },
    {
        id: 'template1',
        name: '🇵🇰 Urdu Classic (Nastaliq)',
        desc: 'Traditional high-contrast layout in beautiful Urdu Nastaliq font',
        recommended: false
    },
    {
        id: 'template2',
        name: '📋 Traders English (Big Header)',
        desc: 'Bold header for wholesale distributors and bulk commercial traders',
        recommended: false
    },
    {
        id: 'template3',
        name: '🇵🇰 Urdu + English Mix',
        desc: 'Bilingual header and field names for general retail and wholesale shops',
        recommended: false
    },
    {
        id: 'template5',
        name: '💎 Premium Full (All Boxes)',
        desc: 'Comprehensive invoice with pack sizes, bonus units, and dual signatures',
        recommended: false
    },
    {
        id: 'template6',
        name: '🧾 Thermal POS Slip (58mm / 80mm)',
        desc: 'Compact POS receipt format designed for fast thermal receipt printers',
        recommended: false
    }
];

// Read settings from Agency object or localStorage fallback
function getEffectivePrintSettings(agency, userSettings) {
    const base = { ...DEFAULT_PRINT_SETTINGS };
    let localSaved = {};
    try {
        const raw = localStorage.getItem('eb_print_settings');
        if (raw) localSaved = JSON.parse(raw);
    } catch (e) {}

    const agencyCustom = (agency && agency.printSettings) ? agency.printSettings : {};
    const userCustom = (userSettings && userSettings.printSettings) ? userSettings.printSettings : {};

    return {
        ...base,
        ...localSaved,
        ...agencyCustom,
        ...userCustom
    };
}

// Check which templates are allowed for the current agency based on package
function getAllowedTemplatesForPackage(packageId, customAllowedTemplates) {
    if (Array.isArray(customAllowedTemplates) && customAllowedTemplates.length > 0) {
        return customAllowedTemplates;
    }
    const pkg = String(packageId || 'free').toLowerCase();
    if (pkg === 'pro') {
        return ['template4', 'template1', 'template2', 'template3', 'template5', 'template6', 'template7', 'template8'];
    }
    if (pkg === 'basic') {
        return ['template4', 'template1', 'template2', 'template6', 'template7', 'template8'];
    }
    // Free default allows standard modern minimal, Urdu classic & Urdu Grid
    return ['template4', 'template1', 'template8'];
}

window.ebPrintEngine = {
    DEFAULT_PRINT_SETTINGS,
    BILL_TEMPLATES_CATALOG,
    getEffectivePrintSettings,
    getAllowedTemplatesForPackage
};
