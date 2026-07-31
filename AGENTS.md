# AGENTS.md

이 문서는 저장소 루트부터 하위 전체 디렉터리에 적용되는 작업 지침이다. 더 하위 디렉터리에 별도의 `AGENTS.md`가 생기면 해당 범위에서는 더 구체적인 지침이 우선한다. 단, 시스템·개발자·사용자의 직접 지시가 항상 이 문서보다 우선한다.

## 1. 프로젝트 미션

프로젝트의 작업명은 **LiveFlow**다.

LiveFlow는 다음 두 화면이 하나의 실시간 비즈니스 흐름으로 연결되는 AI 기반 라이브커머스 데모다.

- 사용자 화면: 라이브 영상, 실시간 채팅, 현재 노출 상품, 쿠폰, 재고, Mock 주문, AI 상품 Q&A
- 운영자 화면: 방송 제어, 상품 노출, 쿠폰·공지 발행, 채팅 운영, 주문·재고 확인, AI 채팅 요약 및 승인

이 프로젝트의 목적은 단순한 쇼핑몰이나 챗봇을 만드는 것이 아니다. 다음 역량을 실제 동작하는 코드로 증명해야 한다.

1. 사용자 제품과 어드민 운영 도구를 함께 설계하는 능력
2. 실시간 이벤트의 중복·누락·재연결을 다루는 능력
3. 주문·재고·권한처럼 서버가 책임져야 하는 비즈니스 규칙을 구분하는 능력
4. AI 결과를 구조화하고, 근거와 사람의 승인을 포함해 안전하게 제품에 연결하는 능력
5. 테스트·관측성·문서화를 포함해 배포 가능한 수준으로 마무리하는 능력

## 2. 작업 전 반드시 읽을 문서

작업 시작 전 다음 순서로 확인한다.

1. 루트 `AGENTS.md`
2. `prd.md`
3. 작업 대상 경로에 더 가까운 하위 `AGENTS.md`
4. 루트와 관련 workspace의 `package.json`
5. 관련 스키마, 테스트, 기존 구현

`prd.md`는 제품 범위와 수용 기준의 기준 문서다. 구현과 PRD가 충돌하면 임의로 범위를 바꾸지 말고 충돌을 보고한다.

## 3. 의사결정 우선순위

의사결정은 다음 순서를 따른다.

1. 정확성 및 데이터 일관성
2. 보안과 권한 검증
3. 사용자에게 명확한 오류·복구 경험
4. 테스트 가능성과 관측 가능성
5. 단순하고 유지보수 가능한 구조
6. 성능
7. 구현 속도

화려한 UI나 새로운 라이브러리는 위 항목을 희생하면서까지 우선하지 않는다.

## 4. 패키지 관리자와 런타임

- 패키지 관리자는 **npm만 사용**한다.
- `pnpm`, `yarn`, `bun` 명령과 lockfile을 추가하지 않는다.
- 루트 lockfile은 `package-lock.json` 하나만 유지한다.
- 모노레포는 npm workspaces를 사용한다.
- Node.js 버전은 저장소의 `.nvmrc`와 `package.json#engines`를 따른다.
- 버전이 아직 정해지지 않은 초기 bootstrap에서는 지원 중인 Node.js LTS를 선택하고, 선택한 정확한 버전을 `.nvmrc`, `engines`, 문서에 함께 고정한다.
- 의존성을 추가하기 전에 기존 의존성으로 해결 가능한지 확인한다.
- 의존성을 추가하거나 크게 올릴 때는 목적, 대안, 번들·보안·유지보수 영향을 최종 보고에 기록한다.

## 5. 목표 저장소 구조

초기 목표 구조는 다음과 같다.

