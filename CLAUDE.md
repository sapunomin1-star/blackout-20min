# blackout-20min — 入口卡

雙人合作推理網頁遊戲《停電的二十分鐘》。兩個人各用自己的手機：一人當現場調查員，只看得到物品；一人當偵訊官，只看得到口供。兩人靠說話交換線索，最後一起提出指控。純靜態 HTML＋CSS＋原生 JS，用 GitHub Pages 發布。

規格是使用者 2026-09-25 給的。2026-10-07 建 repo，實作交給雲端 Claude Code。

## 紅線（使用者規格 2026-09-25）
- **案件內容逐字照 `docs/SPEC.md`**：線索、口供、物品描述都不增、不刪、不改，中性物品也照原文。發現邏輯矛盾就寫進 README 的劇透折疊區，不要自己改。
- **角色隔離**：
  - `scene.html` 和它載入的所有檔案，不得出現任何口供文字，包括口供、追問、回答、觀察反應。
  - `interrogation.html` 和它載入的檔案，不得出現任何現場物品描述。
  - 共用的 CSS／JS 不放案件內容。
- **不得有明文答案**：所有會被 Pages 發布的檔案，都不能出現兇手、正確證據、正確破綻、判定訊息原文、真相解說原文。也不能從程式結構看出答案，例如只有三位嫌疑人寫了「選錯」訊息，就等於指出第四位是兇手。答案用 SHA-256（Web Crypto API）比對；判定訊息與真相用 AES-GCM 加密，金鑰由玩家選的選項推導。
- **機密原文不進 git**：
  - 原文只放在 gitignored 的 `tools/secrets.local.json`。使用者開工時把原文貼給 session；雲端 session 結束後這個檔就沒了。
  - 測試、文件、README、log、commit message、PR 說明都不得出現原文。
  - 測試不能寫死正解，要用窮舉找出來。
  - README 劇透區用自己的話描述邏輯問題，不貼判定訊息與真相原文。
- **純靜態**：
  - 不用框架；部署不需要 build。`tools/`、`package.json` 只用來產生機密檔與驗證。
  - 不載入外部圖片，插圖用 CSS、inline SVG 或 emoji。
  - 字體可以用 Google Fonts，但要有系統字體 fallback。
- **手機直式優先**：按鈕大、字體清楚、不能水平捲動；桌機也要正常。介面全部繁體中文。
- **視覺**：維多利亞時代偵探檔案感，深色背景、紙張質感卡片、打字機或襯線字體。
- **規格裡的括號是設計註記**：「（中性物品）」「（排除外人入侵）」不顯示在遊戲裡；「點選『翻開泥土』後才顯示」是互動說明。
- **公開與否由使用者決定**：不要自行把 repo 改成 public，也不要自行開 Pages。免費方案的 Pages 需要 public repo。

## 驗證
兩個指令都已建立（2026-10-07）。還沒有 `js/secrets.js` 時，check 會提醒並略過真資料的窮舉與明文掃描，e2e 改用隨機假判定資料測流程。

```bash
npm run check   # 只用 node：內容隔離、明文答案掃描、判定窮舉、外部資源掃描
npm run e2e     # playwright-core 真點擊：手機直式跑四頁與五種指控結果、檢查無水平捲動；截圖在 output/e2e/（gitignored）
npm run build:secrets   # tools/secrets.local.json → js/secrets.js，並窮舉驗證
```

- e2e 只能用真的點擊與鍵盤操作；可以讀頁面狀態，但不能用 JS 代替玩家操作。

## 雲端 session（claude.ai/code）
- **Repo**：https://github.com/sapunomin1-star/blackout-20min（私人；預設分支 main）。
- **語言與規則**：回覆一律用繁體中文。使用者本機的全域規則（`~/.claude`、`~/agent-harness`）在雲端讀不到，這份入口卡加上 `docs/PLAN.md` 就是全部規則。
- **開工**：使用者會把桌面檔 `停電的二十分鐘_雲端開工.md` 的內容貼進 session，裡面含機密段。如果沒貼機密段，只做不涉及判定的部分（樣式、index、scene、interrogation、accuse 的表單），判定與真相等使用者貼了再做。
- **e2e 瀏覽器**：
  - 雲端容器已預裝 Chromium。使用者另一個專案的做法是 `E2E_EXECUTABLE=/opt/pw-browsers/chromium`，傳給 playwright-core 的 `executablePath`。
  - 不要 `playwright install`，版本可能對不上。沒有預裝時才用 `npx playwright-core install chromium`。
- **交付**：在分支 commit、push、開 PR，由使用者合併到 main。
- **路徑**：文件裡的 `/Users/guichenxiang/…` 是使用者的本機路徑，雲端不存在。

## 細節去哪讀
- `docs/SPEC.md`：使用者規格，公開部分逐字收錄。
- `docs/PLAN.md`：階段、驗證、實作約定、風險、已拍板的決定。另含決策紀錄：機密段為什麼不進 repo。
- `README.md`：遊玩方式與 Pages 部署；階段 7 才補完整。
