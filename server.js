require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ========== 角色 & 场景预设 ==========
const ROLE_PRESETS = ['学生', '老师', '父母', '儿女', '老板', '工人'];
const SCENARIO_PRESETS = ['考研', '工作', '学习', '日常', '结婚'];

// ========== 吵架风格预设 ==========
const STYLE_PRESETS = {
  default: `你是一个"模仿吵架大师"，你的核心能力是：
1. 仔细分析对方消息的语气、态度、用词风格、攻击性程度
2. 以完全相同的语气风格回怼，但要比对方更犀利、更狠
3. 保持角色一致性，不要突然变温柔或讲道理
4. 如果对方用反问句，你也用反问句；对方用排比，你也用排比
5. 可以适当夸张、反讽、模仿对方句式

重要规则：
- 回复要简短有力，控制在 2-4 句话
- 不要使用敬语和礼貌用语
- 像真实吵架一样自然，不要太书面化
- 用中文回复`,

  sarcastic: `你是一个"阴阳怪气大师"。你的风格是：
- 表面客气，实际句句带刺
- 喜欢用"哎哟""啧啧""真是""厉害啊"等语气词
- 拐弯抹角地讽刺，不直接骂人
- 善用反问和夸张的比喻
- 用最温柔的语气说出最扎心的话

示例风格：
"哎哟，您说得太对了，我这种凡人哪配跟您说话啊"
"是是是，您最懂了，全世界就您一个人清醒"

重要规则：
- 回复控制在 2-4 句话
- 用中文回复
- 保持阴阳怪气的风格`,

  logic: `你是一个"逻辑暴击大师"。你的风格是：
- 冷静但致命地指出对方的逻辑漏洞
- 用对方的话反推，导出荒谬的结论
- 层层递进式反驳
- 喜欢用"按照你的逻辑""那照你这么说""你这话翻译过来不就是……"

示例风格：
"按照你的逻辑，你考不上大学是因为老师不会教？那你拉不出屎是不是还得怪地球引力不够？"
"你这话翻译过来不就是'我可以做但你不能说'吗？双标这块还是你擅长"

重要规则：
- 回复控制在 2-4 句话
- 用中文回复
- 保持逻辑碾压的风格`,

  mirror: `你是一个"以牙还牙大师"。你的风格是：
- 完全模仿对方的句式和用词风格
- 把对方骂你的话原样怼回去
- 对方用什么比喻，你就用什么比喻反击
- 让对方体验"被自己的话骂"的感觉

示例风格：
对方："你这种人就是欠骂"
你："你这种人才是欠收拾"

对方："你脑子进水了吧"
你："你脑子才进水了，而且进的还是开水"

重要规则：
- 回复控制在 2-4 句话
- 严格模仿对方句式
- 用中文回复`,

  aggressive: `你是一个"火力全开大师"。你的风格是：
- 直接、猛烈、不留情面
- 用词犀利，气势拉满
- 擅长用排比句和夸张手法
- 输出密度高，句句暴击

示例风格：
"就你？你配吗？你哪来的自信？你照照镜子行不行？"
"闭嘴吧你！你说的话有一个字有营养吗？全是在浪费空气！"

重要规则：
- 回复控制在 2-4 句话
- 用中文回复
- 火力全开但不要人身攻击得太脏`,
};

// ========== IP 限流 ==========
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT, 10) || 10;
const ipUsage = new Map(); // IP → { date, count }

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
}

function checkDailyLimit(ip) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const record = ipUsage.get(ip);

  if (!record || record.date !== today) {
    ipUsage.set(ip, { date: today, count: 1 });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }

  if (record.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: DAILY_LIMIT - record.count };
}

// 每小时清理一次过期记录
setInterval(() => {
  const today = new Date().toISOString().slice(0, 10);
  for (const [ip, record] of ipUsage) {
    if (record.date !== today) ipUsage.delete(ip);
  }
}, 3600_000);

// ========== API 端点 ==========

/**
 * POST /api/chat
 * 发送消息到 LLM 并获取回复
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, style = 'default', myRole, opponentRole, scenario } = req.body;

    // 全部从环境变量读取配置
    const apiKey = process.env.API_KEY;
    const baseURL = process.env.BASE_URL || 'https://api.deepseek.com/v1';
    const model = process.env.MODEL || 'deepseek-chat';

    if (!apiKey) {
      return res.status(500).json({
        error: '服务端未配置 API_KEY，请在 .env 文件中填写',
      });
    }

    // IP 每日限流
    const ip = getClientIP(req);
    const limit = checkDailyLimit(ip);
    if (!limit.allowed) {
      return res.status(429).json({
        error: '您今天的对话次数已达上限（10条/天），请明天再来～',
      });
    }

    // 动态拼接系统提示词：角色设定 + 场景设定 + 风格要求
    let roleContext = '';
    if (myRole || opponentRole) {
      roleContext += '## 角色设定\n';
      if (myRole) roleContext += `- 你的身份：${myRole}\n`;
      if (opponentRole) roleContext += `- 对方的身份：${opponentRole}\n`;
      roleContext += '\n';
    }
    if (scenario) {
      roleContext += `## 当前场景：${scenario}\n\n`;
    }

    const stylePrompt = STYLE_PRESETS[style] || STYLE_PRESETS.default;
    const systemPrompt = roleContext + stylePrompt;

    // 构建消息列表
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // 创建 OpenAI 客户端
    const client = new OpenAI({
      apiKey,
      baseURL,
    });

    // 调用 LLM
    const completion = await client.chat.completions.create({
      model,
      messages: fullMessages,
      temperature: 0.9,
      max_tokens: 500,
    });

    const reply = completion.choices[0]?.message?.content || '（对方已读不回）';

    res.json({
      reply,
      model: completion.model,
      usage: completion.usage,
      remaining: limit.remaining,
    });
  } catch (error) {
    console.error('API 调用失败:', error.message);
    res.status(500).json({
      error: error.message || 'AI 暂时无法回复，请检查 API 配置',
    });
  }
});

/**
 * GET /api/styles
 * 获取可用的吵架风格列表
 */
app.get('/api/styles', (req, res) => {
  const styles = Object.keys(STYLE_PRESETS).map(key => ({
    id: key,
    name: {
      default: '默认模式',
      sarcastic: '阴阳怪气',
      logic: '逻辑暴击',
      mirror: '以牙还牙',
      aggressive: '火力全开',
    }[key] || key,
    description: {
      default: '智能分析语气，以相同风格回怼',
      sarcastic: '表面客气，句句带刺',
      logic: '抓逻辑漏洞，层层逼进',
      mirror: '模仿对方句式，原样怼回去',
      aggressive: '火力全开，不留情面',
    }[key] || '',
  }));
  res.json(styles);
});

/**
 * GET /api/presets
 * 获取角色和场景预设列表
 */
app.get('/api/presets', (req, res) => {
  res.json({
    roles: ROLE_PRESETS,
    scenarios: SCENARIO_PRESETS,
  });
});

// ========== 启动服务 ==========
app.listen(PORT, () => {
  console.log(`🔥 模仿吵架大师已上线: http://localhost:${PORT}`);
  console.log(`   按 Ctrl+C 停止服务`);
});
