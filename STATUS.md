# claude-web-publish-workflow — 狀態

## 架構概覽

3 層設計，基於作用域對齊原則：

| 層 | 位置 | 內容 |
|---|---|---|
| User rules | `~/.claude/rules/workflows.md` | 4 步驟流程、ScheduleWakeup 規則 |
| User hook | `~/.claude/hooks/dispatcher.js` | PostToolUse dispatcher，找到 project hook 就執行 |
| Project | `project/.claude/hooks/post-push.js` + `blog-publish.config.json` | 專案特定觸發邏輯和 verify 設定 |

## 已完成的工作

### Package（GitHub: pursky7468/claude-web-publish-workflow）

| 檔案 | 狀態 | 說明 |
|---|---|---|
| `.claude/agents/web-content-publisher.md` | ✅ | Generic，相對路徑，讀 config 的 blogPath |
| `.claude/agents/web-content-reviewer.md` | ✅ | Generic，無 hardcode |
| `scripts/verify-layout.js` | ✅ | 讀 config 的 baseUrl |
| `scripts/verify-functional.js` | ✅ | Generic template，SPA waitForURL 正確 |
| `content/blog/CLAUDE.md` | ✅ | 簡化版，參照 `~/.claude/rules/workflows.md` |
| `hooks/dispatcher.js` | ✅ | User-level PostToolUse dispatcher |
| `user-level/rules/workflows.md` | ✅ | 工作流規則模板（安裝到 `~/.claude/rules/`） |
| `blog-publish.config.example.json` | ✅ | 含 baseUrl / blogPath / deployWaitSeconds / verifyCommands |
| `setup.js` | ✅ | 支援 user-level + project-level 安裝 |
| `package.json` | ✅ | |
| `.gitignore` | ✅ | 排除 blog-publish.config.json |
| `README.md` | ✅ | 3 層架構說明、dispatcher pattern |

### 本地（personal-website）

| 檔案 | 狀態 | 說明 |
|---|---|---|
| `scripts/verify-layout.js` | ✅ | 讀 config 版本 |
| `scripts/verify-functional.js` | ✅ | 8/8 PASS |
| `blog-publish.config.json` | ✅ | Gitignored，含實際 Vercel URL |
| `content/blog/CLAUDE.md` | ✅ | 簡化版，參照 `~/.claude/rules/workflows.md` |
| `.claude/hooks/post-push.js` | ✅ | Blog 偵測邏輯（偵測 content/blog/*.mdx） |
| `.claude/settings.local.json` | ✅ | 移除 PostToolUse（改由 user-level dispatcher 處理） |

### User-level（~/.claude/）

| 檔案 | 狀態 | 說明 |
|---|---|---|
| `~/.claude/rules/workflows.md` | ✅ | 4 步驟流程、執行規則 |
| `~/.claude/hooks/dispatcher.js` | ✅ | PostToolUse dispatcher |
| `~/.claude/settings.json` | ✅ | PostToolUse hook 指向 dispatcher |

## 驗證結果

| 測試 | 結果 |
|---|---|
| verify-layout.js（production） | ✅ PASS |
| verify-functional.js（production） | ✅ 8/8 PASS |
| 端到端發布流程（workflow-test 文章） | ✅ 完整 4 步驟 |
| Dispatcher 架構 | ✅ 實作並驗證 |
