const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const startStr = "let currentUserEmail = '';";
const endStr = "throw error;\n  }\n}";

const startIndex = appJs.indexOf(startStr);
const endIndex = appJs.indexOf(endStr, startIndex) + endStr.length;

if (startIndex >= 0 && endIndex > startIndex) {
  const newFunc = `let currentUserEmail = '';
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
  appJs = appJs.slice(0, startIndex) + newFunc + appJs.slice(endIndex);
  fs.writeFileSync('app.js', appJs);
  console.log("Fixed app.js syntax with slice");
} else {
  console.log("Could not find start/end bounds!");
}
