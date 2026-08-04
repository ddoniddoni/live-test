import {
  adminLiveListSchema,
  adminLiveSessionSchema,
  adminOrderPageSchema,
  adminOrdersQuerySchema,
  aiSuggestionListSchema,
  aiSuggestionSchema,
  aiProductAnswerSchema,
  adminOrderListSchema,
  announcementPublishedEventSchema,
  auditLogPageSchema,
  apiErrorSchema,
  chatAccessStatusSchema,
  chatMessageHiddenEventSchema,
  chatMessagePageSchema,
  chatMessageSchema,
  chatUserTimedOutEventSchema,
  couponPublishedEventSchema,
  couponRedeemedEventSchema,
  createAiChatSummaryRequestSchema,
  createLiveDraftRequestSchema,
  createNextLiveSessionResponseSchema,
  createProductQuestionRequestSchema,
  createOrderRequestSchema,
  demoSessionResponseSchema,
  inventoryUpdatedEventSchema,
  liveMetricsSchema,
  liveSessionSchema,
  liveStatusChangedEventSchema,
  liveSnapshotSchema,
  orderSchema,
  ordersQuerySchema,
  productCatalogSchema,
  productFeaturedEventSchema,
  publishAnnouncementRequestSchema,
  replaceLiveProductsRequestSchema,
  reviewAiSuggestionRequestSchema,
  updateLiveDraftRequestSchema,
  liveProductListSchema,
} from '@liveflow/contracts';
import type {
  AdminLiveList,
  AdminLiveSession,
  AdminOrderPage,
  AdminOrdersQuery,
  ApiErrorResponse,
  AiSuggestion,
  AiProductAnswer,
  AdminOrder,
  AnnouncementPublishedEvent,
  AuditLogPage,
  ChatAccessStatus,
  ChatMessage,
  ChatMessageHiddenEvent,
  ChatMessagePage,
  ChatUserTimedOutEvent,
  Coupon,
  CouponPublishedEvent,
  CouponRedeemedEvent,
  CreateLiveDraftRequest,
  CreateNextLiveSessionResponse,
  CreateOrderRequest,
  InventoryUpdatedEvent,
  LiveMetrics,
  LiveSession,
  LiveStatusChangedEvent,
  LiveStatus,
  LiveStatusTransitionAction,
  LiveProduct,
  LiveSnapshot,
  Order,
  OrdersQuery,
  ProductFeaturedEvent,
  Product,
  PublishAnnouncementRequest,
  ReplaceLiveProductsRequest,
  ReviewAiSuggestionRequest,
  UpdateLiveDraftRequest,
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

export function hasRealtimeSequenceGap(
  snapshot: LiveSnapshot | undefined,
  incomingSequence: number,
): boolean {
  return !snapshot || incomingSequence > snapshot.lastEventSequence + 1;
}

export function chatAccessQueryKey(liveId: string): readonly ['live', string, 'chat-access'] {
  return ['live', liveId, 'chat-access'];
}

export function aiSuggestionsQueryKey(liveId: string): readonly ['live', string, 'ai-suggestions'] {
  return ['live', liveId, 'ai-suggestions'];
}

export function auditLogsQueryKey(liveId: string): readonly ['live', string, 'audit-logs'] {
  return ['live', liveId, 'audit-logs'];
}

export function recentOrdersQueryKey(liveId: string): readonly ['live', string, 'recent-orders'] {
  return ['live', liveId, 'recent-orders'];
}

export function liveMetricsQueryKey(liveId: string): readonly ['live', string, 'metrics'] {
  return ['live', liveId, 'metrics'];
}

export function viewerOrderQueryKey(orderId: string): readonly ['viewer', 'orders', string] {
  return ['viewer', 'orders', orderId];
}

export function inventoryLowAlertsQueryKey(
  liveId: string,
): readonly ['live', string, 'inventory-low-alerts'] {
  return ['live', liveId, 'inventory-low-alerts'];
}

export function adminLiveListQueryKey(
  status?: LiveStatus,
): readonly ['admin', 'lives', LiveStatus | 'ALL'] {
  return ['admin', 'lives', status ?? 'ALL'];
}

export function adminLiveQueryKey(liveId: string): readonly ['admin', 'lives', string] {
  return ['admin', 'lives', liveId];
}

export function adminOrdersQueryKey(liveId?: string): readonly ['admin', 'orders', string | 'ALL'] {
  return ['admin', 'orders', liveId ?? 'ALL'];
}

export function productCatalogQueryKey(): readonly ['admin', 'products', 'catalog'] {
  return ['admin', 'products', 'catalog'];
}

export function liveProductsQueryKey(
  liveId: string,
): readonly ['admin', 'lives', string, 'products'] {
  return ['admin', 'lives', liveId, 'products'];
}

export async function fetchLiveSnapshot(liveId: string): Promise<LiveSnapshot> {
  const body = await readResponse(await fetch(getApiUrl(`/api/v1/lives/${liveId}/snapshot`)));
  return liveSnapshotSchema.parse(body);
}

export async function fetchCurrentLive(): Promise<LiveSession | null> {
  const body = await readResponse(
    await fetch(getApiUrl('/api/v1/lives/current'), { cache: 'no-store' }),
  );
  return liveSessionSchema.nullable().parse(body);
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

export async function fetchAdminLives(
  accessToken: string,
  query: { cursor?: string; limit?: number; status?: LiveStatus } = {},
): Promise<AdminLiveList> {
  const searchParams = new URLSearchParams();
  if (query.cursor) {
    searchParams.set('cursor', query.cursor);
  }
  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }
  if (query.status) {
    searchParams.set('status', query.status);
  }
  const queryString = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives${queryString}`), {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );

  return adminLiveListSchema.parse(body);
}

export async function fetchAdminLive(
  liveId: string,
  accessToken: string,
): Promise<AdminLiveSession> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}`), {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );

  return adminLiveSessionSchema.parse(body);
}

