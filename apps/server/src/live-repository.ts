import type { LiveSnapshot, Product, ProductFeaturedEvent } from '@liveflow/contracts';
import { prisma } from '@liveflow/database';

type ProductRecord = {
  id: string;
  name: string;
  description: string;
  priceKrw: number;
  variants: Array<{
    id: string;
    name: string;
    stock: number;
  }>;
};

type LiveRecord = {
  id: string;
  title: string;
  status: LiveSnapshot['live']['status'];
  startedAt: Date | null;
  endedAt: Date | null;
  nextEventSequence: number;
  featuredProductId: string | null;
  featuredProduct: ProductRecord | null;
};

export type FeatureProductResult =
  | {
      kind: 'featured';
      event: ProductFeaturedEvent;
    }
  | {
      kind: 'live_not_found';
    }
  | {
      kind: 'product_not_found';
    };

export interface LiveRepository {
  getSnapshot(liveId: string): Promise<LiveSnapshot | null>;
  featureProduct(input: {
    liveId: string;
    productId: string | null;
    actorId: string;
  }): Promise<FeatureProductResult>;
}

function toProductDto(product: ProductRecord): Product {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    priceKrw: product.priceKrw,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      stock: variant.stock,
    })),
  };
}

function toSnapshot(live: LiveRecord, products: ProductRecord[]): LiveSnapshot {
  return {
    live: {
      id: live.id,
      title: live.title,
      status: live.status,
      startedAt: live.startedAt?.toISOString() ?? null,
      endedAt: live.endedAt?.toISOString() ?? null,
    },
    featuredProduct: live.featuredProduct ? toProductDto(live.featuredProduct) : null,
    products: products.map(toProductDto),
    lastEventSequence: live.nextEventSequence - 1,
  };
}

export const prismaLiveRepository: LiveRepository = {
  async getSnapshot(liveId) {
    const [live, products] = await Promise.all([
      prisma.liveSession.findUnique({
        where: { id: liveId },
        include: {
          featuredProduct: {
            include: {
              variants: {
                orderBy: { name: 'asc' },
              },
            },
          },
        },
      }),
      prisma.product.findMany({
        include: {
          variants: {
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return live ? toSnapshot(live, products) : null;
  },

  async featureProduct({ liveId, productId, actorId }) {
    return prisma.$transaction(async (transaction) => {
      const liveBefore = await transaction.liveSession.findUnique({
        where: { id: liveId },
        select: { featuredProductId: true },
      });

      if (!liveBefore) {
        return { kind: 'live_not_found' } as const;
      }

      const product = productId
        ? await transaction.product.findUnique({
            where: { id: productId },
            include: {
              variants: {
                orderBy: { name: 'asc' },
              },
            },
          })
        : null;

      if (productId && !product) {
        return { kind: 'product_not_found' } as const;
      }

      const updatedLive = await transaction.liveSession.update({
        where: { id: liveId },
        data: {
          featuredProductId: productId,
          nextEventSequence: { increment: 1 },
        },
        select: { nextEventSequence: true },
      });

      const occurredAt = new Date();
      const eventPayload = {
        product: product ? toProductDto(product) : null,
      };
      const event = await transaction.realtimeEvent.create({
        data: {
          liveId,
          sequence: updatedLive.nextEventSequence - 1,
          type: 'product.featured',
          payloadJson: eventPayload,
          occurredAt,
        },
      });

      await transaction.auditLog.create({
        data: {
          liveId,
          actorId,
          action: 'PRODUCT_FEATURED',
          entityType: 'PRODUCT',
          entityId: productId,
          beforeJson: { featuredProductId: liveBefore.featuredProductId },
          afterJson: { featuredProductId: productId },
        },
      });

      return {
        kind: 'featured',
        event: {
          eventId: event.id,
          liveId,
          sequence: event.sequence,
          type: 'product.featured',
          occurredAt: event.occurredAt.toISOString(),
          payload: eventPayload,
        },
      } as const;
    });
  },
};
