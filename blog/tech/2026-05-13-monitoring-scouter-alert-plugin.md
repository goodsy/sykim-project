# Scouter Built-in Plugin으로 다채널 알림 시스템 구현하기

> Telegram / Slack / Email 3채널, JSON 설정 핫 리로드, ErrorRate 이력 기반 감지까지 — Built-in Plugin 구현 전체 과정을 정리합니다.

---

## 배경

[1편](./2026-05-13-monitoring-scouter-alert.md)에서 Scripting Plugin과 Built-in Plugin의 차이를 비교했습니다.

이번 편은 실제 구현입니다. 결제 서비스에 적용한 Scouter Built-in Plugin의 전체 구조와 핵심 로직을 단계별로 설명합니다.

**구현 목표:**
- TPS / ErrorRate / Elapsed / GC / Heap 지표 실시간 감지
- Agent 화이트리스트 기반 선별 모니터링
- Telegram / Slack / Email 채널 라우팅 (지표별·레벨별)
- JSON 설정 핫 리로드 (서버 재시작 없이 임계치 변경)
- cooldown / sentOnce 중복 알림 방지

---

## 프로젝트 구조

```
scouter-plugin-server-alert/
├── build.gradle
└── src/main/
    ├── kotlin/scouter/plugin/server/alert/
    │   ├── ScouterAlertPlugin.kt       ← 플러그인 진입점
    │   ├── common/
    │   │   ├── Channel.kt                ← 채널 Enum
    │   │   └── ScouterAlertLevel.kt       ← 알림 레벨 Enum
    │   ├── monitoring/
    │   │   ├── CounterMonitor.kt         ← 지표 체크 엔진
    │   │   ├── MetricThreshold.kt        ← 임계치 설정 모델
    │   │   ├── ThresholdConfig.kt        ← JSON 루트 모델
    │   │   ├── ThresholdConfigLoader.kt  ← 핫 리로드
    │   │   ├── AlertEvent.kt             ← 알림 이벤트 DTO
    │   │   └── ErrorHistory.kt           ← ErrorRate 이력
    │   ├── sender/
    │   │   ├── MessageSender.kt
    │   │   ├── TelegramSender.kt
    │   │   ├── SlackSender.kt
    │   │   └── EmailSender.kt
    │   └── uitl/
    │       ├── AgentFilter.kt
    │       ├── ChannelDispatcher.kt
    │       ├── MessageFormatter.kt
    │       └── LogUtil.kt
    └── resources/
        └── metric-thresholds.json
```

---

## 1단계: 의존성 설정

Scouter 공식 문서에 따르면 Built-in Plugin은 `scouter-common`과 `scouter-server` 두 의존성이 필요합니다.

```groovy
// build.gradle
dependencies {
    compileOnly 'io.github.scouter-project:scouter-common:2.21.2'
    compileOnly 'io.github.scouter-project:scouter-server:2.21.2'
    implementation 'com.google.code.gson:gson:2.10.1'
}

// 의존성 포함 fat jar 생성
jar {
    from configurations.runtimeClasspath.collect {
        it.isDirectory() ? it : zipTree(it)
    }
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
}
```

`scouter-common`과 `scouter-server`는 Scouter 서버에 이미 포함되어 있으므로 `compileOnly`로 선언합니다. Gson처럼 서버에 없는 의존성만 fat jar에 포함합니다.

---

## 2단계: 플러그인 진입점

Scouter Built-in Plugin은 `@ServerPlugin` 어노테이션으로 훅을 등록합니다. 공식 문서 기준으로 제공되는 훅은 6가지이며, 이 프로젝트에서는 4가지를 사용합니다.

