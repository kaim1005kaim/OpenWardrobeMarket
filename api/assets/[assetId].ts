import type { NextApiRequest, NextApiResponse } from 'next';
import * as routeModule from '../../app/api/assets/[assetId]/route';
import { createAppRouteHandler } from '../_appRouteAdapter';

const handler = createAppRouteHandler(routeModule, (req) => {
  const { assetId } = req.query;
  return {
    params: {
      assetId: Array.isArray(assetId) ? assetId[0] : (assetId as string)
    }
  };
});

export default function assetByIdHandler(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res);
}
