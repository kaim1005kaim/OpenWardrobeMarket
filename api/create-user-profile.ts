import type { NextApiRequest, NextApiResponse } from 'next';
import * as routeModule from '../app/api/create-user-profile/route';
import { createAppRouteHandler } from './_appRouteAdapter';

const handler = createAppRouteHandler(routeModule);

export default function createUserProfileHandler(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res);
}
