# 前端發佈驗證工作流

適用於所有使用 publisher/reviewer agent 模式的前端專案。

## 4 步驟標準流程

1. `Agent(publisher)` → 產生內容 artifact、commit、push
2. `Agent(reviewer)` → 審核內容品質，回傳報告
3. 讀 `publish.config.json` → 取得 `verifyCommands` 和 `deployWaitSeconds`
   - for each command: `Bash: <command> <slug>`
   - 有截圖輸出的 command：立刻 `Read` 截圖做視覺確認
4. 合併所有結果，一次呈現給使用者

## 執行規則

- git push 後**不可問使用者何時執行驗證**：用 `ScheduleWakeup` 排程，delaySeconds 從 config 讀
- 必須用 `ScheduleWakeup`，不是 `CronCreate`：ScheduleWakeup 保留 session context，才能合併 publisher/reviewer 結果
- `verifyCommands` 是陣列，**必須全部跑完**，不可只跑第一個
- 文字 PASS 不代表視覺正確，有截圖就要 `Read`
- 所有 verifyCommands 結果合併為一份報告再呈現
- 單獨呼叫「review」= reviewer + 全部 verifyCommands + 視覺確認，缺一不可
- 驗證必須用 `verifyCommands`（從 config 讀取），不使用 agent
