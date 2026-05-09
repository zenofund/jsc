/**
 * Test Salary Structure API
 * 
 * This script tests the salary structure API endpoints
 * Run with: node backend/scripts/test-salary-api.js
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, symbol, message) {
  console.log(`${color}${symbol} ${message}${colors.reset}`);
}

async function testEndpoint(name, url, method = 'GET', body = null, token = null) {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    log(colors.cyan, '🔄', `Testing: ${name}`);
    log(colors.blue, '  →', `${method} ${url}`);

    const response = await fetch(url, options);
    const data = await response.json();

    if (response.ok) {
      log(colors.green, '  ✅', `Success (${response.status})`);
      return { success: true, data };
    } else {
      log(colors.red, '  ❌', `Failed (${response.status}): ${data.message || 'Unknown error'}`);
      return { success: false, error: data };
    }
  } catch (error) {
    log(colors.red, '  ❌', `Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  log(colors.yellow, '🧪', 'JSC Payroll - Salary Structure API Test');
  console.log('='.repeat(60) + '\n');

  log(colors.blue, 'ℹ️', `Testing against: ${BASE_URL}`);
  console.log('');

  // Test 1: Health Check
  log(colors.yellow, '📋', 'Test 1: Health Check');
  const health = await testEndpoint(
    'Health Check',
    `${BASE_URL}/health`,
    'GET'
  );
  console.log('');

  if (!health.success) {
    log(colors.red, '❌', 'Backend is not running or not accessible!');
    log(colors.yellow, '💡', 'Make sure to start the backend: cd backend && npm run start:dev');
    process.exit(1);
  }

  // Test 2: Login (to get auth token)
  log(colors.yellow, '📋', 'Test 2: Authentication');
  log(colors.cyan, 'ℹ️', 'Attempting to login as admin...');
  
  const login = await testEndpoint(
    'Login',
    `${BASE_URL}/auth/login`,
    'POST',
    {
      email: 'admin@jsc.gov.ng',
      password: 'admin123'
    }
  );
  console.log('');

  let authToken = null;
  if (login.success && login.data.access_token) {
    authToken = login.data.access_token;
    log(colors.green, '✅', 'Successfully authenticated');
    log(colors.blue, '  →', `Token: ${authToken.substring(0, 20)}...`);
  } else {
    log(colors.yellow, '⚠️', 'Could not authenticate. Some tests will be skipped.');
    log(colors.cyan, 'ℹ️', 'Make sure you have run: cd backend && npm run db:seed');
  }
  console.log('');

  // Test 3: Get Active Salary Structure
  log(colors.yellow, '📋', 'Test 3: Get Active Salary Structure');
  const activeStructure = await testEndpoint(
    'Get Active Structure',
    `${BASE_URL}/salary-structures/active`,
    'GET',
    null,
    authToken
  );
  console.log('');

  if (!activeStructure.success) {
    log(colors.yellow, '⚠️', 'No active salary structure found!');
    log(colors.cyan, 'ℹ️', 'Run the seeder: cd backend && npm run db:seed-salary');
    console.log('');
    
    // Skip remaining tests
    log(colors.yellow, '📋', 'Skipping remaining tests (no active structure)');
    console.log('\n' + '='.repeat(60));
    log(colors.yellow, '⚠️', 'Setup Required: Please run the salary structure seeder');
    log(colors.cyan, '  →', 'Command: cd backend && npm run db:seed-salary');
    console.log('='.repeat(60) + '\n');
    process.exit(0);
  }

  const structure = activeStructure.data;
  log(colors.green, '✅', `Found: ${structure.name} (${structure.code})`);
  log(colors.blue, '  →', `Status: ${structure.status}`);
  log(colors.blue, '  →', `Grade Levels: ${structure.grade_levels?.length || 0}`);
  log(colors.blue, '  →', `Effective Date: ${structure.effective_date}`);
  console.log('');

  // Test 4: Get Salary for Specific Grade/Step
  log(colors.yellow, '📋', 'Test 4: Get Salary for Grade 7 Step 1');
  const salaryLookup = await testEndpoint(
    'Get Salary for GL7 Step 1',
    `${BASE_URL}/salary-structures/${structure.id}/salary/7/1`,
    'GET',
    null,
    authToken
  );
  console.log('');

  if (salaryLookup.success) {
    const salary = salaryLookup.data;
    log(colors.green, '✅', 'Salary lookup successful');
    log(colors.blue, '  →', `Grade Level: ${salary.gradeLevel}`);
    log(colors.blue, '  →', `Step: ${salary.step}`);
    log(colors.blue, '  →', `Basic Salary: ₦${salary.basicSalary?.toLocaleString()}`);
    log(colors.blue, '  →', `Structure: ${salary.structureName}`);
  }
  console.log('');

  // Test 5: Test Multiple Grade/Step Combinations
  log(colors.yellow, '📋', 'Test 5: Test Multiple Grade/Step Combinations');
  const testCombinations = [
    { grade: 8, step: 1 },
    { grade: 10, step: 1 },
    { grade: 12, step: 1 },
  ];

  let allPassed = true;
  for (const combo of testCombinations) {
    const result = await testEndpoint(
      `GL${combo.grade} Step ${combo.step}`,
      `${BASE_URL}/salary-structures/${structure.id}/salary/${combo.grade}/${combo.step}`,
      'GET',
      null,
      authToken
    );
    
    if (result.success) {
      log(colors.blue, '  →', `GL${combo.grade} Step ${combo.step}: ₦${result.data.basicSalary?.toLocaleString()}`);
    } else {
      allPassed = false;
    }
  }
  console.log('');

  // Test 6: Test Invalid Grade/Step (should fail)
  log(colors.yellow, '📋', 'Test 6: Test Invalid Grade/Step (Expected to Fail)');
  const invalidLookup = await testEndpoint(
    'Get Salary for GL99 Step 99',
    `${BASE_URL}/salary-structures/${structure.id}/salary/99/99`,
    'GET',
    null,
    authToken
  );
  
  if (!invalidLookup.success) {
    log(colors.green, '✅', 'Correctly rejected invalid grade/step');
  } else {
    log(colors.red, '❌', 'Should have rejected invalid grade/step!');
    allPassed = false;
  }
  console.log('');

  // Final Summary
  console.log('='.repeat(60));
  if (allPassed) {
    log(colors.green, '🎉', 'All Tests Passed!');
    log(colors.green, '✅', 'Salary Structure API is working correctly');
    log(colors.cyan, '  →', 'You can now use the promotion modal and staff creation');
  } else {
    log(colors.yellow, '⚠️', 'Some tests failed - review the output above');
  }
  console.log('='.repeat(60) + '\n');
}

// Run the tests
runTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
