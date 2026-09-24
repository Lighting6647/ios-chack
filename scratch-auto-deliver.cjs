const fs = require('fs');
let serverCjs = fs.readFileSync('server.cjs', 'utf8');

// Require the crypto module at the top
serverCjs = serverCjs.replace(
  "const { createRequestStore } = require('./request-store.cjs');",
  "const { createRequestStore } = require('./request-store.cjs');\nconst { unlockVaultEnvelope } = require('./vault-crypto-node.cjs');"
);

// Add the auto delivery logic function
const autoDeliverFunc = `
async function attemptAutoDeliver(item) {
  const botEmail = process.env.AUTO_DELIVER_BOT_EMAIL;
  const botPassword = process.env.AUTO_DELIVER_BOT_PASSWORD;
  if (!botEmail || !botPassword) return false;

  const envelope = await vaultStore.get();
  if (!envelope) return false;

  try {
    const { vault } = await unlockVaultEnvelope(envelope, botEmail, botPassword);
    
    // Find the requested item in the vault
    let targetItem = null;
    if (item.requestVaultItemId) {
      targetItem = vault.items.find(i => i.id === item.requestVaultItemId);
    } else {
      // Search by system/account name
      const searchTarget = item.requestAccount || item.system;
      targetItem = vault.items.find(i => 
        i.name.toLowerCase() === searchTarget.toLowerCase() || 
        i.name.toLowerCase().includes(searchTarget.toLowerCase())
      );
    }

    if (targetItem && targetItem.password) {
      // Send directly to Lark
      const message = \`✅ พบข้อมูลที่คุณขอแล้ว\\n\\n👤 บัญชี: \${targetItem.name}\\n📧 Username: \${targetItem.username || '-'}\\n🔑 Password: \${targetItem.password}\`;
      await sendLarkMessage(item.larkChatId, 'text', larkTextContent(message));
      
      // Save request as delivered
      item.status = 'delivered';
      const current = await readRequests();
      current.unshift(item);
      await writeRequests(current);
      return true;
    }
  } catch (error) {
    console.error("Auto deliver failed:", error.message);
  }
  return false;
}
`;

// Insert the function before handleLarkWebhook
serverCjs = serverCjs.replace(
  "async function handleLarkWebhook(req, res) {",
  autoDeliverFunc + "\nasync function handleLarkWebhook(req, res) {"
);

// Call attemptAutoDeliver in handleLarkWebhook
serverCjs = serverCjs.replace(
  "const item = await parseLarkCardRequest(payload, value);",
  "const item = await parseLarkCardRequest(payload, value);\n      if (item) {\n        const delivered = await attemptAutoDeliver(item);\n        if (delivered) return send(res, 200, JSON.stringify({ toast: { type: 'success', content: 'ระบบได้ส่งรหัสผ่านให้ทางแชตเรียบร้อยแล้ว' } }));\n      }"
);

// Handle text request auto delivery
serverCjs = serverCjs.replace(
  "const current = await readRequests();",
  `const delivered = await attemptAutoDeliver(item);
          if (delivered) {
            return send(res, 200, JSON.stringify({ ok: true, delivered: true }));
          }
          const current = await readRequests();`
);

fs.writeFileSync('server.cjs', serverCjs);
console.log("Updated server.cjs for Auto Deliver");
