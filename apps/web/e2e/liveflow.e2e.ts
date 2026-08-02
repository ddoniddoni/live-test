import { expect, test } from '@playwright/test';

test('운영자 변경과 시청자 채팅·주문이 두 브라우저에 실시간으로 반영된다', async ({ browser }) => {
  const viewerContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  const adminPage = await adminContext.newPage();
  const message = `E2E 채팅 ${Date.now()}`;

  try {
    await Promise.all([viewerPage.goto('/live/demo'), adminPage.goto('/admin/lives/demo')]);

    await expect(viewerPage.getByText('실시간 연결됨')).toBeVisible();
    await expect(viewerPage.getByText('라이브 시작 대기 중')).toBeVisible();
    await expect(viewerPage.getByRole('heading', { name: '실시간 채팅' })).toHaveCount(0);
    await expect(adminPage.getByRole('heading', { name: '운영자 컨트롤룸' })).toBeVisible();
    await expect(adminPage.locator('.admin-shell')).toHaveCount(0);
    await adminPage.getByLabel('관리자 비밀번호').fill(readAdminPassword());
    await adminPage.getByRole('button', { name: '운영자 화면 열기' }).click();
    await expect(adminPage.locator('.admin-shell')).toBeVisible();
    await expect(adminPage.getByText('관리자 인증됨')).toBeVisible();
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

    const orderForm = viewerPage.locator('.mock-order-default');
    await orderForm.getByRole('button', { name: 'Mock 주문 확정' }).click();
    await expect(orderForm.getByText('Mock 주문이 확정되었습니다')).toBeVisible();
    await expect(adminPage.locator('.recent-order-list')).toContainText('Demo Viewer');
    await expect(adminPage.locator('.inventory-low-alert')).toContainText('데일리 미니 토트백');
    await expect(adminPage.locator('.inventory-low-alert')).toContainText('4개 남음');
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
