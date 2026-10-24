/**
 * 🔒 CORE MODULE: SAAS LICENSING & TIER QUOTA AUTHORIZATION
 * ---------------------------------------------------------
 * Shared, provider-independent module.
 * Evaluates subscription tiers, bill quotas, booker limits, and module lock states authoritatively.
 */

export const PACKAGE_TIERS = {
  free: {
    id: 'free',
    name: 'Free Starter (مفت بنیاد)',
    price: 0,
    maxBillsMonthly: 60,
    maxStockItems: 50,
    maxBookers: 1,
    allowedModules: ['dashboard', 'bills', 'customers', 'stock', 'reports', 'settings']
  },
  starter_single: {
    id: 'starter_single',
    name: 'Single Agency Pro (پرو سنگل برانچ)',
    price: 1500,
    maxBillsMonthly: 1000,
    maxStockItems: 1000,
    maxBookers: 3,
    allowedModules: ['dashboard', 'bills', 'customers', 'stock', 'reports', 'booker_orders', 'delivery_returns', 'expenses', 'alerts', 'settings']
  },
  wholesale_dist: {
    id: 'wholesale_dist',
    name: 'Wholesale & Distribution Pro (ہول سیل و ڈسٹری بیوشن)',
    price: 3000,
    maxBillsMonthly: 5000,
    maxStockItems: 5000,
    maxBookers: 10,
    allowedModules: ['dashboard', 'bills', 'customers', 'stock', 'reports', 'booker_orders', 'delivery_returns', 'claims', 'expenses', 'alerts', 'owner', 'backup', 'settings']
  },
  enterprise_multi: {
    id: 'enterprise_multi',
    name: 'Enterprise Multi-Branch (ملٹی برانچ انٹرپرائز)',
    price: 6000,
    maxBillsMonthly: 50000,
    maxStockItems: 25000,
    maxBookers: 50,
    allowedModules: ['*'] // All modules unlocked
  }
};

/**
 * Authoritatively check if an agency has quota remaining for bills
 */
export function checkBillQuota(agency, monthlyBillsCount) {
  const pkgId = agency?.packageId || 'free';
  const tier = PACKAGE_TIERS[pkgId] || PACKAGE_TIERS.free;
  const isSuperAdmin = agency?.isSuperAdmin || agency?.role === 'super-admin';

  if (isSuperAdmin) {
    return { allowed: true, limit: Infinity, current: monthlyBillsCount, tier: 'super-admin' };
  }

  // Check subscription expiry
  const expiry = agency?.subscriptionExpiry || agency?.expiryDate;
  const todayStr = new Date().toISOString().slice(0, 10);
  const isExpired = pkgId !== 'free' && expiry && (expiry < todayStr);

  const effectiveTier = isExpired ? PACKAGE_TIERS.free : tier;
  const limit = effectiveTier.maxBillsMonthly;
  const count = Number(monthlyBillsCount || 0);

  return {
    allowed: count < limit,
    limit: limit,
    current: count,
    remaining: Math.max(0, limit - count),
    isExpired: Boolean(isExpired),
    tier: effectiveTier.id
  };
}

/**
 * Check if a system module is unlocked for an agency's tier
 */
export function isModuleAllowed(moduleId, packageId, isExpired) {
  if (!moduleId) return false;
  if (isExpired && moduleId !== 'dashboard' && moduleId !== 'bills' && moduleId !== 'customers' && moduleId !== 'stock') {
    return false;
  }

  const tier = PACKAGE_TIERS[packageId] || PACKAGE_TIERS.free;
  if (tier.allowedModules.includes('*') || tier.allowedModules.includes(moduleId)) {
    return true;
  }
  return false;
}
