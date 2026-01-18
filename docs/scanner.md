# 檔案掃描模組設計 (Scanner Module Design)

本文件描述 **Cross-Domain File Transfer Gateway** 的檔案掃描子系統設計。
系統採用 **微服務 (Microservices) 架構**，由 **Scanner Hub** 統一調度三大核心掃描模組。

---

## 1. 系統架構 (System Architecture)

### 架構圖

```mermaid
graph TD
    Client[Gateway / Client] -->|1. Submit File| Hub[Scanner Hub<br>(Orchestrator)]
    
    Hub -->|2. Dispatch| AV[Mod 1: Antivirus<br>(ClamAV)]
    Hub -->|2. Dispatch| CDR[Mod 2: CDR<br>(Sanitization)]
    Hub -->|2. Dispatch| Box[Mod 3: Sandbox<br>(CAPEv2)]
    
    AV -->|Verdict: Clean/Infected| Hub
    CDR -->|Verdict: Cleaned File| Hub
    Box -->|Verdict: Behavior Report| Hub
    
    Hub -->|3. Aggregate Results| Client
```

### 核心中樞
*   **Scanner Hub**: 單一入口點。
    *   負責接收檔案。
    *   根據檔案類型與策略，決定要啟用哪幾個模組 (例如：PDF 走 CDR，EXE 走 Sandbox)。
    *   彙整最終報告。

---

## 2. 三大掃描模組詳解 (Scanning Modules)

我們採用「縱深防禦 (Defense in Depth)」策略，結合三種不同技術來互補。

### Module 1: 特徵碼防毒 (Signature-based AV)
*   **代表工具**: **ClamAV** (Open Source)
*   **角色**: **「警衛」 (The Guard)**
*   **原理**: 比對資料庫中的「已知病毒指紋」。
*   **優點**: **速度極快** (毫秒級)、成本低、誤判率低。
*   **缺點**: 無法偵測全新的病毒 (Zero-Day)。
*   **策略**: 作為**第一道防線**，快速過濾掉 90% 的已知垃圾威脅。

### Module 2: 檔案清洗 (CDR)
*   **代表工具**: **Custom scripts** (基於 Python) 或 Opswat (商用)
*   **角色**: **「消毒水」 (The Sanitizer)**
*   **全名**: Content Disarm and Reconstruction
*   **原理**: 不管有無病毒，直接**移除**檔案中所有可執行的部分 (Macros, JavaScript, Hyperlinks)，然後重建檔案。
*   **適用對象**: **文件類** (Office, PDF, Images)。
*   **優點**: **100% 根除** 文件型 Zero-Day 攻擊 (因為攻擊載體被拔掉了)。
*   **缺點**: 可能導致文件排版微調；無法處理執行檔 (EXE)。

### Module 3: 地端沙箱 (Local Sandbox)
*   **代表工具**: **CAPEv2** (Open Source)
*   **角色**: **「審訊室」 (The Interrogator)**
*   **原理**: **行為分析 (Behavior Analysis)**。將檔案丟入隔離的虛擬機 (VM) 執行，觀察其行為 (是否加密檔案? 是否連線黑名單 IP?)。
*   **適用對象**: **執行檔** (EXE, DLL, MSI, Powershell)。
*   **優點**: 能抓到最刁鑽的 **APT 攻擊** 與 **Zero-Day** 惡意程式。
*   **缺點**: **速度最慢** (需數分鐘)、資源消耗大 (需跑 VM)。
*   **網路配置**: 採用 **FakeNet (模擬網路)** 技術，在斷網環境下欺騙病毒已連線，誘使其發作。

---

## 3. 機制比較總表 (Comparison)

| 特性 | 1. 特徵碼 (AV) | 2. 檔案清洗 (CDR) | 3. 沙箱 (Sandbox) |
| :--- | :--- | :--- | :--- |
| **針對目標** | 已知病毒 (Known Threats) | 文件型隱藏代碼 | 未知/精細攻擊 (Zero-Day/APT) |
| **核心技術** | 指紋比對 | 結構拆解與清洗 | 動態行為監控 |
| **速度** | 快 (Fast) | 中 (Medium) | 慢 (Slow) |
| **運算成本** | 低 | 中 | 極高 (需虛擬化) |
| **Zero-Day防禦** | ❌ 無效 | ✅ 有效 (僅文件) | ✅ 有效 (全類型) |
| **建議用途** | 全面普篩 | 高機敏文件處理 | 可疑執行檔分析 |

---

