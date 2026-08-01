# LiveFlow

LiveFlow는 사용자 라이브 쇼핑 화면과 운영자 컨트롤룸을 실시간으로 연결하는 AI 기반
라이브커머스 포트폴리오 프로젝트입니다. 현재는 상품 노출, 신뢰성 있는 채팅, Mock 주문과 재고 차감의
세로 흐름을 구현했습니다.

## Workspace

```text
apps/web                 Next.js 사용자·운영자 웹 앱
apps/server              NestJS REST API + Socket.IO Gateway 서버 (Fastify adapter)
packages/contracts       Zod 기반 공유 DTO와 API 계약
packages/database        Prisma 스키마와 데이터베이스 클라이언트
```

## 시작하기

Node.js 24.14.1 LTS와 npm 11 이상을 사용합니다. 현재 개발 셸이 다른 Node 버전이면 `nvm use`
후 다음을 실행합니다.

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

시작 전에 Supabase development project를 만들고, Dashboard의 **Connect** 화면에서 가져온 서버용
connection string 두 개를 `.env`에 설정합니다.

- `DATABASE_URL`: NestJS 런타임용 Transaction Pooler URL (보통 6543 포트, `pgbouncer=true`)
- `DIRECT_URL`: Prisma migration용 Session Pooler URL (보통 5432 포트)

현재 애플리케이션은 NestJS + Prisma만 DB에 연결하므로 Supabase Data API를 켜거나 브라우저에
Supabase secret을 넣지 않습니다. `npm run db:migrate`와 `npm run db:seed`는 루트 `.env`를
자동으로 로드합니다. Docker Compose는 로컬 PostgreSQL이 꼭 필요한 경우에만 쓰는 선택 사항입니다.

- Web: `http://localhost:3000`
- API health check: `http://localhost:4000/health`

`npm run dev`는 Next.js와 NestJS를 함께 시작합니다. 분리 실행은 `npm run dev:web`,
`npm run dev:server`를 사용합니다.

`DEMO_ADMIN_PASSWORD`에는 임의의 강한 비밀번호를 설정하세요. `/admin/lives/demo`에서 해당
비밀번호로 데모 관리자 세션을 발급받아 상품을 노출할 수 있습니다. 이 세션은 포트폴리오용
데모 인증이며, 실제 사용자 인증은 아직 구현하지 않았습니다.

## 검증 명령

```bash
npm run lint
npm run typecheck
npm run test
npm run format:check
npm run build
```

데이터베이스가 필요한 명령은 아래와 같습니다.

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

`db:migrate:reset`은 로컬 DB 데이터를 삭제하므로 필요할 때만 실행합니다.

## E2E 테스트

Playwright E2E는 개발·운영 DB를 절대 사용하지 않습니다. 별도의 Supabase test project를 만들고
`.env.e2e.example`을 `.env.e2e`로 복사한 뒤, test project의 connection string과 전용 관리자
비밀번호를 입력하세요.

```bash
npx playwright install chromium
npm run test:e2e
```

이 명령은 `E2E_ALLOW_DATABASE_RESET=true`가 설정된 경우에만 실행됩니다. 실행마다 **E2E 전용 DB**에
Prisma generate, migration, seed를 적용하고 포트 `3100`(web), `4100`(API)에서 Chromium 시나리오를
실행합니다. 현재 시나리오는 운영자 방송 시작·상품 노출, 시청자 채팅·Mock 주문, 운영자의 주문·저재고
실시간 수신을 두 브라우저 context로 검증합니다.

## 채팅 성능 검증

`npm run db:seed`는 `demo` 방송에 결정적인 2,000개 채팅 메시지를 생성합니다. 서버 snapshot과 이전
메시지 API는 한 번에 최대 51개만 조회하고, 클라이언트는 TanStack Virtual로 가시 행만 DOM에 렌더링합니다.
E2E 시나리오는 초기 렌더링 행이 100개 미만인지 확인합니다.

성능을 재현하려면 전용 테스트 DB에서 `npm run test:e2e`를 실행한 뒤 `/live/demo`의 채팅 목록을 위로
스크롤해 이전 메시지를 반복해서 불러오면 됩니다. 실제 브라우저 성능 수치는 전용 E2E Supabase 환경을
연결한 뒤 기록합니다.

## 현재 구현 범위

현재 확인 가능한 흐름은 다음과 같습니다.

1. `/live/demo`에서 시청자 화면과 현재 소개 상품을 확인합니다.
2. `/admin/lives/demo`에서 `DEMO_ADMIN_PASSWORD`로 관리자 세션을 발급받습니다.
3. 상품을 선택하면 서버가 PostgreSQL transaction 안에서 방송 상태, event sequence, audit log를
   저장합니다.
4. transaction이 commit된 뒤 `product.featured` Socket.IO 이벤트가 public room에 발행되고,
   시청자 화면의 Query cache가 갱신됩니다.
