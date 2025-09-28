# Vercel Environment Variables Setup

You need to add the following environment variables to your Vercel project:

## Required Variables

Go to: https://vercel.com/your-project/settings/environment-variables

Add these variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://etvmigcsvrvetemyeiez.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTcxMjAsImV4cCI6MjA3MTg5MzEyMH0.hlH_QOl8F7HWH8p0SnLQdtwxs8w1JN8cqg8kvGFHw2Y
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMxNzEyMCwiZXhwIjoyMDcxODkzMTIwfQ.MAAFbXuCcl9UkW0WB54OBjte5UhWTJQg4ToxHBH5Kq0
```

## How to Add:

1. Go to your Vercel dashboard
2. Select your project (OpenWardrobeMarket)
3. Go to Settings → Environment Variables
4. Add each variable above
5. Make sure to select all environments (Production, Preview, Development)
6. Click "Save"
7. Redeploy your project for changes to take effect

## Note:
The SUPABASE_SERVICE_ROLE_KEY is sensitive and should only be used on the server side (in API routes).