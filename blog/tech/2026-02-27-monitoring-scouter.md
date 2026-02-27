---
title: 결제 시스템 관제 도입기 - Scouter 기반 APM 구축과 서비스 관제
description: PG 시스템에 Scouter APM을 도입하여 인프라 관제에서 서비스 관제로 확장한 전체 구축 과정(Docker)  정리한 기술 가이드
tags: [APM, monitoring, Scouter,Monitoring]
---


# 결제 서비스 관제 도입기 

**PG 시스템에 Scouter APM을 도입하며 인프라 관제에서 서비스 관제로 전환한 전체 구축 과정**을 정리한 블로그입니다.

단순 도입기가 아니라, 실제 운영 환경에 적용한 **Docker 구성, Collector 설정, Agent 적용, SQL XLog 설정, Netty Hook 구성까지 전체 내용을 포함한 Guide**입니다.

---

## 서버 관제를 넘어, 서비스 관제로

지금까지 PG 시스템은 CPU, 메모리, 디스크 같은 인프라 지표를 중심으로 모니터링 해왔습니다.

하지만 실제 장애는 “서버가 죽는 문제”보다 “서비스가 정상적으로 동작하지 않는 문제”에서 더 자주 발생합니다.

예를 들어,

- 결제 성공률이 갑자기 2% 하락한 경우
- 외부 연동 응답 시간이 300ms → 2초로 증가한 경우
- 특정 외부 기관 연동에서만 타임아웃이 발생한 경우
- 실패 원인이 내부 문제인지 외부 기관 문제인지 구분이 필요한 경우

이때도 서버는 정상일 수 있지만 고객은 이미 실패를 경험하고 있습니다.

서비스 관제는 단순 리소스를 보는 것이 아니라, **비즈니스 트랜잭션의 흐름과 건강 상태를 보는 일**이라고 생각합니다.

## 왜 Scouter를 선택했는가

관제 도구를 선택할 때 세 가지를 기준으로 보았습니다.

### 1. 트랜잭션 단위로 볼 수 있는가

평균 응답시간이 아니라, 어떤 요청이 어디에서 느려졌는지를 보고 싶었습니다.

### 2. 애플리케이션 내부까지 확인 가능한가

JVM 상태, SQL 실행 시간, 메서드 호출 흐름 등 실제 서비스 내부 동작을 확인할 수 있어야 했습니다.

### 3. 적용이 복잡하지 않은가

전면 코드 수정 없이 Agent 방식으로 붙일 수 있어야 했습니다.

Scouter는 `javaagent` 방식으로 쉽게 적용 가능했고, XLog 기반으로 트랜잭션 흐름을 추적할 수 있어 현재 구조에 비교적 부담 없이 적용할 수 있었습니다.

## Scouter 구성과 서비스 관제 설계 방향

Scouter 시스템 구성은 아래와 같습니다.

> 서비스 서버에 Agent를 붙이고 중앙 Collector 서버가 이를 수집합니다.

[](/gw/contentsImgController/download/gcmsAmaranth32847/editorImg/78b4c3c2-e91f-4d03-958d-b9b0fe40aeef_png)

Scouter 관련 상세 내용은 아래 공식 홈페이지에서 확인하실 수 있습니다.

**🔗 Scouter 공식 문서**

https://github.com/scouter-project/scouter/tree/master/scouter.document/main

## 이제 실제로 적용해보겠습니다

Scotuer는 단일 중앙 Collector가 아닌 **서비스(도메인) 단위로 독립 Collector를 운영**하는 방향이 더 적합하다고 생각합니다.

각 서비스는 Docker 기반으로 Collector를 실행하고, 해당 서비스의 Agent가 데이터를 전송하는 구조입니다.

이와 같은 구조를 선택한 이유는 다음과 같습니다.

- 서비스 간 관제 부하 분리
- 서비스 특성에 맞는 알림 기준 설정
- 확장에 유연하게 대응

이를 통해 특정 서비스의 트래픽 증가나 장애 상황이 다른 서비스의 관제 환경에 영향을 주지 않도록 하기 위함입니다.

*※ 이 부분은 운영하면서 조정이 필요합니다.*

### 1. 관제 서버 준비

현재 인프라 관제 서버에 Scouter를 설치하여 운영 중입니다.

