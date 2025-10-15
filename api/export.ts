import type { NextApiRequest, NextApiResponse } from 'next';
import * as routeModule from '../app/api/export/route';
import { createAppRouteHandler } from './_appRouteAdapter';

const handler = createAppRouteHandler(routeModule);

export default function exportHandler(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res);
}
