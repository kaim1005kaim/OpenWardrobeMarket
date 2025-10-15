import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppRouteHandler } from '../_appRouteAdapter';

const handlerPromise = getAppRouteHandler('assets/route');

export default async function assetsHandler(req: NextApiRequest, res: NextApiResponse) {
  const handler = await handlerPromise;
  return handler(req, res);
}
