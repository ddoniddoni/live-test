import { LOW_STOCK_THRESHOLD, aiChatSummarySchema } from '@liveflow/contracts';
import type {
  AdminLiveList,
  AdminLiveListQuery,
  AdminLiveSession,
  AdminOrder,
  AiChatSummary,
  AiSuggestion,
  AiSuggestionCreatedEvent,
  Announcement,
  AnnouncementPublishedEvent,
  AuditLog,
  AuditLogPage,
  AuditLogsQuery,
  ChatAccessStatus,
  ChatMessage,
  ChatMessageCreatedEvent,
  ChatMessageHiddenEvent,
  ChatMessagePage,
  ChatMessagesQuery,
  ChatUserTimedOutEvent,
  Coupon,
  CouponPublishedEvent,
  CouponRedeemedEvent,
  CreateLiveDraftRequest,
  InventoryUpdatedEvent,
  InventoryLowEvent,
  LiveStatusChangedEvent,
  LiveProduct,
  LiveSnapshot,
  LiveStatusTransitionAction,
  Order,
  OrderCreatedEvent,
  OrderStatusChangedEvent,
  OrdersQuery,
  Product,
  ProductFeaturedEvent,
  ReplaceLiveProductsRequest,
  ReviewAiSuggestionRequest,
  UpdateLiveDraftRequest,
} from '@liveflow/contracts';
import { prisma } from '@liveflow/database';

import { calculateOrderPricing } from './order-pricing.js';

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

type LiveProductRecord = {
  liveId: string;
  displayOrder: number;
  product: ProductRecord;
};

type CouponRecord = {
  id: string;
  liveId: string;
  type: Coupon['type'];
  value: number;
  minOrderAmountKrw: number;
  startsAt: Date;
  endsAt: Date;
  usageLimit: number | null;
  usedCount: number;
  status: Coupon['status'];
};

type AnnouncementRecord = {
  id: string;
  liveId: string;
  content: string;
  createdById: string;
  sourceSuggestionId: string | null;
  createdAt: Date;
};

