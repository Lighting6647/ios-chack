const fs = require('fs');
let renderYaml = fs.readFileSync('render.yaml', 'utf8');

renderYaml += `      - key: AUTO_DELIVER_BOT_EMAIL\n        sync: false\n      - key: AUTO_DELIVER_BOT_PASSWORD\n        sync: false\n`;

fs.writeFileSync('render.yaml', renderYaml);
console.log("Updated render.yaml");
