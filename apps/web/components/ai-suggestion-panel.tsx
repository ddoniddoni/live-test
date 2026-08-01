'use client';

import { useForm } from 'react-hook-form';
import type { AiSuggestion, ReviewAiSuggestionRequest } from '@liveflow/contracts';

type ReviewFormValues = {
  announcementContent: string;
  reason: string;
};

type AiSuggestionPanelProps = {
  accessToken: string | null;
  error: string | null;
  isReviewingSuggestionId: string | null;
  isSummarizing: boolean;
  onCreateSummary: () => void;
  onReview: (suggestionId: string, input: ReviewAiSuggestionRequest) => void;
  suggestions: AiSuggestion[] | undefined;
};

const sourceLabels: Record<string, string> = {
  'chat.messages': '최근 채팅',
  'product.description': '상품 설명',
  'product.variants': '판매 옵션',
};

const statusLabels: Record<AiSuggestion['status'], string> = {
  PENDING: '검토 대기',
  APPROVED: '승인·발행됨',
  REJECTED: '거절됨',
};

function getAnnouncementDraft(suggestion: AiSuggestion): string {
  return suggestion.output.groups[0]?.suggestedAnswer ?? '';
}

function createEditedOutput(
  suggestion: AiSuggestion,
  announcementContent: string,
): AiSuggestion['output'] | undefined {
  const initialDraft = getAnnouncementDraft(suggestion);
  if (!initialDraft || initialDraft === announcementContent) {
    return undefined;
  }

  return {
    ...suggestion.output,
    groups: suggestion.output.groups.map((group, index) =>
      index === 0 ? { ...group, suggestedAnswer: announcementContent } : group,
    ),
  };
}

function AiSuggestionReviewCard({
  isReviewing,
  onReview,
  suggestion,
}: {
  isReviewing: boolean;
  onReview: (suggestionId: string, input: ReviewAiSuggestionRequest) => void;
  suggestion: AiSuggestion;
}) {
  const { handleSubmit, register } = useForm<ReviewFormValues>({
    defaultValues: {
      announcementContent: getAnnouncementDraft(suggestion),
      reason: '',
    },
  });

  function approve(values: ReviewFormValues): void {
    onReview(suggestion.id, {
      action: 'APPROVE',
      announcementContent: values.announcementContent,
      editedOutput: createEditedOutput(suggestion, values.announcementContent),
    });
  }

  function reject(values: ReviewFormValues): void {
    onReview(suggestion.id, {
      action: 'REJECT',
      reason: values.reason,
    });
  }

  return (
    <article className={`ai-suggestion is-${suggestion.status.toLowerCase()}`}>
      <header>
        <div>
          <span className="ai-suggestion-status">{statusLabels[suggestion.status]}</span>
          <strong>
            {suggestion.output.overallSentiment === 'NEGATIVE' ? '주의가 필요한 반응' : '채팅 요약'}
          </strong>
        </div>
        {suggestion.output.requiresImmediateAttention ? (
          <span className="ai-suggestion-alert">즉시 확인</span>
        ) : null}
      </header>

      {suggestion.output.groups.length > 0 ? (
        <ul className="ai-suggestion-groups">
          {suggestion.output.groups.map((group) => (
            <li key={group.topic}>
              <div>
                <strong>{group.topic}</strong>
                <span>{group.count}건</span>
                <em className={`is-${group.risk.toLowerCase()}`}>{group.risk}</em>
              </div>
              <p>{group.suggestedAnswer}</p>
              <small>
                {group.sourceIds.map((sourceId) => sourceLabels[sourceId] ?? sourceId).join(' · ')}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ai-suggestion-empty">
          반복 주제가 뚜렷하지 않습니다. 직접 공지를 작성할 수 있습니다.
        </p>
      )}

      {suggestion.status === 'PENDING' ? (
        <form className="ai-suggestion-review" onSubmit={handleSubmit(approve)}>
          <label htmlFor={`announcement-content-${suggestion.id}`}>시청자 공지 초안</label>
          <textarea
            id={`announcement-content-${suggestion.id}`}
            maxLength={500}
            placeholder="승인할 공지 내용을 입력해 주세요."
            {...register('announcementContent', { required: true })}
          />
          <label htmlFor={`rejection-reason-${suggestion.id}`}>거절 사유</label>
          <input
            id={`rejection-reason-${suggestion.id}`}
            maxLength={300}
            placeholder="거절할 때만 입력해 주세요."
            {...register('reason')}
          />
          <div className="ai-suggestion-actions">
            <button disabled={isReviewing} type="submit">
              {isReviewing ? '처리 중…' : '승인·공지 발행'}
            </button>
            <button
              className="secondary"
              disabled={isReviewing}
              onClick={handleSubmit(reject)}
              type="button"
            >
              거절
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

export function AiSuggestionPanel({
  accessToken,
  error,
  isReviewingSuggestionId,
  isSummarizing,
  onCreateSummary,
  onReview,
  suggestions,
}: AiSuggestionPanelProps) {
  return (
    <section
      className="admin-ai-card"
      id="ai-suggestion-control"
      aria-labelledby="ai-suggestion-heading"
    >
      <div className="admin-ai-heading">
        <span aria-hidden="true">✦</span>
        <h2 id="ai-suggestion-heading">AI 채팅 요약 및 제안</h2>
      </div>
      <p className="admin-ai-description">
        최근 채팅 최대 100개를 분석합니다. AI 초안은 운영자가 검토·승인하기 전까지 시청자에게
        공개되지 않습니다.
      </p>
      <button
        className="ai-summary-trigger"
        disabled={!accessToken || isSummarizing}
        onClick={onCreateSummary}
        type="button"
      >
        {isSummarizing ? '최근 채팅 분석 중…' : '최근 채팅 요약 만들기'}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {!accessToken ? (
        <p className="ai-suggestion-login-note">관리자 세션을 시작하면 분석할 수 있습니다.</p>
      ) : null}
      {accessToken && suggestions?.length === 0 ? (
        <p className="ai-suggestion-empty">아직 생성된 AI 제안이 없습니다.</p>
      ) : null}
      {suggestions?.map((suggestion) => (
        <AiSuggestionReviewCard
          isReviewing={isReviewingSuggestionId === suggestion.id}
          key={suggestion.id}
          onReview={onReview}
          suggestion={suggestion}
        />
      ))}
    </section>
  );
}
