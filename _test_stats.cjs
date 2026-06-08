const fetch = require('node-fetch'); // we might not have node-fetch, wait, we can just query the DB directly, or use http module

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/stats?startDate=2026-02-28&endDate=2026-03-30',
  method: 'GET',
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (d) => {
    data += d;
  });
  res.on('end', () => {
    console.log('--- STATS ---');
    console.log(data);
  });
});
req.on('error', (e) => {
  console.error(e);
});
req.end();

const req2 = http.request({ ...options, path: '/api/stats/status-distribution' }, (res) => {
  let data = '';
  res.on('data', (d) => { data += d; });
  res.on('end', () => { console.log('--- DIST ---'); console.log(data); });
});
req2.end();