- 권장 사양: 4 Core / 8GB RAM / 200GB Disk 이상
- Docker 기반 구성

각 서비스는 기존 관제 서버의 Docker 이미지를 그대로 활용하여, `docker-compose` 설정만 구성하면 별도 설치 없이 즉시 사용할 수 있습니다.

### 시스템 구성

```text
[Service Server]
   └─ Scouter Agent (JVM)
        ↓ (6100 TCP/UDP)
[Scouter Collector]
   └─ Docker Container
        ↑ (web:6180 / client:6100)
[Scouter Paper / Client]
   └─ Web Dashboard
```

### 2. Collector 설치 (Docker)

### 디렉토리 구성

```bash
sudo mkdir -p /data/scouter/f{logs,data,conf}
cd /data/scouter/
```

### `docker-compose` 설정 : docker-compose.yml

```yaml
services:
  scouter:
    image: scouter-collector:2.21.2
    container_name: scouter-collector
    restart: always
    volumes:
      - ./logs:/home/scouter-server/logs
      - ./data:/home/scouter-server/database
      - ./conf:/home/scouter-server/conf
    ports:
      - "6100:6100"        # Agent / Client
      - "6100:6100/udp"
      - "6180:6180"        # Paper / Web
    networks:
      scouter_net:
        ipv4_address: 10.10.100.200
networks:
  scouter_net:
    driver: bridge
    ipam:
      config:
        - subnet: 10.10.100.0/24
          gateway: 10.10.101.1
```

### **scouter.conf**

```properties
server_id=SERVICE-NAME-COLLECTOR
net_http_server_enabled=true   # Paper/Web 사용 시 설정

mgr_purge_profile_keep_days=2  # SQL Trace, Method Call Tree
mgr_purge_xlog_keep_days=5     # XLog 데이터 보관 주기
mgr_purge_counter_keep_days=15 # CPU, 메모리, TPS, 응답시간
```

*※ 보관 정책은 서비스 특성에 맞게 조정합니다.*

### 실행

```bash
# 시작
sudo docker compose up -d
# 중지
sudo docker compose down
```

### **3. 관제 UI 구성 (Client / Paper)**

### Scouter Client

Scouter Client는 데스크톱 기반 UI로, 상세 분석 및 설정 작업에 적합합니다.

Releases에서 OS에 맞는 파일을 다운로드 후 실행합니다.

🔗 https://github.com/scouter-project/scouter/releases

- 압축 해제 후 `scouter.exe`(Windows 기준) 실행
- Collector 서버 IP / Port 입력 후 접속

### Scouter Paper (Web)

Paper는 Web 기반 UI로, 대시보드 공유/열람에 편리합니다.

### **`docker-compose.yml` 추가 설정**

```yaml
 scouter-paper:
    image: scouterapm/scouter-paper:2.6.4
    container_name: scouter-paper
    restart: always
    depends_on:
      - scouter
    ports:
      - "6188:80"
    volumes:
      - .conf/paper-application.yml:/home/scouter-paper/conifg/application.yml
    networks:
      scouter_net:
        ipv4_address: 10.10.201.11
```

### **paper 설정 파일**

```bash
sudo nano paper-application.yml
```

```yaml
server:
  port: 80

paper:
  collector:
  host: 10.10.100.251 #Collector IP
  port: 6180          #Collector Port
  protocol: http
```

### **Web 접속**

```text
http://서버IP:6188
```

Scouter Paper 대한 자세한 정보와 Layout 구성은 공식 문서를 참고하시기 바랍니다.

**🔗 Scouter Paper 공식 문서**

https://scouter-contrib.github.io/scouter-paper/manual.html

### 4. 서비스 서버에 Agent 적용

각 서비스에 Agent를 적용하고 재기동하면 Collector가 자동으로 지표를 수집합니다.

### 다운로드 및 해제

```bash
mkdir -p /home/scouter/
cd /home/scouter/

# Scouter download
wget https://github.com/scouter-project/scouter/releases/download/v2.21.1/scouter-all-2.21.1.tar.gz
tar -xvf scouter-all-2.21.1.tar.gz
```

```bash
# batch 관제는 batch.agent로 하며 2.20.0이 최신(마지막) 버전
wget https://github.com/scouter-project/scouter/releases/download/v2.20.0/scouter-all-2.20.0.tar.gz
tar -xvf scouter-all-2.21.1.tar.gz
```