type AiSuggestionRecord = {
  id: string;
  liveId: string;
  type: AiSuggestion['type'];
  provider: string;
  modelOrMockVersion: string;
  inputHash: string;
  outputJson: unknown;
  status: AiSuggestion['status'];
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
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

type ChatMessageRecord = {
  id: string;
  roomId: string;
  clientMessageId: string;
  sequence: number;
  type: ChatMessage['type'];
  visibility: ChatMessage['visibility'];
  content: string;
  createdAt: Date;
  sender: ChatMessage['sender'];
};

type ChatRoomSnapshot = {
  nextSequence: number;
  messages: ChatMessageRecord[];
};

type OrderRecord = {
  id: string;
  liveId: string;
  userId: string;
  couponId: string | null;
  status: Order['status'];
  subtotalKrw: number;
  discountKrw: number;
  totalKrw: number;
  createdAt: Date;
  items: Array<{
    id: string;
    productVariantId: string;
    productId: string;
    productName: string;
    variantName: string;
    quantity: number;
    unitPriceKrw: number;
  }>;
};

type AuditLogRecord = {
  id: string;
  liveId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
  actor: {
    id: string;
    nickname: string;
  };
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
    }
  | {
      kind: 'product_not_available';
    };

export type GetLiveProductsResult =
  | {
      kind: 'found';
      products: LiveProduct[];
    }
  | {
      kind: 'live_not_found';
    };

export type ReplaceLiveProductsResult =
  | {
      kind: 'updated';
      products: LiveProduct[];
      featuredProductEvent: ProductFeaturedEvent | null;
    }
  | {
      kind: 'live_not_found';
    }
  | {
      kind: 'live_not_editable';
    }
  | {
      kind: 'products_not_found';
    }
  | {
      kind: 'product_not_sellable';
    };

export type ChangeLiveStatusResult =
  | {
      kind: 'changed';
      event: LiveStatusChangedEvent;
    }
  | {
      kind: 'live_not_found';
    }
  | {
      kind: 'invalid_status_transition';
    }
  | {
      kind: 'schedule_requirements_not_met';
    }
  | {
      kind: 'preparation_requirements_not_met';
    };

export type CreateNextLiveSessionResult =
  | {
      kind: 'created';
      live: LiveSnapshot['live'];
    }
  | {
      kind: 'live_not_found';
    }
  | {
      kind: 'source_live_not_ended';
    };

export type UpdateLiveDraftResult =
  | {
      kind: 'updated';
      live: AdminLiveSession;
    }
  | {
      kind: 'live_not_found';
    }
  | {
      kind: 'live_not_editable';
    };

export type CancelLiveDraftResult =
  | {
      kind: 'cancelled';
      live: AdminLiveSession;
    }
  | {
      kind: 'live_not_found';
    }
  | {
      kind: 'live_not_cancellable';
    };

export type PublishCouponResult =
  | {
      kind: 'published';
      event: CouponPublishedEvent;
    }
  | {
      kind: 'live_not_found';
    }
  | {
      kind: 'coupon_not_publishable';
    };

export type PublishAnnouncementResult =
  | {
      kind: 'published';
      event: AnnouncementPublishedEvent;
    }
  | {
      kind: 'live_not_found';
    };

export type CreateChatMessageResult =
  | {
      kind: 'created';
      event: ChatMessageCreatedEvent;
    }
  | {
      kind: 'idempotent';
      message: ChatMessage;
    }
  | {
      kind: 'live_not_found';
    }
  | {
      kind: 'live_not_accepting_chat';
    }
  | {
      kind: 'user_timed_out';
      expiresAt: string;
    };

export type CreateOrderResult =
  | {
      kind: 'created';
      order: Order;
      inventoryEvent: InventoryUpdatedEvent;
      inventoryLowEvent: InventoryLowEvent | null;
      couponEvent: CouponRedeemedEvent | null;
      orderEvent: OrderStatusChangedEvent;
      adminOrderEvent: OrderCreatedEvent;
    }
  | {
      kind: 'idempotent';
      order: Order;
    }
  | {
      kind: 'live_not_found';
    }
  | {
      kind: 'live_not_accepting_orders';
    }
  | {
      kind: 'user_not_found';
    }
  | {
      kind: 'product_not_found';
    }
  | {
      kind: 'product_not_available';
    }
  | {
      kind: 'out_of_stock';
    };

export type GetViewerOrderResult =
  | {
      kind: 'found';
      order: Order;
    }
  | {
      kind: 'order_not_found';
    };

export type HideChatMessageResult =
  | {
      kind: 'hidden';
      event: ChatMessageHiddenEvent;
    }
  | {
      kind: 'live_not_found';
    }
  | {
      kind: 'message_not_found';
    }
  | {
      kind: 'already_hidden';
    };

export type GetChatAccessResult =
  | {
      kind: 'found';
      access: ChatAccessStatus;
    }
  | {
      kind: 'live_not_found';
    };

export type TimeoutChatUserResult =
  | {
      kind: 'timed_out';
      event: ChatUserTimedOutEvent;
    }
  | {
      kind: 'live_not_found';
    }
  | {
      kind: 'user_not_found';
    }
  | {
      kind: 'user_not_timeoutable';
    };

export type GetAiSuggestionsResult =
  | {
      kind: 'found';
      suggestions: AiSuggestion[];
    }
  | {
      kind: 'live_not_found';
    };

export type GetAuditLogsResult =
  | {
      kind: 'found';
      page: AuditLogPage;
    }
  | {
      kind: 'live_not_found';
    };

export type GetOrdersResult =
  | {
      kind: 'found';
      orders: AdminOrder[];
    }
  | {
      kind: 'live_not_found';
    };

export type CreateAiSuggestionResult =
  | {
      kind: 'created';
      suggestion: AiSuggestion;
      event: AiSuggestionCreatedEvent;
    }
  | {
      kind: 'live_not_found';
    };

export type ReviewAiSuggestionResult =
  | {
      kind: 'approved';
      suggestion: AiSuggestion;
      event: AnnouncementPublishedEvent;
    }
  | {
      kind: 'rejected';
      suggestion: AiSuggestion;
    }
  | {
      kind: 'suggestion_not_found';
    }
  | {
      kind: 'suggestion_not_reviewable';
    };

export interface LiveRepository {
  listAdminLives(query: AdminLiveListQuery): Promise<AdminLiveList>;
  getAdminLive(liveId: string): Promise<AdminLiveSession | null>;
  listCatalogProducts(): Promise<Product[]>;
  getLiveProducts(liveId: string): Promise<GetLiveProductsResult>;
  replaceLiveProducts(input: {
    actorId: string;
    liveId: string;
    productIds: ReplaceLiveProductsRequest['productIds'];
  }): Promise<ReplaceLiveProductsResult>;
  createLiveDraft(input: {
    actorId: string;
    draft: CreateLiveDraftRequest;
  }): Promise<AdminLiveSession>;
  updateLiveDraft(input: {
    actorId: string;
    draft: UpdateLiveDraftRequest;
    liveId: string;
  }): Promise<UpdateLiveDraftResult>;
  cancelLiveDraft(input: { actorId: string; liveId: string }): Promise<CancelLiveDraftResult>;
  getSnapshot(liveId: string): Promise<LiveSnapshot | null>;
  getMessages(liveId: string, query: ChatMessagesQuery): Promise<ChatMessagePage | null>;
  getChatAccess(liveId: string, userId: string): Promise<GetChatAccessResult>;
  createMessage(input: {
    liveId: string;
    senderId: string;
    senderRole: ChatMessage['sender']['role'];
    clientMessageId: string;
    content: string;
  }): Promise<CreateChatMessageResult>;
  createOrder(input: {
    liveId: string;
    userId: string;
    productVariantId: string;
    quantity: number;
    idempotencyKey: string;
  }): Promise<CreateOrderResult>;
  getViewerOrder(input: { orderId: string; userId: string }): Promise<GetViewerOrderResult>;
  getRecentOrders(liveId: string, query: OrdersQuery): Promise<GetOrdersResult>;
  hideMessage(input: {
    liveId: string;
    messageId: string;
    actorId: string;
    reason: string;
  }): Promise<HideChatMessageResult>;
  timeoutUser(input: {
    liveId: string;
    userId: string;
    actorId: string;
    durationMinutes: number;
    reason: string;
  }): Promise<TimeoutChatUserResult>;
  publishCoupon(input: {
    liveId: string;
    actorId: string;
    type: Coupon['type'];
    value: number;
    minOrderAmountKrw: number;
    endsAt: string;
    usageLimit: number | null;
  }): Promise<PublishCouponResult>;
  publishAnnouncement(input: {
    liveId: string;
    actorId: string;
    content: string;
  }): Promise<PublishAnnouncementResult>;
  featureProduct(input: {
    liveId: string;
    productId: string | null;
    actorId: string;
  }): Promise<FeatureProductResult>;
  changeLiveStatus(input: {
    liveId: string;
    actorId: string;
    action: LiveStatusTransitionAction;
  }): Promise<ChangeLiveStatusResult>;
  createNextLiveSession(input: {
    sourceLiveId: string;
    actorId: string;
  }): Promise<CreateNextLiveSessionResult>;
  getAuditLogs(liveId: string, query: AuditLogsQuery): Promise<GetAuditLogsResult>;
  getAiSuggestions(liveId: string): Promise<GetAiSuggestionsResult>;
  createAiSuggestion(input: {
    liveId: string;
    actorId: string;
    inputHash: string;
    output: AiChatSummary;
  }): Promise<CreateAiSuggestionResult>;
  reviewAiSuggestion(input: {
    suggestionId: string;
    actorId: string;
    action: ReviewAiSuggestionRequest['action'];
    editedOutput?: AiChatSummary | undefined;
    announcementContent?: string | undefined;
    reason?: string | undefined;
  }): Promise<ReviewAiSuggestionResult>;
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

function toLiveProductDto(liveProduct: LiveProductRecord): LiveProduct {
  return {
    liveId: liveProduct.liveId,
    displayOrder: liveProduct.displayOrder,
    product: toProductDto(liveProduct.product),
  };
}

function toLiveSessionDto(live: {
  id: string;
  title: string;
  status: LiveSnapshot['live']['status'];
  startedAt: Date | null;
  endedAt: Date | null;
}): LiveSnapshot['live'] {
  return {
    id: live.id,
    title: live.title,
    status: live.status,
    startedAt: live.startedAt?.toISOString() ?? null,
    endedAt: live.endedAt?.toISOString() ?? null,
  };
}

function toAdminLiveSessionDto(live: {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  scheduledStartAt: Date | null;
  status: AdminLiveSession['status'];
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}): AdminLiveSession {
  return {
    ...toLiveSessionDto(live),
    description: live.description,
    thumbnailUrl: live.thumbnailUrl,
    scheduledStartAt: live.scheduledStartAt?.toISOString() ?? null,
    createdAt: live.createdAt.toISOString(),
  };
}

function toCouponDto(coupon: CouponRecord): Coupon {
  return {
    id: coupon.id,
    liveId: coupon.liveId,
    type: coupon.type,
    value: coupon.value,
    minOrderAmountKrw: coupon.minOrderAmountKrw,
    startsAt: coupon.startsAt.toISOString(),
    endsAt: coupon.endsAt.toISOString(),
    usageLimit: coupon.usageLimit,
    usedCount: coupon.usedCount,
    status: coupon.status,
  };
}

function toAnnouncementDto(announcement: AnnouncementRecord): Announcement {
  return {
    id: announcement.id,
    liveId: announcement.liveId,
    content: announcement.content,
    createdBy: announcement.createdById,
    sourceSuggestionId: announcement.sourceSuggestionId,
    createdAt: announcement.createdAt.toISOString(),
  };
}

function toAuditLogDto(log: AuditLogRecord): AuditLog {
  return {
    id: log.id,
    liveId: log.liveId,
    actor: log.actor,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    createdAt: log.createdAt.toISOString(),
  };
}

function toAiSuggestionDto(suggestion: AiSuggestionRecord): AiSuggestion {
  return {
    id: suggestion.id,
    liveId: suggestion.liveId,
    type: suggestion.type,
    provider: suggestion.provider,
    modelOrMockVersion: suggestion.modelOrMockVersion,
    inputHash: suggestion.inputHash,
    output: aiChatSummarySchema.parse(suggestion.outputJson),
    status: suggestion.status,
    reviewedBy: suggestion.reviewedById,
    reviewedAt: suggestion.reviewedAt?.toISOString() ?? null,
    createdAt: suggestion.createdAt.toISOString(),
  };
}

function toChatMessageDto(message: ChatMessageRecord, liveId: string): ChatMessage {
  return {
    id: message.id,
    roomId: message.roomId,
    clientMessageId: message.clientMessageId,
    liveId,
    sender: message.sender,
    sequence: message.sequence,
    type: message.type,
    visibility: message.visibility,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

function toOrderDto(order: OrderRecord): Order {
  return {
    id: order.id,
    liveId: order.liveId,
    userId: order.userId,
    couponId: order.couponId,
    status: order.status,
    subtotalKrw: order.subtotalKrw,
    discountKrw: order.discountKrw,
    totalKrw: order.totalKrw,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      productVariantId: item.productVariantId,
      productId: item.productId,
      productName: item.productName,
      variantName: item.variantName,
      quantity: item.quantity,
      unitPriceKrw: item.unitPriceKrw,
    })),
  };
}

function toAdminOrderDto(
  order: OrderRecord & { user: { id: string; nickname: string } },
): AdminOrder {
  return {
    ...toOrderDto(order),
    customer: order.user,
  };
}

function toChatPage(room: ChatRoomSnapshot | null, liveId: string): ChatMessagePage {
  if (!room) {
    return {
      messages: [],
      lastMessageSequence: 0,
      hasMore: false,
    };
  }

  const hasMore = room.messages.length > 50;
  const recentMessages = room.messages.slice(0, 50).reverse();

  return {
    messages: recentMessages.map((message) => toChatMessageDto(message, liveId)),
    lastMessageSequence: room.nextSequence - 1,
    hasMore,
  };
}

function toSnapshot(
  live: LiveRecord,
  products: ProductRecord[],
  chatRoom: ChatRoomSnapshot | null,
  activeCoupon: CouponRecord | null,
  latestAnnouncement: AnnouncementRecord | null,
): LiveSnapshot {
  return {
    live: toLiveSessionDto(live),
    featuredProduct: live.featuredProduct ? toProductDto(live.featuredProduct) : null,
    activeCoupon: activeCoupon ? toCouponDto(activeCoupon) : null,
    latestAnnouncement: latestAnnouncement ? toAnnouncementDto(latestAnnouncement) : null,
    products: products.map(toProductDto),
    lastEventSequence: live.nextEventSequence - 1,
    chat: toChatPage(chatRoom, live.id),
  };
}

function isPublicLiveStatus(status: LiveSnapshot['live']['status']): boolean {
  return status !== 'DRAFT' && status !== 'CANCELLED';
}

function getStatusTransition(action: LiveStatusTransitionAction): {
  expectedStatus: LiveSnapshot['live']['status'];
  nextStatus: LiveSnapshot['live']['status'];
  auditAction: string;
} {
  const transitions: Record<
    LiveStatusTransitionAction,
    {
      expectedStatus: LiveSnapshot['live']['status'];
      nextStatus: LiveSnapshot['live']['status'];
      auditAction: string;
    }
  > = {
    SCHEDULE: {
      expectedStatus: 'DRAFT',
      nextStatus: 'SCHEDULED',
      auditAction: 'LIVE_SCHEDULED',
    },
    PREPARE: {
      expectedStatus: 'SCHEDULED',
      nextStatus: 'READY',
      auditAction: 'LIVE_PREPARED',
    },
    START: {
      expectedStatus: 'READY',
      nextStatus: 'LIVE',
      auditAction: 'LIVE_STARTED',
    },
    END: {
      expectedStatus: 'LIVE',
      nextStatus: 'ENDED',
      auditAction: 'LIVE_ENDED',
    },
  };

  return transitions[action];
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === 'P2002'
  );
}

function isRecordNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === 'P2025'
  );
}

const visibleMessageInclude = {
  sender: {
    select: {
      id: true,
      nickname: true,
      role: true,
    },
  },
} as const;

const orderRecordInclude = {
  items: {
    orderBy: { id: 'asc' },
  },
} as const;

const adminOrderRecordInclude = {
  ...orderRecordInclude,
  user: {
    select: {
      id: true,
      nickname: true,
    },
  },
} as const;

export const prismaLiveRepository: LiveRepository = {
  async listAdminLives(query) {
    const rows = await prisma.liveSession.findMany({
      ...(query.status ? { where: { status: query.status } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        scheduledStartAt: true,
        status: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
      },
    });
    const lives = rows.slice(0, query.limit);

    return {
      lives: lives.map(toAdminLiveSessionDto),
      nextCursor: rows.length > query.limit ? (lives[lives.length - 1]?.id ?? null) : null,
    };
  },

  async getAdminLive(liveId) {
    const live = await prisma.liveSession.findUnique({
      where: { id: liveId },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        scheduledStartAt: true,
        status: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
      },
    });

    return live ? toAdminLiveSessionDto(live) : null;
  },

  async listCatalogProducts() {
    const products = await prisma.product.findMany({
      include: {
        variants: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return products.map(toProductDto);
  },

  async getLiveProducts(liveId) {
    const [live, liveProducts] = await Promise.all([
      prisma.liveSession.findUnique({
        where: { id: liveId },
        select: { id: true },
      }),
      prisma.liveProduct.findMany({
        where: { liveId },
        include: {
          product: {
            include: {
              variants: {
                orderBy: { name: 'asc' },
              },
            },
          },
        },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    if (!live) {
      return { kind: 'live_not_found' } as const;
    }

    return {
      kind: 'found',
      products: liveProducts.map(toLiveProductDto),
    } as const;
  },

  async replaceLiveProducts({ actorId, liveId, productIds }) {
    return prisma.$transaction(async (transaction) => {
      const live = await transaction.liveSession.findUnique({
        where: { id: liveId },
        select: {
          featuredProductId: true,
          status: true,
        },
      });

      if (!live) {
        return { kind: 'live_not_found' } as const;
      }

      if (live.status !== 'DRAFT' && live.status !== 'SCHEDULED') {
        return { kind: 'live_not_editable' } as const;
      }

      const catalogProducts = await transaction.product.findMany({
        where: { id: { in: productIds } },
        include: {
          variants: {
            orderBy: { name: 'asc' },
          },
        },
      });
      if (catalogProducts.length !== productIds.length) {
        return { kind: 'products_not_found' } as const;
      }

      const productById = new Map(catalogProducts.map((product) => [product.id, product]));
      const orderedProducts: ProductRecord[] = [];
      for (const productId of productIds) {
        const product = productById.get(productId);
        if (!product) {
          throw new Error('Catalog product disappeared while preparing a broadcast.');
        }

        if (!product.variants.some((variant) => variant.stock > 0)) {
          return { kind: 'product_not_sellable' } as const;
        }

        orderedProducts.push(product);
      }

      const nextFeaturedProductId = productIds.includes(live.featuredProductId ?? '')
        ? live.featuredProductId
        : (productIds[0] ?? null);
      const featuredProductChanged = nextFeaturedProductId !== live.featuredProductId;

      await transaction.liveProduct.deleteMany({ where: { liveId } });
      await transaction.liveProduct.createMany({
        data: productIds.map((productId, displayOrder) => ({
          liveId,
          productId,
          displayOrder,
        })),
      });

      let featuredProductEvent: ProductFeaturedEvent | null = null;
      if (featuredProductChanged) {
        const updatedLive = await transaction.liveSession.update({
          where: { id: liveId },
          data: {
            featuredProductId: nextFeaturedProductId,
            nextEventSequence: { increment: 1 },
          },
          select: { nextEventSequence: true },
        });
        const featuredProduct = orderedProducts.find(
          (product) => product.id === nextFeaturedProductId,
        );
        if (!featuredProduct) {
          throw new Error('Featured product disappeared while preparing a broadcast.');
        }

        const occurredAt = new Date();
        const realtimeEvent = await transaction.realtimeEvent.create({
          data: {
            liveId,
            sequence: updatedLive.nextEventSequence - 1,
            type: 'product.featured',
            payloadJson: { product: toProductDto(featuredProduct) },
            occurredAt,
          },
        });

        featuredProductEvent = {
          eventId: realtimeEvent.id,
          liveId,
          sequence: realtimeEvent.sequence,
          type: 'product.featured',
          occurredAt: realtimeEvent.occurredAt.toISOString(),
          payload: { product: toProductDto(featuredProduct) },
        };
      }

      await transaction.auditLog.create({
        data: {
          liveId,
          actorId,
          action: 'LIVE_PRODUCTS_UPDATED',
          entityType: 'LIVE_SESSION',
          entityId: liveId,
          beforeJson: { featuredProductId: live.featuredProductId },
          afterJson: {
            featuredProductId: nextFeaturedProductId,
            productIds,
          },
        },
      });

      return {
        kind: 'updated',
        products: orderedProducts.map((product, displayOrder) =>
          toLiveProductDto({ liveId, displayOrder, product }),
        ),
        featuredProductEvent,
      } as const;
    });
  },

  async createLiveDraft({ actorId, draft }) {
    const scheduledStartAt = new Date(draft.scheduledStartAt);
    const live = await prisma.liveSession.create({
      data: {
        title: draft.title,
        description: draft.description,
        thumbnailUrl: draft.thumbnailUrl ?? null,
        scheduledStartAt,
        status: 'DRAFT',
        createdById: actorId,
        chatRoom: { create: {} },
        auditLogs: {
          create: {
            actorId,
            action: 'LIVE_DRAFT_CREATED',
            entityType: 'LIVE_SESSION',
            afterJson: {
              status: 'DRAFT',
              title: draft.title,
              scheduledStartAt: draft.scheduledStartAt,
            },
          },
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        scheduledStartAt: true,
        status: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
      },
    });

    return toAdminLiveSessionDto(live);
  },

  async updateLiveDraft({ actorId, draft, liveId }) {
    return prisma.$transaction(async (transaction) => {
      const existingLive = await transaction.liveSession.findUnique({
        where: { id: liveId },
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          scheduledStartAt: true,
          status: true,
        },
      });

      if (!existingLive) {
        return { kind: 'live_not_found' } as const;
      }

      if (existingLive.status !== 'DRAFT' && existingLive.status !== 'SCHEDULED') {
        return { kind: 'live_not_editable' } as const;
      }

      const live = await transaction.liveSession.update({
        where: { id: liveId },
        data: {
          title: draft.title,
          description: draft.description,
          thumbnailUrl: draft.thumbnailUrl ?? null,
          scheduledStartAt: new Date(draft.scheduledStartAt),
          auditLogs: {
            create: {
              actorId,
              action: 'LIVE_DRAFT_UPDATED',
              entityType: 'LIVE_SESSION',
              beforeJson: {
                title: existingLive.title,
                description: existingLive.description,
                thumbnailUrl: existingLive.thumbnailUrl,
                scheduledStartAt: existingLive.scheduledStartAt?.toISOString() ?? null,
              },
              afterJson: {
                title: draft.title,
                description: draft.description,
                thumbnailUrl: draft.thumbnailUrl ?? null,
                scheduledStartAt: draft.scheduledStartAt,
              },
            },
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          scheduledStartAt: true,
          status: true,
          startedAt: true,
          endedAt: true,
          createdAt: true,
        },
      });

      return { kind: 'updated', live: toAdminLiveSessionDto(live) } as const;
    });
  },

  async cancelLiveDraft({ actorId, liveId }) {
    return prisma.$transaction(async (transaction) => {
      const existingLive = await transaction.liveSession.findUnique({
        where: { id: liveId },
        select: { id: true, status: true, title: true },
      });

      if (!existingLive) {
        return { kind: 'live_not_found' } as const;
      }

      if (
        existingLive.status !== 'DRAFT' &&
        existingLive.status !== 'SCHEDULED' &&
        existingLive.status !== 'READY'
      ) {
        return { kind: 'live_not_cancellable' } as const;
      }

      const live = await transaction.liveSession.update({
        where: { id: liveId },
        data: {
          status: 'CANCELLED',
          auditLogs: {
            create: {
              actorId,
              action: 'LIVE_DRAFT_CANCELLED',
              entityType: 'LIVE_SESSION',
              beforeJson: { status: existingLive.status },
              afterJson: { status: 'CANCELLED', title: existingLive.title },
            },
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          scheduledStartAt: true,
          status: true,
          startedAt: true,
          endedAt: true,
          createdAt: true,
        },
      });

      return { kind: 'cancelled', live: toAdminLiveSessionDto(live) } as const;
    });
  },

  async getSnapshot(liveId) {
    const now = new Date();
    const live = await prisma.liveSession.findUnique({
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
    });

    if (!live || !isPublicLiveStatus(live.status)) {
      return null;
    }

    const [liveProducts, chatRoom, activeCoupon, latestAnnouncement] = await Promise.all([
      prisma.liveProduct.findMany({
        where: { liveId },
        include: {
          product: {
            include: {
              variants: {
                orderBy: { name: 'asc' },
              },
            },
          },
        },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.chatRoom.findUnique({
        where: { liveId },
        select: {
          nextSequence: true,
          messages: {
            where: { visibility: 'VISIBLE' },
            include: visibleMessageInclude,
            orderBy: { sequence: 'desc' },
            take: 51,
          },
        },
      }),
      prisma.coupon.findFirst({
        where: {
          liveId,
          status: 'PUBLISHED',
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.announcement.findFirst({
        where: { liveId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return toSnapshot(
      live,
      liveProducts.map((liveProduct) => liveProduct.product),
      chatRoom,
      activeCoupon,
      latestAnnouncement,
    );
  },

  async getMessages(liveId, query) {
    const live = await prisma.liveSession.findUnique({
      where: { id: liveId },
      select: { id: true, status: true },
    });

    if (!live || !isPublicLiveStatus(live.status)) {
      return null;
    }

    const chatRoom = await prisma.chatRoom.findUnique({
      where: { liveId },
      select: {
        id: true,
        nextSequence: true,
      },
    });

    if (!chatRoom) {
      return toChatPage(null, liveId);
    }

    const take = query.limit + 1;
    const orderBy =
      query.afterSequence === undefined
        ? { sequence: 'desc' as const }
        : { sequence: 'asc' as const };
    const sequenceFilter =
      query.beforeSequence !== undefined
        ? { lt: query.beforeSequence }
        : query.afterSequence !== undefined
          ? { gt: query.afterSequence }
          : undefined;
    const rows = await prisma.chatMessage.findMany({
      where: {
        roomId: chatRoom.id,
        visibility: 'VISIBLE',
        ...(sequenceFilter ? { sequence: sequenceFilter } : {}),
      },
      include: visibleMessageInclude,
      orderBy,
      take,
    });
    const hasMore = rows.length > query.limit;
    const messages = rows.slice(0, query.limit);
    const chronologicalMessages = query.afterSequence === undefined ? messages.reverse() : messages;

    return {
      messages: chronologicalMessages.map((message) => toChatMessageDto(message, liveId)),
      lastMessageSequence: chatRoom.nextSequence - 1,
      hasMore,
    };
  },

  async getChatAccess(liveId, userId) {
    const live = await prisma.liveSession.findUnique({
      where: { id: liveId },
      select: { id: true, status: true },
    });

    if (!live || !isPublicLiveStatus(live.status)) {
      return { kind: 'live_not_found' } as const;
    }

    const activeTimeout = await prisma.chatTimeout.findFirst({
      where: {
        liveId,
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: 'desc' },
      select: { expiresAt: true },
    });

    return {
      kind: 'found',
      access: {
        timeoutExpiresAt: activeTimeout?.expiresAt.toISOString() ?? null,
      },
    } as const;
  },

  async createMessage({ liveId, senderId, senderRole, clientMessageId, content }) {
    const existingMessage = await prisma.chatMessage.findUnique({
      where: {
        senderId_clientMessageId: {
          senderId,
          clientMessageId,
        },
      },
      include: visibleMessageInclude,
    });

    if (existingMessage) {
      return {
        kind: 'idempotent',
        message: toChatMessageDto(existingMessage, liveId),
      } as const;
    }

    try {
      return await prisma.$transaction(async (transaction) => {
        const repeatedMessage = await transaction.chatMessage.findUnique({
          where: {
            senderId_clientMessageId: {
              senderId,
              clientMessageId,
            },
          },
          include: visibleMessageInclude,
        });

        if (repeatedMessage) {
          return {
            kind: 'idempotent',
            message: toChatMessageDto(repeatedMessage, liveId),
          } as const;
        }

        const live = await transaction.liveSession.findUnique({
          where: { id: liveId },
          select: { status: true },
        });

        if (!live) {
          return { kind: 'live_not_found' } as const;
        }

        if (live.status !== 'LIVE') {
          return { kind: 'live_not_accepting_chat' } as const;
        }

        const activeTimeout = await transaction.chatTimeout.findFirst({
          where: {
            liveId,
            userId: senderId,
            expiresAt: { gt: new Date() },
          },
          orderBy: { expiresAt: 'desc' },
          select: { expiresAt: true },
        });

        if (activeTimeout) {
          return {
            kind: 'user_timed_out',
            expiresAt: activeTimeout.expiresAt.toISOString(),
          } as const;
        }

        const room = await transaction.chatRoom.upsert({
          where: { liveId },
          create: { liveId },
          update: {},
          select: { id: true },
        });
        const updatedRoom = await transaction.chatRoom.update({
          where: { id: room.id },
          data: { nextSequence: { increment: 1 } },
          select: { nextSequence: true },
        });
        const updatedLive = await transaction.liveSession.update({
          where: { id: liveId },
          data: { nextEventSequence: { increment: 1 } },
          select: { nextEventSequence: true },
        });
        const message = await transaction.chatMessage.create({
          data: {
            roomId: room.id,
            senderId,
            clientMessageId,
            sequence: updatedRoom.nextSequence - 1,
            type: senderRole === 'ADMIN' ? 'ADMIN' : 'USER',
            content,
          },
          include: visibleMessageInclude,
        });
        const messageDto = toChatMessageDto(message, liveId);
        const event = await transaction.realtimeEvent.create({
          data: {
            liveId,
            sequence: updatedLive.nextEventSequence - 1,
            type: 'chat.message.created',
            payloadJson: { message: messageDto },
          },
        });

        return {
          kind: 'created',
          event: {
            eventId: event.id,
            liveId,
            sequence: event.sequence,
            type: 'chat.message.created',
            occurredAt: event.occurredAt.toISOString(),
            payload: { message: messageDto },
          },
        } as const;
      });
    } catch (error: unknown) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const persistedMessage = await prisma.chatMessage.findUnique({
        where: {
          senderId_clientMessageId: {
            senderId,
            clientMessageId,
          },
        },
        include: visibleMessageInclude,
      });

      if (!persistedMessage) {
        throw error;
      }

      return {
        kind: 'idempotent',
        message: toChatMessageDto(persistedMessage, liveId),
      } as const;
    }
  },

  async createOrder({ liveId, userId, productVariantId, quantity, idempotencyKey }) {
    const existingOrder = await prisma.order.findUnique({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey,
        },
      },
      include: orderRecordInclude,
    });

    if (existingOrder) {
      return { kind: 'idempotent', order: toOrderDto(existingOrder) } as const;
    }

    try {
      return await prisma.$transaction(async (transaction) => {
        const repeatedOrder = await transaction.order.findUnique({
          where: {
            userId_idempotencyKey: {
              userId,
              idempotencyKey,
            },
          },
          include: orderRecordInclude,
        });

        if (repeatedOrder) {
          return { kind: 'idempotent', order: toOrderDto(repeatedOrder) } as const;
        }

        const [live, user, variant] = await Promise.all([
          transaction.liveSession.findUnique({
            where: { id: liveId },
            select: { id: true, status: true, featuredProductId: true },
          }),
          transaction.user.findUnique({
            where: { id: userId },
            select: { id: true, nickname: true },
          }),
          transaction.productVariant.findUnique({
            where: { id: productVariantId },
            include: {
              product: {
                select: { id: true, name: true, priceKrw: true },
              },
            },
          }),
        ]);

        if (!live) {
          return { kind: 'live_not_found' } as const;
        }

        if (!user) {
          return { kind: 'user_not_found' } as const;
        }

        if (live.status !== 'LIVE') {
          return { kind: 'live_not_accepting_orders' } as const;
        }

        if (!variant) {
          return { kind: 'product_not_found' } as const;
        }

        const liveProduct = await transaction.liveProduct.findUnique({
          where: {
            liveId_productId: {
              liveId,
              productId: variant.productId,
            },
          },
          select: { productId: true },
        });

        if (!liveProduct) {
          return { kind: 'product_not_available' } as const;
        }

        if (live.featuredProductId !== variant.productId) {
          return { kind: 'product_not_available' } as const;
        }

        const stockDecrement = await transaction.productVariant.updateMany({
          where: {
            id: productVariantId,
            stock: { gte: quantity },
          },
          data: { stock: { decrement: quantity } },
        });

        if (stockDecrement.count === 0) {
          return { kind: 'out_of_stock' } as const;
        }

        const updatedVariant = await transaction.productVariant.findUnique({
          where: { id: productVariantId },
          select: { stock: true },
        });
        if (!updatedVariant) {
          throw new Error('Product variant disappeared after its stock was decremented.');
        }

        const now = new Date();
        const activeCoupon = await transaction.coupon.findFirst({
          where: {
            liveId,
            status: 'PUBLISHED',
            startsAt: { lte: now },
            endsAt: { gt: now },
          },
          orderBy: { createdAt: 'desc' },
        });
        let pricing = calculateOrderPricing({
          unitPriceKrw: variant.product.priceKrw,
          quantity,
          coupon: activeCoupon ? toCouponDto(activeCoupon) : null,
          now,
        });
        let redeemedCoupon: Coupon | null = null;

        if (pricing.coupon) {
          const couponUsage = await transaction.coupon.updateMany({
            where: {
              id: pricing.coupon.id,
              status: 'PUBLISHED',
              ...(pricing.coupon.usageLimit === null
                ? {}
                : { usedCount: { lt: pricing.coupon.usageLimit } }),
            },
            data: { usedCount: { increment: 1 } },
          });

          if (couponUsage.count === 0) {
            pricing = calculateOrderPricing({
              unitPriceKrw: variant.product.priceKrw,
              quantity,
              coupon: null,
              now,
            });
          } else {
            if (pricing.coupon.usageLimit !== null) {
              await transaction.coupon.updateMany({
                where: {
                  id: pricing.coupon.id,
                  status: 'PUBLISHED',
                  usedCount: { gte: pricing.coupon.usageLimit },
                },
                data: { status: 'DISABLED' },
              });
            }

            const updatedCoupon = await transaction.coupon.findUnique({
              where: { id: pricing.coupon.id },
            });
            if (!updatedCoupon) {
              throw new Error('Coupon disappeared after its usage was recorded.');
            }

            redeemedCoupon = toCouponDto(updatedCoupon);
          }
        }

        const order = await transaction.order.create({
          data: {
            liveId,
            userId,
            couponId: pricing.coupon?.id ?? null,
            idempotencyKey,
            status: 'PAID',
            subtotalKrw: pricing.subtotalKrw,
            discountKrw: pricing.discountKrw,
            totalKrw: pricing.totalKrw,
            items: {
              create: {
                productVariantId,
                productId: variant.product.id,
                productName: variant.product.name,
                variantName: variant.name,
                quantity,
                unitPriceKrw: variant.product.priceKrw,
              },
            },
          },
          include: orderRecordInclude,
        });
        const orderDto = toOrderDto(order);
        const adminOrderDto: AdminOrder = {
          ...orderDto,
          customer: {
            id: user.id,
            nickname: user.nickname,
          },
        };

        const inventoryLowPayload: InventoryLowEvent['payload'] | null =
          updatedVariant.stock <= LOW_STOCK_THRESHOLD &&
          updatedVariant.stock + quantity > LOW_STOCK_THRESHOLD
            ? {
                productId: variant.product.id,
                productName: variant.product.name,
                productVariantId,
                variantName: variant.name,
                stock: updatedVariant.stock,
                threshold: LOW_STOCK_THRESHOLD,
              }
            : null;

        const eventCount =
          3 + Number(redeemedCoupon !== null) + Number(inventoryLowPayload !== null);
        const updatedLive = await transaction.liveSession.update({
          where: { id: liveId },
          data: { nextEventSequence: { increment: eventCount } },
          select: { nextEventSequence: true },
        });
        const occurredAt = new Date();
        const inventoryPayload = {
          productId: variant.product.id,
          productVariantId,
          stock: updatedVariant.stock,
        };
        const inventoryEvent = await transaction.realtimeEvent.create({
          data: {
            liveId,
            sequence: updatedLive.nextEventSequence - eventCount,
            type: 'inventory.updated',
            payloadJson: inventoryPayload,
            occurredAt,
          },
        });
        const couponEvent = redeemedCoupon
          ? await transaction.realtimeEvent.create({
              data: {
                liveId,
                sequence: inventoryEvent.sequence + 1,
                type: 'coupon.redeemed',
                payloadJson: { coupon: redeemedCoupon },
                occurredAt,
              },
            })
          : null;
        const orderEvent = await transaction.realtimeEvent.create({
          data: {
            liveId,
            sequence: couponEvent ? couponEvent.sequence + 1 : inventoryEvent.sequence + 1,
            type: 'order.status.changed',
            payloadJson: { order: orderDto },
            occurredAt,
          },
        });
        const adminOrderEvent = await transaction.realtimeEvent.create({
          data: {
            liveId,
            sequence: orderEvent.sequence + 1,
            type: 'order.created',
            payloadJson: { order: adminOrderDto },
            occurredAt,
          },
        });
        const inventoryLowEvent = inventoryLowPayload
          ? await transaction.realtimeEvent.create({
              data: {
                liveId,
                sequence: adminOrderEvent.sequence + 1,
                type: 'inventory.low',
                payloadJson: inventoryLowPayload,
                occurredAt,
              },
            })
          : null;

        await transaction.auditLog.create({
          data: {
            liveId,
            actorId: userId,
            action: 'ORDER_CREATED',
            entityType: 'ORDER',
            entityId: order.id,
            beforeJson: { stock: updatedVariant.stock + quantity },
            afterJson: {
              productVariantId,
              quantity,
              stock: updatedVariant.stock,
              subtotalKrw: orderDto.subtotalKrw,
              discountKrw: orderDto.discountKrw,
              totalKrw: orderDto.totalKrw,
              couponId: orderDto.couponId,
            },
          },
        });

        return {
          kind: 'created',
          order: orderDto,
          inventoryEvent: {
            eventId: inventoryEvent.id,
            liveId,
            sequence: inventoryEvent.sequence,
            type: 'inventory.updated',
            occurredAt: inventoryEvent.occurredAt.toISOString(),
            payload: inventoryPayload,
          },
          couponEvent:
            couponEvent && redeemedCoupon
              ? {
                  eventId: couponEvent.id,
                  liveId,
                  sequence: couponEvent.sequence,
                  type: 'coupon.redeemed',
                  occurredAt: couponEvent.occurredAt.toISOString(),
                  payload: { coupon: redeemedCoupon },
                }
              : null,
          inventoryLowEvent:
            inventoryLowEvent && inventoryLowPayload
              ? {
                  eventId: inventoryLowEvent.id,
                  liveId,
                  sequence: inventoryLowEvent.sequence,
                  type: 'inventory.low',
                  occurredAt: inventoryLowEvent.occurredAt.toISOString(),
                  payload: inventoryLowPayload,
                }
              : null,
          orderEvent: {
            eventId: orderEvent.id,
            liveId,
            sequence: orderEvent.sequence,
            type: 'order.status.changed',
            occurredAt: orderEvent.occurredAt.toISOString(),
            payload: { order: orderDto },
          },
          adminOrderEvent: {
            eventId: adminOrderEvent.id,
            liveId,
            sequence: adminOrderEvent.sequence,
            type: 'order.created',
            occurredAt: adminOrderEvent.occurredAt.toISOString(),
            payload: { order: adminOrderDto },
          },
        } as const;
      });
    } catch (error: unknown) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const persistedOrder = await prisma.order.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey,
          },
        },
        include: orderRecordInclude,
      });

      if (!persistedOrder) {
        throw error;
      }

      return { kind: 'idempotent', order: toOrderDto(persistedOrder) } as const;
    }
  },

  async getViewerOrder({ orderId, userId }) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: orderRecordInclude,
    });

    if (!order) {
      return { kind: 'order_not_found' } as const;
    }

    return { kind: 'found', order: toOrderDto(order) } as const;
  },

  async getRecentOrders(liveId, query) {
    const [live, orders] = await Promise.all([
      prisma.liveSession.findUnique({ where: { id: liveId }, select: { id: true } }),
      prisma.order.findMany({
        where: { liveId },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        include: adminOrderRecordInclude,
      }),
    ]);

    if (!live) {
      return { kind: 'live_not_found' } as const;
    }

    return {
      kind: 'found',
      orders: orders.map(toAdminOrderDto),
    } as const;
  },

  async hideMessage({ liveId, messageId, actorId, reason }) {
    return prisma.$transaction(async (transaction) => {
      const live = await transaction.liveSession.findUnique({
        where: { id: liveId },
        select: { id: true },
      });

      if (!live) {
        return { kind: 'live_not_found' } as const;
      }

      const message = await transaction.chatMessage.findFirst({
        where: {
          id: messageId,
          room: { liveId },
        },
        select: {
          id: true,
          visibility: true,
        },
      });

      if (!message) {
        return { kind: 'message_not_found' } as const;
      }

      if (message.visibility === 'HIDDEN') {
        return { kind: 'already_hidden' } as const;
      }

      const updateResult = await transaction.chatMessage.updateMany({
        where: {
          id: message.id,
          visibility: 'VISIBLE',
        },
        data: { visibility: 'HIDDEN' },
      });

      if (updateResult.count === 0) {
        return { kind: 'already_hidden' } as const;
      }

      const updatedLive = await transaction.liveSession.update({
        where: { id: liveId },
        data: { nextEventSequence: { increment: 1 } },
        select: { nextEventSequence: true },
      });
      const eventPayload = { messageId: message.id };
      const event = await transaction.realtimeEvent.create({
        data: {
          liveId,
          sequence: updatedLive.nextEventSequence - 1,
          type: 'chat.message.hidden',
          payloadJson: eventPayload,
        },
      });

      await transaction.auditLog.create({
        data: {
          liveId,
          actorId,
          action: 'CHAT_MESSAGE_HIDDEN',
          entityType: 'CHAT_MESSAGE',
          entityId: message.id,
          beforeJson: { visibility: 'VISIBLE' },
          afterJson: { visibility: 'HIDDEN' },
          reason,
        },
      });

      return {
        kind: 'hidden',
        event: {
          eventId: event.id,
          liveId,
          sequence: event.sequence,
          type: 'chat.message.hidden',
          occurredAt: event.occurredAt.toISOString(),
          payload: eventPayload,
        },
      } as const;
    });
  },

  async timeoutUser({ liveId, userId, actorId, durationMinutes, reason }) {
    return prisma.$transaction(async (transaction) => {
      const live = await transaction.liveSession.findUnique({
        where: { id: liveId },
        select: { id: true },
      });

      if (!live) {
        return { kind: 'live_not_found' } as const;
      }

      const targetUser = await transaction.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });

      if (!targetUser) {
        return { kind: 'user_not_found' } as const;
      }

      if (targetUser.role !== 'VIEWER') {
        return { kind: 'user_not_timeoutable' } as const;
      }

      const now = new Date();
      const previousTimeout = await transaction.chatTimeout.findFirst({
        where: {
          liveId,
          userId,
          expiresAt: { gt: now },
        },
        orderBy: { expiresAt: 'desc' },
        select: { expiresAt: true },
      });
      const timeoutStartAt = previousTimeout?.expiresAt ?? now;
      const expiresAt = new Date(timeoutStartAt.getTime() + durationMinutes * 60_000);

      const timeout = await transaction.chatTimeout.create({
        data: {
          liveId,
          userId,
          actorId,
          reason,
          expiresAt,
        },
        select: { id: true },
      });
      const updatedLive = await transaction.liveSession.update({
        where: { id: liveId },
        data: { nextEventSequence: { increment: 1 } },
        select: { nextEventSequence: true },
      });
      const eventPayload = {
        userId,
        expiresAt: expiresAt.toISOString(),
      };
      const event = await transaction.realtimeEvent.create({
        data: {
          liveId,
          sequence: updatedLive.nextEventSequence - 1,
          type: 'chat.user.timed_out',
          payloadJson: eventPayload,
        },
      });

      await transaction.auditLog.create({
        data: {
          liveId,
          actorId,
          action: 'CHAT_USER_TIMED_OUT',
          entityType: 'USER',
          entityId: timeout.id,
          beforeJson: {
            timeoutExpiresAt: previousTimeout?.expiresAt.toISOString() ?? null,
          },
          afterJson: {
            userId,
            timeoutExpiresAt: eventPayload.expiresAt,
            durationMinutes,
          },
          reason,
        },
      });

      return {
        kind: 'timed_out',
        event: {
          eventId: event.id,
          liveId,
          sequence: event.sequence,
          type: 'chat.user.timed_out',
          occurredAt: event.occurredAt.toISOString(),
          payload: eventPayload,
        },
      } as const;
    });
  },

  async publishCoupon({ liveId, actorId, type, value, minOrderAmountKrw, endsAt, usageLimit }) {
    const parsedEndsAt = new Date(endsAt);
    if (!Number.isFinite(parsedEndsAt.getTime()) || parsedEndsAt.getTime() <= Date.now()) {
      return { kind: 'coupon_not_publishable' } as const;
    }

    return prisma.$transaction(async (transaction) => {
      // Incrementing the live sequence first locks this broadcast so two admins cannot leave
      // different coupons published at the same time.
      const updatedLive = await transaction.liveSession
        .update({
          where: { id: liveId },
          data: { nextEventSequence: { increment: 1 } },
          select: { nextEventSequence: true },
        })
        .catch((error: unknown) => {
          if (isRecordNotFoundError(error)) {
            return null;
          }

          throw error;
        });

      if (!updatedLive) {
        return { kind: 'live_not_found' } as const;
      }

      const previousCoupon = await transaction.coupon.findFirst({
        where: { liveId, status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      await transaction.coupon.updateMany({
        where: { liveId, status: 'PUBLISHED' },
        data: { status: 'DISABLED' },
      });
      const startsAt = new Date();
      const coupon = await transaction.coupon.create({
        data: {
          liveId,
          type,
          value,
          minOrderAmountKrw,
          startsAt,
          endsAt: parsedEndsAt,
          usageLimit,
        },
      });
      const couponDto = toCouponDto(coupon);
      const event = await transaction.realtimeEvent.create({
        data: {
          liveId,
          sequence: updatedLive.nextEventSequence - 1,
          type: 'coupon.published',
          payloadJson: { coupon: couponDto },
        },
      });

      await transaction.auditLog.create({
        data: {
          liveId,
          actorId,
          action: 'COUPON_PUBLISHED',
          entityType: 'COUPON',
          entityId: coupon.id,
          beforeJson: { activeCouponId: previousCoupon?.id ?? null },
          afterJson: {
            type: couponDto.type,
            value: couponDto.value,
            minOrderAmountKrw: couponDto.minOrderAmountKrw,
            startsAt: couponDto.startsAt,
            endsAt: couponDto.endsAt,
            usageLimit: couponDto.usageLimit,
          },
        },
      });

      return {
        kind: 'published',
        event: {
          eventId: event.id,
          liveId,
          sequence: event.sequence,
          type: 'coupon.published',
          occurredAt: event.occurredAt.toISOString(),
          payload: { coupon: couponDto },
        },
      } as const;
    });
  },

  async publishAnnouncement({ liveId, actorId, content }) {
    return prisma.$transaction(async (transaction) => {
      // Advancing the sequence serializes announcements from concurrent admins before they reach
      // the public room.
      const updatedLive = await transaction.liveSession
        .update({
          where: { id: liveId },
          data: { nextEventSequence: { increment: 1 } },
          select: { nextEventSequence: true },
        })
        .catch((error: unknown) => {
          if (isRecordNotFoundError(error)) {
            return null;
          }

          throw error;
        });

      if (!updatedLive) {
        return { kind: 'live_not_found' } as const;
      }

      const announcement = await transaction.announcement.create({
        data: {
          liveId,
          content,
          createdById: actorId,
          sourceSuggestionId: null,
        },
      });
      const announcementDto = toAnnouncementDto(announcement);
      const event = await transaction.realtimeEvent.create({
        data: {
          liveId,
          sequence: updatedLive.nextEventSequence - 1,
          type: 'announcement.published',
          payloadJson: { announcement: announcementDto },
        },
      });

      await transaction.auditLog.create({
        data: {
          liveId,
          actorId,
          action: 'ANNOUNCEMENT_PUBLISHED',
          entityType: 'ANNOUNCEMENT',
          entityId: announcement.id,
          afterJson: {
            content: announcementDto.content,
            sourceSuggestionId: null,
          },
        },
      });

      return {
        kind: 'published',
        event: {
          eventId: event.id,
          liveId,
          sequence: event.sequence,
          type: 'announcement.published',
          occurredAt: event.occurredAt.toISOString(),
          payload: { announcement: announcementDto },
        },
      } as const;
    });
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

      if (productId) {
        const liveProduct = await transaction.liveProduct.findUnique({
          where: {
            liveId_productId: {
              liveId,
              productId,
            },
          },
          select: { productId: true },
        });

        if (!liveProduct) {
          return { kind: 'product_not_available' } as const;
        }
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

  async createNextLiveSession({ sourceLiveId, actorId }) {
    return prisma.$transaction(async (transaction) => {
      const sourceLive = await transaction.liveSession.findUnique({
        where: { id: sourceLiveId },
        select: {
          featuredProductId: true,
          status: true,
          title: true,
        },
      });

      if (!sourceLive) {
        return { kind: 'live_not_found' } as const;
      }

      if (sourceLive.status !== 'ENDED') {
        return { kind: 'source_live_not_ended' } as const;
      }

      const nextLive = await transaction.liveSession.create({
        data: {
          chatRoom: { create: {} },
          createdById: actorId,
          featuredProductId: sourceLive.featuredProductId,
          status: 'READY',
          title: sourceLive.title,
        },
        select: {
          endedAt: true,
          id: true,
          startedAt: true,
          status: true,
          title: true,
        },
      });
      const live = toLiveSessionDto(nextLive);

      await transaction.auditLog.create({
        data: {
          action: 'LIVE_SESSION_CREATED',
          actorId,
          afterJson: {
            featuredProductId: sourceLive.featuredProductId,
            status: live.status,
          },
          beforeJson: { sourceLiveId },
          entityId: live.id,
          entityType: 'LIVE_SESSION',
          liveId: live.id,
        },
      });

      return { kind: 'created', live } as const;
    });
  },

  async changeLiveStatus({ liveId, actorId, action }) {
    const transition = getStatusTransition(action);
    const occurredAt = new Date();

    return prisma.$transaction(async (transaction) => {
      const liveBefore = await transaction.liveSession.findUnique({
        where: { id: liveId },
        select: {
          id: true,
          status: true,
          scheduledStartAt: true,
          startedAt: true,
          endedAt: true,
        },
      });

      if (!liveBefore) {
        return { kind: 'live_not_found' } as const;
      }

      if (liveBefore.status !== transition.expectedStatus) {
        return { kind: 'invalid_status_transition' } as const;
      }

      if (action === 'SCHEDULE') {
        const liveProductCount = await transaction.liveProduct.count({ where: { liveId } });
        if (
          !liveBefore.scheduledStartAt ||
          liveBefore.scheduledStartAt.getTime() <= occurredAt.getTime() ||
          liveProductCount === 0
        ) {
          return { kind: 'schedule_requirements_not_met' } as const;
        }
      }

      if (action === 'PREPARE' || action === 'START') {
        const liveProducts = await transaction.liveProduct.findMany({
          where: { liveId },
          include: {
            product: {
              select: {
                variants: {
                  select: { stock: true },
                },
              },
            },
          },
        });
        const hasUnsellableProduct = liveProducts.some(
          (liveProduct) => !liveProduct.product.variants.some((variant) => variant.stock > 0),
        );

        if (liveProducts.length === 0 || hasUnsellableProduct) {
          return { kind: 'preparation_requirements_not_met' } as const;
        }
      }

      const statusUpdate = await transaction.liveSession.updateMany({
        where: { id: liveId, status: transition.expectedStatus },
        data: {
          status: transition.nextStatus,
          nextEventSequence: { increment: 1 },
          ...(action === 'START' ? { startedAt: occurredAt } : {}),
          ...(action === 'END' ? { endedAt: occurredAt } : {}),
        },
      });

      if (statusUpdate.count === 0) {
        return { kind: 'invalid_status_transition' } as const;
      }

      const liveAfter = await transaction.liveSession.findUnique({
        where: { id: liveId },
        select: {
          id: true,
          title: true,
          status: true,
          startedAt: true,
          endedAt: true,
          nextEventSequence: true,
        },
      });

      if (!liveAfter) {
        throw new Error('Live session disappeared after its status was updated.');
      }

      const liveDto = toLiveSessionDto(liveAfter);
      const event = await transaction.realtimeEvent.create({
        data: {
          liveId,
          sequence: liveAfter.nextEventSequence - 1,
          type: 'live.status.changed',
          payloadJson: { live: liveDto },
          occurredAt,
        },
      });

      await transaction.auditLog.create({
        data: {
          liveId,
          actorId,
          action: transition.auditAction,
          entityType: 'LIVE_SESSION',
          entityId: liveId,
          beforeJson: {
            status: liveBefore.status,
            scheduledStartAt: liveBefore.scheduledStartAt?.toISOString() ?? null,
            startedAt: liveBefore.startedAt?.toISOString() ?? null,
            endedAt: liveBefore.endedAt?.toISOString() ?? null,
          },
          afterJson: {
            status: liveDto.status,
            scheduledStartAt: liveBefore.scheduledStartAt?.toISOString() ?? null,
            startedAt: liveDto.startedAt,
            endedAt: liveDto.endedAt,
          },
        },
      });

      return {
        kind: 'changed',
        event: {
          eventId: event.id,
          liveId,
          sequence: event.sequence,
          type: 'live.status.changed',
          occurredAt: event.occurredAt.toISOString(),
          payload: { live: liveDto },
        },
      } as const;
    });
  },

  async getAuditLogs(liveId, query) {
    const [live, rows] = await Promise.all([
      prisma.liveSession.findUnique({
        where: { id: liveId },
        select: { id: true },
      }),
      prisma.auditLog.findMany({
        where: { liveId },
        select: {
          id: true,
          liveId: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          actor: {
            select: {
              id: true,
              nickname: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor
          ? {
              cursor: { id: query.cursor },
              skip: 1,
            }
          : {}),
      }),
    ]);

    if (!live) {
      return { kind: 'live_not_found' } as const;
    }

    const hasMore = rows.length > query.limit;
    const logs = rows.slice(0, query.limit).map(toAuditLogDto);
    const lastLog = logs.at(-1);

    return {
      kind: 'found',
      page: {
        logs,
        nextCursor: hasMore && lastLog ? lastLog.id : null,
      },
    } as const;
  },

  async getAiSuggestions(liveId) {
    const [live, suggestions] = await Promise.all([
      prisma.liveSession.findUnique({ where: { id: liveId }, select: { id: true } }),
      prisma.aiSuggestion.findMany({
        where: { liveId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    if (!live) {
      return { kind: 'live_not_found' } as const;
    }

    return {
      kind: 'found',
      suggestions: suggestions.map(toAiSuggestionDto),
    } as const;
  },

  async createAiSuggestion({ liveId, actorId, inputHash, output }) {
    return prisma.$transaction(async (transaction) => {
      const live = await transaction.liveSession.findUnique({
        where: { id: liveId },
        select: { id: true },
      });

      if (!live) {
        return { kind: 'live_not_found' } as const;
      }

      const suggestion = await transaction.aiSuggestion.create({
        data: {
          liveId,
          type: 'CHAT_SUMMARY',
          provider: 'mock',
          modelOrMockVersion: 'chat-summary-v1',
          inputHash,
          outputJson: output,
        },
      });
      const suggestionDto = toAiSuggestionDto(suggestion);
      const updatedLive = await transaction.liveSession.update({
        where: { id: liveId },
        data: { nextEventSequence: { increment: 1 } },
        select: { nextEventSequence: true },
      });
      const event = await transaction.realtimeEvent.create({
        data: {
          liveId,
          sequence: updatedLive.nextEventSequence - 1,
          type: 'ai.suggestion.created',
          payloadJson: { suggestion: suggestionDto },
        },
      });

      await transaction.auditLog.create({
        data: {
          liveId,
          actorId,
          action: 'AI_SUGGESTION_CREATED',
          entityType: 'AI_SUGGESTION',
          entityId: suggestion.id,
          afterJson: {
            inputHash,
            provider: suggestionDto.provider,
            type: suggestionDto.type,
          },
        },
      });

      return {
        kind: 'created',
        suggestion: suggestionDto,
        event: {
          eventId: event.id,
          liveId,
          sequence: event.sequence,
          type: 'ai.suggestion.created',
          occurredAt: event.occurredAt.toISOString(),
          payload: { suggestion: suggestionDto },
        },
      } as const;
    });
  },

  async reviewAiSuggestion({
    suggestionId,
    actorId,
    action,
    editedOutput,
    announcementContent,
    reason,
  }) {
    return prisma.$transaction(async (transaction) => {
      const suggestion = await transaction.aiSuggestion.findUnique({
        where: { id: suggestionId },
      });

      if (!suggestion) {
        return { kind: 'suggestion_not_found' } as const;
      }

      if (suggestion.status !== 'PENDING') {
        return { kind: 'suggestion_not_reviewable' } as const;
      }

      const originalOutput = aiChatSummarySchema.parse(suggestion.outputJson);
      const output = editedOutput ?? originalOutput;
      const reviewedAt = new Date();
      const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const updatedCount = await transaction.aiSuggestion.updateMany({
        where: { id: suggestionId, status: 'PENDING' },
        data: {
          outputJson: output,
          status,
          reviewedById: actorId,
          reviewedAt,
        },
      });

      if (updatedCount.count === 0) {
        return { kind: 'suggestion_not_reviewable' } as const;
      }

      const reviewedSuggestion = await transaction.aiSuggestion.findUnique({
        where: { id: suggestionId },
      });
      if (!reviewedSuggestion) {
        throw new Error('AI suggestion disappeared after review.');
      }

      const reviewedSuggestionDto = toAiSuggestionDto(reviewedSuggestion);
      const hasEditedOutput = editedOutput !== undefined;

      if (hasEditedOutput) {
        await transaction.auditLog.create({
          data: {
            liveId: suggestion.liveId,
            actorId,
            action: 'AI_SUGGESTION_EDITED',
            entityType: 'AI_SUGGESTION',
            entityId: suggestionId,
            beforeJson: originalOutput,
            afterJson: output,
          },
        });
      }

      if (action === 'REJECT') {
        await transaction.auditLog.create({
          data: {
            liveId: suggestion.liveId,
            actorId,
            action: 'AI_SUGGESTION_REJECTED',
            entityType: 'AI_SUGGESTION',
            entityId: suggestionId,
            beforeJson: { status: suggestion.status },
            afterJson: { status: reviewedSuggestionDto.status },
            reason: reason ?? null,
          },
        });

        return { kind: 'rejected', suggestion: reviewedSuggestionDto } as const;
      }

      if (!announcementContent) {
        throw new Error('Approved AI suggestions require announcement content.');
      }

      const announcement = await transaction.announcement.create({
        data: {
          liveId: suggestion.liveId,
          content: announcementContent,
          createdById: actorId,
          sourceSuggestionId: suggestionId,
        },
      });
      const announcementDto = toAnnouncementDto(announcement);
      const updatedLive = await transaction.liveSession.update({
        where: { id: suggestion.liveId },
        data: { nextEventSequence: { increment: 1 } },
        select: { nextEventSequence: true },
      });
      const event = await transaction.realtimeEvent.create({
        data: {
          liveId: suggestion.liveId,
          sequence: updatedLive.nextEventSequence - 1,
          type: 'announcement.published',
          payloadJson: { announcement: announcementDto },
        },
      });

      await transaction.auditLog.create({
        data: {
          liveId: suggestion.liveId,
          actorId,
          action: 'AI_SUGGESTION_APPROVED',
          entityType: 'AI_SUGGESTION',
          entityId: suggestionId,
          beforeJson: { status: suggestion.status },
          afterJson: {
            announcementId: announcement.id,
            announcementContent,
            status: reviewedSuggestionDto.status,
          },
        },
      });

      await transaction.auditLog.create({
        data: {
          liveId: suggestion.liveId,
          actorId,
          action: 'ANNOUNCEMENT_PUBLISHED',
          entityType: 'ANNOUNCEMENT',
          entityId: announcement.id,
          afterJson: {
            sourceSuggestionId: suggestionId,
            content: announcementContent,
          },
        },
      });

      return {
        kind: 'approved',
        suggestion: reviewedSuggestionDto,
        event: {
          eventId: event.id,
          liveId: suggestion.liveId,
          sequence: event.sequence,
          type: 'announcement.published',
          occurredAt: event.occurredAt.toISOString(),
          payload: { announcement: announcementDto },
        },
      } as const;
    });
  },
};
