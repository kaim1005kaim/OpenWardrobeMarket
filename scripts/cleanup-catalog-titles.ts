/**
 * Clean up catalog item titles
 * - Remove brand names
 * - Convert (1) notation to _1
 * - Simplify descriptive text
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// List of brand names to remove
const BRANDS = [
  'Balenciaga', 'Chanel', 'Dior', 'Alexander McQueen', 'McQueen',
  'Yves Saint Laurent', 'YSL', 'Givenchy', 'Prada', 'Gucci',
  'Versace', 'Armani', 'Dolce & Gabbana', 'Dolce', 'Gabbana',
  'Fendi', 'Burberry', 'Louis Vuitton', 'Hermès', 'Hermes',
  'Celine', 'Bottega Veneta', 'Loewe', 'Valentino', 'Balmain',
  'Rick Owens', 'Comme des Garçons', 'Comme des Garcons', 'CDG',
  'Issey Miyake', 'Yohji Yamamoto', 'Maison Margiela', 'Margiela',
  'Martin Margiela', 'Ann Demeulemeester', 'Dries Van Noten',
  'Raf Simons', 'Helmut Lang', 'Jil Sander', 'Ann Demeulemeester',
  'Marc Jacobs', 'Tommy Hilfiger', 'Calvin Klein', 'Ralph Lauren',
  'Michael Kors', 'Donna Karan', 'DKNY', 'Anna Sui', 'Thierry Mugler',
  'Jean Paul Gaultier', 'Gaultier', 'Vivienne Westwood', 'Westwood',
  'Hussein Chalayan', 'Gareth Pugh', 'Christopher Kane', 'Gianni Versace',
  'Icon', 'Sculptural', 'Queen', 'Icones', 'Queens', 'Iconic'
];

function cleanTitle(originalTitle: string): string {
  let cleaned = originalTitle;

  // Remove .png extension for processing
  cleaned = cleaned.replace(/\.png$/i, '');

  // Extract year/decade prefix (e.g., "1910s", "2000s-2020s")
  const yearMatch = cleaned.match(/^(\d{4}s(?:-\d{4}s)?)/);
  const yearPrefix = yearMatch ? yearMatch[1] : '';

  // Extract number suffix if exists (e.g., "(1)" or at end)
  let numberSuffix = '';
  const numberMatch = cleaned.match(/\((\d+)\)$/);
  if (numberMatch) {
    numberSuffix = '_' + numberMatch[1];
  } else {
    // Check for number at the very end
    const endNumberMatch = cleaned.match(/_(\d+)$/);
    if (endNumberMatch) {
      numberSuffix = '_' + endNumberMatch[1];
    }
  }

  // Simple result: year + number
  if (yearPrefix) {
    cleaned = yearPrefix + numberSuffix;
  } else {
    // No year found, just clean up the original
    cleaned = cleaned.replace(/\((\d+)\)/g, '_$1');
    cleaned = cleaned.replace(/_+/g, '_');
    cleaned = cleaned.replace(/^_+|_+$/g, '');
  }

  // Add back .png extension
  cleaned = cleaned + '.png';

  return cleaned;
}

async function main() {
  console.log('🧹 Cleaning up catalog item titles...\n');

  // Get all catalog items
  const { data: items, error } = await supabase
    .from('published_items')
    .select('id, title')
    .eq('category', 'catalog');

  if (error) {
    console.error('❌ Error fetching items:', error);
    return;
  }

  console.log(`📦 Found ${items.length} catalog items\n`);

  let updatedCount = 0;
  let unchangedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const newTitle = cleanTitle(item.title);

    if (newTitle === item.title) {
      unchangedCount++;
      continue;
    }

    console.log(`[${i + 1}/${items.length}]`);
    console.log(`  Before: ${item.title}`);
    console.log(`  After:  ${newTitle}`);

    try {
      const { error: updateError } = await supabase
        .from('published_items')
        .update({ title: newTitle })
        .eq('id', item.id);

      if (updateError) {
        console.log(`  ❌ Update failed: ${updateError.message}`);
        failedCount++;
      } else {
        console.log('  ✅ Updated');
        updatedCount++;
      }
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`);
      failedCount++;
    }
  }

  console.log('\n🎉 Cleanup complete!');
  console.log(`✅ Updated: ${updatedCount}`);
  console.log(`⏭️  Unchanged: ${unchangedCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log(`📊 Total: ${items.length}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