### agent conf 설정 : scouter-{서비스명}.conf

```properties
obj_name=prod-{서비스명}
net_collector_ip=10.10.100.111  # collector 서버 IP
net_collector_udp_port=6100     # collector port
net_collector_tcp_port=6100
```

### JVM 옵션 추가

```text
# start.sh vm option 추가
-javaagent:/home/scouter/agent.java/scouter.agent.jar
-Dscouter.config=/home/scouter/agent.java/conf/scouter-xxx.conf
```

서비스 재기동 후 Collector에서 확인 가능합니다.

### **※ Agent 설정 참고 사항**

**1. SQL Xlog 노출 설정**

MariaDB Java Client 3.0 이상을 사용하는 경우, 기본 설정만으로는 SQL XLog가 정상적으로 수집되지 않을 수 있습니다.

이 경우 `agent.conf` 파일에 아래 설정을 추가해야 합니다.

```properties
#Method set for preparestatement hooking
hook_jdbc_pstmt_classes=org.mariadb.jdbc.ClientPreparedStatement
#Method set for statement hooking
hook_jdbc_stmt_classes=org.mariadb.jdbc.Statement
```

해당 설정을 통해 PreparedStatement 및 Statement 기반 SQL 실행 로그가 XLog에 노출됩니다.

**2. SQL Xlog 바인딩 값 미노출**

MariaDB Driver 사용 시, SQL 바인딩 값이 XLog에 노출되지 않는 현상이 있습니다.

- Driver Class: `org.mariadb.jdbc.Driver`
- MariaDB Driver는 바인딩 값 추적을 Scouter에서 완전하게 지원하지 않습니다.

따라서 운영 환경에서 SQL 파라미터 값까지 추적이 필요한 경우, Driver 특성에 대한 사전 검토가 필요합니다.

**3. Native Netty 서비스 XLog 설정**

PG 승인 데몬은 Native Netty 기반 서비스로 기본 Java Web 트랜잭션과 달리 별도의 Hook 설정이 필요합니다.

특히 다음과 같은 구간을 명시적으로 Hook 대상으로 추가해야 합니다.

- 결제창(Front)으로부터 수신하는 Channel 처리 구간
- 1차 PG 연동을 수행하는 HTTP 통신 구간
- 내부/외부 Socket 송수신 구간

`scouter-approval-xxx.conf` 설정 예시는 다음과 같습니다.

```properties
#결제창과 송수신하는 Channel package 및 method 명
hook_server_patterns=
#http 및 scoket 통신 등의 외부통신 package 및 method 명
hook_method_patterns=
```

이를 통해 Netty 기반 트랜잭션도 XLog 및 성능 관제 대상에 포함시킬 수 있습니다.

## **현재 관제 시스템 적용 현황**

PayTech팀에서는 현재 PG 주요 서비스에 Agent를 적용하여 운영 환경에서 서비스 지표를 수집하고 있습니다.

- PG 승인
- 결제창
- API
- 내부 및 가맹점 관리자 시스템

적용 이후, 그동안 막연히 “조금 느린 것 같다”고 느끼던 구간이 수치로 확인되기 시작했습니다.

아직 명확한 기준선(Baseline)이 완전히 정립된 단계는 아니지만 **무엇이 얼마나 느려졌는지** 그리고 **어느 구간에서 병목이 발생하는지** 파악할 수 있는 상태가 되었습니다.

### **앞으로의 계획**

1. 핵심 트래픽 구간 중심 적용 및 기준선 설정

2. 서비스별 관제 항목 정의 및 알림 정책 정리

3. PG 정산/매입 배치 영역 확장 (처리 건수, 소요 시간, Retry/Skip 비율 등)

---

이번 관제 도입의 목표는 **서비스의 상태를 실시간으로 확인하고, 장애를 고객보다 먼저 인지하는 구조**로 전환하는 것입니다.

응답 지연과 실패율 증가를 사후 대응이 아닌 사전 감지로 바꾸고 감이 아닌 데이터로 판단하는 운영 방식으로 나아가고자 합니다.

저에게도 관제 시스템 도입은 처음 시도해보는 작업입니다.

완성된 체계를 공유하기보다는 먼저 적용해본 경험을 나누는 내용이라고 봐주시면 감사하겠습니다.


