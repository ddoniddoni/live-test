'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminLiveSession, Product } from '@liveflow/contracts';

import { ScreenState } from '@/components/screen-state';
import {
  ApiRequestError,
  adminLiveQueryKey,
  fetchLiveProducts,
  fetchProductCatalog,
  liveProductsQueryKey,
  prepareLive,
  productCatalogQueryKey,
  replaceLiveProducts,
  scheduleLive,
} from '@/lib/live-api';

type BroadcastPreparationPanelProps = {
  accessToken: string;
  live: AdminLiveSession;
};

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const krwFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

function formatKrw(amount: number): string {
  return krwFormatter.format(amount);
}

function getMutationError(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

function areSameProductOrder(left: string[], right: string[]): boolean {
  return (
    left.length === right.length && left.every((productId, index) => productId === right[index])
  );
}

function getSelectedProducts(productIds: string[], catalogProducts: Product[]): Product[] {
  const productsById = new Map(catalogProducts.map((product) => [product.id, product]));
  const selectedProducts: Product[] = [];

  for (const productId of productIds) {
    const product = productsById.get(productId);
    if (product) {
      selectedProducts.push(product);
    }
  }

  return selectedProducts;
}

export function BroadcastPreparationPanel({ accessToken, live }: BroadcastPreparationPanelProps) {
  const queryClient = useQueryClient();
  const [pendingProductIds, setPendingProductIds] = useState<string[] | null>(null);
  const catalogQuery = useQuery({
    queryKey: productCatalogQueryKey(),
    queryFn: () => fetchProductCatalog(accessToken),
  });
  const liveProductsQuery = useQuery({
    queryKey: liveProductsQueryKey(live.id),
    queryFn: () => fetchLiveProducts(live.id, accessToken),
  });
  const replaceProductsMutation = useMutation({
    mutationFn: (productIds: string[]) => replaceLiveProducts(live.id, { productIds }, accessToken),
    onSuccess: (products) => {
      queryClient.setQueryData(liveProductsQueryKey(live.id), products);
      setPendingProductIds(null);
    },
  });
  const scheduleMutation = useMutation({
    mutationFn: () => scheduleLive(live.id, accessToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminLiveQueryKey(live.id) }),
  });
  const prepareMutation = useMutation({
    mutationFn: () => prepareLive(live.id, accessToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminLiveQueryKey(live.id) }),
  });

  if (catalogQuery.isPending || liveProductsQuery.isPending) {
    return <ScreenState>판매 상품과 준비 상태를 불러오는 중입니다…</ScreenState>;
  }

  if (
    catalogQuery.isError ||
    liveProductsQuery.isError ||
    !catalogQuery.data ||
    !liveProductsQuery.data
  ) {
    return (
      <ScreenState tone="error">
        판매 상품 정보를 불러오지 못했습니다. 서버 연결을 확인한 뒤 새로고침해 주세요.
      </ScreenState>
    );
  }

  const savedProductIds = liveProductsQuery.data.map((liveProduct) => liveProduct.product.id);
  const selectedProductIds = pendingProductIds ?? savedProductIds;
  const selectedProducts = getSelectedProducts(selectedProductIds, catalogQuery.data);
  const productListChanged = !areSameProductOrder(selectedProductIds, savedProductIds);
  const selectedProductIdsSet = new Set(selectedProductIds);
  const productMutationError = replaceProductsMutation.isError
    ? getMutationError(replaceProductsMutation.error, '판매 상품 목록을 저장하지 못했습니다.')
    : null;
  const statusMutationError = scheduleMutation.isError
    ? getMutationError(scheduleMutation.error, '방송 예정 전환에 실패했습니다.')
    : prepareMutation.isError
      ? getMutationError(prepareMutation.error, '준비 점검을 완료하지 못했습니다.')
      : null;

  function updateSelectedProducts(updater: (productIds: string[]) => string[]): void {
    setPendingProductIds((currentProductIds) => updater(currentProductIds ?? savedProductIds));
  }

  function toggleProduct(productId: string): void {
    updateSelectedProducts((productIds) =>
      productIds.includes(productId)
        ? productIds.filter((currentProductId) => currentProductId !== productId)
        : [...productIds, productId],
    );
  }

  function moveProduct(productId: string, direction: -1 | 1): void {
    updateSelectedProducts((productIds) => {
      const currentIndex = productIds.indexOf(productId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= productIds.length) {
        return productIds;
      }

      const nextProductIds = [...productIds];
      const movedProductId = nextProductIds[currentIndex];
      const replacedProductId = nextProductIds[nextIndex];
      if (!movedProductId || !replacedProductId) {
        return productIds;
      }

      nextProductIds[currentIndex] = replacedProductId;
      nextProductIds[nextIndex] = movedProductId;
      return nextProductIds;
    });
  }

  function saveProducts(): void {
    replaceProductsMutation.mutate(selectedProductIds);
  }

  return (
    <main className="broadcast-preparation-shell">
      <header className="broadcast-preparation-header">
        <div>
          <Link className="admin-access-brand" href="/admin/lives">
            StreamOps <strong>Elite</strong>
          </Link>
          <p className="panel-kicker">BROADCAST PREPARATION</p>
          <h1>{live.title}</h1>
          <p>
            예정 시작{' '}
            {live.scheduledStartAt
              ? dateTimeFormatter.format(new Date(live.scheduledStartAt))
              : '미설정'}
          </p>
        </div>
        <Link className="admin-live-secondary-link" href="/admin/lives">
          방송 목록
        </Link>
      </header>

      <section
        className="broadcast-preparation-status"
        aria-labelledby="broadcast-preparation-status-heading"
      >
        <div>
          <p className="panel-kicker">STEP {live.status === 'DRAFT' ? '01' : '02'} / 02</p>
          <h2 id="broadcast-preparation-status-heading">
            {live.status === 'DRAFT'
              ? '판매 상품을 준비해 방송 일정을 등록하세요.'
              : '판매 가능 상태를 확인해 방송 준비를 완료하세요.'}
          </h2>
          <p>
            {live.status === 'DRAFT'
              ? '상품을 한 개 이상 추가하면 시청자가 볼 수 있는 방송 예정 상태로 전환할 수 있습니다.'
              : '준비 완료 후에만 컨트롤룸에서 방송을 시작할 수 있습니다.'}
          </p>
        </div>
        <span className={`admin-live-status is-${live.status.toLowerCase()}`}>{live.status}</span>
      </section>

      <section
        className="broadcast-preparation-products"
        aria-labelledby="broadcast-preparation-products-heading"
      >
        <div className="broadcast-preparation-section-heading">
          <div>
            <p className="panel-kicker">PRODUCT QUEUE</p>
            <h2 id="broadcast-preparation-products-heading">판매 상품과 노출 순서</h2>
          </div>
          <button
            disabled={
              replaceProductsMutation.isPending ||
              selectedProductIds.length === 0 ||
              !productListChanged
            }
            onClick={saveProducts}
            type="button"
          >
            {replaceProductsMutation.isPending ? '상품 저장 중…' : '상품 목록 저장'}
          </button>
        </div>

        {productMutationError ? (
          <p className="form-error" role="alert">
            {productMutationError}
          </p>
        ) : null}

        <div className="broadcast-preparation-grid">
          <section aria-labelledby="product-catalog-heading" className="broadcast-product-catalog">
            <h3 id="product-catalog-heading">상품 catalog</h3>
            <p>재고가 있는 상품만 선택할 수 있습니다.</p>
            <div className="broadcast-product-catalog-list">
              {catalogQuery.data.map((product) => {
                const totalStock = product.variants.reduce(
                  (sum, variant) => sum + variant.stock,
                  0,
                );
                const isSellable = totalStock > 0;
                const isSelected = selectedProductIdsSet.has(product.id);

                return (
                  <label className="broadcast-product-catalog-row" key={product.id}>
                    <input
                      checked={isSelected}
                      disabled={!isSellable || replaceProductsMutation.isPending}
                      onChange={() => toggleProduct(product.id)}
                      type="checkbox"
                    />
                    <span>
                      <strong>{product.name}</strong>
                      <small>
                        {formatKrw(product.priceKrw)} · 옵션 {product.variants.length}개 · 재고{' '}
                        {totalStock}개
                      </small>
                    </span>
                    <em>{isSellable ? '판매 가능' : '품절'}</em>
                  </label>
                );
              })}
            </div>
          </section>

          <section
            aria-labelledby="selected-product-heading"
            className="broadcast-selected-products"
          >
            <h3 id="selected-product-heading">이 방송의 상품</h3>
            {selectedProducts.length === 0 ? (
              <p className="broadcast-product-empty">
                catalog에서 판매할 상품을 한 개 이상 선택해 주세요.
              </p>
            ) : (
              <ol>
                {selectedProducts.map((product, index) => (
                  <li key={product.id}>
                    <span className="broadcast-product-order">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <strong>{product.name}</strong>
                      <small>
                        {formatKrw(product.priceKrw)} · 총 재고{' '}
                        {product.variants.reduce((sum, variant) => sum + variant.stock, 0)}개
                      </small>
                    </div>
                    <div className="broadcast-product-order-actions">
                      <button
                        aria-label={`${product.name} 순서 올리기`}
                        disabled={index === 0 || replaceProductsMutation.isPending}
                        onClick={() => moveProduct(product.id, -1)}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        aria-label={`${product.name} 순서 내리기`}
                        disabled={
                          index === selectedProducts.length - 1 || replaceProductsMutation.isPending
                        }
                        onClick={() => moveProduct(product.id, 1)}
                        type="button"
                      >
                        ↓
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </section>

      <section className="broadcast-preflight" aria-labelledby="broadcast-preflight-heading">
        <div>
          <p className="panel-kicker">PRE-FLIGHT</p>
          <h2 id="broadcast-preflight-heading">방송 시작 전 점검</h2>
          <ul>
            <li>제목과 예정 시작 시각이 설정되어 있습니다.</li>
            <li>판매 상품이 한 개 이상 선택되어 있습니다.</li>
            <li>선택한 모든 상품에 판매 가능한 옵션 재고가 있습니다.</li>
            <li>Mock 라이브 재생 화면은 프로젝트 기본 구성으로 준비되어 있습니다.</li>
          </ul>
          {statusMutationError ? (
            <p className="form-error" role="alert">
              {statusMutationError}
            </p>
          ) : null}
        </div>
        {live.status === 'DRAFT' ? (
          <button
            disabled={
              selectedProductIds.length === 0 ||
              productListChanged ||
              replaceProductsMutation.isPending ||
              scheduleMutation.isPending
            }
            onClick={() => scheduleMutation.mutate()}
            type="button"
          >
            {scheduleMutation.isPending ? '일정 등록 중…' : '방송 예정으로 전환'}
          </button>
        ) : (
          <button
            disabled={
              selectedProductIds.length === 0 ||
              productListChanged ||
              replaceProductsMutation.isPending ||
              prepareMutation.isPending
            }
            onClick={() => prepareMutation.mutate()}
            type="button"
          >
            {prepareMutation.isPending ? '준비 점검 중…' : '준비 완료 · 컨트롤룸 열기'}
          </button>
        )}
      </section>
    </main>
  );
}
