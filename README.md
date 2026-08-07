# LiveFlow를 만들며

라이브커머스를 보다 보면 화면은 보통 둘로 나뉜다. 시청자는 방송을 보며 상품을 고르고, 운영자는 다른
화면에서 상품을 바꾸고 쿠폰과 채팅을 관리한다. 처음에는 이 두 화면을 만들고 Socket.IO만 연결하면 될
거라고 생각했다.

막상 구현해 보니 중요한 것은 화면 두 장이 아니라 **같은 방송 상태를 어떻게 믿을 수 있게 공유하느냐**였다.
상품을 바꾼 뒤 새로고침해도 같은 상품이 보여야 하고, 채팅을 두 번 보내도 한 번만 저장돼야 한다. 주문과
재고는 버튼을 눌렀다는 사실보다 DB transaction이 더 중요했다. LiveFlow는 그 고민을 정리해 본 개인
포트폴리오 프로젝트다.

> 실제 영상 송출과 결제를 만들기보다, 한 방송을 준비하고 운영한 뒤 결과를 확인하는 흐름을 끝까지
> 연결하는 데 집중했다.

## 어떤 흐름을 만들었나

```text
운영자가 방송을 만들고 준비한다
  → 방송을 시작하고 현재 소개 상품을 바꾼다
  → 시청자 화면이 실시간으로 갱신된다
  → 채팅 · 쿠폰 · Mock 주문이 DB에 저장된다
  → 운영자는 주문 · 재고 · 채팅 · AI 제안을 확인한다
  → 중요한 AI 제안은 사람이 승인한 뒤에만 공지가 된다
```

방송은 `DRAFT → SCHEDULED → READY → LIVE → ENDED` 상태로 관리한다. 준비 중인 방송에서는
시청자가 채팅하거나 주문할 수 없고, 종료된 방송은 새 방송으로 되돌아가지 않는다. 이 규칙은 화면이 아닌
NestJS 서버에서 검사한다.

## 구현하면서 신경 쓴 부분

### 1. Socket은 전달 통로이고, PostgreSQL이 기준이다

운영자가 상품을 노출하거나 공지를 발행하면 먼저 PostgreSQL transaction을 완료한다. 그 다음에만
Socket.IO 이벤트를 보낸다. 따라서 이벤트를 놓치거나 새로고침하더라도 HTTP snapshot으로 현재 상태를
다시 읽을 수 있다.

채팅에는 `clientMessageId`, 이벤트에는 `eventId`와 방송별 `sequence`를 둬서 HTTP 응답과 Socket
이벤트 순서가 달라도 중복되지 않게 했다. 연결이 끊긴 뒤에는 마지막 sequence 이후 메시지를 가져와 복구한다.

### 2. 주문은 화면에서 계산하지 않는다

시청자가 옵션과 수량, 쿠폰을 선택해 Mock 주문을 만들 수 있다. 서버는 가격과 할인 금액을 다시 계산하고,
재고 차감·쿠폰 사용·주문 생성·감사 로그를 하나의 transaction으로 처리한다. 같은 idempotency key로
다시 요청해도 주문은 하나만 생긴다.

결제, 환불, 배송 연동은 이 프로젝트의 범위에서 제외했다. 대신 "마지막 재고를 동시에 주문하면 어떻게
될까"처럼 서버와 DB가 책임져야 하는 부분을 다뤘다.

### 3. 운영자가 판단할 수 있는 AI만 붙였다

사용자는 현재 소개 상품을 대상으로 질문하고, AI는 답변과 함께 근거 source를 돌려준다. 운영자는 최근
채팅을 요약해 반복 질문을 확인할 수 있다.

다만 AI가 쿠폰을 발행하거나 공지를 자동으로 내보내지는 않는다. 요약으로 만든 공지 초안은 운영자가
수정·승인해야만 시청자 화면에 발행되고, 그 과정은 감사 로그에 남는다. 기본 AI provider는 비용이 들지 않는
deterministic mock이고, 출력 contract와 curated fixture로 동작을 검증한다.

### 4. 운영 화면도 제품의 일부로 봤다

운영자는 방송 목록에서 새 방송을 만들고, 상품을 방송별로 준비·정렬한 뒤 준비 점검을 통과시켜야 방송을
시작할 수 있다. 컨트롤룸에서는 상품 노출, 쿠폰·공지 발행, 채팅 숨김·timeout, 주문·재고 확인, AI 제안
검토를 한다.

방송 중 지표도 함께 보여 준다. 주문 수·매출·할인 금액·쿠폰 사용·채팅 수·AI 검토 수를 한 화면에서
확인할 수 있게 했다.

