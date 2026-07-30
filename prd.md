# LiveFlow Product Requirements Document

## 0. 문서 정보

| 항목 | 내용 |
|---|---|
| 프로젝트명 | LiveFlow (working title) |
| 문서 목적 | Codex 및 개발자가 동일한 범위와 완료 조건으로 구현하기 위한 제품 요구사항 |
| 대상 릴리스 | Portfolio MVP 1.0 |
| 패키지 관리자 | npm |
| 주요 화면 | 사용자 라이브 화면, 운영자 컨트롤룸 |
| 주요 기술 축 | Next.js, Fastify, Socket.IO, Supabase PostgreSQL, Prisma, AI provider adapter |
| 기준 문서 | 루트 `AGENTS.md`, 본 `prd.md` |

이 문서에서 `MUST`는 MVP 완료에 필수, `SHOULD`는 강한 권장, `COULD`는 후속 확장 항목을 의미한다.

---

## 1. 제품 요약

LiveFlow는 시청자가 라이브 방송에서 상품을 탐색·질문·구매하고, 운영자가 별도 어드민 컨트롤룸에서 상품·쿠폰·채팅·주문을 실시간으로 관리하는 AI 기반 라이브커머스 데모다.

핵심은 두 개의 화면을 따로 만드는 것이 아니라 다음 폐쇄 루프를 실제로 구현하는 것이다.

```text
사용자 행동
→ 서버의 비즈니스 처리와 영속화
→ 운영자 화면의 실시간 업무 발생
→ 운영자의 판단·승인
→ 사용자 화면의 실시간 경험 변화
→ 결과 측정과 감사 기록
```

AI는 단순 챗봇 장식이 아니다.

- 사용자에게는 등록된 상품·정책 데이터에 근거한 Q&A를 제공한다.
- 운영자에게는 대량 채팅을 주제별로 요약하고 공지 답변 초안을 제안한다.
- 중요한 행동은 운영자가 근거를 확인하고 승인한 뒤 실행된다.
- 공개 데모는 비용 없이 동작하도록 Mock AI를 기본값으로 제공한다.

---

## 2. 포트폴리오에서 전달해야 할 메시지

프로젝트를 본 채용담당자와 개발자가 다음과 같이 판단하도록 만드는 것이 목표다.

> “이 개발자는 화면만 만드는 사람이 아니라 사용자 제품과 운영 시스템을 함께 이해한다. 실시간 상태, 대량 데이터, 권한, 주문·재고, AI 검증, 장애 복구까지 고려했기 때문에 우리 회사의 비즈니스 규칙을 익히면 빠르게 실무에 투입할 수 있다.”

프로젝트는 다음 역량을 증명해야 한다.

1. **제품 구현력**: 사용자 여정과 운영자 여정을 연결한다.
2. **실시간 설계력**: Socket room, event sequence, 중복 제거, 재연결 복구를 구현한다.
3. **비즈니스 정확성**: 재고·주문·쿠폰·권한을 서버와 DB가 보장한다.
4. **AI 제품 역량**: structured output, source, 실패 처리, human approval, 평가 fixture를 갖춘다.
5. **운영 품질**: 감사 로그, 에러 상태, 테스트, 로그, 배포 문서를 제공한다.
6. **설명력**: README와 데모 영상에서 문제, 선택, trade-off, 검증 결과를 설명한다.

---

## 3. 해결하려는 문제

### 3.1 사용자 문제

- 라이브 중 어떤 상품을 소개하고 있는지 놓치기 쉽다.
- 채팅이 빠르게 흐르면 상품 정보·배송·사이즈 답변을 찾기 어렵다.
- 쿠폰, 남은 재고, 주문 결과가 서로 다른 위치에서 갱신되어 혼란스럽다.
- 네트워크가 잠깐 끊기면 최신 방송 상태나 메시지를 놓칠 수 있다.

### 3.2 운영자 문제

- 방송 중 상품 노출, 쿠폰, 공지, 채팅, 주문을 여러 도구에서 관리하면 대응이 느리다.
- 많은 채팅에서 반복 질문과 부정적 반응을 실시간으로 파악하기 어렵다.
- AI가 만든 답변을 그대로 발송하면 잘못된 정보나 정책 위반 위험이 있다.
- 주문·재고·고객 응대 변경 이력을 추적하지 못하면 사고 조사와 책임 구분이 어렵다.

---

## 4. 목표와 비목표

### 4.1 MVP 목표

- 사용자 화면과 어드민 화면이 하나의 방송 상태를 공유한다.
- 운영자의 상품·쿠폰·공지 변경이 사용자 화면에 실시간 반영된다.
- 채팅 메시지가 DB에 저장되고 실시간 전파되며 재접속 시 누락분이 복구된다.
- Mock 주문이 서버 transaction과 idempotency 규칙을 따른다.
- AI 상품 Q&A가 근거와 검토 필요 여부를 구조화해 반환한다.
- AI 채팅 요약은 운영자의 승인 전 사용자에게 발행되지 않는다.
- 역할 기반 권한과 감사 로그가 동작한다.
- 핵심 흐름이 Playwright E2E로 검증된다.
- 무료 또는 저비용 공개 데모 배포가 가능하다.

### 4.2 비목표

MVP에서는 다음을 구현하지 않는다.

- 실제 라이브 영상 송출 인프라, WebRTC, HLS 인코딩 파이프라인
- 실제 PG 결제·택배·정산 연동
- 다중 판매자 marketplace 정산
- 모바일 native 앱
- 완전한 추천 시스템
- 실제 대규모 트래픽을 위한 Kubernetes·다중 리전
- AI가 자동으로 환불·차단·쿠폰 발행을 실행하는 자율 에이전트
- 실제 고객 개인정보 또는 민감 데이터
- 완전한 CMS·상품 등록 백오피스

영상은 사전 녹화 MP4를 `startedAt` 기준으로 동기화한 “가짜 라이브”로 구현한다.

---

## 5. 사용자와 역할

