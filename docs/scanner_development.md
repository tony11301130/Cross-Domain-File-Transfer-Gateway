# CDR 開發步驟 (CDR Service Development Steps)

本文件列出了 CDR (檔案無害化與重建) 服務的具體開發步驟與檢查點。

## 1. 基礎建設 (Infrastructure Setup)

- [x] **建立目錄結構**
    - 建立 `services/cdr` 目錄。
    - 建立 `services/cdr/app` 目錄。
- [x] **建立 Dockerfile** (`services/cdr/Dockerfile`)
    - Base Image: `python:3.11-slim`
    - 安裝系統依賴 (如 `libmagic1`)。
    - 安裝 Python 依賴 (`fastapi`, `uvicorn`, `python-magic`, `pdf-redactor`, `openpyxl`, `python-docx`, `Pillow`).

## 2. 核心服務實作 (Core Service Implementation)

- [x] **實作 FastAPI 骨架** (`services/cdr/app/main.py`)
    - 定義 `app` 物件。
    - 實作 `GET /health` 端點。
    - 實作 `POST /sanitize` 端點 (接收檔案 upload)。
- [x] **實作引擎基礎** (`services/cdr/app/engine.py`)
    - 定義 `BaseSanitizer` 抽象類別。
    - 實作 `get_sanitizer(mime_type)` 工廠函數。

## 3. 清洗引擎實作 (Sanitization Engines)

- [x] **PDF 清洗器** (`PDFSanitizer`)
    - 使用 `pikepdf` 或 `pdf-redactor`。
    -移除 Javascript, Actions, Embedded Files。
    - 扁平化表單 (Flatten forms)。
- [x] **Office 清洗器** (`OfficeSanitizer`)
    - 針對 `docx`, `xlsx`, `pptx`。
    - 使用 `python-docx`/`openpyxl` 讀取內容。
    - 重建成新的 XML 結構，確保不包含 `vbaProject.bin` (巨集)。
- [x] **圖片清洗器** (`ImageSanitizer`)
    - 針對 `jpg`, `png` 等。
    - 使用 `Pillow` 讀取圖片。
    - 轉換格式 (如 PNG -> BMP -> PNG) 以去除 Exif 與隱藏資料。

## 4. 系統整合 (System Integration)

- [ ] **整合 Scanner Hub**
    - 修改 Hub 的路由邏輯：當收到 Office/PDF 時轉送至 CDR Service。
    - 處理 CDR 回傳結果：
        - 成功 -> 儲存至 Clean Storage。
        - 失敗/錯誤 -> 轉送至 Sandbox。

## 5. 驗證 (Verification)

- [x] **建置測試**
    - `docker build -t cdr-service services/cdr` 成功無錯誤。
- [x] **功能測試**
    - 上傳含 Macro 的 Docx，確認回傳檔案無 Macro。
    - 上傳含 JS 的 PDF，確認回傳檔案無 JS。

## 6. 進階功能增強 (Advanced Features Enhancement)

- [ ] **PPTX 支援** (PPTX Support)
    - 依賴：`python-pptx`。
    - 功能：實作 `OfficeSanitizer` 的 PPTX 分支，移除巨集與潛在威脅。
    - 驗證：建置 Image，上傳 PPTX 檔案並確認成功清洗回傳。
- [ ] **進階 PDF 清洗** (Advanced PDF Sanitization)
    - 功能：深度遍歷 PDF 物件樹，移除深層嵌入的 Action 與 JS。
    - 功能：(選用) 考慮光柵化 (Rasterization) 策略。
- [ ] **清洗報告** (Sanitization Report)
    - 功能：API 回應中包含清洗細節 (如 `X-Sanitization-Log` header 或 JSON body)。
    - 內容：紀錄移除了什麼 (Macro, JS, Metadata)。
