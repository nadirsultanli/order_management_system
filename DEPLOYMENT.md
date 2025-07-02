# Deployment Guide

## Overview
This Order Management System consists of:
- **Frontend**: React + TypeScript (deployed on Netlify)
- **Backend**: Node.js + tRPC (to be deployed on Railway)
- **Database**: Supabase PostgreSQL

## Quick Deployment Steps

### 1. Deploy Backend to Railway

1. **Create Railway Account**: Go to [railway.app](https://railway.app)
2. **Connect GitHub**: Link your GitHub repository
3. **Deploy from Git**: 
   - Select this repository
   - Set deploy path to `/backend`
   - Railway will auto-detect Node.js and use the correct build process

4. **Set Environment Variables** in Railway dashboard:
   ```
   SUPABASE_URL=https://trcrjinrdjgizqhjdgvc.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyY3JqaW5yZGpnaXpxaGpkZ3ZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTA0MTY1MCwiZXhwIjoyMDY0NjE3NjUwfQ.3yf8UQGvmSl-EiYAdaKfZ8_HC-p5rgQMHseuvhGH59M
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyY3JqaW5yZGpnaXpxaGpkZ3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNDE2NTAsImV4cCI6MjA2NDYxNzY1MH0.2-y5r5UzIfcGoHc6BPkRy5rnxWxl4SJwxUehPWBxAao
   NODE_ENV=production
   JWT_SECRET=your_strong_jwt_secret_here
   FRONTEND_URL=https://your-netlify-app.netlify.app
   ```

5. **Get Backend URL**: After deployment, Railway will provide a URL like `https://your-app.railway.app`

### 2. Update Frontend Environment Variables

1. **In Netlify Dashboard**:
   - Go to Site Settings > Environment Variables
   - Update `VITE_BACKEND_URL` to your Railway URL + `/api/v1/trpc`
   - Example: `VITE_BACKEND_URL=https://your-app.railway.app/api/v1/trpc`

2. **Or update `.env.local`** for local development:
   ```
   VITE_BACKEND_URL=https://your-app.railway.app/api/v1/trpc
   VITE_SUPABASE_URL=https://trcrjinrdjgizqhjdgvc.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyY3JqaW5yZGpnaXpxaGpkZ3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNDE2NTAsImV4cCI6MjA2NDYxNzY1MH0.2-y5r5UzIfcGoHc6BPkRy5rnxWxl4SJwxUehPWBxAao
   ```

### 3. Redeploy Frontend

After updating environment variables, trigger a new Netlify deployment.

## Alternative: All-in-One Netlify Deployment

If you prefer to keep everything on Netlify, we can convert the backend to Netlify Functions:

### Option A: Convert to Netlify Functions
1. Move backend logic to `/netlify/functions/`
2. Update tRPC to work with serverless functions
3. Update frontend to call `/api/` instead of external backend

Would you like me to implement this approach instead?

## Verification Steps

1. **Backend Health Check**: Visit `https://your-railway-app.railway.app/health`
2. **Frontend Test**: Login and try loading customers/orders
3. **API Connection**: Check browser network tab for successful API calls

## Troubleshooting

- **CORS Errors**: Ensure FRONTEND_URL is set correctly in Railway
- **Auth Errors**: Verify Supabase credentials are correct
- **Connection Errors**: Check that Railway service is running

## Next Steps After Deployment

1. **Custom Domain**: Add your domain to both Netlify and Railway
2. **SSL**: Both platforms provide free SSL certificates
3. **Monitoring**: Set up error tracking and monitoring
4. **Backup**: Configure database backups in Supabase