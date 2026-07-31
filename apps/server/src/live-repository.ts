import type {
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
  InventoryUpdatedEvent,
  LiveSnapshot,
  Order,
  OrderStatusChangedEvent,
  Product,
  ProductFeaturedEvent,
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
      couponEvent: CouponRedeemedEvent | null;
      orderEvent: OrderStatusChangedEvent;
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

export interface LiveRepository {
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
): LiveSnapshot {
  return {
    live: {
      id: live.id,
      title: live.title,
      status: live.status,
      startedAt: live.startedAt?.toISOString() ?? null,
      endedAt: live.endedAt?.toISOString() ?? null,
    },
    featuredProduct: live.featuredProduct ? toProductDto(live.featuredProduct) : null,
    activeCoupon: activeCoupon ? toCouponDto(activeCoupon) : null,
    products: products.map(toProductDto),
    lastEventSequence: live.nextEventSequence - 1,
    chat: toChatPage(chatRoom, live.id),
  };
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

export const prismaLiveRepository: LiveRepository = {
  async getSnapshot(liveId) {
    const now = new Date();
    const [live, products, chatRoom, activeCoupon] = await Promise.all([
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
    ]);

    return live ? toSnapshot(live, products, chatRoom, activeCoupon) : null;
  },

  async getMessages(liveId, query) {
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { liveId },
      select: {
        id: true,
        nextSequence: true,
      },
    });

    if (!chatRoom) {
      const live = await prisma.liveSession.findUnique({
        where: { id: liveId },
        select: { id: true },
      });

      return live ? toChatPage(null, liveId) : null;
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
      select: { id: true },
    });

    if (!live) {
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
          transaction.user.findUnique({ where: { id: userId }, select: { id: true } }),
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

        const eventCount = redeemedCoupon ? 3 : 2;
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
            sequence: updatedLive.nextEventSequence - 1,
            type: 'order.status.changed',
            payloadJson: { order: orderDto },
            occurredAt,
          },
        });

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
          orderEvent: {
            eventId: orderEvent.id,
            liveId,
            sequence: orderEvent.sequence,
            type: 'order.status.changed',
            occurredAt: orderEvent.occurredAt.toISOString(),
            payload: { order: orderDto },
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
