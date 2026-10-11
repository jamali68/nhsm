// ==========================================================================
// 🏢 EASY BILL GENERATOR — BUSINESS CATEGORY & INDUSTRY REGISTRY (v1.0)
// 
// 🎯 MODULAR & PLUG-AND-PLAY ARCHITECTURE:
// - Har category ka apna alag, mukammal config object hai.
// - Agar kisi category par kaam chal raha ho aur beech mein nayi category par
//   kaam karna ho, to sirf 'status' ya config badal kar ba-asani switch kiya ja sakta hai.
// - Nayi category add karne ke liye sirf 1 naya object shamil karein — baqi code mehfooz rahega!
// ==========================================================================

const BUSINESS_CATEGORIES = [
    {
        id: 'books',
        aliasIds: ['book_depot', 'stationery', 'book_points'],
        nameEn: 'Book Depot & Stationery (Book Points)',
        nameUr: 'بک ڈپو، اسٹیشنری و بک پوائنٹ (کتب و کاپیاں)',
        icon: '📚',
        status: 'active', // 'active' | 'in_development' | 'queued'
        description: 'Textbooks, notebooks, guides, pens, school bags, art & office stationery',
        subcategories: [
            'درسی و اسکول کتب (Syllabus & Textbooks)',
            'گائیڈز، ماڈل پیپرز و حل شدہ پرچے (Keybooks & Guides)',
            'رجسٹر و اسکول کاپیاں (Registers & Notebooks)',
            'بال پین، مارکرز، پینسلز و اسٹیشنری (Stationery, Pens & Pencils)',
            'اسکول بیگز و جیومیٹری باکسز (School Bags & Geometry Boxes)',
            'آرٹ، چارٹس، شیٹس و کلرز (Art, Charts & Craft)',
            'آفس فائلز، ڈائریز و لفافے (Office Files, Diaries & Envelopes)',
            'اسلامی کتب، ناولز و عمومی کتابیں (Islamic & General Books)',
            'یونیفارم بیجز، ٹائیاں و اسکول سامان (Uniform Badges & Accessories)'
        ],
        units: ['unit', 'pcs', 'dozen', 'packet', 'box', 'set', 'bundle', 'carton'],
        customFields: [
            { id: 'classGrade', label: 'کلاس / جماعت (Class / Grade)', placeholder: 'مثلاً: 9th, 10th, 1st Year, KG, 5th', type: 'text' },
            { id: 'publisherBoard', label: 'پبلشر / تعلیمی بورڈ (Publisher / Board)', placeholder: 'مثلاً: Punjab Board, Oxford, Caravan, Ilmi', type: 'text' },
            { id: 'subjectAuthor', label: 'مضمون / مصنف (Subject / Author)', placeholder: 'مثلاً: English, Urdu, Math, Physics', type: 'text' },
            { id: 'editionYear', label: 'ایڈیشن / سال (Edition / Year)', placeholder: 'مثلاً: 2026 Edition', type: 'text' }
        ],
        quickTags: ['درسی کتب', 'کاپیاں', 'اسٹیشنری', 'گائیڈز', 'رجسٹر']
    },
    {
        id: 'mobile',
        aliasIds: ['mobile_shop', 'mobile_accessories'],
        nameEn: 'Mobile Shop & Accessories',
        nameUr: 'موبائل شاپ و ایسیسریز',
        icon: '📱',
        status: 'active',
        description: 'Smartphones, covers, chargers, handsfree, screen protectors, cables',
        subcategories: [
            'اسمارٹ فونز (Smartphones / Box Packed)',
            'استعمال شدہ فونز (Used / Second Hand Mobiles)',
            'چارجرز، اڈاپٹرز و کیبلز (Chargers & Cables)',
            'ہینڈز فری، ایئربڈز و ہیڈ فونز (Handsfree & Earbuds)',
            'موبائل کورز و پاؤچز (Mobile Covers & Pouches)',
            'اسکرین پروٹیکٹرز و گلاس (Screen Protectors)',
            'پاور بینکس (Power Banks)',
            'موبائل اسپیئر پارٹس (Spare Parts & Displays)',
            'موبائل ریپئرنگ و ٹولز (Repairing Tools)'
        ],
        units: ['unit', 'pcs', 'box', 'carton'],
        customFields: [
            { id: 'imeiSerial', label: 'IMEI / Serial Number', placeholder: 'IMEI 1 / Serial', type: 'text' },
            { id: 'modelVariant', label: 'ماڈل / ویرینٹ (Model / RAM / Storage)', placeholder: 'e.g. 8GB/128GB - Blue', type: 'text' },
            { id: 'ptaStatus', label: 'PTA Status', placeholder: 'PTA Approved / Non-PTA', type: 'select', options: ['PTA Approved', 'Non-PTA', 'JV / Non-Active'] }
        ],
        quickTags: ['Smartphones', 'Accessories', 'Chargers', 'Earbuds', 'Covers']
    },
    {
        id: 'medical',
        aliasIds: ['pharmacy', 'medical_store'],
        nameEn: 'Medical Store & Pharmacy',
        nameUr: 'میڈیکل اسٹور و فارمیسی',
        icon: '💊',
        status: 'active',
        description: 'Medicines, syrups, tablets, injections, surgical items, baby food',
        subcategories: [
            'ٹیبلٹس و کیپسولز (Tablets & Capsules)',
            'سیرپس و سسپنشنز (Syrups & Suspensions)',
            'انجیکشنز و ڈرپس (Injections & IV Fluids)',
            'مرہم و کریمیں (Ointments & Creams)',
            'سرجیکل و ڈسپوزیبل آئٹمز (Surgical & Gloves)',
            'بے بی کیئر و ڈائپرز (Baby Care & Diapers)',
            'میڈیکل آلات (BP Apparatus, Glucometers)',
            'فوڈ سپلیمنٹس و وٹامنز (Vitamins & Supplements)'
        ],
        units: ['box', 'packet', 'pcs', 'bottle', 'carton', 'unit'],
        customFields: [
            { id: 'batchNo', label: 'بیچ نمبر (Batch No)', placeholder: 'e.g. B-94821', type: 'text' },
            { id: 'expiryDate', label: 'ایکسپائری تاریخ (Expiry Date)', placeholder: 'YYYY-MM-DD', type: 'date' },
            { id: 'genericFormula', label: 'فارمولا / جنیرک (Formula / Generic)', placeholder: 'e.g. Paracetamol 500mg', type: 'text' }
        ],
        quickTags: ['Tablets', 'Syrups', 'Surgical', 'Baby Care']
    },
    {
        id: 'shoes',
        aliasIds: ['shoe_store', 'footwear'],
        nameEn: 'Shoe Store & Footwear',
        nameUr: 'جوتے و فٹ ویئر (شوز اسٹور)',
        icon: '👟',
        status: 'active',
        description: 'Men, women, kids shoes, sandals, slippers, joggers, leather boots',
        subcategories: [
            'مردانہ جوتے (Men Formal & Casual)',
            'زنانہ جوتے و سینڈلز (Women Heels & Flats)',
            'بچوں کے جوتے (Kids Footwear)',
            'جاگرز و اسپورٹس شوز (Joggers & Sports)',
            'چمڑے کے کھسے و پشاوری چپل (Traditional & Peshawari)',
            'سلیپرز و فلپ فلاپس (Slippers & Chappal)',
            'شوز پالش، موزے و ایسیسریز (Polish, Socks & Laces)'
        ],
        units: ['pair', 'unit', 'box', 'dozen', 'carton'],
        customFields: [
            { id: 'shoeSize', label: 'سائز (Shoe Size)', placeholder: 'مثلاً: 38, 39, 40, 41, 42, 43', type: 'text' },
            { id: 'shoeColor', label: 'رنگ (Color)', placeholder: 'Black, Brown, Navy Blue, Tan', type: 'text' },
            { id: 'shoeMaterial', label: 'مٹیریل (Material)', placeholder: 'Pure Leather, Synthetic, Rexine', type: 'text' }
        ],
        quickTags: ['Men Shoes', 'Women Sandals', 'Joggers', 'Slippers']
    },
    {
        id: 'garments',
        aliasIds: ['clothing', 'apparel'],
        nameEn: 'Garments & Clothing',
        nameUr: 'گارمنٹس، کپڑے و ملبوسات',
        icon: '👕',
        status: 'active',
        description: 'Readymade garments, unstitched suits, shirts, trousers, abayas',
        subcategories: [
            'مردانہ قمیص شلوار و سوٹ (Men Suits & Kurta)',
            'زنانہ ملبوسات (Women Stitched & Unstitched)',
            'بچوں کے کپڑے (Kids Garments)',
            'ٹی شرٹس و جینز (T-Shirts & Jeans)',
            'عبایا، شالیں و دوپٹے (Abayas & Shawls)',
            'انڈر گارمنٹس و ہوزری (Undergarments & Hosiery)',
            'موسمی و ونٹر کلیکشن (Jackets & Sweaters)'
        ],
        units: ['pcs', 'suit', 'meter', 'dozen', 'packet', 'box'],
        customFields: [
            { id: 'clothSize', label: 'سائز (Size: S, M, L, XL)', placeholder: 'Small, Medium, Large, XL, 32, 34', type: 'text' },
            { id: 'clothFabric', label: 'فیبرک / کپڑا (Fabric)', placeholder: 'Cotton, Lawn, Wash & Wear, Silk', type: 'text' }
        ],
        quickTags: ['Readymade', 'Unstitched', 'T-Shirts', 'Jeans']
    },
    {
        id: 'general',
        aliasIds: ['kiryana', 'grocery'],
        nameEn: 'General Store & Kiryana',
        nameUr: 'جنرل اسٹور و کریانہ (گروسری)',
        icon: '🛒',
        status: 'active',
        description: 'Pulses, rice, flour, oil, ghee, sugar, soaps, detergents, spices',
        subcategories: [
            'آٹا، دالیں و چاول (Flour, Pulses & Rice)',
            'کوکنگ آئل و گھی (Cooking Oil & Ghee)',
            'چینی، چائے کی پتی و مصالحہ جات (Sugar, Tea & Spices)',
            'صابن، سرف و صفائی کا سامان (Detergents & Soaps)',
            'پیک شدہ سنیکس و بسکٹس (Biscuits & Snacks)',
            'دودھ و ڈیری پراڈکٹس (Milk & Dairy)',
            'بیوریجز و کولڈ ڈرنکس (Cold Drinks & Juices)'
        ],
        units: ['kg', 'g', 'maund', 'bag', 'carton', 'packet', 'liter', 'pcs'],
        customFields: [
            { id: 'brandCompany', label: 'برانڈ / کمپنی (Brand)', placeholder: 'Dalda, Shan, National, Habib', type: 'text' },
            { id: 'weightPack', label: 'پیکنگ وزن (Packing Weight)', placeholder: '1kg, 5kg, 16L Tin', type: 'text' }
        ],
        quickTags: ['دالیں', 'آئل', 'چاول', 'سرف', 'مصالحہ جات']
    },
    {
        id: 'wholesaler',
        aliasIds: ['distributor', 'distribution'],
        nameEn: 'Wholesaler & Bulk Distribution',
        nameUr: 'ہول سیلر و ڈسٹری بیوٹر (تھوک ڈیلر)',
        icon: '📦',
        status: 'active',
        description: 'Bulk supply, cartons, master cases, agency orders, b2b trade',
        subcategories: [
            'ماسٹر کارٹنز و بلک پیکنگ (Master Cartons)',
            'ڈسٹری بیوشن پروڈکٹس (Agency Products)',
            'ڈائریکٹ فیکٹری سپلائی (Factory Consignments)',
            'بوری و بڑے بنڈلز (Bags & Jumbo Bundles)'
        ],
        units: ['carton', 'bag', 'bundle', 'box', 'dozen', 'maund', 'pcs'],
        customFields: [
            { id: 'cartonPacking', label: 'کارٹن پیکنگ (Items per Carton)', placeholder: 'مثلاً: 24 Pcs/Ctn, 48 Pkts/Ctn', type: 'text' },
            { id: 'tradePriceTP', label: 'ٹریڈ پرائس TP (Trade Price)', placeholder: 'Company TP Rate', type: 'number' }
        ],
        quickTags: ['Master Carton', 'Wholesale Rate', 'Agency Stock']
    },
    {
        id: 'confectionery',
        aliasIds: ['biscuits', 'sweets'],
        nameEn: 'Confectionery, Sweets & Biscuits',
        nameUr: 'کنفیکشنری، مٹھائی و بسکٹ',
        icon: '🍪',
        status: 'active',
        description: 'Chocolates, candies, toffees, biscuits, gums, wafers, nimco',
        subcategories: [
            'بسکٹس و کوکیز (Biscuits & Cookies)',
            'چاکلیٹس و وائیفرز (Chocolates & Wafers)',
            'ٹافیاں و کینڈیز (Toffees & Candies)',
            'ببل گم و لالی پاپس (Gums & Lollipops)',
            'نمکو و تلے ہوئے سنیکس (Nimco & Crisps)'
        ],
        units: ['box', 'carton', 'packet', 'pcs', 'dozen'],
        customFields: [
            { id: 'flavorVariant', label: 'فلیور (Flavor)', placeholder: 'Chocolate, Orange, Strawberry, Elaichi', type: 'text' }
        ],
        quickTags: ['بسکٹس', 'چاکلیٹ', 'ٹافیاں', 'نمکو']
    },
    {
        id: 'hardware',
        aliasIds: ['sanitary', 'paint'],
        nameEn: 'Hardware, Sanitary & Paint',
        nameUr: 'ہارڈویئر، سینیٹری و پینٹ',
        icon: '🔧',
        status: 'active',
        description: 'Tools, pipes, sanitary fittings, paints, screws, locks, nails',
        subcategories: [
            'ہینڈ ٹولز و پاور ٹولز (Hand & Power Tools)',
            'پائپ و سینیٹری فٹنگز (PPRC & PVC Pipes & Fittings)',
            'پینٹ، وارنش و برشز (Paints, Varnish & Brushes)',
            'تالے، ہینڈلز و قلابے (Locks, Handles & Hinges)',
            'کیل، پیچ و نٹ بولٹ (Screws, Nails & Bolts)',
            'واٹر پمپ و موٹرز (Water Pumps & Motors)'
        ],
        units: ['pcs', 'meter', 'feet', 'kg', 'packet', 'box', 'gallon', 'unit'],
        customFields: [
            { id: 'specSize', label: 'سائز / گیج (Size / Gauge)', placeholder: '1/2 inch, 1 inch, 4 inch, 14 Gauge', type: 'text' }
        ],
        quickTags: ['ٹولز', 'پائپ', 'پینٹ', 'تالے', 'پیچ']
    },
    {
        id: 'electronics',
        aliasIds: ['appliances', 'electric'],
        nameEn: 'Electronics & Home Appliances',
        nameUr: 'الیکٹرانکس و ہوم اپلائنسز',
        icon: '💻',
        status: 'active',
        description: 'Fans, heaters, solar panels, inverters, cables, LEDs, refrigerators',
        subcategories: [
            'پنکھے و ایگزاسٹ (Fans & Exhaust)',
            'سولر پینلز و انورٹرز (Solar & Inverters)',
            'ایل ای ڈی بلب، ٹیوبز و لائٹس (LED Bulbs & Lights)',
            'تاریں، کیبلز و بریکرز (Cables & Circuit Breakers)',
            'سوئچ بورڈز و ساکٹس (Switches & Sockets)',
            'واشنگ مشین، فریج و مائیکرو ویو (Home Appliances)'
        ],
        units: ['unit', 'pcs', 'box', 'meter', 'feet', 'carton'],
        customFields: [
            { id: 'wattVoltage', label: 'واٹ / پاور (Watt / Specs)', placeholder: '12W, 18W, 550 Watt, 2.5mm Wire', type: 'text' },
            { id: 'warrantyPeriod', label: 'وارنٹی (Warranty)', placeholder: '1 Year Brand Warranty', type: 'text' }
        ],
        quickTags: ['LEDs', 'Cables', 'Fans', 'Solar', 'Switches']
    },
    {
        id: 'cosmetics',
        aliasIds: ['beauty', 'skincare'],
        nameEn: 'Cosmetics & Beauty Store',
        nameUr: 'کاسمیٹکس و بیوٹی شاپ',
        icon: '💄',
        status: 'active',
        description: 'Makeup, perfumes, skincare, hair colors, shampoos, lotions',
        subcategories: [
            'میک اپ و لپ اسٹکس (Makeup & Lipsticks)',
            'اسکن کیئر و فیس واش (Skincare & Face Wash)',
            'شیمپو، کنڈیشنر و ہیئر آئلز (Hair Care & Shampoos)',
            'پرفیومز، باڈی اسپرے و عطر (Perfumes & Bodysprays)',
            'ہیئر کلرز و ڈائز (Hair Colors & Dyes)',
            'پارلر و بیوٹی ایسیسریز (Parlour Accessories)'
        ],
        units: ['pcs', 'bottle', 'box', 'packet', 'unit', 'dozen'],
        customFields: [
            { id: 'shadeNo', label: 'شیڈ / کلر نمبر (Shade / Color No)', placeholder: 'Shade #02, Fair Glow, Rose Pink', type: 'text' }
        ],
        quickTags: ['Makeup', 'Skincare', 'Perfumes', 'Hair Care']
    },
    {
        id: 'auto_parts',
        aliasIds: ['autoparts', 'spare_parts'],
        nameEn: 'Auto Parts & Spare Parts',
        nameUr: 'آٹو پارٹس و اسپیئر پارٹس (موٹر و گاڑی)',
        icon: '🚗',
        status: 'active',
        description: 'Motorcycle & car parts, filters, engine oil, brake pads, plugs',
        subcategories: [
            'موٹرسائیکل پارٹس (Motorbike 70cc / 125cc Parts)',
            'کار پارٹس (Car Spare Parts)',
            'انجن آئل و لیوبریکنٹس (Engine Oil & Mobil Oil)',
            'فلٹرز، پلگ و بیلٹس (Filters, Plugs & Belts)',
            'بریک پیڈز و لیدر (Brakes & Clutch Plates)',
            'لائٹس و بیٹریاں (Lights & Batteries)'
        ],
        units: ['pcs', 'unit', 'set', 'liter', 'box', 'packet'],
        customFields: [
            { id: 'vehicleModel', label: 'گاڑی / ماڈل (Vehicle / Model Fit)', placeholder: 'CD70, CG125, Corolla, Mehran', type: 'text' }
        ],
        quickTags: ['Engine Oil', 'Plugs', 'Filters', 'Brakes']
    },
    {
        id: 'bakery',
        aliasIds: ['bakers', 'sweets_bakery'],
        nameEn: 'Bakery, Sweets & Cafe',
        nameUr: 'بیکری، کیک و مٹھائی',
        icon: '🍞',
        status: 'active',
        description: 'Cakes, bread, pastries, rusk, patties, traditional sweets',
        subcategories: [
            'کیک و پیسٹریز (Cakes & Pastries)',
            'ڈبل روٹی، بن و رس (Bread, Buns & Rusks)',
            'سموسے، پیٹیز و فاسٹ فوڈ (Patties & Snacks)',
            'روایتی مٹھائی (Mithai & Halwa)',
            'بیکری بسکٹس و نمکین (Bakery Biscuits)'
        ],
        units: ['kg', 'pound', 'pcs', 'box', 'packet'],
        customFields: [
            { id: 'cakePound', label: 'وزن / پاؤنڈ (Pounds / Weight)', placeholder: '1 Pound, 2 Pounds, 500g', type: 'text' }
        ],
        quickTags: ['Cakes', 'Bread', 'Biscuits', 'Mithai']
    },
    {
        id: 'furniture',
        nameEn: 'Furniture & Interior Decor',
        nameUr: 'فرنیچر و ہوم ڈیکور',
        icon: '🪑',
        status: 'active',
        description: 'Beds, sofas, dining tables, office chairs, almirahs',
        subcategories: [
            'بیڈ سیٹ و الماریاں (Bed Sets & Wardrobes)',
            'صوفہ سیٹ و دیوان (Sofa Sets & Couches)',
            'ڈائننگ ٹیبلز (Dining Tables & Chairs)',
            'آفس ٹیبلز و گھومنے والی کرسیاں (Office Desks & Chairs)',
            'میٹرس و فوم (Mattresses & Foam)'
        ],
        units: ['set', 'pcs', 'unit'],
        customFields: [
            { id: 'woodType', label: 'لکڑی / مٹیریل (Wood / Polish)', placeholder: 'Sheesham, Teak, Lasani, Deco Paint', type: 'text' }
        ],
        quickTags: ['Bed Sets', 'Sofas', 'Office Chairs']
    },
    {
        id: 'beverages',
        aliasIds: ['drinks', 'cold_drinks'],
        nameEn: 'Beverages & Cold Drinks',
        nameUr: 'مشروبات، جوسز و کولڈ ڈرنکس',
        icon: '🥤',
        status: 'active',
        description: 'Mineral water, sodas, energy drinks, juices, syrups',
        subcategories: [
            'کولڈ ڈرنکس و سوڈا (Carbonated Drinks & Sodas)',
            'منرل واٹر (Mineral Water - 500ml, 1.5L, 19L)',
            'جوسز و نیکٹرز (Juices & Nectars)',
            'انرجی ڈرنکس (Energy Drinks)',
            'شربت و اسکواشز (Traditional Syrups & Squash)'
        ],
        units: ['bottle', 'can', 'carton', 'pcs', 'box', 'liter'],
        customFields: [
            { id: 'bottleSize', label: 'بوتل سائز / حجم (Size)', placeholder: '250ml, 300ml, 500ml, 1.5L, 2.25L', type: 'text' }
        ],
        quickTags: ['Cold Drinks', 'Juices', 'Water', 'Cans']
    },
    {
        id: 'toys',
        aliasIds: ['toys_store', 'kids_toys'],
        nameEn: 'Toys & Kids Store',
        nameUr: 'کھلونے و بیبی ٹوائز شاپ',
        icon: '🧸',
        status: 'active',
        description: 'RC cars, dolls, educational toys, board games, ride-ons',
        subcategories: [
            'ریموٹ کنٹرول گاڑیاں و ہیلی کاپٹرز (RC Cars & Drones)',
            'گڑیا و باربی سیٹ (Dolls & Kitchen Sets)',
            'تعلیمی کھلونے و بلاکس (Building Blocks & Educational)',
            'بورڈ گیمز و پزلز (Board Games & Puzzles)',
            'بیبی بائیکس و ٹرائی سائیکلز (Kids Cycles & Ride-ons)'
        ],
        units: ['pcs', 'unit', 'box', 'carton', 'set'],
        customFields: [
            { id: 'ageGroup', label: 'عمر کی حد (Age Group)', placeholder: '0-2 Years, 3-6 Years, 7+ Years', type: 'text' }
        ],
        quickTags: ['RC Cars', 'Dolls', 'Blocks', 'Games']
    },
    {
        id: 'supermarket',
        aliasIds: ['mart', 'hypermarket'],
        nameEn: 'Supermarket & Mega Mart',
        nameUr: 'سپر مارکیٹ و میگا مارٹ',
        icon: '🏪',
        status: 'active',
        description: 'All-in-one shopping mart with barcode scanning and departments',
        subcategories: [
            'گروسری ڈپارٹمنٹ (Grocery Section)',
            'بیکری و کنفیکشنری (Bakery & Snacks)',
            'کاسمیٹکس و ٹوائلٹریز (Personal Care)',
            'ہاؤس ہولڈ و برتن (Household & Plasticware)',
            'فروزن فوڈز و ڈیری (Frozen Food & Ice Cream)'
        ],
        units: ['pcs', 'kg', 'packet', 'carton', 'bottle', 'can'],
        customFields: [
            { id: 'aisleRack', label: 'ریک / شیلف نمبر (Aisle / Shelf)', placeholder: 'Rack A-3, Shelf 2', type: 'text' }
        ],
        quickTags: ['Grocery', 'Household', 'Frozen', 'Personal Care']
    },
    {
        id: 'distributor',
        aliasIds: ['fmcg_distributor', 'distribution_agency'],
        nameEn: 'Distributor & FMCG Agency',
        nameUr: 'ڈسٹری بیوٹر و ایجنسی (ایف ایم سی جی)',
        icon: '🚚',
        status: 'active',
        description: 'Authorized company distributors, delivery van routing, shop supply',
        subcategories: [
            'کمپنی ایجنسی پروڈکٹس (Authorized Brand Products)',
            'ڈسپیچ وین اسٹاک (Van Loading Stock)',
            'ڈیمج و ایکسپائری کلیمز (Claims Stock)'
        ],
        units: ['carton', 'bag', 'master_ctn', 'dozen', 'box'],
        customFields: [
            { id: 'companyAgency', label: 'پرنسپل کمپنی (Principal Company)', placeholder: 'Unilever, Nestlé, P&G, Reckitt', type: 'text' },
            { id: 'cartonPcs', label: 'پیکنگ (Units per Carton)', placeholder: 'e.g. 24, 36, 48', type: 'text' }
        ],
        quickTags: ['Agency', 'Cartons', 'Van Dispatch']
    },
    {
        id: 'manufacturer',
        aliasIds: ['factory', 'production'],
        nameEn: 'Manufacturer & Production',
        nameUr: 'فیکٹری و پروڈکشن یونٹ',
        icon: '🏭',
        status: 'active',
        description: 'Raw materials, finished goods, batch manufacturing, packaging',
        subcategories: [
            'خام مال (Raw Materials)',
            'تیار شدہ پروڈکٹس (Finished Goods)',
            'پیکنگ مٹیریل (Packaging Material)'
        ],
        units: ['kg', 'maund', 'meter', 'pcs', 'roll', 'bag', 'carton'],
        customFields: [
            { id: 'batchLot', label: 'بیچ / لاٹ نمبر (Batch / Lot No)', placeholder: 'LOT-2026-A', type: 'text' }
        ],
        quickTags: ['Raw Material', 'Finished Goods', 'Batch']
    },
    {
        id: 'jewellery',
        aliasIds: ['gold_shop', 'jewelry'],
        nameEn: 'Jewellery & Gold Store',
        nameUr: 'جیولری و گولڈ شاپ (سونار)',
        icon: '💍',
        status: 'active',
        description: 'Gold rings, necklaces, bangles, silver, artificial jewellery',
        subcategories: [
            'طلائی زیورات (Gold 21K / 22K Jewellery)',
            'چاندی کے زیورات (Silver Ornaments)',
            'مصنوعی و برائیڈل جیولری (Artificial & Bridal Sets)',
            'قیمتی نگینے و پتھر (Gemstones & Diamonds)'
        ],
        units: ['gram', 'tola', 'masha', 'ratti', 'pcs', 'set'],
        customFields: [
            { id: 'goldKarat', label: 'قیراط (Karat / Purity)', placeholder: '24K, 22K, 21K, 18K', type: 'text' },
            { id: 'goldWeightGram', label: 'خالص وزن (Net Weight in Grams/Tola)', placeholder: 'e.g. 5.40g / 0.46 Tola', type: 'text' },
            { id: 'makingCharges', label: 'مزدوری / کاریگری (Making Charges)', placeholder: 'Labor charge per gram/tola', type: 'number' }
        ],
        quickTags: ['Gold 21K', 'Gold 22K', 'Silver', 'Rings']
    },
    {
        id: 'agriculture',
        aliasIds: ['fertilizer', 'seeds', 'feed_store'],
        nameEn: 'Feed, Seeds & Agriculture Store',
        nameUr: 'زرعی ادویات، کھاد، بیج و پولٹری فیڈ',
        icon: '🐄',
        status: 'active',
        description: 'Fertilizers, hybrid seeds, pesticides, cattle & poultry feed',
        subcategories: [
            'کیمیائی کھادیں (Fertilizers - Urea, DAP, SOP)',
            'ہائبرڈ بیج (Hybrid Seeds - Wheat, Cotton, Corn, Rice)',
            'زرعی زہریں و اسپرے (Pesticides & Insecticides)',
            'پولٹری و کیٹل فیڈ (Poultry Feed & Wafadaar)',
            'زرعی اسپرے پمپس و ٹولز (Spray Pumps & Equipment)'
        ],
        units: ['bag', 'bottle', 'kg', 'liter', 'packet', 'carton', 'maund'],
        customFields: [
            { id: 'activeIngredient', label: 'فارمولا / زہر (Active Ingredient)', placeholder: 'e.g. Emamectin, Lambda, Zinc Sulphate', type: 'text' },
            { id: 'bagWeightKg', label: 'بوری کا وزن (Weight per Bag)', placeholder: '50kg Bag, 25kg, 1L Bottle', type: 'text' }
        ],
        quickTags: ['Urea', 'DAP', 'Seeds', 'Pesticides', 'Feed']
    },
    {
        id: 'tyre_store',
        aliasIds: ['tyres', 'tubes'],
        nameEn: 'Tyre & Tube Store',
        nameUr: 'ٹائر و ٹیوب اسٹور (گاڑی و موٹر سائیکل)',
        icon: '🛞',
        status: 'active',
        description: 'Bike tyres, car radial tyres, tractor tyres, tubes, puncture patches',
        subcategories: [
            'موٹرسائیکل ٹائرز (Motorcycle Tyres - Service, Panther, General)',
            'کار و وین ریڈیل ٹائرز (Car & Van Radial Tyres)',
            'ٹریکٹر و ہیوی گاڑیوں کے ٹائر (Tractor & Truck Tyres)',
            'ٹیوبز (Tubes - All Sizes)',
            'پنکچر میٹریل و والوز (Patches & Valves)'
        ],
        units: ['pcs', 'pair', 'unit', 'set'],
        customFields: [
            { id: 'tyreSize', label: 'ٹائر سائز (Tyre Size Specs)', placeholder: 'e.g. 2.50-17, 3.00-17, 175/70R13, 195/65R15', type: 'text' },
            { id: 'plyRating', label: 'پلائی ریٹنگ (Ply Rating / PR)', placeholder: '4PR, 6PR, 8PR', type: 'text' }
        ],
        quickTags: ['Bike Tyres', 'Car Tyres', 'Tubes', 'Radial']
    },
    {
        id: 'workshop',
        aliasIds: ['auto_workshop', 'service_station'],
        nameEn: 'Auto Workshop & Service Center',
        nameUr: 'آٹو ورکشاپ و سروس اسٹیشن',
        icon: '🧰',
        status: 'active',
        description: 'Auto mechanical repair, tuning, oil change, labor charges, parts',
        subcategories: [
            'مکینیکل سروس و ٹیوننگ (Engine Tuning & Labor)',
            'آئل چینج و فلٹرز (Oil Change & Maintenance)',
            'سسپنشن و بریک ورک (Brakes & Suspension Repair)',
            'الیکٹریشن و اے سی ورک (Auto Electrician & AC)'
        ],
        units: ['job', 'unit', 'pcs', 'liter', 'hour'],
        customFields: [
            { id: 'customerVehicleNo', label: 'گاڑی نمبر (Vehicle Registration No)', placeholder: 'e.g. LEA-1234, RIK-567', type: 'text' }
        ],
        quickTags: ['Tuning', 'Oil Change', 'Labor', 'Repair']
    },
    {
        id: 'restaurant',
        aliasIds: ['cafe', 'fast_food', 'hotel'],
        nameEn: 'Restaurant, Fast Food & Cafe',
        nameUr: 'ریسٹورنٹ، فاسٹ فوڈ و کیفے',
        icon: '🍽️',
        status: 'active',
        description: 'Dine-in, takeaway, fast food, biryani, barbecue, tea & beverages',
        subcategories: [
            'برگرز، پیزا و فاسٹ فوڈ (Burgers, Pizza & Shawarma)',
            'بریانی، پلاؤ و روایتی کھانے (Biryani & Karahi)',
            'باربی کیو و کباب (BBQ & Tikka)',
            'چائے، کافی و مشروبات (Tea, Coffee & Shakes)'
        ],
        units: ['order', 'plate', 'pcs', 'cup', 'glass'],
        customFields: [
            { id: 'tableNo', label: 'ٹیبل نمبر / ٹائپ (Table No / Takeaway)', placeholder: 'Table 5, Parcel, Delivery', type: 'text' }
        ],
        quickTags: ['Burgers', 'Biryani', 'BBQ', 'Pizza', 'Tea']
    },
    {
        id: 'meat_chicken',
        aliasIds: ['meat_shop', 'poultry_shop', 'chicken'],
        nameEn: 'Chicken, Meat & Fish Shop',
        nameUr: 'مرغی، گوشت و مچھلی کی دکان',
        icon: '🍗',
        status: 'active',
        description: 'Broiler chicken, mutton, beef, fish, cuts, boneless',
        subcategories: [
            'زندہ مرغی و صافی چکن (Broiler Live & Clean Meat)',
            'بون لیس چکن و ونگز (Boneless & Wings)',
            'مٹن و بیف (Mutton & Beef)',
            'مچھلی (Fresh Fish & Prawns)'
        ],
        units: ['kg', 'g', 'maund', 'pcs'],
        customFields: [
            { id: 'meatCutType', label: 'کٹائی کی قسم (Cut Type)', placeholder: 'Karahi Cut, Handi Cut, Mince (قیمہ)', type: 'text' }
        ],
        quickTags: ['Chicken', 'Mutton', 'Beef', 'Fish']
    },
    {
        id: 'fruit_vegetables',
        aliasIds: ['sabzi_mandi', 'fruits'],
        nameEn: 'Fruit & Vegetable Shop (Mandi)',
        nameUr: 'سبزی و پھل منڈی (فروٹ و سبزی)',
        icon: '🥬',
        status: 'active',
        description: 'Fresh vegetables, seasonal fruits, crates, sacks, daily rate',
        subcategories: [
            'روزمرہ سبزیاں (Daily Vegetables - Potatoes, Onions, Tomatoes)',
            'ہری سبزیاں (Leafy Greens & Chillies)',
            'موسمی پھل (Seasonal Fruits - Apples, Mangoes, Bananas)',
            'منڈی کی پیٹیاں و بوریاں (Crates & Bags)'
        ],
        units: ['kg', 'maund', 'crate', 'bag', 'dozen', 'g'],
        customFields: [
            { id: 'dailyMandiRate', label: 'منڈی کا روزانہ ریٹ (Daily Mandi Rate)', placeholder: 'Today Mandi Rate', type: 'number' }
        ],
        quickTags: ['آلو پیاز', 'ٹماٹر', 'پھل', 'پیٹی']
    },
    {
        id: 'other',
        nameEn: 'Other Business / General Trade',
        nameUr: 'دیگر کاروبار (عمومی تجارت)',
        icon: '💼',
        status: 'active',
        description: 'Custom inventory and flexible billing for any business',
        subcategories: [
            'جنرل پروڈکٹس (General Products)',
            'سروسز و لیبر (Services & Fees)',
            'دیگر آئٹمز (Other Items)'
        ],
        units: ['unit', 'pcs', 'box', 'packet', 'carton', 'kg', 'meter'],
        customFields: [],
        quickTags: ['General', 'Items']
    }
];

