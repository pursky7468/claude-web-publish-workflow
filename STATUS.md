# claude-web-publish-workflow — 開發狀態總結

## 已完成的工作

### Package（GitHub: pursky7468/claude-web-publish-workflow）

| 檔案 | 狀態 | 說明 |
|---|---|---|
| `.claude/agents/web-content-publisher.md` | ✅ | Generic，相對路徑，讀 config 的 blogPath |
| `.claude/agents/web-content-reviewer.md` | ✅ | Generic，無 hardcode |
| `scripts/verify-layout.js` | ✅ | 讀 config 的 baseUrl，任何網頁可用 |
| `scripts/verify-functional.js` | ✅ | Generic template，3 個基本測試 + 4 個 commented-out 範例，SPA waitForURL 正確 |
| `content/blog/CLAUDE.md` | ✅ | 工作流規則，明確指定 ScheduleWakeup（不是 CronCreate）並說明原因 |
| `blog-publish.config.example.json` | ✅ | 含 baseUrl / blogPath / deployWaitSeconds / verifyCommands |
| `setup.js` | ✅ | 複製 verify-layout.js + verify-functional.js + agents + CLAUDE.md，有覆蓋確認 |
| `package.json` | ✅ | |
| `.gitignore` | ✅ | 排除 blog-publish.config.json |
| `README.md` | ✅ | 含 verifyCommands pluggable 說明 |

### 本地（personal-website）

| 檔案 | 狀態 | 說明 |
|---|---|---|
| `scripts/verify-layout.js` | ✅ | 已更新為讀 config 版本 |
| `scripts/verify-functional.js` | ✅ | Site-specific，8/8 PASS |
| `blog-publish.config.json` | ✅ | Gitignored，含實際 Vercel URL |
| `content/blog/CLAUDE.md` | ✅ | 同上，已修 |

---

## 驗證結果

### 元件層級測試

| 測試 | 結果 |
|---|---|
| verify-layout.js（production） | ✅ PASS，多次驗證 |
| verify-functional.js（production） | ✅ 8/8 PASS |
| Agent 冷啟動讀 verifyCommands array | ✅ 正確讀取並依序執行兩個 commands |

### 端到端發布流程測試（workflow-test 文章）

| 步驟 | 結果 | 說明 |
|---|---|---|
| Publisher | ✅ | 建立 mdx、commit `3006008`、push |
| Reviewer | ✅ | 內容完整、格式正確 |
| 等待 deployment | ✅ | 90 秒後頁面上線 |
| verify-layout.js | ✅ | H1、encoding PASS，視覺截圖正常 |
| verify-functional.js | ✅ | 8/8 PASS |
| 合併報告 | ⚠️ | 由主對話手動完成，非 agent 自動產生（見已知問題） |

---

## 已知問題

### P1：CLAUDE.md 未明確指定 ScheduleWakeup

**現象**：端到端測試中，agent 使用 `CronCreate` 而非 `ScheduleWakeup`。

**影響**：
- `CronCreate` 開新 session，沒有 publisher/reviewer 的執行結果
- CLAUDE.md 要求「合併所有結果為一份報告」——CronCreate 做不到，只能報告 verify 那段
- 本次測試的完整報告是由主對話手動補位，不是 agent 正確執行的結果

**修法**：在兩份 CLAUDE.md（package + personal-website）的執行規則中，明確寫：
> 使用 `ScheduleWakeup`，不是 `CronCreate`。ScheduleWakeup 保留當前 session context，才能在 verify 完成後合併 publisher/reviewer 結果為一份報告。

**狀態**：✅ 已修——兩份 CLAUDE.md 均已補充「必須用 ScheduleWakeup，不是 CronCreate」並說明原因

---

### P2：workflow-test.zh-TW.mdx 殘留在線上

測試文章仍在 personal-website repo 並已部署。需確認是否刪除。

**狀態**：待使用者決定

---

## 設計決策記錄

| 決策 | 選擇 | 原因 |
|---|---|---|
| Agent 存放位置 | 專案層（`.claude/agents/`） | 乾淨隔離，git clone 即可用，不污染全域 namespace |
| verifyCommand → verifyCommands | 改為 array | layout + functional 兩種驗證性質不同，保持腳本單一職責 |
| verify-functional.js 在 package | Generic template | 每個專案的 UI 不同，不能 hardcode selector |
| 視覺截圖作為必要步驟 | 保留 | 文字 PASS 是 contract，截圖是 semantic——無法互相取代 |
| ScheduleWakeup vs CronCreate | 應用 ScheduleWakeup | 需要保留 session context 才能合併報告 |

---

## 待處理事項

1. ~~**修 CLAUDE.md**（package + personal-website）：明確指定 ScheduleWakeup，說明原因~~ ✅ 已完成
2. **決定是否刪除** `workflow-test.zh-TW.mdx`（待使用者確認）
