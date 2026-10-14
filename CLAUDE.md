# blackout-20min — 入口卡

雙人合作推理網頁遊戲《懷錶檔案》：
- **序章《停電的二十分鐘》**：照使用者規格做的，放在 `prologue/`。
- **三個新章節**：`ch1/`–`ch3/`，終章串起前面的線索。

兩個人各用自己的手機：一人當現場調查員，只看得到物品；一人當偵訊官，只看得到口供。兩人靠說話交換線索，最後一起提出指控。首頁是章節選單，破案後拿到下一章的通行碼。純靜態 HTML＋CSS＋原生 JS，用 GitHub Pages 發布。

時間線：
- 2026-09-25：使用者給規格。
- 2026-10-07：建 repo，實作交給雲端 Claude Code。
- 2026-10-14：使用者嫌序章太簡單，要求加三個更難的章節。

## 紅線（使用者規格 2026-09-25；新章節 2026-10-14 起同樣適用）
- **序章內容逐字照 `docs/SPEC.md`**：線索、口供、物品描述都不增、不刪、不改，中性物品也照原文。發現邏輯矛盾就寫進 README 的劇透折疊區，不要自己改。
- **角色隔離**：
  - 每一章的 `scene.html` 和它載入的所有檔案，不得出現任何口供文字，包括口供、追問、回答、觀察反應、改口。
  - `interrogation.html` 和它載入的檔案，不得出現任何現場物品描述。
  - 共用的 CSS／JS 不放案件內容，也不能提到任何章節人物。
  - 新章節的內容都在加密的 `*.data.js` 裡，check 會解密後再檢查一次。
- **不得有明文答案**：
  - 所有會被 Pages 發布的檔案，都不能出現兇手、正確證據、正確破綻、判定訊息原文、真相解說原文。
  - 也不能從程式結構看出答案，例如只有三位嫌疑人寫了「選錯」訊息，就等於指出第四位是兇手。
  - 答案用 SHA-256（Web Crypto API）比對；判定訊息與真相用 AES-GCM 加密，金鑰由玩家選的選項推導。
- **機密原文不進 git**：
  - 序章的機密原文只放在 gitignored 的 `tools/secrets.local.json`。使用者開工時把原文貼給 session；雲端 session 結束後這個檔就沒了。
  - 新章節的原始內容只放在 gitignored 的 `tools/chapters.local/`。repo 裡只有加密的 `tools/chapters.sealed.json`，通關密語在使用者手上。
  - 測試、文件、README、log、commit message、PR 說明都不得出現原文。
  - 測試不能寫死正解，要用窮舉找出來。
  - README 劇透區用自己的話描述邏輯問題，不貼判定訊息與真相原文。
- **不劇透新章節**：使用者自己也要玩新章節。跟使用者對話、commit、PR、文件裡，都不能透露新章節的劇情、線索、密碼或答案。可以說的只有選單上公開的標題與一句話簡介，以及測試數字。
- **純靜態**：
  - 不用框架；部署不需要 build。`tools/`、`package.json` 只用來產生加密資料與驗證。
  - 不載入外部圖片，插圖用 CSS、inline SVG 或 emoji。
  - 字體可以用 Google Fonts，但要有系統字體 fallback。
- **手機直式優先**：按鈕大、字體清楚、不能水平捲動；桌機也要正常。介面全部繁體中文。
- **視覺**：維多利亞時代偵探檔案感，深色背景、紙張質感卡片、打字機或襯線字體。
- **規格裡的括號是設計註記**：「（中性物品）」「（排除外人入侵）」不顯示在遊戲裡；「點選『翻開泥土』後才顯示」是互動說明。
- **公開與否由使用者決定**：不要自行把 repo 改成 public，也不要自行開 Pages。免費方案的 Pages 需要 public repo。

## 驗證
沒有機密檔時，check 會提醒並略過真資料的檢查：
- 沒有 `prologue/secrets.js` 或 `tools/chapters.local/`：略過真資料的比對與明文掃描。
- e2e 改用隨機假判定資料測序章流程。

```bash
npm run check            # 只用 node：內容隔離、明文答案掃描、判定窮舉、新章節一路破關、外部資源、封存檔
npm run e2e              # playwright-core 真點擊：序章四頁＋兩支手機從序章破到終章、檢查無水平捲動；截圖在 output/e2e/（gitignored）
npm run build:secrets    # tools/secrets.local.json → prologue/secrets.js，並窮舉驗證（需要 tools/chapters.local/ 才知道第一章通行碼）
npm run build:chapters   # tools/chapters.local/*.json → ch*/ 與 chapters.js，並窮舉驗證
npm run chapters:seal    # 用 CHAPTERS_PASSPHRASE 封存新章節原始內容
npm run chapters:unseal  # 用 CHAPTERS_PASSPHRASE 還原 tools/chapters.local/
```

- e2e 只能用真的點擊與鍵盤操作；可以讀頁面狀態，但不能用 JS 代替玩家操作。
- 改了新章節內容：build:chapters → chapters:seal → check（帶 CHAPTERS_PASSPHRASE 會比對封存內容）→ e2e。

## 雲端 session（claude.ai/code）
- **Repo**：https://github.com/sapunomin1-star/blackout-20min（私人；預設分支 main）。
- **語言與規則**：回覆一律用繁體中文。使用者本機的全域規則（`~/.claude`、`~/agent-harness`）在雲端讀不到，這份入口卡加上 `docs/PLAN.md` 就是全部規則。
- **開工**：
  - 序章：使用者會把桌面檔 `停電的二十分鐘_雲端開工.md` 的內容貼進 session，裡面含機密段。如果沒貼機密段，就不碰序章的判定與真相。
  - 新章節：先請使用者給通關密語，再跑 `CHAPTERS_PASSPHRASE=… npm run chapters:unseal`。沒有通關密語就不能改新章節的內容；樣式和引擎還是可以改。
- **e2e 瀏覽器**：
  - 雲端容器已預裝 Chromium。使用者另一個專案的做法是 `E2E_EXECUTABLE=/opt/pw-browsers/chromium`，傳給 playwright-core 的 `executablePath`。
  - 不要 `playwright install`，版本可能對不上。沒有預裝時才用 `npx playwright-core install chromium`。
- **交付**：在分支 commit、push、開 PR，由使用者合併到 main。
- **路徑**：文件裡的 `/Users/guichenxiang/…` 是使用者的本機路徑，雲端不存在。

## 細節去哪讀
- `docs/SPEC.md`：使用者規格（序章），公開部分逐字收錄。
- `docs/PLAN.md`：階段、驗證、實作約定、風險、已拍板的決定。另含兩份決策紀錄：機密段為什麼不進 repo、新章節怎麼加密與封存。
- `README.md`：遊玩方式、章節、Pages 部署、檔案結構、封存備份、序章的規格解讀與邏輯問題（劇透折疊）。
