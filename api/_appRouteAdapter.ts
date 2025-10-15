import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export type AppRouteModule = {
  GET?: (request: Request, ctx?: any) => Promise<Response>;
  POST?: (request: Request, ctx?: any) => Promise<Response>;
  PUT?: (request: Request, ctx?: any) => Promise<Response>;
  PATCH?: (request: Request, ctx?: any) => Promise<Response>;
  DELETE?: (request: Request, ctx?: any) => Promise<Response>;
  OPTIONS?: (request: Request, ctx?: any) => Promise<Response>;
};

export type ContextResolver = (req: NextApiRequest, res: NextApiResponse) => any;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

const METHODS: Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

function createRequestFromNext(req: NextApiRequest): Request {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers['host'] || 'localhost';
  const url = new URL(req.url || '', `${proto}://${host}`);

  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      headers.set(key, value.join(','));
    } else if (typeof value === 'string') {
      headers.set(key, value);
    }
  });

  const method = (req.method || 'GET').toUpperCase();
  let body: BodyInit | undefined;

  if (!['GET', 'HEAD'].includes(method) && req.body !== undefined) {
    if (typeof req.body === 'string' || req.body instanceof Buffer) {
      body = req.body as any;
    } else if (req.body && typeof req.body === 'object') {
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
      body = JSON.stringify(req.body);
    }
  }

  return new Request(url.toString(), {
    method,
    headers,
    body
  });
}

async function sendNextResponse(res: NextApiResponse, response: Response) {
  response.headers.forEach((value, key) => {
    if (key === 'set-cookie') {
      const existing = res.getHeader('set-cookie');
      if (existing) {
        res.setHeader('set-cookie', ([] as string[]).concat(existing as any, value));
      } else {
        res.setHeader('set-cookie', value);
      }
    } else {
      res.setHeader(key, value);
    }
  });

  const arrayBuffer = await response.arrayBuffer();
  res.status(response.status).send(Buffer.from(arrayBuffer));
}

export function createAppRouteHandler(module: AppRouteModule, resolveContext?: ContextResolver): NextApiHandler {
  return async (req, res) => {
    const method = (req.method || 'GET').toUpperCase() as Method;
    const handler = module[method];

    if (!handler) {
      const allowed = METHODS.filter((m) => module[m as keyof AppRouteModule]);
      res.setHeader('Allow', allowed.join(', '));
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const request = createRequestFromNext(req);
    const ctx = resolveContext ? resolveContext(req, res) : undefined;

    try {
      const response = await handler(request, ctx);
      await sendNextResponse(res, response);
    } catch (error: any) {
      console.error('[AppRouteAdapter] handler error:', error);
      res.status(500).json({ error: 'Internal Server Error', details: error?.message || 'Unknown error' });
    }
  };
}

function isModuleNotFound(error: any) {
  if (!error) return false;
  return error.code === 'ERR_MODULE_NOT_FOUND' || (typeof error.message === 'string' && error.message.includes('Cannot find module'));
}

let tsxLoaderPromise: Promise<void> | null = null;

async function ensureTsxLoader() {
  if (!tsxLoaderPromise) {
    tsxLoaderPromise = import('tsx/esm')
      .then(() => undefined)
      .catch((error) => {
        console.error('[AppRouteAdapter] Failed to initialise tsx loader:', error);
        throw error;
      });
  }
  return tsxLoaderPromise;
}

async function importRouteModule(modulePath: string): Promise<AppRouteModule> {
  const absoluteBase = resolve(process.cwd(), 'app/api', modulePath);
  const jsUrl = pathToFileURL(`${absoluteBase}.js`).href;

  try {
    return (await import(jsUrl)) as AppRouteModule;
  } catch (error) {
    if (!isModuleNotFound(error)) {
      throw error;
    }
  }

  const tsUrl = pathToFileURL(`${absoluteBase}.ts`).href;

  try {
    await ensureTsxLoader();
    return (await import(tsUrl)) as AppRouteModule;
  } catch (error) {
    if (!isModuleNotFound(error)) {
      throw error;
    }
    throw new Error(`[AppRouteAdapter] Unable to load module at ${modulePath}.js/.ts`);
  }
}

export async function getAppRouteHandler(modulePath: string, resolveContext?: ContextResolver): Promise<NextApiHandler> {
  const module = await importRouteModule(modulePath);
  return createAppRouteHandler(module, resolveContext);
}
