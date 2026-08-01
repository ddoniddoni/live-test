import { ChatMessageType, LiveStatus, PrismaClient, Role } from '@prisma/client';

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
      id: 'demo',
      title: 'LiveFlow 데모 방송',
      status: LiveStatus.READY,
      featuredProductId: 'soft-knit',
      chatRoom: {
        create: {
          id: 'demo-chat',
          nextSequence: 4,
          messages: {
            create: [
              {
                id: 'demo-message-1',
                senderId: admin.id,
                clientMessageId: '00000000-0000-4000-8000-000000000001',
                sequence: 1,
                type: ChatMessageType.ADMIN,
                content: '안녕하세요! 오늘 소개 상품에 대해 편하게 질문해 주세요.',
              },
              {
                id: 'demo-message-2',
                senderId: viewer.id,
                clientMessageId: '00000000-0000-4000-8000-000000000002',
                sequence: 2,
                type: ChatMessageType.USER,
                content: '니트는 어떤 계절에 입기 좋은가요?',
              },
              {
                id: 'demo-message-3',
                senderId: admin.id,
                clientMessageId: '00000000-0000-4000-8000-000000000003',
                sequence: 3,
                type: ChatMessageType.ADMIN,
                content: '가벼운 여름 원사라 실내 냉방이나 초가을까지 활용하기 좋습니다.',
              },
            ],
          },
        },
      },
    },
  });

  console.info(`Seeded LiveFlow demo users, including ${admin.nickname}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error('Failed to seed the LiveFlow database.', error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