```text
liveflow/
├─ apps/
│  ├─ web/                 # Next.js 사용자 화면 + 어드민 화면
│  └─ server/              # NestJS REST API + Socket.IO Gateway 서버
├─ packages/
│  ├─ contracts/           # Zod 스키마, API/Socket 공유 계약, DTO
│  └─ database/            # Prisma 스키마, migration, seed, DB client
├─ docs/
│  ├─ adr/                 # 중요한 기술 의사결정 기록
│  └─ diagrams/            # 구조·시퀀스 다이어그램
├─ AGENTS.md
├─ prd.md
├─ package.json
└─ package-lock.json
```

원칙:

- UI 코드는 `apps/web`, 서버 실행 코드는 `apps/server`에 둔다.
- 프론트와 서버가 함께 사용하는 타입은 복사하지 않고 `packages/contracts`에서 공유한다.
- DB 접근은 원칙적으로 `packages/database`를 통해 수행한다.
- 지나친 공통화는 금지한다. 실제로 두 곳 이상에서 안정적으로 재사용되는 코드만 패키지로 추출한다.
- MVP 단계에서 별도 `packages/ui`는 필수가 아니다.

## 6. 기본 기술 방향

정확한 버전은 bootstrap 시 lockfile로 고정한다.

- Web: Next.js App Router, React, TypeScript
- Server: Node.js, NestJS, Fastify adapter, Socket.IO
- Validation/Contract: Zod
- Database: Supabase managed PostgreSQL, Prisma ORM
- Server state: TanStack Query
- Local UI state: React state를 우선하고, 필요할 때만 작은 store를 사용
- Form: React Hook Form + Zod
- Virtualization: TanStack Virtual 또는 동등한 검증된 도구
- Unit/Integration: Vitest
- E2E: Playwright
- Logging: 구조화 로그
- AI: provider adapter + Mock provider 기본값

기술 교체는 가능하지만, 교체 전에 `prd.md`의 요구사항을 더 단순하고 안정적으로 충족하는 이유를 설명해야 한다.

## 7. 작업 방식

- 먼저 저장소와 관련 코드를 읽고, 이미 존재하는 패턴을 재사용한다.
- 한 번에 하나의 집중된 변경만 수행한다.
- 큰 기능은 사용자에게 보이는 가장 작은 세로 흐름으로 나눈다.
- 예: `어드민 상품 노출 클릭 → 서버 저장 → Socket 이벤트 → 사용자 화면 반영 → 새로고침 후 유지`를 먼저 완성한다.
- 불필요한 선행 리팩터링을 하지 않는다.
- 요구되지 않은 기능을 “나중에 필요할 것 같아서” 추가하지 않는다.
- 선택지가 여러 개라면 가장 작고 되돌리기 쉬운 선택을 한다.
- 불명확한 부분은 합리적인 가정을 최소 범위로 적용하고 최종 보고에 명시한다.
- 동작하지 않는 placeholder를 완료된 기능처럼 남기지 않는다.
- TODO는 소유자·이유·완료 조건이 명확할 때만 추가한다.

## 8. 구현 계획과 범위 관리

작업이 여러 파일 또는 여러 단계에 걸치면 구현 전에 짧은 계획을 세운다.

계획에는 다음을 포함한다.

1. 해결할 사용자 또는 운영자 흐름
2. 변경할 주요 파일과 계층
3. 데이터·보안 영향
4. 실행할 검증
5. 의도적으로 제외하는 범위

`prd.md`의 요구사항 ID를 구현·테스트·보고에 연결한다. 예: `FR-CHAT-04`, `NFR-RT-02`.

## 9. TypeScript 및 일반 코딩 규칙

