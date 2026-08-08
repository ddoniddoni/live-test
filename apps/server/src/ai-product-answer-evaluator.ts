import { aiProductAnswerEvaluationReportSchema, aiProductAnswerSchema } from '@liveflow/contracts';
import type {
  AiProductAnswerEvaluationFailureType,
  AiProductAnswerEvaluationReport,
  Product,
} from '@liveflow/contracts';

import {
  productQuestionEvaluationFixtures,
  softKnitEvaluationProduct,
} from './ai-product-answer-eval.fixture.js';

type ProductAnswerGenerator = (product: Product, question: string) => unknown;

export function evaluateProductAnswerFixtures(
  generateAnswer: ProductAnswerGenerator,
): AiProductAnswerEvaluationReport {
  const evaluatedAt = new Date().toISOString();
  const cases = productQuestionEvaluationFixtures.map((fixture) => {
    const startedAt = Date.now();
    let answer: unknown = null;

    try {
      answer = generateAnswer(softKnitEvaluationProduct, fixture.question);
    } catch {
      answer = null;
    }

    const responseTimeMs = Math.max(0, Date.now() - startedAt);
    const parsedAnswer = aiProductAnswerSchema.safeParse(answer);
    const actualSourceIds = parsedAnswer.success ? parsedAnswer.data.sourceIds : [];
    const actualNeedsHumanReview = parsedAnswer.success ? parsedAnswer.data.needsHumanReview : null;
    const sourceMatched =
      parsedAnswer.success &&
      fixture.expectedSourceIds.every((sourceId) => actualSourceIds.includes(sourceId));
    const humanReviewMatched =
      parsedAnswer.success && actualNeedsHumanReview === fixture.expectedNeedsHumanReview;
    const forbiddenClaims = parsedAnswer.success
      ? fixture.forbiddenAnswerPhrases.filter((phrase) => parsedAnswer.data.answer.includes(phrase))
      : [];
    const failureTypes: AiProductAnswerEvaluationFailureType[] = [];

    if (!parsedAnswer.success) {
      failureTypes.push('SCHEMA_INVALID');
    }
    if (!sourceMatched) {
      failureTypes.push('SOURCE_MISMATCH');
    }
    if (!humanReviewMatched) {
      failureTypes.push('HUMAN_REVIEW_MISMATCH');
    }
    if (forbiddenClaims.length > 0) {
      failureTypes.push('FORBIDDEN_CLAIM');
    }

    return {
      id: fixture.id,
      question: fixture.question,
      expectedSourceIds: [...fixture.expectedSourceIds],
      actualSourceIds,
      expectedNeedsHumanReview: fixture.expectedNeedsHumanReview,
      actualNeedsHumanReview,
      schemaValid: parsedAnswer.success,
      sourceMatched,
      humanReviewMatched,
      forbiddenClaims,
      failureTypes,
      passed: failureTypes.length === 0,
      responseTimeMs,
    };
  });
  const failureCounts = (
    ['SCHEMA_INVALID', 'SOURCE_MISMATCH', 'HUMAN_REVIEW_MISMATCH', 'FORBIDDEN_CLAIM'] as const
  )
    .map((type) => ({
      type,
      count: cases.filter((evaluationCase) => evaluationCase.failureTypes.includes(type)).length,
    }))
    .filter((failure) => failure.count > 0);
  const totalResponseTimeMs = cases.reduce(
    (total, evaluationCase) => total + evaluationCase.responseTimeMs,
    0,
  );

  return aiProductAnswerEvaluationReportSchema.parse({
    provider: 'mock',
    modelOrMockVersion: 'mock-product-answer-v1',
    evaluatedAt,
    totalCases: cases.length,
    passedCaseCount: cases.filter((evaluationCase) => evaluationCase.passed).length,
    schemaValidCaseCount: cases.filter((evaluationCase) => evaluationCase.schemaValid).length,
    sourceMatchedCaseCount: cases.filter((evaluationCase) => evaluationCase.sourceMatched).length,
    humanReviewMatchedCaseCount: cases.filter((evaluationCase) => evaluationCase.humanReviewMatched)
      .length,
    averageResponseTimeMs: Math.round(totalResponseTimeMs / cases.length),
    failureCounts,
    cases,
  });
}
