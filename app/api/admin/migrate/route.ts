/**
 * Admin API to run database migrations
 * POST /api/admin/migrate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    console.log('[admin/migrate] Starting migration');

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Run each ALTER TABLE command individually
    const migrations = [
      `ALTER TABLE public.generation_history ADD COLUMN IF NOT EXISTS metadata jsonb`,
      `ALTER TABLE public.generation_history ADD COLUMN IF NOT EXISTS tags text[]`,
      `ALTER TABLE public.generation_history ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'`,
      `ALTER TABLE public.generation_history ADD COLUMN IF NOT EXISTS r2_key text`,
      `ALTER TABLE public.generation_history ADD COLUMN IF NOT EXISTS r2_url text`,
    ];

    const results = [];

    for (let i = 0; i < migrations.length; i++) {
      const sql = migrations[i];
      console.log(`[admin/migrate] Running migration ${i + 1}/${migrations.length}:`, sql);

      try {
        // Use Supabase SQL query via REST API
        const { data, error } = await supabase.rpc('execute_sql', { query: sql });

        if (error) {
          console.error(`[admin/migrate] Migration ${i + 1} error:`, error);
          results.push({ index: i + 1, sql, success: false, error: error.message });
        } else {
          console.log(`[admin/migrate] Migration ${i + 1} success`);
          results.push({ index: i + 1, sql, success: true });
        }
      } catch (err) {
        console.error(`[admin/migrate] Migration ${i + 1} exception:`, err);
        results.push({ index: i + 1, sql, success: false, error: String(err) });
      }
    }

    // Verify schema
    const { data: testData, error: testError } = await supabase
      .from('generation_history')
      .select('id, metadata, tags, status, r2_key, r2_url')
      .limit(1);

    if (testError) {
      console.error('[admin/migrate] Schema verification failed:', testError);
      return NextResponse.json({
        success: false,
        message: 'Migration completed but schema verification failed',
        results,
        verificationError: testError.message
      }, { status: 500 });
    }

    console.log('[admin/migrate] Migration and verification successful');

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      results,
      schemaColumns: testData && testData.length > 0 ? Object.keys(testData[0]) : []
    });

  } catch (error) {
    console.error('[admin/migrate] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