## 4. 實作路徑 (Implementation Roadmap)

建議採用 **漸進式開發**：

1.  **Phase 1: 基礎建設**
    *   開發 `Scanner Hub` (Python FastAPI)。
    *   整合 `ClamAV` (Docker)。
    *   完成基本的檔案上傳與掃描流程。

2.  **Phase 2: 文件清洗**
    *   開發簡易版 `CDR Engine`。
    *   支援 PDF (移除 JS) 與 Word (移除 VBA)。

3.  **Phase 3: 進階防禦 (未來擴充)**
    *   架設 `CAPEv2` 沙箱伺服器。
    *   開發 Scanner Hub 對接 Sandbox 的外掛 (Plugin)。

---

## 5. Docker 部署可行性 (Docker Deployment)

| 模組 | Docker 化難度 | 說明 |
| :--- | :--- | :--- |
| **Scanner Hub** | 🟢 容易 (Easy) | 純 Web Service (Python/Node)，完全支援 Docker。 |
| **Mod 1: AV** | 🟢 容易 (Easy) | 官方有現成 Image `clamav/clamav`，直接 `docker run` 即可。 |
| **Mod 2: CDR** | 🟢 容易 (Easy) | 純 Python Scripts，打包成 Container 非常簡單。 |
| **Mod 3: Sandbox** | 🟡 中等 (Medium) | **在實體 Linux 主機上可行**。CAPEv2 Host 服務可以 Docker 化，但必須將底層 KVM 權限共享給容器 (`--device /dev/kvm`)。此架構下無需巢狀虛擬化，效能最佳。如果在 Windows/Cloud VM 上跑則會變成上述的困難模式。 |

## 6. 推薦部署架構 (Recommended Deployment)

基於效能與維護性的考量，強烈建議採用 **All-in-One 實體 Linux 主機** 方案：

### All-in-One Linux Host
*   **硬體**: 單台實體伺服器 (Bare Metal)，安裝 **Ubuntu 22.04 / 24.04 LTS**。
*   **優勢**:
    1.  **無巢狀虛擬化問題**: 實體機直接運行 KVM，CAPEv2 沙箱效能最好。
    2.  **管理統一**: 所有服務 (Web, AV, CDR, Scanner Hub) 統一透過 `docker compose` 管理。
    3.  **CAPEv2 整合**: CAPEv2 Host 可選擇透過特權 Docker 容器運行，或直接安裝於 Host OS，兩者皆可無縫存取 KVM。
*   **網路**: 使用 Docker Network 串聯各服務，Scanner Hub 可直接透過內部 IP 呼叫 CAPEv2 API。

```mermaid
graph TD
    subgraph "Physical Linux Server (Ubuntu)"
        KVM[KVM Hypervisor<br>(Kernel Level)]
        
        subgraph "Docker Environment"
            Web[Web Service<br>(Next.js)]
            Hub[Scanner Hub]
            AV[ClamAV]
            CDR[CDR Engine]
            
            CapeHost[CAPEv2 Host<br>(Privileged Container)]
        end
        
        subgraph "Virtual Machines"
            WinVM[Windows Sandbox<br>(Guest VM)]
        end
        
        Web --> Hub
        Hub --> AV
        Hub --> CDR
        Hub --> CapeHost
        CapeHost -->|Controls| WinVM
        WinVM -.->|Runs on| KVM
    end
```

## 7. CAPEv2 API 整合 (API Integration)

Scanner Hub 將透過 REST API 與 CAPEv2 溝通，無需直接操作資料庫。

### 標準工作流程 (Workflow)
1.  **提交 (Submit)**: Hub 上傳檔案給 CAPEv2。
2.  **等待 (Wait)**: CAPEv2 排程並在 VM 中執行檔案 (約 2-5 分鐘)。
3.  **查詢 (Poll)**: Hub 定時檢查任務狀態。
4.  **取回 (Retrieve)**: 任務完成後，下載 JSON 報告並解析 `malscore`。

### 關鍵 API Endpoints
*   **Base URL**: `http://<cape-ip>:8000/apiv2`

| 動作 | Method | Endpoint | 說明 |
| :--- | :--- | :--- | :--- |
| **提交檔案** | `POST` | `/tasks/create/file/` | Form-data: `file=@sample.exe`, `machine=win10` |
| **查詢狀態** | `GET` | `/tasks/view/{task_id}/` | 檢查 status 是否為 `reported` |
| **取得報告** | `GET` | `/tasks/get/report/{task_id}/` | 回傳完整分析報告 (JSON) |

