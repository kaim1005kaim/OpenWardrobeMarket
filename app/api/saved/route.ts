export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  if (!userId) {
    return Response.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    return Response.json({
      success: true,
      items: [],
      message: 'Saved items feature coming soon'
    });
  } catch (error: any) {
    console.error('[Saved API] Error:', error);
    return Response.json(
      {
        error: 'Failed to fetch saved items',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
