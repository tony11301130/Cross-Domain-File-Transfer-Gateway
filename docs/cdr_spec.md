# CDR 服務功能規格書 (Service Specification)

本文件詳述 CDR (Content Disarm and Reconstruction) 服務目前支援的檔案格式、清洗機制以及對應的安全策略。

## 1. 核心支援：手術式清洗 (Surgical Sanitization)

針對結構化且高頻使用的檔案格式，CDR 採用「手術式」引擎。此機制會深入解析檔案結構 (如 XML Tree, PDF Objects, DOM)，精準移除潛在威脅，同時**最大程度保留檔案的原生互動性與格式**。

| 類別 | 支援格式 | 清洗與防護細節 |
| :--- | :--- | :--- |
| **Office 文檔** | **Word** (`.docx`)<br>**Excel** (`.xlsx`)<br>**PowerPoint** (`.pptx`) | • **巨集防護**: 移除 VBA Macros (`vbaProject.bin`, `vbaData.xml`)。<br>• **物件過濾**: 移除 OLE Objects, ActiveX Controls。<br>• **XML 清洗**: 遞迴掃描 XML 節點，移除惡意 Script 標籤。 |
| **PDF 文件** | **PDF** (`.pdf`) | • **結構淨化**: 使用 `pikepdf` 重建 XREF 表。<br>• **主動內容**: 移除 JavaScript, OpenAction, Launch Actions。<br>• **攻擊阻斷**: 清除 Form Actions 與嵌入式多媒體。 |
| **電子郵件** | **Email** (`.eml`)<br>**Outlook** (`.msg`) | • **遞迴解析**: 完整解析 MIME 結構。<br>• **內文清洗**: 使用 HTML Sanitizer 清洗郵件內文。<br>• **附件處理**: 將附件抽出並獨立送入 CDR 引擎進行遞迴掃描。 |
| **網頁/SVG** | **HTML** (`.html`, `.xhtml`)<br>**SVG** (`.svg`) | • **XSS 防護**: 基於 `bleach` 的白名單過濾。<br>• **標籤移除**: 移除 `<script>`, `<iframe>`, `<object>`。<br>• **屬性清洗**: 移除 `on*` 事件 (如 `onclick`, `onload`) 及 `javascript:` 偽協議。 |
| **圖片** | **Images** (`.jpg`, `.png`, `.gif`, `.bmp`, `.webp`) | • **像素重繪 (Re-encoding)**: 將圖片解碼為原始像素並重新編碼，消除隱寫術與結構損壞。<br>• **隱私保護**: 移除 Exif, GPS, Camera Metadata。 |
| **壓縮檔** | **ZIP** (`.zip`)<br>**TAR** (`.tar`)<br>**7-Zip** (`.7z`) | • **遞迴解壓**: 支援多層壓縮檔解壓。<br>• **Zip Bomb 防護**: 偵測高壓縮比惡意檔案。<br>• **內容清洗**: 解壓後對內部檔案逐一清洗並重新打包。 |
| **純文字** | **Text** (`.txt`)<br>**RTF** (`.rtf`) | • **編碼檢查**: 強制 UTF-8 編碼驗證。<br>• **RTF 淨化**: 移除惡意控制字 (Control Words) 與嵌入物件 (`\object`, `\objdata`)。 |

---

## 2. 進階支援：安全轉換管線 (Fallback / Deep Sanitization)

對於**舊版格式**、**未支援結構化清洗的格式**，或當**安全策略設定為「強制備援 (Force Fallback)」** 時，CDR 會啟動「安全轉換管線」。

此機制將檔案視為「視覺呈現」，透過格式轉換與像素重構，徹底消除邏輯層的攻擊向量。

### 適用格式
*   **Legacy Office**: `.doc`, `.xls`, `.ppt`
*   **OpenDocument**: `.odt`, `.ods`, `.odp`
*   **Other Docs**: WordPerfect, WPS, Rich Text 等 LibreOffice 支援格式。

### 處理流程 (Pipeline)
1.  **Format Conversion**: 使用 `LibreOffice` (Headless) 將輸入檔案轉換為標準 PDF。
2.  **Rasterization (像素化)**: 將 PDF 的每一頁渲染為高解析度圖片 (Images)。此步驟會**丟棄所有非像素數據** (如 JavaScript, Fonts, Macros, Hidden Text)。
3.  **Hygienic Reconstruction**: 將圖片重新組裝為全新的 PDF 文件。

### 優缺點分析
*   **優點**: 安全性極高 (Air-gap 等級)，能防禦未知漏洞 (Zero-day)。
*   **缺點**: 檔案將失去互動性 (如 Excel 公式失效、文字無法選取)，運算資源消耗較大。

---

## 3. 技術堆疊 (Technology Stack)

*   **Core Engine**: Python 3.11, FastAPI
*   **Processing**:
    *   `pikepdf` (QPDF based) - PDF 處理
    *   `bleach` - HTML/SVG 清洗
    *   `Pillow` - 圖片處理
    *   `LibreOffice` - 格式轉換
    *   `Ghostscript` / `Poppler` - PDF 渲染與像素化
*   **Infrastructure**: Redis (Job Queue), Docker (Containerization)