```kotlin
class ScouterAlertPlugin {

    private val agentFilter = AgentFilter()
    private val dispatcher = ChannelDispatcher()
    private val monitor = CounterMonitor()
    private val configLoader = ThresholdConfigLoader.instance

    // ① 성능 지표 수신 (5초마다)
    @ServerPlugin(PluginConstants.PLUGIN_SERVER_COUNTER)
    fun counter(pack: PerfCounterPack) {
        if (!agentFilter.isAllowed(pack.objName)) return
        val config = configLoader.get() ?: return

        counterMonitor.check(pack, config).forEach { event ->
            dispatcher.dispatch(event)
        }
    }

    // ② Scouter 자체 Alert 수신
    @ServerPlugin(PluginConstants.PLUGIN_SERVER_ALERT)
    fun alert(pack: AlertPack) {
        if (!agentFilter.isAllowed(pack.objName)) return
        dispatcher.dispatchAlert(pack)
    }

    // ③ Agent heartbeat (UP 감지)
    @ServerPlugin(PluginConstants.PLUGIN_SERVER_OBJECT)
    fun objectPlugin(pack: ObjectPack) {
        if (!agentFilter.isAllowed(pack.objName)) return
        dispatcher.dispatchObjectUp(pack)
    }

    // ④ XLog (Slow Transaction 감지)
    @ServerPlugin(PluginConstants.PLUGIN_SERVER_XLOG)
    fun xlog(pack: XLogPack) {
        if (!agentFilter.isAllowed(pack.objName)) return
        dispatcher.dispatchSlowTx(pack)
    }
}
```

---

## 3단계: Agent 화이트리스트 필터

운영 환경에는 수십 개의 Agent가 연결됩니다. 모니터링 대상만 선별하기 위해 `objName` 화이트리스트를 적용했습니다.

```kotlin
class AgentFilter {
    private val conf = Configure.getInstance()

    fun isAllowed(objName: String): Boolean {
        val whitelist = conf.getValue(
            "ext_plugin_alert_agent_whitelist", ""
        )
        if (whitelist.isBlank()) return false  // 미설정 시 전체 차단

        return whitelist.split(",")
            .map { it.trim().lowercase() }
            .any { objName.lowercase().contains(it) }
    }
}
```

```properties
# scouter.conf
# objName에 "ims", "mms", "api", "batch" 중 하나라도 포함되면 허용
ext_plugin_alert_agent_whitelist=ims,mms,api,batch
```

---

## 4단계: JSON 설정 핫 리로드

임계치가 코드에 하드코딩되면 변경마다 서버를 재시작해야 합니다. `metric-thresholds.json`을 60초마다 폴링해서 변경 시 무중단으로 교체합니다.

```kotlin
class ThresholdConfigLoader private constructor() {

    private val configRef = AtomicReference<ThresholdConfig>()
    private var lastModified = 0L

    init {
        reload()  // 최초 로드
        // 60초마다 변경 감지
        Executors.newSingleThreadScheduledExecutor { r ->
            Thread(r).also { it.isDaemon = true }
        }.scheduleWithFixedDelay(::reloadIfChanged, 60, 60, TimeUnit.SECONDS)
    }

    fun get(): ThresholdConfig? = configRef.get()

    private fun reloadIfChanged() {
        val file = resolveConfigFile()
        if (file.lastModified() == lastModified) return  // 변경 없음
        reload()
    }

    private fun reload() {
        try {
            val file = resolveConfigFile()
            val config = Gson().fromJson(file.readText(), ThresholdConfig::class.java)
            config.init()
            configRef.set(config)  // AtomicReference 무중단 교체
            lastModified = file.lastModified()
            LogUtil.info("설정 파일 Load 완료: ${file.absolutePath}")
        } catch (e: Exception) {
            LogUtil.error(this::class.java, "설정 파일 Load 실패: ${e.message}")
            // 이전 설정 유지
        }
    }

    companion object {
        val instance = ThresholdConfigLoader()
    }
}
```

`AtomicReference`를 사용해서 설정 교체 중에도 다른 스레드가 안전하게 이전 설정을 읽을 수 있습니다.

---

## 5단계: ErrorRate 이력 기반 감지

ErrorRate를 단순 임계치로만 체크하면 문제가 있습니다.

- 에러율이 계속 25%로 유지 중인데 5초마다 알림이 반복 발송됩니다.
- 알림이 한 번 왔을 때 이미 인지한 상태인데 추가 발송이 의미가 없습니다.

