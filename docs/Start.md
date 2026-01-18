# 跨網域安全入口站 (Cross-Domain Secure Ingestion Node) - 系統規格書

本規格書定義了位於**跨信任邊界前哨**的入口系統，負責統一接收檔案與數據流，經過安全清洗與協議轉換後，單向投遞至高安全區（藍端）。

---

## 一、核心業務模組 (Core Modules)

本系統由兩大核心模組組成：**檔案處理**與**串流聚合**。

### 1. 檔案傳輸與清洗模組 (File Transfer & Sanitization)
*目標：確保只有乾淨、合規的檔案能進入藍端。*

*   **統一檔案入口 (Unified Ingress)**
    *   支援多種上傳方式：Web Portal (HTTPS)、API、專用 Agent (SFTP/FTPS)。
    *   具備暫存區 (Staging Area) 作為檔案落地點。
    *   支援大檔續傳 (Resume) 與完整性校驗 (Hash Check)。

*   **惡意程式掃描與清洗 (AV & Sanitization)**
    *   多引擎掃描：整合 ClamAV 與商用防毒引擎。
    *   深度內容清洗：CDR (Content Disarm and Reconstruction) 支援（選配）。
    *   遞迴掃描：自動解壓縮 ZIP/RAR 並掃描內容物。
    *   Fail-Closed 機制：掃描失敗或逾時一律視為惡意檔案並隔離。

*   **核准流程 (Approval Workflow)**
    *   人工核准：支援主管或資安官審核（四眼原則）。
    *   自動化政策：依據檔案類型、大小、來源自動放行或阻擋。

### 2. 串流數據聚合模組 (Streaming Data Aggregation)
*目標：將異質即時數據流統一轉為 UDP，適應單向傳輸特性。*

*   **多源數據接收 (Multi-Protocol Ingestion)**
    *   **Syslog 標準日誌**：接收 UDP 514 或 TCP 6514 (TLS) 格式。
    *   **Raw UDP Stream**：接收任意 UDP 資料流（如 NetFlow, SNMP Trap）。
    *   **工業/特殊協議 (Industrial/TCP)**：接收 Modbus, OPC UA 或其他 TCP-based 協議。

*   **協議轉換與正規化 (Protocol Normalization)**
    *   **TCP 轉 UDP (TCP-to-UDP Bridge)**：針對 TCP 來源（如 TCP Syslog, 工業控制指令），系統負責維護連線，並將 Payload 拆解/正規化後轉為 UDP 封包。
    *   **埠號對應 (Port Mapping)**：以不同的目的端 UDP Port 來區分不同來源的數據流（例如：Syslog A -> UDP 5140, Modbus -> UDP 5002），無需額外封裝 Header，藍端依 Port 識別即可優化處理效能。

*   **單向投遞管道 (Unidirectional Output)**
    *   所有串流數據（無論原始為 TCP 或 UDP）最終皆轉為 **UDP 串流**。
    *   直接導向單向閘道/藍端介面。
    *   支援流量整形 (Traffic Shaping) 避免塞爆單向連結。

---

## 二、身份與存取控制 (Identity & Access)

*   **帳號與認證**
    *   支援本地帳號、AD/LDAP、OIDC 整合。
    *   強制多因子認證 (MFA) 於管理與檔案上傳介面。
    *   API Token 管理：針對系統介接（如自動化上傳）提供可撤銷的 Token。

*   **細緻權限 (RBAC)**
    *   職權分離：上傳者、核准者、系統管理員、稽核員權限完全獨立。
    *   專案隔離：不同部門/專案的檔案與數據流互相隔離。

---

## 三、流程控制與政策引擎 (Policy Engine)

*   **檔案政策**
    *   副檔名與真實型態 (Magic Number) 比對白名單。
    *   檔名規範檢查（禁止特殊字元）。
*   **串流政策**
    *   來源 IP 白名單 (Source IP Whitelisting)。
    *   協議合規性檢查（如：確認 Port 514 進來的真的是 Syslog 格式）。
    *   異常流量偵測：瞬間流量超限即觸發 Circuit Breaker。

---

## 四、記錄、稽核與可追溯性 (Audit & Traceability)

*   **完整審計紀錄 (Comprehensive Audit Log)**
    *   **檔案**：紀錄 誰上傳、檔案 Hash、掃描結果、誰核准、傳輸時間。
    *   **串流**：紀錄 連線建立/結束時間、來源 IP、傳輸位元組數 (Bytes)、錯誤統計。
*   **不可竄改性**
    *   日誌 hash chaining 或即時寫入 WORM 儲存媒體。
    *   支援送往外部 SIEM。
*   **取證支援**
    *   保留原始惡意檔案（加密隔離）供後續鑑識。
    *   保留關鍵 Metadata 以重建事件發生經過。

---

## 五、傳輸與邊界防護 (Transport Security)

*   **網路層強化**
    *   系統加固 (Hardening)：關閉不必要 Port。
    *   抗 DoS 設計：針對 TCP Sync Flood 或 UDP Flood 的防護機制。
    *   單向傳輸優化：針對 UDP 丟包的 FEC (Forward Error Correction) 前置處理（選配）。

*   **隱密性**
    *   對外不回應 ICMP (Ping)。
    *   隱藏服務版本資訊。

---

## 六、系統健壯性 (Resilience)

*   **高可用性 (High Availability)**
    *   Disk 寫滿保護：自動清除過期/已傳輸檔案。
    *   斷線緩衝：串流數據在單向鏈路中斷時短暫 Buffer（視記憶體大小而定）。
*   **資源隔離**
    *   檔案掃描在獨立沙箱/容器執行，避免汙染主系統。

---

## 七、管理與監控 (Management)

*   **儀表板 (Dashboard)**
    *   即時顯示檔案佇列長度、串流吞吐量 (Throughput)。
    *   顯示最近攔截的威脅統計。
*   **外部整合**
    *   支援 Syslog/SNMP Trap 通知外部監控系統。

---

## 八、產品設計核心思維 (Design Philosophy)

> **「入口站是信任的起點，也是風險的終點。」**

1.  **Zero Trust for Content**：預設所有進來的檔案與數據都是惡意的，直到被證明乾淨。
2.  **Protocol Break**：不讓外部的 TCP 連線直接穿透到內部，必須在入口站終止並轉換（轉為 UDP 或純 Payload），阻絕協定層攻擊。
3.  **Traceability is Key**：重點不只是傳過去，而是證明「為什麼可以傳過去」，以應對稽核。
