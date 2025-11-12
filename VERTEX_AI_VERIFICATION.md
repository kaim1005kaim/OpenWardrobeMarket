# Vertex AI Imagen 3 - Verification & Testing Guide

## Current Status ✅

All Vertex AI Imagen 3 components have been implemented and configured:

### 1. Configuration ✅
- **Project**: `owm-production`
- **Service Account**: `owm-vertex-ai@owm-production.iam.gserviceaccount.com`
- **Credentials**: Configured in `.env.local` as `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- **Region**: `us-central1`

### 2. Code Implementation ✅
- **API Route**: `/app/api/generate/variant/route.ts`
- **SDK**: `@google-cloud/aiplatform` (v4.12.0)
- **Model**: `imagen-3.0-generate-001`

### 3. Features Implemented ✅
- Side view generation with mutated prompt
- Back view generation with mutated prompt
- R2 upload integration
- Metadata storage in `generation_history` and `published_items`
- Carousel UI in `MobileDetailModal`

---

## Next Steps: Verification

### Step 1: Check Imagen 3 API Access

The service account needs permission to use Imagen 3. Check access through Google Cloud Console:

1. Go to [Vertex AI Model Garden](https://console.cloud.google.com/vertex-ai/publishers/google/model-garden/imagegeneration?project=owm-production)
2. Look for "Imagen 3" model
3. If "REQUEST ACCESS" button appears, click it and wait for approval (1-3 business days)
4. If access is already granted, proceed to Step 2

### Step 2: Verify IAM Permissions

The service account needs these roles:

```bash
# Check current permissions
gcloud projects get-iam-policy owm-production \
  --flatten="bindings[].members" \
  --filter="bindings.members:owm-vertex-ai@owm-production.iam.gserviceaccount.com"
```

Required roles:
- `roles/aiplatform.user` - For calling Vertex AI APIs
- `roles/storage.objectCreator` - For R2 uploads (via API route)

### Step 3: Enable Vertex AI API

```bash
# Enable Vertex AI API (if not already enabled)
gcloud services enable aiplatform.googleapis.com --project=owm-production
```

### Step 4: Test Variant Generation

Once Steps 1-3 are complete:

1. Open the app at http://localhost:5173
2. Navigate to FUSION mode
3. Select two images and generate a fusion
4. Publish the result
5. Open the detail modal for the published item
6. Check browser console for variant generation logs:
   ```
   [generate/variant] Request for side view of gen_id: <uuid>
   [generate/variant] Generating side view with Imagen 3
   [generate/variant] Vertex AI response received
   [generate/variant] Image generated successfully
   [generate/variant] Uploading side to R2...
   [generate/variant] side uploaded successfully: <r2_url>
   ```

7. Wait for ~10-30 seconds for variants to generate
8. Check if carousel shows MAIN/SIDE/BACK views

---

## Troubleshooting

### Error: "Permission denied" or "403 Forbidden"

**Cause**: Service account lacks Vertex AI permissions

**Fix**:
```bash
gcloud projects add-iam-policy-binding owm-production \
  --member="serviceAccount:owm-vertex-ai@owm-production.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### Error: "Imagen 3 access denied" or "Model not found"

**Cause**: Imagen 3 access not yet granted

**Fix**:
1. Go to [Vertex AI Model Garden](https://console.cloud.google.com/vertex-ai/publishers/google/model-garden/imagegeneration?project=owm-production)
2. Request access to Imagen 3
3. Wait for approval email (1-3 business days)

### Error: "No image data in prediction response"

**Cause**: Response format mismatch

**Debug**: Check logs for prediction structure. The response should contain:
```json
{
  "predictions": [
    {
      "structValue": {
        "fields": {
          "bytesBase64Encoded": {
            "stringValue": "<base64_image_data>"
          }
        }
      }
    }
  ]
}
```

### Error: "R2 upload failed"

**Cause**: R2 credentials issue or network timeout

**Fix**:
1. Check R2 credentials in `.env.local`
2. Verify `/app/api/upload-to-r2/route.ts` is working
3. Test R2 upload independently

---

## Cost Estimates

**Imagen 3 Pricing** (as of 2024):
- ~$0.04 per image generation
- Each FUSION generates 3 images total (main + side + back)
- Cost per FUSION: ~$0.12

**Monthly Estimates**:
- 100 FUSIONs/month: ~$12
- 500 FUSIONs/month: ~$60
- 1000 FUSIONs/month: ~$120

---

## API Endpoint Details

### POST `/api/generate/variant`

**Request**:
```json
{
  "gen_id": "uuid",
  "view": "side" | "back"
}
```

**Response**:
```json
{
  "success": true,
  "view": "side",
  "r2_url": "https://assets.open-wardrobe-market.com/generated/<gen_id>_side.png"
}
```

**Errors**:
- `400`: Missing gen_id or view
- `404`: Generation not found
- `500`: Vertex AI error or R2 upload failure

---

## Integration Points

### 1. MobileFusionPage.tsx (Lines 800-850)
Triggers variant generation after publishing:
```typescript
setTimeout(() => {
  fetch(`${apiUrl}/api/generate/variant`, {
    method: 'POST',
    body: JSON.stringify({ gen_id: savedGenHistory.id, view: 'side' })
  });

  fetch(`${apiUrl}/api/generate/variant`, {
    method: 'POST',
    body: JSON.stringify({ gen_id: savedGenHistory.id, view: 'back' })
  });
}, 2000);
```

### 2. MobileDetailModal.tsx (Lines 63-89)
Loads variant images from metadata:
```typescript
if (asset.metadata?.variants) {
  const variants = asset.metadata.variants;
  if (variants.side?.status === 'completed' && variants.side?.r2_url) {
    images.push({ type: 'side', url: variants.side.r2_url });
  }
  if (variants.back?.status === 'completed' && variants.back?.r2_url) {
    images.push({ type: 'back', url: variants.back.r2_url });
  }
}
```

### 3. Database Schema
**generation_history.metadata**:
```json
{
  "variants": [
    {
      "type": "side",
      "r2_url": "https://...",
      "status": "completed",
      "created_at": "2025-11-12T14:30:00Z"
    },
    {
      "type": "back",
      "r2_url": "https://...",
      "status": "completed",
      "created_at": "2025-11-12T14:30:00Z"
    }
  ]
}
```

---

## Monitoring

Check variant generation status via Supabase SQL:

```sql
-- View recent variants
SELECT
  id,
  prompt,
  metadata->'variants' as variants,
  created_at
FROM generation_history
WHERE metadata->'variants' IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Count variants by status
SELECT
  jsonb_array_elements(metadata->'variants')->>'type' as view_type,
  jsonb_array_elements(metadata->'variants')->>'status' as status,
  COUNT(*)
FROM generation_history
WHERE metadata->'variants' IS NOT NULL
GROUP BY view_type, status;
```

---

## Success Criteria

✅ The implementation is successful when:

1. After publishing a FUSION image, two API calls to `/api/generate/variant` are made
2. Vercel logs show successful Vertex AI responses
3. `generation_history.metadata.variants` contains `side` and `back` entries with `r2_url`
4. Opening the detail modal shows a swipeable carousel with MAIN/SIDE/BACK views
5. No 500 errors in Vercel logs or browser console

---

## Contact & Support

- **Vertex AI Documentation**: https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview
- **Imagen 3 Model Card**: https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/imagen
- **Google Cloud Support**: https://cloud.google.com/support
