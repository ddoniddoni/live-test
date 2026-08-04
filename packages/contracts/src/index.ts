import { z } from 'zod';

export const roleSchema = z.enum(['VIEWER', 'ADMIN']);
export type Role = z.infer<typeof roleSchema>;

export const liveStatusSchema = z.enum([
  'DRAFT',
  'SCHEDULED',
  'READY',
  'LIVE',
  'ENDED',
  'CANCELLED',
]);
export type LiveStatus = z.infer<typeof liveStatusSchema>;

export const liveStatusTransitionActionSchema = z.enum(['SCHEDULE', 'PREPARE', 'START', 'END']);
export type LiveStatusTransitionAction = z.infer<typeof liveStatusTransitionActionSchema>;

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
  details: z.unknown().optional(),
});
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>;

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('liveflow-server'),
  requestId: z.string().min(1),
  timestamp: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const liveIdSchema = z.string().min(1).max(64);
export const liveParamsSchema = z.object({
  liveId: liveIdSchema,
});

export const productVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  stock: z.int().nonnegative(),
});
export type ProductVariant = z.infer<typeof productVariantSchema>;

export const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  priceKrw: z.int().positive(),
  variants: z.array(productVariantSchema),
});
export type Product = z.infer<typeof productSchema>;
export const productCatalogSchema = z.array(productSchema);

export const liveProductSchema = z.object({
  liveId: liveIdSchema,
  product: productSchema,
  displayOrder: z.int().nonnegative(),
});
export type LiveProduct = z.infer<typeof liveProductSchema>;

export const liveProductListSchema = z.array(liveProductSchema);

export const replaceLiveProductsRequestSchema = z
  .object({
    productIds: z.array(z.string().min(1).max(64)).min(1).max(20),
  })
  .superRefine((input, context) => {
    if (new Set(input.productIds).size !== input.productIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['productIds'],
        message: '같은 상품을 방송에 중복으로 추가할 수 없습니다.',
      });
    }
  });
export type ReplaceLiveProductsRequest = z.infer<typeof replaceLiveProductsRequestSchema>;

export const couponDiscountTypeSchema = z.enum(['PERCENT', 'FIXED']);
export type CouponDiscountType = z.infer<typeof couponDiscountTypeSchema>;

export const couponStatusSchema = z.enum(['PUBLISHED', 'DISABLED']);
export type CouponStatus = z.infer<typeof couponStatusSchema>;

