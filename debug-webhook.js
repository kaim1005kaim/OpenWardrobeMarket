#!/usr/bin/env node

// Debug webhook endpoint
async function debugWebhook() {
  console.log('🔍 Debugging webhook endpoint...\n');

  const url = 'https://open-wardrobe-market-2key79wyj-kais-projects-d82b3656.vercel.app/api/imagine-webhook';

  // Test 1: GET request
  console.log('1. Testing GET request...');
  try {
    const getResponse = await fetch(url, { method: 'GET' });
    console.log('  Status:', getResponse.status, getResponse.statusText);
    const getText = await getResponse.text();
    console.log('  Body:', getText);
  } catch (err) {
    console.log('  Error:', err.message);
  }

  console.log();

  // Test 2: POST with empty body
  console.log('2. Testing POST with empty body...');
  try {
    const postResponse = await fetch(url, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('  Status:', postResponse.status, postResponse.statusText);
    const postText = await postResponse.text();
    console.log('  Body:', postText);
  } catch (err) {
    console.log('  Error:', err.message);
  }

  console.log();

  // Test 3: POST with minimal valid data
  console.log('3. Testing POST with minimal valid webhook data...');
  try {
    const validResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request: "imagine.image.update",
        status: "queued",
        id: "test-debug-123"
      })
    });
    console.log('  Status:', validResponse.status, validResponse.statusText);
    const validText = await validResponse.text();
    console.log('  Body:', validText);
  } catch (err) {
    console.log('  Error:', err.message);
  }
}

debugWebhook();