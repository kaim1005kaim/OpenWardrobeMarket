import type { NextApiRequest, NextApiResponse } from 'next';
import * as routeModule from '../app/api/r2-presign/route';
import { createAppRouteHandler } from './_appRouteAdapter';

const handler = createAppRouteHandler(routeModule);

export default function r2PresignHandler(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res);
}
