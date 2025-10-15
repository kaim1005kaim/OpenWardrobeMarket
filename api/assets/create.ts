import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppRouteHandler } from '../_appRouteAdapter';

const handlerPromise = getAppRouteHandler('assets/create/route');

export default async function assetsCreateHandler(req: NextApiRequest, res: NextApiResponse) {
  const handler = await handlerPromise;
  return handler(req, res);
}
