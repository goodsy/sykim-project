---
title: 정산 시스템에서 금액 타입 설계 기준
tags: [notes, java, bigdecimal]
---

정산 시스템에서는 “금액 타입을 무엇으로 쓰느냐”가  
단순한 구현 문제가 아니라 **정합성·재현성·장애 여부**를 좌우한다.

이 문서는 실무 정산 시스템 기준에서  
**금액 / 수수료 / 세금 타입을 어떻게 설계해야 하는지**를 간단히 정리한 내용이다.

---

## 기본 원칙 요약

정산 시스템의 금액 타입 설계는 아래 원칙을 따른다.

- ❌ `double`, `float` 사용 금지
- ✅ **원 단위 금액은 정수(long)**
- ✅ **비율·계산 결과는 BigDecimal**
- ✅ **반올림 정책은 반드시 명시**

> “정확한 계산”보다 더 중요한 건 **항상 같은 결과가 나오는 계산**이다.

---

## 타입별 역할 분리 기준

| 구분               | 타입 | 설명 |
|------------------|---|---|
| 승인금액, 취소금액(거래금액) | `long` | 원 단위 정수 |
| 수수료율             | `BigDecimal` | 소수점 계산 필요 |
| 수수료 금액           | `BigDecimal` | 곱셈 결과 |
| 세금 금액            | `BigDecimal` | 반올림 정책 중요 |
| 최종 정산금액          | `BigDecimal` | 계산 결과값 |

👉 **“입력은 정수, 계산은 BigDecimal”** 구조가 가장 안정적이다.

---

## 왜 금액은 long 인가?

```java
long approvedAmount = 12_340L;
```
- DB, 외부 PG, VAN 연동 시 대부분 원 단위 정수
- 비교·합산·집계가 단순
- 성능 부담 없음
- 불필요한 BigDecimal 남용 방지

✔ 정산 시스템에서 금액은 화폐 단위의 사실값(source of truth) 이다.


---
## BigDecimal이 필요한 영역

① 수수료율
```java
BigDecimal feeRate = new BigDecimal("0.023");
```
- 2.3%, 1.65% 등 소수점 필요
- 정책 변경 가능성 높음

② 금액 × 비율 계산
```java
BigDecimal feeAmount = BigDecimal.valueOf(approvedAmount)
                                .multiply(feeRate)
                                .setScale(0, RoundingMode.DOWN);
```
- setScale() 필수
- 반올림 정책은 도메인 규칙

③ 세금 계산
```java
BigDecimal vat = feeAmount.multiply(new BigDecimal("0.1"))
                            .setScale(0, RoundingMode.DOWN);
```
- 세금은 특히 법·회계 기준 영향
- HALF_UP / DOWN 선택 명확히 해야 함

---

## BigDecimal 사용 시 절대 규칙

❌ 잘못된 사용
```java
new BigDecimal(0.1); // 부동소수점 오차 포함
```

✅ 올바른 사용
```java
new BigDecimal("0.1");
BigDecimal.valueOf(0.1);
```

---

## 실무에서 추천하는 방식
```java
// 입력
long approvedAmount;

// 정책
BigDecimal feeRate;

// 계산
BigDecimal feeAmount;
BigDecimal vatAmount;
BigDecimal settlementAmount;

```

- 입력값: long
- 정책값: BigDecimal
- 결과값: BigDecimal

1) 도메인 모델: 입력(long) / 정책(BigDecimal) / 결과(BigDecimal)
```java
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

public class SettlementCalculator {

    // 1) 입력(사실값): 승인/거래 금액은 원 단위 정수(long)
    public record ApprovedTransaction(
            String txId,
            long approvedAmountWon
    ) {}

    // 2) 정책(규칙값): 수수료율/부가세율/반올림 규칙은 BigDecimal + 명시적 정책
    public record SettlementPolicy(
            BigDecimal feeRate,         // 예: 0.023 (2.3%)
            BigDecimal vatRate,         // 예: 0.10 (10%)
            RoundingMode roundingMode,  // 예: DOWN
            int scale                  // 원 단위면 0
    ) {
        public SettlementPolicy {
            Objects.requireNonNull(feeRate);
            Objects.requireNonNull(vatRate);
            Objects.requireNonNull(roundingMode);
        }
    }

    // 3) 결과(파생값): 계산 결과는 BigDecimal (정확도 + 정책 반영)
    public record SettlementResult(
            BigDecimal approvedAmount,
            BigDecimal feeAmount,
            BigDecimal vatAmount,
            BigDecimal settlementAmount
    ) {}

    public SettlementResult calculate(ApprovedTransaction tx, SettlementPolicy policy) {
        Objects.requireNonNull(tx);
        Objects.requireNonNull(policy);

        BigDecimal approved = BigDecimal.valueOf(tx.approvedAmountWon());

        // 수수료 = 승인금액 * 수수료율 (반올림 정책 적용)
        BigDecimal fee = approved
                .multiply(policy.feeRate())
                .setScale(policy.scale(), policy.roundingMode());

        // 부가세 = 수수료 * 부가세율 (반올림 정책 적용)
        BigDecimal vat = fee
                .multiply(policy.vatRate())
                .setScale(policy.scale(), policy.roundingMode());

        // 정산금액 = 승인금액 - 수수료 - 부가세
        BigDecimal settlement = approved
                .subtract(fee)
                .subtract(vat)
                .setScale(policy.scale(), policy.roundingMode());

        return new SettlementResult(approved, fee, vat, settlement);
    }
}


```

2) 사용 예시
```java
import java.math.BigDecimal;
import java.math.RoundingMode;

public class Example {
    public static void main(String[] args) {
        var calc = new SettlementCalculator();

        var tx = new SettlementCalculator.ApprovedTransaction("TX-001", 12_340L);

        var policy = new SettlementCalculator.SettlementPolicy(
                new BigDecimal("0.023"), // 2.3%
                new BigDecimal("0.10"),  // VAT 10%
                RoundingMode.DOWN,
                0 // 원 단위
        );

        var result = calc.calculate(tx, policy);

        System.out.println("승인금액: " + result.approvedAmount());
        System.out.println("수수료:   " + result.feeAmount());
        System.out.println("부가세:   " + result.vatAmount());
        System.out.println("정산금액: " + result.settlementAmount());
    }
}


```
3) 이 패턴이 실무에서 좋은 이유(핵심만)

- 승인금액(long): “원장/PG가 준 사실값”이라서 변형 없이 단순·빠르게 들고 감
- 정책(BigDecimal): 수수료율/세율/반올림은 정책 변경이 잦고 소수점이 필요
- 결과(BigDecimal): 계산된 값은 “정책이 반영된 파생값”이라 정확·재현 가능해야 함
→ 나중에 동일 입력/정책으로 재정산(re-run) 해도 같은 결과가 나옴



