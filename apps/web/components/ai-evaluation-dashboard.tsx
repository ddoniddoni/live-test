'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type {
  AiProductAnswerEvaluationCase,
  AiProductAnswerEvaluationFailureType,
} from '@liveflow/contracts';

import {
  ApiRequestError,
  aiProductAnswerEvaluationQueryKey,
  fetchAiProductAnswerEvaluations,
} from '@/lib/live-api';

type AiEvaluationDashboardProps = {
  accessToken: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'Asia/Seoul',
});

const failureTypeLabels: Record<AiProductAnswerEvaluationFailureType, string> = {
  SCHEMA_INVALID: '응답 형식 오류',
  SOURCE_MISMATCH: '근거 불일치',
  HUMAN_REVIEW_MISMATCH: '검토 필요 판단 불일치',
  FORBIDDEN_CLAIM: '금지 단정 표현',
};

function formatPercent(count: number, total: number): string {
  return `${Math.round((count / total) * 100)}%`;
}

function getResultLabel(evaluationCase: AiProductAnswerEvaluationCase): string {
  return evaluationCase.passed ? '통과' : '검토 필요';
}

export function AiEvaluationDashboard({ accessToken }: AiEvaluationDashboardProps) {
  const evaluationQuery = useQuery({
    queryKey: aiProductAnswerEvaluationQueryKey(),
    queryFn: () => fetchAiProductAnswerEvaluations(accessToken),
  });

  if (evaluationQuery.isPending) {
    return (
      <main className="admin-live-manager-shell ai-evaluation-shell">
        <section className="ai-evaluation-panel ai-evaluation-state" role="status">
          AI 답변 평가 결과를 계산하는 중입니다…
        </section>
      </main>
    );
  }

  if (evaluationQuery.isError || !evaluationQuery.data) {
    const errorMessage =
      evaluationQuery.error instanceof ApiRequestError
        ? evaluationQuery.error.message
        : 'AI 답변 평가 결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';

    return (
      <main className="admin-live-manager-shell ai-evaluation-shell">
        <section className="ai-evaluation-panel ai-evaluation-state" role="alert">
          <h1>AI 평가 결과를 불러오지 못했습니다</h1>
          <p>{errorMessage}</p>
          <div className="admin-live-manager-actions">
            <button onClick={() => void evaluationQuery.refetch()} type="button">
              다시 시도
            </button>
            <Link className="admin-live-secondary-link" href="/admin/lives">
              방송 관리로 돌아가기
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const report = evaluationQuery.data;
  const cases = report.cases.toSorted((left, right) => Number(left.passed) - Number(right.passed));

  return (
    <main className="admin-live-manager-shell ai-evaluation-shell">
      <header className="admin-live-manager-header ai-evaluation-header">
        <div>
          <Link className="admin-access-brand" href="/">
            StreamOps <strong>Elite</strong>
          </Link>
          <p className="panel-kicker">AI QUALITY BASELINE</p>
          <h1>AI 답변 평가</h1>
          <p>상품 Q&amp;A의 응답 형식, 상품 근거, 사람 검토 필요 여부를 fixture로 검증합니다.</p>
        </div>
        <div className="admin-live-manager-actions">
          <Link className="admin-live-secondary-link" href="/admin/lives">
            방송 관리
          </Link>
          <button
            disabled={evaluationQuery.isFetching}
            onClick={() => void evaluationQuery.refetch()}
            type="button"
          >
            {evaluationQuery.isFetching ? '다시 평가 중…' : '평가 다시 실행'}
          </button>
        </div>
      </header>

      <section className="ai-evaluation-panel" aria-labelledby="ai-evaluation-overview-heading">
        <header className="ai-evaluation-panel-heading">
          <div>
            <p className="panel-kicker">CURRENT BASELINE</p>
            <h2 id="ai-evaluation-overview-heading">
              {report.provider} / {report.modelOrMockVersion}
            </h2>
          </div>
          <time dateTime={report.evaluatedAt}>
            마지막 실행 {dateTimeFormatter.format(new Date(report.evaluatedAt))}
          </time>
        </header>

        <dl className="ai-evaluation-metrics">
          <div>
            <dt>전체 통과</dt>
            <dd>{formatPercent(report.passedCaseCount, report.totalCases)}</dd>
            <span>
              {report.passedCaseCount} / {report.totalCases}개 케이스
            </span>
          </div>
          <div>
            <dt>응답 형식</dt>
            <dd>{formatPercent(report.schemaValidCaseCount, report.totalCases)}</dd>
            <span>공유 Zod 계약 검증</span>
          </div>
          <div>
            <dt>상품 근거</dt>
            <dd>{formatPercent(report.sourceMatchedCaseCount, report.totalCases)}</dd>
            <span>필수 source ID 포함</span>
          </div>
          <div>
            <dt>평균 응답 시간</dt>
            <dd>{report.averageResponseTimeMs}ms</dd>
            <span>현재 mock 실행 기준</span>
          </div>
        </dl>

        <section
          className="ai-evaluation-failure-summary"
          aria-labelledby="ai-evaluation-failure-heading"
        >
          <div>
            <h3 id="ai-evaluation-failure-heading">실패 유형</h3>
            <p>실패한 케이스는 아래 목록에서 먼저 표시됩니다.</p>
          </div>
          {report.failureCounts.length === 0 ? (
            <strong className="is-success">검출된 실패 없음</strong>
          ) : (
            <ul>
              {report.failureCounts.map((failure) => (
                <li key={failure.type}>
                  {failureTypeLabels[failure.type]} <strong>{failure.count}건</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      <section
        className="ai-evaluation-panel ai-evaluation-cases"
        aria-labelledby="ai-evaluation-cases-heading"
      >
        <header className="ai-evaluation-panel-heading">
          <div>
            <p className="panel-kicker">CURATED FIXTURES</p>
            <h2 id="ai-evaluation-cases-heading">케이스별 검증 결과</h2>
          </div>
          <span>{report.totalCases}개 질문</span>
        </header>

        <div className="ai-evaluation-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">질문</th>
                <th scope="col">응답 형식</th>
                <th scope="col">상품 근거</th>
                <th scope="col">사람 검토</th>
                <th scope="col">응답 시간</th>
                <th scope="col">결과</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((evaluationCase) => (
                <tr key={evaluationCase.id}>
                  <td>
                    <strong>{evaluationCase.question}</strong>
                    {evaluationCase.forbiddenClaims.length > 0 ? (
                      <small>금지 표현: {evaluationCase.forbiddenClaims.join(', ')}</small>
                    ) : null}
                  </td>
                  <td className={evaluationCase.schemaValid ? 'is-success' : 'is-failure'}>
                    {evaluationCase.schemaValid ? '통과' : '실패'}
                  </td>
                  <td className={evaluationCase.sourceMatched ? 'is-success' : 'is-failure'}>
                    {evaluationCase.sourceMatched ? '일치' : '불일치'}
                    <small>{evaluationCase.expectedSourceIds.join(', ')}</small>
                  </td>
                  <td className={evaluationCase.humanReviewMatched ? 'is-success' : 'is-failure'}>
                    {evaluationCase.humanReviewMatched ? '일치' : '불일치'}
                    <small>
                      기대:{' '}
                      {evaluationCase.expectedNeedsHumanReview ? '검토 필요' : '바로 안내 가능'}
                    </small>
                  </td>
                  <td>{evaluationCase.responseTimeMs}ms</td>
                  <td>
                    <span
                      className={`ai-evaluation-case-status ${
                        evaluationCase.passed ? 'is-success' : 'is-failure'
                      }`}
                    >
                      {getResultLabel(evaluationCase)}
                    </span>
                    {evaluationCase.failureTypes.length > 0 ? (
                      <small>
                        {evaluationCase.failureTypes
                          .map((type) => failureTypeLabels[type])
                          .join(', ')}
                      </small>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
