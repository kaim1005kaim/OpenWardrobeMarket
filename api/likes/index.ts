import type { NextApiRequest, NextApiResponse } from 'next';
import * as routeModule from '../../app/api/likes/route';
import { createAppRouteHandler } from '../_appRouteAdapter';

const handler = createAppRouteHandler(routeModule);

export default function likesHandler(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res);
}
