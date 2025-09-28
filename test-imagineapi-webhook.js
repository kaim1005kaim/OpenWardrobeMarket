#!/usr/bin/env node

// Test ImagineAPI webhook format and check API status
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const IMAGINE_API_TOKEN = 'imgn_suoc6eez6gfqlb2ke3jpniae2hi6akos';
const IMAGINE_API_BASE = 'https://cl.imagineapi.dev';

async function checkImagineAPI() {
  console.log('🔍 Checking ImagineAPI status and webhook configuration...\n');

  // 1. Check specific image status
  const imageId = '433524f4-a1f0-42e8-86c4-623c47d30fd2';
  console.log('📋 1. Checking status of image:', imageId);
  
  try {
    // Try to get image status
    const statusResponse = await fetch(`${IMAGINE_API_BASE}/items/images/${imageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${IMAGINE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('✅ Image status retrieved:');
      console.log(JSON.stringify(statusData, null, 2));
      
      // Check if it contains webhook info
      if (statusData.webhook || statusData.webhook_url || statusData.callback_url) {
        console.log('\n📡 Webhook configuration found in response!');
      }
    } else {
      console.log('❌ Failed to get image status:', statusResponse.status, statusResponse.statusText);
      const errorText = await statusResponse.text();
      console.log('Error:', errorText);
    }
  } catch (error) {
    console.error('❌ Error checking image status:', error.message);
  }

  // 2. Test different ImagineAPI endpoints
  console.log('\n📋 2. Testing ImagineAPI endpoints...');
  
  const endpoints = [
    '/items/images',
    '/account',
    '/webhooks',
    '/settings'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${IMAGINE_API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${IMAGINE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`  ${endpoint}: ${response.status} ${response.statusText}`);
      
      if (endpoint === '/webhooks' && response.ok) {
        const data = await response.json();
        console.log('    Webhook data:', JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.log(`  ${endpoint}: Error - ${err.message}`);
    }
  }

  // 3. Check recent generations
  console.log('\n📋 3. Checking recent generations...');
  
  try {
    const listResponse = await fetch(`${IMAGINE_API_BASE}/items/images?limit=3`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${IMAGINE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (listResponse.ok) {
      const listData = await listResponse.json();
      console.log('✅ Recent generations:');
      
      if (listData.data && Array.isArray(listData.data)) {
        listData.data.forEach((img, i) => {
          console.log(`  Image ${i + 1}:`);
          console.log(`    - ID: ${img.id}`);
          console.log(`    - Status: ${img.status}`);
          console.log(`    - Created: ${img.created_at}`);
          console.log(`    - Progress: ${img.progress}%`);
          if (img.upscaled_urls || img.urls) {
            console.log(`    - Has results: Yes`);
          }
        });
      }
    } else {
      console.log('❌ Failed to list images:', listResponse.status);
    }
  } catch (error) {
    console.error('❌ Error listing images:', error.message);
  }

  // 4. Test webhook configuration in request
  console.log('\n📋 4. Testing webhook configuration methods...');
  
  const testPrompt = 'test webhook configuration';
  const webhookUrl = 'https://open-wardrobe-market.vercel.app/api/imagine-webhook';
  
  const configurations = [
    { name: 'webhook', params: { prompt: testPrompt, webhook: webhookUrl } },
    { name: 'webhook_url', params: { prompt: testPrompt, webhook_url: webhookUrl } },
    { name: 'callback_url', params: { prompt: testPrompt, callback_url: webhookUrl } },
    { name: 'notify_url', params: { prompt: testPrompt, notify_url: webhookUrl } },
    { name: 'notification_url', params: { prompt: testPrompt, notification_url: webhookUrl } }
  ];
  
  console.log('Testing different webhook parameter names (dry run - not creating images)...');
  configurations.forEach(config => {
    console.log(`  - ${config.name}: Would send ${JSON.stringify(config.params)}`);
  });
  
  console.log('\n💡 Recommendations:');
  console.log('1. Check ImagineAPI dashboard for webhook settings');
  console.log('2. Look for API documentation about webhooks');
  console.log('3. Contact ImagineAPI support if webhook parameter is unclear');
  console.log('4. Consider polling /items/images/{id} endpoint as fallback');
}

checkImagineAPI();