- TypeScript strict mode를 유지한다.
- `any`를 사용하지 않는다. 외부 입력은 `unknown`으로 받고 Zod 등으로 검증한다.
- 타입 단언은 최소화하고, 단언이 필요한 이유를 코드로 드러낸다.
- 공개 함수와 도메인 함수는 입력·출력 타입을 명확히 한다.
- 이름은 역할과 비즈니스 의미를 드러내야 한다.
- 매직 문자열은 공유 계약 또는 상수로 이동한다.
- 시간은 저장·전송 시 UTC ISO 8601을 사용한다.
- 금액은 부동소수점이 아니라 정수 최소 화폐 단위로 저장한다. KRW 데모는 정수 원 단위다.
- ID는 서버가 생성하고, 클라이언트 임시 ID와 영속 ID를 구분한다.
- 복잡한 분기는 작은 도메인 함수로 분리하고 단위 테스트를 작성한다.
- 주석은 코드가 무엇을 하는지가 아니라 왜 그렇게 해야 하는지 설명한다.

## 10. 프론트엔드 규칙

- App Router의 Server/Client Component 경계를 의식한다.
- 브라우저 API, Socket.IO client, 상호작용 상태가 필요한 컴포넌트만 Client Component로 만든다.
- 서버 데이터는 TanStack Query cache를 기준으로 관리한다.
- Socket 이벤트는 별도 영구 저장소를 만들기보다 검증 후 Query cache 또는 전용 실시간 store에 병합한다.
- 폼 상태는 React Hook Form, URL로 공유되어야 하는 필터는 URL search params를 사용한다.
- 전역 store에 서버 데이터, 폼 데이터, 모달 상태를 모두 넣지 않는다.
- 로딩, 빈 상태, 오류, 재시도, 권한 없음, 연결 복구 중 상태를 명시적으로 구현한다.
- 사용자 입력을 `dangerouslySetInnerHTML`로 렌더링하지 않는다.
- 낙관적 UI에는 실패 rollback 또는 재동기화 경로가 있어야 한다.
- 리스트 key는 배열 index가 아니라 안정적인 ID를 사용한다.
- 채팅은 사용자가 최신 위치에 있을 때만 자동 스크롤한다. 과거 메시지를 읽는 사용자를 강제로 아래로 이동시키지 않는다.
- 데스크톱과 모바일 핵심 흐름을 모두 지원한다.

## 11. 서버와 API 규칙

- API prefix는 `/api/v1`을 사용한다.
- 모든 외부 입력은 route 경계에서 검증한다.
- 인증과 권한 검증은 서버에서 수행한다. 클라이언트가 보낸 `userId`, `role`, 가격, 재고 값을 신뢰하지 않는다.
- 에러 응답은 일관된 code와 message를 갖는다.

```ts
interface ApiErrorResponse {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}
```

- 도메인 오류와 예상하지 못한 서버 오류를 구분한다.
- 예상하지 못한 오류의 내부 stack, SQL, secret을 클라이언트에 노출하지 않는다.
- 쓰기 API는 권한, 검증, DB transaction, 감사 로그, 실시간 발행 순서를 명확히 한다.
- 재시도 가능한 중요한 쓰기에는 `Idempotency-Key` 또는 `clientMessageId`를 사용한다.
- 주문 생성과 재고 차감은 하나의 서버 transaction에서 처리한다.
- API가 성공 응답을 반환하기 전에 필요한 영속화가 완료되어야 한다.

## 12. 실시간 통신 규칙

Socket.IO는 전달 통로이고 PostgreSQL이 데이터의 기준이다.

### 12.1 Room 규칙

```text
live:{liveId}:public   # 시청자와 운영자 공통 이벤트
live:{liveId}:admin    # 운영자 전용 이벤트
user:{userId}          # 특정 사용자의 개인 이벤트
```

- 클라이언트가 임의로 room 권한을 결정하지 않는다.
- 서버가 handshake 인증 및 권한 검증 후 `socket.join()`을 수행한다.
- `socket.id`를 사용자 ID로 취급하지 않는다.
- Socket 서버 재시작 후 room은 다시 구성될 수 있어야 한다.

### 12.2 이벤트 계약

모든 실시간 이벤트는 공유 계약으로 정의하고 런타임 검증 가능해야 한다.

```ts
interface RealtimeEvent<TPayload> {
  eventId: string;
  liveId: string;
  sequence: number;
  type: string;
  occurredAt: string;
  payload: TPayload;
}
```

