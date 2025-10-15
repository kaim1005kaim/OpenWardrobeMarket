import type { NextApiRequest, NextApiResponse } from 'next';
import * as routeModule from '../../app/api/assets/create/route';
import { createAppRouteHandler } from '../_appRouteAdapter';

const handler = createAppRouteHandler(routeModule);

export default function assetsCreateHandler(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res);
}
