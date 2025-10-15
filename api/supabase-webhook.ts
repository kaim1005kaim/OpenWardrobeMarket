import type { NextApiRequest, NextApiResponse } from 'next';
import * as routeModule from '../app/api/supabase-webhook/route';
import { createAppRouteHandler } from './_appRouteAdapter';

const handler = createAppRouteHandler(routeModule);

export default function supabaseWebhookHandler(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res);
}
