const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

appJs = appJs.replace(
  /let currentUserEmail = '';\nasync function authenticateServerLogin[\s\S]*?error\.code = response\.status;\n    throw error;\n  \}\n\}/,
  `let currentUserEmail = '';
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
}`
);

fs.writeFileSync('app.js', appJs);
console.log("Fixed app.js syntax");
