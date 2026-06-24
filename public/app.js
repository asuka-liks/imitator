// ========== 常量 ==========
const STORAGE_KEY_STYLE = 'imitator_style';
const STORAGE_KEY_MESSAGES = 'imitator_messages';
const STORAGE_KEY_MY_ROLE = 'imitator_myRole';
const STORAGE_KEY_OPPONENT_ROLE = 'imitator_opponentRole';
const STORAGE_KEY_SCENARIO = 'imitator_scenario';

// ========== 预设数据（从服务端加载，这里做 fallback） ==========
let presets = { roles: ['学生', '老师', '父母', '儿女', '老板', '工人'], scenarios: ['考研', '工作', '学习', '日常', '结婚'] };

// ========== 状态管理 ==========
const state = {
  style: 'default',
  myRole: '',
  opponentRole: '',
  scenario: '',
  messages: [], // { role: 'user' | 'assistant', content: string, time: string }
  isGenerating: false,
  dailyRemaining: null, // null = 未初始化，数字 = 剩余次数
};

// ========== DOM 引用 ==========
const elements = {
  sidebar: document.getElementById('sidebar'),
  btnToggleSidebar: document.getElementById('btnToggleSidebar'),
  btnCloseSidebar: document.getElementById('btnCloseSidebar'),
  styleList: document.getElementById('styleList'),
  currentStyle: document.getElementById('currentStyle'),
  chatMessages: document.getElementById('chatMessages'),
  messageInput: document.getElementById('messageInput'),
  btnSend: document.getElementById('btnSend'),
  btnClearChat: document.getElementById('btnClearChat'),
  remainingCount: document.getElementById('remainingCount'),
  inputHint: document.getElementById('inputHint'),
  myRoleSelect: document.getElementById('myRoleSelect'),
  myRoleCustom: document.getElementById('myRoleCustom'),
  opponentRoleSelect: document.getElementById('opponentRoleSelect'),
  opponentRoleCustom: document.getElementById('opponentRoleCustom'),
  scenarioSelect: document.getElementById('scenarioSelect'),
  scenarioCustom: document.getElementById('scenarioCustom'),
};

// ========== 初始化 ==========
async function init() {
  await fetchPresets();
  loadStyle();
  loadPresets();
  loadMessages();
  renderStyleList();
  renderPresets();
  renderMessages();
  bindEvents();

  // 默认收起侧边栏
  elements.sidebar.classList.add('collapsed');
}

// ========== 持久化 ==========
function loadStyle() {
  const saved = localStorage.getItem(STORAGE_KEY_STYLE);
  if (saved) {
    state.style = saved;
  }
}

function saveStyle() {
  localStorage.setItem(STORAGE_KEY_STYLE, state.style);
}

function loadMessages() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (saved) {
      state.messages = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('消息加载失败:', e);
  }
}

function saveMessages() {
  // 只保留最近的 50 条消息
  const toSave = state.messages.slice(-50);
  localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(toSave));
}

async function fetchPresets() {
  try {
    const res = await fetch('api/presets');
    if (res.ok) {
      presets = await res.json();
    }
  } catch (e) {
    // fallback 用本地预设
  }
}

function loadPresets() {
  state.myRole = localStorage.getItem(STORAGE_KEY_MY_ROLE) || '';
  state.opponentRole = localStorage.getItem(STORAGE_KEY_OPPONENT_ROLE) || '';
  state.scenario = localStorage.getItem(STORAGE_KEY_SCENARIO) || '';
}

function saveMyRole(val) { state.myRole = val; localStorage.setItem(STORAGE_KEY_MY_ROLE, val); }
function saveOpponentRole(val) { state.opponentRole = val; localStorage.setItem(STORAGE_KEY_OPPONENT_ROLE, val); }
function saveScenario(val) { state.scenario = val; localStorage.setItem(STORAGE_KEY_SCENARIO, val); }

// ========== 风格列表 ==========
const STYLE_INFO = {
  default: { icon: '🎯', name: '默认模式', desc: '智能分析语气，以相同风格回怼' },
  sarcastic: { icon: '😏', name: '阴阳怪气', desc: '表面客气，句句带刺' },
  logic: { icon: '🧠', name: '逻辑暴击', desc: '抓逻辑漏洞，层层逼进' },
  mirror: { icon: '🪞', name: '以牙还牙', desc: '模仿对方句式，原样怼回去' },
  aggressive: { icon: '🔥', name: '火力全开', desc: '火力全开，不留情面' },
};

