const fs = require('fs');

// 1. Update pin-auth.cjs
let pinAuth = fs.readFileSync('pin-auth.cjs', 'utf8');
pinAuth = pinAuth.replace(
  "nonce: crypto.randomBytes(16).toString('base64url'),",
  "nonce: crypto.randomBytes(16).toString('base64url'),\n    email: options.email,"
);
pinAuth = pinAuth.replace(
  "return parsed.v === 1",
  "return parsed.v === 1"
);
// Modify verifySessionToken to return payload instead of true
pinAuth = pinAuth.replace(
  /return parsed\.v === 1[\s\S]*?&& parsed\.exp <= now \+ SESSION_TTL_MS;/g,
  `if (parsed.v === 1
      && Number.isFinite(parsed.exp)
      && parsed.exp > now
      && parsed.exp <= now + SESSION_TTL_MS) {
      return parsed;
    }
    return false;`
);
fs.writeFileSync('pin-auth.cjs', pinAuth);

// 2. Update vault-crypto.js
let vaultCrypto = fs.readFileSync('vault-crypto.js', 'utf8');

// Change VAULT_VERSION to 3
vaultCrypto = vaultCrypto.replace(
  "export const VAULT_VERSION = 1;",
  "export const VAULT_VERSION = 3;"
);

// Add addKeyring function
const addKeyringCode = `
export async function addKeyring(masterKey, email, password) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const userKey = await deriveVaultKey(
    normalizeVaultSecret(password),
    salt,
    KDF_ITERATIONS,
    VAULT_SECRET_ENCODING
  );
  const rawMasterKey = await crypto.subtle.exportKey("raw", masterKey);
  const encryptedKey = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, userKey, rawMasterKey);
  return {
    email: email.toLowerCase().trim(),
    kdf: "PBKDF2-SHA256",
    iterations: KDF_ITERATIONS,
    salt: bytesToBase64(salt),
    passwordNormalization: MASTER_PASSWORD_NORMALIZATION,
    secretCanonicalization: VAULT_SECRET_CANONICALIZATION,
    secretEncoding: VAULT_SECRET_ENCODING,
    iv: bytesToBase64(iv),
    encryptedKey: bytesToBase64(new Uint8Array(encryptedKey))
  };
}
`;
vaultCrypto = vaultCrypto.replace(
  "export async function encryptVault(vault, key, envelope = {}) {",
  addKeyringCode + "\nexport async function encryptVault(vault, key, envelope = {}) {"
);

vaultCrypto = vaultCrypto.replace(
  "iv: bytesToBase64(iv),",
  "keyrings: envelope.keyrings || [],\n    iv: bytesToBase64(iv),"
);

// Update createVaultEnvelope
const newCreateVaultEnvelope = `export async function createVaultEnvelope(vault, email, masterPassword) {
  const masterKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const keyring = await addKeyring(masterKey, email, masterPassword);
  const envelope = await encryptVault(vault, masterKey, {
    keyrings: [keyring]
  });
  return { key: masterKey, envelope };
}`;
vaultCrypto = vaultCrypto.replace(
  /export async function createVaultEnvelope[\s\S]*?return \{ key, envelope \};\n\}/,
  newCreateVaultEnvelope
);

// Update unlockVaultEnvelope
const newUnlockVaultEnvelope = `export async function unlockVaultEnvelope(envelope, email, masterPassword) {
  if (!envelope.keyrings || !envelope.keyrings.length) {
    const normalizedPassword = envelope.secretCanonicalization === VAULT_SECRET_CANONICALIZATION
      ? normalizeVaultSecret(masterPassword)
      : envelope.passwordNormalization
        ? masterPassword.normalize(envelope.passwordNormalization)
        : masterPassword;
    const key = await deriveVaultKey(
      normalizedPassword,
      base64ToBytes(envelope.salt),
      envelope.iterations ?? KDF_ITERATIONS,
      envelope.secretEncoding,
    );
    const vault = await decryptVault(envelope, key);
    return { key, vault, isLegacy: true };
  }

  const keyring = envelope.keyrings.find(k => k.email === email.toLowerCase().trim());
  if (!keyring) throw new Error("ไม่พบสิทธิ์การเข้าถึงสำหรับอีเมลนี้");

  const normalizedPassword = keyring.secretCanonicalization === VAULT_SECRET_CANONICALIZATION
    ? normalizeVaultSecret(masterPassword)
    : keyring.passwordNormalization
      ? masterPassword.normalize(keyring.passwordNormalization)
      : masterPassword;

  const userKey = await deriveVaultKey(
    normalizedPassword,
    base64ToBytes(keyring.salt),
    keyring.iterations ?? KDF_ITERATIONS,
    keyring.secretEncoding,
  );

  const rawMasterKey = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(keyring.iv) },
    userKey,
    base64ToBytes(keyring.encryptedKey)
  );

  const masterKey = await crypto.subtle.importKey(
    "raw",
    rawMasterKey,
    "AES-GCM",
    true,
    ["encrypt", "decrypt"]
  );

  const vault = await decryptVault(envelope, masterKey);
  return { key: masterKey, vault };
}`;
vaultCrypto = vaultCrypto.replace(
  /export async function unlockVaultEnvelope[\s\S]*?return \{ key, vault \};\n\}/,
  newUnlockVaultEnvelope
);

fs.writeFileSync('vault-crypto.js', vaultCrypto);
console.log("Updated pin-auth.cjs and vault-crypto.js");
