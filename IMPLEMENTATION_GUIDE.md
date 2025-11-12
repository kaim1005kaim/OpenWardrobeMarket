# Open Wardrobe Market - Implementation Guide

Last Updated: 2025-11-12 (Session: Variant Image Fix)

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [AI Services](#ai-services)
4. [FUSION Mode](#fusion-mode)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Environment Variables](#environment-variables)
8. [Deployment](#deployment)

---

## Architecture Overview

Open Wardrobe Market is a fashion marketplace with AI-powered image generation and analysis.

### Key Features
- **FUSION Mode**: Blend two fashion images to create unique designs
- **AI Auto-tagging**: Automatic category, tags, and description generation
- **Variant Generation**: Automatic side/back view generation using Imagen 3
- **Vector Search**: CLIP-based similarity search (fallback to tag-based search)
- **Catalog System**: Pre-generated fashion items with embeddings

### Application Flow

```
User Input (2 images)
  → FUSION Analysis (Gemini 2.5 Flash)
  → Main Image Generation (Imagen 3)
  → Variant Generation (side/back views)
  → Auto-tagging & Description
  → Published to SHOWCASE
  → Detail Modal with Carousel
```

---

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **State Management**: React Context API
- **3D Graphics**: Three.js (for reveal effects)
- **Build Tool**: Vite
- **Styling**: CSS Modules

### Backend
- **Framework**: Next.js 15 App Router
- **Runtime**: Node.js
- **API**: RESTful + Server-Sent Events (SSE)

### Database
- **Primary DB**: Supabase (PostgreSQL)
- **Tables**:
  - `published_items` - Main item catalog
  - `generation_history` - AI generation records with variants
  - `assets` - Image metadata

### Storage
- **Image Storage**: Cloudflare R2 (S3-compatible)
- **CDN**: Custom domain `assets.open-wardrobe-market.com`

### AI Services
- **Vision AI**: Google Vertex AI (Gemini 2.5 Flash)
- **Image Generation**: Google Vertex AI (Imagen 3)
- **Embeddings**: CLIP (optional, self-hosted)

---

## AI Services

### Vertex AI Configuration

All AI services unified under Google Cloud Vertex AI with OAuth 2.0 authentication.

**Service Account**: `owm-vertex-ai@owm-production.iam.gserviceaccount.com`

#### Authentication
- **File**: [lib/vertex-ai-auth.ts](lib/vertex-ai-auth.ts)
- **Method**: OAuth 2.0 with service account JSON key
- **Token Caching**: 55 minutes (tokens expire after 1 hour)

#### Models Used

1. **Gemini 2.5 Flash** (`gemini-2.0-flash-exp`)
   - FUSION image analysis
   - Auto-tagging and description generation
   - Max output tokens: 8192 (FUSION), 2048 (tagging)

2. **Imagen 3** (`imagen-3.0-generate-002`)
   - Main image generation
   - Variant generation (side/back views)
   - Parameters:
     - `aspectRatio`: "3:4"
     - `personGeneration`: "allow_adult"
     - `safetySetting`: "block_only_high"
     - ❌ `seed`: Not supported with watermark

### API Endpoints

#### `/api/gemini/analyze-fusion`
Analyzes two images and generates FUSION specifications.

**Request**:
```json
{
  "imageData": "base64...",
  "mimeType": "image/jpeg",
  "generateInspiration": true
}
```

**Response**:
```json
{
  "spec": {
    "palette": [...],
    "silhouette": "tailored",
    "materials": [...],
    "motif_abstractions": [...],
    "details": [...]
  },
  "tags": [...],
  "description": "...",
  "dna": {...}
}
```

#### `/api/gemini/analyze-image`
Generates tags and description for a single image.

**Request**:
```json
{
  "imageData": "base64...",
  "mimeType": "image/png"
}
```

**Response**:
```json
{
  "tags": ["fitted", "futuristic", ...],
  "description": "幾何学的なパターン..."
}
```

---

## FUSION Mode

FUSION mode blends two fashion images into unique AI-generated designs with advanced diversity controls to ensure variety and quality.

### Diversity Control System

To prevent repetitive outputs and ensure high-quality diverse results:

#### 1. Silhouette Diversity
- **Cooldown System**: Tracks recent generations to reduce repetition
  - Window: Last 5 generations per user
  - Penalty: 0.35x weight if same silhouette appears 2+ times
- **Sampling**: Top-k softmax sampling (k=4, temperature=0.85)
- **Available Silhouettes**: tailored, A-line, boxy, column, mermaid, parachute, cocoon, oversized

**Implementation**: [src/lib/diversity-control.ts](src/lib/diversity-control.ts) - `applyCooldown()`, `sampleTopKSoftmax()`

#### 2. Model Diversity (Demographics)
- **Distribution**:
  - Asian: 70%
  - White: 15%
  - Black: 10%
  - Other: 5%
- **Seeded Sampling**: Deterministic based on `userId + timestamp`
- **Prompt Format**: "model of East Asian descent, 20s, androgynous elegance"

**Implementation**: [src/lib/diversity-control.ts](src/lib/diversity-control.ts) - `sampleDemographic()`, `demographicToPrompt()`

#### 3. Background Diversity
- **Distribution**:
  - Color background: 70% (soft gradient from palette)
  - White studio: 30%
- **Color Selection**: Desaturated palette colors for soft backgrounds
- **Format**: "studio cyclorama, soft gradient background in muted {color}"

**Implementation**: [src/lib/diversity-control.ts](src/lib/diversity-control.ts) - `sampleBackground()`, `backgroundToPrompt()`

#### 4. Abstraction Rules
FUSION analysis enforces strict abstraction to prevent literal object replication:

**Transformation Examples**:
- ❌ "torii gate" → ✅ "vertical pillar effect via contrast panel placement"
- ❌ "Nike swoosh logo" → ✅ "asymmetric diagonal line as contrast piping"
- ❌ "building facade" → ✅ "grid-like topstitch pattern, architectural seamlines"
- ❌ "water ripples" → ✅ "irregular soft pleats suggesting fluid movement"

**Implementation**: [app/api/gemini/analyze-fusion/route.ts](app/api/gemini/analyze-fusion/route.ts:8-51)

### Workflow

1. **Image Upload**
   - User selects 2 images from gallery/camera
   - Images converted to base64

2. **FUSION Analysis** ([/api/gemini/analyze-fusion](app/api/gemini/analyze-fusion/route.ts))
   - Both images analyzed with Gemini 2.5 Flash
   - Extract: palette, silhouette, materials, abstract motifs
   - Generate DNA vectors for blending
   - Return FUSION spec with abstraction rules applied

3. **DNA Blending**
   - Blend two DNA vectors (hue, saturation, texture, etc.)
   - Merge FUSION specs (palette, materials, motifs)
   - Create unified design specification

4. **Prompt Generation** ([/api/prompt/compose](app/api/prompt/compose/route.ts))
   - Fetch recent silhouettes from `generation_history`
   - Apply diversity controls:
     - Silhouette cooldown + sampling
     - Demographic sampling (seeded by userId + timestamp)
     - Background sampling
   - Build Imagen 3 prompt with selected variations
   - Return: prompt, negativePrompt, selectedSilhouette, selectedDemographic, selectedBackground

**Request**:
```json
{
  "mode": "fusion",
  "spec": { /* blended FUSION spec */ },
  "userId": "...",
  "timestamp": 1699999999999,
  "recentSilhouettes": ["tailored", "A-line", ...],
  "enableDiversitySampling": true
}
```

**Response**:
```json
{
  "prompt": "FASHION EDITORIAL, full-body fashion photography...",
  "negativePrompt": "no text, no logos, no literal objects...",
  "selectedSilhouette": "cocoon",
  "selectedDemographic": "asian",
  "selectedBackground": "color",
  "aspectRatio": "3:4"
}
```

5. **Main Image Generation**
   - Generate front view with Imagen 3 using diversity-controlled prompt
   - Upload to R2 storage
   - Save `selectedSilhouette` to `generation_history.metadata.silhouette` for future cooldown

6. **Variant Generation**
   - Generate `side` view (90-degree profile)
   - Generate `back` view (180-degree rear)
   - Upload both to R2
   - Save to `generation_history.metadata.variants`

7. **Auto-tagging**
   - Generate category with confidence score
   - Generate 8 relevant tags
   - Generate Japanese description

8. **Publishing**
   - Save to `published_items` with metadata
   - Include variants array in metadata
   - Display in SHOWCASE with carousel

### Variant Generation Prompts

**Side View**:
```
SIDE PROFILE VIEW: Model facing 90 degrees to the left or right.
Camera captures the full side silhouette from shoulder to toe.
The model's face should be in profile (not looking at camera).
Show the side seam, sleeve construction, and garment depth clearly.
This is NOT a front view - we should see the side of the body and garment only.
```

**Back View**:
```
BACK VIEW: Model facing completely away from camera (180 degrees).
Camera captures the full back from shoulders to heels.
Show back details: rear construction, closures, hemline, and any back design elements.
The model should be facing away - we should NOT see their face or front of the garment.
```

### Race Condition Fix

**Problem**: When side and back variants generated concurrently, one would overwrite the other.

**Solution**: SELECT-then-UPDATE pattern in [app/api/generate/variant/route.ts](app/api/generate/variant/route.ts:201-226)

```typescript
// Read latest metadata before updating
const { data: currentData } = await supabase
  .from('generation_history')
  .select('metadata')
  .eq('id', gen_id)
  .single();

// Merge new variant with existing variants
const currentVariants = currentData.metadata.variants || [];
const updatedVariants = currentVariants.filter(v => v.type !== view);
updatedVariants.push(newVariant);

// Update with merged array
await supabase
  .from('generation_history')
  .update({
    metadata: {
      ...currentMetadata,
      variants: updatedVariants
    }
  })
  .eq('id', gen_id);
```

---

## Database Schema

### `published_items`

Primary table for all published fashion items.

```sql
CREATE TABLE published_items (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  image_id TEXT NOT NULL,  -- R2 key or catalog path
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  tags TEXT[],
  auto_tags TEXT[],
  ai_description TEXT,
  price INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  poster_url TEXT,
  original_url TEXT,
  embedding VECTOR(512),  -- CLIP embedding
  metadata JSONB DEFAULT '{}'::jsonb,  -- NEW: Stores variants

  -- Example metadata structure:
  -- {
  --   "width": 1024,
  --   "height": 1536,
  --   "mime_type": "image/png",
  --   "variants": [
  --     {"type": "side", "r2_url": "...", "status": "completed", "created_at": "..."},
  --     {"type": "back", "r2_url": "...", "status": "completed", "created_at": "..."}
  --   ]
  -- }
);

CREATE INDEX idx_published_items_metadata_variants
ON published_items USING gin ((metadata->'variants'));
```

### `generation_history`

Stores AI generation session data and variant metadata.

```sql
CREATE TABLE generation_history (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  prompt TEXT,
  model_name TEXT,
  completion_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,  -- Stores variants, DNA, mode, etc.
  generation_data JSONB  -- Additional generation parameters
);
```

### Migration History

**Latest Migration**: `add_metadata_to_published_items.sql`
- Added `metadata` JSONB column to `published_items`
- Created GIN index for variant queries
- Allows storing variant array directly in published items

---

## API Endpoints

### Image Generation

- `POST /api/generate/imagen` - Generate image with Imagen 3
- `POST /api/generate/variant` - Generate side/back variant
- `POST /api/gemini/analyze-fusion` - FUSION analysis
- `POST /api/gemini/analyze-image` - Single image analysis

### Auto-tagging

- `POST /api/auto/category` - Generate category
- `POST /api/auto/tags` - Generate tags

### Publishing

- `POST /api/publish` - Publish item to SHOWCASE
- `POST /api/compose-poster` - Generate poster with frame overlay

### Assets & Search

- `GET /api/assets` - Fetch published items (includes variants)
- `POST /api/vector-search` - CLIP-based similarity search
- `POST /api/similar` - Tag-based similarity fallback

### Real-time

- `GET /api/generation-stream/[gen_id]` - SSE stream for variant updates

---

## Environment Variables

### Required Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://etvmigcsvrvetemyeiez.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Cloudflare R2
R2_ACCOUNT_ID=fcc51c83e45b0d843849443423180f6a
R2_ACCESS_KEY_ID=e76a617c4d38133faa4f68cf1be9d8fd
R2_SECRET_ACCESS_KEY=c5bf8545a33282f677e0c57573c260934f3e1daf1a3c13b96ce8322e1e6c83eb
R2_BUCKET=owm-assets
R2_REGION=auto
R2_S3_ENDPOINT=https://fcc51c83e45b0d843849443423180f6a.r2.cloudflarestorage.com
R2_CUSTOM_DOMAIN_URL=https://assets.open-wardrobe-market.com
NEXT_PUBLIC_R2_PUBLIC_BASE_URL=https://assets.open-wardrobe-market.com

# Google Cloud / Vertex AI
GOOGLE_CLOUD_PROJECT=owm-production
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}
```

### Optional Variables

```bash
# Legacy (deprecated)
GOOGLE_API_KEY=AIzaSy...  # Old Google AI Studio key, not used
VERTEX_AI_API_KEY=AQ.Ab...  # Old API key, replaced by OAuth
```

---

## Deployment

### Vercel

**Repository**: `github.com/kaim1005kaim/OpenWardrobeMarket`

**Build Settings**:
- Framework: Next.js
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

**Environment Variables**: Set all variables from `.env.local` in Vercel dashboard

### Domain

- **Production**: `open-wardrobe-market.com`
- **Assets CDN**: `assets.open-wardrobe-market.com` (R2)

### Database

**Supabase Project**: `etvmigcsvrvetemyeiez`

**Connection**:
- Direct Postgres: `db.etvmigcsvrvetemyeiez.supabase.co:5432`
- REST API: `https://etvmigcsvrvetemyeiez.supabase.co/rest/v1`

---

## Troubleshooting

### Common Issues

1. **Variants not displaying**
   - **Symptom**: Carousel appears but images fail to load
   - **Root Cause**: R2 direct URLs (`pub-*.r2.dev`) instead of custom domain
   - **Solution**: Use `R2_CUSTOM_DOMAIN_URL` in variant generation (Fixed in commit `909af7cd`)
   - **Check**: Verify `published_items.metadata.variants[].r2_url` uses `assets.open-wardrobe-market.com`
   - **Browser Console**: Look for CORS errors or 403 Forbidden responses

2. **FUSION analysis timeout/failure**
   - **Symptom**: `net::ERR_TIMED_OUT` or 500 Internal Server Error
   - **Root Causes**:
     - Vertex AI cold start latency on first request
     - Default 10s Vercel timeout too short
     - Incorrect parameter position (timeout passed as systemInstruction)
   - **Solutions**:
     - Set `maxDuration = 60` in route config (Fixed in commit `61243c56`)
     - Pass `undefined` for systemInstruction parameter explicitly (Fixed in commit `dd968661`)
     - Implement retry logic with exponential backoff (1s, 2s intervals)
   - **Verify**: Check `maxOutputTokens` is at least 8192 for FUSION analysis

3. **Variant generation race condition**
   - **Symptom**: Only one variant (side OR back) saved, not both
   - **Root Cause**: Concurrent updates overwriting metadata
   - **Solution**: SELECT-then-UPDATE pattern (Fixed in commit `2beb3122`)
   - **Ensure**: Latest code is deployed

4. **Image URLs incorrect**
   - **Correct**: `https://assets.open-wardrobe-market.com/...`
   - **Incorrect**: `https://pub-4215f21494de4f369c2bde9f2769dfd4.r2.dev/...`
   - **Fix**: Set `R2_CUSTOM_DOMAIN_URL` environment variable
   - **Code**: [app/api/generate/variant/route.ts:123](app/api/generate/variant/route.ts#L123)

5. **Build errors**
   - **Duplicate variable declaration**: Ensure no conflicting variable names (e.g., `parseStart` used twice)
   - **TypeScript errors**: Run `npm run build` locally before deploying
   - **Vercel build timeout**: Check build logs for slow steps

### Debug Logging

Enable detailed logging by checking browser console and Vercel logs:

**Browser Console (FUSION Flow)**:
```javascript
// FUSION Analysis
[handleAnalyze] Starting analysis with images: {image1Type, image1Size, image2Type, image2Size}
[analyzeImage] Response status: 200
[analyzeImage] FUSION spec: {palette, silhouette, materials, ...}

// Generation
[handleGenerate] Recent silhouettes: [...]
[handleGenerate] Blended spec: {...}
[handleGenerate] Prompt result: {prompt, selectedSilhouette, selectedDemographic, ...}

// Publishing
[handlePublish] Preparing generationData with session_id: ...
[PublishFormPage] Variant generation useEffect triggered
[PublishFormPage] ✅ Starting variant generation for session: ...
[MobilePublishFormPage] 🚀 Triggering variant generation...
[MobilePublishFormPage] Variant received: {type, r2_url, created_at}

// Detail Modal
[MobileDetailModal] Asset.metadata.variants: [...]
[MobileDetailModal] ✓ Adding back image: https://assets...
[MobileDetailModal] Final variant images array: [...]
```

**Vercel Logs (API Routes)**:
```
// Variant Generation
[generate/variant] Request for side view of gen_id: ...
[generate/variant] Generating side view with Imagen 3 via Vertex AI
[generate/variant] Uploaded to R2: https://assets.open-wardrobe-market.com/...

// Publish Route
[publish] Fetching variants for session: ...
[publish] generation_history.metadata: {...}
[publish] ✅ Found variants: 2
[publish] Successfully saved AI analysis, embedding, and pricing

// Assets Route
[api/assets] DEBUG: Extracted R2 keys: [...]
[api/assets] DEBUG: generation_history query returned N records
[api/assets] DEBUG: Item <id> r2Key=..., found variants=true
```

**Performance Timing Logs**:
```
[analyze-fusion] ⏱️ Body parsing: 2ms
[analyze-fusion] ⏱️ Base64 cleaning: 0ms
[analyze-fusion] ⏱️ Vertex AI Gemini analysis: 3542ms
[analyze-fusion] ⏱️ JSON parsing & validation: 1ms
[analyze-fusion] ⏱️ Inspiration generation: 1247ms
[analyze-fusion] ⏱️ TOTAL REQUEST TIME: 4801ms
```

---

## File Structure

```
/
├── app/
│   └── api/
│       ├── assets/route.ts           # Fetch published items with variants
│       ├── generate/
│       │   └── variant/route.ts      # Generate side/back views
│       ├── gemini/
│       │   ├── analyze-fusion/       # FUSION analysis
│       │   └── analyze-image/        # Single image analysis
│       ├── auto/
│       │   ├── category/             # Auto-category generation
│       │   └── tags/                 # Auto-tag generation
│       ├── publish/route.ts          # Publish to SHOWCASE
│       └── generation-stream/        # SSE for variants
├── lib/
│   └── vertex-ai-auth.ts             # Unified Vertex AI auth
├── src/
│   └── app/
│       ├── components/
│       │   └── mobile/
│       │       └── MobileDetailModal.tsx  # Variant carousel
│       └── pages/
│           └── mobile/
│               └── MobileFusionPage.tsx   # FUSION workflow
├── migrations/
│   └── add_metadata_to_published_items.sql
└── IMPLEMENTATION_GUIDE.md           # This file
```

---

## Recent Fixes (2025-11-12)

### Session: Variant Image Display Issue

**Problems Solved**:

1. **Vertex AI Timeout Parameter Position** (Commit: `dd968661`)
   - **Issue**: `timeout` option passed as `systemInstruction` parameter
   - **Error**: `Invalid JSON payload received. Unknown name "timeout" at 'system_instruction'`
   - **Fix**: Added explicit `undefined` for `systemInstruction` parameter when not used
   - **Code**: [app/api/gemini/analyze-fusion/route.ts:156-157](app/api/gemini/analyze-fusion/route.ts#L156-L157)

2. **Build Error - Duplicate Variable** (Commit: `61243c56`)
   - **Issue**: `parseStart` declared twice in same scope
   - **Fix**: Renamed second occurrence to `jsonParseStart`
   - **Code**: [app/api/gemini/analyze-fusion/route.ts:229](app/api/gemini/analyze-fusion/route.ts#L229)

3. **Variant Images Not Loading** (Commit: `909af7cd`) ✅ **MAIN FIX**
   - **Issue**: Variant URLs using R2 direct domain (`pub-*.r2.dev`) with CORS restrictions
   - **Symptom**: Carousel displayed but images failed to load (403 Forbidden or CORS errors)
   - **Root Cause**: [app/api/generate/variant/route.ts:122](app/api/generate/variant/route.ts#L122) used `R2_PUBLIC_BASE_URL` instead of custom domain
   - **Fix**: Changed to `R2_CUSTOM_DOMAIN_URL` (assets.open-wardrobe-market.com)
   - **Before**: `https://pub-4215f21494de4f369c2bde9f2769dfd4.r2.dev/...`
   - **After**: `https://assets.open-wardrobe-market.com/...`
   - **Impact**: All variant images now load correctly through custom domain with proper CORS headers

**Additional Improvements**:

4. **Timeout Configuration** (Commit: `61243c56`)
   - Added `maxDuration = 60` to analyze-fusion route for Vercel Pro
   - Added AbortController timeout to Vertex AI calls (45s Gemini, 60s Imagen)

5. **Retry Logic** (Commit: `ba240292`)
   - Exponential backoff retry (3 attempts: 0s, 1s, 2s intervals)
   - Skip retry on 4xx client errors
   - Handles Vertex AI cold starts gracefully

6. **Performance Logging** (Commit: `61243c56`)
   - Added detailed timing logs for each step
   - Helps identify bottlenecks in FUSION pipeline

**Verification**:
```
✅ Variant generation succeeds
✅ SSE delivers variants in real-time
✅ Variants saved to published_items.metadata
✅ DetailModal displays carousel with all views
✅ Images load correctly from custom domain
```

---

## Next Steps

### Planned Improvements

1. **PostgreSQL Row-Level Locking**
   - Replace SELECT-then-UPDATE with true atomic operations
   - Eliminate race condition possibility completely

2. **Variant Quality Improvements**
   - Fine-tune prompts based on user feedback
   - Consider negative prompts if Imagen 3 supports them
   - Implement variant regeneration UI

3. **Performance Optimization**
   - Add caching for generation_history queries
   - Implement lazy loading for variant images
   - Optimize CLIP embeddings with batch processing

4. **Feature Additions**
   - 3D view generation
   - Fabric texture variants
   - Color palette variations

---

## Support & Contact

For issues or questions, create an issue on GitHub:
https://github.com/kaim1005kaim/OpenWardrobeMarket/issues
