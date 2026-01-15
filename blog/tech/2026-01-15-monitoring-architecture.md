---
title: 결제 시스템 관제 시스템 도입 배경과 아키텍처
description: Prometheus + Grafana + Spring Actuator + Scouter 기반 관제 아키텍처와 관제 항목 정리
tags: [tech, monitoring]
---

# 관제 시스템이 필요한 이유 (결제 서비스 관점)

결제 서비스는 특성상 **단 1분의 장애도 매출 손실**로 이어지고, 사용자 경험 악화로 인해 **서비스 신뢰도**가 빠르게 하락한ㄷ.  
따라서 장애 발생 이후에 로그를 뒤져 원인을 찾는 **사후 대응 방식(Post-Mortem)**에서 벗어나, 장애 징후를 **선제적으로 탐지**하고 문제 구간을 **즉시 식별**할 수 있는 관제 시스템이 필요하다.

관제 시스템의 목적은 단순히 “서버가 살아있다/죽었다”를 보는 것이 아니라, **서비스가 정상적으로 결제 성공을 만들고 있는지**를 데이터로 확인하는 것이다.

## 현재 현황 

현재 시스템의 관제는 주로 다음과 같은 **인프라 중심 모니터링**에 집중되어 있다.

- CPU
- Memory
- Disk

즉, “서버 리소스가 정상인가?”는 확인 가능하지만, 실제 장애 상황에서 가장 중요한 **결제 실패 원인(외부 연동, 내부 로직, DB 병목)**을 빠르게 특정하기 어려운 상황이였다.

## 관제 시스템이 해결해야 하는 문제

### ✅ 장애 인지 시간(MTTD) 단축
- 실시간 알림을 통해 장애를 **즉시 인지**
- CS 제보보다 관제가 먼저 반응하는 구조

### ✅ 원인 파악 및 복구 시간(MTTR) 단축
- 장애 발생 시 **App / DB / 외부 연동 구간을 명확히 분리**
- “어디가 문제인지”를 1분 내 좁히는 것

### ✅ 데이터 기반 의사결정
- 성능/장애/성공률 지표를 정량화
- “느린 것 같다”가 아니라 **P95/P99 지표 기반으로 판단**
- 결제 성공률(비즈니스 지표) 중심 운영

---

# 관제 범위 (5단계 Layer 기준)

장애 흐름에 따라 전체 구간을 정의하되, 개발/운영 파트에서 직접 제어 가능한 영역(L4 App / L5 DB)을 핵심 관제 구간으로 도입한다.

| Layer | 구분 | 주요 관제 요소 | 활용 도구 | 비고 |
|---|---|---|---|---|
| L1 | User Layer | 결제창 로딩 속도, 이탈률 | - | 사용자 경험 |
| L2 | Network Layer | DNS, LB, 트래픽 폭주 | - | 구간 장애 |
| L3 | Infra Layer | CPU, Memory, Disk I/O | Prometheus, Grafana | 리소스 장애 |
| **L4** | **App Layer** | **결제 로직 에러, 외부 API 지연, Thread/JVM 상태** | Spring Actuator, Scouter | **핵심 관제** |
| **L5** | **DB Layer** | **Slow Query, Connection Pool, Lock 여부** | Scouter, Prometheus | **핵심 관제** |

---

# 관제 항목 (공통 / 서비스별)

## 공통 관제 항목

#### ✅ 트래픽 / 응답
- TPS / RPS
- 응답시간 Latency (P50 / P95 / P99)
- HTTP 상태코드 비율 (2xx / 4xx / 5xx)
- Timeout 비율
- 에러율(전체 요청 대비 실패율)

#### ✅ 서버 리소스
- CPU 사용률
- 메모리(Heap / Non-Heap)
- GC 횟수 / GC 시간
- Disk 사용률 및 I/O
- Network In/Out

#### ✅ JVM / 애플리케이션 상태
- Thread 수 / Runnable / Blocked
- Active connection 수 (서버/클라이언트)
- 요청 큐 적체(대기시간)
- 로그 ERROR 발생률

## 서비스별 관제 항목

#### ✅ 승인 서비스 (BLD / Spring Boot + Native Netty)
- 승인 성공률 / 실패율
- 외부 원천사 응답시간 및 Timeout
- 내부 예외율(Validation, Mapping, Business Error)
- Thread / CPU / GC
- 외부 원천사 연동 상태

#### ✅ 결제창(Front / Spring Boot)
- 결제 진입 → 승인 요청 전환율
- 4xx 비율(사용자 입력/검증 실패)
- 결제 UX 지연(P95)
- 외부 원천사 응답시간 및 Timeout

#### ✅ Batch (정산/매입 / Spring Batch)
- Job / Step 상태
- 처리 건수(성공/실패/Skip)
- 누락/중복 여부
- DB 부하(락 / 슬로우쿼리)

#### ✅ 관리자 시스템 (운영/관리)
- 관리자 조회/정정 요청량

---

# Scouter & Spring Actuator + Micrometer + Prometheus + Grafana 아키텍처

| **기술명** | **설명 및 목적** |
| --- | --- |
| **Scouter** | 실시간 APM(Application Performance Monitoring). 서비스별 부하 및 상세 트랜잭션 추적. |
| **Spring Actuator** | 어플리케이션의 상태 정보(Health, Metrics)를 HTTP 엔드포인트로 노출. |
| **Micrometer** | 다양한 모니터링 시스템 간의 파사드 역할을 하여 지표를 표준화(Prometheus 형식 등). |
| **Prometheus** | 시계열 데이터베이스(TSDB). Actuator가 노출한 지표를 주기적으로 Pull링하여 저장. |
| **Grafana** | 저장된 지표를 시각화. 대시보드 구축 및 알람 규칙 설정. |

## 시스템 아키텍처 

1. **Application**에서 Micrometer/Actuator를 통해 지표 생성.
2. **Actuator/Micrometer → Prometheus**가 주기적으로 데이터를 수집(Pull).
3. **Scouter Agent**가 JVM 및 트랜잭션 정보를 Scouter Server로 전송.
4. **Grafana**가 Prometheus 데이터를 쿼리하여 대시보드 출력
5. (선택) **Alertmanager/Telegram/Slack** : 알림 채널


## 운영 시, 고려사항

- 알림은 **“비즈니스 성공률”과 “외부 연동 지연/실패”** 중심으로 시작
- TPS가 낮은 초기에는 **P95/P99 지표 + Error/Timeout 비율**만으로도 효과가 큼
- 배치는 **Job/Step 상태 + 처리건수 + DB 부하**를 반드시 분리해서 봄