function renderStyleList() {
  elements.styleList.innerHTML = Object.entries(STYLE_INFO)
    .map(
      ([id, info]) => `
      <div class="style-option ${id === state.style ? 'active' : ''}" data-style="${id}">
        <span class="style-icon">${info.icon}</span>
        <div>
          <div class="style-name">${info.name}</div>
          <div class="style-desc">${info.desc}</div>
        </div>
      </div>
    `
    )
    .join('');

  // 更新当前风格显示
  const current = STYLE_INFO[state.style];
  elements.currentStyle.textContent = current ? current.name : '默认模式';
}

function selectStyle(styleId) {
  if (state.isGenerating) return;
  if (state.style === styleId) return; // 没切换就不动

  // 有聊天记录时弹窗确认
  if (state.messages.length > 0) {
    if (!confirm('切换风格将清空当前聊天记录，确定继续？')) return;
  }

  state.style = styleId;
  saveStyle();
  renderStyleList();
  // 切换风格时清空聊天记录
  state.messages = [];
  saveMessages();
  renderMessages();
}

// ========== 角色 & 场景渲染 ==========
function buildPresetOptions(list, current, placeholder) {
  const options = list.map(v => `<option value="${v}" ${v === current ? 'selected' : ''}>${v}</option>`).join('');
  return `<option value="">${placeholder}</option>${options}<option value="__custom__" ${current && !list.includes(current) ? 'selected' : ''}>自定义</option>`;
}

function renderPresets() {
  // 默认“不选择”时的占位文字
  elements.myRoleSelect.innerHTML = buildPresetOptions(presets.roles, state.myRole, '不选择');
  elements.opponentRoleSelect.innerHTML = buildPresetOptions(presets.roles, state.opponentRole, '不选择');
  elements.scenarioSelect.innerHTML = buildPresetOptions(presets.scenarios, state.scenario, '不选择');

  // 自定义输入框显隐
  toggleCustomInput(elements.myRoleSelect, elements.myRoleCustom, state.myRole, presets.roles);
  toggleCustomInput(elements.opponentRoleSelect, elements.opponentRoleCustom, state.opponentRole, presets.roles);
  toggleCustomInput(elements.scenarioSelect, elements.scenarioCustom, state.scenario, presets.scenarios);
}

function toggleCustomInput(selectEl, inputEl, current, list) {
  if (selectEl.value === '__custom__') {
    inputEl.style.display = 'block';
    inputEl.value = current && !list.includes(current) ? current : '';
  } else {
    inputEl.style.display = 'none';
    inputEl.value = '';
  }
}

function onPresetChange(type) {
  if (state.isGenerating) return;

  const selectEl = elements[type + 'Select'];
  const customEl = elements[type + 'Custom'];
  const list = type === 'scenario' ? presets.scenarios : presets.roles;
  let newValue = selectEl.value;
  if (newValue === '__custom__') newValue = customEl.value.trim();

  // 没变化就不动
  const oldValue = state[type];
  if (newValue === oldValue) {
    toggleCustomInput(selectEl, customEl, newValue, list);
    return;
  }

  // 直接保存新值并清空聊天（不弹窗）
  const saveFns = {
    myRole: saveMyRole,
    opponentRole: saveOpponentRole,
    scenario: saveScenario,
  };
  saveFns[type](newValue);
  renderPresets();
  toggleCustomInput(selectEl, customEl, newValue, list);

  state.messages = [];
  saveMessages();
  renderMessages();
}

