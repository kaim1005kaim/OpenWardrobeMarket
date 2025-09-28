-- Apply migration 007: Embeddings and recipes
-- Run this in Supabase SQL Editor

-- 1) Vector embeddings storage (MVP: JSONB, future: vector type)
CREATE TABLE IF NOT EXISTS asset_embeddings (
  asset_id uuid PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  clip_vector jsonb NOT NULL,              -- CLIP embedding vector [float, ...] length 768
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2) Heritage clusters (reference sets' mean vectors)
CREATE TABLE IF NOT EXISTS heritage_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,               -- 'comme','margiela','dries','yohji','issey' etc
  display_name text NOT NULL,              -- 'Comme des Garçons', 'Maison Margiela', etc
  clip_mean jsonb NOT NULL,                -- Reference group's mean vector
  sample_count int NOT NULL DEFAULT 0,     -- Number of reference samples
  description text,                        -- Brief description of the heritage style
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 3) Recipes (constraints and transformations as primary assets)
CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id),
  name text,
  mode text NOT NULL CHECK (mode IN ('simple', 'heritage', 'zero', 'mutation', 'reinterpret')),
  params jsonb NOT NULL,     -- {heritage:{code,ratio}, subtractor:{code,ratio}, constraints:[...], materials:[...]}
  is_public boolean DEFAULT false,
  usage_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4) Add columns to assets table (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'recipe_id') THEN
        ALTER TABLE assets ADD COLUMN recipe_id uuid REFERENCES recipes(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'novelty_score') THEN
        ALTER TABLE assets ADD COLUMN novelty_score numeric(3,2) CHECK (novelty_score >= 0 AND novelty_score <= 1);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'print_ready_score') THEN
        ALTER TABLE assets ADD COLUMN print_ready_score numeric(3,2) CHECK (print_ready_score >= 0 AND print_ready_score <= 1);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'wearability_score') THEN
        ALTER TABLE assets ADD COLUMN wearability_score numeric(3,2) CHECK (wearability_score >= 0 AND wearability_score <= 1);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'generation_mode') THEN
        ALTER TABLE assets ADD COLUMN generation_mode text CHECK (generation_mode IN ('simple', 'heritage', 'zero', 'mutation', 'reinterpret'));
    END IF;
END
$$;

-- 5) Reinterpretation chains (parent-child genealogy and royalties)
CREATE TABLE IF NOT EXISTS reinterpret_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  child_asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  royalty_percentage numeric(4,2) NOT NULL DEFAULT 5.00 CHECK (royalty_percentage >= 0 AND royalty_percentage <= 100),
  reinterpret_mode text NOT NULL CHECK (reinterpret_mode IN ('heritage', 'zero', 'mutation')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(parent_asset_id, child_asset_id)
);

-- 6) Constraint dictionary
CREATE TABLE IF NOT EXISTS constraint_dictionary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  category text NOT NULL CHECK (category IN ('form', 'structure', 'visual', 'material')),
  prompt_text text NOT NULL,
  description text,
  difficulty_level int DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now()
);

