#!/usr/bin/env node

// Check which Supabase database we're actually connected to
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkConnection() {
  console.log('🔍 Checking Supabase connection...\n');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('Current settings:');
  console.log('  URL:', url);
  console.log('  Service key:', key ? `${key.substring(0, 20)}...` : 'Missing');
  
  if (!url || !key) {
    console.log('❌ Missing credentials');
    return;
  }

  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Test connection by listing tables
    console.log('\nTesting connection...');
    
    const { data, error } = await supabase
      .from('imagine_task_map')
      .select('count')
      .limit(1);

    if (error) {
      console.log('❌ Connection failed:', error.message);
      
      // Check if it's a different database
      if (error.code === 'PGRST116') {
        console.log('💡 This might be pointing to a different Supabase project');
        console.log('💡 Check if the URL matches your working database');
      }
    } else {
      console.log('✅ Connection successful');
      
      // Get recent data to verify we're on the right database
      const { data: mappings } = await supabase
        .from('imagine_task_map')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (mappings && mappings.length > 0) {
        console.log(`✅ Found ${mappings.length} recent mappings - this is the correct database`);
      } else {
        console.log('⚠️  No data found - might be a different/empty database');
      }
    }

    // Also check the "old" URL format
    console.log('\nChecking alternative URL...');
    const altUrl = 'https://sxetukosqdwtwgzihiod.supabase.co';  // From earlier DB connections
    
    if (altUrl !== url) {
      console.log(`Trying alternative URL: ${altUrl}`);
      
      const altSupabase = createClient(altUrl, key, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      const { data: altData, error: altError } = await altSupabase
        .from('imagine_task_map')
        .select('count')
        .limit(1);

      if (!altError) {
        console.log('✅ Alternative URL also works!');
        
        const { data: altMappings } = await altSupabase
          .from('imagine_task_map')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);
        
        if (altMappings && altMappings.length > 0) {
          console.log(`  Found ${altMappings.length} mappings on alternative database`);
          console.log('🔄 You might want to use this URL instead');
        }
      } else {
        console.log('❌ Alternative URL failed:', altError.message);
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkConnection();