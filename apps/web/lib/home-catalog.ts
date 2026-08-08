export const homeCategories = [
  { id: 'all', label: '전체', subtitle: '지금 둘러보기' },
  { id: 'beauty', label: '뷰티', subtitle: '스킨케어·메이크업' },
  { id: 'tech', label: '테크', subtitle: '디지털·가전' },
  { id: 'fashion', label: '패션', subtitle: '의류·잡화' },
  { id: 'food', label: '푸드', subtitle: '식품·미식' },
  { id: 'living', label: '리빙', subtitle: '홈·라이프' },
  { id: 'sport', label: '스포츠', subtitle: '운동·아웃도어' },
] as const;

export type HomeCategoryId = (typeof homeCategories)[number]['id'];

type HomeCatalogLive = {
  category: Exclude<HomeCategoryId, 'all'>;
  creator: string;
  id: string;
  thumbnail: string;
  title: string;
  viewers: string;
};

export const homeCatalogLives: readonly HomeCatalogLive[] = [
  {
    id: 'beauty-summer-glow',
    category: 'beauty',
    creator: '글로우 에디터 수아',
    thumbnail: 'SUMMER GLOW',
    title: '여름 피부 진정 루틴, 오늘만 세트 할인',
    viewers: '2.4K',
  },
  {
    id: 'beauty-lip-pairing',
    category: 'beauty',
    creator: '메이크업 온',
    thumbnail: 'LIP PAIRING',
    title: '톤별로 골라보는 립 컬러 페어링',
    viewers: '1.8K',
  },
  {
    id: 'beauty-night-care',
    category: 'beauty',
    creator: '나이트 스킨랩',
    thumbnail: 'NIGHT CARE',
    title: '무너진 장벽을 위한 저녁 스킨케어',
    viewers: '946',
  },
  {
    id: 'beauty-perfume-note',
    category: 'beauty',
    creator: '센트 큐레이터',
    thumbnail: 'SCENT NOTE',
    title: '계절별로 찾는 나만의 향수 노트',
    viewers: '721',
  },
  {
    id: 'tech-audio-lab',
    category: 'tech',
    creator: '테크 리뷰어 J',
    thumbnail: 'AUDIO LAB',
    title: '신상 노이즈 캔슬링 헤드폰 비교',
    viewers: '3.1K',
  },
  {
    id: 'tech-desk-setup',
    category: 'tech',
    creator: '데스크테리어 민',
    thumbnail: 'DESK SETUP',
    title: '작업 집중도를 높이는 데스크 장비',
    viewers: '1.5K',
  },
  {
    id: 'tech-home-cinema',
    category: 'tech',
    creator: '홈시네마 클럽',
    thumbnail: 'HOME CINEMA',
    title: '작은 거실을 위한 빔프로젝터 가이드',
    viewers: '1.1K',
  },
  {
    id: 'tech-mobile-pick',
    category: 'tech',
    creator: '모바일 픽',
    thumbnail: 'MOBILE PICK',
    title: '출퇴근을 가볍게 만드는 스마트 기기',
    viewers: '2.7K',
  },
  {
    id: 'fashion-office-fit',
    category: 'fashion',
    creator: '핏 체크 윤',
    thumbnail: 'OFFICE FIT',
    title: '평일을 단정하게 만드는 오피스 룩',
    viewers: '1.9K',
  },
  {
    id: 'fashion-weekend-denim',
    category: 'fashion',
    creator: '데님 다이어리',
    thumbnail: 'WEEKEND DENIM',
    title: '주말에 손이 가는 데님 스타일링',
    viewers: '1.3K',
  },
  {
    id: 'fashion-summer-bag',
    category: 'fashion',
    creator: '백스테이지',
    thumbnail: 'SUMMER BAG',
    title: '가볍게 드는 여름 가방 모음',
    viewers: '864',
  },
  {
    id: 'fashion-shoe-closet',
    category: 'fashion',
    creator: '슈즈 클로젯',
    thumbnail: 'SHOE CLOSET',
    title: '하루 종일 편한 데일리 슈즈',
    viewers: '1.1K',
  },
  {
    id: 'food-steak-night',
    category: 'food',
    creator: '프레시 푸드 마스터',
    thumbnail: 'STEAK NIGHT',
    title: '집에서 즐기는 스테이크 다이닝 세트',
    viewers: '4.2K',
  },
  {
    id: 'food-coffee-table',
    category: 'food',
    creator: '커피 테이블',
    thumbnail: 'COFFEE TABLE',
    title: '취향으로 고르는 여름 원두 6종',
    viewers: '1.7K',
  },
  {
    id: 'food-pantry-pick',
    category: 'food',
    creator: '팬트리 픽',
    thumbnail: 'PANTRY PICK',
    title: '매일 꺼내 먹는 건강 간식 큐레이션',
    viewers: '2.2K',
  },
  {
    id: 'food-late-night',
    category: 'food',
    creator: '야식 연구소',
    thumbnail: 'LATE NIGHT',
    title: '늦은 밤에도 부담 없는 한 끼',
    viewers: '1.4K',
  },
  {
    id: 'living-soft-home',
    category: 'living',
    creator: '데코 큐레이터',
    thumbnail: 'SOFT HOME',
    title: '공기를 바꾸는 여름 패브릭 모음',
    viewers: '2.6K',
  },
  {
    id: 'living-kitchen-note',
    category: 'living',
    creator: '키친 노트',
    thumbnail: 'KITCHEN NOTE',
    title: '요리 시간을 줄여 주는 주방 도구',
    viewers: '1.2K',
  },
  {
    id: 'living-bath-reset',
    category: 'living',
    creator: '룸 리셋',
    thumbnail: 'BATH RESET',
    title: '하루 끝을 정돈하는 욕실 루틴',
    viewers: '834',
  },
  {
    id: 'living-pet-corner',
    category: 'living',
    creator: '펫 라이프',
    thumbnail: 'PET CORNER',
    title: '반려동물과 함께 쓰는 리빙 아이템',
    viewers: '1.6K',
  },
  {
    id: 'sport-running-club',
    category: 'sport',
    creator: '러닝 클럽 K',
    thumbnail: 'RUNNING CLUB',
    title: '처음 시작하는 러닝 장비 가이드',
    viewers: '3.8K',
  },
  {
    id: 'sport-weekend-camp',
    category: 'sport',
    creator: '위켄드 캠프',
    thumbnail: 'WEEKEND CAMP',
    title: '가볍게 떠나는 1박 캠핑 준비물',
    viewers: '1.9K',
  },
  {
    id: 'sport-yoga-flow',
    category: 'sport',
    creator: '모닝 요가',
    thumbnail: 'YOGA FLOW',
    title: '집에서 시작하는 스트레칭 루틴',
    viewers: '1.1K',
  },
  {
    id: 'sport-trail-ready',
    category: 'sport',
    creator: '트레일 로그',
    thumbnail: 'TRAIL READY',
    title: '주말 산행을 위한 아웃도어 레이어링',
    viewers: '1.5K',
  },
];

export function getHomeCatalogLives(categoryId: HomeCategoryId): readonly HomeCatalogLive[] {
  if (categoryId === 'all') {
    return homeCatalogLives;
  }

  return homeCatalogLives.filter((live) => live.category === categoryId);
}