그래서 **"cooldownSec 전보다 에러율이 상승했을 때만"** 발송하는 이력 기반 감지를 적용했습니다.

```kotlin
class ErrorHistory {
    private val history = ArrayDeque<Pair<Double, Long>>()  // (값, 시각)

    fun add(value: Double, timestamp: Long) {
        history.addLast(value to timestamp)
        // 오래된 데이터 정리 (10분 초과)
        val cutoff = timestamp - 600_000L
        while (history.isNotEmpty() && history.first().second < cutoff) {
            history.removeFirst()
        }
    }

    fun hasDataBefore(targetTime: Long) = history.any { it.second <= targetTime }

    fun getRateBefore(targetTime: Long): Double =
        history.lastOrNull { it.second <= targetTime }?.first ?: -1.0
}
```

```kotlin
// CounterMonitor.kt - ErrorRate 체크 로직
private fun checkErrorRateAbsolute(...) {
    // cooldown 중이면 스킵
    val inCooldown = last != null && now - last < cooldownMs
    if (inCooldown) return

    // cooldownSec 전 값과 비교
    val prevErr = history.getRateBefore(now - cooldownMs)

    // 현재값 <= 이전값이면 미발송 (하락 또는 동일)
    if (currentErr <= prevErr) return

    // 이전 데이터 없으면 (서비스 기동 초기) warnValue 절대값 체크로 대체
    if (prevErr < 0) {
        val level = th.decideLevel(currentErr) ?: return
        sendAlert(...)
        return
    }

    val level = th.decideLevel(currentErr) ?: return
    sendAlert(...)
}
```

**동작 시나리오:**

```
ErrorRate 2%  →  이전(2%) 동일 → 미발송
ErrorRate 15% →  이전(2%) 대비 상승 → 발송 ✅
이후 300초간  →  cooldown → 미발송
300초 후 8%   →  이전(15%) 대비 하락 → 미발송
300초 후 20%  →  이전(8%) 대비 상승 → 발송 ✅
```

---

## 6단계: 채널 그룹 라우팅

지표마다, 레벨마다 다른 채널로 받고 싶었습니다.

- ops팀: WARN은 Slack, CRITICAL은 Email
- dev팀: ERROR 이상은 Telegram + Slack

이를 `metric-thresholds.json`에서 선언적으로 구성합니다.

```json
{
  "channelGroups": {
    "ops": {
      "WARN":     ["slack"],
      "ERROR":    ["slack", "email"],
      "CRITICAL": ["slack", "email"]
    },
    "dev": {
      "WARN":     ["slack"],
      "ERROR":    ["telegram", "slack"],
      "CRITICAL": ["telegram", "slack", "email"]
    }
  },
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

```kotlin
class ChannelDispatcher {

    fun dispatch(event: AlertEvent) {
        val config = ThresholdConfigLoader.instance.get() ?: return
        val channels = config.resolveChannels(event.channelGroup, event.level)

        channels.forEach { channel ->
            when (channel) {
                Channel.TELEGRAM -> telegramSender.send(event)
                Channel.SLACK    -> slackSender.send(event)
                Channel.EMAIL    -> emailSender.send(event)
            }
        }
    }
}
```

---

## 7단계: 중복 알림 방지

같은 알림이 반복 발송되지 않도록 두 가지 방식을 지원합니다.

### cooldown 방식

마지막 발송 시각을 기록하고 `cooldownSec` 동안 재발송을 차단합니다.

```kotlin
// cooldownMap key: "{objName}::{metric}::{channelGroup}::{level}"
val key = "${ctx.objName}::${ctx.metric}::$group::$level"
val last = cooldownMap[key]
if (last != null && now - last < th.cooldownSec * 1000L) return  // cooldown 중