// ==========================================================================
// 🛠️ BUSINESS CATEGORIES HELPER API
// ==========================================================================

const BusinessCategories = {
    // Get all categories
    getAll() {
        return BUSINESS_CATEGORIES;
    },

    // Get only active categories
    getActive() {
        return BUSINESS_CATEGORIES.filter(c => c.status === 'active');
    },

    // Find category by ID or alias
    getById(id) {
        if (!id) return null;
        const cleanId = String(id).toLowerCase().trim();
        return BUSINESS_CATEGORIES.find(c => 
            c.id === cleanId || 
            (Array.isArray(c.aliasIds) && c.aliasIds.includes(cleanId))
        ) || null;
    },

    // Get display label (English + Urdu)
    getLabel(id) {
        const cat = this.getById(id);
        if (!cat) return '💼 General Business';
        return `${cat.icon} ${cat.nameEn} (${cat.nameUr})`;
    },

    // Populate a <select> element dynamically
    populateSelect(selectElement, selectedValue = '', options = {}) {
        if (!selectElement) return;
        const { includeAll = false, allLabel = '📂 All Business Types', onlyActive = false } = options;

        selectElement.innerHTML = '';

        if (includeAll) {
            const allOpt = document.createElement('option');
            allOpt.value = 'all';
            allOpt.textContent = allLabel;
            selectElement.appendChild(allOpt);
        }

        const list = onlyActive ? this.getActive() : this.getAll();

        list.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = `${cat.icon} ${cat.nameEn} — ${cat.nameUr}`;
            if (selectedValue && (selectedValue === cat.id || (Array.isArray(cat.aliasIds) && cat.aliasIds.includes(selectedValue)))) {
                opt.selected = true;
            }
            selectElement.appendChild(opt);
        });
    },

    // Get suggested subcategories for datalist
    getSuggestedSubcategories(id) {
        const cat = this.getById(id);
        return cat && Array.isArray(cat.subcategories) ? cat.subcategories : [];
    },

    // Get custom fields for stock entry
    getCustomFields(id) {
        const cat = this.getById(id);
        return cat && Array.isArray(cat.customFields) ? cat.customFields : [];
    },

    // Populate a datalist with subcategories
    populateDatalist(datalistElement, categoryId) {
        if (!datalistElement) return;
        datalistElement.innerHTML = '';
        const subcats = this.getSuggestedSubcategories(categoryId);
        subcats.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub;
            datalistElement.appendChild(opt);
        });
    },

    // Dynamically toggle / pause a category status (SaaS modularity feature)
    setCategoryStatus(id, newStatus) {
        const cat = this.getById(id);
        if (cat) {
            cat.status = newStatus;
            return true;
        }
        return false;
    }
};

// Expose globally for window / browser
if (typeof window !== 'undefined') {
    window.BUSINESS_CATEGORIES = BUSINESS_CATEGORIES;
    window.BusinessCategories = BusinessCategories;
}

// Module export for Node/ESM if required
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BUSINESS_CATEGORIES, BusinessCategories };
}
