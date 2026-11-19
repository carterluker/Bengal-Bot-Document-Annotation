(() => {
const $ = id => document.getElementById(id);

const CATS = {
  clarity:   {label: 'Clarity'},
  evidence:  {label: 'Evidence'},
  style:     {label: 'Style'},
  structure: {label: 'Structure'},
};

const SAMPLE = `Artificial intelligence is a very big topic in college right now. Many people think that it is good and many people think it is bad. In this essay I will talk about whether students should be allowed to use AI tools when writing.

AI tools can help students in a lot of ways. They can help with brainstorming, and they can help to check grammar, and they can suggest better words, and they can also explain things that a student does not understand yet, which means that students who use them might learn faster than students who do not. Studies show that students who get feedback improve more.

Some people say that AI is cheating. This is really a complicated issue. The rules were written by professors who may not understand the tools, and the mistake was made by the university when no clear policy was created. Obviously everyone knows that cheating is wrong.

However, equal access is a thing that matters too. Students who can afford paid tools get better feedback than students who cannot. A university-provided tool would fix this problem for everyone.

In conclusion, AI is here to stay and there are many things we should think about.`;

// ---------- Analysis engine (simulated; stands in for the real BengalBot model) ----------
const RULES = [
  {cat:'style', re:/\b(very|really|a lot of|a lot|quite|basically|obviously)\b/gi,
   title: m => `Weak or filler word: "${m}"`,
   body: 'Intensifiers and filler words add length without adding meaning, and "obviously" can sound dismissive of readers who disagree.',
   fix: 'Delete it, or replace it with a precise word or a concrete detail (e.g. a number or example).'},
  {cat:'clarity', re:/\b(things?|stuff|issue)\b/gi,
   title: m => `Vague noun: "${m}"`,
   body: 'Vague nouns make readers guess what you mean. In an argument essay, precision is part of your credibility.',
   fix: 'Name the specific thing: which policy, tool, or consequence are you talking about?'},
  {cat:'evidence', re:/[^.!?]*\b(studies show|research shows|experts say|many people (think|say)|some people say|everyone knows)\b[^.!?]*[.!?]/gi,
   title: () => 'Claim without a source',
   body: 'This sentence points to unnamed authority. Your assignment expects at least two cited sources, and readers will want to know who said this.',
   fix: 'Name the study or author, add a citation, and say what they found. If you cannot find a source, soften or cut the claim.'},
  {cat:'style', re:/[^.!?]*\b(was|were|is|are|been) (made|written|created|done)\b[^.!?]*\bby\b[^.!?]*[.!?]/gi,
   title: () => 'Passive voice hides who acts',
   body: 'Passive constructions can hide the responsible party. In an argument, naming who did what makes your claim stronger.',
   fix: 'Rewrite with the actor first: "Professors wrote the rules…" / "The university failed to create a clear policy."'},
  {cat:'structure', re:/\b(In this essay I will[^.]*\.|In conclusion,[^.]*\.)/gi,
   title: () => 'Announcement instead of argument',
   body: 'Phrases like "In this essay I will…" and "In conclusion…" describe the essay rather than make a point. Your thesis should state a position.',
   fix: 'State your position directly, e.g. "Colleges should permit AI writing tools, provided they are equitably provided and openly disclosed."'},
  {cat:'clarity', re:/[^.!?]*[.!?]/g, long:true,
   title: () => 'Very long sentence',
   body: 'This sentence strings many ideas together with "and", which makes the main point hard to find.',
   fix: 'Split it into 2–3 sentences, one idea each. Lead with your main point, then give the examples.'},
];

function analyze(text) {
  const found = [];
  let off = 0;
  text.split(/\n\s*\n/).forEach((para, pi) => {
    const start = text.indexOf(para, off); off = start + para.length;
    RULES.forEach(r => {
      r.re.lastIndex = 0; let m;
      while ((m = r.re.exec(para))) {
        if (m[0].length === 0) { r.re.lastIndex++; continue; }
        if (r.long && m[0].trim().split(/\s+/).length < 38) continue;
        const raw = m[0], lead = raw.length - raw.trimStart().length;
        found.push({start: start + m.index + lead, end: start + m.index + raw.trimEnd().length,
          cat: r.cat, title: r.title(raw.trim()), body: r.body, fix: r.fix, pi});
      }
    });
    // Short, underdeveloped paragraph
    if (para.trim().split(/\s+/).length < 30 && pi > 0 && !/^In conclusion/.test(para)) {
      found.push({start, end: start + para.length, cat:'structure', pi, title:'Underdeveloped paragraph',
        body:'This paragraph makes a claim but gives little support. Readers expect a topic sentence, evidence, and an explanation of why it matters.',
        fix:'Add one concrete example or source, then a sentence explaining how it supports your thesis.'});
    }
  });
  // Resolve overlaps: prefer earlier start, then shorter span (more specific)
  found.sort((a, b) => a.start - b.start || (a.end - a.start) - (b.end - b.start));
  const out = []; let last = -1;
  for (const f of found) if (f.start >= last) { out.push(f); last = f.end; }
  return out.map((f, i) => ({...f, id: i}));
}

// ---------- State ----------
let text = '', anns = [], active = null, hidden = new Set(), chats = {};

// ---------- Screens ----------
function show(name) {
  ['upload','loading','review'].forEach(s => $('screen-'+s).hidden = s !== name);
  const step = name === 'review' ? (active == null ? 'review' : 'ask') : 'upload';
  document.querySelectorAll('.steps li').forEach(li => {
    li.classList.toggle('active', li.dataset.step === step);
  });
}

// ---------- Upload ----------
$('sample').onclick = () => { $('draft').value = SAMPLE; };
$('browse').onclick = () => $('file').click();
$('file').onchange = e => readFile(e.target.files[0]);
const drop = $('drop');
['dragover','dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => readFile(e.dataTransfer.files[0]));
function readFile(f) { if (f) f.text().then(t => { $('draft').value = t; }); }

$('analyze').onclick = () => {
  const t = $('draft').value.trim();
  if (!t) { $('draft').focus(); $('draft').placeholder = 'Please paste text or upload a file first.'; return; }
  text = t;
  show('loading');
  const msgs = ['Checking against your assignment', 'Looking for unclear sentences', 'Checking claims for evidence', 'Marking up your draft'];
  let i = 0; const iv = setInterval(() => $('loadmsg').textContent = msgs[++i % msgs.length], 500);
  setTimeout(() => { clearInterval(iv); anns = analyze(text); active = null; hidden.clear(); chats = {}; render(); show('review'); }, 1800);
};
$('back').onclick = () => show('upload');

// ---------- Render ----------
function esc(s) { return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

function render() {
  $('ctxCourse').textContent = $('course').value;
  $('ctxAssign').textContent = $('assignment').value;
  renderDoc(); renderFilters(); renderList(); showDetail(null);
}

function renderDoc() {
  let html = '', pos = 0;
  const visible = anns.filter(a => !hidden.has(a.cat));
  const paras = [], re = /\n\s*\n/g; let s = 0, m;
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
  $('doc').innerHTML = html;
}

function renderFilters() {
  $('filters').innerHTML = Object.entries(CATS).map(([k, v]) => {
    const n = anns.filter(a => a.cat === k).length;
    return `<button class="f ${k}${hidden.has(k) ? ' off' : ''}" data-cat="${k}">${v.label} (${n})</button>`;
  }).join('');
}

function renderList() {
  $('summaryTitle').textContent = `${anns.length} spots to look at`;
  $('summary').innerHTML = '';
  $('list').innerHTML = anns.filter(a => !hidden.has(a.cat)).map(a =>
    `<button class="item ${a.cat}" data-id="${a.id}"><b>${esc(a.title)}</b><span>“${esc(trunc(text.slice(a.start, a.end), 60))}”</span></button>`).join('');
}
const trunc = (s, n) => s.length > n ? s.slice(0, n - 1).trim() + '…' : s;

function showDetail(id) {
  active = id;
  $('empty').hidden = id != null; $('detail').hidden = id == null;
  document.querySelectorAll('mark.hl').forEach(el => el.classList.toggle('active', +el.dataset.id === id));
  show('review');
  if (id == null) return;
  const a = anns[id];
  $('detail').className = a.cat;
  $('dTag').className = 'tag ' + a.cat; $('dTag').textContent = CATS[a.cat].label;
  $('dQuote').textContent = text.slice(a.start, a.end);
  $('dTitle').textContent = a.title; $('dBody').textContent = a.body; $('dSuggest').textContent = a.fix;
  const vis = anns.filter(x => !hidden.has(x.cat)); $('pos').textContent = `${vis.indexOf(a) + 1} of ${vis.length}`;
  renderChat();
  $('chips').innerHTML = ['Why is this a problem?', 'Show me an example', 'How would my professor see this?']
    .map(q => `<button class="chip" type="button">${q}</button>`).join('');
}

// ---------- Interaction ----------
$('doc').addEventListener('click', e => { const m = e.target.closest('mark.hl'); if (m) { showDetail(+m.dataset.id); scrollPanel(); } });
$('doc').addEventListener('mouseover', e => {
  const m = e.target.closest('mark.hl'); if (!m || active != null) return;
  const a = anns[+m.dataset.id]; $('empty').querySelector('.muted').innerHTML = `<b>${CATS[a.cat].label}:</b> ${esc(a.title)} <em>(click for details)</em>`;
});
$('doc').addEventListener('mouseout', () => { $('empty').querySelector('.muted').textContent = 'Hover or click any highlight in your draft to see why it was flagged.'; });
$('doc').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('mark.hl')) showDetail(+e.target.dataset.id); });
$('list').addEventListener('click', e => {
  const b = e.target.closest('.item'); if (!b) return;
  const id = +b.dataset.id; showDetail(id);
  document.querySelector(`mark[data-id="${id}"]`)?.scrollIntoView({behavior:'smooth', block:'center'});
});
$('filters').addEventListener('click', e => {
  const b = e.target.closest('.f'); if (!b) return;
  hidden.has(b.dataset.cat) ? hidden.delete(b.dataset.cat) : hidden.add(b.dataset.cat);
  if (active != null && hidden.has(anns[active].cat)) active = null;
  renderDoc(); renderFilters(); renderList(); showDetail(active);
});
$('closeDetail').onclick = () => showDetail(null);
function step(d) {
  const vis = anns.filter(x => !hidden.has(x.cat)); if (!vis.length) return;
  const i = (vis.indexOf(anns[active]) + d + vis.length) % vis.length;
  showDetail(vis[i].id); document.querySelector(`mark[data-id="${vis[i].id}"]`)?.scrollIntoView({behavior:'smooth', block:'center'});
}
$('prev').onclick = () => step(-1); $('next').onclick = () => step(1);
function scrollPanel() { if (innerWidth <= 860) $('panel').scrollIntoView({behavior:'smooth'}); }

// ---------- Follow-up chat (simulated replies) ----------
function renderChat() {
  $('chat').innerHTML = (chats[active] || []).map(m => `<div class="msg ${m.who}">${esc(m.text)}</div>`).join('');
}
function ask(q) {
  if (!q.trim() || active == null) return;
  const id = active, a = anns[id];
  (chats[id] ||= []).push({who:'me', text:q}); renderChat();
  setTimeout(() => {
    chats[id].push({who:'bot', text: reply(q, a)});
    if (active === id) renderChat();
  }, 600);
}
function reply(q, a) {
  const s = q.toLowerCase(), c = a.cat, quote = text.slice(a.start, a.end);
  const ctx = `For "${$('assignment').value}", `;
  if (/example|show|rewrite|how (do|would|can)/.test(s)) {
    const ex = {
      clarity: 'Try leading with the main idea: "AI tools support learning in three ways: brainstorming, grammar checking, and explanation." Then give one sentence per way.',
      evidence: 'For instance: "A 2023 study by Smith and Lee found that students who received weekly feedback improved their scores by 12% (Smith & Lee, 2023)."',
      style: 'Swap the weak phrase for something concrete, e.g. "very big topic" → "a contested topic on nearly every campus."',
      structure: 'A stronger version: "Colleges should allow AI writing tools, but only when every student has equal access and use is disclosed."',
    }[c];
    return ex + ' (Demo reply – the real BengalBot would tailor this to your exact wording.)';
  }
  if (/professor|grade|instructor|rubric/.test(s))
    return `${ctx}your rubric likely rewards ${c === 'evidence' ? 'cited, credible support' : c === 'structure' ? 'a clear, arguable thesis and organization' : c === 'clarity' ? 'precise, readable prose' : 'a confident, formal academic voice'}. This highlight could cost points there.`;
  if (/why|problem|wrong|mean/.test(s))
    return `You wrote "${trunc(quote, 70)}". ${a.body} It matters most to a reader skimming for your argument.`;
  return `Good question. About this highlight (${CATS[a.cat].label.toLowerCase()}): ${a.fix} Want me to show an example rewrite?`;
}
$('askForm').onsubmit = e => { e.preventDefault(); ask($('askInput').value); $('askInput').value = ''; };
$('chips').addEventListener('click', e => { if (e.target.matches('.chip')) ask(e.target.textContent); });
})();
