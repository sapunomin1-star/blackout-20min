# 計畫：停電的二十分鐘（2026-10-07）

## 目標與完成標準
照 `docs/SPEC.md` 做出四頁純靜態推理遊戲，GitHub Pages 可以直接發布。以下全部成立才算完成：
- `npm run check` 綠：內容隔離、明文答案掃描、判定窮舉、外部圖片掃描。
- `npm run e2e` 綠：手機直式（390×844）用真點擊跑完四頁，每件物品、每段口供都逐字核對；指控的五種結果都跑到；每頁沒有水平捲動。桌機寬（1280）抽查。
- README 寫好 Pages 部署步驟與邏輯問題（劇透折疊）。
- 在分支 commit、push、開 PR。

## 非目標
- 不改案件內容、不加線索；中性物品也照原文。
- 不做後端、帳號、兩機同步、計分或排行。
- 不引入框架或打包工具。

## 實作約定
- 只用 classic `<script>`，不用 ES module，因為 `file://` 開啟時 module 會被擋。各頁的案件內容寫在該頁 HTML 或該頁專屬的 JS；共用檔只放樣式與工具函式。
- 判定（建議做法，可以改，但紅線不能破）：
  - 每位嫌疑人一筆資料，用 `SHA-256(鹽|suspect|ID)` 當索引。每筆存一段 AES-GCM 密文，金鑰由同一個 ID 推導；解開後是 `{種類: 兇手或錯誤, 訊息}`。四筆格式一樣，光看原始碼分不出誰是兇手。
  - 選中兇手後，再把「嫌疑人＋證據＋破綻」一起雜湊，和「全對」雜湊清單比對（三種證據都算對，所以清單有三筆）。
  - 真相的金鑰由「嫌疑人＋破綻」推導，三種正確證據都解得開。
  - 鹽、雜湊、密文由 `tools/build-secrets.mjs` 從 `tools/secrets.local.json` 產生，寫到 `js/secrets.js`。
- 選項 ID（嫌疑人、物品、口供句）產生機密檔後就不能改；要改得重產 `js/secrets.js`，而重產需要機密原文。
- 口供破綻下拉選單：依嫌疑人分組，一句一個選項，追問的回答也算口供；觀察反應不算口供。證據下拉選單：依房間分組，只列物品名稱，不列描述。
- `crypto.subtle` 只在安全環境可用（https、localhost）。用區網 IP 的 http 開啟會失效，accuse 頁要偵測到並提示改用 Pages 網址。
- 字體可以用 Google Fonts，但要寫系統字體 fallback；雲端網路可能擋字體，測試不能依賴字體載入。
- Pages 用 Jekyll 建置：`_config.yml` 的 exclude 會擋掉 docs/、tools/、測試等。HTML 不要加 YAML front matter，也不要加 `.nojekyll`（加了會把 docs/ 一起發布）。新增不該發布的資料夾時，記得補進 exclude。
- 可選的體驗細節（不改案件）：已看過的物品或已追問的卡片做標記（localStorage，讀寫包 try/catch）；accuse 頁開表單前加一句「兩人都準備好了嗎？」。

## 階段
0. **開工**：把使用者貼的機密段整理成 `tools/secrets.local.json`，附 `tools/secrets.example.json`（只放佔位字）。
   驗證：`git check-ignore -v tools/secrets.local.json` 有輸出，`git status` 看不到這個檔。
1. **共用樣式＋首頁**：`css/style.css`、`index.html`（標題、前言、兩個角色按鈕、規則、底部指控入口）。
   驗證：手機寬截圖；沒有水平捲動。
2. **scene.html**：可點的房間平面圖（inline SVG）加上房間分頁；點物品看描述；盆栽要按「翻開泥土」才出現埋著的蠟燭。
   驗證：e2e 逐一點開 10 件物品，文字和 SPEC 逐字相同。
3. **interrogation.html**：四張嫌疑人卡；按「追問」顯示問題、回答與斜體的觀察反應。陳先生在規格裡沒有觀察反應，那一欄就不顯示，也不補寫。
   驗證：e2e 逐字核對。
4. **判定核心**：`tools/build-secrets.mjs` 產生 `js/secrets.js`；`js/verdict.js` 負責雜湊比對與解密。
   驗證：node 窮舉 4×10×12 種組合，應該剛好一人走兇手路徑、剛好三組全對而且破綻是同一句、其他三人不論選什麼證據都回自己的訊息。另外把解密結果和 `secrets.local.json` 逐字比對；這支腳本可以進 repo，讀不到檔案時要略過並提示。
5. **accuse.html**：三個欄位、判定訊息、全對時的破案動畫與真相。
   驗證：e2e 用真點擊跑全對（三種證據各一次）、兇手對但證據錯、兇手對但破綻錯、選錯三位嫌疑人。測試不能寫死正解：先用 node 窮舉 verdict 找出全對組合，再用真點擊選它。
6. **全站檢查 `npm run check`**：
   - 內容隔離：從 interrogation.html 取出每段口供文字，scene.html 和它載入的檔案裡都不能出現；反過來也一樣。
   - 明文掃描：用窮舉解密出的所有機密字串（取 6 字以上片段），掃描所有會發布的檔案。
   - `tools/secrets.local.json` 沒被 git 追蹤。
   - 沒有外部圖片。

   驗證：做負向案例。故意在 scene.html 放一句口供、在任一頁放一段真相，確認 check 會紅，再復原。
7. **README＋交付**：Pages 部署步驟（Settings → Pages → Deploy from a branch → main、/(root)；免費方案要 public repo）、怎麼玩、檔案結構、規格解讀（例如設計註記不顯示）、邏輯問題（用 `<details>` 劇透折疊，自己的話描述，不貼機密原文）。然後 commit、push、開 PR。

## 風險與回退
- **機密原文外洩**是最大風險。commit 前跑 `npm run check`，再 `git grep` 抽查幾個機密片段。萬一已經 push，先告訴使用者，不要自己改寫歷史。
- 雲端沒有機密段（使用者沒貼）：只做階段 1–3 和 accuse 的表單，判定等使用者貼。
- 外觀只能靠截圖判斷，所以每頁都要有手機截圖（放 output/），交付時附上。

## 使用者已拍板的決定（紅線）
- 2026-09-25 的規格全文（`docs/SPEC.md` 加上機密段）：不改案件內容，邏輯矛盾寫進 README。
- 2026-10-07：放到 GitHub 私人 repo，由雲端 Claude Code 實作（使用者的電腦要跑其他任務）。

## 決策：機密段不進 repo（2026-10-07）
- **背景**：規格要求原始碼不得有明文答案。但判定訊息與真相解說本身就會洩漏答案（例如真相寫明誰拿走懷錶；只有三人有「選錯訊息」也等於指出兇手），而且 repo 開 Pages 時可能要改成 public。
- **選項**：A 規格全文進 repo，最省事，但 public 後任何人都看得到答案。B 機密段由使用者在開工時貼給 session，repo 裡只放加密結果，代價是每次重產機密檔都要重貼。
- **決定**：選 B。原文只存在使用者桌面的 `停電的二十分鐘_雲端開工.md`（本機）和 session 內 gitignored 的 `tools/secrets.local.json`。
- **代價**：雲端 session 結束後機密原文就不在了；之後要改判定或真相，得請使用者重貼。
- **何時重新檢視**：使用者決定 repo 永遠私人（並用付費方案開 Pages）時，可以改回 A。
