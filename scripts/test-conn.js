/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http');
const url = 'http://10.10.220.253:8000/';

console.log(`Node.js version: ${process.version}`);
console.log(`Attempting to connect to ${url}...`);

const req = http.get(url, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', () => {});
  res.on('end', () => {
    console.log('Connection successful!');
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
  console.error(e);
  process.exit(1);
});

req.end();
