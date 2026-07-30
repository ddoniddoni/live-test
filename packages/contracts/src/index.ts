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
  products: z.array(productSchema),
  lastEventSequence: z.int().nonnegative(),
  chat: chatMessagePageSchema,
});
export type LiveSnapshot = z.infer<typeof liveSnapshotSchema>;

export const featureProductRequestSchema = z.object({
  productId: z.string().min(1).max(64).nullable(),
});
export type FeatureProductRequest = z.infer<typeof featureProductRequestSchema>;

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

export const realtimeEventSchema = z.discriminatedUnion('type', [
  productFeaturedEventSchema,
  chatMessageCreatedEventSchema,
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
