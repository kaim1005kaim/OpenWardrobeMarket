import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppRouteHandler } from '../_appRouteAdapter';

const handlerPromise = getAppRouteHandler('assets/[assetId]/route', (req) => {
  const { assetId } = req.query;
  return {
    params: {
      assetId: Array.isArray(assetId) ? assetId[0] : (assetId as string)
    }
  };
});

export default async function assetByIdHandler(req: NextApiRequest, res: NextApiResponse) {
  const handler = await handlerPromise;
  return handler(req, res);
}
