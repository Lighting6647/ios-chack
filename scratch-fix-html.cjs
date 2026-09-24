const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Update login form
html = html.replace(
  '<label>รหัสผ่านหรือ PIN<div class="input-with-actions"><input name="password" type="password" required autocomplete="current-password" autocapitalize="off" spellcheck="false" autofocus /><button type="button" id="toggleUnlockPassword">ดูรหัส</button></div></label>',
  '<label>อีเมล (เช่น admin)<input name="email" type="email" required autocomplete="username" autofocus placeholder="ใส่อีเมลของคุณ" style="margin-bottom: 0.5rem;" /></label>\n            <label>รหัสผ่าน<div class="input-with-actions"><input name="password" type="password" required autocomplete="current-password" autocapitalize="off" spellcheck="false" /><button type="button" id="toggleUnlockPassword">ดูรหัส</button></div></label>'
);

// Update member form
html = html.replace(
  '<label>สถานะ<select name="status"><option value="invited">Invited</option><option value="confirmed">Confirmed</option><option value="revoked">Revoked</option></select></label></div>',
  '<label>สถานะ<select name="status"><option value="invited">Invited</option><option value="confirmed">Confirmed</option><option value="revoked">Revoked</option></select></label></div>\n        <div class="field-row"><label>รหัสผ่าน (กำหนดให้สมาชิก)<input name="password" type="text" placeholder="เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน" /></label></div>'
);

fs.writeFileSync('index.html', html);
console.log("Fixed index.html properly");
