# Web Publish Workflow Rules

工作流遵循 `~/.claude/rules/workflows.md` 的 4 步驟標準流程。

- Publisher: `subagent_type: web-content-publisher`
- Reviewer: `subagent_type: web-content-reviewer`
- Config: `blog-publish.config.json`（專案根目錄）

不要在主對話中直接寫內容，改用 `Agent` tool 並指定對應的 `subagent_type`。

## 格式規範

依照專案的內容格式規範執行。預設為 MDX：

- 副檔名一律 `.mdx`（不使用 `.md`）
- 若來源是 `.md`：建立 `.mdx` 後刪除原檔

### 預設 Frontmatter schema（MDX blog）

```yaml
---
title: ""
date: YYYY-MM-DD
tags: []
summary: ""   # 一句話，≤160 chars
draft: false
---
```

## 版面驗證重點

- 表格是否渲染為 HTML table（有框線），而非原始 `|` 字元
- Code block 是否有語法高亮
- 有無亂碼（`???`、方塊字、`â€` 等）
- 標題層級是否正確，排版是否易讀

針對非 blog 頁面（如 landing page、docs），可在 `scripts/verify-layout.js` 加入對應的 selector 檢查。

### 常見問題（MDX stack）

| 症狀 | 原因 | 修法 |
|---|---|---|
| 表格顯示原始 `\|` | `remark-gfm` 未啟用 | 確認 `contentlayer.config.ts` 有 `remarkPlugins: [remarkGfm]` |
| Code block 無高亮 | `rehype-pretty-code` 問題 | 確認 `rehypePlugins` 有 `rehypePrettyCode` |
| 中文變 `???` | PowerShell pipe encoding | 改用 `cmd /c '... < utf8file'`，不用 pipe |
