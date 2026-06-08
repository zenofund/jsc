const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/loans/repayments',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response:', res.statusCode, data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(JSON.stringify({
  disbursementId: '12345678-1234-1234-1234-123456789012',
  amount: 10000,
  month: '2023-10'
}));
req.end();