export const couponSchema = z.object({
  id: z.string().min(1),
  liveId: liveIdSchema,
  type: couponDiscountTypeSchema,
  value: z.int().positive(),
  minOrderAmountKrw: z.int().nonnegative(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  usageLimit: z.int().positive().nullable(),
  usedCount: z.int().nonnegative(),
  status: couponStatusSchema,
});
export type Coupon = z.infer<typeof couponSchema>;

export const orderStatusSchema = z.enum(['PENDING', 'PAID', 'FAILED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderIdSchema = z.string().min(1).max(64);
export const orderParamsSchema = z.object({
  orderId: orderIdSchema,
});

export const orderItemSchema = z.object({
  id: z.string().min(1),
  productVariantId: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  variantName: z.string().min(1),
  quantity: z.int().positive(),
  unitPriceKrw: z.int().positive(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  liveId: liveIdSchema,
  couponId: z.string().min(1).nullable(),
  status: orderStatusSchema,
  subtotalKrw: z.int().nonnegative(),
  discountKrw: z.int().nonnegative(),
  totalKrw: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
  items: z.array(orderItemSchema).min(1),
});
export type Order = z.infer<typeof orderSchema>;

export const adminOrderSchema = orderSchema.extend({
  customer: z.object({
    id: z.string().min(1),
    nickname: z.string().min(1),
  }),
});
export type AdminOrder = z.infer<typeof adminOrderSchema>;

export const ordersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type OrdersQuery = z.infer<typeof ordersQuerySchema>;

export const adminOrderListSchema = z.array(adminOrderSchema);

export const adminOrdersQuerySchema = z.object({
  liveId: liveIdSchema.optional(),
  cursor: orderIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;

export const adminOrderPageSchema = z.object({
  orders: adminOrderListSchema,
  nextCursor: orderIdSchema.nullable(),
});
export type AdminOrderPage = z.infer<typeof adminOrderPageSchema>;

export const liveSessionSchema = z.object({
  id: liveIdSchema,
  title: z.string().min(1),
  status: liveStatusSchema,
  startedAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
});
export type LiveSession = z.infer<typeof liveSessionSchema>;

export const createNextLiveSessionResponseSchema = liveSessionSchema;
export type CreateNextLiveSessionResponse = z.infer<typeof createNextLiveSessionResponseSchema>;

const liveTitleSchema = z
  .string()
  .trim()
  .min(1, '방송 제목을 입력해 주세요.')
  .max(100, '방송 제목은 100자 이하로 입력해 주세요.');
const liveDescriptionSchema = z
  .string()
  .trim()
  .min(1, '방송 설명을 입력해 주세요.')
  .max(500, '방송 설명은 500자 이하로 입력해 주세요.');
const liveThumbnailUrlSchema = z
  .string()
  .url('대표 이미지 URL 형식이 올바르지 않습니다.')
  .max(2048, '대표 이미지 URL은 2,048자 이하로 입력해 주세요.');

export const createLiveDraftRequestSchema = z.object({
  title: liveTitleSchema,
  description: liveDescriptionSchema,
  thumbnailUrl: liveThumbnailUrlSchema.optional(),
  scheduledStartAt: z.iso.datetime(),
});
export type CreateLiveDraftRequest = z.infer<typeof createLiveDraftRequestSchema>;

export const updateLiveDraftRequestSchema = createLiveDraftRequestSchema;
export type UpdateLiveDraftRequest = z.infer<typeof updateLiveDraftRequestSchema>;

export const adminLiveSessionSchema = liveSessionSchema.extend({
  description: z.string().max(500).nullable(),
  thumbnailUrl: z.string().url().max(2048).nullable(),
  scheduledStartAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type AdminLiveSession = z.infer<typeof adminLiveSessionSchema>;

export const adminLiveListQuerySchema = z.object({
  cursor: liveIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: liveStatusSchema.optional(),
});
export type AdminLiveListQuery = z.infer<typeof adminLiveListQuerySchema>;

export const adminLiveListSchema = z.object({
  lives: z.array(adminLiveSessionSchema),
  nextCursor: liveIdSchema.nullable(),
});
export type AdminLiveList = z.infer<typeof adminLiveListSchema>;

export const chatMessageTypeSchema = z.enum(['USER', 'ADMIN', 'SYSTEM']);
export type ChatMessageType = z.infer<typeof chatMessageTypeSchema>;

export const chatMessageVisibilitySchema = z.enum(['VISIBLE', 'HIDDEN']);
export type ChatMessageVisibility = z.infer<typeof chatMessageVisibilitySchema>;

export const chatSenderSchema = z.object({
  id: z.string().min(1),
  nickname: z.string().min(1),
  role: roleSchema,
});
export type ChatSender = z.infer<typeof chatSenderSchema>;

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  clientMessageId: z.string().uuid(),
  roomId: z.string().min(1),
  liveId: liveIdSchema,
  sender: chatSenderSchema,
  sequence: z.int().positive(),
  type: chatMessageTypeSchema,
  visibility: chatMessageVisibilitySchema,
  content: z.string().min(1).max(500),
  createdAt: z.iso.datetime(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatMessagePageSchema = z.object({
  messages: z.array(chatMessageSchema),
  lastMessageSequence: z.int().nonnegative(),
  hasMore: z.boolean(),
});
export type ChatMessagePage = z.infer<typeof chatMessagePageSchema>;

export const chatMessageContentSchema = z
  .string()
  .trim()
  .min(1, '메시지를 입력해 주세요.')
  .max(500, '메시지는 500자 이하로 입력해 주세요.')
  .superRefine((content, context) => {
    if (/([^\r\n])\1{24,}/u.test(content)) {
      context.addIssue({
        code: 'custom',
        message: '같은 문자를 너무 많이 반복할 수 없습니다.',
      });
    }

    if ((content.match(/https?:\/\/\S+/giu) ?? []).length > 2) {
      context.addIssue({
        code: 'custom',
        message: '한 메시지에는 URL을 두 개까지만 포함할 수 있습니다.',
      });
    }
  });

export const createChatMessageRequestSchema = z.object({
  clientMessageId: z.string().uuid(),
  content: chatMessageContentSchema,
});
export type CreateChatMessageRequest = z.infer<typeof createChatMessageRequestSchema>;

export const chatMessageIdSchema = z.string().min(1).max(64);
export const chatMessageParamsSchema = liveParamsSchema.extend({
  messageId: chatMessageIdSchema,
});

export const chatUserIdSchema = z.string().min(1).max(64);
export const chatTimeoutParamsSchema = liveParamsSchema.extend({
  userId: chatUserIdSchema,
});

export const hideChatMessageRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, '숨김 사유를 입력해 주세요.')
    .max(300, '숨김 사유는 300자 이하로 입력해 주세요.'),
});
export type HideChatMessageRequest = z.infer<typeof hideChatMessageRequestSchema>;

export const chatTimeoutUserRequestSchema = z.object({
  durationMinutes: z
    .number()
    .int()
    .min(1, '채팅 제한 시간은 1분 이상이어야 합니다.')
    .max(1440, '채팅 제한 시간은 24시간 이하여야 합니다.'),
  reason: z
    .string()
    .trim()
    .min(1, '채팅 제한 사유를 입력해 주세요.')
    .max(300, '채팅 제한 사유는 300자 이하로 입력해 주세요.'),
});
export type ChatTimeoutUserRequest = z.infer<typeof chatTimeoutUserRequestSchema>;

export const chatAccessStatusSchema = z.object({
  timeoutExpiresAt: z.iso.datetime().nullable(),
});
export type ChatAccessStatus = z.infer<typeof chatAccessStatusSchema>;

export const chatMessagesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    beforeSequence: z.coerce.number().int().positive().optional(),
    afterSequence: z.coerce.number().int().nonnegative().optional(),
  })
  .superRefine((query, context) => {
    if (query.beforeSequence !== undefined && query.afterSequence !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'beforeSequence와 afterSequence는 함께 사용할 수 없습니다.',
      });
    }
  });
export type ChatMessagesQuery = z.infer<typeof chatMessagesQuerySchema>;

export const aiSuggestionTypeSchema = z.enum(['CHAT_SUMMARY']);
export type AiSuggestionType = z.infer<typeof aiSuggestionTypeSchema>;

export const aiSuggestionStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type AiSuggestionStatus = z.infer<typeof aiSuggestionStatusSchema>;

export const aiChatSummaryGroupSchema = z.object({
  topic: z.string().min(1).max(100),
  count: z.int().positive(),
  exampleMessageIds: z.array(chatMessageIdSchema).min(1).max(3),
  suggestedAnswer: z.string().min(1).max(500),
  sourceIds: z.array(z.string().min(1)).min(1).max(10),
  risk: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});
export type AiChatSummaryGroup = z.infer<typeof aiChatSummaryGroupSchema>;

export const aiChatSummarySchema = z.object({
  groups: z.array(aiChatSummaryGroupSchema).max(10),
  overallSentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']),
  requiresImmediateAttention: z.boolean(),
});
export type AiChatSummary = z.infer<typeof aiChatSummarySchema>;

export const announcementContentSchema = z
  .string()
  .trim()
  .min(2, '공지 내용은 두 글자 이상 입력해 주세요.')
  .max(500, '공지 내용은 500자 이하로 입력해 주세요.');

export const publishAnnouncementRequestSchema = z.object({
  content: announcementContentSchema,
});
export type PublishAnnouncementRequest = z.infer<typeof publishAnnouncementRequestSchema>;

export const announcementSchema = z.object({
  id: z.string().min(1),
  liveId: liveIdSchema,
  content: announcementContentSchema,
  createdBy: z.string().min(1),
  sourceSuggestionId: z.string().min(1).max(64).nullable(),
  createdAt: z.iso.datetime(),
});
export type Announcement = z.infer<typeof announcementSchema>;

export const auditLogSchema = z.object({
  id: z.string().min(1),
  liveId: liveIdSchema,
  actor: z.object({
    id: z.string().min(1),
    nickname: z.string().min(1),
  }),
  action: z.string().min(1).max(64),
  entityType: z.string().min(1).max(64),
  entityId: z.string().min(1).max(128).nullable(),
  createdAt: z.iso.datetime(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;

export const auditLogsQuerySchema = z.object({
  cursor: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;

export const auditLogPageSchema = z.object({
  logs: z.array(auditLogSchema),
  nextCursor: z.string().min(1).max(64).nullable(),
});
export type AuditLogPage = z.infer<typeof auditLogPageSchema>;

export const aiSuggestionSchema = z.object({
  id: z.string().min(1),
  liveId: liveIdSchema,
  type: aiSuggestionTypeSchema,
  provider: z.string().min(1).max(64),
  modelOrMockVersion: z.string().min(1).max(128),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/u),
  output: aiChatSummarySchema,
  status: aiSuggestionStatusSchema,
  reviewedBy: z.string().min(1).nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;

export const aiSuggestionListSchema = z.array(aiSuggestionSchema);

export const createAiChatSummaryRequestSchema = z.object({
  maxMessages: z.coerce.number().int().min(1).max(100).default(100),
});
export type CreateAiChatSummaryRequest = z.infer<typeof createAiChatSummaryRequestSchema>;

export const aiSuggestionIdSchema = z.string().min(1).max(64);
export const aiSuggestionParamsSchema = z.object({
  suggestionId: aiSuggestionIdSchema,
});

export const reviewAiSuggestionRequestSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT']),
    editedOutput: aiChatSummarySchema.optional(),
    announcementContent: announcementContentSchema.optional(),
    reason: z.string().trim().min(2).max(300).optional(),
  })
  .superRefine((request, context) => {
    if (request.action === 'APPROVE' && !request.announcementContent) {
      context.addIssue({
        code: 'custom',
        path: ['announcementContent'],
        message: '승인하려면 시청자에게 보낼 공지 내용을 입력해 주세요.',
      });
    }

    if (request.action === 'REJECT' && !request.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: '거절 사유를 입력해 주세요.',
      });
    }
  });
export type ReviewAiSuggestionRequest = z.infer<typeof reviewAiSuggestionRequestSchema>;

export const liveSnapshotSchema = z.object({
  live: liveSessionSchema,
  featuredProduct: productSchema.nullable(),
  activeCoupon: couponSchema.nullable(),
  latestAnnouncement: announcementSchema.nullable(),
  products: z.array(productSchema),
  lastEventSequence: z.int().nonnegative(),
  chat: chatMessagePageSchema,
});
export type LiveSnapshot = z.infer<typeof liveSnapshotSchema>;

export const liveMetricsSchema = z.object({
  chatMessageCount: z.int().nonnegative(),
  couponUseCount: z.int().nonnegative(),
  paidOrderCount: z.int().nonnegative(),
  pendingAiSuggestionCount: z.int().nonnegative(),
  reviewedAiSuggestionCount: z.int().nonnegative(),
  totalDiscountKrw: z.int().nonnegative(),
  totalOrderCount: z.int().nonnegative(),
  totalRevenueKrw: z.int().nonnegative(),
});
export type LiveMetrics = z.infer<typeof liveMetricsSchema>;

export const featureProductRequestSchema = z.object({
  productId: z.string().min(1).max(64).nullable(),
});
export type FeatureProductRequest = z.infer<typeof featureProductRequestSchema>;

export const publishCouponRequestSchema = z
  .object({
    type: couponDiscountTypeSchema,
    value: z.coerce.number().int().positive(),
    minOrderAmountKrw: z.coerce.number().int().nonnegative(),
    endsAt: z.iso.datetime(),
    usageLimit: z.coerce.number().int().positive().max(100_000).nullable(),
  })
  .superRefine((coupon, context) => {
    if (coupon.type === 'PERCENT' && coupon.value > 100) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: '퍼센트 할인은 100%를 넘을 수 없습니다.',
      });
    }

    if (new Date(coupon.endsAt).getTime() <= Date.now()) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: '쿠폰 만료 시각은 현재보다 이후여야 합니다.',
      });
    }
  });
