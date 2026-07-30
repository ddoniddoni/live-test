# LiveFlow

LiveFlow는 사용자 라이브 쇼핑 화면과 운영자 컨트롤룸을 실시간으로 연결하는 AI 기반
라이브커머스 포트폴리오 프로젝트입니다. 현재는 Bootstrap 위에 첫 번째 실시간 세로 흐름인
**운영자 상품 노출 → DB 저장·감사 로그 → Socket.IO 발행 → 시청자 즉시 반영**을 구현했습니다.

## Workspace

```text
apps/web                 Next.js 사용자·운영자 웹 앱
apps/server              Fastify REST API + Socket.IO 서버
packages/contracts       Zod 기반 공유 DTO와 API 계약
packages/database        Prisma 스키마와 데이터베이스 클라이언트
```

## 시작하기

Node.js 24.18.1 LTS와 npm 11 이상을 사용합니다. 현재 개발 셸이 다른 Node 버전이면 `nvm use`
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
PostgreSQL connection string을 `.env`의 `DATABASE_URL`에 설정합니다. 현재 애플리케이션은
Fastify + Prisma만 DB에 연결하므로 Supabase Data API를 켜거나 브라우저에 Supabase secret을 넣지
않습니다. Docker Compose는 로컬 PostgreSQL이 꼭 필요한 경우에만 쓰는 선택 사항입니다.

- Web: `http://localhost:3000`
- API health check: `http://localhost:4000/health`

`npm run dev`는 Next.js와 Fastify를 함께 시작합니다. 분리 실행은 `npm run dev:web`,
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

## 현재 구현 범위

현재 확인 가능한 흐름은 다음과 같습니다.

1. `/live/demo`에서 시청자 화면과 현재 소개 상품을 확인합니다.
2. `/admin/lives/demo`에서 `DEMO_ADMIN_PASSWORD`로 관리자 세션을 발급받습니다.
3. 상품을 선택하면 서버가 PostgreSQL transaction 안에서 방송 상태, event sequence, audit log를
   저장합니다.
4. transaction이 commit된 뒤 `product.featured` Socket.IO 이벤트가 public room에 발행되고,
   시청자 화면의 Query cache가 갱신됩니다.
5. 재접속·새로고침 시 HTTP snapshot이 DB의 최신 소개 상품을 다시 읽습니다.

채팅, 쿠폰, 주문·재고 차감, 실제 사용자 인증, AI 기능과 누락 이벤트의 cursor 복구는 아직
구현하지 않았습니다. 이 기능들은 PRD의 후속 세로 흐름으로 추가합니다.

요구사항과 작업 규칙의 기준은 [prd.md](./prd.md)와 [AGENTS.md](./AGENTS.md)입니다.
