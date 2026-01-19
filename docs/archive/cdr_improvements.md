# CDR 服務發展與現狀報告 (CDR Service Development Status Report)

## 1. 執行摘要 (Executive Summary)

目前的 CDR 服務已完成核心架構的升級與關鍵功能的實作 (Phase 1 & Phase 2)。我們成功轉型為具備 **「策略驅動 (Policy-driven)」** 與 **「深度清洗 (Deep Sanitization)」** 能力的現代化資安模組。

系統現在不僅支援高頻格式 (Office, PDF, Email, Archive) 的手術式清洗，更引入了 **「安全轉換管線 (Safe Conversion Pipeline)」** 作為高風險檔案的終極防線，大幅縮小了與市場頂級競品 (如 OPSWAT, Glasswall, Dangerzone) 的技術差距。

## 2. 功能現狀與競品比較 (Current Status vs Market Standards)

下表展示了經過 Phase 1 與 Phase 2 改進後的系統現狀：

| 評估維度 | 細項指標 | 市場標準 (Commercial/Mature OSS) | 目前實作 (Current Status) | 狀態 |
| :--- | :--- | :--- | :--- | :--- |
| **核心能力** | **支援格式數量** | 100+ | **覆蓋主流格式** (Office, PDF, Email, HTML/SVG, Archive, Images) | 🟢 良好 |
| | **清洗深度** | 遞迴清洗、像素重構 | **已實作** (Surgical + Pixel Reconstruction Fallback) | 🟢 良好 |
| | **備援機制** | 自動降級轉換 | **已實作** (Fallback Sanitizer 整合 LibreOffice/Ghostscript) | 🟢 良好 |
| **管理與策略** | **策略引擎** | 依租戶/群組設定 | **已實作** (支援 Policy 物件傳入，可控管 Macros/Fallback) | 🟢 良好 |
| | **原始檔保留** | 隔離區 (Quarantine) | 尚未實作 (僅暫存處理) | 🟡 待加強 |
| **可觀測性** | **鑑識報告** | 詳細動作報告 | **已實作** (結構化 JSON 報告，包含 Action, Component, Details) | 🟢 良好 |
| **部署與整合** | **郵件整合** | MTA 深度整合 | 尚未實作 (僅支援 .eml 檔案處理 API) | 🔴 缺口 |

## 3. 已解決的關鍵缺口 (Addressed Gaps)

### 3.1 關鍵檔案類型擴充 (Format Expansion)
*   **HTML / SVG**: 已整合 `bleach`，能有效移除 XSS 攻擊向量 (Scripts, Event Handlers)。
*   **Email**: 實作了遞迴 MIME 解析器，能正確處理內文與嵌套附件。
*   **Archives**: 支援 ZIP/TAR 遞迴解壓與清洗，包含 Zip Bomb 防護。

### 3.2 策略引擎與報告 (Policy & Reporting)
*   **策略彈性**: 系統不再 Hardcoded。透過 `SanitizationPolicy`，可針對不同場景設定 (例如：是否允許巨集、是否強制轉檔、是否移除 Metadata)。
*   **透明度**: 每個清洗請求皆回傳 `SanitizationReport`，清楚記錄了 "Removed 1 Macro" 或 "Converted to PDF" 等操作細節。

### 3.3 深度清洗與重建 (Deep Sanitization)
*   **Pixel Reconstruction**: 針對高風險或無法解析的檔案，實作了 `SafeConverter`。
    *   **流程**: Document -> PDF -> Images (Rasterization) -> Safe PDF。
    *   **效益**: 徹底消除邏輯層攻擊 (Logic-based exploits)，達到 Air-gap 等級的安全性。

## 4. 後續路線圖 (Roadmap & Next Steps)

目前開發重點將轉向 **Phase 3: 企業級功能與運維優化**。

### Phase 1: 廣度擴充 (Format Expansion) [COMPLETED]
*   [x] HTML/SVG 清洗 (XSS防護)
*   [x] Email (EML/MSG) 遞迴解析
*   [x] Archive (Zip/Tar) 遞迴處理
*   [x] Office Zip Bomb 防護

### Phase 2: 策略與核心強化 (Policy & Engine Core) [COMPLETED]
*   [x] 策略引擎 (SanitizationPolicy)
*   [x] 結構化報告 (SanitizationReport)
*   [x] 備援機制 (FallbackSanitizer / Dangerzone-like Pipeline)
*   [x] 統一 ActionEnum 與日誌標準

### Phase 3: 企業級功能 (Enterprise Features) [PLANNED]
*   **目標**: 提升系統的維運能力、整合性與效能。
*   **行動**:
    *   [ ] **原始檔隔離 (Quarantine)**: 整合 MinIO/S3，將清洗前的高風險檔案加密封存，供資安人員後續鑑識。
    *   [ ] **MTA 整合 (MTA Integration)**: 開發 Postfix/Exchange 介面，支援即時郵件流清洗。
    *   [ ] **串流優化 (Streaming)**: 優化大檔案 (100MB+) 處理，改用 Stream I/O 減少記憶體佔用。
    *   [ ] **Cover Page 生成**: 當檔案被清洗或阻擋時，插入由系統生成的說明頁面 (PDF/Image)。