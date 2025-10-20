-- Add vector embeddings support for advanced similarity search
-- This enables CLIP-based visual similarity using cosine distance

-- Enable pgvector extension (provides vector data type and similarity operators)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column (512-dimensional vector for CLIP embeddings)
-- CLIP models typically output 512 or 768 dimensional vectors
ALTER TABLE published_items
ADD COLUMN IF NOT EXISTS embedding vector(512);

-- Create IVFFlat index for fast vector similarity search
-- IVFFlat is a quantization-based index that speeds up nearest neighbor search
-- lists=100 is a good default for datasets with 1000-100000 items
CREATE INDEX IF NOT EXISTS idx_published_items_embedding_cosine
ON published_items USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Alternative: Create index using L2 distance (Euclidean distance)
-- Uncomment if you prefer L2 distance over cosine similarity
-- CREATE INDEX IF NOT EXISTS idx_published_items_embedding_l2
-- ON published_items USING ivfflat (embedding vector_l2_ops)
-- WITH (lists = 100);

-- Create a function for vector similarity search using cosine distance
-- This RPC function can be called from Supabase client
CREATE OR REPLACE FUNCTION match_similar_items(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  image_id uuid,
  auto_tags text[],
  tags text[],
  category text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    published_items.id,
    published_items.title,
    published_items.image_id,
    published_items.auto_tags,
    published_items.tags,
    published_items.category,
    1 - (published_items.embedding <=> query_embedding) AS similarity
  FROM published_items
  WHERE published_items.embedding IS NOT NULL
    AND published_items.is_active = true
    AND 1 - (published_items.embedding <=> query_embedding) > match_threshold
  ORDER BY published_items.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create a function for hybrid search (combining vector + tag similarity)
CREATE OR REPLACE FUNCTION match_similar_items_hybrid(
  query_embedding vector(512),
  query_tags text[] DEFAULT '{}',
  match_count int DEFAULT 10,
  vector_weight float DEFAULT 0.7,
  tag_weight float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  title text,
  image_id uuid,
  auto_tags text[],
  tags text[],
  category text,
  vector_similarity float,
  tag_similarity float,
  combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.image_id,
    p.auto_tags,
    p.tags,
    p.category,
    (1 - (p.embedding <=> query_embedding)) AS vector_similarity,
    CASE
      WHEN cardinality(query_tags) = 0 THEN 0.0
      ELSE (
        cardinality(ARRAY(SELECT unnest(p.auto_tags) INTERSECT SELECT unnest(query_tags)))::float
        / GREATEST(cardinality(ARRAY(SELECT unnest(p.auto_tags) UNION SELECT unnest(query_tags))), 1)::float
      )
    END AS tag_similarity,
    (
      (1 - (p.embedding <=> query_embedding)) * vector_weight +
      CASE
        WHEN cardinality(query_tags) = 0 THEN 0.0
        ELSE (
          cardinality(ARRAY(SELECT unnest(p.auto_tags) INTERSECT SELECT unnest(query_tags)))::float
          / GREATEST(cardinality(ARRAY(SELECT unnest(p.auto_tags) UNION SELECT unnest(query_tags))), 1)::float
        ) * tag_weight
      END
    ) AS combined_score
  FROM published_items p
  WHERE p.embedding IS NOT NULL
    AND p.is_active = true
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

COMMENT ON COLUMN published_items.embedding IS
'512-dimensional CLIP embedding vector for visual similarity search. Generated using OpenAI CLIP or Hugging Face transformers.';

COMMENT ON FUNCTION match_similar_items IS
'Find similar items using vector cosine similarity. Returns items above the similarity threshold.';

COMMENT ON FUNCTION match_similar_items_hybrid IS
'Hybrid search combining vector similarity and tag overlap. Weights can be adjusted (default: 70% vector, 30% tags).';