### 5.1 Viewer

- 라이브 방송과 현재 노출 상품을 본다.
- 채팅 메시지를 읽고 보낸다.
- AI에 상품 질문을 한다.
- 쿠폰을 확인하고 Mock 주문을 생성한다.
- 자신의 주문 상태를 본다.

### 5.2 Admin

- 방송을 시작·종료한다.
- 방송에 노출할 상품을 선택한다.
- 쿠폰과 공지를 발행한다.
- 채팅을 모니터링하고 메시지를 숨기거나 사용자를 timeout한다.
- AI 채팅 요약과 답변 초안을 검토·수정·승인·거절한다.
- 주문과 재고 경고를 확인한다.
- 감사 로그와 핵심 지표를 확인한다.

### 5.3 System

- 서버 권한을 검증한다.
- 데이터를 영속화하고 실시간 이벤트를 발행한다.
- sequence와 event ID를 발급한다.
- 연결 복구와 snapshot sync를 지원한다.
- AI provider를 호출하거나 Mock 결과를 생성한다.

---

## 6. 대표 데모 시나리오

3분 내에 다음 흐름을 보여줄 수 있어야 한다.

1. 운영자가 `/admin/lives/demo`에서 데모 방송을 시작한다.
2. 사용자 `/live/demo`의 영상과 방송 상태가 실시간으로 LIVE로 변경된다.
3. 운영자가 상품 A를 “현재 소개 상품”으로 지정한다.
4. 사용자 화면에 상품 A 카드, 옵션, 재고가 즉시 나타난다.
5. 시뮬레이터 또는 여러 브라우저에서 채팅이 들어온다.
6. 사용자가 “175cm, 70kg이면 어떤 사이즈인가요?”라고 AI에 질문한다.
7. AI가 상품 사이즈표를 근거로 답하고 source를 표시한다.
8. 운영자가 최근 채팅을 AI로 요약해 “배송 문의”가 급증했음을 확인한다.
9. AI의 공지 초안을 운영자가 수정·승인한다.
10. 승인된 공지가 사용자 화면에 실시간 노출된다.
11. 운영자가 10% 쿠폰을 발행한다.
12. 사용자가 Mock 주문을 완료하고 재고가 양쪽 화면에서 갱신된다.
13. 네트워크를 잠시 끊었다 다시 연결해 누락 채팅과 최신 상품 상태가 복구되는 것을 보여준다.
14. 운영자가 메시지를 숨기고 감사 로그에서 행동 이력을 확인한다.

---

## 7. 정보 구조와 주요 route

### 7.1 공개·사용자 route

```text
/                         # 프로젝트 소개와 Demo 진입
/live/[liveId]            # 사용자 라이브 화면
/orders/[orderId]         # 본인 Mock 주문 결과
```

### 7.2 운영자 route

```text
/admin                    # 데모 운영자 진입
/admin/lives/[liveId]     # 방송 컨트롤룸
/admin/orders             # 주문 목록
/admin/audit-logs         # 감사 로그
/admin/ai-evals           # P1: AI 평가 결과
```

### 7.3 서버 route prefix

```text
/api/v1/*
```

---

## 8. 사용자 화면 요구사항

### 8.1 레이아웃

데스크톱:

```text
┌──────────────────────────────┬──────────────────────┐
│ 사전 녹화 라이브 영상          │ 실시간 채팅           │
│ 방송 상태·연결 상태            │ 새 메시지 안내        │
├──────────────────────────────┴──────────────────────┤
│ 현재 소개 상품 · 옵션 · 재고 · 쿠폰 · 구매            │
├─────────────────────────────────────────────────────┤
│ AI 상품 Q&A · 근거 · 재시도                           │
└─────────────────────────────────────────────────────┘
```

모바일:

```text
영상
방송·연결 상태
현재 상품 및 고정 구매 CTA
채팅 / 상품 정보 / AI 질문 탭
```

### 8.2 방송 상태

상태는 다음을 사용한다.

```text
READY → LIVE → ENDED
```

- READY: 시작 전 안내와 예정 상품을 표시한다.
- LIVE: 영상, 채팅, 상품, 쿠폰, 주문을 활성화한다.
- ENDED: 영상과 채팅 입력을 종료하고 소개 상품 다시보기를 제공한다.
- 사용자가 늦게 접속하면 `startedAt`을 기준으로 영상 재생 위치를 계산한다.
- 자동 재생이 브라우저 정책에 막히면 명확한 재생 버튼을 제공한다.

### 8.3 현재 소개 상품

- 운영자가 선택한 상품 한 개를 강조한다.
- 이미지, 상품명, 가격, 옵션, 재고, 할인·쿠폰 상태를 표시한다.
- 품절 시 구매 CTA를 비활성화하고 이유를 표시한다.
- 상품 변경 이벤트를 받으면 전체 페이지 reload 없이 갱신한다.
- 새로고침 후에도 서버 snapshot의 최신 상품을 표시한다.

### 8.4 쿠폰

- 운영자가 발행한 현재 활성 쿠폰을 표시한다.
- 할인율 또는 정액 할인, 최소 주문 금액, 종료 시각을 표시한다.
- countdown은 보조 정보이며 서버 시간이 최종 기준이다.
- 클라이언트가 계산한 최종 가격을 서버가 신뢰하지 않는다.

### 8.5 주문

- 상품 variant와 수량을 선택해 Mock 주문을 생성한다.
- 주문 버튼 중복 클릭과 네트워크 retry에도 동일 idempotency key로 한 건만 생성한다.
- 주문 중, 성공, 품절, 결제 Mock 실패, 네트워크 오류 상태를 구분한다.
- 주문 성공 후 본인 user room 또는 HTTP 응답으로 결과를 확인한다.

### 8.6 연결 상태

사용자에게 다음 상태를 제공한다.

```text
CONNECTING
CONNECTED
RECOVERING
DISCONNECTED
FAILED
```

