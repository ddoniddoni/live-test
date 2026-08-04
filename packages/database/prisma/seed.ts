import { LiveStatus, PrismaClient, Role } from '@prisma/client';

import { DEMO_CHAT_MESSAGE_COUNT, createDemoChatMessages } from './demo-chat-seed.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.realtimeEvent.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatRoom.deleteMany();
  await prisma.chatTimeout.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.liveSession.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      id: 'demo-admin',
      nickname: 'LiveFlow Admin',
      role: Role.ADMIN,
    },
  });

  const viewer = await prisma.user.create({
    data: {
      id: 'demo-viewer',
      nickname: 'Demo Viewer',
      role: Role.VIEWER,
    },
  });

  await prisma.product.create({
    data: {
      id: 'soft-knit',
      name: '소프트 릴랙스 니트',
      description: '피부에 부드럽게 닿는 여름용 릴랙스 핏 니트입니다.',
      priceKrw: 39000,
      variants: {
        create: [
          { id: 'soft-knit-s', name: 'S', stock: 8 },
          { id: 'soft-knit-m', name: 'M', stock: 12 },
          { id: 'soft-knit-l', name: 'L', stock: 6 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      id: 'linen-shirt',
      name: '에어리 린넨 셔츠',
      description: '통기성이 좋은 린넨 혼방 소재의 오버핏 셔츠입니다.',
      priceKrw: 49000,
      variants: {
        create: [
          { id: 'linen-shirt-m', name: 'M', stock: 10 },
          { id: 'linen-shirt-l', name: 'L', stock: 4 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      id: 'daily-bag',
      name: '데일리 미니 토트백',
      description: '휴대품을 가볍게 담기 좋은 생활 방수 미니 토트백입니다.',
      priceKrw: 32000,
      variants: {
        create: [
          { id: 'daily-bag-black', name: '블랙', stock: 5 },
          { id: 'daily-bag-ivory', name: '아이보리', stock: 7 },
        ],
      },
    },
  });

  await prisma.liveSession.create({
    data: {
      createdById: admin.id,
      description:
        '가벼운 여름 스타일과 실용적인 데일리 아이템을 소개하는 LiveFlow 대표 방송입니다.',
      id: 'demo',
      scheduledStartAt: new Date('2026-08-04T09:00:00.000Z'),
      title: 'LiveFlow 데모 방송',
      status: LiveStatus.READY,
      featuredProductId: 'soft-knit',
      liveProducts: {
        create: [
          { productId: 'soft-knit', displayOrder: 0 },
          { productId: 'linen-shirt', displayOrder: 1 },
          { productId: 'daily-bag', displayOrder: 2 },
        ],
      },
      chatRoom: {
        create: {
          id: 'demo-chat',
          nextSequence: DEMO_CHAT_MESSAGE_COUNT + 1,
        },
      },
    },
  });

  await prisma.liveSession.create({
    data: {
      createdById: admin.id,
      description: '방송 준비가 끝나면 판매 상품과 진행 구성을 추가할 운영자 초안입니다.',
      id: 'demo-autumn-draft',
      scheduledStartAt: new Date('2026-09-01T11:00:00.000Z'),
      title: '가을 라이브 기획 초안',
      status: LiveStatus.DRAFT,
      chatRoom: {
        create: {
          id: 'demo-autumn-draft-chat',
        },
      },
    },
  });

  await prisma.chatMessage.createMany({
    data: createDemoChatMessages('demo-chat', admin.id, viewer.id),
  });

  console.info(
    `Seeded LiveFlow demo users and ${DEMO_CHAT_MESSAGE_COUNT} chat messages, including ${admin.nickname}.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error('Failed to seed the LiveFlow database.', error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
