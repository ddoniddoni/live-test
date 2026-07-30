import {
  apiErrorSchema,
  demoSessionResponseSchema,
  liveSnapshotSchema,
  productFeaturedEventSchema,
  type ApiErrorResponse,
  type LiveSnapshot,
  type ProductFeaturedEvent,
} from '@liveflow/contracts';

const defaultApiUrl = 'http://localhost:4000';

export class ApiRequestError extends Error {
  readonly code: string;

  constructor(error: ApiErrorResponse) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.code = error.code;
  }
}

function getApiUrl(path: string): string {
  return new URL(path, process.env.NEXT_PUBLIC_API_URL ?? defaultApiUrl).toString();
}

export function getSocketUrl(): string {
  return process.env.NEXT_PUBLIC_SOCKET_URL ?? process.env.NEXT_PUBLIC_API_URL ?? defaultApiUrl;
}

async function readResponse(response: Response): Promise<unknown> {
  const body: unknown = await response.json();

  if (response.ok) {
    return body;
  }

  const parsedError = apiErrorSchema.safeParse(body);
  throw new ApiRequestError(
    parsedError.success
      ? parsedError.data
      : { code: 'REQUEST_FAILED', message: '요청을 처리하지 못했습니다.' },
  );
}

export function liveSnapshotQueryKey(liveId: string): readonly ['live', string, 'snapshot'] {
  return ['live', liveId, 'snapshot'];
}

export async function fetchLiveSnapshot(liveId: string): Promise<LiveSnapshot> {
  const body = await readResponse(await fetch(getApiUrl(`/api/v1/lives/${liveId}/snapshot`)));
  return liveSnapshotSchema.parse(body);
}

export async function createViewerSession(): Promise<string> {
  const body = await readResponse(
    await fetch(getApiUrl('/api/v1/demo/viewer-session'), { method: 'POST' }),
  );
  return demoSessionResponseSchema.parse(body).accessToken;
}

export async function createAdminSession(password: string): Promise<string> {
  const body = await readResponse(
    await fetch(getApiUrl('/api/v1/demo/admin-session'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }),
  );
  return demoSessionResponseSchema.parse(body).accessToken;
}

export async function featureProduct(
  liveId: string,
  productId: string | null,
  accessToken: string,
): Promise<ProductFeaturedEvent> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/featured-product`), {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ productId }),
    }),
  );
  return productFeaturedEventSchema.parse(body);
}

export function mergeProductFeaturedEvent(
  snapshot: LiveSnapshot | undefined,
  event: ProductFeaturedEvent,
): LiveSnapshot | undefined {
  if (!snapshot || event.sequence <= snapshot.lastEventSequence) {
    return snapshot;
  }

  return {
    ...snapshot,
    featuredProduct: event.payload.product,
    lastEventSequence: event.sequence,
  };
}
