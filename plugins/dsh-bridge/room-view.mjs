import { App } from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'DSH 三方聊天室', version: '0.3.0' });
const aliasLabel = document.getElementById('alias');
const timeline = document.getElementById('timeline');
const status = document.getElementById('status');
const draft = document.getElementById('draft');
const postButton = document.getElementById('post');
const dshButton = document.getElementById('send-dsh');
const workButton = document.getElementById('send-work');
const shareDialog = document.getElementById('share-dialog');
const shareText = document.getElementById('share-text');
const labels = { user: '你', dsh: 'DSH', work: 'Work' };
let token;
let room;
let busy = false;
let refreshing = false;
let messageIds = '';
let draftSource = 'user';

function buttons() {
  const empty = !draft.value.trim();
  draft.disabled = !token;
  postButton.disabled = !token || busy || empty;
  workButton.disabled = !token || busy || empty;
  dshButton.disabled = !token || busy || empty;
  for (const button of timeline.querySelectorAll('[data-share]')) button.disabled = busy;
}

function render(next) {
  if (!next) return;
  room = next;
  aliasLabel.textContent = ' / ' + room.alias;
  const ids = room.messages.map(message => message.id).join(',');
  if (ids !== messageIds) {
    messageIds = ids;
    const nearEnd = timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight < 50;
    timeline.replaceChildren(...room.messages.map(message => {
      const row = document.createElement('article');
      row.dataset.role = message.role;
      const label = document.createElement('strong');
      label.textContent = labels[message.role] ?? '消息';
      if (message.forwarded) label.textContent += ' → DSH';
      const time = document.createElement('time');
      time.dateTime = message.at;
      time.textContent = new Date(message.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const body = document.createElement('p');
      body.textContent = message.text;
      row.append(label, time, body);
      if (message.role === 'work' && !message.forwarded) {
        const send = document.createElement('button');
        send.textContent = '编辑后转发给 DSH';
        send.onclick = () => {
          draft.value = message.text;
          draftSource = 'work';
          draft.focus();
          buttons();
        };
        row.append(send);
      }
      if (message.role === 'dsh') {
        const send = document.createElement('button');
        send.textContent = '选择回传给 Work 的文字';
        send.dataset.share = 'true';
        send.onclick = () => {
          shareText.value = window.getSelection()?.toString().trim() || message.text;
          shareDialog.returnValue = 'cancel';
          shareDialog.showModal();
        };
        row.append(send);
      }
      return row;
    }));
    if (nearEnd) timeline.scrollTop = timeline.scrollHeight;
  }
  if (!busy) status.textContent = waitingText();
  buttons();
}

function waitingText() {
  return room?.waiting ? `${room.waiting} 条消息等待 DSH 领取或回复` : '';
}

async function tool(action, text, source) {
  const result = await app.callServerTool({ name: 'room_action', arguments: { token, action, text, source } });
  if (result.isError) throw new Error(result.content[0]?.text ?? '房间操作失败。');
  render(result._meta?.room);
}

async function sendWork(text) {
  const response = await app.sendMessage({
    role: 'user',
    content: [{ type: 'text', text: `请在三方聊天室「${room.alias}」回复下面这段经我批准的消息，并用 post_work_message 把你的回复加入聊天室。\n\n${text}` }]
  });
  if (response.isError) throw new Error('Work 未接收消息。');
}

async function perform(action) {
  if (busy) return;
  busy = true;
  status.textContent = '处理中…';
  buttons();
  try {
    await action();
    status.textContent = waitingText();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    busy = false;
    buttons();
  }
}

function submit(action) {
  const text = draft.value.trim();
  void perform(async () => {
    await action(text);
    if (draft.value.trim() === text) {
      draft.value = '';
      draftSource = 'user';
    }
  });
}

shareDialog.onclose = () => {
  const text = shareText.value.trim();
  shareText.value = '';
  if (shareDialog.returnValue === 'approve' && text) void perform(() => sendWork(text));
};

draft.oninput = () => {
  if (!draft.value) draftSource = 'user';
  buttons();
};
postButton.onclick = () => submit(text => tool('post', text));
dshButton.onclick = () => submit(text => tool('send-dsh', text, draftSource));
workButton.onclick = () => submit(async text => {
  await sendWork(text);
  await tool('post', text);
});

app.ontoolresult = result => {
  if (result.isError) {
    status.textContent = result.content[0]?.text ?? '无法打开房间。';
    return;
  }
  token = result._meta?.token;
  render(result._meta?.room);
};
app.connect().then(() => {
  setInterval(async () => {
    if (!token || busy || refreshing || document.hidden) return;
    refreshing = true;
    try { await tool('refresh'); }
    catch (error) {
      if (!busy) status.textContent = error.message;
    } finally { refreshing = false; }
  }, 1800);
}).catch(error => { status.textContent = error.message; });
