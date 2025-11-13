-- variants_jobs テーブル作成
-- FUSION バリアント生成を job 単位で管理し、タイムアウトを回避

CREATE TABLE IF NOT EXISTS variants_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gen_id UUID NOT NULL REFERENCES generation_history(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('side', 'back')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- メイン画像の情報
  base_prompt TEXT,
  base_negative_prompt TEXT,
  base_r2_key TEXT,
  base_seed INTEGER,
  base_dna JSONB,
  demographic TEXT,
  design_tokens JSONB,

  -- 生成結果
  r2_key TEXT,
  r2_url TEXT,
  view_conf FLOAT,
  sim_score FLOAT,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_variants_jobs_gen_id ON variants_jobs(gen_id);
CREATE INDEX IF NOT EXISTS idx_variants_jobs_status ON variants_jobs(status);
CREATE INDEX IF NOT EXISTS idx_variants_jobs_type ON variants_jobs(type);
CREATE INDEX IF NOT EXISTS idx_variants_jobs_created_at ON variants_jobs(created_at DESC);

-- 更新日時の自動更新
CREATE OR REPLACE FUNCTION update_variants_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_variants_jobs_updated_at
  BEFORE UPDATE ON variants_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_variants_jobs_updated_at();

-- コメント
COMMENT ON TABLE variants_jobs IS 'FUSION バリアント生成ジョブ管理テーブル（SIDE/BACK を個別に処理してタイムアウト回避）';
COMMENT ON COLUMN variants_jobs.gen_id IS '元となる generation_history の ID';
COMMENT ON COLUMN variants_jobs.type IS 'バリアントタイプ（side または back）';
COMMENT ON COLUMN variants_jobs.status IS 'ジョブステータス（pending/processing/completed/failed）';
COMMENT ON COLUMN variants_jobs.base_seed IS 'メイン画像生成時の seed（SIDE は +1、BACK は +2）';
COMMENT ON COLUMN variants_jobs.base_dna IS 'FUSION で使用した DNA データ';
COMMENT ON COLUMN variants_jobs.design_tokens IS 'extract-tokens で抽出したデザイントークン';
