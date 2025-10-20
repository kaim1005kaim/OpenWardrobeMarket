import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables:');
  if (!SUPABASE_URL) console.error('  NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_SERVICE_KEY) console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function runMigration(migrationFile: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'public' }
  });

  console.log(`[migrate] Reading migration file: ${migrationFile}`);
  const sqlContent = readFileSync(migrationFile, 'utf-8');

  // Split by semicolons and filter out comments and empty statements
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s !== '');

  console.log(`[migrate] Found ${statements.length} SQL statements to execute`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    console.log(`[migrate] Executing statement ${i + 1}/${statements.length}...`);
    console.log(`[migrate] SQL: ${statement.substring(0, 100)}...`);

    try {
      // Use direct SQL execution through the REST API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ query: statement })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[migrate] Statement ${i + 1} failed:`, error);
        console.error(`[migrate] Failed statement:`, statement);
        process.exit(1);
      }

      console.log(`[migrate] ✓ Statement ${i + 1} completed`);
    } catch (error) {
      console.error(`[migrate] Statement ${i + 1} failed:`, error);
      console.error(`[migrate] Failed statement:`, statement);
      process.exit(1);
    }
  }

  console.log('[migrate] Migration completed successfully!');
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: npx tsx scripts/run-migration.ts <migration-file>');
  process.exit(1);
}

runMigration(migrationFile);
