# CDR 模組演示 (Demo)

本資料夾包含 **檔案無害化與重建 (Content Disarm and Reconstruction, CDR)** 模組的獨立演示。

## 1. 前置需求 (Prerequisites)
確保您已安裝所需的 Python 相依套件：

```powershell
pip install -r services/cdr/requirements.txt
```

在 Windows 環境下，您還需要安裝 `libmagic`：
```powershell
pip install python-magic-bin
```

## 2. 執行演示 (Running the Demo)

執行 `demo.py` 腳本。此腳本將自動執行以下步驟 (請先執行 `generate_samples.py` 或確認 `samples/` 目錄下有測試檔案)：
1.  **清洗 (Sanitize)**：呼叫 CDR 引擎 (`services/cdr`) 處理 `samples/` 目錄中的每個檔案。
2.  **驗證 (Verify)**：分析輸出結果，確認威脅 (含 EICAR 病毒特徵) 已被移除。
3.  **報告 (Report)**：在終端機顯示彩色的狀態報告。

```powershell
python CDR_demo/demo.py
```

## 3. 演示內容說明

| 檔案類型 | 模擬威脅 | 清洗動作 |
|-----------|------------------|---------------------|
| **PDF** | 嵌入式 JavaScript (`/JS`)、自動執行動作 (`OpenAction`) | **深度重建 (Deep Reconstruction)**：移除 JS 字典，並使用 `pikepdf` 重建檔案結構。 |
| **DOCX** | VBA 巨集 (`vbaProject.bin`)、OLE 物件 | **手術式清洗 (Surgical Cleaning)**：刪除 `vbaProject.bin`，並從 XML 中移除 `<oleObject>` 標籤。 |
| **Image** | 隱藏 Metadata (模擬) | **重新編碼 (Re-encoding)**：將圖片像素複製到新畫布，剝離所有 Metadata (如 EXIF)。 |
| **Archive** | 巢狀惡意 Zip (Zip Bomb/惡意軟體) | **遞迴處理 (Recursive Processing)**：解壓縮檔案，清洗內部檔案後，重新打包。 |

## 4. 輸出結果
清洗後的檔案將儲存於 `clean/` 目錄。您可以手動檢查這些檔案以驗證：
*   **通過**：檔案可正常開啟，且內容 (文字/圖片) 清晰可見。
*   **通過**：巨集警告或是惡意腳本已消失。
