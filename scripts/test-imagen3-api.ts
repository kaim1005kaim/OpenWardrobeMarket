/**
 * Test Vertex AI Imagen 3 REST API
 *
 * Run with: npx tsx scripts/test-imagen3-api.ts
 */

const VERTEX_AI_API_KEY = process.env.VERTEX_AI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;

async function testImagen3() {
  console.log('🧪 Testing Vertex AI Imagen 3 REST API\n');

  if (!VERTEX_AI_API_KEY) {
    console.error('❌ VERTEX_AI_API_KEY not set');
    process.exit(1);
  }
  console.log('✅ VERTEX_AI_API_KEY:', VERTEX_AI_API_KEY.slice(0, 10) + '...');

  if (!GOOGLE_CLOUD_PROJECT) {
    console.error('❌ GOOGLE_CLOUD_PROJECT not set');
    process.exit(1);
  }
  console.log('✅ GOOGLE_CLOUD_PROJECT:', GOOGLE_CLOUD_PROJECT);

  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`;

  console.log('\n📍 Endpoint:', endpoint);

  const requestBody = {
    instances: [
      {
        prompt: 'A simple test image: a blue square on white background'
      }
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
      safetySetting: 'block_only_high'
    }
  };

  console.log('\n📤 Request body:', JSON.stringify(requestBody, null, 2));

  try {
    console.log('\n🔄 Sending request...');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERTEX_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`\n📥 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ Error response:', errorText);

      if (response.status === 401 || response.status === 403) {
        console.log('\n💡 認証エラー:');
        console.log('   1. APIキーが正しいか確認してください');
        console.log('   2. Vertex AI APIが有効化されているか確認してください');
        console.log('   3. Imagen 3へのアクセスが許可されているか確認してください');
      }

      process.exit(1);
    }

    const data = await response.json();
    console.log('\n✅ レスポンス受信成功！');

    if (data.predictions && data.predictions.length > 0) {
      const prediction = data.predictions[0];

      if (prediction.bytesBase64Encoded) {
        const imageSize = prediction.bytesBase64Encoded.length;
        console.log(`   - 画像データサイズ: ${imageSize} bytes`);
        console.log(`   - 画像データ (最初の50文字): ${prediction.bytesBase64Encoded.slice(0, 50)}...`);
      } else {
        console.log('   - レスポンス構造:', JSON.stringify(prediction, null, 2).slice(0, 500));
      }
    } else {
      console.log('   - predictions配列が空です');
      console.log('   - レスポンス全体:', JSON.stringify(data, null, 2).slice(0, 500));
    }

    console.log('\n🎉 Imagen 3 APIは正常に動作しています！');
    console.log('   バリアント生成機能が使用可能です。');

  } catch (error) {
    console.error('\n❌ エラー:', error);

    if (error instanceof Error) {
      console.error('   詳細:', error.message);
    }

    process.exit(1);
  }
}

testImagen3().catch(console.error);