- 무료 서버 cold start 중에는 “실시간 서버를 연결하는 중”을 표시한다.
- 연결이 끊겨도 현재 snapshot은 유지한다.
- 재연결 후 최신 상태를 sync하기 전까지 RECOVERING으로 표시한다.
- 일정 횟수 실패하면 수동 재시도 버튼을 제공한다.

---

## 9. 채팅 요구사항

### 9.1 초기 조회와 pagination

- 최초 진입 시 최근 메시지 50개를 HTTP로 조회한다.
- 이전 메시지는 `beforeSequence` cursor로 조회한다.
- 재연결 누락분은 `afterSequence`로 조회한다.
- offset pagination을 사용하지 않는다.

### 9.2 메시지 전송

기본 흐름:

```text
클라이언트 optimistic message
→ POST message API
→ 인증·차단·rate limit·validation
→ DB 저장 및 room sequence 발급
→ transaction commit
→ public room에 chat.message.created 발행
→ HTTP 응답과 Socket 이벤트를 clientMessageId로 병합
```

메시지 상태:

```text
SENDING | SENT | FAILED
```

### 9.3 메시지 데이터

```ts
interface ChatMessage {
  id: string;
  clientMessageId: string;
  roomId: string;
  liveId: string;
  sender: {
    id: string;
    nickname: string;
    role: "VIEWER" | "ADMIN";
  };
  sequence: number;
  type: "USER" | "ADMIN" | "SYSTEM";
  visibility: "VISIBLE" | "HIDDEN";
  content: string;
  createdAt: string;
}
```

### 9.4 채팅 UX

- 최신 위치에 있을 때만 새 메시지를 따라간다.
- 사용자가 위로 스크롤하면 자동 이동하지 않고 “새 메시지 N개” 버튼을 표시한다.
- 메시지 목록은 virtualization한다.
- 한국어 IME 조합 중 Enter로 잘못 전송되지 않아야 한다.
- 실패 메시지는 재전송할 수 있다. 재전송은 같은 `clientMessageId`를 재사용한다.

### 9.5 운영·제재

- Admin은 메시지를 숨길 수 있다.
- Admin은 사용자를 일정 시간 채팅 금지할 수 있다.
- 숨김·timeout은 이유를 입력하고 감사 로그를 남긴다.
- viewer는 admin route, admin room, moderation API를 사용할 수 없다.
- 메시지 길이, 반복 문자, URL 과다, 빈 메시지를 서버에서 검증한다.
- 사용자별·방송별 rate limit을 적용한다.

---

## 10. 운영자 컨트롤룸 요구사항

### 10.1 레이아웃

```text
┌──────────────────────────┬──────────────────────────┐
│ 방송 미리보기·상태 제어     │ 실시간 채팅·운영 액션      │
├──────────────────────────┼──────────────────────────┤
│ 상품 노출·재고·쿠폰         │ 주문·성과·경고             │
├──────────────────────────┴──────────────────────────┤
│ AI 요약·공지 초안·승인 / 감사 로그 요약                │
└─────────────────────────────────────────────────────┘
```

### 10.2 방송 제어

- READY 상태에서 방송 시작
- LIVE 상태에서 방송 종료
- 유효하지 않은 상태 전이를 서버가 거부
- 시작·종료 시각과 actor를 감사 로그에 기록
- 방송 종료 후 신규 viewer 채팅과 주문을 제한

### 10.3 상품 노출

- 방송에 연결된 상품 중 하나를 선택한다.
- 서버 저장 성공 후 `product.featured` 이벤트를 발행한다.
- UI는 pending과 실패 상태를 표시한다.
- 두 admin이 동시에 변경할 수 있는 상황을 대비해 서버 결과를 기준으로 한다.

### 10.4 쿠폰과 공지

- 할인 타입, 값, 최소 주문 금액, 만료 시각을 입력한다.
- 잘못된 할인 조건은 서버가 거부한다.
- 공지는 직접 작성하거나 AI 제안을 수정해 발행한다.
- AI 제안은 승인 전 public room에 발행하지 않는다.

### 10.5 주문·재고

- 최근 주문 목록과 상태를 표시한다.
- 상품 variant별 재고를 표시한다.
- low-stock threshold 이하이면 admin room에 경고한다.
- 주문 성공 시 재고와 매출성 지표를 갱신한다.
- 실제 결제·환불은 Mock 상태로 제한한다.

### 10.6 감사 로그

최소 기록 대상:

- 방송 시작·종료
- 상품 노출 변경
- 쿠폰 발행
- 공지 발행
- 메시지 숨김
- 사용자 timeout
- AI 제안 수정·승인·거절
- 주문 상태의 관리자 변경이 추가될 경우 해당 변경

로그에는 actor, action, entity, before, after, reason, timestamp를 포함한다.

---

## 11. AI 기능 요구사항

### 11.1 공통 원칙

- `AI_MODE=mock`이 공개 데모 기본값이다.
- 실제 provider는 서버 adapter로 교체 가능해야 한다.
- AI 결과는 Zod schema로 검증한다.
- timeout, invalid output, provider error, refusal, cancelled 상태를 구분한다.
- AI가 중요한 운영 행동을 직접 실행하지 않는다.

### 11.2 사용자 상품 Q&A

입력:

- 현재 상품 ID
- 질문
- 상품 설명
- variant와 사이즈표
- 배송·교환·환불 정책
- 판매자 FAQ

출력 계약:

```ts
interface AiProductAnswer {
  answer: string;
  sourceIds: string[];
  confidence: number;
  needsHumanReview: boolean;
  reason: string;
}
```

요구사항:

- 답변 하단에 사용한 근거를 사용자 친화적으로 표시한다.
- source가 없는 단정적 답변을 허용하지 않는다.
- 사이즈 추천은 확정이 아니라 근거 기반 가능성으로 표현한다.
- 정책·안전·민감 판단은 검토 필요 상태로 돌린다.
- Mock mode는 고정 문장만 반환하지 않고 질문 keyword와 source fixture를 바탕으로 결정적인 결과를 생성한다.

