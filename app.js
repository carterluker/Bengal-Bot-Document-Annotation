(() => {
const $ = id => document.getElementById(id);

const CATS = {
  clarity:   {label: 'Clarity'},
  evidence:  {label: 'Evidence'},
  style:     {label: 'Style'},
  structure: {label: 'Structure'},
};
const HINT = 'Hover or click any highlight in your draft to see why it was flagged.';

const SAMPLE = `Should Colleges Allow AI Writing Tools?

Artificial intelligence is a very big topic in college right now. Many people think that it is good and many people think it is bad. In this essay I will talk about whether students should be allowed to use AI tools when writing.

AI tools can help students in a lot of ways. They can help with brainstorming, and they can help to check grammar, and they can suggest better words, and they can also explain things that a student does not understand yet, which means that students who use them might learn faster than students who do not. Studies show that students who get feedback improve more.

Some people say that AI is cheating. This is really a complicated issue. The rules were written by professors who may not understand the tools, and the mistake was made by the university when no clear policy was created. Obviously everyone knows that cheating is wrong.

However, equal access is a thing that matters too. Students who can afford paid tools get better feedback than students who cannot. A university-provided tool would fix this problem for everyone.

In conclusion, AI is here to stay and there are many things we should think about.`;

// ---------- API ----------
async function api(path, body) {
  const r = await fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

// Claude returns exact quotes; find each one in the draft (skipping overlaps and
// quotes that cross paragraphs) so the document can be highlighted.
function locate(text, items) {
  const used = [], out = [];
  for (const it of items) {
    const q = (it.quote || '').trim();
    if (!q || /\n\s*\n/.test(q) || !CATS[it.category]) continue;
    let i = text.indexOf(q);
    while (i !== -1 && used.some(([s, e]) => i < e && i + q.length > s)) i = text.indexOf(q, i + 1);
    if (i === -1) continue;
    used.push([i, i + q.length]);
    out.push({start: i, end: i + q.length, cat: it.category, quote: q,
      title: it.title, body: it.explanation, fix: it.suggestion});
  }
  out.sort((a, b) => a.start - b.start);
  return out.map((a, id) => ({...a, id}));
}

// Title: markdown heading or short first line; otherwise use Claude's inferred title.
function splitTitle(raw) {
  const m = raw.match(/^([^\n]*)(?:\n\s*\n|\n|$)/);
  const first = m[1].trim(), rest = raw.slice(m[0].length).trim();
  const heading = first.match(/^#{1,3}\s+(.+)$/);
  if (heading) return {title: heading[1].trim(), body: rest};
  if (rest && first.length <= 100 && first.split(/\s+/).length <= 14 && !/[.!?,;:]$/.test(first) && /^\n?\s*\n/.test(raw.slice(m[1].length)))
    return {title: first, body: rest};
  return {title: '', body: raw};
}

// ---------- State ----------
let text = '', title = '', titleInferred = false, anns = [], active = null, hidden = new Set(), chats = {}, busy = false;

// ---------- Screens ----------
function show(name) {
  ['upload', 'loading', 'review'].forEach(s => $('screen-' + s).hidden = s !== name);
  document.querySelectorAll('.steps li').forEach(li =>
    li.classList.toggle('active', li.dataset.step === (name === 'review' ? 'review' : 'upload')));
}
function showError(msg) { $('error').textContent = msg; $('error').hidden = !msg; }

// ---------- Upload ----------
$('sample').onclick = () => { $('draft').value = SAMPLE; };
$('browse').onclick = () => $('file').click();
$('file').onchange = e => readFile(e.target.files[0]);
const drop = $('drop');
['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => readFile(e.dataTransfer.files[0]));
function readFile(f) { if (f) f.text().then(t => { $('draft').value = t; }); }

$('analyze').onclick = async () => {
  const raw = $('draft').value.trim();
  showError('');
  if (!raw) { $('draft').focus(); showError('Please paste text or upload a file first.'); return; }
  const split = splitTitle(raw);
  show('loading');
  try {
    const res = await api('/api/analyze', {text: split.body, course: $('course').value, assignment: $('assignment').value});
    text = split.body;
    title = split.title || res.title || 'Untitled draft';
    titleInferred = !split.title;
    anns = locate(text, res.annotations || []);
    active = null; hidden.clear(); chats = {};
    render(); show('review');
  } catch (e) {
    show('upload'); showError(e.message);
  }
};
$('back').onclick = () => show('upload');

// ---------- Render ----------
function esc(s) { return s.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c])); }
const trunc = (s, n) => s.length > n ? s.slice(0, n - 1).trim() + '…' : s;

function render() {
  $('ctxTitle').textContent = title + (titleInferred ? ' (inferred title)' : '');
  $('ctxCourse').textContent = $('course').value;
  $('ctxAssign').textContent = $('assignment').value;
  renderDoc(); renderFilters(); renderList(); showDetail(null);
}

function renderDoc() {
  const visible = anns.filter(a => !hidden.has(a.cat));
  const paras = [], re = /\n\s*\n/g; let s = 0, m, html = '';
  while ((m = re.exec(text))) { paras.push([s, m.index]); s = m.index + m[0].length; }
  paras.push([s, text.length]);
  paras.forEach(([ps, pe]) => {
    let h = '', p = ps;
    visible.filter(a => a.start >= ps && a.end <= pe).forEach(a => {
      h += esc(text.slice(p, a.start));
      h += `<mark class="hl ${a.cat}${active === a.id ? ' active' : ''}" data-id="${a.id}" tabindex="0">${esc(text.slice(a.start, a.end))}</mark>`;
      p = a.end;
    });
    html += `<p>${h}${esc(text.slice(p, pe))}</p>`;
  });
  $('doc').innerHTML = `<h2 class="doctitle">${esc(title)}</h2>` + html;
}

function renderFilters() {
  $('filters').innerHTML = Object.entries(CATS).map(([k, v]) => {
    const n = anns.filter(a => a.cat === k).length;
    return `<button class="f ${k}${hidden.has(k) ? ' off' : ''}" data-cat="${k}">${v.label} (${n})</button>`;
  }).join('');
}

// The full list stays visible beside the document; the current item is marked.
function renderList() {
  const vis = anns.filter(a => !hidden.has(a.cat));
  $('summaryTitle').textContent = `${vis.length} spot${vis.length === 1 ? '' : 's'} to look at`;
  $('list').innerHTML = vis.map(a =>
    `<button class="item ${a.cat}${a.id === active ? ' current' : ''}" data-id="${a.id}"><b>${esc(a.title)}</b><span>“${esc(trunc(a.quote, 60))}”</span></button>`).join('')
    || '<p class="muted">No feedback in the selected categories.</p>';
}

function showDetail(id) {
  active = id;
  $('detail').hidden = id == null;
  document.querySelectorAll('mark.hl').forEach(el => el.classList.toggle('active', +el.dataset.id === id));
  renderList();
  show('review');
  if (id == null) { $('hint').textContent = HINT; return; }
  const a = anns[id];
  $('hint').textContent = 'All feedback (select another to switch):';
  $('detail').className = a.cat;
  $('dTag').className = 'tag ' + a.cat; $('dTag').textContent = CATS[a.cat].label;
  $('dQuote').textContent = a.quote;
  $('dTitle').textContent = a.title; $('dBody').textContent = a.body; $('dSuggest').textContent = a.fix;
  const vis = anns.filter(x => !hidden.has(x.cat)); $('pos').textContent = `${vis.indexOf(a) + 1} of ${vis.length}`;
  renderChat();
  $('chips').innerHTML = ['Why is this a problem?', 'Show me an example', 'How would my professor see this?']
    .map(q => `<button class="chip" type="button">${q}</button>`).join('');
  $('panel').scrollTop = 0;
}

// ---------- Interaction ----------
$('doc').addEventListener('click', e => {
  const m = e.target.closest('mark.hl');
  if (m) { showDetail(+m.dataset.id); if (innerWidth <= 860) $('panel').scrollIntoView({behavior: 'smooth'}); }
});
$('doc').addEventListener('mouseover', e => {
  const m = e.target.closest('mark.hl'); if (!m || active != null) return;
  const a = anns[+m.dataset.id]; $('hint').innerHTML = `<b>${CATS[a.cat].label}:</b> ${esc(a.title)} <em>(click for details)</em>`;
});
$('doc').addEventListener('mouseout', () => { if (active == null) $('hint').textContent = HINT; });
$('doc').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('mark.hl')) showDetail(+e.target.dataset.id); });
$('list').addEventListener('click', e => {
  const b = e.target.closest('.item'); if (!b) return;
  const id = +b.dataset.id; showDetail(id);
  document.querySelector(`mark[data-id="${id}"]`)?.scrollIntoView({behavior: 'smooth', block: 'center'});
});
$('filters').addEventListener('click', e => {
  const b = e.target.closest('.f'); if (!b) return;
  hidden.has(b.dataset.cat) ? hidden.delete(b.dataset.cat) : hidden.add(b.dataset.cat);
  if (active != null && hidden.has(anns[active].cat)) active = null;
  renderDoc(); renderFilters(); showDetail(active);
});
$('closeDetail').onclick = () => showDetail(null);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && active != null && !$('screen-review').hidden) showDetail(null);
});
function step(d) {
  const vis = anns.filter(x => !hidden.has(x.cat)); if (!vis.length) return;
  const i = (vis.indexOf(anns[active]) + d + vis.length) % vis.length;
  showDetail(vis[i].id); document.querySelector(`mark[data-id="${vis[i].id}"]`)?.scrollIntoView({behavior: 'smooth', block: 'center'});
}
$('prev').onclick = () => step(-1); $('next').onclick = () => step(1);

