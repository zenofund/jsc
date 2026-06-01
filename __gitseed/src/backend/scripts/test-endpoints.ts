import fetch from 'node-fetch';

async function testEndpoints() {
  const baseUrl = 'http://localhost:3000/api/v1';
  
  const endpoints = [
    '/loans/types',
    '/loans/applications',
    '/loans/disbursements'
  ];

  for (const endpoint of endpoints) {
    console.log(`\nTesting ${endpoint}...`);
    try {
      const response = await fetch(`${baseUrl}${endpoint}`);
      console.log(`Status: ${response.status}`);
      if (!response.ok) {
        const text = await response.text();
        console.log(`Error Body: ${text}`);
      } else {
        const json = await response.json();
        console.log(`Success, records: ${Array.isArray(json) ? json.length : 'Object'}`);
      }
    } catch (error) {
      console.error(`Failed to fetch ${endpoint}:`, error.message);
    }
  }
}

testEndpoints();
