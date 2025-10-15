import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppRouteHandler } from '../_appRouteAdapter';

const handlerPromise = getAppRouteHandler('likes/route');

export default async function likesHandler(req: NextApiRequest, res: NextApiResponse) {
  const handler = await handlerPromise;
  return handler(req, res);
}