### 11.3 운영자 채팅 요약

입력:

- 최근 메시지 최대 100개
- 상품·배송·환불 FAQ
- 방송 중 현재 상품

출력 계약:

```ts
interface AiChatSummary {
  groups: Array<{
    topic: string;
    count: number;
    exampleMessageIds: string[];
    suggestedAnswer: string;
    sourceIds: string[];
    risk: "LOW" | "MEDIUM" | "HIGH";
  }>;
  overallSentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  requiresImmediateAttention: boolean;
}
```

운영 흐름:

```text
분석 요청
→ AI 결과 저장
→ 운영자 검토
→ 수정 / 승인 / 거절
→ 승인 시 system announcement 생성
→ public room 발행
→ 감사 로그
```

### 11.4 AI 평가

MVP에서 MUST:

- curated Q&A fixture 최소 20개
- schema validation 테스트
- expected source ID 포함 여부 테스트
- 금지된 단정 표현 또는 존재하지 않는 정보 검증 fixture

P1에서 SHOULD:

- `/admin/ai-evals`에서 provider/prompt 버전별 결과 비교
- schema success rate, source match rate, 응답 시간, 실패 유형 표시

---

## 12. 실시간 아키텍처

### 12.1 전체 구조

```text
┌──────────────── Vercel Web ────────────────┐
│ /live/[liveId]        /admin/lives/[liveId]│
└──────────────┬────────────────┬─────────────┘
               │ HTTPS API      │ Socket.IO
               ▼                ▼
┌──────────── API + Socket Server ────────────┐
│ Fastify routes · auth · domain services     │
│ Socket authentication · rooms · event emit │
└───────────────────────┬─────────────────────┘
                        ▼
              Supabase PostgreSQL
```

### 12.2 Room

```text
live:{liveId}:public
live:{liveId}:admin
user:{userId}
```

### 12.3 이벤트 envelope

```ts
interface RealtimeEvent<TPayload> {
  eventId: string;
  liveId: string;
  sequence: number;
  type: RealtimeEventType;
  occurredAt: string;
  payload: TPayload;
}
```

### 12.4 public event

```text
live.started
live.ended
product.featured
coupon.published
announcement.published
inventory.updated
chat.message.created
chat.message.hidden
```

### 12.5 admin event

```text
order.created
inventory.low
chat.user.reported
ai.suggestion.created
```

### 12.6 user event

```text
order.status.changed
chat.user.timed_out
coupon.personal.issued   # P1
```

### 12.7 초기 연결과 복구

```text
1. HTTP로 live snapshot과 최근 채팅 조회
2. Socket 연결과 인증
3. live join 요청에 lastEventSequence 전달
4. 서버가 public room 참가
5. 누락 이벤트 또는 snapshot 필요 여부 반환
6. 클라이언트가 eventId/sequence로 병합
7. gap이 크거나 복구 실패 시 snapshot 재조회
```

초기 snapshot의 예:

```ts
interface LiveSnapshot {
  live: LiveSessionDto;
  featuredProduct: ProductDto | null;
  activeCoupon: CouponDto | null;
  products: ProductDto[];
  viewerCount: number;
  lastEventSequence: number;
  chat: {
    messages: ChatMessage[];
    lastMessageSequence: number;
  };
}
```

---

## 13. 핵심 데이터 모델

정확한 필드명은 implementation 단계에서 조정할 수 있지만, 관계와 제약은 유지한다.

### 13.1 사용자·권한

```text
users
- id
- nickname
- role: VIEWER | ADMIN
- created_at
```

### 13.2 방송

```text
live_sessions
- id
- title
- status: READY | LIVE | ENDED
- featured_product_id nullable
- started_at nullable
- ended_at nullable
- next_event_sequence
```

### 13.3 상품·재고

```text
products
- id
- name
- description
- price_krw
- image_url

product_variants
- id
- product_id
- option_name
- stock
- low_stock_threshold

live_products
- live_id
- product_id
- display_order
```

### 13.4 채팅

```text
chat_rooms
- id
- live_id unique
- next_sequence
- status

chat_messages
- id
- room_id
- sender_id
- client_message_id
- sequence
- type
- visibility
- content
- created_at

constraints
- unique(sender_id, client_message_id)
- unique(room_id, sequence)

chat_bans
- id
- room_id
- user_id
- reason
- expires_at nullable
```

### 13.5 쿠폰

```text
coupons
- id
- live_id
- type: PERCENT | FIXED
- value
- min_order_amount_krw
- starts_at
- ends_at
- usage_limit
- used_count
- status
```

### 13.6 주문

```text
orders
- id
- user_id
- live_id
- idempotency_key
- status: PENDING | PAID | FAILED | CANCELLED
- subtotal_krw
- discount_krw
- total_krw
- created_at

constraint
- unique(user_id, idempotency_key)

order_items
- id
- order_id
- product_variant_id
- quantity
- unit_price_krw
```

### 13.7 AI와 감사

```text
ai_suggestions
- id
- live_id
- type
- provider
- model_or_mock_version
- input_hash
- output_json
- status: PENDING | APPROVED | REJECTED
- reviewed_by nullable
- reviewed_at nullable

audit_logs
- id
- actor_id
- action
- entity_type
- entity_id
- before_json nullable
- after_json nullable
- reason nullable
- created_at
```

### 13.8 실시간 이벤트

```text
realtime_events
- id / event_id
- live_id
- sequence
- type
- payload_json
- occurred_at

constraint
- unique(live_id, sequence)
```

MVP에서는 이벤트 replay 범위를 제한할 수 있으며, 오래된 이벤트는 snapshot으로 대체할 수 있다.

---

## 14. REST API 초안

모든 endpoint는 인증·권한·Zod validation·일관된 오류 응답을 적용한다.

### 14.1 Demo session

```text
POST /api/v1/demo/sessions
body: { role: "VIEWER" | "ADMIN", nickname?: string }
```

