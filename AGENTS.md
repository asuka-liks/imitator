# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

1.全部用中文回复
2.每次回复前用固定的称呼：梨 开头
3.不能写兼容性代码，除非我主动要求
4.写代码前先描述方案，等我批准再动手
5.需求模糊时，先提问澄清再写代码
6.写完代码后，列出边缘情况并建议测试用例
7.修改超过3个文件，先拆成小任务
8.出bug时，先写能重现的测试再修复
9.每次被纠正后，反思并制定不再犯的计划

## Commands

```bash
npm start          # 启动服务 (node server.js)
npm run dev        # 开发模式，文件变更自动重启 (node --watch server.js)
```

## Architecture

```
用户浏览器 (public/)
  → POST /api/chat { messages, config, style }
  → server.js (Express)
  → OpenAI SDK → 兼容的 LLM API
  → 返回 { reply } → 渲染到聊天界面
```

- **后端** (`server.js`): Express 单文件，两个端点。`POST /api/chat` 接收对话历史、API 配置和风格 ID，调用 OpenAI 兼容的 LLM API 后返回回复。`GET /api/styles` 返回可用的吵架风格列表。
- **前端** (`public/`): 原生 HTML/CSS/JS，零构建步骤。`app.js` 管理全局 `state` 对象（config、style、messages），所有用户配置和对话历史持久化到 `localStorage`。
- **API 配置优先级**: 前端请求 body 中的 `config` > 服务端 `.env` 环境变量。首次使用无配置时侧边栏自动展开。

## Key Design: 吵架风格系统

五种风格定义在 `server.js` 的 `STYLE_PRESETS` 对象中（id → system prompt）。前端 `app.js` 中 `STYLE_INFO` 维护对应的 UI 展示信息（icon、name、desc）。

要新增风格：
1. 在 `server.js` 的 `STYLE_PRESETS` 中添加新的 system prompt
2. 在 `/api/styles` 端点的映射表中添加名称和描述
3. 在 `public/app.js` 的 `STYLE_INFO` 中添加 UI 展示信息

## 数据流

用户输入 → Enter 或点击发送 → `app.js sendMessage()` 将用户消息 push 到 `state.messages` → `POST /api/chat`（携带完整 messages 数组、config、style） → server.js 用 `STYLE_PRESETS[style]` 作为 system prompt，拼接 messages → 调用 OpenAI SDK → 返回 `{ reply }` → app.js 将 AI 回复 push 到 `state.messages` → `saveMessages()` 写入 localStorage（最多保留 50 条）。