- `eventId`는 중복 제거에 사용한다.
- `sequence`는 stream 내 순서와 누락 감지에 사용한다.
- 이벤트 타입과 payload는 discriminated union으로 정의한다.
- 이벤트 이름과 REST DTO를 서버와 프론트에서 따로 복사하지 않는다.

### 12.3 저장과 발행

- 먼저 DB transaction을 commit하고 그 결과를 Socket으로 발행한다.
- DB 저장 전 이벤트를 발행하지 않는다.
- 클라이언트는 같은 이벤트 또는 메시지를 두 번 받아도 한 번만 반영해야 한다.
- HTTP 응답과 Socket 이벤트의 도착 순서가 뒤바뀌어도 `clientMessageId` 또는 ID로 병합해야 한다.
- 기본 MVP는 단일 Socket 서버 인스턴스를 전제로 한다.
- 다중 인스턴스를 도입할 때만 Redis Adapter 또는 메시지 브로커를 추가한다.
- Outbox 패턴은 저장 성공·emit 실패를 해결해야 하는 단계에서 ADR과 함께 도입한다. 처음부터 과도하게 구현하지 않는다.

### 12.4 재연결과 복구

- 초기 화면은 HTTP snapshot으로 구성한다.
- Socket join 시 클라이언트의 마지막 sequence를 전달한다.
- 서버는 room 참가와 누락 이벤트 조회 사이 race condition을 고려한다.
- 연결 복구가 보장되지 않는 경우 snapshot 또는 `afterSequence` 조회로 재동기화한다.
- 연결 상태는 `connecting`, `connected`, `recovering`, `disconnected`, `failed`로 사용자에게 드러낸다.

## 13. 채팅 규칙

- 과거 메시지 조회는 cursor pagination을 사용한다.
- 메시지 전송은 기본적으로 HTTP 쓰기 + Socket 전파 구조를 사용한다.
- 클라이언트가 `clientMessageId`를 생성한다.
- DB는 `(senderId, clientMessageId)` unique constraint로 중복 저장을 막는다.
- 채팅방별 증가 sequence를 사용한다.
- 메시지 전송 전 인증, 방송 상태, 차단, rate limit, 길이, URL/도배 규칙을 검사한다.
- 사용자가 메시지를 보내면 optimistic message를 표시할 수 있지만 `SENDING`, `SENT`, `FAILED` 상태를 구분한다.
- 메시지 숨김과 사용자 timeout은 서버 권한 검증 후 수행하고 감사 로그를 남긴다.
- 대량 메시지는 virtualization한다.
- AI 분석은 채팅 전송의 동기 경로에 넣지 않는다. 배치 또는 비동기 분석으로 처리한다.

## 14. 데이터베이스와 migration 규칙

- 스키마 변경은 migration 파일로만 수행한다.
- 이미 적용된 공유 migration을 수정하지 말고 새 migration을 추가한다.
- seed는 반복 실행 가능하고 결정적이어야 한다.
- seed에는 데모 방송, 상품, 사용자·운영자 계정, 과거 채팅, 주문 상태가 포함될 수 있다.
- DB 제약조건으로 보장 가능한 규칙은 애플리케이션 검사만으로 끝내지 않는다.
- unique, foreign key, check constraint, transaction을 적극 사용한다.
- migration 변경 시 빈 DB에 처음부터 재적용하는 검증을 수행한다.
- Supabase는 개발·배포용 관리형 PostgreSQL의 기본 provider다. Docker PostgreSQL은 선택적인 로컬 대체 수단이며 작업·실행의 필수 조건이 아니다.
- 현재 DB 접근은 NestJS 서버와 Prisma를 통해서만 수행한다. Supabase Data API를 사용하지 않는 동안에는 Data API를 비활성화하고, 브라우저에서 DB를 직접 호출하지 않는다.
- 향후 Data API, Supabase Auth, Realtime을 도입해 테이블을 client에 노출하면 해당 테이블의 RLS와 허용·거부 정책 테스트를 같은 변경에 포함한다.
- Supabase Dashboard의 임의 DDL로 schema를 변경하지 않는다. Prisma migration 파일을 source of truth로 유지하고, dashboard 변경이 필요하면 migration으로 재현 가능해야 한다.
- RLS를 도입한 테이블은 허용·거부 케이스를 테스트한다.
- RLS를 사용하지 않는 현재 구조에서는 동일한 목적의 서버 권한 통합 테스트를 수행하고, RLS 검증을 했다고 표현하지 않는다.
- 로컬 파일이나 메모리를 영속 데이터 저장소로 사용하지 않는다.

