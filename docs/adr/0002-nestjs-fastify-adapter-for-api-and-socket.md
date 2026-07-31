# NestJS와 Fastify adapter로 API·Socket 서버를 구성

## 상태

채택

## 배경

LiveFlow는 REST API, demo 권한, Socket.IO room, 채팅 idempotency, 주문 transaction처럼 서버 책임이
늘어나는 구조다. Fastify를 직접 사용하면 초기 구현은 단순하지만, Controller·Service·Gateway 단위의
경계를 일관되게 유지하기 어렵고 포트폴리오에서 팀 개발 구조를 설명하기에도 불리하다.

## 결정

- 서버 애플리케이션 프레임워크는 NestJS를 사용한다.
- HTTP adapter는 Fastify로 유지해 기존 단일 Node HTTP 서버와 Render Web Service 배포 구조를 보존한다.
- Socket.IO는 NestJS Gateway로 같은 HTTP 서버와 같은 공개 포트에서 실행한다.
- REST는 Controller, 비즈니스·repository 호출은 Service, handshake·room·emit은 Gateway가 담당한다.
- PostgreSQL transaction commit 후 Gateway가 이벤트를 발행하는 순서는 유지한다.

## 대안

- Fastify 직접 사용: 의존성이 적지만 API·인증·Socket 경계가 커질수록 구조화 비용이 커진다.
- NestJS + Express: 더 흔한 조합이지만 현재 Fastify 기반 서버와 성능 특성을 유지할 이유가 없다.
- Supabase Realtime: DB 제공 기능을 활용할 수 있지만, 현재 Socket.IO room·event sequence 계약을
  바꾸고 browser direct access/RLS 범위를 늘린다.

## 결과와 trade-off

- Controller·Service·Gateway·JWT 모듈 경계가 명확해져 다음 주문·AI·운영 기능을 분리하기 쉽다.
- Render에는 Nest API와 Socket.IO를 단일 Web Service로 배포하며, Vercel은 Next.js 웹만 배포한다.
- NestJS decorator metadata와 런타임 의존성이 추가되어 Fastify 직접 사용보다 빌드·학습 비용이 늘어난다.
- MVP는 Socket 인스턴스 한 대만 사용한다. scale-out 시에는 Redis Socket.IO adapter를 별도 ADR과 함께
  도입해야 한다.

## 검증 방법

1. Nest Fastify 애플리케이션의 `/health`, demo 권한, chat idempotency, 상품 이벤트 단위 테스트를 실행한다.
2. 실제 localhost 포트에서 Socket.IO handshake, `live.join`, public room event 수신 통합 테스트를 실행한다.
3. Render Web Service에서 `/health`와 두 브라우저의 viewer/admin 실시간 흐름을 수동 확인한다.
