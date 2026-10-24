/**
 * 🔒 CORE MODULE: CRYPTOGRAPHIC VAULT & ANTI-TAMPER ENGINE
 * --------------------------------------------------------
 * Shared, provider-independent module (Zero dependency on Netlify or Firebase).
 * Can be run in Node.js, Netlify Functions, Firebase Cloud Functions, or Express.
 */

import crypto from 'crypto';

// Server-only Private Secret Salt (Set via Netlify / Firebase Env Vars)
const DEFAULT_SALT = 'EB_SECURE_VAULT_786_NH_DIST_2026';

/**
 * Returns the effective server salt from environment or fallback
 */
export function getServerSecretSalt() {
  return process.env.SYSTEM_SECURE_SALT || process.env.APP_SECRET || DEFAULT_SALT;
}

/**
 * Generate cryptographic HMAC-SHA256 signature for an invoice
 * Prevents client/device clock tampering and invoice forged totals
 */
export function generateInvoiceSignature(params) {
  const { billNumber, totalAmount, date, agencyId } = params;
  if (!billNumber || totalAmount === undefined) {
    throw new Error('Missing billNumber or totalAmount');
  }

  const salt = getServerSecretSalt();
  const normalizedData = `${agencyId || 'default'}|${billNumber}|${Number(totalAmount).toFixed(2)}|${date || ''}`;

  const signatureHash = crypto
    .createHmac('sha256', salt)
    .update(normalizedData)
    .digest('hex')
    .substring(0, 16)
    .toUpperCase();

  return {
    signature: `EB-${signatureHash}`,
    signedAt: Date.now(),
    billNumber: billNumber
  };
}

/**
 * Validate an existing invoice signature
 */
export function verifyInvoiceSignature(params) {
  const { billNumber, totalAmount, date, agencyId, signature } = params;
  if (!signature || !billNumber || totalAmount === undefined) {
    return { valid: false, reason: 'Missing verification parameters' };
  }

  const generated = generateInvoiceSignature({ billNumber, totalAmount, date, agencyId });
  const isValid = generated.signature === signature.trim().toUpperCase();

  return {
    valid: isValid,
    verifiedAt: Date.now()
  };
}

/**
 * Generate a cryptographically secure agency license token
 */
export function generateLicenseToken(agencyId, packageId, expiryDate) {
  const salt = getServerSecretSalt();
  const payload = `${agencyId}|${packageId}|${expiryDate}`;
  const token = crypto
    .createHmac('sha256', salt)
    .update(payload)
    .digest('hex');
  return `LIC-${token.substring(0, 24).toUpperCase()}`;
}