## 15. 인증·인가·보안

- 공개 데모는 제한된 demo session을 사용할 수 있다.
- role은 `VIEWER`, `ADMIN` 등 서버가 발급한 신뢰 가능한 claim으로 판단한다.
- 관리자 API와 admin room은 별도 권한을 검사한다.
- secret, API key, DB URL을 클라이언트 번들에 포함하지 않는다.
- AI provider 호출은 서버에서만 수행한다.
- CORS는 로컬과 배포 frontend origin allowlist로 제한한다.
- rate limit은 메시지, 로그인, AI 호출, 주문 생성에 적용한다.
- 로그에는 access token, 비밀번호, 전체 개인정보, secret을 남기지 않는다.
- 업로드를 도입할 경우 MIME, 크기, 확장자, 저장 위치를 검증한다.
- 데모 데이터는 실제 개인정보를 사용하지 않는다.

## 16. AI 기능 규칙

- 공개 무료 데모의 기본값은 `AI_MODE=mock`이다.
- 실제 provider는 공통 interface 뒤에 구현한다.
- UI가 provider의 고유 응답 구조에 직접 의존하지 않는다.
- AI 출력은 Zod schema로 검증한다.
- schema 불일치, timeout, 거절, rate limit, 네트워크 실패를 별도 상태로 처리한다.
- 상품 답변에는 사용한 source ID와 사용자에게 표시할 근거를 포함한다.
- 근거가 부족하거나 정책 판단이 필요한 경우 `needsHumanReview=true`로 반환한다.
- AI가 쿠폰 발행, 환불, 차단, 공지 발송 같은 중요 행동을 자동 실행하지 않는다.
- 운영자가 AI 제안을 수정·승인·거절할 수 있어야 한다.
- 승인·수정·거절 기록은 감사 로그에 남긴다.
- Mock provider도 실제 provider와 같은 contract, streaming 상태, 실패 상태를 재현한다.
- AI 품질은 최소한 curated fixtures와 schema/source 검증 테스트로 평가한다.

## 17. 오류 처리와 관측성

- 모든 요청에 추적 가능한 request ID를 부여한다.
- 구조화 로그에는 최소한 level, timestamp, requestId, route 또는 event type을 포함한다.
- 로그는 사용자가 이해할 메시지와 운영자가 조사할 세부 정보를 분리한다.
- Socket 연결, join 실패, 재연결, gap 감지, snapshot sync 결과를 관측 가능하게 한다.
- 관리자 화면에서 사용자에게 내부 오류 세부 정보를 노출하지 않는다.
- free-tier cold start를 정상 성공처럼 숨기지 말고 연결 중·재시도 UX로 표현한다.

## 18. 테스트 전략

### 18.1 단위 테스트

- 순수 도메인 함수
- Zod contract
- 가격·쿠폰 계산
- 상태 전이
- 이벤트 dedupe와 sequence gap 판단
- AI output validation

### 18.2 통합 테스트

- API route + DB
- 권한 허용·거부
- 메시지 idempotency
- 주문·재고 transaction
- migration 및 seed
- Socket join 권한과 room 발행

### 18.3 E2E 테스트

Playwright의 서로 다른 browser context로 사용자와 운영자를 동시에 검증한다.

