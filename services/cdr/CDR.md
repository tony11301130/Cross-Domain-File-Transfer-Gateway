# CDR Service Assessment & Requirements

## 1. Skill Selection Strategy (Skill 選擇建議)
依據 `skills_inventory.md`，針對 CDR 服務開發與整合，建議使用以下 Skills：

*   **`scanning-tools`**:
    *   **原因**: 雖然 CDR 是「清洗」而非單純「掃描」，但此 Skill 包含處理惡意軟體、檔案分析與漏洞檢測的相關知識，與 CDR 的領域最為接近。
    *   **應用**: 用於定義檔案類型檢測標準、理解攻擊向量 (如 Polyglot files) 以及整合掃描引擎 (如 ClamAV) 的前處理。
*   **`senior-architect`**:
    *   **原因**: CDR 服務需要高吞吐量、低延遲以及高可用性。
    *   **應用**: 用於設計微服務架構，包含 Message Queue (RabbitMQ/Redis) 的整合、流量削峰 (Throttling)、水平擴展 (Horizontal Scaling) 以及容錯機制 (Circuit Breakers)。

---

## 2. Current Implementation Status (目前實作狀態)
經檢視 `services/cdr` 目錄下的程式碼 (`main.py`, `sanitizers.py`, `engine.py`)，目前實作狀態如下：

*   **架構**: 基於 FastAPI 的簡單 HTTP 服務。單一同步處理流程 (Upload -> Identify -> Sanitize -> Return)。
*   **檔案識別**: 使用 `python-magic` 進行 MIME Type 檢測。
*   **清洗引擎**:
    *   **PDF**: 使用 `pdfrw` 移除 `/JS`, `/AA`, `/OpenAction` 等關鍵字。
    *   **Office**: 使用 `python-docx`, `openpyxl`, `python-pptx` 進行讀取後另存 (Repackaging) 以移除巨集。
    *   **Images**: 使用 `Pillow` 轉檔 (To BMP -> To Original) 以重寫圖片結構。

---

## 3. Missing Requirements & Gaps (功能缺口與需求)
為了達到生產環境等級的安全性與效能，目前 CDR 服務尚缺欠以下關鍵功能：

### 3.1 壓縮檔與容器支援 (Archive & Container Support)
*   **現況**: 無支援。若上傳 `.zip` 檔，將無法識別或僅被視為二進位檔。
*   **需求**:
    *   **Recursive Decompression**: 需支援遞迴解壓縮 (如 Zip inside Zip)。
    *   **Bomb Protection**: 需防禦 Zip Bomb (壓縮比過高或解壓後過大)。
    *   **Structure Sanitization**: 需在解壓後對內容物逐一清洗，再重新打包。

### 3.2 深度 PDF 清洗 (Deep PDF Sanitization)
*   **現況**: 僅移除字典中的特定 Key (`/JS`, `/AA`)，黑名單機制容易被繞過。
*   **需求**:
    *   **Content Regeneration**: 不應只修改原有結構，應解析內容 (Text, Fonts, Images) 後重新產生全新的 PDF 檔案。
    *   **Flattening (Optional)**: 對於高風險檔案，可考慮將 PDF 每一頁轉為高解析度圖片，再封裝回 PDF (犧牲文字選取功能以換取最高安全性)。

### 3.3 進階 Office 清洗 (Deep Office Sanitization)
*   **現況**: 依賴 Library 的 `save()` 方法重寫 XML。雖然能移除 VBA part，但對於 OLE Objects 或 DDE (Dynamic Data Exchange) 攻擊可能防禦不足。
*   **需求**:
    *   **Active Content Removal**: 需明確檢查並移除 OLE Objects, ActiveX controls, DDE Links。
    *   **XML Validation**: 驗證解壓後的 OOXML 結構是否符合標準。

### 3.4 圖片深層清洗 (Deep Image Sanitization)
*   **現況**: BMP 轉換法有效，但可能遺漏 Metadata。
*   **需求**:
    *   **Metadata Stripping**: 需確保移除 Exif, IPTC, XMP 等隱藏 Metadata (可能包含個資或攻擊 Payload)。
    *   **Steganography Check**: (進階需求) 檢測圖片是否隱藏其他檔案或資訊。

### 3.5 可觀察性 (Observability)
*   **現況**: 僅有 `print()` 除錯訊息。
*   **需求**:
    *   **Structured Logging**: 記錄每個檔案的處理時間、偵測到的類型、清洗掉的物件數量、失敗原因。
    *   **Metrics**: 整合 Prometheus，監控 `files_processed_total`, `processing_duration_seconds`, `sanitization_failure_rate`。

### 3.6 擴展性與非同步處理 (Scalability & Async)
*   **現況**: HTTP 同步呼叫。大檔處理會阻塞連線，且無流量控制。
*   **需求**:
    *   **Async Processing**: 整合 Message Queue (如 RabbitMQ)。上傳後回傳 `task_id`，由 Worker 非同步處理。
    *   **Stream Processing**: 對於超大檔案，需支援串流處理以減少記憶體消耗。






CDR 服務實作計畫
目標描述
將現有的 CDR 服務從簡單的同步 HTTP 伺服器升級為生產級、可擴展且安全的微服務。此次升級將解決關鍵缺口：非同步處理、可觀察性、壓縮檔支援以及深度內容清洗。

需要使用者審查
IMPORTANT

架構變更: 從同步 HTTP 模式轉移到非同步任務模式 (提交 -> 取得 JobID -> 輪詢/Webhook)。這對於目前的 API 客戶端來說是破壞性更新 (Breaking Change)。

預計變更
第一階段：架構與基礎建設
[NEW] services/cdr/queue_manager.py
實作 Redis/RabbitMQ 連線邏輯。
定義任務生產者 (Producer) 與消費者 (Consumer) 模式。
[MODIFY] services/cdr/main.py
修改上傳端點：將任務推送到佇列並回傳 Job ID。
新增狀態輪詢端點。
整合結構化日誌中介軟體 (Middleware)。
[NEW] services/cdr/worker.py
背景 Worker，用於從佇列消費任務。
協調清洗流程 (Orchestrate sanitization flow)。
[NEW] services/cdr/metrics.py
定義並匯出 Prometheus 指標。
第二階段：壓縮檔與容器支援
[MODIFY] services/cdr/engine.py
新增對壓縮檔類型 (zip, tar 等) 的偵測與支援。
實作遞迴處理邏輯。
[NEW] services/cdr/utils/archive.py
安全解壓縮邏輯 (偵測 Zip bomb)。
重新打包 (Re-packaging) 邏輯。
第三階段：深度清洗引擎
[MODIFY] services/cdr/sanitizers.py
PDF: 整合用於內容流重建的函式庫 (如 pikepdf 或增強 pdfrw 邏輯)。
Office: 使用 python-docx/openpyxl 新增明確的 OLE/ActiveX 移除檢查。
Image: 為所有支援的圖片格式新增通用的 metadata 移除功能。
驗證計畫
自動化測試
單元測試: 使用已知的惡意樣本測試個別清洗器。
整合測試:
提交檔案 -> 驗證回傳 Job ID。
輪詢狀態 -> 驗證 'processing' -> 'completed'。
驗證輸出檔案是否存在且已清洗。
壓縮檔測試: 測試巢狀 zip 和 zip bombs。
手動驗證
部署到本地 Docker 環境。
使用 curl 或 Postman 測試新的非同步 API 流程。
檢查 Prometheus 指標端點。