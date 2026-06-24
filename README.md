# 🔥 模仿吵架大师

一个基于大模型的 AI 吵架还嘴网页应用。输入对方说的话，AI 会分析语气风格，用同样的方式怼回去。


## 功能

- 🤬 **智能模仿**：分析对方语气、态度、用词风格，以牙还牙
- 🎭 **多种吵架流派**：阴阳怪气、逻辑暴击、以牙还牙、火力全开
- 💬 **聊天式界面**：支持连续对话，越吵越上头
- 🔐 **安全配置**：前端或 .env 配置 API Key，不暴露给第三方
- 📱 **响应式设计**：支持手机和电脑

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API

**方式一：前端配置（推荐）**
启动后在侧边栏填写 Base URL、API Key 和模型名称，配置保存在浏览器 localStorage。

**方式二：环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 API 信息
```

### 3. 启动服务

```bash
npm start
# 或开发模式（文件变更自动重启）
npm run dev
```

### 4. 打开浏览器

访问 `http://localhost:3000`

## 兼容的 API 服务商

支持所有 OpenAI 兼容接口的 LLM 服务：

| 服务商 | Base URL | 推荐模型 |
|--------|----------|----------|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-turbo` |
| 智谱GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |
| 月之暗面 | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| OpenAI | `https://api.openai.com/v1` | `gpt-3.5-turbo` |

## 吵架风格说明

| 风格 | 说明 |
|------|------|
| 🎯 默认模式 | 智能分析语气，全面模仿回怼 |
| 😏 阴阳怪气 | 表面客气，拐弯抹角讽刺 |
| 🧠 逻辑暴击 | 抓逻辑漏洞，层层逼进 |
| 🪞 以牙还牙 | 模仿对方句式，用对方的话怼回去 |
| 🔥 火力全开 | 直接猛烈，不留情面 |

## 项目结构

```
imitator/
├── package.json
├── server.js          # Express 后端
├── .env.example       # 环境变量模板
├── public/
│   ├── index.html     # 前端页面
│   ├── style.css      # 样式
│   └── app.js         # 前端逻辑
└── README.md
```

## 技术栈

- **后端**: Node.js + Express
- **前端**: 原生 HTML/CSS/JS
- **LLM SDK**: OpenAI Node.js SDK（兼容所有 OpenAI-format API）
