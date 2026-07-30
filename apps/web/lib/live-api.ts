import {
  apiErrorSchema,
  chatMessagePageSchema,
  chatMessageSchema,
  demoSessionResponseSchema,
  liveSnapshotSchema,
  productFeaturedEventSchema,
  type ApiErrorResponse,
  type ChatMessage,
  type ChatMessagePage,
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

export async function fetchChatMessages(
  liveId: string,
  query: {
    limit?: number;
    beforeSequence?: number;
    afterSequence?: number;
  } = {},
): Promise<ChatMessagePage> {
  const searchParams = new URLSearchParams();

  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }
  if (query.beforeSequence !== undefined) {
    searchParams.set('beforeSequence', String(query.beforeSequence));
  }
  if (query.afterSequence !== undefined) {
    searchParams.set('afterSequence', String(query.afterSequence));
  }

  const queryString = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/lives/${liveId}/messages${queryString}`)),
  );
  return chatMessagePageSchema.parse(body);
}

export async function createChatMessage(
  liveId: string,
  input: {
    clientMessageId: string;
    content: string;
  },
  accessToken: string,
): Promise<ChatMessage> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/lives/${liveId}/messages`), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    }),
  );
  return chatMessageSchema.parse(body);
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

function mergeChatMessages(
  messages: ChatMessage[],
  incomingMessages: ChatMessage[],
): ChatMessage[] {
  const messagesByClientId = new Map(messages.map((message) => [message.clientMessageId, message]));

  for (const message of incomingMessages) {
    messagesByClientId.set(message.clientMessageId, message);
  }

  return [...messagesByClientId.values()].toSorted((left, right) => left.sequence - right.sequence);
}

export function mergeChatMessage(
  snapshot: LiveSnapshot | undefined,
  message: ChatMessage,
): LiveSnapshot | undefined {
  if (!snapshot) {
    return snapshot;
  }

  return {
    ...snapshot,
    chat: {
      messages: mergeChatMessages(snapshot.chat.messages, [message]),
      lastMessageSequence: Math.max(snapshot.chat.lastMessageSequence, message.sequence),
      hasMore: snapshot.chat.hasMore,
    },
  };
}

export function mergeChatMessagePage(
  snapshot: LiveSnapshot | undefined,
  page: ChatMessagePage,
): LiveSnapshot | undefined {
  if (!snapshot) {
    return snapshot;
  }

  return {
    ...snapshot,
    chat: {
      messages: mergeChatMessages(snapshot.chat.messages, page.messages),
      lastMessageSequence: Math.max(snapshot.chat.lastMessageSequence, page.lastMessageSequence),
      hasMore: snapshot.chat.hasMore || page.hasMore,
    },
  };
}