export type PublishCouponRequest = z.infer<typeof publishCouponRequestSchema>;

export const idempotencyKeySchema = z.string().uuid();

export const createOrderRequestSchema = z.object({
  liveId: liveIdSchema,
  productVariantId: z.string().min(1).max(64),
  quantity: z.coerce.number().int().min(1).max(10),
});
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

export const productQuestionSchema = z
  .string()
  .trim()
  .min(2, '상품 질문은 두 글자 이상 입력해 주세요.')
  .max(500, '상품 질문은 500자 이하로 입력해 주세요.');

export const createProductQuestionRequestSchema = z.object({
  question: productQuestionSchema,
});
export type CreateProductQuestionRequest = z.infer<typeof createProductQuestionRequestSchema>;

export const aiProductAnswerSchema = z.object({
  answer: z.string().min(1).max(2_000),
  sourceIds: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0).max(1),
  needsHumanReview: z.boolean(),
  reason: z.string().min(1).max(500),
});
export type AiProductAnswer = z.infer<typeof aiProductAnswerSchema>;

export const liveJoinRequestSchema = z.object({
  liveId: liveIdSchema,
  lastEventSequence: z.int().nonnegative(),
});
export type LiveJoinRequest = z.infer<typeof liveJoinRequestSchema>;

export const productFeaturedEventSchema = z.object({
  eventId: z.string().min(1),
  liveId: liveIdSchema,
  sequence: z.int().positive(),
  type: z.literal('product.featured'),
  occurredAt: z.iso.datetime(),
  payload: z.object({
    product: productSchema.nullable(),
  }),
});
export type ProductFeaturedEvent = z.infer<typeof productFeaturedEventSchema>;