-- 7) Material dictionary
CREATE TABLE IF NOT EXISTS material_dictionary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  category text NOT NULL CHECK (category IN ('textile', 'treatment', 'technique', 'bio')),
  prompt_text text NOT NULL,
  description text,
  sustainability_score numeric(3,2) CHECK (sustainability_score >= 0 AND sustainability_score <= 1),
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_asset_embeddings_asset_id ON asset_embeddings(asset_id);
CREATE INDEX IF NOT EXISTS idx_heritage_clusters_code ON heritage_clusters(code);
CREATE INDEX IF NOT EXISTS idx_recipes_owner_user_id ON recipes(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_mode ON recipes(mode);
CREATE INDEX IF NOT EXISTS idx_assets_novelty_score ON assets(novelty_score);
CREATE INDEX IF NOT EXISTS idx_assets_generation_mode ON assets(generation_mode);
CREATE INDEX IF NOT EXISTS idx_reinterpret_edges_parent ON reinterpret_edges(parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_reinterpret_edges_child ON reinterpret_edges(child_asset_id);

-- Initial seed data for heritage clusters (placeholder vectors - will be computed from real data)
INSERT INTO heritage_clusters (code, display_name, clip_mean, sample_count, description) VALUES
  ('comme', 'Comme des Garçons', '[]'::jsonb, 0, 'Deconstructed forms, asymmetry, conceptual fashion'),
  ('margiela', 'Maison Margiela', '[]'::jsonb, 0, 'Deconstruction, exposed construction, artisanal techniques'),
  ('dries', 'Dries Van Noten', '[]'::jsonb, 0, 'Eclectic prints, cultural fusion, rich textures'),
  ('yohji', 'Yohji Yamamoto', '[]'::jsonb, 0, 'Oversized silhouettes, black palette, Japanese aesthetics'),
  ('issey', 'Issey Miyake', '[]'::jsonb, 0, 'Pleating technology, geometric forms, innovative materials')
ON CONFLICT (code) DO NOTHING;

-- Initial constraint dictionary
INSERT INTO constraint_dictionary (code, category, prompt_text, description, difficulty_level) VALUES
  ('no_straight_lines', 'form', 'no straight lines, only curves and organic forms', 'Eliminates all straight edges', 3),
  ('asymmetric_left_right', 'structure', 'asymmetric left-right construction, unbalanced design', 'Creates visual tension through asymmetry', 2),
  ('exposed_seams', 'structure', 'exposed seams as visible design feature, raw edges prominent', 'Makes construction visible', 1),
  ('gravity_offset', 'visual', 'center of gravity visually offset by 30%, unstable appearance', 'Challenges balance perception', 4),
  ('one_bit_palette', 'visual', 'binary palette look with high-contrast edges, black and white only', 'Extreme contrast limitation', 2),
  ('inside_out', 'structure', 'inside-out appearance with lining outward, reversed construction', 'Inverts traditional construction', 3),
  ('modular_detachable', 'structure', 'modular detachable components, transformable garment', 'Allows reconfiguration', 4),
  ('spiral_construction', 'form', 'spiral construction wrapping around body', 'Creates helical movement', 3),
  ('no_symmetry', 'form', 'completely asymmetric, no mirrored elements', 'Total asymmetry', 5),
  ('transparent_layers', 'visual', 'transparent and opaque layers interplay', 'Plays with visibility', 2),
  ('moebius_strip', 'form', 'moebius strip construction, continuous surface', 'Topological form', 5)
ON CONFLICT (code) DO NOTHING;

-- Initial material dictionary
INSERT INTO material_dictionary (code, category, prompt_text, description, sustainability_score) VALUES
  ('phase_fiber', 'textile', 'phase-change fiber textile with thermal regulation', 'Temperature adaptive material', 0.7),
  ('bio_dye', 'treatment', 'bio-reactive dyeing pattern, living color changes', 'Biological dyeing process', 0.9),
  ('tri_axial_weave', 'technique', 'tri-axial weaving structure', 'Three-directional weave', 0.6),
  ('retroreflective', 'treatment', 'retroreflective thread accents, light-returning details', 'Light-responsive material', 0.5),
  ('mycelium_leather', 'bio', 'mycelium-based leather alternative', 'Fungal-grown material', 0.95),
  ('aerogel_insulation', 'textile', 'aerogel insulation pockets', 'Ultra-light insulation', 0.6),
  ('conductive_thread', 'technique', 'conductive thread embroidery for tech integration', 'Electronic integration', 0.4),
  ('bio_plastic', 'bio', 'biodegradable plastic coating', 'Compostable finishing', 0.85),
  ('shape_memory', 'textile', 'shape-memory alloy framework', 'Form-changing structure', 0.5),
  ('algae_foam', 'bio', 'algae-based foam padding', 'Renewable cushioning', 0.9)
ON CONFLICT (code) DO NOTHING;

-- RLS policies
ALTER TABLE asset_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE heritage_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reinterpret_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE constraint_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_dictionary ENABLE ROW LEVEL SECURITY;

-- Public read for heritage clusters and dictionaries
DROP POLICY IF EXISTS "Public read heritage clusters" ON heritage_clusters;
CREATE POLICY "Public read heritage clusters" ON heritage_clusters FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read constraints" ON constraint_dictionary;
CREATE POLICY "Public read constraints" ON constraint_dictionary FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read materials" ON material_dictionary;
CREATE POLICY "Public read materials" ON material_dictionary FOR SELECT USING (true);

-- Recipes: owners can CRUD, public can read public recipes
DROP POLICY IF EXISTS "Owners can manage recipes" ON recipes;
CREATE POLICY "Owners can manage recipes" ON recipes 
  FOR ALL USING (auth.uid() = owner_user_id OR is_public = true);

-- Asset embeddings: follow asset permissions
DROP POLICY IF EXISTS "Asset embeddings follow asset permissions" ON asset_embeddings;
CREATE POLICY "Asset embeddings follow asset permissions" ON asset_embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assets 
      WHERE assets.id = asset_embeddings.asset_id 
      AND (assets.is_public = true OR assets.user_id = auth.uid())
    )
  );

-- Reinterpret edges: public read
DROP POLICY IF EXISTS "Public read reinterpret edges" ON reinterpret_edges;
CREATE POLICY "Public read reinterpret edges" ON reinterpret_edges FOR SELECT USING (true);