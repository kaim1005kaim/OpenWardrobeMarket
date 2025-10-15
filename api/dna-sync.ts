import type { NextApiRequest, NextApiResponse } from 'next';
import * as routeModule from '../app/api/dna-sync/route';
import { createAppRouteHandler } from './_appRouteAdapter';

const handler = createAppRouteHandler(routeModule);

export default function dnaSyncHandler(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res);
}
