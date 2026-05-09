const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bosPx5R4VXKZ@ep-tiny-credit-ajix0564.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    // 1. Get last 5 notifications
    const res = await client.query(`
      SELECT id, recipient_id, recipient_role, is_read, created_at, title 
      FROM notifications 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('Last 5 notifications:');
    console.table(res.rows);

    if (res.rows.length > 0) {
      const targetUser = res.rows[0].recipient_id;
      const targetRole = res.rows[0].recipient_role;
      
      console.log(`Checking unread count for user: ${targetUser}, role: ${targetRole}`);

      // 2. Check count query manually
      const countRes = await client.query(`
        SELECT COUNT(*) as count FROM notifications 
        WHERE (recipient_id = $1 OR recipient_id = 'all')
          AND (recipient_role IS NULL OR recipient_role = $2)
          AND is_read = false
          AND (expires_at IS NULL OR expires_at > NOW())
      `, [targetUser, targetRole]);
      
      console.log('Count result:', countRes.rows[0]);
    }

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