### 5. "데모니까 괜찮다"고 넘기지 않은 보안 경계

브라우저는 Supabase에 직접 연결하지 않고 NestJS와 Prisma를 거친다. Supabase Data API는 비활성화하고,
`public` 테이블에는 RLS를 켠 뒤 `anon`·`authenticated` 역할의 스키마·테이블 권한을 회수했다. 관리자
API와 admin Socket room은 서버에서 별도로 권한을 확인한다.

## 화면을 보는 순서

1. `/`에서 현재 진행 중인 방송 또는 데모 진입 경로를 확인한다.
2. `/live`는 가장 최근에 시작된 LIVE 방송으로 이동한다.
3. `/admin`에서 관리자 비밀번호를 입력한 뒤 방송 목록으로 들어간다.
4. `/admin/lives`에서 방송을 만들고 상품을 준비한 다음 컨트롤룸에서 방송을 시작한다.
5. 시청자 화면과 운영자 화면을 나란히 열고 상품 노출, 쿠폰, 채팅, Mock 주문 흐름을 확인한다.

현재 라이브 조회가 일시적으로 실패해도 `/live` 오류 화면에서 재시도하거나 홈·운영자 화면으로 이동할 수
있다.

## 구조

```text
apps/web                 Next.js App Router 사용자·운영자 화면
apps/server              NestJS REST API + Socket.IO Gateway (Fastify adapter)
packages/contracts       Zod 기반 API·Socket 공유 계약
packages/database        Prisma schema, migration, seed, DB client
```

```text
Next.js
  ├─ HTTP snapshot / mutation ─┐
  └─ Socket.IO                 ├─ NestJS + Fastify
                                └─ Prisma → Supabase PostgreSQL
```

공유 타입을 프런트와 서버에 복사하지 않기 위해 계약은 `packages/contracts`에 둔다. DB가 사실의 기준이고,
Socket.IO는 이미 저장된 변경을 전달하는 역할만 한다.

## 로컬에서 실행하기

Node.js `24.14.1`과 npm을 사용한다. 다른 Node 버전이 선택돼 있다면 먼저 `nvm use`를 실행한다.

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Supabase Dashboard의 **Connect** 화면에서 받은 서버용 connection string을 `.env`에 넣는다.

```text
DATABASE_URL=       # NestJS 런타임용 Transaction Pooler URL
DIRECT_URL=         # Prisma migration용 Session Pooler URL
JWT_SECRET=
DEMO_ADMIN_PASSWORD=
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
AI_MODE=mock
```

`npm run dev`는 웹(`http://localhost:3000`)과 API(`http://localhost:4000`)를 함께 실행한다. API 상태는
`http://localhost:4000/health`에서 확인할 수 있다.

Supabase Data API는 이 구조에서 사용하지 않는다. Dashboard에서 Data API를 비활성화하고, 실제 URL이나
비밀번호, API key는 저장소에 넣지 않는다.

## 확인한 것

```bash
npm run lint
npm run typecheck
npm run test
npm run format:check
npm run build
```

`npm run db:seed`는 `demo` 방송에 결정적인 2,000개 채팅 메시지를 만든다. 채팅은 cursor pagination과
virtualization을 사용하며, 사용자가 과거 메시지를 읽는 중일 때 새 메시지로 강제 이동하지 않는다.

Playwright E2E는 별도 Supabase test project가 필요하다. `.env.e2e.example`을 `.env.e2e`로 복사해
전용 connection string을 넣고 아래처럼 실행한다.

```bash
npx playwright install chromium
npm run test:e2e
```

이 테스트는 `E2E_ALLOW_DATABASE_RESET=true`인 전용 DB만 초기화한다. 개발·운영 DB에는 실행하면 안 된다.

## 아직 하지 않은 것

- 실제 HLS/WebRTC 송출과 영상 인코딩
- 실제 결제·환불·배송·정산 연동
- 실제 회원 가입과 OAuth 기반 사용자 인증
- 다중 Socket 서버를 위한 Redis adapter
- 운영자 AI 평가 대시보드, 이벤트 재생 패널 같은 P1 확장 기능

공개 배포는 Vercel(웹), Render 계열 단일 Web Service(API·Socket), Supabase PostgreSQL 조합을 기준으로
생각하고 있다. Render의 free-tier cold start와 단일 Socket 인스턴스라는 제약도 숨기지 않고 데모 흐름에
반영할 계획이다.

## 기록

기술 선택의 이유는 [docs/adr](./docs/adr)에, 제품 요구사항과 완료 기준은 [prd.md](./prd.md)에 적어
두었다. 작업할 때 지키는 규칙은 [AGENTS.md](./AGENTS.md)에서 확인할 수 있다.