- `DEMO_MODE=true`일 때만 활성화한다.
- 짧은 수명의 signed token을 반환한다.
- 실제 배포에서 admin 기능은 demo 전용 데이터에만 영향을 준다.

### 14.2 Live

```text
GET  /api/v1/lives/:liveId/snapshot
POST /api/v1/admin/lives/:liveId/start
POST /api/v1/admin/lives/:liveId/end
PATCH /api/v1/admin/lives/:liveId/featured-product
```

### 14.3 Chat

```text
GET  /api/v1/lives/:liveId/messages?limit=50&beforeSequence=
GET  /api/v1/lives/:liveId/messages?limit=200&afterSequence=
POST /api/v1/lives/:liveId/messages
PATCH /api/v1/admin/chat/messages/:messageId/hide
POST /api/v1/admin/lives/:liveId/chat-bans
DELETE /api/v1/admin/lives/:liveId/chat-bans/:banId
```

### 14.4 Coupon and announcement

```text
POST /api/v1/admin/lives/:liveId/coupons
POST /api/v1/admin/lives/:liveId/announcements
```

### 14.5 Order

```text
POST /api/v1/orders
GET  /api/v1/orders/:orderId
GET  /api/v1/admin/orders?liveId=&cursor=
```

### 14.6 AI

```text
POST  /api/v1/lives/:liveId/ai/product-questions
POST  /api/v1/admin/lives/:liveId/ai/chat-summaries
PATCH /api/v1/admin/ai/suggestions/:suggestionId
body: { action: "APPROVE" | "REJECT", editedOutput?: ... }
```

### 14.7 Health

```text
GET /health
```

- DB와 외부 AI provider를 항상 강제 호출하지 않는 가벼운 liveness를 제공한다.
- 필요하면 별도 readiness endpoint를 추가한다.

---

## 15. 상태 관리 원칙

### 15.1 Server state

TanStack Query:

- live snapshot
- products
- messages pages
- orders
- audit logs
- AI suggestions

### 15.2 Realtime state

- Socket 이벤트는 Zod로 검증 후 Query cache에 부분 반영한다.
- 마지막 event sequence, message sequence, processed event ID는 전용 작은 store 또는 안정적인 ref에 저장한다.
- 서버 데이터 전체를 복제한 대형 전역 store는 만들지 않는다.

### 15.3 Local UI state

- 선택 variant
- 탭
- modal
- 채팅 draft
- 연결 표시용 transient state

### 15.4 Form state

React Hook Form + Zod:

- 쿠폰 생성
- 공지 작성
- AI 제안 수정
- 주문 옵션

---

## 16. 주문·재고 규칙

### 16.1 서버 계산

- 가격, 할인, 최종 금액은 서버가 DB 상태로 다시 계산한다.
- 쿠폰 유효 기간과 사용 제한은 서버 시간으로 검증한다.
- 클라이언트가 전송한 금액을 신뢰하지 않는다.

### 16.2 idempotency

- 클라이언트는 주문 시 `Idempotency-Key`를 생성한다.
- 서버는 `(userId, idempotencyKey)` unique constraint로 중복 생성 방지한다.
- 동일 key 재요청은 기존 주문 결과를 반환한다.

### 16.3 재고 transaction

```text
주문 요청
→ idempotency 확인
→ variant row의 조건부 재고 차감
→ 주문·주문 항목 저장
→ 감사/이벤트 저장
→ commit
→ inventory.updated 및 order.created 발행
```

- 재고 부족이면 transaction을 실패시키고 명확한 오류를 반환한다.
- 마지막 재고에 대한 동시 주문 테스트를 포함한다.

---

## 17. 인증과 보안

### 17.1 Demo 인증

MVP는 외부 OAuth보다 테스트 가능한 demo session을 우선한다.

- landing에서 Viewer 또는 Admin 데모 세션을 발급한다.
- 서버가 signed token에 role과 user ID를 넣는다.
- Socket handshake와 REST API가 동일 token을 검증한다.
- Admin token 없이는 admin route/API/room을 사용할 수 없다.

### 17.2 보안 요구사항

- client의 role, user ID, 가격, 재고를 신뢰하지 않는다.
- AI와 DB secret은 server 환경변수에만 둔다.
- CORS origin allowlist를 사용한다.
- 메시지·주문·AI endpoint에 rate limit을 적용한다.
- 에러에 stack, SQL, secret을 노출하지 않는다.
- 사용자 입력은 HTML로 직접 렌더링하지 않는다.
- 로그에 token과 실제 개인정보를 남기지 않는다.
- 공개 demo 데이터는 재설정 가능해야 한다.

---

## 18. 비기능 요구사항

### NFR-RT: 실시간 신뢰성

- `NFR-RT-01`: 연결된 두 브라우저에서 admin 변경이 정상 네트워크 기준 1초 이내에 보이는 것을 목표로 측정한다.
- `NFR-RT-02`: 같은 event ID를 두 번 수신해도 UI는 한 번만 반영한다.
- `NFR-RT-03`: sequence gap을 감지하면 누락 조회 또는 snapshot sync를 수행한다.
- `NFR-RT-04`: Socket 서버 재시작 후 재연결하여 최신 상태를 복구한다.

### NFR-PERF: 성능

- `NFR-PERF-01`: 최소 2,000개의 seed 채팅을 보유해도 DOM 전체를 렌더링하지 않는다.
- `NFR-PERF-02`: 사용자가 과거 메시지를 읽는 동안 새 메시지 유입이 스크롤 위치를 강제로 바꾸지 않는다.
- `NFR-PERF-03`: 사용자 화면 초기 핵심 정보는 영상 전체 다운로드 완료를 기다리지 않고 표시한다.
- `NFR-PERF-04`: 성능 수치는 테스트 환경과 재현 방법을 README에 기록한다.

### NFR-SEC: 보안

- `NFR-SEC-01`: viewer token으로 admin API 요청 시 403을 반환한다.
- `NFR-SEC-02`: viewer socket은 admin room에 들어갈 수 없다.
- `NFR-SEC-03`: duplicate order와 message가 DB 제약으로 방지된다.
- `NFR-SEC-04`: secret이 client bundle과 저장소에 포함되지 않는다.

