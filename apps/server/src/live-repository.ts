import type {
  ChatMessage,
  ChatMessageCreatedEvent,
  ChatMessagePage,
  ChatMessagesQuery,
  LiveSnapshot,
  Product,
  ProductFeaturedEvent,
} from '@liveflow/contracts';
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
    };

export interface LiveRepository {
  getSnapshot(liveId: string): Promise<LiveSnapshot | null>;
  getMessages(liveId: string, query: ChatMessagesQuery): Promise<ChatMessagePage | null>;
  createMessage(input: {
    liveId: string;
    senderId: string;
    senderRole: ChatMessage['sender']['role'];
    clientMessageId: string;
    content: string;
  }): Promise<CreateChatMessageResult>;
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

const visibleMessageInclude = {
  sender: {
    select: {
      id: true,
      nickname: true,
      role: true,
    },
  },
} as const;

export const prismaLiveRepository: LiveRepository = {
  async getSnapshot(liveId) {
    const [live, products, chatRoom] = await Promise.all([
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
    ]);

    return live ? toSnapshot(live, products, chatRoom) : null;
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
