# 檔案傳輸入口站 - MVP Demo 開發計畫

本計畫旨在快速建構一個可展示 (Demo-ready) 的檔案傳輸系統原型。
**核心目標**：展示「登入 -> 上傳 -> 檢查 -> 審核 -> 投遞」的完整流程。

---

## 階段一：專案基底搭建 (Project Bootstrap)
*目標：建立前後端基礎架構，包含資料庫與身份驗證環境。*

1.  **Frontend (Next.js)**
    *   初始化 Next.js 專案 (TypeScript, TailwindCSS)。
    *   建立基礎 Layout 與設計系統 (Dark Mode 資安風格)。

2.  **Backend & Database**
    *   **Database**: SQLite。使用 Prisma ORM 進行管理，方便快速建模。
    *   **Models**: `User` (Role: User/Admin), `FileRecord` (Status tracking).
    *   設定本地檔案儲存目錄：
        *   `./storage/ingress` (接收區)
        *   `./storage/quarantine` (隔離區)
        *   `./storage/egress` (藍端模擬區)

3.  **Authentication (NextAuth.js)**
    *   實作 Credentials Provider (帳號密碼登入)。
    *   **Roles**:
        *   `User`: 僅能上傳、查看自己檔案。
        *   `Admin`: 僅能審核、查看所有檔案。
    *   **Seed**: 預設建立測試帳號 (admin/admin, user/user)。

4.  **Containerization (Docker Architecture)**
    *   **Dual-Container Setup**:
        *   `web`: Next.js 前端與 API (Port 3000)。
        *   `worker`: 背景獨立執行緒，負責掃描與檔案搬運。
    *   **Shared Volumes**:
        *   `db-data`: SQLite 資料庫檔案。
        *   `ingestion-storage`: 檔案落地與交換區。
    *   **Networking**: 兩者透過 docker-compose network 互通。

---

## 階段二：檔案接收功能 (Ingestion & Auth)
*目標：使用者登入後，將檔案傳送至系統。*

1.  **Login UI**
    *   簡單明瞭的登入頁面 (資安儀表板風格)。
2.  **Web Upload UI (Standard)**
    *   **Access**: 僅限 `User` 角色。
    *   使用標準 `<input type="file">` 或簡易 Drag & Drop 區域 (非分塊，MVP優先)。
    *   上傳成功後顯示於「我的上傳列表」。
3.  **Upload API**
    *   驗證 Session。
    *   接收 Multipart/form-data。
    *   寫入 `./storage/ingress`。
    *   寫入 DB: Status = `RECEIVED`。

---

## 階段三：處理與審核流程 (Processing & Approval Logic)
*目標：實作狀態機，包含掃描模擬與人工審核。*

1.  **Worker Service (Background Processing)**
    *   獨立的 Node.js Script (跑在 `worker` container)。
    *   **Polling Loop**: 每 2 秒查詢 DB 中 `SCANNING` 狀態的檔案。
    *   **模擬掃描**:
        *   鎖定檔案 (State `SCANNING_IN_PROGRESS`)。
        *   延遲 2-5 秒。
        *   隨機或依規則寫入結果 (Pass/Fail)。
        *   更新 DB 狀態 (`PENDING_APPROVAL` or `QUARANTINED`)。

2.  **Admin Approval UI (Web Container)**
    *   **Access**: 僅限 `Admin` 角色。
    *   **待審核清單**：顯示所有狀態為 `PENDING_APPROVAL` 的檔案 (含檔名、上傳者、大小)。
    *   **Actions**: [同意 (Approve)] / [拒絕 (Reject)]。

3.  **Execution (Action)**
    *   **On Approve**: 
        *   狀態轉 `TRANSFERRED`。
        *   檔案從 `ingress` 移動至 `egress` (模擬送往藍端)。
    *   **On Reject**:
        *   狀態轉 `REJECTED`。
        *   檔案移動至 `quarantine`。

---

## 階段四：視覺化儀表板 (Dashboard)
*目標：即時呈現檔案流轉狀態。*

1.  **狀態同步**
    *   前端使用 Polling (每 2 秒) 查詢 DB，更新列表狀態。
    *   Status Badges:
        *   `SCANNING` (黃色 Pulse)
        *   `PENDING_APPROVAL` (藍色)
        *   `TRANSFERRED` (綠色)
        *   `QUARANTINED` / `REJECTED` (紅色)

2.  **Demo 劇本驗證**
    *   使用 User 帳號上傳 -> 看到 `Scanning` -> `Pending Approval`.
    *   登出，切換 Admin 帳號登入 -> 看到待審核項目 -> 點擊 Approve.
    *   看見狀態變 `Transferred`，檔案出現在 Egress Volume。

---

## 建議技術堆疊 (Tech Stack)
*   **Framework**: Next.js 14+ (App Router)
*   **Auth**: NextAuth.js v5
*   **DB/ORM**: SQLite + Prisma
*   **UI**: TailwindCSS, Shadcn/UI (for fast, good-looking components)
