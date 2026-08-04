'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminLiveSession, CreateLiveDraftRequest } from '@liveflow/contracts';

import { ScreenState } from '@/components/screen-state';
import {
  ApiRequestError,
  adminLiveListQueryKey,
  cancelLiveDraft,
  createLiveDraft,
  fetchAdminLives,
  updateLiveDraft,
} from '@/lib/live-api';

import { LiveDraftForm } from './live-draft-form';

type AdminLiveManagerProps = {
  accessToken: string;
  initialCreate?: boolean;
};

const statusLabels: Record<AdminLiveSession['status'], string> = {
  DRAFT: '초안',
  SCHEDULED: '방송 예정',
  READY: '방송 준비됨',
  LIVE: '방송 중',
  ENDED: '방송 종료',
  CANCELLED: '방송 취소',
};

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDateTime(value: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : '예정 시각 없음';
}

function getMutationError(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  return fallback;
}

export function AdminLiveManager({ accessToken, initialCreate = false }: AdminLiveManagerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editingLive, setEditingLive] = useState<AdminLiveSession | null>(null);
  const [isCreating, setIsCreating] = useState(initialCreate);
  const liveListQuery = useQuery({
    queryKey: adminLiveListQueryKey(),
    queryFn: () => fetchAdminLives(accessToken),
  });
  const createMutation = useMutation({
    mutationFn: (draft: CreateLiveDraftRequest) => createLiveDraft(draft, accessToken),
    onSuccess: (live) => {
      setIsCreating(false);
      router.replace(`/admin/lives/${live.id}`);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ liveId, draft }: { liveId: string; draft: CreateLiveDraftRequest }) =>
      updateLiveDraft(liveId, draft, accessToken),
    onSuccess: () => {
      setEditingLive(null);
      void queryClient.invalidateQueries({ queryKey: adminLiveListQueryKey() });
    },
  });
  const cancelMutation = useMutation({
    mutationFn: (liveId: string) => cancelLiveDraft(liveId, accessToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminLiveListQueryKey() }),
  });

  const activeForm = isCreating ? null : editingLive;
  const formError = createMutation.isError
    ? getMutationError(createMutation.error, '방송 초안을 만들지 못했습니다. 다시 시도해 주세요.')
    : updateMutation.isError
      ? getMutationError(
          updateMutation.error,
          '방송 초안을 저장하지 못했습니다. 다시 시도해 주세요.',
        )
      : null;
  const cancelError = cancelMutation.isError
    ? getMutationError(cancelMutation.error, '방송 초안을 취소하지 못했습니다. 다시 시도해 주세요.')
    : null;

  function closeForm(): void {
    setIsCreating(false);
    setEditingLive(null);
  }

  function submitDraft(draft: CreateLiveDraftRequest): void {
    if (editingLive) {
      updateMutation.mutate({ liveId: editingLive.id, draft });
      return;
    }

    createMutation.mutate(draft);
  }

  if (liveListQuery.isPending) {
    return <ScreenState>방송 목록을 불러오는 중입니다…</ScreenState>;
  }

  if (liveListQuery.isError || !liveListQuery.data) {
    return (
      <ScreenState tone="error">
        방송 목록을 불러오지 못했습니다. 실시간 서버 연결을 확인한 뒤 다시 시도해 주세요.
      </ScreenState>
    );
  }

  const { lives } = liveListQuery.data;

  return (
    <main className="admin-live-manager-shell">
      <header className="admin-live-manager-header">
        <div>
          <Link className="admin-access-brand" href="/">
            StreamOps <strong>Elite</strong>
          </Link>
          <p className="panel-kicker">LIVEFLOW / BROADCAST MANAGEMENT</p>
          <h1>방송 관리</h1>
          <p>방송을 초안으로 만들고, 준비가 끝난 방송만 컨트롤룸에서 운영합니다.</p>
        </div>
        <div className="admin-live-manager-actions">
          <Link className="admin-live-secondary-link" href="/">
            시청자 홈
          </Link>
          <Link className="admin-live-secondary-link" href="/admin/orders">
            주문 관리
          </Link>
          <Link className="admin-live-primary-link" href="/admin/lives/new">
            새 방송 만들기
          </Link>
        </div>
      </header>

      {isCreating || editingLive ? (
        <div className="admin-live-draft-panel">
          <LiveDraftForm
            draft={activeForm}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            key={activeForm?.id ?? 'new-live-draft'}
            onCancel={closeForm}
            onSubmit={submitDraft}
          />
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      ) : null}

      {cancelError ? (
        <p className="admin-live-manager-error" role="alert">
          {cancelError}
        </p>
      ) : null}

      <section aria-labelledby="admin-live-list-heading" className="admin-live-list-section">
        <div className="admin-live-list-heading">
          <div>
            <p className="panel-kicker">BROADCASTS</p>
            <h2 id="admin-live-list-heading">전체 방송 {lives.length}개</h2>
          </div>
          <span>초안은 시청자에게 공개되지 않습니다.</span>
        </div>

        {lives.length === 0 ? (
          <div className="admin-live-empty-state">
            <h3>아직 만든 방송이 없습니다.</h3>
            <p>새 방송을 만들어 제목과 예정 시각을 먼저 정해 주세요.</p>
          </div>
        ) : (
          <div className="admin-live-grid">
            {lives.map((live) => (
              <article className="admin-live-card" key={live.id}>
                <div className="admin-live-card-topline">
                  <span className={`admin-live-status is-${live.status.toLowerCase()}`}>
                    {statusLabels[live.status]}
                  </span>
                  <time dateTime={live.scheduledStartAt ?? undefined}>
                    {formatDateTime(live.scheduledStartAt)}
                  </time>
                </div>
                <div className="admin-live-card-copy">
                  <h3>{live.title}</h3>
                  <p>{live.description ?? '방송 설명이 아직 없습니다.'}</p>
                </div>
                <dl className="admin-live-card-meta">
                  <div>
                    <dt>생성</dt>
                    <dd>{formatDateTime(live.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>진행</dt>
                    <dd>{live.startedAt ? formatDateTime(live.startedAt) : '아직 시작 전'}</dd>
                  </div>
                </dl>
                <div className="admin-live-card-actions">
                  {live.status === 'CANCELLED' ? (
                    <span>취소된 방송입니다.</span>
                  ) : (
                    <>
                      <Link href={`/admin/lives/${live.id}`}>
                        {live.status === 'DRAFT'
                          ? '판매 상품 준비'
                          : live.status === 'SCHEDULED'
                            ? '방송 준비 점검'
                            : '컨트롤룸 열기'}
                      </Link>
                      {live.status === 'DRAFT' || live.status === 'SCHEDULED' ? (
                        <button onClick={() => setEditingLive(live)} type="button">
                          기본 정보 수정
                        </button>
                      ) : null}
                      {live.status === 'DRAFT' ||
                      live.status === 'SCHEDULED' ||
                      live.status === 'READY' ? (
                        <button
                          className="admin-live-danger-button"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(live.id)}
                          type="button"
                        >
                          방송 취소
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
