/* Julia AI extras. Loads AFTER script.js.
   1) Formats replies (lists, code blocks, tables, bold, links)
   2) Tells Julia which format to use for each kind of request
   3) Syncs chats between devices with a private sync code */
(function(){
'use strict';

/* ---------- 1. Markdown rendering ---------- */
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const NUL = '\u0000';
const LI = /^(\s*)([-*\u2022]|\d+[.)])\s+(.*)$/;
const SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const HR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;

function inline(s){
  const keep = [];
  const hold = h => NUL + (keep.push(h) - 1) + NUL;
  s = esc(s).replace(/`([^`\n]+)`/g, (m, c) => hold('<code>' + c + '</code>'));
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, u) =>
    hold('<a href="' + u.replace(/"/g, '%22') + '" target="_blank" rel="noopener noreferrer">' + t + '</a>'));
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]*[^\s<.,;:!?)])/g, (m, p, u) =>
    p + hold('<a href="' + u.replace(/"/g, '%22') + '" target="_blank" rel="noopener noreferrer">' + u + '</a>'));
  s = s.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>')
       .replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?!\*)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[i]);
}

function cells(l){ return l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()); }

function md(src){
  const blocks = [];
  src = String(src).replace(/\r/g, '').replace(/```([\w+#.-]*)[^\n]*\n?([\s\S]*?)```/g, (m, l, c) => {
    blocks.push([l, c.replace(/\n$/, '')]);
    return '\n\u0001' + (blocks.length - 1) + '\u0001\n';
  });
  const L = src.split('\n');
  const starts = (l, n) => /^\u0001\d+\u0001$/.test(l) || /^#{1,6}\s/.test(l) || LI.test(l) ||
    /^\s*>/.test(l) || HR.test(l) || (l.includes('|') && SEP.test(n || ''));
  let o = '', i = 0, m;
  while(i < L.length){
    const l = L[i];
    if(!l.trim()){ i++; continue; }
    if((m = l.match(/^\u0001(\d+)\u0001$/))){
      const b = blocks[m[1]];
      o += '<div class="code-block"><div class="code-head"><span>' + esc(b[0] || 'code') +
           '</span><button type="button" class="code-copy">Copy</button></div><pre><code>' + esc(b[1]) + '</code></pre></div>';
      i++; continue;
    }
    if((m = l.match(/^(#{1,6})\s+(.*)$/))){
      const n = Math.min(m[1].length + 2, 6);
      o += '<h' + n + '>' + inline(m[2]) + '</h' + n + '>'; i++; continue;
    }
    if(HR.test(l)){ o += '<hr>'; i++; continue; }
    if(/^\s*>/.test(l)){
      const q = [];
      while(i < L.length && /^\s*>/.test(L[i])) q.push(inline(L[i++].replace(/^\s*>\s?/, '')));
      o += '<blockquote>' + q.join('<br>') + '</blockquote>'; continue;
    }
    if(l.includes('|') && SEP.test(L[i + 1] || '')){
      const h = cells(l); i += 2;
      const rows = [];
      while(i < L.length && L[i].trim() && L[i].includes('|')) rows.push(cells(L[i++]));
      o += '<div class="md-table"><table><thead><tr>' + h.map(c => '<th>' + inline(c) + '</th>').join('') +
           '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
           '</tbody></table></div>';
      continue;
    }
    if((m = l.match(LI))){
      const ord = /\d/.test(m[2]);
      const start = ord ? parseInt(m[2], 10) : 1;
      let items = '';
      while(i < L.length && (m = L[i].match(LI))){
        const depth = Math.min(Math.floor(m[1].replace(/\t/g, '  ').length / 2), 4);
        items += '<li style="margin-left:' + (depth * 18) + 'px">' + inline(m[3]) + '</li>';
        i++;
      }
      o += (ord ? '<ol start="' + start + '">' : '<ul>') + items + (ord ? '</ol>' : '</ul>');
      continue;
    }
    const p = [];
    while(i < L.length && L[i].trim() && !(p.length && starts(L[i], L[i + 1]))) p.push(inline(L[i++]));
    o += '<p>' + p.join('<br>') + '</p>';
  }
  return o;
}

// AI bubbles render as formatted HTML; user bubbles stay plain text.
const baseAppend = appendBubble;
appendBubble = function(role, text){
  const bubble = baseAppend.apply(null, arguments);
  if(role === 'ai' && text){
    const span = bubble.lastElementChild;
    if(span && span.tagName === 'SPAN'){ span.innerHTML = md(text); bubble.classList.add('md'); }
  }
  return bubble;
};

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.code-copy');
  if(!b) return;
  const txt = b.closest('.code-block').querySelector('code').textContent;
  navigator.clipboard.writeText(txt).then(() => {
    b.textContent = 'Copied!';
    setTimeout(() => { b.textContent = 'Copy'; }, 1400);
  });
});

/* ---------- 2. Format rules for Julia ---------- */
const baseSystemPrompt = buildSystemPrompt;
buildSystemPrompt = function(){
  return baseSystemPrompt() +
    "\n\nFORMATTING: your replies are shown as markdown, so match the format to what the person needs. " +
    "Casual chat, feelings, or quick questions: short plain paragraphs, no lists or headings. " +
    "How-to or setup help: a numbered list, one action per step. " +
    "Tips, ideas, or options: a bullet list with the key word in **bold**. " +
    "Comparisons: a markdown table. " +
    "Code, commands, config, or file contents: always a fenced block with the language (```html, ```js, ```bash), complete and ready to paste, with one short sentence before it and the next step after it. If there are several files, put each file name in bold above its block. When asked to fix or change code, give the full updated file, not fragments. " +
    "Emails, messages, captions, or anything they will paste elsewhere: put only the ready-to-send text in a ```text block, then one short line offering changes. " +
    "Homework or math: numbered steps, then the final answer in **bold**. " +
    "Poems and stories: normal lines, never a code block. " +
    "Use headings (##) only for long, multi-part answers. Never wrap a whole reply in a code block.";
};

/* ---------- 3. Cross-device sync ---------- */
const LS_CODE = 'juliaSyncCode', LS_DEL = 'juliaSyncDeleted';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let code = localStorage.getItem(LS_CODE) || '';
if(!code){
  code = Array.from(crypto.getRandomValues(new Uint8Array(20)), b => ALPHA[b % 32]).join('');
  localStorage.setItem(LS_CODE, code);
}
const fmt = c => c.match(/.{1,4}/g).join('-');
let tomb = {};
try{ tomb = JSON.parse(localStorage.getItem(LS_DEL) || '{}'); }catch(e){ tomb = {}; }
const saveTomb = () => localStorage.setItem(LS_DEL, JSON.stringify(tomb));

const sig = c => JSON.stringify([c.title, c.messages.map(m => [m.role, m.content, m.feedback || 0, (m.attachments || []).length])]);
const sigs = new Map();
let dirty = false, busy = false, timer = null;

function stampAll(mark){
  conversations.forEach(c => {
    const s = sig(c);
    if(sigs.get(c.id) !== s){ if(mark) c.updatedAt = Date.now(); sigs.set(c.id, s); }
    if(!c.updatedAt) c.updatedAt = Date.now();
  });
}

const rawSave = saveState;
saveState = function(){ stampAll(true); rawSave(); dirty = true; clearTimeout(timer); timer = setTimeout(syncNow, 1500); };

const rawDelete = deleteConversation;
deleteConversation = function(id){ tomb[id] = Date.now(); saveTomb(); sigs.delete(id); rawDelete(id); };

// Photos and files stay on the device that sent them; only text syncs.
const strip = c => ({ ...c, messages: c.messages.map(m => (m.attachments && m.attachments.length)
  ? { ...m, attachments: m.attachments.map(a => ({ name: (a.name || 'Image') + ' (on other device)', mimeType: 'omitted', omitted: 1 })) }
  : m) });

function merge(r){
  let push = false, changed = false;
  const rc = Array.isArray(r.conversations) ? r.conversations : [];
  const rd = r.deleted || {};
  const prevId = currentId, prevCur = currentConv();
  const prevSig = prevCur ? sig(prevCur) : '';

  Object.keys(rd).forEach(id => { if((tomb[id] || 0) < rd[id]) tomb[id] = rd[id]; });
  Object.keys(tomb).forEach(id => { if(rd[id] !== tomb[id]) push = true; });
  conversations = conversations.filter(c => !(tomb[c.id] > (c.updatedAt || 0)));

  const local = new Map(conversations.map(c => [c.id, c]));
  rc.forEach(x => {
    if(!x || !x.id || !Array.isArray(x.messages) || tomb[x.id] > (x.updatedAt || 0)) return;
    x.lang = 'en';
    const l = local.get(x.id);
    if(!l){ conversations.push(x); changed = true; }
    else if((x.updatedAt || 0) > (l.updatedAt || 0)){
      x.messages.forEach((m, i) => {
        const old = l.messages[i];
        if(old && old.role === m.role && old.attachments && m.attachments && m.attachments.some(a => a.omitted)) m.attachments = old.attachments;
      });
      Object.assign(l, x); changed = true;
    }
  });

  const remote = new Map(rc.map(x => [x.id, x]));
  conversations.forEach(c => {
    if(!c.messages.length) return;
    const x = remote.get(c.id);
    if(!x || (c.updatedAt || 0) > (x.updatedAt || 0)) push = true;
  });

  conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if(!conversations.find(c => c.id === currentId)){
    if(conversations.length) currentId = conversations[0].id; else newConversation();
  }
  saveTomb(); rawSave(); stampAll(false);

  if(changed || prevId !== currentId){
    if(!document.querySelector('.history-item-input')) renderHistory();
    const cur = currentConv();
    if((prevId !== currentId || !cur || sig(cur) !== prevSig) && !document.querySelector('.edit-box')) renderChat();
  }
  return push;
}

function setStatus(t){ const e = document.getElementById('syncStatus'); if(e) e.textContent = t; }

async function syncNow(){
  if(busy || !code || document.getElementById('typingMsg')) return;
  busy = true;
  const was = dirty; dirty = false;
  const head = { 'X-Sync-Key': code };
  try{
    const g = await fetch(API_ENDPOINT + '/sync', { headers: head });
    if(!g.ok) throw new Error('GET ' + g.status);
    const remote = await g.json();
    if(document.getElementById('typingMsg')){ dirty = true; return; }
    const push = merge(remote) || was;
    if(push){
      const body = JSON.stringify({ conversations: conversations.filter(c => c.messages.length).map(strip), deleted: tomb });
      const p = await fetch(API_ENDPOINT + '/sync', { method: 'PUT', headers: { ...head, 'Content-Type': 'application/json' }, body });
      if(!p.ok) throw new Error('PUT ' + p.status);
    }
    setStatus('Synced at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }catch(e){
    console.error('Sync failed', e);
    dirty = dirty || was;
    setStatus('Could not sync right now. It will retry.');
  }finally{ busy = false; }
}

/* ---------- Sync UI ---------- */
const css = `
.bubble.md{white-space:normal;min-width:0;max-width:100%;overflow:hidden}
.msg-col{min-width:0}
.bubble.md>span{display:block}
.bubble.md>span>*:first-child{margin-top:0}
.bubble.md>span>*:last-child{margin-bottom:0}
.bubble.md p{margin:0 0 10px}
.bubble.md h3,.bubble.md h4,.bubble.md h5,.bubble.md h6{font-family:'Baloo 2',sans-serif;margin:14px 0 6px;line-height:1.3;color:var(--bow)}
.bubble.md h3{font-size:18px}.bubble.md h4{font-size:16.5px}.bubble.md h5,.bubble.md h6{font-size:15px}
.bubble.md ul,.bubble.md ol{margin:0 0 10px;padding-left:22px}
.bubble.md li{margin:3px 0}
.bubble.md blockquote{margin:0 0 10px;padding:6px 12px;border-left:3px solid var(--pink-200);background:var(--pink-50);border-radius:0 10px 10px 0;color:var(--ink-soft)}
.bubble.md hr{border:none;border-top:1px solid var(--pink-200);margin:12px 0}
.bubble.md a{color:var(--bow);font-weight:700}
.bubble.md code{font-family:Consolas,Menlo,monospace;font-size:13px;background:var(--pink-50);border:1px solid var(--pink-100);padding:1px 5px;border-radius:6px}
.code-block{margin:6px 0 12px;border-radius:12px;overflow:hidden;background:#2b1a22;color:#ffe9f4}
.code-head{display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:#3d2331;font-size:12px;color:#ffadd3}
.code-copy{font-family:'Nunito',sans-serif;font-weight:700;font-size:12px;background:var(--bow);color:#fff;border:none;border-radius:999px;padding:4px 12px;cursor:pointer}
.bubble.md .code-block pre{margin:0;padding:12px;overflow-x:auto;white-space:pre;font-size:13px;line-height:1.5}
.bubble.md .code-block code{background:none;border:none;padding:0;color:inherit}
.md-table{overflow-x:auto;margin:6px 0 12px}
.md-table table{border-collapse:collapse;font-size:14px;min-width:100%}
.md-table th,.md-table td{border:1px solid var(--pink-200);padding:6px 10px;text-align:left}
.md-table th{background:var(--pink-50);color:var(--bow)}
.history{scrollbar-width:none;-ms-overflow-style:none}
.history::-webkit-scrollbar{display:none;width:0;height:0}
.sync-btn{width:100%;justify-content:center}
.sync-modal{display:none;position:fixed;inset:0;background:rgba(43,26,34,.45);z-index:50;align-items:center;justify-content:center;padding:16px}
.sync-modal.show{display:flex}
.sync-card{background:#fff;border-radius:20px;padding:22px;max-width:420px;width:100%;box-shadow:var(--shadow);max-height:90vh;overflow-y:auto}
.sync-card h3{font-family:'Baloo 2',sans-serif;margin:0 0 8px;color:var(--bow);font-size:22px}
.sync-card p{font-size:14px;line-height:1.5;margin:0 0 12px}
.sync-code{font-family:Consolas,Menlo,monospace;font-weight:700;font-size:15px;letter-spacing:1px;text-align:center;background:var(--pink-50);border:1.5px dashed var(--bow);border-radius:12px;padding:12px 8px;margin-bottom:10px;color:var(--bow);word-break:break-all;user-select:all}
.sync-row{display:flex;gap:8px;margin-bottom:12px}
.sync-row input{flex:1;min-width:0;font-family:'Nunito',sans-serif;font-size:14px;border:1.5px solid var(--pink-200);border-radius:12px;padding:9px 12px;outline:none;text-transform:uppercase}
.sync-row input:focus{border-color:var(--bow)}
.sync-card button{font-family:'Nunito',sans-serif;font-weight:700;font-size:13.5px;border-radius:999px;padding:9px 16px;cursor:pointer;border:1.5px solid var(--bow);background:var(--bow);color:#fff}
.sync-card button:hover{background:var(--bow-dark)}
.sync-card .sync-close{background:#fff;color:var(--bow);width:100%}
.sync-status{font-size:12.5px;color:var(--ink-soft);min-height:18px;margin-bottom:8px}
.sync-card .sync-note{font-size:12.5px;color:var(--ink-soft)}
`;
const styleEl = document.createElement('style');
styleEl.textContent = css;
document.head.appendChild(styleEl);

const openBtn = document.createElement('button');
openBtn.type = 'button';
openBtn.className = 'new-chat-btn sync-btn';
openBtn.textContent = 'Sync devices';
document.getElementById('sidebarFooter').before(openBtn);

const modal = document.createElement('div');
modal.className = 'sync-modal';
modal.innerHTML =
  '<div class="sync-card"><h3>Sync your chats</h3>' +
  '<p>Chats sync between devices that use the same code. On your other device, tap <b>Sync devices</b> and enter this code.</p>' +
  '<div class="sync-code" id="syncCode"></div>' +
  '<div class="sync-row"><button type="button" id="syncCopy">Copy code</button></div>' +
  '<p>Got a code from another device? Enter it here. Chats on this device will be combined with that code\'s chats.</p>' +
  '<div class="sync-row"><input id="syncInput" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false"><button type="button" id="syncLink">Use code</button></div>' +
  '<div class="sync-status" id="syncStatus"></div>' +
  '<p class="sync-note">Keep this code private, anyone with it can read your chats. Only text syncs; photos and files stay on the device that sent them.</p>' +
  '<button type="button" class="sync-close" id="syncClose">Close</button></div>';
document.body.appendChild(modal);

const codeEl = document.getElementById('syncCode');
const showModal = () => { codeEl.textContent = fmt(code); modal.classList.add('show'); syncNow(); };
const hideModal = () => modal.classList.remove('show');
openBtn.addEventListener('click', () => { closeSidebarMobile(); showModal(); });
document.getElementById('syncClose').addEventListener('click', hideModal);
modal.addEventListener('click', e => { if(e.target === modal) hideModal(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') hideModal(); });
document.getElementById('syncCopy').addEventListener('click', () => {
  navigator.clipboard.writeText(fmt(code)).then(() => setStatus('Code copied.'));
});
document.getElementById('syncLink').addEventListener('click', () => {
  const v = document.getElementById('syncInput').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if(!new RegExp('^[' + ALPHA + ']{20}$').test(v)){ setStatus('That code should be 20 letters and numbers.'); return; }
  code = v;
  localStorage.setItem(LS_CODE, v);
  codeEl.textContent = fmt(v);
  document.getElementById('syncInput').value = '';
  dirty = true;
  setStatus('Linking...');
  syncNow();
});

/* ---------- Start ---------- */
stampAll(false);
rawSave();
renderChat(); // re-draw existing replies with formatting
syncNow();
setInterval(() => { if(!document.hidden) syncNow(); }, 20000);
document.addEventListener('visibilitychange', () => { if(!document.hidden) syncNow(); });
window.addEventListener('focus', syncNow);
})();
