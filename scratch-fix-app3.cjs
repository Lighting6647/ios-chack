const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const startStr = "let currentUserEmail = '';";
const startIndex = appJs.indexOf(startStr);
const endStr = "throw error;\n  }\n}";
const endIndex = appJs.indexOf(endStr, startIndex);

if (startIndex >= 0 && endIndex > 0) {
  const replacement = `let currentUserEmail = '';
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
  appJs = appJs.slice(0, startIndex) + replacement + appJs.slice(endIndex + endStr.length);
  fs.writeFileSync('app.js', appJs);
  console.log("Fixed app.js syntax using exact indices");
} else {
  console.log("Error finding indices", startIndex, endIndex);
}
