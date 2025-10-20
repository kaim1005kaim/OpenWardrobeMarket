-- Fix vector search functions to return TEXT image_id instead of UUID
-- Since we changed image_id from UUID to TEXT to support catalog items

-- Drop and recreate match_similar_items with correct return type
DROP FUNCTION IF EXISTS match_similar_items(vector, float, int);

CREATE OR REPLACE FUNCTION match_similar_items(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  image_id text,
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

-- Drop and recreate match_similar_items_hybrid with correct return type
DROP FUNCTION IF EXISTS match_similar_items_hybrid(vector, text[], int, float, float);

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
  image_id text,
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
