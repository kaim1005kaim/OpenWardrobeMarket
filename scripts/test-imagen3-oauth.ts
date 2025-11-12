/**
 * Test Vertex AI Imagen 3 with OAuth authentication
 *
 * Run with: npx tsx scripts/test-imagen3-oauth.ts
 */

import { GoogleAuth } from 'google-auth-library';

const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_APPLICATION_CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

async function testImagen3WithOAuth() {
  console.log('🧪 Testing Vertex AI Imagen 3 with OAuth authentication\n');

  if (!GOOGLE_CLOUD_PROJECT) {
    console.error('❌ GOOGLE_CLOUD_PROJECT not set');
    process.exit(1);
  }
  console.log('✅ GOOGLE_CLOUD_PROJECT:', GOOGLE_CLOUD_PROJECT);

  if (!GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.error('❌ GOOGLE_APPLICATION_CREDENTIALS_JSON not set');
    process.exit(1);
  }

  try {
    const credentials = JSON.parse(GOOGLE_APPLICATION_CREDENTIALS_JSON);
    console.log('✅ Credentials parsed');
    console.log('   - Service Account:', credentials.client_email);
    console.log('   - Project ID:', credentials.project_id);

    // Fix private key format - replace literal \n with actual newlines
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    // Get OAuth access token
    console.log('\n🔑 Getting OAuth access token...');
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      throw new Error('Failed to get access token');
    }

    console.log('✅ Access token obtained');
    console.log('   - Token (first 20 chars):', accessToken.token.slice(0, 20) + '...');

    // Call Imagen 3 API
    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT}/locations/us-central1/publishers/google/models/imagen-3.0-generate-002:predict`;

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
    console.log('\n🔄 Sending request...');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`\n📥 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ Error response:', errorText);

      if (response.status === 403) {
        console.log('\n💡 権限エラー:');
        console.log('   1. Vertex AI APIが有効化されているか確認:');
        console.log('      gcloud services enable aiplatform.googleapis.com --project=' + GOOGLE_CLOUD_PROJECT);
        console.log('');
        console.log('   2. サービスアカウントに権限を付与:');
        console.log('      gcloud projects add-iam-policy-binding ' + GOOGLE_CLOUD_PROJECT + ' \\');
        console.log('        --member="serviceAccount:' + credentials.client_email + '" \\');
        console.log('        --role="roles/aiplatform.user"');
      } else if (response.status === 404) {
        console.log('\n💡 モデルが見つかりません:');
        console.log('   1. Imagen 3へのアクセスをリクエスト:');
        console.log('      https://console.cloud.google.com/vertex-ai/publishers/google/model-garden/imagegeneration?project=' + GOOGLE_CLOUD_PROJECT);
        console.log('   2. または imagen-3.0-generate-001 を試してください');
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
      if (error.stack) {
        console.error('   スタックトレース:', error.stack.split('\n').slice(0, 5).join('\n'));
      }
    }

    process.exit(1);
  }
}

testImagen3WithOAuth().catch(console.error);