### NFR-UX: UX와 접근성

- `NFR-UX-01`: 키보드로 채팅 전송, 상품 선택, admin 주요 제어를 수행할 수 있다.
- `NFR-UX-02`: 상태를 색상만으로 전달하지 않는다.
- `NFR-UX-03`: 연결 중·복구 중·실패·재시도 상태를 사용자에게 표시한다.
- `NFR-UX-04`: 모바일 viewer 화면에서 영상과 구매 CTA가 사용 가능하다.

### NFR-TEST: 테스트

- `NFR-TEST-01`: root lint, typecheck, unit/integration test script가 존재한다.
- `NFR-TEST-02`: 핵심 사용자·admin 동시 흐름을 Playwright로 검증한다.
- `NFR-TEST-03`: DB migration을 빈 DB에 재적용할 수 있다.
- `NFR-TEST-04`: 실행하지 않은 검증을 문서에서 통과로 표현하지 않는다.

---

## 19. 기능 요구사항 목록

### 방송·상품

- `FR-LIVE-01` Admin은 READY 방송을 시작할 수 있다. MUST
- `FR-LIVE-02` Admin은 LIVE 방송을 종료할 수 있다. MUST
- `FR-LIVE-03` Viewer는 방송 상태 변경을 실시간 수신한다. MUST
- `FR-LIVE-04` Admin은 현재 소개 상품을 선택할 수 있다. MUST
- `FR-LIVE-05` Viewer는 최신 소개 상품을 실시간·새로고침 후 모두 확인한다. MUST
- `FR-LIVE-06` 영상은 `startedAt` 기준 mock live 위치를 계산한다. SHOULD

### 채팅

- `FR-CHAT-01` Viewer와 Admin은 최근 메시지를 조회한다. MUST
- `FR-CHAT-02` Viewer는 메시지를 보내고 optimistic 상태를 본다. MUST
- `FR-CHAT-03` 메시지는 DB 저장 후 public room에 발행된다. MUST
- `FR-CHAT-04` 같은 clientMessageId는 한 번만 저장된다. MUST
- `FR-CHAT-05` 재접속 시 마지막 sequence 이후 메시지를 복구한다. MUST
- `FR-CHAT-06` Admin은 메시지를 숨길 수 있다. MUST
- `FR-CHAT-07` Admin은 사용자를 timeout할 수 있다. SHOULD
- `FR-CHAT-08` 대량 메시지 목록은 virtualization한다. MUST

### 쿠폰·공지

- `FR-PROMO-01` Admin은 유효한 쿠폰을 발행한다. MUST
- `FR-PROMO-02` Viewer는 활성 쿠폰을 실시간 확인한다. MUST
- `FR-PROMO-03` Admin은 공지를 발행한다. MUST
- `FR-PROMO-04` AI 초안은 승인 전 발행되지 않는다. MUST

### 주문·재고

- `FR-ORDER-01` Viewer는 Mock 주문을 생성한다. MUST
- `FR-ORDER-02` 서버가 가격과 쿠폰을 다시 계산한다. MUST
- `FR-ORDER-03` 같은 idempotency key는 한 주문만 만든다. MUST
- `FR-ORDER-04` 재고 차감과 주문 저장은 transaction이다. MUST
- `FR-ORDER-05` Admin은 최근 주문과 재고를 본다. SHOULD
- `FR-ORDER-06` low stock event를 admin이 받는다. SHOULD

### AI

- `FR-AI-01` Viewer는 상품 질문을 제출한다. MUST
- `FR-AI-02` AI 답변은 sourceIds와 검토 필요 여부를 포함한다. MUST
- `FR-AI-03` Mock AI가 실제 contract와 실패 상태를 구현한다. MUST
- `FR-AI-04` Admin은 최근 채팅 요약을 요청한다. MUST
- `FR-AI-05` Admin은 AI 제안을 수정·승인·거절한다. MUST
- `FR-AI-06` AI 결정과 review 결과가 감사 로그에 남는다. MUST
- `FR-AI-07` curated eval fixture를 자동 검증한다. MUST

### 운영·보안

- `FR-OPS-01` Viewer와 Admin 권한을 서버가 구분한다. MUST
- `FR-OPS-02` 주요 admin 행동을 감사 로그로 조회한다. MUST
- `FR-OPS-03` 연결 상태와 복구 상태를 UI에 표시한다. MUST
- `FR-OPS-04` `/health` endpoint를 제공한다. MUST
- `FR-OPS-05` 데모 데이터를 다시 seed할 수 있다. MUST

---

## 20. 로딩·빈 상태·오류 상태

각 주요 화면은 아래 상태를 명시적으로 갖는다.

### 사용자 라이브

- 방송을 찾을 수 없음
- 방송 시작 전
- 방송 종료
- Socket 연결 중
- 무료 서버 cold start
- 연결 복구 중
- 현재 상품 없음
- 상품 품절
- 쿠폰 없음 또는 만료
- 주문 처리 중·성공·실패
- AI 분석 중·실패·재시도·검토 필요

### 운영자

- 권한 없음
- 방송 데이터 없음
- 실시간 연결 실패
- 상품 변경 pending·실패
- 쿠폰 validation 오류
- 최근 채팅 없음
- AI 결과 없음·invalid output·timeout
- 주문 없음
- 감사 로그 없음

오류는 사용자의 다음 행동을 포함해야 한다. 예: 재시도, 새로고침, 이전 상태 유지, 관리자 문의.

---

## 21. 분석 이벤트와 지표

MVP에서 외부 analytics provider는 필수가 아니다. 서버 또는 DB에 다음 이벤트를 최소 기록할 수 있다.

