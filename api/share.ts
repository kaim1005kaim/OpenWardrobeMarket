import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppRouteHandler } from './_appRouteAdapter';

const handlerPromise = getAppRouteHandler('share/route');

export default async function shareHandler(req: NextApiRequest, res: NextApiResponse) {
  const handler = await handlerPromise;
  return handler(req, res);
}
