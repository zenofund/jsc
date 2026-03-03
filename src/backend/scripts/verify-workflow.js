
const BASE_URL = 'http://localhost:3000/api/v1';

async function verifyWorkflow() {
  console.log('🚀 Starting Verification Workflow...');

  try {
    // 1. Login as Admin
    console.log('\n1. Logging in as Admin...');
    const adminLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jsc.gov.ng', password: 'admin123' }),
    });
    
    if (!adminLogin.ok) throw new Error(`Admin login failed: ${adminLogin.statusText}`);
    const adminData = await adminLogin.json();
    const adminToken = adminData.access_token;
    console.log('✅ Admin logged in');

    // 2. Create New Staff (Auto-creates User)
    console.log('\n2. Creating New Staff Member...');
    const timestamp = Date.now();
    const staffEmail = `verify.${timestamp}@jsc.gov.ng`;
    const staffPassword = '12345678'; // Default password from staff.service.ts
    
    // Get Department first
    const deptsRes = await fetch(`${BASE_URL}/departments`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const depts = await deptsRes.json();
    const deptId = (depts.data || depts.items || depts)[0].id;

    // Create Staff
    const createStaffRes = await fetch(`${BASE_URL}/staff`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            firstName: 'Verify',
            lastName: 'User',
            dateOfBirth: '1990-01-01',
            email: staffEmail,
            departmentId: deptId,
            designation: 'Tester',
            employmentType: 'Permanent',
            employmentDate: '2024-01-01',
            currentBasicSalary: 100000,
            gradeLevel: 8,
            step: 2,
            stateOfOrigin: 'Lagos',
            gender: 'male',
            maritalStatus: 'single',
            unit: 'Testing',
            cadre: 'Admin',
            address: '123 Test St',
            phone: '08000000000'
        }),
    });

    if (!createStaffRes.ok) {
        console.log('Failed to create staff:', await createStaffRes.text());
        throw new Error('Staff creation failed');
    }
    const newStaff = await createStaffRes.json();
    console.log(`✅ Staff created: ${newStaff.first_name} ${newStaff.last_name} (${staffEmail})`);

    // 3. Login as New Staff
    console.log('\n3. Logging in as New Staff...');
    // Give a moment for async user creation if any (though code looked awaited)
    await new Promise(r => setTimeout(r, 1000));

    const staffLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: staffEmail, password: staffPassword }),
    });
    
    if (!staffLogin.ok) throw new Error(`Staff login failed: ${staffLogin.statusText} - ${await staffLogin.text()}`);
    const staffData = await staffLogin.json();
    const staffToken = staffData.access_token;
    console.log('✅ Staff logged in');

    // 4. Get Leave Types
    console.log('\n4. Fetching Leave Types...');
    const leaveTypesRes = await fetch(`${BASE_URL}/leave/types`, {
        headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    const leaveTypes = await leaveTypesRes.json();
    const annualLeave = (leaveTypes.data || leaveTypes.items || leaveTypes).find(l => l.name === 'Annual Leave');
    
    if (!annualLeave) throw new Error('Annual Leave type not found');
    console.log(`✅ Found Annual Leave Type ID: ${annualLeave.id}`);

    // 4.5 Initialize Leave Balances (Admin)
    console.log('\n4.5 Initializing Leave Balances...');
    const initBalanceRes = await fetch(`${BASE_URL}/leave/balances/initialize`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ year: new Date().getFullYear() }),
    });
    
    if (!initBalanceRes.ok) {
         console.log('Initialize balances warning:', await initBalanceRes.text());
    } else {
         const initResult = await initBalanceRes.json();
         console.log(`✅ Leave Balances Initialized: ${initResult.initialized || 0} created`);
    }

    // 5. Submit Leave Request
    console.log('\n5. Submitting Leave Request...');
    const leaveRequestRes = await fetch(`${BASE_URL}/leave/requests`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${staffToken}`
        },
        body: JSON.stringify({
            staffId: newStaff.id,
            leaveTypeId: annualLeave.id,
            startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
            endDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], // 3 days
            reason: 'Test Leave Request'
        }),
    });
    
    if (!leaveRequestRes.ok) {
        console.log('Submission failed:', await leaveRequestRes.text());
        throw new Error('Leave request submission failed');
    }
    const leaveRequest = await leaveRequestRes.json();
    console.log(`✅ Leave Request Submitted: ${leaveRequest.request_number} (ID: ${leaveRequest.id})`);

    // 6. Login as HR
    console.log('\n6. Logging in as HR...');
    const hrLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'hr@jsc.gov.ng', password: 'hr123' }),
    });

    let approvalToken = adminToken;

    if (hrLogin.ok) {
        const hrData = await hrLogin.json();
        approvalToken = hrData.access_token;
        console.log('✅ HR logged in');
    } else {
        console.log('⚠️ HR login failed, trying with Admin token. Reason:', await hrLogin.text());
    }

    // 7. Approve Leave Request
    console.log('\n7. Approving Leave Request...');
    const approveRes = await fetch(`${BASE_URL}/leave/requests/${leaveRequest.id}/approve`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${approvalToken}`
        },
        body: JSON.stringify({ remarks: 'Approved via Verification Script' }),
    });

    if (!approveRes.ok) {
        console.log('Approval failed:', await approveRes.text());
        throw new Error('Leave approval failed');
    }
    console.log('✅ Leave Request Approved');

    // 8. Verify Audit Log
    console.log('\n8. Verifying Audit Log...');
    // Wait a bit for async logging if any
    await new Promise(r => setTimeout(r, 1000));

    const auditRes = await fetch(`${BASE_URL}/audit?entity=leave_request&entityId=${leaveRequest.id}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const auditLogs = await auditRes.json();
    const logs = auditLogs.data || auditLogs.items || (Array.isArray(auditLogs) ? auditLogs : []);
    
    const approvalLog = logs.find(l => l.action === 'APPROVE' || l.action === 'approve' || l.description.includes('Approved'));
    
    if (approvalLog) {
        console.log('✅ Audit Log Found:', approvalLog);
        console.log('🎉 VERIFICATION SUCCESSFUL: Full workflow verified!');
    } else {
        console.log('❌ Audit Log NOT Found for approval action');
        console.log('Logs found:', logs);
    }

  } catch (error) {
    console.error('❌ Verification Failed:', error);
  }
}

verifyWorkflow();
