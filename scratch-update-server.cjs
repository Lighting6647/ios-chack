const fs = require('fs');

// 3. Update vault-sync-store.cjs
let vaultSync = fs.readFileSync('vault-sync-store.cjs', 'utf8');
vaultSync = vaultSync.replace(
  "'iv', 'data', 'updatedAt',",
  "'iv', 'data', 'updatedAt', 'keyrings',"
);
fs.writeFileSync('vault-sync-store.cjs', vaultSync);

// 4. Update vault-storage.js
let vaultStorage = fs.readFileSync('vault-storage.js', 'utf8');
// Fix unlockStoredVault in vault-storage.js
vaultStorage = vaultStorage.replace(
  "export async function unlockStoredVault(masterPassword) {",
  "export async function unlockStoredVault(email, masterPassword) {"
);
vaultStorage = vaultStorage.replace(
  /const \{ key, vault \} = await unlockVaultEnvelope\(candidate, masterPassword\);/g,
  "const { key, vault, isLegacy } = await unlockVaultEnvelope(candidate, email, masterPassword);\n        if (isLegacy) vault.isLegacy = true;"
);
vaultStorage = vaultStorage.replace(
  /export async function archiveAndResetStoredVault\(vault, masterPassword\) \{/g,
  "export async function archiveAndResetStoredVault(vault, email, masterPassword) {"
);
vaultStorage = vaultStorage.replace(
  /const archive = await createVaultArchive\(vault, masterPassword\);/g,
  "const archive = await createVaultArchive(vault, email, masterPassword);"
);
vaultStorage = vaultStorage.replace(
  /export async function createVaultArchive\(vault, masterPassword\) \{/g,
  "export async function createVaultArchive(vault, email, masterPassword) {"
);
vaultStorage = vaultStorage.replace(
  /const \{ envelope \} = await createVaultEnvelope\(vault, masterPassword\);/g,
  "const { envelope } = await createVaultEnvelope(vault, email, masterPassword);"
);
fs.writeFileSync('vault-storage.js', vaultStorage);

// 5. Update server.cjs
let serverCjs = fs.readFileSync('server.cjs', 'utf8');

// Add userStore import and init
serverCjs = serverCjs.replace(
  "const { createRequestStore } = require('./request-store.cjs');",
  "const { createRequestStore } = require('./request-store.cjs');\nconst { createUserStore } = require('./user-store.cjs');"
);
serverCjs = serverCjs.replace(
  "const requestStore = createRequestStore();",
  "const requestStore = createRequestStore();\nconst userStore = createUserStore();"
);

// Update isAdminAuthenticated
serverCjs = serverCjs.replace(
  /function isAdminAuthenticated\(req\) \{[\s\S]*?return verifySessionToken\(parseCookies\(req\)\[adminSessionCookie\], adminPinHash\);\n\}/,
  `function isAdminAuthenticated(req) {
  if (!adminPinHash) return null;
  const token = parseCookies(req)[adminSessionCookie];
  const payload = verifySessionToken(token, adminPinHash);
  return payload ? payload.email : null;
}`
);

// Update requireAdminSession
serverCjs = serverCjs.replace(
  /if \(\!isAdminAuthenticated\(req\)\) \{/,
  `req.userEmail = isAdminAuthenticated(req);
  if (!req.userEmail) {`
);

// Replace handleAdminPinAuth with handleLogin
const newHandleLogin = `
async function handleLogin(req, res) {
  if (!adminPinHash) {
    return send(res, 503, JSON.stringify({
      ok: false,
      error: 'ยังไม่ได้ตั้งค่า PIN สำหรับผู้ดูแลบน Server',
    }));
  }

  const address = clientAddress(req);
  const activeAttempt = activeAuthAttempt(address);
  if (activeAttempt?.count >= authAttemptLimit) return rateLimitResponse(res, activeAttempt);

  const data = JSON.parse(await readBody(req, 2_000) || '{}');
  const email = String(data.email || '').trim().toLowerCase();
  const password = typeof data.password === 'string' ? data.password : '';
  
  if (!email || !password) {
    return send(res, 401, JSON.stringify({ ok: false, error: 'อีเมลและรหัสผ่านไม่ถูกต้อง' }));
  }

  let users = await userStore.get();
  
  let valid = false;
  
  if (users.length === 0) {
    // Bootstrap mode
    if (email === 'admin') {
      valid = await verifyPinHash(password, adminPinHash);
      if (valid) {
        users = [{ email: 'admin', authHash: adminPinHash, role: 'owner' }];
        await userStore.put(users);
      }
    }
  } else {
    const user = users.find(u => u.email === email);
    if (user) {
      valid = await verifyPinHash(password, user.authHash);
    }
  }

  if (!valid) {
    const failed = recordFailedAuth(address);
    if (failed.count >= authAttemptLimit) return rateLimitResponse(res, failed);
    return send(res, 401, JSON.stringify({
      ok: false,
      error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      attemptsRemaining: authAttemptLimit - failed.count,
    }));
  }

  authAttempts.delete(address);
  const token = createSessionToken(adminPinHash, { email });
  return send(
    res,
    200,
    JSON.stringify({ ok: true, expiresIn: Math.floor(SESSION_TTL_MS / 1000) }),
    'application/json; charset=utf-8',
    { 'Set-Cookie': sessionCookie(req, token) },
  );
}

async function handleGetUsers(req, res) {
  if (!requireAdminSession(req, res)) return;
  const users = await userStore.get();
  // Strip hashes before sending to client
  const safeUsers = users.map(u => ({ email: u.email, role: u.role }));
  return send(res, 200, JSON.stringify({ ok: true, users: safeUsers }));
}

async function handlePutUsers(req, res) {
  if (!requireAdminSession(req, res)) return;
  const data = JSON.parse(await readBody(req, 1_000_000) || '[]');
  if (!Array.isArray(data)) return send(res, 400, JSON.stringify({ ok: false, error: 'Invalid data' }));
  
  const saved = await userStore.put(data);
  return send(res, 200, JSON.stringify({ ok: true, count: saved.length }));
}
`;
serverCjs = serverCjs.replace(
  /async function handleAdminPinAuth[\s\S]*?\}\n/,
  newHandleLogin
);

// Replace route routing
serverCjs = serverCjs.replace(
  /if \(req\.method === 'POST' && req\.url === '\/api\/auth\/pin'\) \{[\s\S]*?return await handleAdminPinAuth\(req, res\);\n\s*\}/,
  `if (req.method === 'POST' && req.url === '/api/auth/login') {
      return await handleLogin(req, res);
    }
    if (req.method === 'GET' && req.url === '/api/users') {
      return await handleGetUsers(req, res);
    }
    if (req.method === 'POST' && req.url === '/api/users') {
      return await handlePutUsers(req, res);
    }`
);

fs.writeFileSync('server.cjs', serverCjs);
console.log("Updated server.cjs, vault-sync-store.cjs, vault-storage.js");
