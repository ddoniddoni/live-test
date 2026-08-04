import { expect, test } from '@playwright/test';

test('새 방송 준비와 운영 변경이 시청자에게 실시간으로 반영된다', async ({ browser }) => {
  const viewerContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  const adminPage = await adminContext.newPage();
  const liveTitle = `E2E 방송 ${Date.now()}`;
  const message = `E2E 채팅 ${Date.now()}`;

  try {
    await adminPage.goto('/admin/lives/new');
    await expect(adminPage.getByRole('heading', { name: '운영자 화면' })).toBeVisible();
    await adminPage.getByLabel('관리자 비밀번호').fill(readAdminPassword());
    await adminPage.getByRole('button', { name: '운영자 화면 열기' }).click();
    await expect(adminPage.getByText('관리자 인증됨')).toBeVisible();

    await adminPage.getByLabel('방송 제목').fill(liveTitle);
    await adminPage
      .getByLabel('방송 설명')
      .fill('새 방송 생성부터 실시간 운영까지 확인하는 Playwright 시나리오입니다.');
    await adminPage.getByLabel('예정 시작 시각').fill(createFutureDatetimeLocalValue());
    await adminPage.getByRole('button', { name: '초안 만들기' }).click();

    await expect(adminPage).toHaveURL(/\/admin\/lives\/[^/]+$/);
    await expect(adminPage.getByRole('heading', { name: liveTitle })).toBeVisible();
    await expect(adminPage.getByRole('heading', { name: '판매 상품과 노출 순서' })).toBeVisible();

    await adminPage.getByRole('checkbox', { name: /소프트 릴랙스 니트/ }).check();
    await adminPage.getByRole('checkbox', { name: /데일리 미니 토트백/ }).check();
    await adminPage.getByRole('button', { name: '상품 목록 저장' }).click();
    await expect(adminPage.getByRole('button', { name: '방송 예정으로 전환' })).toBeEnabled();
    await adminPage.getByRole('button', { name: '방송 예정으로 전환' }).click();
    await expect(
      adminPage.getByRole('heading', { name: '판매 가능 상태를 확인해 방송 준비를 완료하세요.' }),
    ).toBeVisible();

    const liveId = getLiveIdFromAdminUrl(adminPage.url());
    await viewerPage.goto(`/live/${liveId}`);
    await expect(viewerPage.getByText('실시간 연결됨')).toBeVisible();
    await expect(viewerPage.getByRole('heading', { name: '라이브 시작 대기 중' })).toBeVisible();
    await expect(viewerPage.getByRole('heading', { name: '실시간 채팅' })).toHaveCount(0);

    await adminPage.getByRole('button', { name: '준비 완료 · 컨트롤룸 열기' }).click();
    await expect(adminPage.locator('.admin-shell')).toBeVisible();
    await expect(adminPage.getByText('실시간 연결됨')).toBeVisible();

    await adminPage.getByRole('button', { name: '방송 시작' }).click();
    await expect(adminPage.getByRole('button', { name: '방송 종료' })).toBeVisible();
    await expect(viewerPage.getByText('실시간 시연 중')).toBeVisible();
    await expect(viewerPage.getByRole('heading', { name: '실시간 채팅' })).toBeVisible();
    await expect(viewerPage.locator('.chat-virtual-row').first()).toBeVisible();
    await expect.poll(() => viewerPage.locator('.chat-virtual-row').count()).toBeLessThan(100);
    await expect(viewerPage.getByText('MOCK LIVE')).toBeVisible();
    await expect(viewerPage.getByLabel(/Mock live 재생 위치/)).toBeVisible();

    const dailyBagControl = adminPage
      .locator('.admin-product')
      .filter({ hasText: '데일리 미니 토트백' });
    await dailyBagControl.getByRole('button', { name: '소개하기' }).click();
    await expect(viewerPage.locator('.featured-product')).toContainText('데일리 미니 토트백');

    const viewerChatInput = viewerPage.getByLabel('메시지 입력');
    await viewerChatInput.fill(message);
    await viewerChatInput.press('Enter');
    await expect(viewerPage.getByText(message)).toBeVisible();
    await expect(adminPage.getByText(message)).toBeVisible();

    const moderationRow = adminPage.locator('.chat-virtual-row').filter({ hasText: message });
    await moderationRow.getByRole('button', { name: '메시지 숨기기' }).click();
    await moderationRow.getByPlaceholder('숨김 사유를 입력하세요').fill('E2E 운영자 숨김');
    await moderationRow.getByRole('button', { name: '숨김 적용' }).click();
    await expect(adminPage.getByText(message)).toHaveCount(0);
    await expect(viewerPage.getByText(message)).toHaveCount(0);

    const orderForm = viewerPage.locator('.mock-order-default');
    await orderForm.getByRole('button', { name: 'Mock 주문 확정' }).click();
    await expect(orderForm.getByText('Mock 주문이 확정되었습니다')).toBeVisible();
    await expect(adminPage.locator('.recent-order-list')).toContainText('Demo Viewer');
    await expect(adminPage.locator('.inventory-low-alert')).toContainText('데일리 미니 토트백');
    await expect(adminPage.locator('.inventory-low-alert')).toContainText('4개 남음');

    await adminPage.getByRole('button', { name: '방송 종료' }).click();
    await expect(
      viewerPage.getByRole('heading', { name: '라이브가 종료되었습니다' }),
    ).toBeVisible();
    await expect(viewerPage.getByRole('heading', { name: '실시간 채팅' })).toHaveCount(0);
  } finally {
    await Promise.all([viewerContext.close(), adminContext.close()]);
  }
});

function readAdminPassword(): string {
  const password = process.env.E2E_DEMO_ADMIN_PASSWORD;

  if (!password) {
    throw new Error('E2E_DEMO_ADMIN_PASSWORD must be configured before running E2E tests.');
  }

  return password;
}

function createFutureDatetimeLocalValue(): string {
  const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const timezoneOffsetMs = futureDate.getTimezoneOffset() * 60 * 1000;

  return new Date(futureDate.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function getLiveIdFromAdminUrl(value: string): string {
  const liveId = new URL(value).pathname.split('/').at(-1);
  if (!liveId) {
    throw new Error('새 방송 URL에서 방송 ID를 찾을 수 없습니다.');
  }

  return liveId;
}
