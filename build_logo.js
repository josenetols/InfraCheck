const fs = require('fs');
const b64 = fs.readFileSync('saga_logo_b64.txt', 'utf8').trim();
fs.writeFileSync('src/utils/logoBase64.ts', 'export const SAGA_LOGO_BASE64 = \'' + b64 + '\';\n');
console.log('Done!');
