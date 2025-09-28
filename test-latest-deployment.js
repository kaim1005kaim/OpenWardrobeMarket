#!/usr/bin/env node

// Test the latest successful deployment
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function testLatestDeployment() {
  console.log('🚀 Testing latest successful deployment...\n');

  // Use the latest successful deployment URL
  const deploymentUrl = 'https://open-wardrobe-market-5duzme5cn-kais-projects-d82b3656.vercel.app';
  const webhookUrl = `${deploymentUrl}/api/imagine-webhook`;

  // Create test mapping first
  const testTaskId = `latest-test-${Date.now()}`;
  const testJobId = `test-user:${Date.now()}-latest123`;
  
  console.log('📋 Creating test mapping...');
  console.log('  task_id:', testTaskId);
  console.log('  job_id:', testJobId);
  
  const { error: mapError } = await supabase
    .from('imagine_task_map')
    .insert({
      task_id: testTaskId,
      job_id: testJobId
    });
    
  if (mapError) {
    console.error('❌ Failed to create mapping:', mapError);
    return;
  }
  console.log('✅ Mapping created\n');

  // Test webhook with completed payload
  console.log('🧪 Testing webhook endpoint...');
  console.log('  URL:', webhookUrl);
  
  const webhookPayload = {
    request: "imagine.image.update",
    status: "completed",
    id: testTaskId,
    result: {
      urls: [
        "https://test-deployment.com/image1.jpg",
        "https://test-deployment.com/image2.jpg", 
        "https://test-deployment.com/image3.jpg",
        "https://test-deployment.com/image4.jpg"
      ],
      upscaled_urls: [
        "https://test-deployment.com/image1_upscaled.jpg"
      ]
    }
  };
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });
    
    console.log('  Response Status:', response.status, response.statusText);
    
    if (response.ok) {
      const responseText = await response.text();
      console.log('  Response Body:', responseText);
      
      // Wait and check database
      console.log('\n⏳ Waiting for webhook processing...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { data: events } = await supabase
        .from('event_log')
        .select('*')
        .eq('job_id', testJobId)
        .eq('event_type', 'completed');
        
      if (events && events.length > 0) {
        console.log('✅ SUCCESS! Webhook processed and saved to database');
        console.log('  Event data:');
        console.log('    - job_id:', events[0].job_id);
        console.log('    - event_type:', events[0].event_type);
        console.log('    - result_urls:', events[0].result_urls?.length, 'images');
        console.log('    - upscaled_urls:', events[0].upscaled_urls?.length, 'images');
        
        // Test SSE endpoint
        console.log('\n🔄 Testing SSE endpoint...');
        const sseUrl = `${deploymentUrl}/api/sse/generation/${encodeURIComponent(testJobId)}`;
        console.log('  SSE URL:', sseUrl);
        console.log('  You can test this manually in the browser or with a SSE client');
        
      } else {
        console.log('❌ Event not found in database');
      }
      
      // Clean up
      await supabase.from('event_log').delete().eq('job_id', testJobId);
      await supabase.from('imagine_task_map').delete().eq('task_id', testTaskId);
      console.log('\n🧹 Test data cleaned up');
      
    } else {
      const errorText = await response.text();
      console.log('  Error Response:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testLatestDeployment();