const fs = require('fs');

let code = fs.readFileSync('vault-crypto-node.cjs', 'utf8');

// Replace export function -> function
code = code.replace(/export async function/g, 'async function');
code = code.replace(/export function/g, 'function');
code = code.replace(/export const/g, 'const');

// Import crypto from node
code = "const crypto = require('crypto');\nconst webcrypto = crypto.webcrypto;\n" + code;

// Replace crypto.subtle -> webcrypto.subtle
code = code.replace(/crypto\.subtle/g, 'webcrypto.subtle');
code = code.replace(/crypto\.getRandomValues/g, 'webcrypto.getRandomValues');

// Export module
code += `\nmodule.exports = {
  unlockVaultEnvelope,
  deriveVaultKey,
  decryptVault,
  base64ToBytes
};`;

fs.writeFileSync('vault-crypto-node.cjs', code);
console.log("Created vault-crypto-node.cjs");
