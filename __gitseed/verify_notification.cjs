const http = require('http');
// Try to load jsonwebtoken from backend node_modules
let jwt;
try {
  jwt = require('./src/backend/node_modules/jsonwebtoken');
} catch (e) {
  try {
    jwt = require('jsonwebtoken');
  } catch (e2) {
    console.error('jsonwebtoken not found. Please install it or run from a place where it is available.');
    process.exit(1);
  }
}

const SECRET = '59861c038df581c5e7edebdbb37e323e';
// Payload structure must match what NestJS JwtStrategy expects
// Usually it's sub (userId) and username/email/role
const USER = { 
  sub: 'test-user-123', // Standard JWT subject
  userId: 'test-user-123', // Custom field often used
  role: 'admin', 
  email: 'test@example.com' 
};

const token = jwt.sign(USER, SECRET, { expiresIn: '1h' });
console.log('Generated Token for test user:', USER.userId);

// Helper for requests
function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  try {
    // 1. Create notification
    console.log('\n1. Creating notification...');
    const createRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      recipient_id: USER.userId,
      type: 'system',
      category: 'info',
      title: 'Test Notification ' + Date.now(),
      message: 'This is a test notification created at ' + new Date().toISOString(),
      priority: 'high'
    });
    console.log('Create response status:', createRes.status);
    console.log('Create response data:', JSON.stringify(createRes.data, null, 2));

    if (createRes.status >= 400) {
      console.error('Failed to create notification. Aborting.');
      return;
    }

    // 2. Get unread count
    console.log('\n2. Getting unread count...');
    const countRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/notifications/unread-count',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('Count response status:', countRes.status);
    console.log('Count response data:', JSON.stringify(countRes.data, null, 2));

    if (countRes.data && typeof countRes.data.unreadCount === 'number') {
      console.log('\nSUCCESS: unreadCount field is present and is a number:', countRes.data.unreadCount);
      if (countRes.data.unreadCount > 0) {
        console.log('VERIFIED: Count is > 0 as expected.');
      } else {
        console.warn('WARNING: Count is 0. Maybe notification was not created correctly or user context issue?');
      }
    } else {
      console.error('\nFAILURE: unreadCount field missing or invalid.');
    }

  } catch (error) {
    console.error('Error running test:', error);
  }
}

run();
