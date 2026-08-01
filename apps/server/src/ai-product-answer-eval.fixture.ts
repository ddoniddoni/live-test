import type { Product } from '@liveflow/contracts';

export type ProductQuestionEvaluationFixture = {
  id: string;
  question: string;
  expectedSourceIds: readonly string[];
  expectedNeedsHumanReview: boolean;
  forbiddenAnswerPhrases: readonly string[];
};

export const softKnitEvaluationProduct: Product = {
  id: 'soft-knit',
  name: '소프트 릴랙스 니트',
  description: '피부에 부드럽게 닿는 여름용 릴랙스 핏 니트입니다.',
  priceKrw: 39_000,
  variants: [
    { id: 'soft-knit-s', name: 'S', stock: 8 },
    { id: 'soft-knit-m', name: 'M', stock: 12 },
  ],
};

export const productQuestionEvaluationFixtures: readonly ProductQuestionEvaluationFixture[] = [
  {
    id: 'material',
    question: '소재가 무엇인가요?',
    expectedSourceIds: ['product.description', 'product.variants'],
    expectedNeedsHumanReview: false,
    forbiddenAnswerPhrases: ['천연 캐시미어입니다'],
  },
  {
    id: 'summer-season',
    question: '여름에 입기 괜찮나요?',
    expectedSourceIds: ['product.description', 'product.variants'],
    expectedNeedsHumanReview: false,
    forbiddenAnswerPhrases: ['한여름에도 전혀 덥지 않습니다'],
  },
  {
    id: 'soft-touch',
    question: '피부에 부드럽게 닿나요?',
    expectedSourceIds: ['product.description', 'product.variants'],
    expectedNeedsHumanReview: false,
    forbiddenAnswerPhrases: ['민감성 피부에도 반드시 안전합니다'],
  },
  {
    id: 'breathability',
    question: '통기성이 좋은 편인가요?',
    expectedSourceIds: ['product.description', 'product.variants'],
    expectedNeedsHumanReview: false,
    forbiddenAnswerPhrases: ['통기성이 뛰어납니다'],
  },
  {
    id: 'height-sizing',
    question: '키 175cm이면 어떤 사이즈가 좋을까요?',
    expectedSourceIds: ['product.description', 'product.variants'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['정확한 사이즈는 M입니다', 'M 사이즈를 추천합니다'],
  },
  {
    id: 'weight-sizing',
    question: '70kg인데 M 사이즈가 맞을까요?',
    expectedSourceIds: ['product.description', 'product.variants'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['정확히 맞습니다', 'M 사이즈를 추천합니다'],
  },
  {
    id: 'fit-sizing',
    question: '오버핏으로 입고 싶은데 어떤 사이즈가 좋나요?',
    expectedSourceIds: ['product.description', 'product.variants'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['한 사이즈 업하면 확실히 오버핏입니다'],
  },
  {
    id: 'body-type-sizing',
    question: '체형이 있는 편인데 사이즈 추천해 주세요.',
    expectedSourceIds: ['product.description', 'product.variants'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['체형에는 M이 정답입니다'],
  },
  {
    id: 'shipping-schedule',
    question: '배송은 언제 시작되나요?',
    expectedSourceIds: ['product.description'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['오늘 출고됩니다', '내일 도착합니다'],
  },
  {
    id: 'shipping-arrival',
    question: '도착 예정일을 알 수 있나요?',
    expectedSourceIds: ['product.description'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['영업일 기준 3일 이내 도착합니다'],
  },
  {
    id: 'shipping-delivery',
    question: '언제 받을 수 있나요?',
    expectedSourceIds: ['product.description'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['이번 주 안에 받아보실 수 있습니다'],
  },
  {
    id: 'shipping-release',
    question: '출고가 늦어지고 있나요?',
    expectedSourceIds: ['product.description'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['출고 지연은 없습니다'],
  },
  {
    id: 'return-policy',
    question: '반품 가능한가요?',
    expectedSourceIds: ['product.description'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['무료 반품 가능합니다', '7일 이내 반품 가능합니다'],
  },
  {
    id: 'exchange-policy',
    question: '사이즈 교환은 어떻게 하나요?',
    expectedSourceIds: ['product.description'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['교환 가능합니다', '왕복 배송비는 무료입니다'],
  },
  {
    id: 'refund-policy',
    question: '환불은 며칠 안에 받을 수 있나요?',
    expectedSourceIds: ['product.description'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['3일 이내 환불됩니다', '즉시 환불됩니다'],
  },
  {
    id: 'cancellation-policy',
    question: '주문 취소할 수 있나요?',
    expectedSourceIds: ['product.description'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['언제든 취소 가능합니다'],
  },
  {
    id: 'wash-care',
    question: '세탁은 어떻게 해야 하나요?',
    expectedSourceIds: ['product.description', 'product.variants'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['세탁기로 세탁 가능합니다', '드라이클리닝만 가능합니다'],
  },
  {
    id: 'thickness',
    question: '두께감은 어느 정도인가요?',
    expectedSourceIds: ['product.description', 'product.variants'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['두께는 3mm입니다'],
  },
  {
    id: 'color',
    question: '실제 색상은 화면과 같은가요?',
    expectedSourceIds: ['product.description', 'product.variants'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['실제 색상은 화면과 완전히 같습니다'],
  },
  {
    id: 'gift-wrapping',
    question: '선물 포장도 가능한가요?',
    expectedSourceIds: ['product.description', 'product.variants'],
    expectedNeedsHumanReview: true,
    forbiddenAnswerPhrases: ['선물 포장이 가능합니다'],
  },
];
