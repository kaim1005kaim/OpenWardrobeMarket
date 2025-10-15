import type { NextApiRequest, NextApiResponse } from 'next';
import * as routeModule from '../app/api/saved/route';
import { createAppRouteHandler } from './_appRouteAdapter';

const handler = createAppRouteHandler(routeModule);

export default function savedHandler(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res);
}