// ========== 消息渲染 ==========
function renderMessages() {
  if (state.messages.length === 0) {
    elements.chatMessages.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">🔥</div>
        <h2>欢迎来到模仿吵架大师</h2>
        <p>输入对方说的话，AI 会用同样的语气怼回去！</p>
        <p class="welcome-hint">👈 在侧边栏选择吵架风格，开始 battle</p>
      </div>
    `;
    return;
  }

  elements.chatMessages.innerHTML = state.messages
    .map(
      (msg, index) => `
      <div class="message ${msg.role === 'user' ? 'user' : 'ai'}">
        <div class="message-avatar">${msg.role === 'user' ? '😤' : '🤬'}</div>
        <div>
          <div class="message-bubble">${escapeHtml(msg.content)}</div>
          <div class="message-time">${msg.time || ''}</div>
        </div>
      </div>
    `
    )
    .join('');

  scrollToBottom();
}

function addTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message ai typing';
  typingDiv.id = 'typingIndicator';
  typingDiv.innerHTML = `
    <div class="message-avatar">🤬</div>
    <div>
      <div class="message-bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
  elements.chatMessages.appendChild(typingDiv);
  scrollToBottom();
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

function scrollToBottom() {
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ========== 剩余次数显示 ==========
function updateRemainingDisplay() {
  const remaining = state.dailyRemaining;
  if (remaining === null) {
    elements.inputHint.innerHTML = '今日剩余 <strong id="remainingCount">--</strong> 次对话';
    elements.messageInput.disabled = false;
    elements.btnSend.disabled = false;
    return;
  }
  const el = elements.remainingCount;
  el.textContent = remaining;
  if (remaining <= 0) {
    elements.inputHint.innerHTML = '今天对话次数已用完，<strong>明天再来吧～</strong>';
    elements.messageInput.disabled = true;
    elements.btnSend.disabled = true;
  } else if (remaining <= 3) {
    el.style.color = '#e94560';
    elements.messageInput.disabled = false;
    elements.btnSend.disabled = false;
  } else {
    el.style.color = '';
    elements.messageInput.disabled = false;
    elements.btnSend.disabled = false;
  }
}

// ========== 发送消息 ==========
async function sendMessage() {
  if (state.isGenerating) return;
  if (state.dailyRemaining !== null && state.dailyRemaining <= 0) return;

  const content = elements.messageInput.value.trim();
  if (!content) return;

  // 添加用户消息
  const userMsg = {
    role: 'user',
    content,
    time: getTimeString(),
  };
  state.messages.push(userMsg);
  saveMessages();
  renderMessages();

  // 清空输入框
  elements.messageInput.value = '';
  elements.messageInput.style.height = 'auto';

  // 设置状态
  state.isGenerating = true;
  elements.btnSend.disabled = true;

  // 显示打字动画
  addTypingIndicator();

  try {
    const response = await fetch('api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.messages.map(m => ({ role: m.role, content: m.content })),
        style: state.style,
        myRole: state.myRole,
        opponentRole: state.opponentRole,
        scenario: state.scenario,
      }),
    });

    const data = await response.json();

    removeTypingIndicator();

    if (data.error) {
      throw new Error(data.error);
    }

    // 更新剩余次数
    if (data.remaining !== undefined) {
      state.dailyRemaining = data.remaining;
      updateRemainingDisplay();
    }

    // 添加 AI 回复
    const aiMsg = {
      role: 'assistant',
      content: data.reply,
      time: getTimeString(),
    };
    state.messages.push(aiMsg);
    saveMessages();
    renderMessages();
  } catch (error) {
    removeTypingIndicator();
    console.error('发送失败:', error);

    // 如果是 429 限流，标记剩余为 0
    if (error.message.includes('上限')) {
      state.dailyRemaining = 0;
      updateRemainingDisplay();
    }

    // 显示错误消息
    const errorMsg = {
      role: 'assistant',
      content: `❌ 出错了: ${error.message}`,
      time: getTimeString(),
    };
    state.messages.push(errorMsg);
    saveMessages();
    renderMessages();
  } finally {
    state.isGenerating = false;
    elements.btnSend.disabled = false;
    elements.messageInput.focus();
  }
}

// ========== 事件绑定 ==========
function bindEvents() {
  // 侧边栏切换
  elements.btnToggleSidebar.addEventListener('click', () => {
    elements.sidebar.classList.toggle('collapsed');
  });

  elements.btnCloseSidebar.addEventListener('click', () => {
    elements.sidebar.classList.add('collapsed');
  });

  // 风格选择
  elements.styleList.addEventListener('click', (e) => {
    const option = e.target.closest('.style-option');
    if (option) {
      selectStyle(option.dataset.style);
    }
  });

  // 发送消息
  elements.btnSend.addEventListener('click', sendMessage);

  // 回车发送
  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // 自动调整输入框高度
  elements.messageInput.addEventListener('input', () => {
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height =
      Math.min(elements.messageInput.scrollHeight, 120) + 'px';
  });

  // 清空对话
  elements.btnClearChat.addEventListener('click', () => {
    if (state.isGenerating) return;
    if (confirm('确定要清空所有对话吗？')) {
      state.messages = [];
      saveMessages();
      renderMessages();
    }
  });

  // 角色/场景下拉框
  elements.myRoleSelect.addEventListener('change', () => onPresetChange('myRole'));
  elements.opponentRoleSelect.addEventListener('change', () => onPresetChange('opponentRole'));
  elements.scenarioSelect.addEventListener('change', () => onPresetChange('scenario'));

  // 自定义输入框：回车或失焦时确认
  for (const [customEl, type] of [
    [elements.myRoleCustom, 'myRole'],
    [elements.opponentRoleCustom, 'opponentRole'],
    [elements.scenarioCustom, 'scenario'],
  ]) {
    customEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        customEl.blur();
      }
    });
    customEl.addEventListener('blur', () => {
      const selectEl = elements[type + 'Select'];
      if (selectEl.value === '__custom__') {
        onPresetChange(type);
      }
    });
  }

  // 点击聊天区域关闭侧边栏（移动端）
  elements.chatMessages.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      elements.sidebar.classList.add('collapsed');
    }
  });
}

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', init);