```text
live_view_started
chat_message_sent
product_featured_seen
coupon_seen
order_started
order_succeeded
order_failed
ai_question_submitted
ai_answer_viewed
ai_suggestion_approved
ai_suggestion_edited
ai_suggestion_rejected
socket_recovery_started
socket_recovery_succeeded
socket_recovery_failed
```

운영자 화면의 최소 지표:

- 현재 viewer 수: 근사치임을 표시
- 총 채팅 수
- 상품별 주문 수와 Mock 매출
- 쿠폰 사용 수
- AI 제안 승인·수정·거절 수
- 연결 복구 성공·실패 수 또는 로그

지표가 어떤 운영 행동으로 이어지는지 설명해야 하며, 의미 없는 차트 수를 늘리지 않는다.

---

## 22. 테스트 수용 기준

### 22.1 필수 E2E

1. 두 browser context에서 admin 상품 변경이 viewer에 반영된다.
2. admin 쿠폰 발행이 viewer에 표시되고 서버 가격 계산에 반영된다.
3. viewer 메시지가 viewer/admin에 한 번씩 표시된다.
4. 같은 clientMessageId 중복 요청이 한 DB row만 만든다.
5. Socket 이벤트가 HTTP 응답보다 먼저 와도 메시지가 중복되지 않는다.
6. offline 동안 발생한 메시지를 reconnect 후 복구한다.
7. admin이 메시지를 숨기면 viewer에서도 숨겨진다.
8. viewer가 admin API를 호출하면 거부된다.
9. 같은 주문 idempotency key를 반복해도 주문은 한 개다.
10. 한 개 남은 재고를 두 사용자가 동시에 주문하면 한 주문만 성공한다.
11. AI suggestion은 승인 전 공지로 발행되지 않는다.
12. 승인된 AI 공지가 viewer에 실시간 표시되고 audit log가 생성된다.

### 22.2 필수 단위·통합

- 방송 상태 전이
- 쿠폰 validation과 계산
- event dedupe와 sequence gap
- chat message schema
- order transaction
- 권한 matrix
- AI output schema
- AI source fixture
- migration reset 및 seed

### 22.3 수동 QA

- 모바일 viewport의 핵심 viewer UX
- 한국어 IME 채팅 입력
- 브라우저 자동 재생 차단
- free-tier cold start 안내
- 장시간 비활성 후 reconnect
- 키보드 focus와 screen-reader label

---

## 23. 구현 단계

각 단계는 독립적으로 데모 가능한 세로 흐름이어야 한다.

### Phase 0 — Bootstrap

목표:

- npm workspaces
- `apps/web`, `apps/server`, `packages/contracts`, `packages/database`
- TypeScript strict
- lint, format, typecheck, test scripts
- Supabase development project connection
- `.env.example`
- health endpoint

완료 기준:

- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- 최소 smoke test

### Phase 1 — Static product shell and demo session

목표:

- landing
- viewer/admin route shell
- demo role session
- mock live/product data
- responsive layout와 기본 상태

완료 기준:

- viewer/admin 권한이 구분됨
- 정적 핵심 화면이 모바일·데스크톱에서 보임

### Phase 2 — First realtime vertical slice

목표:

```text
Admin featured product 변경
→ DB 저장
→ Socket public room event
→ Viewer 반영
→ 새로고침·재접속 유지
```

완료 기준:

- 이 흐름의 통합 테스트와 E2E
- event envelope, sequence, snapshot 구현

### Phase 3 — Reliable chat

목표:

- 최근 50개 조회
- message POST
- clientMessageId idempotency
- Socket 전파
- optimistic status
- dedupe
- before/after sequence pagination
- reconnect recovery
- virtualization
- message hide

완료 기준:

- `FR-CHAT-01`~`FR-CHAT-06`, `FR-CHAT-08`
- 필수 chat E2E 통과

### Phase 4 — Coupon, order, inventory

목표:

- coupon publish
- viewer coupon
- Mock order
- server price calculation
- idempotency
- stock transaction
- order/admin event

완료 기준:

- 동시 마지막 재고 테스트
- 중복 주문 테스트

### Phase 5 — AI product Q&A

목표:

- provider interface
- deterministic Mock provider
- structured output
- source display
- timeout/invalid/retry 상태
- curated fixtures

완료 기준:

- 공개 데모가 provider key 없이 동작
- AI schema/source tests 통과

### Phase 6 — AI admin assistant and audit

목표:

- chat batch summary
- suggestion review
- edit/approve/reject
- approved announcement
- audit log

완료 기준:

- 승인 전 미발행
- 승인 후 viewer 실시간 반영
- audit E2E

### Phase 7 — Quality and deployment

목표:

- error/connection UX
- Playwright full critical path
- performance measurement
- accessibility QA
- Vercel + Render-compatible server + Supabase PostgreSQL
- README, architecture diagram, demo seed/reset

완료 기준:

- 배포 URL에서 viewer/admin 두 브라우저 테스트
- 실행한 검증과 제한 사항 문서화

### P1 — Portfolio differentiators

- AI eval dashboard
- synthetic chat simulator
- event replay debugging panel
- Redis Adapter architecture ADR와 optional local compose
- Outbox pattern experiment
- advanced admin analytics

P1은 MVP를 지연시키지 않는다.

---

## 24. 배포 목표

초기 무료 공개 데모 목표:

```text
Web: Vercel 계열 정적/Next.js 배포
API + Socket: WebSocket을 지원하는 단일 Node Web Service
DB: Supabase managed PostgreSQL
AI: Mock provider 기본, real provider optional
```

현재 작업 가정:

- Web: Vercel
- API/Socket: Render
- DB: Supabase managed PostgreSQL

배포 시점에 무료 플랜과 WebSocket 조건이 바뀔 수 있으므로 공식 문서를 다시 확인한다.

배포 요구사항:

