# Supabase managed PostgreSQL을 기본 데이터베이스 provider로 선택

## 상태

채택

## 배경

LiveFlow는 PostgreSQL transaction, Prisma migration, Socket.IO 기반의 실시간 이벤트를 필요로 한다.
기존 문서는 Neon PostgreSQL과 Docker 기반 로컬 DB를 기본 전제로 두었지만, 공개 데모를 개발·배포할
때 관리 UI와 connection 관리가 쉬운 Supabase를 기본 provider로 선택한다.

## 결정

- 개발·배포의 기본 DB는 Supabase managed PostgreSQL로 사용한다.
- Fastify 서버가 Prisma를 통해 DB에 접근하고, PostgreSQL은 계속 데이터의 기준이다.
- Prisma migration 파일을 schema의 source of truth로 유지한다. Supabase Dashboard에서 수동 DDL을
  실행해 schema를 변경하지 않는다.
- Docker PostgreSQL은 선택적인 로컬 대체 수단이며 개발·실행의 필수 조건이 아니다.
- 현 단계에서는 Supabase Data API, Auth, Realtime을 도입하지 않는다. Data API는 Prisma만 사용할
  때 비활성화하고, 나중에 browser direct access를 도입하면 RLS와 정책 테스트를 함께 추가한다.

## 대안

- Neon PostgreSQL: 단순한 managed Postgres 호스팅으로 유지한다.
- Docker PostgreSQL: 오프라인 개발과 빈 DB migration 검증에 유용하지만 설치·운영을 개발자에게
  요구한다.
- Supabase Auth·Realtime까지 즉시 도입: 제공 기능은 늘지만 현재 Fastify 권한 검증과 Socket.IO room
  설계를 동시에 바꾸므로 범위를 넓힌다.

## 결과와 trade-off

- Supabase Dashboard로 DB 상태와 connection 정보를 관리할 수 있고, Docker 없이 개발을 시작할 수
  있다.
- Prisma·Fastify·Socket.IO의 기존 도메인 책임과 transaction/emit 순서는 유지한다.
- Supabase project와 connection secret을 별도로 관리해야 하며, Free Plan의 pause·제한은 실제 공개
  배포 전에 다시 확인해야 한다.
- 빈 DB migration 재적용은 Supabase development project 또는 선택적 Docker PostgreSQL에서 검증한다.

## 검증 방법

1. Supabase development project의 서버 런타임용 `DATABASE_URL`과 migration용 `DIRECT_URL`을 로컬과 API 배포 환경에 설정한다.
2. `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`를 실행한다.
3. `/health`와 viewer/admin 실시간 흐름을 두 browser context에서 확인한다.
4. Data API 또는 browser direct access를 도입하기 전 Security Advisor와 RLS 허용·거부 테스트를
   실행한다.
