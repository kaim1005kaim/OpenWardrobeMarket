# Environment Variables Setup

## Required Environment Variables

For local development, create a `.env.local` file with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Other APIs
DEEPSEEK_API_KEY=your_deepseek_api_key
IMAGINE_API_KEY=your_imagine_api_key

# Cloudflare R2 (if using)
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET=your_bucket_name
R2_REGION=auto
R2_S3_ENDPOINT=your_endpoint_url
```

## For Vercel Deployment

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to Settings → Environment Variables
4. Add each variable listed above
5. Select all environments (Production, Preview, Development)
6. Save and redeploy

## Security Notes

⚠️ **NEVER commit actual keys to the repository**
- Always use environment variables
- Add `.env.local` to `.gitignore`
- Rotate keys immediately if exposed
- Use different keys for development and production

## Getting Your Keys

### Supabase Keys
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → API
4. Copy the URL and keys (keep service role key secret!)

### Rotating Compromised Keys
If keys are exposed:
1. Go to Supabase Dashboard → Settings → API
2. Click "Regenerate" for the service role key
3. Update all environments with the new key
4. Redeploy all services