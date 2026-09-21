const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Update login form
html = html.replace(
  '<input name="pin" type="password" required autocomplete="current-password" autofocus placeholder="PIN หรือรหัสผ่าน" />',
  '<input name="email" type="email" required autocomplete="username" autofocus placeholder="อีเมล (เช่น admin)" style="margin-bottom: 0.5rem;" />\n          <div class="password-input">\n            <input name="password" type="password" required autocomplete="current-password" placeholder="รหัสผ่าน" />'
);
// Fix the closing div for password-input
html = html.replace(
  '<button type="button" class="icon-btn" id="toggleUnlockPassword" aria-label="แสดงรหัสผ่าน" tabindex="-1">',
  '<button type="button" class="icon-btn" id="toggleUnlockPassword" aria-label="แสดงรหัสผ่าน" tabindex="-1">'
);
// Wait, the original structure was:
// <div class="password-input">
//   <input name="pin" ... />
//   <button ...>
// </div>
// Let's replace exactly.
html = fs.readFileSync('index.html', 'utf8');
html = html.replace(
  '<div class="password-input">\n            <input name="pin" type="password" required autocomplete="current-password" autofocus placeholder="PIN หรือรหัสผ่าน" />',
  '<input name="email" type="email" required autocomplete="username" autofocus placeholder="อีเมล (เช่น admin)" style="margin-bottom: 0.5rem;" />\n          <div class="password-input">\n            <input name="password" type="password" required autocomplete="current-password" placeholder="รหัสผ่าน" />'
);

// Add password field to member modal
html = html.replace(
  '<label>สถานะ<select name="status"><option value="invited">Invited</option><option value="confirmed">Confirmed</option><option value="revoked">Revoked</option></select></label>\n        </div>',
  '<label>สถานะ<select name="status"><option value="invited">Invited</option><option value="confirmed">Confirmed</option><option value="revoked">Revoked</option></select></label>\n        </div>\n        <div class="field-row">\n          <label>รหัสผ่าน (กำหนดให้สมาชิก)<input name="password" type="text" placeholder="เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน" /></label>\n        </div>'
);

fs.writeFileSync('index.html', html);
console.log("Updated index.html");
