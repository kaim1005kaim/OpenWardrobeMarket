/**
 * Test script to verify Vertex AI credentials
 *
 * Run with: npx tsx scripts/test-vertex-ai-credentials.ts
 */

import { PredictionServiceClient } from '@google-cloud/aiplatform';

const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_APPLICATION_CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

async function testVertexAICredentials() {
  console.log('🔍 Testing Vertex AI Credentials...\n');

  // Check environment variables
  if (!GOOGLE_CLOUD_PROJECT) {
    console.error('❌ GOOGLE_CLOUD_PROJECT not set');
    process.exit(1);
  }
  console.log('✅ GOOGLE_CLOUD_PROJECT:', GOOGLE_CLOUD_PROJECT);

  if (!GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.error('❌ GOOGLE_APPLICATION_CREDENTIALS_JSON not set');
    process.exit(1);
  }

  // Parse credentials
  let credentials;
  try {
    credentials = JSON.parse(GOOGLE_APPLICATION_CREDENTIALS_JSON);
    console.log('✅ Credentials parsed successfully');
    console.log('   - Service Account:', credentials.client_email);
    console.log('   - Project ID:', credentials.project_id);
  } catch (error) {
    console.error('❌ Failed to parse credentials JSON:', error);
    process.exit(1);
  }

  // Initialize client
  console.log('\n🔧 Initializing PredictionServiceClient...');
  try {
    const client = new PredictionServiceClient({
      apiEndpoint: 'us-central1-aiplatform.googleapis.com',
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
    });
    console.log('✅ Client initialized successfully');

    // Test endpoint format
    const endpoint = `projects/${GOOGLE_CLOUD_PROJECT}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001`;
    console.log('\n📍 Endpoint:', endpoint);

    // Try a test request (this will fail if no access, but we can check the error message)
    console.log('\n🧪 Testing API access...');
    console.log('(This may fail with "permission denied" or "access not granted" - that\'s okay!)');

    const instance = {
      structValue: {
        fields: {
          prompt: {
            stringValue: 'A simple test image of a blue square',
          },
        },
      },
    };

    const parameters = {
      structValue: {
        fields: {
          sampleCount: { numberValue: 1 },
          aspectRatio: { stringValue: '1:1' },
        },
      },
    };

    const request = {
      endpoint,
      instances: [instance],
      parameters,
    };

    const [response] = await client.predict(request);

    if (response.predictions && response.predictions.length > 0) {
      console.log('✅ API access confirmed! Imagen 3 is working.');
      console.log('   - Response received with', response.predictions.length, 'predictions');
    } else {
      console.log('⚠️  API responded but no predictions returned');
    }
  } catch (error: any) {
    console.error('\n❌ API Error:', error.message);

    // Analyze error
    if (error.message?.includes('permission') || error.message?.includes('403')) {
      console.log('\n💡 Solution:');
      console.log('   1. Ensure Vertex AI API is enabled:');
      console.log('      gcloud services enable aiplatform.googleapis.com --project=' + GOOGLE_CLOUD_PROJECT);
      console.log('');
      console.log('   2. Grant IAM permission:');
      console.log('      gcloud projects add-iam-policy-binding ' + GOOGLE_CLOUD_PROJECT + ' \\');
      console.log('        --member="serviceAccount:' + credentials.client_email + '" \\');
      console.log('        --role="roles/aiplatform.user"');
    } else if (error.message?.includes('not found') || error.message?.includes('404')) {
      console.log('\n💡 Solution:');
      console.log('   Request Imagen 3 access:');
      console.log('   https://console.cloud.google.com/vertex-ai/publishers/google/model-garden/imagegeneration?project=' + GOOGLE_CLOUD_PROJECT);
    } else {
      console.log('\n💡 Check the error message above for details.');
    }

    process.exit(1);
  }

  console.log('\n✅ All credential tests passed!');
  console.log('   Your Vertex AI setup is ready to use.');
}

testVertexAICredentials().catch(console.error);
