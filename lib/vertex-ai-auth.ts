/**
 * Vertex AI OAuth Authentication Helper
 *
 * Provides a centralized OAuth token management for all Vertex AI API calls
 */

import { GoogleAuth } from 'google-auth-library';

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get OAuth access token for Vertex AI
 * Caches token until expiration for better performance
 */
export async function getVertexAIAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 minute buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (!credentialsJson) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not set');
  }

  const credentials = JSON.parse(credentialsJson);

  // Fix private key format - replace literal \n with actual newlines
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });

  const client = await auth.getClient();
  const accessTokenResponse = await client.getAccessToken();

  if (!accessTokenResponse.token) {
    throw new Error('Failed to get access token from Google Auth');
  }

  // Cache token (Google tokens typically expire in 1 hour)
  cachedToken = {
    token: accessTokenResponse.token,
    expiresAt: Date.now() + 55 * 60 * 1000 // 55 minutes
  };

  return accessTokenResponse.token;
}

/**
 * Call Vertex AI Gemini API
 */
export async function callVertexAIGemini(
  modelId: string,
  contents: any[],
  generationConfig?: any,
  systemInstruction?: any
): Promise<any> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;

  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT not set');
  }

  const accessToken = await getVertexAIAccessToken();

  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${modelId}:generateContent`;

  const requestBody: any = {
    contents,
    generationConfig: generationConfig || {}
  };

  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex AI Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('[callVertexAIGemini] Full response structure:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Call Vertex AI Imagen API
 */
export async function callVertexAIImagen(
  modelId: string,
  prompt: string,
  parameters?: any
): Promise<any> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;

  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT not set');
  }

  const accessToken = await getVertexAIAccessToken();

  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${modelId}:predict`;

  const requestBody = {
    instances: [{ prompt }],
    parameters: parameters || {}
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex AI Imagen API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}
