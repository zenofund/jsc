/**
 * Simple script to generate bcrypt password hashes
 * Usage: node scripts/hash-password.js yourpassword
 */

const bcrypt = require('bcrypt');

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.js <password>');
  process.exit(1);
}

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    process.exit(1);
  }
  
  console.log('\nPassword:', password);
  console.log('Hashed:', hash);
  console.log('\nUpdate seeds.sql with this hash:');
  console.log(`'${hash}'`);
});
