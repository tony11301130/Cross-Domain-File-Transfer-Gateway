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

## 2. Project Structure
To keep the root clean, files are organized as follows:
*   **`app/`**: Core services (API, Worker, Sanitizers).
*   **`docs/`**: Documentation (e.g., `ROADMAP.md`).
*   **`scripts/`**: Utility scripts for verification and tools (`verify_redis_flow.py`, `check_zip_structure.py`).
*   **`tests/`**: Unit tests (`pytest services/cdr/tests`).

---

## 3. Current Implementation Status (目前實作狀態)
經檢視 `services/cdr` 目錄下的程式碼 (`main.py`, `engine.py`, `sanitizers/`)，目前實作狀態如下 (已完成 DocBleach 功能移植)：

*   **架構**: 非同步 Worker 模式 (FastAPI + Redis/Queue)。支援水平擴展。
*   **檔案識別**: 使用 `python-magic` 進行 MIME Type 檢測。
*   **目前支援與清洗策略**:
    *   **PDF**: 使用 `pikepdf` 重建結構，移除 `/JS`, `/AA`, `/OpenAction` 以及 Annotation 中的 Script/Launch 行為。
    *   **Office (Surgical)**: 實作了類似 DocBleach 的手術式清洗。解壓 OOXML (Zip)，遞迴掃描所有 XML 與 Relations，移除 `<oleObject>`, `<activeX>`, `<script>`, `vbaProject.bin` 等危險內容，而非僅依賴重存。
    *   **Images**: 使用 `Pillow` 轉檔 (To BMP -> To Original) 以重寫圖片結構並移除 Metadata (Exif/IPTC)。
    *   **Archive (Zip/Tar)**: 支援遞迴解壓縮與清洗。包含 Zip Bomb 防護 (Ratio/Size/FileCount 檢查)。
    *   **RTF**: 支援 RTF 格式，透過解析並移除 `{\object ...}`, `\objdata` 等嵌入物件群組。

---

## 4. 已解決的 Missing Requirements (Resolved Gaps)
以下項目已在近期更新中實作：

### 3.1 壓縮檔支援 (Completed)
*   **ArchiveSanitizer**: 已實作。支援遞迴清洗與 Zip Bomb 防護。

### 3.2 深度 PDF 清洗 (Completed)
*   **PDFSanitizer**: 已從 `pdfrw` 遷移至 `pikepdf` (基於 QPDF)，支援更底層的結構操作與物件刪除。

### 3.3 手術式 Office 清洗 (Completed - DocBleach Port)
*   **SurgicalOfficeSanitizer**: 已移植 DocBleach 的核心概念。直接操作 XML 結構移除威脅，比單純 Repackaging 更精確且安全。

### 3.4 RTF 支援 (Completed - DocBleach Port)
*   **RtfSanitizer**: 新增對 RTF 的基本清洗支援，移除 OLE 物件。

### 3.5 可觀察性 (Completed)
*   **Metrics**: 已整合 Prometheus (`metrics.py`) 與結構化日誌。

### 3.6 擴展性 (Completed)
*   **Queue**: 已實作 Producer-Consumer 模式 (`queue_manager.py`, `worker.py`)。

---

## 5. 剩餘計畫與建議 (Remaining Roadmap)
雖然核心功能已移植，仍可持續優化：

1.  **驗證與測試**: 需針對大量惡意樣本 (Malware Zoo) 進行自動化迴歸測試，確保 Surgical Cleaning 不會破壞正常文件格式。
2.  **策略配置 (Policy Engine)**: 目前清洗策略是寫死的 (Hardcoded)。建議實作設定檔 (YAML)，讓使用者選擇是否要「保留巨集」或「保留 OLE」。
3.  **更多格式**: 考慮移植 DocBleach 的其他冷門格式支援，或整合 ODF (OpenDocument) 支援。