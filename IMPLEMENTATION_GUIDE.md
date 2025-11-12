# Open Wardrobe Market - Implementation Guide

Last Updated: 2025-11-12

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

### Workflow

1. **Image Upload**
   - User selects 2 images from gallery/camera
   - Images converted to base64

2. **FUSION Analysis**
   - Both images analyzed with Gemini 2.5 Flash
   - Extract: palette, silhouette, materials, motifs
   - Generate DNA vectors for blending

3. **DNA Blending**
   - Blend two DNA vectors (hue, saturation, texture, etc.)
   - Create unified design specification

4. **Prompt Generation**
   - Convert FUSION spec to Imagen 3 prompt
   - Include: silhouette, materials, palette, abstract motifs
   - Add: lighting, camera, construction details

5. **Main Image Generation**
   - Generate front view with Imagen 3
   - Upload to R2 storage

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
   - Check `published_items.metadata` has variants array
   - Verify R2 URLs use custom domain (`assets.open-wardrobe-market.com`)
   - Check browser console for image loading errors

2. **FUSION analysis fails**
   - Verify `maxOutputTokens` is at least 8192
   - Check image size (should be under 5MB)
   - Ensure Vertex AI credentials are valid

3. **Variant generation race condition**
   - Fixed in commit `2beb3122`
   - Ensure latest code is deployed

4. **Image URLs incorrect**
   - Should use `assets.open-wardrobe-market.com`
   - Not `pub-4215f21494de4f369c2bde9f2769dfd4.r2.dev`

### Debug Logging

Enable detailed logging by checking browser console and Vercel logs:

**Browser Console**:
```
[MobileDetailModal] Asset.metadata.variants: [...]
[MobileFusionPage] Stage changed to: ...
```

**Vercel Logs**:
```
[api/assets] DEBUG: Extracted R2 keys: [...]
[generate/variant] Uploaded to R2: https://assets...
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
