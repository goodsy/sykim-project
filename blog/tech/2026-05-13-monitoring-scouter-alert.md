# Scouter APM Alert 적용 방법 2가지 비교 — Scripting Plugin vs Built-in Plugin

> Scouter 공식 문서 기반으로 두 가지 Alert 구현 방식을 비교하고, 실무에서 어떤 방식을 선택할지 정리합니다.

---

## 배경

FingerPay 서비스의 실시간 모니터링 강화를 위해 Scouter APM에 Alert 알림 시스템을 붙이게 됐습니다.

Scouter는 Alert를 처리하는 플러그인 방식이 두 가지입니다.

- **Scripting Plugin** — Groovy 스크립트로 런타임에 동적 적용
- **Built-in Plugin** — JAR로 컴파일해서 서버에 배포

처음에는 빠르게 적용할 수 있는 Scripting Plugin으로 시작했다가, 운영 과정에서 한계를 느끼고 Built-in Plugin으로 전환했습니다. 이 글은 두 방식의 차이와 전환 이유를 정리한 내용입니다.

---

## Scouter Plugin 구조

Scouter 공식 문서에 따르면 Server Plugin은 아래와 같이 구분됩니다.

```
Scouter Server Plugin
├── Scripting Plugin   → ./plugin/*.alert 파일 (Groovy 기반, 런타임 동적 로드)
└── Built-in Plugin    → ./lib/*.jar 파일 (Java/Kotlin 컴파일, 서버 기동 시 로드)
```

두 방식 모두 `@ServerPlugin` 훅을 통해 동일한 이벤트를 처리하지만, 구현 방식과 운영 특성이 다릅니다.

---

## 방식 1: Scripting Plugin

### 동작 방식

Scouter 공식 문서에 따르면, Scripting Plugin의 Alert 스크립트 파일은 Scouter Client UI 또는 서버에서 직접 편집할 수 있습니다.

`./plugin/` 디렉토리에 지표명과 동일한 파일명으로 `.alert` 파일을 작성합니다.

```
{SCOUTER_HOME}/plugin/
├── GcTime.alert
├── ErrorRate.alert
├── TPS.alert
└── ...
```

`silent_time`은 알람 슬립 타임으로, 최근 일정 시간 내에 동일한 알람이 발생했을 경우 무시합니다. `check_time`은 스크립트 호출 주기입니다.

### 코드 예시

```groovy
// GcTime.alert
// void process(RealCounter $counter, PluginHelper $$)
int gcTime = $counter.intValue();
if (gcTime > 2000) {
    $counter.fatal("gc time fatal", "gc time:" + gcTime + "ms");
}
```

Telegram 발송을 붙이려면 스크립트 안에서 직접 HTTP 호출을 작성합니다.

```groovy
// ErrorRate.alert
int errorRate = $counter.intValue();
String objName = $counter.objName();

if (errorRate > 10) {
    // Telegram 직접 호출
    def token = conf.getValue("ext_telegram_token", "")
    def chatId = conf.getValue("ext_telegram_chat_id", "")
    def msg = "[FATAL] ErrorRate ${errorRate}% 초과: ${objName}"

    def url = new URL("https://api.telegram.org/bot${token}/sendMessage")
    def conn = url.openConnection()
    conn.setRequestMethod("POST")
    conn.setDoOutput(true)
    def body = "chat_id=${chatId}&text=${URLEncoder.encode(msg, 'UTF-8')}"
    conn.outputStream.write(body.bytes)
    conn.responseCode  // 전송
}
```

### 장점

- **재시작 없이 즉시 반영** — 스크립트 파일 저장 즉시 반영
- **빠른 프로토타이핑** — 임계치 로직을 코드 한 줄로 테스트 가능
- **Scouter Client에서 UI 편집** — 서버 접속 없이 수정 가능

### 단점

- **지표마다 파일 관리** — GcTime.alert, ErrorRate.alert, TPS.alert 각각 별도 파일
- **공통 로직 중복** — Telegram 호출 코드가 모든 `.alert` 파일에 반복
- **설정 분산** — 임계치가 스크립트 코드 안에 하드코딩됨
- **타입 안전성 없음** — Groovy 동적 타입으로 런타임에야 오류 발견
- **테스트 불가** — 단위 테스트 작성 불가
- **채널 라우팅 불가** — 지표별·레벨별로 다른 채널에 보내려면 스크립트마다 분기 필요

---

## 방식 2: Built-in Plugin

### 동작 방식

Scouter 공식 문서에 따르면, Built-in Plugin은 사전에 컴파일된 플러그인을 첨부할 수 있는 방식입니다. Scouter는 서버 기동 시 `lib/` 디렉토리에 위치한 플러그인을 로드합니다.

```
{SCOUTER_HOME}/lib/
└── scouter-plugin-server-fingerpay-alert.jar
```

`@ServerPlugin` 어노테이션에 지정할 수 있는 값은 6가지이며, 기본값은 `PLUGIN_SERVER_COUNTER`입니다.