- server는 `process.env.PORT`와 `0.0.0.0`을 사용한다.
- frontend origin allowlist를 환경변수로 설정한다.
- `/health` endpoint가 있다.
- cold start와 reconnect UX가 있다.
- DB migration과 seed를 명시적으로 실행한다.
- Prisma migration을 schema의 source of truth로 유지한다. Supabase Dashboard의 수동 schema 변경은 허용하지 않는다.
- 이번 구조에서는 Fastify + Prisma만 DB에 연결한다. Data API를 활성화하거나 browser direct access를 도입하는 변경은 RLS 정책과 테스트를 함께 포함한다.
- 공개 demo에는 reset 전략과 rate limit이 있다.
- single Socket instance를 유지한다. 자동 scale-out을 켤 경우 Redis Adapter 없이 안전하다고 가정하지 않는다.

---

## 25. 환경변수 초안

```env
# Shared/runtime
NODE_ENV=development

# Database — Supabase Dashboard의 Connect 화면에서 가져온 server-side connection string
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=replace-me
DEMO_MODE=true

# Web to server
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000

# AI
AI_MODE=mock
OPENAI_API_KEY=
```

실제 secret은 `.env.example`에 넣지 않는다.

---

## 26. Definition of Done

기능은 다음을 모두 만족해야 완료다.

1. 요구사항 ID와 사용자·운영자 결과가 명확하다.
2. 성공 경로뿐 아니라 로딩·빈 상태·오류·권한·재시도 상태가 있다.
3. 외부 입력이 검증된다.
4. DB와 권한 영향이 검토된다.
5. 실시간 이벤트가 공유 contract를 사용한다.
6. 새 동작을 검증하는 테스트가 있다.
7. 관련 lint, typecheck, test가 실제로 실행되어 통과한다.
8. migration이 있으면 빈 DB 재적용과 seed가 검증된다.
9. AI 변경이면 schema·source·failure fixture가 검증된다.
10. 문서와 데모 설명이 실제 구현과 일치한다.
11. 남은 위험과 수동 QA가 보고된다.
12. 사용자의 명시적 요청 없이는 commit, push, PR을 만들지 않는다.

---

## 27. 핵심 위험과 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| 기능 범위 과다 | 완성도 저하 | Phase별 세로 흐름, P1 분리 |
| Socket 이벤트 유실 | UI 불일치 | DB source of truth, sequence, snapshot/recovery |
| HTTP/Socket 중복 | 메시지 중복 | clientMessageId/eventId dedupe |
| 동시 재고 차감 | 초과 판매 | DB transaction, conditional update, concurrency test |
| AI 환각 | 잘못된 안내 | source 요구, structured output, human review |
| 무료 서버 cold start | 첫인상 저하 | health wake-up, 연결 상태 UX, 명시적 안내 |
| admin demo 악용 | 데이터 훼손 | demo-only dataset, rate limit, reset, 제한된 권한 |
| 과도한 추상화 | 개발 지연 | 필요한 시점에만 adapter/package 도입 |
| 기술 스택 전시화 | 제품 흐름 약화 | 기능·비즈니스 기준으로 라이브러리 선택 |

---

## 28. 구현 중 열어둘 결정

다음 항목은 bootstrap 또는 해당 phase에서 ADR로 확정한다.

1. Node.js 정확한 LTS 버전
2. Prisma의 client 생성 위치와 serverless 연결 전략
3. Socket 인증 token 저장·전달 방식
4. event replay 보존 기간과 snapshot 기준
5. viewer count를 socket presence로 계산할지 별도 heartbeat를 둘지
6. 실제 AI provider 연결 여부와 모델 선택
7. 공개 demo 데이터 자동 reset 주기
8. Render 외 API/Socket 배포 provider를 변경할지

이 결정들은 MVP의 사용자 흐름을 바꾸지 않는 범위에서 선택한다.

---

## 29. Codex 작업 요청 예시

Codex에는 큰 프로젝트 전체를 한 번에 요청하지 않고 Phase와 요구사항 ID를 기준으로 요청한다.

### 예시 1: Bootstrap

```text
AGENTS.md와 prd.md를 읽고 Phase 0만 구현해줘.
패키지 관리자는 npm이며 npm workspaces를 사용해.
Git 초기화, 브랜치, commit, push는 하지 마.
완료 후 변경 파일, 실행한 명령과 실제 결과, 남은 위험을 보고해.
```

### 예시 2: 최초 실시간 세로 흐름

```text
Phase 2와 FR-LIVE-04, FR-LIVE-05, NFR-RT-02를 구현해줘.
Admin이 featured product를 변경하면 DB 저장 후 Socket public room으로 발행하고 Viewer가 반영하도록 해.
새로고침과 재접속 후에도 최신 상태가 유지되어야 해.
관련 contract, integration test, Playwright E2E를 포함하고 다른 기능은 추가하지 마.
Git 작업은 하지 마.
```

### 예시 3: 채팅 신뢰성

```text
Phase 3 중 FR-CHAT-02~FR-CHAT-05만 구현해줘.
HTTP 저장 + Socket 전파, clientMessageId idempotency, optimistic status, HTTP/Socket 도착 순서와 무관한 dedupe, afterSequence 복구를 포함해.
메시지 moderation과 AI는 이번 변경에서 제외해.
검증 명령과 결과를 정확히 보고해.
```

---

## 30. 최종 포트폴리오 산출물

MVP 코드 외에 다음을 제공한다.

- 배포된 viewer URL
- 배포된 admin demo URL
- 3분 데모 영상
- README: 문제, 사용자, 실행, 아키텍처, 핵심 기술 결정, 테스트, 제한 사항
- 시스템 구성도
- 실시간 message/product/order sequence diagram
- 성능 측정 결과와 재현 방법
- AI eval fixture와 결과
- ADR 최소 2개: 실시간 복구, AI human approval
- 알려진 한계와 production 확장 계획

최종 소개 문장:

> LiveFlow는 사용자 라이브 쇼핑 화면과 운영자 컨트롤룸을 실시간으로 연결하고, 메시지·상품·쿠폰·주문 상태를 안정적으로 동기화하며, 근거 기반 AI 제안을 사람의 승인 아래 운영에 반영하는 라이브커머스 플랫폼입니다.
