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

export const liveSnapshotSchema = z.object({
  live: liveSessionSchema,
  featuredProduct: productSchema.nullable(),
  products: z.array(productSchema),
  lastEventSequence: z.int().nonnegative(),
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

export const realtimeEventSchema = z.discriminatedUnion('type', [productFeaturedEventSchema]);
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