```kotlin
@ServerPlugin(PluginConstants.PLUGIN_SERVER_COUNTER)
fun counter(pack: PerfCounterPack) {
    // 모든 지표를 단일 진입점에서 처리
}

@ServerPlugin(PluginConstants.PLUGIN_SERVER_ALERT)
fun alert(pack: AlertPack) { ... }

@ServerPlugin(PluginConstants.PLUGIN_SERVER_XLOG)
fun xlog(pack: XLogPack) { ... }

@ServerPlugin(PluginConstants.PLUGIN_SERVER_OBJECT)
fun objectPlugin(pack: ObjectPack) { ... }
```

### 코드 예시

```kotlin
// 단일 진입점에서 모든 지표 처리
@ServerPlugin(PluginConstants.PLUGIN_SERVER_COUNTER)
fun counter(pack: PerfCounterPack) {
    if (!agentFilter.isAllowed(pack.objName)) return

    val config = thresholdConfigLoader.get() ?: return
    val events = counterMonitor.check(pack, config)

    events.forEach { event ->
        channelDispatcher.dispatch(event)
    }
}
```

임계치는 코드 밖 JSON 파일에서 관리합니다.

```json
{
  "thresholds": [
    {
      "metric": "ErrorRate",
      "warnValue": 5.0,
      "fatalValue": 10.0,
      "channelGroups": ["ops", "dev"],
      "cooldownSec": 300
    }
  ]
}
```

### 장점

- **단일 진입점** — 모든 지표를 하나의 클래스에서 처리
- **설정 외부화** — JSON 파일로 임계치 관리, 핫 리로드 지원
- **채널 그룹 라우팅** — 지표별·레벨별 수신 채널 독립 구성
- **타입 안전성** — Kotlin 컴파일 타임에 오류 발견
- **테스트 가능** — 단위 테스트, Testcontainers 연동 가능
- **중복 방지 내장** — cooldown / sentOnce 제어 가능

### 단점

- **재시작 필요** — 로직 변경 시 JAR 재빌드 + 서버 재시작
- **빌드 환경 필요** — Gradle/Maven 빌드 파이프라인 구성 필요
- **초기 구조 설계 비용** — Scripting에 비해 초기 작업량이 많음

---

## 두 방식 비교

| 항목 | Scripting Plugin | Built-in Plugin |
|------|-----------------|-----------------|
| 적용 방식 | `.alert` 파일 (Groovy) | `.jar` 파일 (Java/Kotlin) |
| 반영 | 즉시 (재시작 불필요) | 서버 재시작 필요 |
| 임계치 관리 | 스크립트 내 하드코딩 | 외부 JSON 파일 (핫 리로드) |
| 공통 로직 | 파일마다 중복 | 단일 클래스로 통합 |
| 채널 라우팅 | 스크립트마다 직접 구현 | 설정 기반 자동 라우팅 |
| 타입 안전성 | 없음 (런타임 오류) | 있음 (컴파일 타임) |
| 단위 테스트 | 불가 | 가능 |
| 초기 비용 | 낮음 | 높음 |
| 적합한 상황 | 빠른 검증, 임시 알람 | 운영 수준 지속 모니터링 |

---

## 실무에서 어떤 방식을 선택할까?

**Scripting Plugin이 적합한 경우:**
- 특정 지표를 빠르게 임시 모니터링할 때
- 운영 중 장애 상황에서 즉시 알람 조건을 추가해야 할 때
- 팀에 Java/Kotlin 개발 환경이 없을 때

**Built-in Plugin이 적합한 경우:**
- 여러 지표를 체계적으로 관리해야 할 때
- 지표별·레벨별 채널 라우팅이 필요할 때
- 알람 로직에 이력 기반 비교, 중복 방지 등 복잡한 로직이 필요할 때
- 팀 표준으로 운영 모니터링 시스템을 구축할 때

저는 초기에 Scripting Plugin으로 Telegram 연동을 빠르게 검증한 뒤, 운영 수준의 요구사항(채널 라우팅, 중복 방지, 설정 외부화)이 생기면서 Built-in Plugin으로 전환했습니다.

두 방식은 배타적이지 않습니다. Scripting Plugin으로 빠르게 검증하고, 안정화된 로직을 Built-in Plugin으로 이관하는 방식이 실용적입니다.

---

## 다음 편

2편에서는 Built-in Plugin 기반으로 실제 Telegram / Slack / Email 다채널 알림 시스템을 구현하는 전체 과정을 다룹니다.

- 프로젝트 구조 설계
- `@ServerPlugin` 훅 4가지 구현
- Agent 화이트리스트 필터
- ErrorRate 이력 기반 감지 로직
- JSON 설정 핫 리로드

---

## 참고

- [Scouter Plugin Guide](https://github.com/scouter-project/scouter/blob/master/scouter.document/main/Plugin-Guide.md)
- [Scouter Alert Plugin Guide](https://github.com/scouter-project/scouter/blob/master/scouter.document/main/Alert-Plugin-Guide.md)
- [scouter-plugin-server-null (샘플)](https://github.com/scouter-project/scouter-plugin-server-null)