export const liveStatusChangedEventSchema = z.object({
  eventId: z.string().min(1),
  liveId: liveIdSchema,
  sequence: z.int().positive(),
  type: z.literal('live.status.changed'),
  occurredAt: z.iso.datetime(),
  payload: z.object({
    live: liveSessionSchema,
  }),
});
export type LiveStatusChangedEvent = z.infer<typeof liveStatusChangedEventSchema>;

export const couponPublishedEventSchema = z.object({
  eventId: z.string().min(1),
  liveId: liveIdSchema,
  sequence: z.int().positive(),
  type: z.literal('coupon.published'),
  occurredAt: z.iso.datetime(),
  payload: z.object({
    coupon: couponSchema,
  }),
});
export type CouponPublishedEvent = z.infer<typeof couponPublishedEventSchema>;

export const couponRedeemedEventSchema = z.object({
  eventId: z.string().min(1),
  liveId: liveIdSchema,
  sequence: z.int().positive(),
  type: z.literal('coupon.redeemed'),
  occurredAt: z.iso.datetime(),
  payload: z.object({
    coupon: couponSchema,
  }),
});
export type CouponRedeemedEvent = z.infer<typeof couponRedeemedEventSchema>;

export const announcementPublishedEventSchema = z.object({
  eventId: z.string().min(1),
  liveId: liveIdSchema,
  sequence: z.int().positive(),
  type: z.literal('announcement.published'),
  occurredAt: z.iso.datetime(),
  payload: z.object({
    announcement: announcementSchema,
  }),
});
export type AnnouncementPublishedEvent = z.infer<typeof announcementPublishedEventSchema>;