필수 핵심 시나리오:

1. 운영자가 상품을 노출하면 사용자 화면에 실시간 표시된다.
2. 새로고침·재접속 후 최신 상품·쿠폰 상태가 유지된다.
3. 사용자가 메시지를 보내면 사용자와 운영자 화면에 한 번씩 표시된다.
4. HTTP 응답과 Socket 이벤트 순서가 뒤바뀌어도 메시지가 중복되지 않는다.
5. 연결이 끊긴 동안의 메시지를 재접속 후 복구한다.
6. 운영자가 메시지를 숨기면 모든 사용자 화면에서 반영된다.
7. 일반 사용자는 관리자 API와 admin room에 접근할 수 없다.
8. 같은 idempotency key의 주문은 한 번만 생성된다.
9. 마지막 재고를 동시에 주문하면 허용된 수량만 성공한다.
10. AI 제안은 사람의 승인 전 사용자 공지로 발행되지 않는다.

## 19. 검증 명령 계약

bootstrap 단계에서는 루트 `package.json`에 다음 스크립트 이름을 제공하는 것을 목표로 한다.

```bash
npm run dev
npm run dev:web
npm run dev:server
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run format:check
npm run db:generate
npm run db:migrate
npm run db:migrate:reset
npm run db:seed
```

규칙:

- 명령이 실제로 존재하는지 `package.json`을 먼저 확인한다.
- 존재하지 않는 명령을 실행했다고 보고하지 않는다.
- 변경 범위에 맞는 최소 검증과 전체 회귀 위험에 필요한 검증을 구분한다.
- 실행하지 못한 검증은 이유와 수동 확인 방법을 기록한다.
- flaky 테스트를 단순 재실행으로 숨기지 말고 원인을 조사한다.
- 테스트를 삭제하거나 약화해 통과시키지 않는다.

## 20. 접근성·반응형·성능

- 모든 인터랙션은 키보드로 접근 가능해야 한다.
- 버튼과 입력에는 명확한 accessible name이 있어야 한다.
- 색상만으로 상태를 구분하지 않는다.
- focus 상태를 제거하지 않는다.
- live region은 필요한 실시간 알림에 제한적으로 사용해 과도한 읽기를 피한다.
- 모바일 사용자 화면과 데스크톱 운영자 화면을 각각 우선 설계한다.
- 채팅·주문 목록은 데이터가 많아질 때 virtualization 또는 pagination을 사용한다.
- 성능 개선은 측정 전후 조건과 결과를 문서화한다.
- 무분별한 `memo`, `useMemo`, `useCallback`을 사용하지 않는다.
- 이미지와 영상은 데모 목적에 맞게 최적화하고 자동 재생 정책을 고려한다.

## 21. Git Flow와 PR 규칙

