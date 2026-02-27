---
title: Scouter 기반 관제 시스템 구축하기
description: Scouter 도입하기
tags: [tech, monitoring]
---

# Scouter 선택 이유
Scouter는 Java 기반 국내 오픈소스 APM이며 선택한 이유는 아래와 같습니다.

- Java Agent 방식 : 코드 수정 없이 빠른 적용 가능
- XLog 트랜잭션 추적 : 요청 단위 상세 분석
- SQL 바인딩 추적 가능 
- Batch 지원 : 배치 환경 관제 가능
- 오픈소스 : 비용 부담 없음

# Scouter 동작 원리

관제 서버에 Collector(Server)를 띄우고 각각의 Agent(Application)들이 정보를 수집하여 Collector로 보내는 방식입니다.
그리고 Collector의 정보를 Client 또는 Paper에서 관제 정보를 조회 및 실행하여 확인이 가능합니다.


```text
[Spring Boot WAS]  - Web
[Netty 서버]        - TCP 통신
[Spring Batch]     - 배치 처리

    ↓ (Java Agent)

Scouter Agent
    ↓
Scouter Server
    ↓
Scouter Client or Paper
```

# Scouter 구성도

Scouter Server(Collector)를 설치하고, 각 서비스의 Agent를 JVM Option으로 적용하면
운영자 PC에서는 Scouter Client 또는 Scouter Paper(Web)에서 Scouter에서 제공하는 웹 어플리케이션(Tomcat, JBoss 등)과 JVM 어플리케이션 지표를 확인 할 수 있습니다..
Scouter Client는 RCP 기반 클라이언트 프로그램으로 PC(윈도우 환경)에 설치, Scouter Paper 이용 시에는 서버에 별도로 설치하여 사용합니다.

### 적용 가능 시스템 환경
- Java 에이전트: 웹 애플리케이션(Tomcat, JBoss, Resin 등에서 실행), 독립형 Java 애플리케이션
- 호스트 에이전트: Linux, Windows, Unix


### Scouter 프로그램
- Agent : 성능 정보를 수집하여 서버로 전송 
  - Java 에이전트(JVM 에이전트) : JVM 및 웹 애플리케이션 서버(예: Tomcat)의 프로필과 성능 지표를 수집
  - 호스트 에이전트(OS 에이전트) : Linux, Windows 및 OSX의 성능 지표를 수집
- Server(Collector) : Scouter 에이전트 또는 Telegraf에서 성능 지표를 저장합니다. 데이터는 Scouter 클라이언트로 스트리밍 
- Client(Viewer) : RCP 기반 클라이언트 프로그램
- 웹 API (버전 1.8.0부터) : HTTP 프로토콜을 통해 카운터, XLog, 프로필 및 기타 성능 지표를 가져오는 Scouter 웹 API를 제공
- 3rd-party UIs Scouter Paper : Scouter 지표를 Web으로 제공 

```text
[Scouter Agent(Application JVM)] : 각 서비스 Agent 적용
        │
        │ (UDP/TCP/6100)
        ∨
[Scouter Collector(Server)]
   ∧                ∧
   │(Http/6180)     │(TCP/6100)
   │                │ 
[Scouter Paper]  [Scouter Client]
   ∧  
   │
   │
User(Browser)(Http/6188)

```
