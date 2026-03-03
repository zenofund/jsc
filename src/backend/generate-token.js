const jwt = require('jsonwebtoken');
const fs = require('fs');
const secret = '59861c038df581c5e7edebdbb37e323e';
const payload = { 
  userId: '79d8d0b2-5458-45c0-befb-0471fdc1d23b', 
  role: 'admin',
  email: 'test@example.com',
  sub: '79d8d0b2-5458-45c0-befb-0471fdc1d23b'
};
const token = jwt.sign(payload, secret, { expiresIn: '1h' });
fs.writeFileSync('token.txt', token);
console.log('Token written to token.txt');
