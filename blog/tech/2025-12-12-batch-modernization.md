---
title: Batch 레거시 정산 시스템 고도화
tags: [tech]
---

## Batch 정산 시스템 개선 사항

**1. select - insert 구조 기반으로 기준정보와 거래원장 join으로 정산 기준정보 조회와 계산하는 로직으로 구현**
   -  Job 또는 Step 실행 시, 기준정보 캐싱 조회 -> 추후 Redis 연동
   - 캐싱된 기준정보와 정산 대 거래 원장의 정산 정보 생성

**2. Domain Layer,  Batch Layer, Infra Layer 계층으로 재구조**
 - 데이터 정합성관련 설계
     - Table Unique Key
 
 **3. Retry / Skip 정책**
- Retry : 외부 연동 실패 시
- Skip
  - 정책 정의 필요
      - 기준정보 누락
      - 거래금액 오류
  - 각 정책의 Skip 건수가 일정 이상일 경우, 오류로 감지 Fail
  - Skip 내역 Table 관리 -> IMS 화면 조회 -> 후처리 기능 -> Batch 호출

**4. 재처리**
  - 각 Job별 후처리를 위한 Key 기반의 파라미터 정의

**5. Batch 시, 실행결과 조회 및 후처리 기능**

**6. 테스트 기간을 축소하기 위한 테스트 코드 작성**
    - 테스트 지원을 위한 테스트 코드

**7. JPA VS mybatis/JDBC Cursor template**
| 기능                 | 기술          | 이유                                                             |
|:-------------------| :---------- | :------------------------------------------------------------- |
| 도메인 규칙 처리 소량 조회    | JPA         | 1차 캐싱, 영속성 컨테스트 관리로 인한 메모리 사용, Flush/clear 비용 등으로 인한 성능 저하 가능성 |
| 대량의 데이터 조회(Reader) | JDBC Cursor | 메모리에 한 번에 올리지 않고 스트리밍 형태로 받아옴                                  |
| 대량 Insert/Update   | JDBC+MERGE  | 한 번의 건을 Chunk 트랜잭션 커밋 단위로 처리                                   |

