import type { NextApiRequest, NextApiResponse } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://open-wardrobe-market.vercel.app';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    platform, 
    itemId, 
    title, 
    description, 
    imageUrl,
    tags = []
  } = req.body;

  if (!platform || !itemId) {
    return res.status(400).json({ error: 'Platform and itemId are required' });
  }

  try {
    // Generate share URL based on platform
    const itemUrl = `${BASE_URL}/item/${itemId}`;
    const hashtags = tags.slice(0, 3).map((tag: string) => `#${tag}`).join(' ');
    
    let shareUrl = '';
    let shareData = {};

    switch (platform) {
      case 'twitter':
        // Twitter (X) share URL
        const tweetText = `${title || 'Check out this design!'} ${hashtags}\n\nCreated with Open Wardrobe Market`;
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(itemUrl)}`;
        shareData = {
          url: shareUrl,
          platform: 'twitter',
          directShare: false
        };
        break;

      case 'instagram':
        // Instagram doesn't support direct URL sharing, return instructions
        shareData = {
          platform: 'instagram',
          directShare: false,
          instructions: {
            step1: 'Download the image',
            step2: 'Open Instagram app',
            step3: 'Create a new post with the downloaded image',
            step4: `Use this caption: ${title} ${hashtags} #OpenWardrobeMarket`,
            imageUrl: imageUrl
          }
        };
        break;

      case 'pinterest':
        // Pinterest share URL
        const pinDescription = `${title || 'Fashion Design'} - ${description || 'Created with Open Wardrobe Market'} ${hashtags}`;
        shareUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(itemUrl)}&media=${encodeURIComponent(imageUrl || '')}&description=${encodeURIComponent(pinDescription)}`;
        shareData = {
          url: shareUrl,
          platform: 'pinterest',
          directShare: true
        };
        break;

      case 'facebook':
        // Facebook share URL
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(itemUrl)}`;
        shareData = {
          url: shareUrl,
          platform: 'facebook',
          directShare: true
        };
        break;

      case 'line':
        // LINE share URL (popular in Japan)
        const lineText = `${title || 'Check out this design!'}\n${itemUrl}`;
        shareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(lineText)}`;
        shareData = {
          url: shareUrl,
          platform: 'line',
          directShare: true
        };
        break;

      case 'copy':
        // Generate shareable text for clipboard
        const shareText = `${title || 'Amazing Fashion Design'}\n\n${description || 'Created with Open Wardrobe Market'}\n\n${hashtags}\n\nView here: ${itemUrl}`;
        shareData = {
          platform: 'copy',
          text: shareText,
          url: itemUrl,
          directShare: false
        };
        break;

      case 'download':
        // Return download information
        shareData = {
          platform: 'download',
          imageUrl: imageUrl,
          filename: `owm-${itemId}-${Date.now()}.jpg`,
          directShare: false
        };
        break;

      default:
        return res.status(400).json({ error: 'Unsupported platform' });
    }

    // Log share analytics (optional)
    console.log(`[Share API] Platform: ${platform}, Item: ${itemId}`);

    res.status(200).json({
      success: true,
      ...shareData
    });

  } catch (error) {
    console.error('[Share API] Error:', error);
    res.status(500).json({
      error: 'Failed to generate share link',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}