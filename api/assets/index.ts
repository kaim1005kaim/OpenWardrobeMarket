import type { NextApiRequest, NextApiResponse } from 'next';
import * as routeModule from '../../app/api/assets/route';
import { createAppRouteHandler } from '../_appRouteAdapter';

const handler = createAppRouteHandler(routeModule);

export default function assetsHandler(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res);
}