export async function fetchProductCatalog(accessToken: string): Promise<Product[]> {
  const body = await readResponse(
    await fetch(getApiUrl('/api/v1/admin/products'), {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );

  return productCatalogSchema.parse(body);
}

export async function fetchLiveProducts(
  liveId: string,
  accessToken: string,
): Promise<LiveProduct[]> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/products`), {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );

  return liveProductListSchema.parse(body);
}

export async function replaceLiveProducts(
  liveId: string,
  input: ReplaceLiveProductsRequest,
  accessToken: string,
): Promise<LiveProduct[]> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/products`), {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(replaceLiveProductsRequestSchema.parse(input)),
    }),
  );

  return liveProductListSchema.parse(body);
}

export async function createLiveDraft(
  input: CreateLiveDraftRequest,
  accessToken: string,
): Promise<AdminLiveSession> {
  const body = await readResponse(
    await fetch(getApiUrl('/api/v1/admin/lives'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(createLiveDraftRequestSchema.parse(input)),
    }),
  );

  return adminLiveSessionSchema.parse(body);
}

export async function updateLiveDraft(
  liveId: string,
  input: UpdateLiveDraftRequest,
  accessToken: string,
): Promise<AdminLiveSession> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}`), {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(updateLiveDraftRequestSchema.parse(input)),
    }),
  );

  return adminLiveSessionSchema.parse(body);
}

export async function cancelLiveDraft(
  liveId: string,
  accessToken: string,
): Promise<AdminLiveSession> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/cancel`), {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );

  return adminLiveSessionSchema.parse(body);
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

async function changeLiveStatus(
  liveId: string,
  action: LiveStatusTransitionAction,
  accessToken: string,
): Promise<LiveStatusChangedEvent> {
  const paths: Record<LiveStatusTransitionAction, string> = {
    SCHEDULE: 'schedule',
    PREPARE: 'prepare',
    START: 'start',
    END: 'end',
  };
  const path = paths[action];
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/${path}`), {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );
  return liveStatusChangedEventSchema.parse(body);
}

export function startLive(liveId: string, accessToken: string): Promise<LiveStatusChangedEvent> {
  return changeLiveStatus(liveId, 'START', accessToken);
}

export function scheduleLive(liveId: string, accessToken: string): Promise<LiveStatusChangedEvent> {
  return changeLiveStatus(liveId, 'SCHEDULE', accessToken);
}

export function prepareLive(liveId: string, accessToken: string): Promise<LiveStatusChangedEvent> {
  return changeLiveStatus(liveId, 'PREPARE', accessToken);
}

export function endLive(liveId: string, accessToken: string): Promise<LiveStatusChangedEvent> {
  return changeLiveStatus(liveId, 'END', accessToken);
}

export async function createNextLiveSession(
  liveId: string,
  accessToken: string,
): Promise<CreateNextLiveSessionResponse> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/next-session`), {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );
  return createNextLiveSessionResponseSchema.parse(body);
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

