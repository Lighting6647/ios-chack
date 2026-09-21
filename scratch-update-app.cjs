const fs = require('fs');

// Update server.cjs for handlePutUsers
let serverCjs = fs.readFileSync('server.cjs', 'utf8');
const newHandlePutUsers = `async function handlePutUsers(req, res) {
  if (!requireAdminSession(req, res)) return;
  const data = JSON.parse(await readBody(req, 1_000_000) || '[]');
  
  const existingUsers = await userStore.get();
  const nextUsers = [];

  for (const item of data) {
    const existing = existingUsers.find(u => u.email === item.email);
    let authHash = existing ? existing.authHash : null;
    if (item.password) {
      authHash = await createPinHash(item.password);
    }
    nextUsers.push({
      email: item.email,
      role: item.role,
      authHash: authHash
    });
  }
  const saved = await userStore.put(nextUsers);
  return send(res, 200, JSON.stringify({ ok: true, count: saved.length }));
}`;
serverCjs = serverCjs.replace(
  /async function handlePutUsers[\s\S]*?count: saved\.length \}\)\);\n\}/,
  newHandlePutUsers
);
fs.writeFileSync('server.cjs', serverCjs);

// Update app.js
let appJs = fs.readFileSync('app.js', 'utf8');

// 1. authenticateServerPin -> authenticateServerLogin
appJs = appJs.replace(
  /async function authenticateServerPin\(pin\) \{[\s\S]*?body: JSON\.stringify\(\{ pin \}\),[\s\S]*?\}/,
  `let currentUserEmail = '';
async function authenticateServerLogin(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'การเข้าสู่ระบบล้มเหลว');
  currentUserEmail = email;
  return data;
}`
);
appJs = appJs.replace(
  "await authenticateServerPin(pin);",
  "const email = unlockForm.elements.email.value.trim().toLowerCase();\n    await authenticateServerLogin(email, pin);"
);

// 2. unlockStoredVault -> pass email
appJs = appJs.replace(
  "await unlockStoredVault(pin);",
  "await unlockStoredVault(email, pin);"
);

// 3. syncUsersWithServer
const syncUsersCode = `
async function syncUsersWithServer() {
  const members = vault.members || [];
  // Include owner/admin if not in members
  const payload = members.map(m => ({
    email: m.email,
    role: m.role,
    password: m._newPassword || undefined
  }));
  
  // Make sure current user is in payload so they don't lock themselves out
  if (!payload.find(p => p.email === currentUserEmail)) {
     payload.push({ email: currentUserEmail, role: 'owner' });
  }

  await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
`;
appJs = appJs.replace(
  "async function saveMember(data) {",
  syncUsersCode + "\nasync function saveMember(data) {"
);

// Modify saveMember to handle keyrings and password
appJs = appJs.replace(
  /const isNew = \!existing;\n\s*if \(existing\) Object\.assign\(existing, member\);\n\s*else vault\.members\.push\(member\);/,
  `const isNew = !existing;
  if (data.password) {
    member._newPassword = data.password; // Temp store to send to server
    // Add keyring
    const { addKeyring } = await import('./vault-crypto.js');
    const newKeyring = await addKeyring(vaultKey, member.email, data.password);
    if (!vaultEnvelope.keyrings) vaultEnvelope.keyrings = [];
    const index = vaultEnvelope.keyrings.findIndex(k => k.email === member.email);
    if (index >= 0) vaultEnvelope.keyrings[index] = newKeyring;
    else vaultEnvelope.keyrings.push(newKeyring);
  }
  
  if (existing) Object.assign(existing, member);
  else vault.members.push(member);
  
  await syncUsersWithServer();
  // Clear temp password from local memory
  delete member._newPassword;`
);

// Update view filtering
appJs = appJs.replace(
  /const items = \(vault\.items \|\| \[\]\)/,
  `const currentUser = (vault.members || []).find(m => m.email === currentUserEmail) || { role: 'owner' };
  const items = (vault.items || []).filter(item => {
    if (currentUser.role === 'owner' || currentUser.role === 'admin') return true;
    return (item.collectionIds || []).some(id => (currentUser.collectionIds || []).includes(id));
  })`
);

fs.writeFileSync('app.js', appJs);
console.log("Updated server.cjs and app.js");