5. 재접속·새로고침 시 HTTP snapshot이 DB의 최신 소개 상품을 다시 읽습니다.

채팅은 최근 메시지 조회, HTTP 저장, `clientMessageId` idempotency, optimistic 상태, Socket.IO 전파,
HTTP/Socket dedupe, `afterSequence` 복구까지 구현했습니다. 관리자는 사유를 입력해 메시지를 숨기거나
시청자를 5·10·30·60분 동안 채팅 제한할 수 있습니다. timeout은 방송 단위로 영속화·감사되며, 대상
시청자에게만 Socket.IO 이벤트로 전달됩니다. 메시지 전송 API도 제한 만료 전에는 거절하므로 UI를 우회할 수
없습니다. 이전 메시지 UI, cursor 기반 이전 메시지 조회, 읽던 위치 보존, 대량 목록 virtualization, 최신 위치가
아닐 때의 새 메시지 이동 버튼까지 구현했습니다. 관리자는 퍼센트·정액 쿠폰을 유효 기간, 최소 주문 금액, 사용 한도와 함께 발행할 수 있고, 발행된 쿠폰은 시청자 화면에 실시간 반영됩니다. 시청자는 현재 소개 중인 상품의 옵션과 수량을 선택해 Mock 주문을 만들 수 있습니다. 서버는 가격·쿠폰을 재계산하고, 조건부 재고 차감·쿠폰 사용·주문·감사 로그를 하나의 transaction으로 저장한 뒤 public 재고 이벤트와 주문자 전용 상태 이벤트를 발행합니다. 같은 `Idempotency-Key` 재시도는 주문을 한 번만 만듭니다. 실제 결제와 실제 사용자 인증, AI 기능은 후속 범위입니다.

## 포트폴리오 배포

```text
Vercel (apps/web, Next.js)
  ├─ HTTPS API ─┐
  └─ Socket.IO ─┼─ Render Web Service (NestJS + Fastify adapter)
                └─ Supabase PostgreSQL (Prisma)
```

### 1. Supabase

Supabase Dashboard의 Connect 화면에서 서버용 `DATABASE_URL`(Transaction Pooler)과 migration용
`DIRECT_URL`(Session Pooler)을 준비합니다. 첫 공개 배포 전에는 로컬에서 다음을 한 번 실행합니다.

```bash
npm run db:migrate
npm run db:seed
```

배포 환경에서는 Render의 pre-deploy 단계가 `npm run db:migrate`를 실행합니다. 이 명령은 로컬의
`.env`가 있으면 읽고, 없으면 Render 환경변수를 그대로 사용합니다. 서버 시작 시 migration이나
seed를 실행하지 않습니다.

### 2. Render API와 Socket

저장소 루트의 [`render.yaml`](./render.yaml)을 이용해 Render에서 **New + Blueprint**를 만들고
`develop` 브랜치를 연결합니다. 이 Blueprint는 무료 Web Service 한 대에 NestJS API와 Socket.IO를
같이 기동하며 `/health`를 배포 health check로 사용합니다.

Render Dashboard에서 아래 값을 설정합니다. `JWT_SECRET`은 Blueprint가 최초 생성 시 안전한 난수로
만들며, 나머지 실제 값은 저장소에 넣지 않습니다.

```text
DATABASE_URL, DIRECT_URL, DEMO_ADMIN_PASSWORD, WEB_ORIGIN
```

`WEB_ORIGIN`에는 다음 단계에서 얻은 Vercel production URL을 넣습니다. Render의 공개 URL은 예를 들어
`https://liveflow-api.onrender.com`이며 API와 Socket.IO가 이 URL을 함께 사용합니다. Free Web Service는
15분 동안 HTTP 요청과 Socket 메시지가 없으면 sleep하므로, 포트폴리오 시연 전에는 `/health`를 한 번
열어 cold start를 끝냅니다.

### 3. Vercel 웹

같은 저장소에서 Vercel Project를 만들고, Root Directory는 **저장소 루트**로 둡니다.
[`vercel.json`](./vercel.json)이 npm workspace install과 web-only build를 설정합니다. Vercel 환경변수는
다음처럼 설정합니다.

```text
NEXT_PUBLIC_API_URL=https://liveflow-api.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://liveflow-api.onrender.com
```

Vercel 배포 URL을 만든 뒤 이를 Render의 `WEB_ORIGIN`에 넣고 Render를 재배포합니다. Preview URL은
allowlist에 자동 포함되지 않으므로, 공개 시연은 production URL을 사용합니다.

API와 Socket은 Render 단일 인스턴스가 기준입니다. 인스턴스를 여러 대로 확장하려면 Socket.IO Redis
adapter를 먼저 도입해야 합니다.

요구사항과 작업 규칙의 기준은 [prd.md](./prd.md)와 [AGENTS.md](./AGENTS.md)입니다.
