# 📋 EASY BILL GENERATOR — MASTER SAAS ROADMAP & SPECIFICATION

This file serves as the persistent system specification for the Easy Bill Generator SaaS platform.

---

## 1. 🏢 Multi-Tenant & SaaS Architecture
- **Super Admin Panel (`admin.html`)**:
  - Manages Agencies / Shops.
  - Package Management (Free, Starter, Pro, Enterprise).
  - Module permission matrix per package (Stock, Dual Bills, Ledgers, Reports, Bookers, Custom Templates).
  - Price & subscription expiry tracking.
  - Ability to override specific modules or extra fields for a particular agency.

- **Agency Admin (`dashboard.html`, `owner.html`, `profile.html`)**:
  - Store identity, logo, address, NTN/STRN, custom invoice notes.
  - Order Booker management with unique Booker IDs, target limits, and commission logs.
  - Bill Design Selector & Customizer:
    - Choose template design.
    - Checkbox configuration of print fields (e.g. Show Booker Name, Customer Phone, Previous Balance, Discount, Tax, Barcode, Signature, Due Date).
    - Set agency-wide default template.
    - Assign user/booker specific default template overrides.

- **Order Booker (`bills.html`, `stock.html`)**:
  - Mobile-first quick billing on the go.
  - Role-based permissions preventing unauthorized discounts or cost views.
  - Offline sync when booking in field/remote areas.

---

## 2. 🧾 Bill Designs & Dynamic Template Engine
- **Multiple Invoice Templates**:
  - Thermal 58mm / 80mm POS slip.
  - A4 / A5 Standard GST & Non-GST corporate invoice.
  - Wholesaler Ledger Invoice (showing previous balance, current bill, cash received, new balance).
  - Distribution / Order Booker delivery challan.
  - Compact Urdu/English bilingual invoice.
- **Dynamic Field & Box Toggles (Print Control Matrix)**:
  - Header: Agency Logo, Agency Name, Phone, Address, NTN/STRN, Invoice No, Date, Time.
  - Customer Info: Name, Phone, Address, Area/Route, Khata No.
  - Sales Staff: Booker Name, Salesman Code, Vehicle/Route No.
  - Item Table Columns: S.No, Item Name, Urdu Name, Unit, Qty, Rate, Discount %, Tax %, Total.
  - Summary: Subtotal, Total Items, Total Qty, Overall Discount, Freight/Delivery, Tax, Previous Balance, Net Payable, Cash Received, Remaining Balance.
  - Footer: Terms & Conditions, Return Policy, Bank Account / Easypaisa details, Barcode / QR Code, Signatures.
- **Default Dropdown & Profile Save**:
  - Global default template dropdown in Business Profile / Settings.
  - Checkbox matrix where unchecking a field hides it both on preview and thermal/PDF print.

---

## 3. 🌐 Offline-First & Hybrid Sync
- IndexedDB / localStorage for local queueing of bills and stock adjustments.
- Service Worker (`sw.js`) caching assets for zero-latency mobile execution.
- Real-time Firestore sync when online, conflict resolution with timestamp priority.

---

## 4. 📊 Reports, User Management & Backups
- Sales reports by date, customer, product, and order booker.
- Automated & manual backups (Daily, Weekly, Monthly JSON/CSV export and restore).
- Comprehensive Firestore security rules ensuring strict multi-tenant isolation.
