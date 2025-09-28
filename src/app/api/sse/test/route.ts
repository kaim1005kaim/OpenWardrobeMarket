// 最もシンプルなEdge Runtimeテスト
export const runtime = 'edge';

export async function GET() {
  return new Response('Hello from Edge Runtime', {
    status: 200,
    headers: {
      'content-type': 'text/plain',
    },
  });
}