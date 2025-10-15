import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppRouteHandler } from './_appRouteAdapter';

const handlerPromise = getAppRouteHandler('catalog/route');

export default async function catalogHandler(req: NextApiRequest, res: NextApiResponse) {
  const handler = await handlerPromise;
  return handler(req, res);
}
