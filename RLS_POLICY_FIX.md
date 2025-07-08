# RLS Policy Fix for admin_users Table

## Problem
Registration was failing with the error:
```
"Failed to create admin user: new row violates row-level security policy for table \"admin_users\""
```

## Root Cause
The `admin_users` table had Row Level Security (RLS) enabled, but the existing RLS policies were not properly configured to allow the backend service role to insert new admin users during registration.

## Solution Applied

### 1. Updated RLS Policies
Replaced the existing policies with proper ones:

```sql
-- Create comprehensive service role policy
CREATE POLICY "Service role full access" ON admin_users
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Create policy for authenticated users to read their own record
CREATE POLICY "Users can read own admin record" ON admin_users
FOR SELECT 
TO authenticated 
USING (auth_user_id = auth.uid());
```

### 2. Policy Details

#### Service Role Policy
- **Name**: "Service role full access"
- **Operations**: ALL (SELECT, INSERT, UPDATE, DELETE)
- **Role**: `service_role`
- **Condition**: `true` (no restrictions)
- **Purpose**: Allows the backend to perform all operations on admin_users table

#### User Self-Read Policy
- **Name**: "Users can read own admin record"
- **Operations**: SELECT only
- **Role**: `authenticated`
- **Condition**: `auth_user_id = auth.uid()`
- **Purpose**: Allows authenticated users to read their own admin record

## How Registration Now Works

1. **Backend uses service role**: The backend is configured with `SUPABASE_SERVICE_ROLE_KEY`
2. **Service role bypasses restrictions**: The "Service role full access" policy allows unrestricted access
3. **Successful registration flow**:
   - Create user in Supabase Auth ✅
   - Insert record in admin_users table ✅ (now allowed by RLS policy)
   - Return user details ✅

## Security Considerations

- **Service role security**: The service role key should only be used on the backend server
- **User access control**: Regular users can only read their own admin record
- **Environment protection**: Service role key is stored in environment variables

## Verification

The registration should now work successfully:
- ✅ Supabase Auth user creation
- ✅ admin_users table insert (RLS policy allows it)
- ✅ Complete registration flow

## Future Considerations

If you need more granular access control in the future, you can:
- Add specific policies for different admin roles
- Implement audit logging for admin user changes
- Add approval workflows for new admin registrations 