export async function fetchChatAccess(
  liveId: string,
  accessToken: string,
): Promise<ChatAccessStatus> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/lives/${liveId}/chat-access`), {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );
  return chatAccessStatusSchema.parse(body);
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

export async function askProductQuestion(
  liveId: string,
  question: string,
  accessToken: string,
): Promise<AiProductAnswer> {
  const input = createProductQuestionRequestSchema.parse({ question });
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/lives/${liveId}/ai/product-questions`), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    }),
  );
  return aiProductAnswerSchema.parse(body);
}

export async function fetchAiSuggestions(
  liveId: string,
  accessToken: string,
): Promise<AiSuggestion[]> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/ai/suggestions`), {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );
  return aiSuggestionListSchema.parse(body);
}

export async function fetchAuditLogs(
  liveId: string,
  input: { cursor?: string; limit?: number },
  accessToken: string,
): Promise<AuditLogPage> {
  const searchParams = new URLSearchParams({ limit: String(input.limit ?? 30) });
  if (input.cursor) {
    searchParams.set('cursor', input.cursor);
  }

  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/audit-logs?${searchParams.toString()}`), {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );
  return auditLogPageSchema.parse(body);
}

export async function fetchRecentOrders(
  liveId: string,
  query: Partial<OrdersQuery>,
  accessToken: string,
): Promise<AdminOrder[]> {
  const parsedQuery = ordersQuerySchema.parse(query);
  const searchParams = new URLSearchParams({ limit: String(parsedQuery.limit) });
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/orders?${searchParams.toString()}`), {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );
  return adminOrderListSchema.parse(body);
}

export async function fetchLiveMetrics(liveId: string, accessToken: string): Promise<LiveMetrics> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/metrics`), {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );
  return liveMetricsSchema.parse(body);
}

export async function fetchAdminOrders(
  query: Partial<AdminOrdersQuery>,
  accessToken: string,
): Promise<AdminOrderPage> {
  const parsedQuery = adminOrdersQuerySchema.parse(query);
  const searchParams = new URLSearchParams({ limit: String(parsedQuery.limit) });
  if (parsedQuery.liveId) {
    searchParams.set('liveId', parsedQuery.liveId);
  }
  if (parsedQuery.cursor) {
    searchParams.set('cursor', parsedQuery.cursor);
  }

  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/orders?${searchParams.toString()}`), {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );
  return adminOrderPageSchema.parse(body);
}

export async function createAiChatSummary(
  liveId: string,
  accessToken: string,
  maxMessages = 100,
): Promise<AiSuggestion> {
  const input = createAiChatSummaryRequestSchema.parse({ maxMessages });
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/ai/chat-summaries`), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    }),
  );
  return aiSuggestionSchema.parse(body);
}

export async function reviewAiSuggestion(
  suggestionId: string,
  input: ReviewAiSuggestionRequest,
  accessToken: string,
): Promise<AiSuggestion> {
  const parsedInput = reviewAiSuggestionRequestSchema.parse(input);
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/ai/suggestions/${suggestionId}`), {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(parsedInput),
    }),
  );
  return aiSuggestionSchema.parse(body);
}

export async function hideChatMessage(
  liveId: string,
  messageId: string,
  reason: string,
  accessToken: string,
): Promise<ChatMessageHiddenEvent> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/messages/${messageId}/hide`), {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    }),
  );
  return chatMessageHiddenEventSchema.parse(body);
}

export async function timeoutChatUser(
  liveId: string,
  userId: string,
  input: {
    durationMinutes: number;
    reason: string;
  },
  accessToken: string,
): Promise<ChatUserTimedOutEvent> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/users/${userId}/chat-timeout`), {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    }),
  );
  return chatUserTimedOutEventSchema.parse(body);
}

export async function publishCoupon(
  liveId: string,
  input: {
    type: Coupon['type'];
    value: number;
    minOrderAmountKrw: number;
    endsAt: string;
    usageLimit: number | null;
  },
  accessToken: string,
): Promise<CouponPublishedEvent> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/coupons`), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    }),
  );
  return couponPublishedEventSchema.parse(body);
}

