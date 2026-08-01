import { describe, expect, it } from 'vitest';
import { aiProductAnswerSchema } from '@liveflow/contracts';

import {
  productQuestionEvaluationFixtures,
  softKnitEvaluationProduct,
} from './ai-product-answer-eval.fixture.js';
import { createMockProductAnswer } from './ai.service.js';

describe('FR-AI-07 product question evaluation fixtures', () => {
  it('keeps a curated set of at least 20 questions', () => {
    expect(productQuestionEvaluationFixtures).toHaveLength(20);
  });

  it.each(productQuestionEvaluationFixtures)(
    '$id returns a schema-valid answer with the expected sources and no unsupported claims',
    (fixture) => {
      const answer = createMockProductAnswer(softKnitEvaluationProduct, fixture.question);

      expect(aiProductAnswerSchema.safeParse(answer).success).toBe(true);
      expect(answer.sourceIds).toEqual(expect.arrayContaining(fixture.expectedSourceIds));
      expect(answer.needsHumanReview, `${fixture.id}: ${answer.answer}`).toBe(
        fixture.expectedNeedsHumanReview,
      );

      for (const forbiddenPhrase of fixture.forbiddenAnswerPhrases) {
        expect(answer.answer).not.toContain(forbiddenPhrase);
      }
    },
  );
});
