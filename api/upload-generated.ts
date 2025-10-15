import type { NextApiRequest, NextApiResponse } from 'next';
import * as routeModule from '../app/api/upload-generated/route';
import { createAppRouteHandler } from './_appRouteAdapter';

const handler = createAppRouteHandler(routeModule);

export default function uploadGeneratedHandler(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res);
}
