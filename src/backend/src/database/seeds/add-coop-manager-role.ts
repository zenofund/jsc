import 'dotenv/config';
import { Client } from 'pg';

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set in environment variables');
    console.log('Current directory:', process.cwd());
    process.exit(1);
  }

  console.log('Connecting to database...');
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if user_role enum exists
    const enumCheck = await client.query(`
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role')
    `);

    if (enumCheck.rows[0].exists) {
      console.log('user_role enum exists, checking for coop_manager...');
      
      const enumValues = await client.query(`
        SELECT unnest(enum_range(NULL::user_role)) as value
      `);
      
      const hasCoopManager = enumValues.rows.some(row => row.value === 'coop_manager');
      
      if (!hasCoopManager) {
        try {
          await client.query('BEGIN');
          await client.query('COMMIT');
          await client.query(`ALTER TYPE user_role ADD VALUE 'coop_manager'`);
          console.log('✅ Added coop_manager to user_role enum');
          await client.query('BEGIN');
        } catch (err: any) {
          console.log('⚠️ Could not add value to enum (might already exist or transaction issue):', err.message);
          await client.query('BEGIN');
        }
      } else {
        console.log('ℹ️ coop_manager already exists in user_role enum');
        await client.query('BEGIN');
      }
    } else {
      console.log('user_role enum does not exist, checking for check constraints...');
      await client.query('BEGIN');
      
      const constraintCheck = await client.query(`
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%role%'
      `);

      let constraintUpdated = false;

      for (const row of constraintCheck.rows) {
        console.log(`Found constraint: ${row.conname} - ${row.definition}`);
        if (!row.definition.includes('coop_manager')) {
           console.log(`Updating constraint ${row.conname}...`);
           await client.query(`ALTER TABLE users DROP CONSTRAINT ${row.conname}`);
           
           await client.query(`
             ALTER TABLE users ADD CONSTRAINT ${row.conname} 
             CHECK (role IN ('admin', 'super_admin', 'staff', 'payroll_officer', 'hr_manager', 'reviewer', 'checking', 'approver', 'cpo', 'auditor', 'cashier', 'payroll_loader', 'coop_manager'))
           `);
           console.log(`✅ Updated constraint ${row.conname}`);
           constraintUpdated = true;
        } else {
           console.log(`ℹ️ Constraint ${row.conname} already includes coop_manager`);
        }
      }
      
      if (!constraintCheck.rows.length) {
        console.log('ℹ️ No role check constraints found on users table.');
      }
    }

    // ==================== INSERT COOP_MANAGER PERMISSION TEMPLATES ====================
    console.log('\n📝 Setting up coop_manager permission templates...');

    // Determine the permission keys we'll use for coop/loan module
    // First check existing app_permissions for coop/loan related keys
    const existingPermissions = await client.query(`
      SELECT permission_key FROM app_permissions WHERE permission_key LIKE '%loan%' OR permission_key LIKE '%coop%' OR permission_key LIKE '%cooperative%'
    `);
    console.log('Found existing coop/loan permissions:', existingPermissions.rows.map(r => r.permission_key));

    // Ensure at least generic permissions exist for Coop and Loan modules (create them if missing)
    const coopPermissionsToEnsure = [
      { key: 'cooperative.cooperative.manage', module: 'cooperative', display: 'Manage Cooperatives', desc: 'Full management of cooperative societies' },
      { key: 'cooperative.members.manage', module: 'cooperative', display: 'Manage Cooperative Members', desc: 'Add/edit/remove cooperative members' },
      { key: 'cooperative.contributions.manage', module: 'cooperative', display: 'Manage Contributions', desc: 'Record and manage member contributions' },
      { key: 'loan.loan.manage', module: 'loan', display: 'Manage Loans', desc: 'Full loan management capabilities' },
      { key: 'loan.applications.approve', module: 'loan', display: 'Approve Loan Applications', desc: 'Approve or reject loan applications' },
      { key: 'loan.disbursements.manage', module: 'loan', display: 'Manage Disbursements', desc: 'Manage loan disbursements and repayments' },
    ];

    for (const perm of coopPermissionsToEnsure) {
      await client.query(`
        INSERT INTO app_permissions (permission_key, module_name, display_name, description, is_active)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (permission_key) DO NOTHING
      `, [perm.key, perm.module, perm.display, perm.desc]);
    }
    console.log('✅ Ensured Coop/Loan app_permissions exist');

    // Now grant all coop/loan permissions + common read permissions to coop_manager role template
    // We only use permission_keys that actually exist in app_permissions catalog
    const existingKeys = new Set<string>(existingPermissions.rows.map((r: any) => String(r.permission_key)));
    const newKeys = new Set<string>(coopPermissionsToEnsure.map(p => p.key));
    // Standard catalog keys that every coop manager needs (from migration 055 catalog)
    const standardKeysToAssign = [
      'profile.read',
      'payslip.read',
      'reports.read',
      'reports.export',
      'staff.record.read',
    ];

    const allPermissionsForCoopMgr: string[] = [];
    for (const k of [...standardKeysToAssign, ...newKeys, ...existingKeys]) {
      allPermissionsForCoopMgr.push(k);
    }

    const uniquePerms = Array.from(new Set(allPermissionsForCoopMgr));

    let assigned = 0;
    for (const permKey of uniquePerms) {
      try {
        await client.query(`
          INSERT INTO app_role_permissions (role_key, permission_key)
          VALUES ($1, $2)
          ON CONFLICT (role_key, permission_key) DO NOTHING
        `, ['coop_manager', permKey]);
        assigned++;
      } catch (err: any) {
        console.log(`  ⚠️ Skipping permission ${permKey}: ${err.message.split('\n')[0]}`);
      }
    }
    console.log(`✅ Assigned ${assigned}/${uniquePerms.length} permissions to coop_manager role template`);

    await client.query('COMMIT');
    console.log('\n✅ Coop Manager role migration completed successfully');
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Migration failed:', err.message || err);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

run();
