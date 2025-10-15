export const runtime = 'nodejs';
export const revalidate = 0;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://open-wardrobe-market.com';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { platform, itemId, title, description, imageUrl, tags = [] } = body;

  if (!platform || !itemId) {
    return Response.json({ error: 'Platform and itemId are required' }, { status: 400 });
  }

  try {
    const itemUrl = `${BASE_URL}/item/${itemId}`;
    const hashtags = (tags as string[]).slice(0, 3).map((tag) => `#${tag}`).join(' ');

    let shareData: Record<string, any> = {};

    switch (platform) {
      case 'twitter': {
        const tweetText = `${title || 'Check out this design!'} ${hashtags}\n\nCreated with Open Wardrobe Market`;
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          tweetText
        )}&url=${encodeURIComponent(itemUrl)}`;
        shareData = { url, platform: 'twitter', directShare: false };
        break;
      }
      case 'instagram':
        shareData = {
          platform: 'instagram',
          directShare: false,
          instructions: {
            step1: 'Download the image',
            step2: 'Open Instagram app',
            step3: 'Create a new post with the downloaded image',
            step4: `Use this caption: ${title || ''} ${hashtags} #OpenWardrobeMarket`,
            imageUrl
          }
        };
        break;
      case 'pinterest': {
        const pinDescription = `${title || 'Fashion Design'} - ${
          description || 'Created with Open Wardrobe Market'
        } ${hashtags}`;
        const url = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(
          itemUrl
        )}&media=${encodeURIComponent(imageUrl || '')}&description=${encodeURIComponent(pinDescription)}`;
        shareData = { url, platform: 'pinterest', directShare: true };
        break;
      }
      case 'facebook': {
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(itemUrl)}`;
        shareData = { url, platform: 'facebook', directShare: true };
        break;
      }
      case 'line': {
        const lineText = `${title || 'Check out this design!'}\n${itemUrl}`;
        const url = `https://line.me/R/msg/text/?${encodeURIComponent(lineText)}`;
        shareData = { url, platform: 'line', directShare: true };
        break;
      }
      case 'copy': {
        const shareText = `${title || 'Amazing Fashion Design'}\n\n${description || 'Created with Open Wardrobe Market'}\n\n${hashtags}\n\nView here: ${itemUrl}`;
        shareData = {
          platform: 'copy',
          text: shareText,
          url: itemUrl,
          directShare: false
        };
        break;
      }
      case 'download':
        shareData = {
          platform: 'download',
          imageUrl,
          filename: `owm-${itemId}-${Date.now()}.jpg`,
          directShare: false
        };
        break;
      default:
        return Response.json({ error: 'Unsupported platform' }, { status: 400 });
    }

    console.log(`[Share API] Platform: ${platform}, Item: ${itemId}`);

    return Response.json({
      success: true,
      ...shareData
    });
  } catch (error: any) {
    console.error('[Share API] Error:', error);
    return Response.json(
      {
        error: 'Failed to generate share link',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
