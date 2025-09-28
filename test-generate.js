// Test script for ImagineAPI
const IMAGINE_API_TOKEN = 'imgn_suoc6eez6gfqlb2ke3jpniae2hi6akos';
const IMAGINE_API_BASE = 'https://cl.imagineapi.dev';

async function testGenerate() {
  console.log('Testing ImagineAPI connection...');
  
  try {
    // Test simple generation request
    const response = await fetch(`${IMAGINE_API_BASE}/items/images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${IMAGINE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: 'A simple fashion design test --ar 2:3',
        ref: 'test-' + Date.now()
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('Success! Generation started:', result);
    return true;

  } catch (error) {
    console.error('Request failed:', error);
    return false;
  }
}

testGenerate();