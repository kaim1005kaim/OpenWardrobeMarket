import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppRouteHandler } from './_appRouteAdapter';

const handlerPromise = getAppRouteHandler('r2-presign/route');

export default async function r2PresignHandler(req: NextApiRequest, res: NextApiResponse) {
  const handler = await handlerPromise;
  return handler(req, res);
}
