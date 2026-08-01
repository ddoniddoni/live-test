'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AiProductAnswer, Product } from '@liveflow/contracts';

import { ApiRequestError, askProductQuestion } from '@/lib/live-api';

const sourceLabels: Record<string, string> = {
  'product.description': '상품 설명',
  'product.variants': '판매 옵션',
};

function getSourceLabel(sourceId: string): string {
  return sourceLabels[sourceId] ?? sourceId;
}

function AnswerResult({ answer }: { answer: AiProductAnswer }) {
  return (
    <div className="product-question-answer" role="status">
      <div className="product-question-answer-heading">
        <span aria-hidden="true">✦</span>
        <strong>LiveFlow AI 답변</strong>
        {answer.needsHumanReview ? <span className="review-badge">운영자 확인 필요</span> : null}
      </div>
      <p>{answer.answer}</p>
      <div className="product-question-sources">
        <span>답변 근거</span>
        <ul>
          {answer.sourceIds.map((sourceId) => (
            <li key={sourceId}>{getSourceLabel(sourceId)}</li>
          ))}
        </ul>
      </div>
      {answer.needsHumanReview ? <small>{answer.reason}</small> : null}
    </div>
  );
}

export function ProductQuestionPanel({
  accessToken,
  headingId = 'product-question-heading',
  liveId,
  product,
}: {
  accessToken: string | null;
  headingId?: string;
  liveId: string;
  product: Product;
}) {
  const [question, setQuestion] = useState('');
  const questionMutation = useMutation({
    mutationFn: (nextQuestion: string) => {
      if (!accessToken) {
        throw new Error('시청자 세션을 준비하지 못했습니다.');
      }

      return askProductQuestion(liveId, nextQuestion, accessToken);
    },
  });
  const trimmedQuestion = question.trim();
  const errorMessage = questionMutation.isError
    ? questionMutation.error instanceof ApiRequestError
      ? questionMutation.error.message
      : 'AI 답변을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
    : null;

  function submitQuestion(): void {
    if (!trimmedQuestion || !accessToken || questionMutation.isPending) {
      return;
    }

    questionMutation.mutate(trimmedQuestion);
  }

  return (
    <section className="product-question-panel" aria-labelledby={headingId}>
      <div className="product-question-heading">
        <div>
          <p className="panel-kicker">ASK LIVEFLOW AI</p>
          <h2 id={headingId}>상품이 궁금하신가요?</h2>
        </div>
        <span>{product.name} 기준</span>
      </div>

      <form
        className="product-question-form"
        onSubmit={(event) => {
          event.preventDefault();
          submitQuestion();
        }}
      >
        <label htmlFor="product-question-input">상품 질문</label>
        <textarea
          disabled={!accessToken || questionMutation.isPending}
          id="product-question-input"
          maxLength={500}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="예: 여름에 입기 괜찮나요? 사이즈는 어떻게 고르면 될까요?"
          rows={3}
          value={question}
        />
        <div className="product-question-actions">
          <p aria-live="polite">
            {questionMutation.isPending
              ? '등록된 상품 정보를 확인하고 있습니다…'
              : accessToken
                ? '상품 설명과 판매 옵션을 근거로 답변합니다.'
                : '시청자 세션을 준비하는 중입니다.'}
          </p>
          <button
            disabled={!trimmedQuestion || !accessToken || questionMutation.isPending}
            type="submit"
          >
            {questionMutation.isPending ? '답변 준비 중' : 'AI에게 질문'}
          </button>
        </div>
      </form>

      {errorMessage ? (
        <div className="product-question-error" role="alert">
          <p>{errorMessage}</p>
          <button
            disabled={!trimmedQuestion || !accessToken || questionMutation.isPending}
            onClick={submitQuestion}
            type="button"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {questionMutation.data ? <AnswerResult answer={questionMutation.data} /> : null}
    </section>
  );
}
