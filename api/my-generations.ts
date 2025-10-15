import type { NextApiRequest, NextApiResponse } from 'next';
import * as routeModule from '../app/api/my-generations/route';
import { createAppRouteHandler } from './_appRouteAdapter';

const handler = createAppRouteHandler(routeModule);

export default function myGenerationsHandler(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res);
}