- 일상 개발의 통합 브랜치는 `develop`, 안정적인 릴리스 브랜치는 `main`으로 둔다.
- 작업은 최신 `develop`에서 만든 짧은 수명의 작업 브랜치에서 수행한다.
- 브랜치 이름은 목적을 드러내며 `feature/*`, `fix/*`, `docs/*`, `refactor/*`, `test/*`, `chore/*` 접두사를 사용한다.
- 하나의 브랜치와 PR에는 하나의 집중된 변경만 담는다. 무관한 리팩터링·의존성 업데이트는 섞지 않는다.
- 커밋은 Conventional Commits 형식 `type(scope): subject`를 사용한다. 주요 type은 `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, `revert`다.
- push 또는 PR 생성 전 관련 `lint`, `typecheck`, 테스트를 통과시킨다. DB 변경은 migration 재적용과 RLS 검증을, Expo 네이티브 의존성 변경은 iOS와 Android development build 확인을 추가한다.
- PR과 최종 보고에는 변경 파일 요약, 실행한 검증 명령 및 결과, 데이터/보안 영향, 남은 위험 또는 수동 QA 항목을 정확히 기록한다. 실행하지 못한 검증은 통과했다고 주장하지 않는다.
- 이 규칙은 Git 저장소가 초기화된 뒤 적용한다. 저장소 초기화, 브랜치 생성, 커밋, push, PR 생성은 사용자가 명시적으로 요청한 경우에만 수행한다.

프로젝트 적용 참고:

- 현재 프로젝트는 Expo 앱이 아니므로 Expo native build 항목은 적용 대상이 아니다. 향후 Expo 앱이 추가될 때만 적용한다.
- RLS를 도입하지 않은 DB 변경은 RLS 검증을 했다고 보고하지 않는다. 대신 migration 재적용과 서버 권한 통합 테스트 결과를 보고한다.

## 22. 문서화와 ADR

다음 변경은 `docs/adr/`에 짧은 ADR을 남긴다.

- 인증 방식 변경
- Socket 서버 확장 방식 또는 Redis 도입
- Outbox/queue 도입
- ORM 또는 DB 변경
- AI provider 전환 또는 복수 provider 라우팅
- 사용자 데이터·권한 모델 변경
- 배포 토폴로지 변경

ADR 형식:

```text
제목
상태
배경
결정
대안
결과와 trade-off
검증 방법
```

README에는 실행법을, PRD에는 제품 범위를, ADR에는 기술 선택 이유를 기록한다. 같은 내용을 여러 문서에 복제하지 않는다.

## 23. 환경변수와 배포

예상 환경변수:

```env
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
AI_MODE=mock
OPENAI_API_KEY=
```

- `.env`, 실제 secret, provider token을 커밋하지 않는다.
- `.env.example`에는 값이 아닌 설명 가능한 placeholder만 둔다.
- 웹은 Vercel, API/Socket 서버는 Render 계열 Web Service, DB는 Supabase managed PostgreSQL을 1차 배포 대상으로 삼는다.
- 로컬 Docker PostgreSQL은 필수가 아니다. 개발자는 별도 Supabase development project의 `DATABASE_URL`(앱용 Transaction Pooler)과 `DIRECT_URL`(migration용 Session Pooler)을 사용하며, connection string은 Supabase Dashboard의 Connect 화면에서만 가져온다.
- 배포 서비스와 free-tier 조건은 변경될 수 있으므로 실제 배포 작업 시 공식 문서를 다시 확인한다.
- domain layer는 특정 배포 provider에 종속시키지 않는다.
- 단일 Socket 서버 인스턴스가 MVP 기준이다.

## 24. 최종 보고 형식

코드 또는 문서를 변경한 작업의 최종 보고에는 다음을 포함한다.

```text
## 변경 요약
- 사용자 또는 운영자 관점의 결과

## 변경 파일
- path: 핵심 변경 내용

## 검증
- `실행한 명령`: 통과/실패 및 핵심 결과
- 실행하지 못한 검증과 이유

## 데이터·보안 영향
- migration, 권한, secret, 개인정보, API contract 영향

## 남은 위험과 수동 QA
- 아직 확인하지 못한 항목
- 재현 또는 확인 방법
```

“문제없음”, “모두 통과” 같은 포괄적인 표현 대신 실제 실행 결과를 기록한다.

## 25. 금지 사항

- 사용자 요청 없이 git 저장소 초기화, 브랜치 생성, commit, push, PR 생성
- `npm` 외 package manager 사용
- 실제 secret 또는 개인정보 커밋
- 클라이언트 값만 믿고 가격·권한·재고 결정
- DB 저장 전 성공 이벤트 발행
- 테스트 삭제·skip으로 실패 숨기기
- broad `catch`로 오류 삼키기
- 이유 없는 대규모 리팩터링
- 실제 동작하지 않는 기능을 README나 보고서에서 완료로 표현
- AI 결과를 검증·승인 없이 중요한 운영 행동으로 실행
- 서버 메모리만을 메시지·주문·방송 상태의 기준으로 사용