cooldownMap[key] = now
// 발송
```

### sentOnce 방식

복구 전까지 재발송하지 않습니다. Heap, ActiveService 같이 한번 임계치를 초과하면 복구 전까지 알림이 불필요한 지표에 적합합니다.

```kotlin
// sentOnceSet key: reload 후에도 안정적으로 유지되도록 stableId 사용
val key = "${ctx.objName}::${ctx.metric}::$group::${th.stableId()}"
if (!sentOnceSet.add(key)) return  // 이미 발송됨

// 복구 시 키 제거 → 재발송 가능
if (th.isRecovered(currentValue)) {
    sentOnceSet.remove(key)
}
```

> **주의:** `System.identityHashCode(th)`를 sentOnce 키로 사용하면 설정 파일 리로드 시 `MetricThreshold` 객체가 새로 생성되면서 해시코드가 바뀌어 sentOnce가 초기화됩니다. `metric + channelGroups` 조합으로 안정적인 키를 만드는 `stableId()`를 사용해야 합니다.

---

## 배포

```bash
# 1. 빌드
./gradlew jar

# 2. 배포
cp build/libs/scouter-plugin-server-alert-alert.jar {SCOUTER_HOME}/lib/
cp metric-thresholds.json {SCOUTER_HOME}/conf/

# 3. scouter.conf 설정
echo "ext_plugin_alert_agent_whitelist=ims,mms,api,batch" >> {SCOUTER_HOME}/conf/scouter.conf
echo "ext_plugin_alert_telegram_token=YOUR_TOKEN" >> {SCOUTER_HOME}/conf/scouter.conf
echo "ext_plugin_alert_slack_channel=https://hooks.slack.com/..." >> {SCOUTER_HOME}/conf/scouter.conf

# 4. 재시작
cd {SCOUTER_HOME} && ./startup.sh
```

적용 확인:
```
[FB-PLUGIN] [ThresholdConfigLoader] 설정 파일 Load 완료
[FB-PLUGIN] [ThresholdConfigLoader] 설정 파일 감시 시작 (interval=60s)
```

---

## 구현하면서 만난 이슈들

### Scouter가 PerfCounterPack을 2번 전송하는 문제

Scouter agent는 집계 주기 경계에서 실측값과 초기화값(0.0)을 연속으로 전송합니다. ErrorRate 0.0이 복구로 오판되어 sentOnce가 즉시 리셋되는 문제가 발생했습니다.

해결: cooldown 기반으로 전환 후, `cooldownSec 전 값과 비교`하는 방식으로 0.0 오판을 원천 차단했습니다.

### TPS Spike 오발보 문제

저조한 TPS 서비스에서 `prevTps=0.1 → tps=0.4` 시 3배 조건이 충족되어 오발보가 발생했습니다.

해결: `tpsSpikeMinBase` 설정을 추가해서 이전 TPS가 일정 값 이상일 때만 Spike 체크를 실행합니다.

```json
{
  "metric": "TPS",
  "tpsSpikeRatio": 3.0,
  "tpsSpikeMinBase": 10.0
}
```

---

## 정리

Scouter Built-in Plugin을 직접 구현하면서 느낀 점은, 공식 문서의 Scripting Plugin 예시 수준에서 운영 수준으로 올리려면 생각보다 많은 부분을 직접 설계해야 한다는 것입니다.

특히 중복 알림 방지, 이력 기반 감지, 채널 라우팅은 Scripting Plugin으로는 파일마다 중복 구현해야 하지만 Built-in Plugin에서는 한 번 잘 만들어두면 모든 지표에 재사용할 수 있습니다.

전체 소스 코드는 GitHub에 공개 예정입니다.

---

## 참고

- [Scouter Plugin Guide](https://github.com/scouter-project/scouter/blob/master/scouter.document/main/Plugin-Guide.md)
- [Scouter Alert Plugin Guide](https://github.com/scouter-project/scouter/blob/master/scouter.document/main/Alert-Plugin-Guide.md)
- [scouter-plugin-server-null (공식 샘플)](https://github.com/scouter-project/scouter-plugin-server-null)
- [GitHub Repository](https://github.com/YOUR_ID/scouter-plugin-server-alert)
