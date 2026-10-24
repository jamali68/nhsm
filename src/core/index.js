/**
 * 🔒 CORE BUSINESS LOGIC & SECURITY VAULT (CENTRAL EXPORT)
 * ---------------------------------------------------------
 * Independent, provider-agnostic core modules.
 * Used by:
 * - Netlify Functions: `netlify/functions/secure-api.js`
 * - Firebase Cloud Functions (Future): `functions/index.js`
 * - Express Server / Local Dev: `server.ts`
 */

export * from './crypto-vault.js';
export * from './licensing.js';
export * from './profit-margin.js';
