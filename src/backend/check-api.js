const http = require('http');
const fs = require('fs');

const token = fs.readFileSync('token.txt', 'utf8').trim();

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/v1/notifications/unread-count',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', data);
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.end();