// ---------- Follow-up chat (Claude) ----------
function renderChat() {
  $('chat').innerHTML = (chats[active] || []).map(m => `<div class="msg ${m.who}${m.pending ? ' thinking' : ''}">${esc(m.text)}</div>`).join('');
}
async function ask(q) {
  q = q.trim();
  if (!q || active == null || busy) return;
  const id = active, a = anns[id], log = (chats[id] ||= []);
  const history = log.filter(m => !m.pending && !m.error).map(m => ({role: m.who === 'me' ? 'user' : 'assistant', content: m.text}));
  log.push({who: 'me', text: q});
  const pending = {who: 'bot', text: 'Thinking…', pending: true};
  log.push(pending); busy = true; renderChat();
  try {
    const {reply} = await api('/api/ask', {
      text, course: $('course').value, assignment: $('assignment').value,
      annotation: {category: a.cat, quote: a.quote, title: a.title, explanation: a.body, suggestion: a.fix},
      history, question: q,
    });
    Object.assign(pending, {text: reply, pending: false});
  } catch (e) {
    Object.assign(pending, {text: e.message, pending: false, error: true});
  }
  busy = false;
  if (active === id) renderChat();
}
$('askForm').onsubmit = e => { e.preventDefault(); const v = $('askInput').value; $('askInput').value = ''; ask(v); };
$('chips').addEventListener('click', e => { if (e.target.matches('.chip')) ask(e.target.textContent); });
})();
