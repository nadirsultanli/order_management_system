# Supabase Backend Setup Guide

## Required Environment Variables

The backend requires specific Supabase environment variables to function properly. These need to be configured before the backend can start.

## Step 1: Get Your Supabase Service Role Key

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/trcrjinrdjgizqhjdgvc
2. Navigate to **Settings** → **API**
3. Copy the **service_role** key (NOT the anon key)

⚠️ **IMPORTANT**: The service_role key has full database access. Keep it secure!

## Step 2: Create Environment Configuration

Create a `.env` file in the `backend/` directory with the following content:

```env
# Supabase Configuration
SUPABASE_URL=https://trcrjinrdjgizqhjdgvc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyY3JqaW5yZGpnaXpxaGpkZ3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNDE2NTAsImV4cCI6MjA2NDYxNzY1MH0.2-y5r5UzIfcGoHc6BPkRy5rnxWxl4SJwxUehPWBxAao
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here

# Server Configuration
PORT=3001
NODE_ENV=development
```

## Step 3: Alternative - Set Environment Variables Directly

If you can't create a `.env` file, you can set the environment variables directly:

### For macOS/Linux:
```bash
export SUPABASE_URL="https://trcrjinrdjgizqhjdgvc.supabase.co"
export SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyY3JqaW5yZGpnaXpxaGpkZ3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNDE2NTAsImV4cCI6MjA2NDYxNzY1MH0.2-y5r5UzIfcGoHc6BPkRy5rnxWxl4SJwxUehPWBxAao"
export SUPABASE_SERVICE_ROLE_KEY="your_actual_service_role_key_here"
cd backend && npm run dev
```

### For Windows (PowerShell):
```powershell
$env:SUPABASE_URL="https://trcrjinrdjgizqhjdgvc.supabase.co"
$env:SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyY3JqaW5yZGpnaXpxaGpkZ3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNDE2NTAsImV4cCI6MjA2NDYxNzY1MH0.2-y5r5UzIfcGoHc6BPkRy5rnxWxl4SJwxUehPWBxAao"
$env:SUPABASE_SERVICE_ROLE_KEY="your_actual_service_role_key_here"
cd backend
npm run dev
```

## Step 4: Verify Setup

Once configured, the backend should start successfully and show:
```
✅ Supabase connected successfully. Customer count: X
🚀 Server running on port 3001
```

## Troubleshooting

### Error: "Missing Supabase configuration"
- Ensure all three environment variables are set
- Double-check the service role key is correct (starts with `eyJ`)

### Error: "Failed to create admin user"
- This was the original error we fixed
- The authentication system should now work properly with the `auth_user_id` column

### Connection Test Fails
- Verify your Supabase project URL is correct
- Check that the service role key has proper permissions
- Ensure your project is not paused or deleted

## Security Notes

- Never commit the `.env` file to version control
- The service role key should only be used on the backend server
- Use the anon key for frontend/client applications 