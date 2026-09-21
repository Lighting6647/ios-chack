const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// Replace the entire authenticateServerPin function
const newAuthFunc = `let currentUserEmail = '';
async function authenticateServerLogin(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    const error = new Error(
      result.error
      || (response.status === 429
        ? "ลองรหัสไม่ถูกต้องหลายครั้ง กรุณารอสักครู่"
        : "Server ปฏิเสธการเข้าสู่ระบบ"),
    );
    error.code = response.status;
    throw error;
  }
  currentUserEmail = email;
  return result;
}`;
appJs = appJs.replace(
  /async function authenticateServerPin\(pin\) \{[\s\S]*?return result;\n\}/,
  newAuthFunc
);

// 2. unlockStoredVault -> pass email
appJs = appJs.replace(
  "await authenticateServerPin(pin);",
  "const email = unlockForm.elements.email.value.trim().toLowerCase();\n    await authenticateServerLogin(email, pin);"
);

appJs = appJs.replace(
  "await unlockStoredVault(pin);",
  "await unlockStoredVault(email, pin);"
);

// 3. syncUsersWithServer
const syncUsersCode = `
async function syncUsersWithServer() {
  const members = vault.members || [];
  const payload = members.map(m => ({
    email: m.email,
    role: m.role,
    password: m._newPassword || undefined
  }));
  
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
    member._newPassword = data.password;
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
console.log("Updated app.js correctly");
