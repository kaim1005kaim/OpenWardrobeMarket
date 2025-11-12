export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

// Relative import to avoid Vercel bundling issues
import { composePrompt } from '../../../../src/lib/prompt/buildMobile';
import type { Answers, DNA } from '../../../../src/lib/prompt/buildMobile';
import { composeFusionPrompt, validateFusionSpec } from '../../../../src/lib/prompt/buildFusion';
import type { FusionSpec } from '../../../../src/lib/prompt/buildFusion';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      mode,
      // STANDARD mode fields
      answers,
      dna,
      chipsChosen,
      askAnswers,
      freeTextTags,
      // FUSION mode fields
      spec,
      userId,
      timestamp,
      recentSilhouettes,
      enableDiversitySampling = true,
      gender,
      optionalPrompt
    } = body;

    // FUSION mode
    if (mode === 'fusion') {
      if (!spec) {
        return NextResponse.json(
          { error: 'spec is required for FUSION mode' },
          { status: 400 }
        );
      }

      if (!validateFusionSpec(spec)) {
        return NextResponse.json(
          { error: 'Invalid FUSION spec format' },
          { status: 400 }
        );
      }

      console.log('[prompt/compose] FUSION mode input:', {
        spec,
        userId,
        recentSilhouettes,
        enableDiversitySampling,
        gender,
        optionalPrompt
      });

      const result = composeFusionPrompt(spec as FusionSpec, {
        userId,
        timestamp,
        recentSilhouettes,
        enableDiversitySampling,
        gender,
        optionalPrompt
      });

      console.log('[prompt/compose] FUSION mode output:', {
        promptLength: result.prompt.length,
        selectedSilhouette: result.selectedSilhouette,
        selectedDemographic: result.selectedDemographic,
        selectedBackground: result.selectedBackground
      });

      return NextResponse.json(result);
    }

    // STANDARD mode (existing logic)
    if (!answers || !dna) {
      return NextResponse.json(
        { error: 'answers and dna are required for STANDARD mode' },
        { status: 400 }
      );
    }

    console.log('[prompt/compose] STANDARD mode input:', {
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

    console.log('[prompt/compose] STANDARD mode output:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[prompt/compose] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
