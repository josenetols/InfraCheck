import fs from 'fs';
const env = fs.readFileSync('/home/ubuntu/InfraCheck/.env.local', 'utf8').split('\n').reduce((a,c)=>{
  const i = c.indexOf('=');
  if(i>0) a[c.slice(0,i).trim()] = c.slice(i+1).trim();
  return a;
}, {});
console.log('Email configurado:', env['SMTP_USER']);
console.log('Tamanho da senha:', env['SMTP_PASS'] ? env['SMTP_PASS'].length : 0);
