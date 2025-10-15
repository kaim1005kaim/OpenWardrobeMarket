export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

// Relative import to avoid Vercel bundling issues
import { composePrompt } from '../../../../src/lib/prompt/buildMobile';
import type { Answers, DNA } from '../../../../src/lib/prompt/buildMobile';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { answers, dna, chipsChosen, askAnswers, freeTextTags } = body;

    if (!answers || !dna) {
      return NextResponse.json(
        { error: 'answers and dna are required' },
        { status: 400 }
      );
    }

    console.log('[prompt/compose] Input:', {
      answers,
      dna,
      chipsChosen,
      askAnswers,
      freeTextTags,
    });

    const result = composePrompt(
      answers as Answers,
      dna as DNA,
      chipsChosen || [],
      askAnswers || {},
      freeTextTags || []
    );

    console.log('[prompt/compose] Output:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[prompt/compose] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