export const aiSuggestionCreatedEventSchema = z.object({
  eventId: z.string().min(1),
  liveId: liveIdSchema,
  sequence: z.int().positive(),
  type: z.literal('ai.suggestion.created'),
  occurredAt: z.iso.datetime(),
  payload: z.object({
    suggestion: aiSuggestionSchema,
  }),
});
export type AiSuggestionCreatedEvent = z.infer<typeof aiSuggestionCreatedEventSchema>;

export const inventoryUpdatedEventSchema = z.object({
  eventId: z.string().min(1),
  liveId: liveIdSchema,
  sequence: z.int().positive(),
  type: z.literal('inventory.updated'),
  occurredAt: z.iso.datetime(),
  payload: z.object({
    productId: z.string().min(1),
    productVariantId: z.string().min(1),
    stock: z.int().nonnegative(),
  }),
});
export type InventoryUpdatedEvent = z.infer<typeof inventoryUpdatedEventSchema>;

export const orderStatusChangedEventSchema = z.object({
  eventId: z.string().min(1),
  liveId: liveIdSchema,
  sequence: z.int().positive(),
  type: z.literal('order.status.changed'),
  occurredAt: z.iso.datetime(),
  payload: z.object({
    order: orderSchema,
  }),
});
export type OrderStatusChangedEvent = z.infer<typeof orderStatusChangedEventSchema>;

