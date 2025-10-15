import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppRouteHandler } from './_appRouteAdapter';

const handlerPromise = getAppRouteHandler('create-user-profile/route');

export default async function createUserProfileHandler(req: NextApiRequest, res: NextApiResponse) {
  const handler = await handlerPromise;
  return handler(req, res);
}
