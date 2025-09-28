#!/usr/bin/env node

// Test the newest deployment
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

async function testNewDeployment() {
  console.log('🎯 Testing newest deployment (with fixes)...\n');

  // Use the newest deployment URL
  const deploymentUrl = 'https://open-wardrobe-market-3knubwzlk-kais-projects-d82b3656.vercel.app';
  const webhookUrl = `${deploymentUrl}/api/imagine-webhook`;

  // Create test mapping
  const testTaskId = `new-deploy-test-${Date.now()}`;
  const testJobId = `test-user:${Date.now()}-newdeploy`;
  
  console.log('📋 Creating test mapping...');
  const { error: mapError } = await supabase
    .from('imagine_task_map')
    .insert({ task_id: testTaskId, job_id: testJobId });
    
  if (mapError) {
    console.error('❌ Mapping failed:', mapError);
    return;
  }
  console.log('✅ Mapping created\n');

  // Test with completed webhook
  console.log('📡 Testing completed webhook...');
  
  const payload = {
    request: "imagine.image.update",
    status: "completed",
    id: testTaskId,
    result: {
      urls: ["https://newest-test.com/1.jpg", "https://newest-test.com/2.jpg"],
      upscaled_urls: ["https://newest-test.com/1_up.jpg"]
    }
  };
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log('  Status:', response.status, response.statusText);
    const responseText = await response.text();
    console.log('  Body:', responseText);
    
    if (response.status === 500) {
      console.log('❌ Webhook returned 500 error - check logs for details');
    } else if (response.ok) {
      // Wait and check database
      console.log('\n⏳ Waiting 3 seconds for processing...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const { data: events } = await supabase
        .from('event_log')
        .select('*')
        .eq('job_id', testJobId);
        
      if (events && events.length > 0) {
        console.log('🎉 SUCCESS! Event saved to database:');
        events.forEach(event => {
          console.log('  - Event type:', event.event_type);
          console.log('  - Result URLs:', event.result_urls?.length || 0);
          console.log('  - Upscaled URLs:', event.upscaled_urls?.length || 0);
        });
      } else {
        console.log('❌ Still no events in database');
        
        // Double check the mapping exists
        const { data: checkMapping } = await supabase
          .from('imagine_task_map')
          .select('*')
          .eq('task_id', testTaskId);
          
        if (checkMapping && checkMapping.length > 0) {
          console.log('✅ Mapping exists:', checkMapping[0]);
          console.log('💡 Webhook might be failing during processing');
        } else {
          console.log('❌ Mapping was deleted - unexpected');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Request error:', error.message);
  }
  
  // Clean up
  await supabase.from('event_log').delete().eq('job_id', testJobId);
  await supabase.from('imagine_task_map').delete().eq('task_id', testTaskId);
}

testNewDeployment();