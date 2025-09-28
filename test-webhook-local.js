#!/usr/bin/env node

// Test webhook code locally
import handler from './api/imagine-webhook.ts';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Mock NextApiRequest and NextApiResponse
function createMockReq(method, body) {
  return {
    method,
    body,
    headers: { 'content-type': 'application/json' }
  };
}

function createMockRes() {
  let statusCode = 200;
  let responseData = null;
  
  return {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          responseData = data;
          return { statusCode, responseData };
        },
        end: () => ({ statusCode, responseData: null })
      };
    },
    json: (data) => {
      responseData = data;
      return { statusCode, responseData };
    }
  };
}

async function testWebhookLocal() {
  console.log('🔍 Testing webhook locally...\n');
  
  // Check environment variables
  console.log('📋 Environment check:');
  console.log('  NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing');
  console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('❌ Missing Supabase credentials');
    return;
  }
  
  // Test 1: GET request
  console.log('\n1. Testing GET request...');
  try {
    const req = createMockReq('GET', {});
    const res = createMockRes();
    
    await handler(req, res);
    console.log('  Result: Should return 405 Method Not Allowed');
  } catch (error) {
    console.error('  Error:', error.message);
  }
  
  // Test 2: POST with valid data
  console.log('\n2. Testing POST with valid webhook data...');
  try {
    const testData = {
      request: "imagine.image.update",
      status: "completed",
      id: "test-local-webhook-123",
      result: {
        urls: ["https://test.com/1.jpg", "https://test.com/2.jpg"],
        upscaled_urls: ["https://test.com/1_up.jpg"]
      }
    };
    
    const req = createMockReq('POST', testData);
    const res = createMockRes();
    
    const result = await handler(req, res);
    console.log('  Result:', result || 'No result returned');
  } catch (error) {
    console.error('  Error:', error.message);
    console.error('  Stack:', error.stack);
  }
}

testWebhookLocal();