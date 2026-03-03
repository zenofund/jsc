# Password Recovery Database Setup

## Quick Setup

### 1. Apply the Migration

**Option A: Via Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor"
4. Paste contents of `/backend/database/migrations/015_create_password_reset_tokens.sql`
5. Click "Run"

**Option B: Via psql**
```bash
psql "your-supabase-connection-string" \
  -f database/migrations/015_create_password_reset_tokens.sql
```

### 2. Verify Table Creation
```sql
SELECT * FROM password_reset_tokens LIMIT 1;
```

Should return an empty result (no errors).

### 3. Test the System
```bash
# Start backend
npm run start:dev

# In another terminal, test the endpoint
curl -X POST http://localhost:3000/api/v1/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"your-test-email@example.com"}'
```

## Environment Variables

Add to `/backend/.env` (optional, has defaults):
```env
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

## Done! ✅

The password recovery system is now ready to use. See `/PASSWORD_RECOVERY_SYSTEM.md` for full documentation.