export const orderCreatedEventSchema = z.object({
  eventId: z.string().min(1),
  liveId: liveIdSchema,
  sequence: z.int().positive(),
  type: z.literal('order.created'),
  occurredAt: z.iso.datetime(),
  payload: z.object({
    order: adminOrderSchema,
  }),
});
export type OrderCreatedEvent = z.infer<typeof orderCreatedEventSchema>;

export const LOW_STOCK_THRESHOLD = 5;

export const inventoryLowEventSchema = z.object({
  eventId: z.string().min(1),
  liveId: liveIdSchema,
  sequence: z.int().positive(),
  type: z.literal('inventory.low'),
  occurredAt: z.iso.datetime(),
  payload: z.object({
    productId: z.string().min(1),
    productName: z.string().min(1),
    productVariantId: z.string().min(1),
    variantName: z.string().min(1),
    stock: z.int().nonnegative(),
    threshold: z.literal(LOW_STOCK_THRESHOLD),
  }),
});
export type InventoryLowEvent = z.infer<typeof inventoryLowEventSchema>;

export const chatMessageCreatedEventSchema = z.object({
  eventId: z.string().min(1),
  liveId: liveIdSchema,
  sequence: z.int().positive(),
  type: z.literal('chat.message.created'),
  occurredAt: z.iso.datetime(),
  payload: z.object({
    message: chatMessageSchema,
  }),
});
export type ChatMessageCreatedEvent = z.infer<typeof chatMessageCreatedEventSchema>;

export const chatMessageHiddenEventSchema = z.object({
  eventId: z.string().min(1),
  liveId: liveIdSchema,
  sequence: z.int().positive(),
  type: z.literal('chat.message.hidden'),
  occurredAt: z.iso.datetime(),
  payload: z.object({
    messageId: chatMessageIdSchema,
  }),
});
export type ChatMessageHiddenEvent = z.infer<typeof chatMessageHiddenEventSchema>;

export const chatUserTimedOutEventSchema = z.object({
  eventId: z.string().min(1),
  liveId: liveIdSchema,
  sequence: z.int().positive(),
  type: z.literal('chat.user.timed_out'),
  occurredAt: z.iso.datetime(),
  payload: z.object({
    userId: chatUserIdSchema,
    expiresAt: z.iso.datetime(),
  }),
});
export type ChatUserTimedOutEvent = z.infer<typeof chatUserTimedOutEventSchema>;

export const realtimeEventSchema = z.discriminatedUnion('type', [
  liveStatusChangedEventSchema,
  productFeaturedEventSchema,
  couponPublishedEventSchema,
  couponRedeemedEventSchema,
  announcementPublishedEventSchema,
  aiSuggestionCreatedEventSchema,
  inventoryUpdatedEventSchema,
  orderStatusChangedEventSchema,
  orderCreatedEventSchema,
  inventoryLowEventSchema,
  chatMessageCreatedEventSchema,
  chatMessageHiddenEventSchema,
  chatUserTimedOutEventSchema,
]);
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

export const demoAdminSessionRequestSchema = z.object({
  password: z.string().min(1).max(256),
});

export const demoSessionResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.iso.datetime(),
  role: roleSchema,
});
export type DemoSessionResponse = z.infer<typeof demoSessionResponseSchema>;
