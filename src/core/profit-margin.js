/**
 * 🔒 CORE MODULE: SENSITIVE ALGORITHMS & MARGIN VAULT
 * ---------------------------------------------------
 * Server-only calculation algorithms.
 * Keeps supplier purchase margins and secret cost formulas off client browsers.
 */

/**
 * Calculates net profit, gross margins, and scheme impacts server-side
 * @param {Array} items - Array of { qty, rate, costPrice, discount }
 * @param {number} billDiscount - Overall bill discount
 * @param {number} taxAmount - FBR tax amount
 */
export function calculateSecureProfitMetrics(items = [], billDiscount = 0, taxAmount = 0) {
  let totalRevenue = 0;
  let totalCost = 0;
  let totalItemDiscounts = 0;

  items.forEach(item => {
    const qty = Number(item.qty || 0);
    const saleRate = Number(item.rate || 0);
    const costPrice = Number(item.costPrice || item.purchasePrice || 0);
    const itemDisc = Number(item.discount || 0);

    const lineGross = qty * saleRate;
    const lineCost = qty * costPrice;

    totalRevenue += lineGross;
    totalCost += lineCost;
    totalItemDiscounts += itemDisc;
  });

  const netRevenue = Math.max(0, totalRevenue - totalItemDiscounts - Number(billDiscount || 0));
  const grossProfit = Math.max(0, netRevenue - totalCost);
  const profitMarginPercent = netRevenue > 0 ? ((grossProfit / netRevenue) * 100).toFixed(2) : '0.00';

  return {
    totalRevenue: Number(netRevenue.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    profitMarginPercent: Number(profitMarginPercent),
    taxAmount: Number(taxAmount || 0),
    calculatedAt: Date.now()
  };
}
