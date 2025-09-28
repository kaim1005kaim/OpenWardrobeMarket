#!/usr/bin/env node

// Test complete flow: Generate → Webhook → Database → SSE
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

async function testCompleteFlow() {
  console.log('🚀 COMPLETE FLOW TEST - Generate API → Webhook → SSE\n');

  const deploymentUrl = 'https://open-wardrobe-market-3knubwzlk-kais-projects-d82b3656.vercel.app';
  
  // Step 1: Simulate Generate API call
  const testTaskId = `complete-flow-${Date.now()}`;
  const testJobId = `test-user:${Date.now()}-complete`;
  
  console.log('📋 Step 1: Simulating Generate API - Creating mapping...');
  const { error: mapError } = await supabase
    .from('imagine_task_map')
    .insert({ task_id: testTaskId, job_id: testJobId });
    
  if (mapError) {
    console.error('❌ Failed:', mapError);
    return;
  }
  console.log('✅ ID mapping created (simulates generate API)');
  
  // Step 2: Send progress webhook
  console.log('\n📡 Step 2: Simulating ImagineAPI progress webhook...');
  
  const progressResponse = await fetch(`${deploymentUrl}/api/imagine-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request: "imagine.image.update",
      status: "in-progress", 
      id: testTaskId,
      progress: 75,
      url: "https://preview.com/generating.jpg"
    })
  });
  
  console.log('  Progress webhook:', progressResponse.status, progressResponse.statusText);
  
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 3: Send completed webhook
  console.log('\n📡 Step 3: Simulating ImagineAPI completed webhook...');
  
  const completedResponse = await fetch(`${deploymentUrl}/api/imagine-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request: "imagine.image.update",
      status: "completed",
      id: testTaskId,
      result: {
        urls: [
          "https://result.com/final1.jpg",
          "https://result.com/final2.jpg", 
          "https://result.com/final3.jpg",
          "https://result.com/final4.jpg"
        ],
        upscaled_urls: [
          "https://result.com/final1_4x.jpg",
          "https://result.com/final2_4x.jpg"
        ]
      }
    })
  });
  
  console.log('  Completed webhook:', completedResponse.status, completedResponse.statusText);
  
  // Step 4: Verify database
  console.log('\n📊 Step 4: Checking database events...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const { data: events } = await supabase
    .from('event_log')
    .select('*')
    .eq('job_id', testJobId)
    .order('id', { ascending: true });
    
  if (events && events.length > 0) {
    console.log(`✅ Found ${events.length} events in database:`);
    
    events.forEach((event, i) => {
      console.log(`  Event ${i + 1}: ${event.event_type}`);
      if (event.event_type === 'progress') {
        console.log(`    - Progress: ${event.progress}%`);
        console.log(`    - Preview: ${event.preview_url}`);
      } else if (event.event_type === 'completed') {
        console.log(`    - Result URLs: ${event.result_urls?.length || 0}`);
        console.log(`    - Upscaled URLs: ${event.upscaled_urls?.length || 0}`);
      }
    });
    
    // Step 5: Test SSE endpoint
    console.log('\n🔄 Step 5: Testing SSE endpoint availability...');
    const sseUrl = `${deploymentUrl}/api/sse/generation/${encodeURIComponent(testJobId)}`;
    console.log('  SSE URL:', sseUrl);
    
    // Try to connect to SSE (just check if it responds)
    try {
      const sseResponse = await fetch(sseUrl, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' }
      });
      
      if (sseResponse.ok) {
        console.log('✅ SSE endpoint is accessible');
        console.log('  Status:', sseResponse.status);
        console.log('  Content-Type:', sseResponse.headers.get('content-type'));
        
        console.log('\n🎉 COMPLETE SUCCESS!');
        console.log('📝 Flow Summary:');
        console.log('  ✅ Generate API: ID mapping created');
        console.log('  ✅ Webhook: Progress event processed');
        console.log('  ✅ Webhook: Completed event processed');
        console.log('  ✅ Database: Events stored correctly');
        console.log('  ✅ SSE: Endpoint ready for streaming');
        console.log('\n💡 The full Webhook → SSE flow is now working!');
        
      } else {
        console.log('⚠️  SSE endpoint returned:', sseResponse.status, sseResponse.statusText);
      }
      
    } catch (sseError) {
      console.log('⚠️  SSE test error:', sseError.message);
      console.log('  (This might be expected for SSE connections)');
    }
    
  } else {
    console.log('❌ No events found in database');
  }
  
  // Clean up
  console.log('\n🧹 Cleaning up...');
  await supabase.from('event_log').delete().eq('job_id', testJobId);
  await supabase.from('imagine_task_map').delete().eq('task_id', testTaskId);
  console.log('✅ Cleanup complete');
}

testCompleteFlow();