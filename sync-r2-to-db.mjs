
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// .envファイルから環境変数を読み込む
dotenv.config({ path: ".env.local" });

// --- 設定 ---
const R2_S3_ENDPOINT = process.env.R2_S3_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PREFIXES_TO_SYNC = ["catalog/", "usergen/"];
const BATCH_SIZE = 1000; // 一度にSupabaseに送信するレコード数

// --- クライアントの初期化 ---
if (
  !R2_S3_ENDPOINT ||
  !R2_ACCESS_KEY_ID ||
  !R2_SECRET_ACCESS_KEY ||
  !R2_BUCKET ||
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY
) {
  console.error("❌ 必要な環境変数が設定されていません。スクリプトを終了します。");
  process.exit(1);
}

const r2 = new S3Client({
  region: "auto",
  endpoint: R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * R2から指定されたプレフィックスのすべてのオブジェクトを取得する
 * @param {string} prefix - オブジェクトのプレフィックス
 * @returns {Promise<import("@aws-sdk/client-s3")._Object[]>}
 */
async function fetchAllObjects(prefix) {
  console.log(`☁️ R2から "${prefix}" のファイルリストを取得中...`);
  const objects = [];
  let isTruncated = true;
  let continuationToken;

  while (isTruncated) {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await r2.send(command);
    if (response.Contents) {
      // フォルダ自体を除外
      const files = response.Contents.filter(obj => obj.Key !== prefix && !obj.Key.endsWith('/'));
      objects.push(...files);
    }
    isTruncated = response.IsTruncated;
    continuationToken = response.NextContinuationToken;
    if (isTruncated) {
      console.log(`    ... ${objects.length}件取得済み、次のページを読み込み中`);
    }
  }
  console.log(`✅ "${prefix}" から ${objects.length}件のファイルを取得しました。`);
  return objects;
}

/**
 * ファイルキーからタイトルを生成する
 * @param {string} key - R2オブジェクトキー
 * @returns {string}
 */
function generateTitleFromKey(key) {
  return key
    .split("/")
    .pop() // ファイル名部分を取得
    .replace(/\.(png|jpg|jpeg|webp)$/i, "") // 拡張子を削除
    .replace(/_/g, " ") // アンダースコアをスペースに
    .replace(/\([0-9]+\)/g, "") // (1)のような番号を削除
    .trim();
}


/**
 * R2オブジェクトをSupabaseのレコードに変換する
 * @param {import("@aws-sdk/client-s3")._Object[]} objects
 * @returns {any[]}
 */
function transformToDbRecords(objects) {
  console.log("🔄 データベースレコードへの変換中...");
  const records = objects.map((obj) => ({
    final_key: obj.Key,
    raw_key: obj.Key, // raw_keyにも同じものを設定
    title: generateTitleFromKey(obj.Key),
    status: "public", // デフォルトでpublicに設定
    created_at: obj.LastModified,
    updated_at: obj.LastModified,
    metadata: {
      size: obj.Size,
      eTag: obj.ETag,
      lastModified: obj.LastModified,
      source: "r2-sync-script",
    },
  }));
  console.log(`✅ ${records.length}件のレコードを変換しました。`);
  return records;
}

/**
 * メインの同期処理
 */
async function syncR2ToDb() {
  console.log("--- R2 -> Supabase 同期スクリプト開始 ---");

  let allObjects = [];
  for (const prefix of PREFIXES_TO_SYNC) {
    const objects = await fetchAllObjects(prefix);
    allObjects.push(...objects);
  }

  if (allObjects.length === 0) {
    console.log("🤷 R2に同期対象のファイルが見つかりませんでした。");
    return;
  }

  const recordsToUpsert = transformToDbRecords(allObjects);

  console.log(`📝 Supabaseに ${recordsToUpsert.length}件のレコードを書き込み中... (バッチサイズ: ${BATCH_SIZE})`);

  for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE) {
    const batch = recordsToUpsert.slice(i, i + BATCH_SIZE);
    console.log(`    ... バッチ ${i / BATCH_SIZE + 1} を処理中 (${batch.length}件)`);
    
    const { error } = await supabase.from("assets").upsert(batch, {
      onConflict: "final_key", // final_keyが重複した場合は更新
      ignoreDuplicates: false,
    });

    if (error) {
      console.error("❌ Supabaseへの書き込み中にエラーが発生しました:", error);
      // エラーが発生しても次のバッチへ進む
    }
  }

  console.log("🎉 全ての同期処理が完了しました！");
}

syncR2ToDb().catch((err) => {
  console.error("❌ スクリプトの実行中に致命的なエラーが発生しました:", err);
  process.exit(1);
});
