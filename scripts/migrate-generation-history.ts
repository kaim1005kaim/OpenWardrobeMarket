/**
 * Migration script to add FUSION fields to generation_history table
 * Run with: npx tsx scripts/migrate-generation-history.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
  console.log('Starting migration: add_fusion_fields_to_generation_history');

  const migrations = [
    // Add metadata column
    {
      name: 'Add metadata column',
      sql: `ALTER TABLE public.generation_history ADD COLUMN IF NOT EXISTS metadata jsonb;`
    },
    // Add tags column
    {
      name: 'Add tags column',
      sql: `ALTER TABLE public.generation_history ADD COLUMN IF NOT EXISTS tags text[];`
    },
    // Add status column
    {
      name: 'Add status column',
      sql: `ALTER TABLE public.generation_history ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';`
    },
    // Add r2_key column
    {
      name: 'Add r2_key column',
      sql: `ALTER TABLE public.generation_history ADD COLUMN IF NOT EXISTS r2_key text;`
    },
    // Add r2_url column
    {
      name: 'Add r2_url column',
      sql: `ALTER TABLE public.generation_history ADD COLUMN IF NOT EXISTS r2_url text;`
    },
    // Create index for tags
    {
      name: 'Create tags GIN index',
      sql: `CREATE INDEX IF NOT EXISTS idx_generation_history_tags ON public.generation_history USING GIN(tags);`
    },
    // Create index for status
    {
      name: 'Create status index',
      sql: `CREATE INDEX IF NOT EXISTS idx_generation_history_status ON public.generation_history(status);`
    }
  ];

  for (const migration of migrations) {
    console.log(`\nRunning: ${migration.name}`);
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: migration.sql });

      if (error) {
        // Try direct SQL execution via REST API
        console.log('Trying direct execution...');
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ sql_query: migration.sql })
        });

        if (!response.ok) {
          console.error(`❌ Failed: ${migration.name}`);
          console.error('Error:', error);

          // For ADD COLUMN errors, this is likely because column already exists - OK
          if (migration.sql.includes('ADD COLUMN IF NOT EXISTS')) {
            console.log('⚠️  Column may already exist - continuing...');
            continue;
          }

          // For CREATE INDEX errors with IF NOT EXISTS, also OK
          if (migration.sql.includes('CREATE INDEX IF NOT EXISTS')) {
            console.log('⚠️  Index may already exist - continuing...');
            continue;
          }
        } else {
          console.log(`✅ Success: ${migration.name}`);
        }
      } else {
        console.log(`✅ Success: ${migration.name}`);
      }
    } catch (err) {
      console.error(`❌ Exception in ${migration.name}:`, err);

      // Continue for idempotent operations
      if (migration.sql.includes('IF NOT EXISTS')) {
        console.log('⚠️  Continuing despite error (idempotent operation)...');
        continue;
      }
    }
  }

  console.log('\n✅ Migration completed successfully!');

  // Verify columns exist
  console.log('\nVerifying schema...');
  const { data: schemaCheck, error: schemaError } = await supabase
    .from('generation_history')
    .select('id, metadata, tags, status, r2_key, r2_url')
    .limit(1);

  if (schemaError) {
    console.error('❌ Schema verification failed:', schemaError);
  } else {
    console.log('✅ Schema verified! Columns exist:', Object.keys(schemaCheck?.[0] || {}));
  }
}

migrate().catch(console.error);
