import { z } from 'zod';

export const roleSchema = z.enum(['VIEWER', 'ADMIN']);
export type Role = z.infer<typeof roleSchema>;

export const liveStatusSchema = z.enum(['READY', 'LIVE', 'ENDED']);
export type LiveStatus = z.infer<typeof liveStatusSchema>;

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

export const liveSessionSchema = z.object({
  id: liveIdSchema,
  title: z.string().min(1),
  status: liveStatusSchema,
  startedAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
});
export type LiveSession = z.infer<typeof liveSessionSchema>;

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

export const liveSnapshotSchema = z.object({
  live: liveSessionSchema,
  featuredProduct: productSchema.nullable(),
  activeCoupon: couponSchema.nullable(),
  products: z.array(productSchema),
  lastEventSequence: z.int().nonnegative(),
  chat: chatMessagePageSchema,
});
export type LiveSnapshot = z.infer<typeof liveSnapshotSchema>;

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
  productFeaturedEventSchema,
  couponPublishedEventSchema,
  couponRedeemedEventSchema,
  inventoryUpdatedEventSchema,
  orderStatusChangedEventSchema,
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
