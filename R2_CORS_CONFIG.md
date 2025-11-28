# R2 CORS Configuration for Presigned URL Upload

## Required CORS Settings

To enable direct uploads from the mobile app to R2 using presigned URLs, you need to configure CORS on your R2 bucket.

### Configuration Steps

1. Log in to your Cloudflare dashboard
2. Navigate to R2 → Your Bucket → Settings
3. Scroll to CORS Policy
4. Add the following configuration:

```json
[
  {
    "AllowedOrigins": [
      "*"
    ],
    "AllowedMethods": [
      "PUT",
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "Content-Type",
      "Content-Length"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

### Configuration Explanation

- **AllowedOrigins**: `["*"]` allows requests from any origin. For production, you should restrict this to your mobile app's domain or use specific origins.
- **AllowedMethods**:
  - `PUT` - Required for uploading files via presigned URLs
  - `GET` - Required for reading/downloading files
  - `HEAD` - Required for checking file existence
- **AllowedHeaders**: Headers that the client can send in the request
- **ExposeHeaders**: Headers that the client can read from the response
- **MaxAgeSeconds**: How long the browser should cache the CORS preflight response

### Production Security Recommendations

For production deployment, consider:

1. **Restrict Origins**: Replace `"*"` with specific origins:
   ```json
   "AllowedOrigins": [
     "https://open-wardrobe-market.com",
     "https://app.open-wardrobe-market.com"
   ]
   ```

2. **Use Signed URLs with Short Expiration**: The presigned URLs are currently set to expire in 1 hour, which is reasonable for upload operations.

3. **Implement Rate Limiting**: Consider implementing rate limiting on your `/api/r2-presign` endpoint to prevent abuse.

## Verification

After configuring CORS, you can verify it's working by:

1. Starting the mobile app
2. Triggering a FUSION generation
3. Checking the console logs for successful upload messages
4. Verifying the image appears in your R2 bucket

## Troubleshooting

If you encounter CORS errors:

1. Check that the CORS policy is saved correctly in R2
2. Verify that `AllowedMethods` includes `PUT`
3. Make sure the `Content-Type` header in your request matches what's in `AllowedHeaders`
4. Check browser/app console for specific CORS error messages