export async function publishAnnouncement(
  liveId: string,
  input: PublishAnnouncementRequest,
  accessToken: string,
): Promise<AnnouncementPublishedEvent> {
  const parsedInput = publishAnnouncementRequestSchema.parse(input);
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/admin/lives/${liveId}/announcements`), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(parsedInput),
    }),
  );
  return announcementPublishedEventSchema.parse(body);
}

export async function createMockOrder(
  input: CreateOrderRequest,
  idempotencyKey: string,
  accessToken: string,
): Promise<Order> {
  const parsedInput = createOrderRequestSchema.parse(input);
  const body = await readResponse(
    await fetch(getApiUrl('/api/v1/orders'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(parsedInput),
    }),
  );
  return orderSchema.parse(body);
}

export async function fetchViewerOrder(orderId: string, accessToken: string): Promise<Order> {
  const body = await readResponse(
    await fetch(getApiUrl(`/api/v1/orders/${encodeURIComponent(orderId)}`), {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );
  return orderSchema.parse(body);
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

export function mergeLiveStatusChangedEvent(
  snapshot: LiveSnapshot | undefined,
  event: LiveStatusChangedEvent,
): LiveSnapshot | undefined {
  if (!snapshot || event.sequence <= snapshot.lastEventSequence) {
    return snapshot;
  }

  return {
    ...snapshot,
    live: event.payload.live,
    lastEventSequence: event.sequence,
  };
}

export function mergeCouponPublishedEvent(
  snapshot: LiveSnapshot | undefined,
  event: CouponPublishedEvent,
): LiveSnapshot | undefined {
  if (!snapshot || event.sequence <= snapshot.lastEventSequence) {
    return snapshot;
  }

  return {
    ...snapshot,
    activeCoupon: event.payload.coupon,
    lastEventSequence: event.sequence,
  };
}

export function mergeCouponRedeemedEvent(
  snapshot: LiveSnapshot | undefined,
  event: CouponRedeemedEvent,
): LiveSnapshot | undefined {
  if (!snapshot || event.sequence <= snapshot.lastEventSequence) {
    return snapshot;
  }

  return {
    ...snapshot,
    activeCoupon: event.payload.coupon,
    lastEventSequence: event.sequence,
  };
}

export function mergeAnnouncementPublishedEvent(
  snapshot: LiveSnapshot | undefined,
  event: AnnouncementPublishedEvent,
): LiveSnapshot | undefined {
  if (!snapshot || event.sequence <= snapshot.lastEventSequence) {
    return snapshot;
  }

  return {
    ...snapshot,
    latestAnnouncement: event.payload.announcement,
    lastEventSequence: event.sequence,
  };
}

export function mergeInventoryUpdatedEvent(
  snapshot: LiveSnapshot | undefined,
  event: InventoryUpdatedEvent,
): LiveSnapshot | undefined {
  if (!snapshot || event.sequence <= snapshot.lastEventSequence) {
    return snapshot;
  }

  const updateProductStock = (product: LiveSnapshot['products'][number]) =>
    product.id !== event.payload.productId
      ? product
      : {
          ...product,
          variants: product.variants.map((variant) =>
            variant.id === event.payload.productVariantId
              ? { ...variant, stock: event.payload.stock }
              : variant,
          ),
        };

  return {
    ...snapshot,
    products: snapshot.products.map(updateProductStock),
    featuredProduct: snapshot.featuredProduct ? updateProductStock(snapshot.featuredProduct) : null,
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
      hasMore: snapshot.chat.hasMore,
    },
  };
}

export function prependChatMessagePage(
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
      hasMore: page.hasMore,
    },
  };
}

export function mergeChatMessageHiddenEvent(
  snapshot: LiveSnapshot | undefined,
  event: ChatMessageHiddenEvent,
): LiveSnapshot | undefined {
  if (!snapshot) {
    return snapshot;
  }

  const snapshotWithoutMessage = removeChatMessageFromSnapshot(snapshot, event.payload.messageId);
  if (!snapshotWithoutMessage) {
    return snapshot;
  }

  const messageWasAlreadyHidden = snapshotWithoutMessage === snapshot;

  if (event.sequence <= snapshot.lastEventSequence && messageWasAlreadyHidden) {
    return snapshot;
  }

  return {
    ...snapshotWithoutMessage,
    lastEventSequence: Math.max(snapshot.lastEventSequence, event.sequence),
  };
}

export function removeChatMessageFromSnapshot(
  snapshot: LiveSnapshot | undefined,
  messageId: string,
): LiveSnapshot | undefined {
  if (!snapshot) {
    return snapshot;
  }

  const messages = snapshot.chat.messages.filter((message) => message.id !== messageId);
  if (messages.length === snapshot.chat.messages.length) {
    return snapshot;
  }

  return {
    ...snapshot,
    chat: {
      ...snapshot.chat,
      messages,
    },
  };
}
