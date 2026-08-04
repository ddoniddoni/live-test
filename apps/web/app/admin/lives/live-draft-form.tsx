'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createLiveDraftRequestSchema } from '@liveflow/contracts';
import type { AdminLiveSession, CreateLiveDraftRequest } from '@liveflow/contracts';

type LiveDraftFormValues = {
  title: string;
  description: string;
  thumbnailUrl: string;
  scheduledStartAt: string;
};

type LiveDraftFormProps = {
  draft: AdminLiveSession | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateLiveDraftRequest) => void;
};

function toDatetimeLocalValue(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function createDefaultValues(draft: AdminLiveSession | null): LiveDraftFormValues {
  return {
    title: draft?.title ?? '',
    description: draft?.description ?? '',
    thumbnailUrl: draft?.thumbnailUrl ?? '',
    scheduledStartAt: toDatetimeLocalValue(
      draft?.scheduledStartAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ),
  };
}

export function LiveDraftForm({ draft, isSubmitting, onCancel, onSubmit }: LiveDraftFormProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const form = useForm<LiveDraftFormValues>({ defaultValues: createDefaultValues(draft) });

  function handleValidSubmit(values: LiveDraftFormValues): void {
    const parsedDraft = createLiveDraftRequestSchema.safeParse({
      title: values.title,
      description: values.description,
      ...(values.thumbnailUrl.trim().length > 0 ? { thumbnailUrl: values.thumbnailUrl } : {}),
      scheduledStartAt: new Date(values.scheduledStartAt).toISOString(),
    });

    if (!parsedDraft.success) {
      setValidationError(parsedDraft.error.issues[0]?.message ?? '입력값을 확인해 주세요.');
      return;
    }

    setValidationError(null);
    onSubmit(parsedDraft.data);
  }

  return (
    <section className="admin-live-draft-form" aria-labelledby="live-draft-form-heading">
      <div className="admin-live-draft-form-heading">
        <div>
          <p className="panel-kicker">{draft ? 'DRAFT EDITOR' : 'NEW BROADCAST'}</p>
          <h2 id="live-draft-form-heading">{draft ? '방송 초안 수정' : '새 방송 만들기'}</h2>
          <p>판매 상품과 시작 점검은 초안을 저장한 다음 단계에서 준비합니다.</p>
        </div>
        <button className="admin-live-text-button" onClick={onCancel} type="button">
          닫기
        </button>
      </div>
      <form aria-busy={isSubmitting} onSubmit={form.handleSubmit(handleValidSubmit)}>
        <label htmlFor="live-draft-title">방송 제목</label>
        <input
          {...form.register('title', { required: true, maxLength: 100 })}
          id="live-draft-title"
          maxLength={100}
          placeholder="예: 가을 데일리룩 라이브"
        />

        <label htmlFor="live-draft-description">방송 설명</label>
        <textarea
          {...form.register('description', { required: true, maxLength: 500 })}
          id="live-draft-description"
          maxLength={500}
          placeholder="방송에서 소개할 상품과 핵심 혜택을 적어 주세요."
          rows={4}
        />

        <label htmlFor="live-draft-thumbnail-url">대표 이미지 URL (선택)</label>
        <input
          {...form.register('thumbnailUrl')}
          id="live-draft-thumbnail-url"
          inputMode="url"
          placeholder="https://example.com/live-thumbnail.jpg"
          type="url"
        />

        <label htmlFor="live-draft-scheduled-start-at">예정 시작 시각</label>
        <input
          {...form.register('scheduledStartAt', { required: true })}
          id="live-draft-scheduled-start-at"
          type="datetime-local"
        />

        {validationError ? (
          <p className="form-error" role="alert">
            {validationError}
          </p>
        ) : null}
        <div className="admin-live-draft-form-actions">
          <button className="admin-live-secondary-button" onClick={onCancel} type="button">
            취소
          </button>
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? '저장 중…' : draft ? '초안 저장' : '초안 만들기'}
          </button>
        </div>
      </form>
    </section>
  );
}
