const fs = require('fs');
const b64 = fs.readFileSync('public/logo_saga.png').toString('base64');
const dataUrl = 'data:image/png;base64,' + b64;
const content = 'export const SAGA_LOGO_BASE64 = `' + dataUrl + '`;\n';
fs.writeFileSync('src/utils/logoBase64.ts', content);
console.log('Logo base64 salva! Tamanho:', content.length, 'bytes');
