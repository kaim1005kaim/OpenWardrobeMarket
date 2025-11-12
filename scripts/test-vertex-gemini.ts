/**
 * Test Vertex AI Gemini API
 *
 * Run with: npx tsx scripts/test-vertex-gemini.ts
 */

import { GoogleAuth } from 'google-auth-library';

const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_APPLICATION_CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

async function testVertexGemini() {
  console.log('🧪 Testing Vertex AI Gemini API\n');

  if (!GOOGLE_CLOUD_PROJECT || !GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.error('❌ Required environment variables not set');
    process.exit(1);
  }

  try {
    const credentials = JSON.parse(GOOGLE_APPLICATION_CREDENTIALS_JSON);

    // Fix private key format
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    console.log('✅ Credentials parsed');
    console.log('   - Service Account:', credentials.client_email);

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

    // Test Gemini 2.5 Flash
    console.log('\n📍 Testing Gemini 2.5 Flash...');
    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT}/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Say "Hello from Vertex AI Gemini!" in Japanese.'
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 100
      }
    };

    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));
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

      if (response.status === 404) {
        console.log('\n💡 モデルが見つかりません。利用可能なモデル:');
        console.log('   - gemini-1.5-flash');
        console.log('   - gemini-1.5-pro');
        console.log('   - gemini-2.5-flash');
        console.log('   - gemini-2.0-flash-exp (experimental)');
      }

      process.exit(1);
    }

    const data = await response.json();
    console.log('\n✅ レスポンス受信成功！');

    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts) {
        const text = candidate.content.parts[0].text;
        console.log('\n📝 Geminiの応答:');
        console.log('   "' + text + '"');
      }
    }

    console.log('\n🎉 Vertex AI GeminiはOKです！');
    console.log('   既存のGemini API呼び出しをVertex AIに移行できます。');

  } catch (error) {
    console.error('\n❌ エラー:', error);

    if (error instanceof Error) {
      console.error('   詳細:', error.message);
    }

    process.exit(1);
  }
}

testVertexGemini().catch(console.error);
