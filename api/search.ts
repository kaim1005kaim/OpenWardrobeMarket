import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppRouteHandler } from './_appRouteAdapter';

const handlerPromise = getAppRouteHandler('search/route');

export default async function searchHandler(req: NextApiRequest, res: NextApiResponse) {
  const handler = await handlerPromise;
  return handler(req, res);
}
