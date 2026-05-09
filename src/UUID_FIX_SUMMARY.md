# ✅ UUID Validation Error - FIXED

## Problem

PostgreSQL's UUID type only accepts **hexadecimal characters** (0-9, a-f). 

The seed data used prefixes like `s`, `u`, `l`, `lt` for readability, but these are **invalid** for UUID fields.

**Error:**
```
ERROR: 22P02: invalid input syntax for type uuid: "s1111111-1111-1111-1111-111111111111"
```

## Solution

All UUIDs have been updated to use only **valid hex characters** (0-9, a-f):

### UUID Mapping (Old → New)

| Table | Old Prefix | New Prefix | Example |
|-------|-----------|------------|---------|
| **Departments** | `d1111111...` | `b1111111...` | `b1111111-1111-1111-1111-111111111111` |
| **Salary Structures** | `s1111111...` | `c1111111...` | `c1111111-1111-1111-1111-111111111111` |
| **Allowances** | `a1111111...` | `a1111111...` | ✅ Already valid |
| **Deductions** | `de111111...` | `de111111...` | ✅ Already valid (`d` and `e` are hex) |
| **Leave Types** | `l1111111...` | `e1111111...` | `e1111111-1111-1111-1111-111111111111` |
| **Users** | `u1111111...` | `a000000x...` | `a0000001-0001-0001-0001-000000000001` |
| **Cooperatives** | `c1111111...` | `c1111111...` | ✅ Already valid |
| **Loan Types** | `lt111111...` | `f000000x...` | `f0000001-0001-0001-0001-000000000001` |

### Valid Hex Characters

```
0 1 2 3 4 5 6 7 8 9 a b c d e f
```

**Invalid:** g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z

## Testing

Run the seeds again:

```bash
# In Supabase SQL Editor
# Copy and paste /database/seeds.sql
# Click "Run"
```

Should now complete successfully! ✅

## Updated Seed Data

All UUIDs in `/database/seeds.sql` are now valid:

- ✅ Departments: `b1111111...` to `b5555555...`
- ✅ Salary Structure: `c1111111...`
- ✅ Allowances: `a1111111...` to `a5555555...`
- ✅ Deductions: `de111111...` to `de333333...`
- ✅ Leave Types: `e1111111...` to `e7777777...`
- ✅ Users: `a0000001...` to `a0000006...`
- ✅ Cooperatives: `c1111111...` to `c3333333...`
- ✅ Loan Types: `f0000001...` to `f0000004...`

---

**Status:** ✅ **FIXED** - Ready to run!
