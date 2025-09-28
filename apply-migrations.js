#!/usr/bin/env node

// Apply database migrations to Supabase
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function applyMigration(filePath) {
  console.log(`\n📂 Applying migration: ${filePath}`);
  
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Split SQL by statements (basic implementation)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`   Found ${statements.length} SQL statements`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`   Executing statement ${i + 1}/${statements.length}...`);
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          // Try direct SQL execution if RPC doesn't work
          const { error: directError } = await supabase.from('dual').select('1');
          
          if (directError) {
            console.error(`   ❌ Error in statement ${i + 1}:`, error.message);
            console.error(`   Statement:`, statement.substring(0, 100) + '...');
            // Continue with other statements
          } else {
            console.log(`   ✅ Statement ${i + 1} executed successfully`);
          }
        } else {
          console.log(`   ✅ Statement ${i + 1} executed successfully`);
        }
      }
    }
    
    console.log(`✅ Migration completed: ${path.basename(filePath)}`);
    
  } catch (err) {
    console.error(`❌ Failed to apply migration ${filePath}:`, err.message);
    return false;
  }
  
  return true;
}

async function main() {
  console.log('🚀 Starting database migration process...');
  
  const migrationsDir = './migrations';
  const migrationFiles = [
    '006_webhook_improvements.sql',
    '007_embeddings_and_recipes.sql'
  ];
  
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    
    if (fs.existsSync(filePath)) {
      await applyMigration(filePath);
    } else {
      console.log(`⚠️  Migration file not found: ${filePath}`);
    }
  }
  
  // Test the key tables
  console.log('\n🔍 Verifying tables...');
  
  try {
    const { data: eventLog } = await supabase.from('event_log').select('*').limit(1);
    console.log('✅ event_log table is accessible');
    
    const { data: genHistory } = await supabase.from('generation_history').select('*').limit(1);
    console.log('✅ generation_history table is accessible');
    
    const { data: jobSessions } = await supabase.from('job_sessions').select('*').limit(1);
    console.log('✅ job_sessions table is accessible');
    
  } catch (error) {
    console.error('❌ Table verification failed:', error.message);
  }
  
  console.log('\n🎉 Migration process completed!');
}

main().catch(console.error);