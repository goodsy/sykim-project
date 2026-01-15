---
title: Kotlin runCatching 사용법
description: Kotlin의 runCatching으로 예외 처리를 함수형 스타일로 단순화하는 방법
tags: [notes, kotlin, exception, functional, backend]
---

# Kotlin `runCatching`

`runCatching`은 Kotlin에서 **try-catch를 함수형 스타일로 표현**할 수 있게 해주는 표준 함수다.  
예외가 발생할 수 있는 코드를 `Result<T>`로 감싸 **성공과 실패를 명확하게 분리**한다.

실무에서는 특히  
- 외부 API 연동  
- Spring Batch 처리  
- 실패 허용이 필요한 로직  

에서 가독성과 안정성을 높이기 위해 자주 사용된다.

---

## 기본 개념

```kotlin
inline fun <T> runCatching(block: () -> T): Result<T>
````

* 성공 → `Result.success(value)`
* 실패 → `Result.failure(exception)`

즉, 아래 코드와 동일한 의미다.

```kotlin
try {
    doSomething()
} catch (e: Exception) {
    handle(e)
}
```

```kotlin
runCatching {
    doSomething()
}
```

---

## 기본 사용법

### 성공 / 실패 분기 처리

```kotlin
runCatching {
    callExternalApi()
}.onSuccess { result ->
    log.info("API 호출 성공: {}", result)
}.onFailure { e ->
    log.error("API 호출 실패", e)
}
```

* `onSuccess` : 성공 시 실행
* `onFailure` : 예외 발생 시 실행
* 반환값이 필요 없고 **사이드 이펙트 처리**에 적합

---

### 기본값 반환 (`getOrElse`, `getOrNull`)

#### getOrElse

```kotlin
val response = runCatching {
    apiClient.request()
}.getOrElse { e ->
    log.warn("API 실패, 기본값 반환", e)
    DEFAULT_RESPONSE
}
```

#### getOrNull

```kotlin
val response: Response? = runCatching {
    apiClient.request()
}.getOrNull()
```

* 실패 시 `null` 반환
* 후속 로직에서 null 처리 필요

---


### 예외 재던지기 (`getOrThrow`)

```kotlin
val result = runCatching {
    processSettlement()
}.getOrThrow()
```

* 실패 시 원래 예외 그대로 throw
* 트랜잭션 경계에서 사용

---

## 실무 활용 패턴

### ✔ 외부 시스템 연동 (API / SFTP)

```kotlin
val result = runCatching {
    externalClient.send(request)
}.onFailure {
    alarmService.notify("외부 연동 실패", it)
}.getOrNull()
```

* 예외를 바로 던지지 않음
* 로깅 + 알림 후 흐름 유지

---

### ✔ Spring Batch Processor에서 사용

```kotlin
override fun process(item: SettlementItem): ResultItem =
    runCatching {
        calculate(item)
    }.getOrElse { e ->
        log.error("정산 계산 실패. tid={}", item.tid, e)
        ResultItem.fail(item, e.message)
    }
```

* try-catch 중첩 제거
* 비즈니스 로직 가독성 향상

---

### ✔ 특정 예외만 복구 처리 (`recover`)

```kotlin
runCatching {
    callApi()
}.recover { e ->
    if (e is TimeoutException) {
        fallback()
    } else {
        throw e
    }
}
```

---

## 주의사항

### ❗ 모든 예외를 무시하지 말 것

```kotlin
runCatching {
    criticalLogic()
}.getOrNull()
```

* 장애를 조용히 숨길 수 있음
* 반드시 로깅 또는 알림과 함께 사용

---

### ❗ 비즈니스 흐름 제어용으로 남용 금지

* `runCatching`은 **예외 처리용 도구**
* 단순 조건 분기를 대체하지 말 것

---

## 언제 사용하면 좋을까?

* 외부 연동 (API, MQ, SFTP)
* Spring Batch Processor / Writer
* 실패 허용 & 보완 로직이 있는 경우

피해야 할 경우:

* 핵심 도메인 로직
* 반드시 성공해야 하는 처리

---

## 요약

| 항목    | 설명            |
| ----- | ------------- |
| 목적    | try-catch 간결화 |
| 반환 타입 | `Result<T>`    |
| 장점    | 가독성, 함수형 스타일  |
| 주의    | 예외 은폐 금지      |

---

> runCatching은 예외를 없애는 도구가 아니라
> 예외를 더 명확하게 다루기 위한 도구다.
