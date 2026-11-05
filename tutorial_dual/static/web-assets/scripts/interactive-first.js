// Keep the canonical manuscript intact, presented as optional background topics.
const article = document.getElementById('article');
let body;
for (const node of [...article.childNodes]) {
  if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'H2') {
    const topic = document.createElement('details');
    topic.className = 'background-topic';
    const summary = document.createElement('summary');
    summary.textContent = node.textContent;
    body = document.createElement('div');
    body.className = 'background-body';
    topic.append(summary, body);
    article.insertBefore(topic, node);
    // Preserve heading targets so internal cross-references keep working.
    node.hidden = true;
  }
  if (body) body.append(node);
}
function revealFragment() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (!target) return;
  for (let p = target; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
  (target.hidden ? target.parentElement : target).scrollIntoView({ block: 'start' });
}
addEventListener('hashchange', revealFragment);
revealFragment();
const frame = document.getElementById('lab-frame');
const editorFrame = document.getElementById('editor-frame');
const modeButtons = [...document.querySelectorAll('[data-lab-mode]')];
let pendingMode = 'walk';
function selectMode(mode) {
  pendingMode = mode;
  const editing = mode === 'editor';
  frame.hidden = editing;
  editorFrame.hidden = !editing;
  if (editing) {
    if (!editorFrame.getAttribute('src')) editorFrame.src = editorFrame.dataset.src;
  } else {
    const doc = frame.contentDocument;
    if (doc?.documentElement.dataset.labMode !== mode) doc?.querySelector(`[data-mode="${mode}"]`)?.click();
    if (doc) doc.documentElement.dataset.labMode = mode;
  }
  modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.labMode === mode)));
}
modeButtons.forEach(button => button.addEventListener('click', () => selectMode(button.dataset.labMode)));
function sizeFrame(target, element) {
  const resize = () => {
    if (target.hidden) return;
    const height = Math.ceil(element.getBoundingClientRect().height) + 16;
    if (target.height !== String(height)) target.height = String(height);
  };
  new ResizeObserver(resize).observe(element);
  resize();
}
function prepareFrame() {
  const doc = frame.contentDocument;
  if (!doc || !doc.getElementById('mode-nav') || doc.getElementById('lab-embed-style')) return;
  const style = doc.createElement('style');
  style.id = 'lab-embed-style';
  style.textContent = `body.notebook-page{min-width:0;margin:0;background:#fff}
    body>header,.skip,.notebook-intro,.design-notes,.mode-nav{display:none!important}
    .notebook-shell{width:100%;max-width:none;margin:0;padding:16px}
    .experiment{padding:8px;border:0;margin:0}.experiment-heading h2{font-size:1.5rem}
    #mode-kicker,#mode-title,#reset-design,.mode-description,.runtime-bar,
    #toggle-code,.code-actions+p,#result-intro,#input-area .small,.drag-help,
    #mode-workspace>.toolbar>button:nth-child(2){display:none!important}
    .experiment-heading{display:none}
    .code-actions{margin-top:16px}
    html[data-lab-mode=walk] .code-actions{display:none}
    html[data-lab-mode=build] #values,html[data-lab-mode=build] #inspection,
    html[data-lab-mode=build] #result-heading{display:none}
    #mode-workspace>.toolbar{margin-bottom:16px}
    .result-header{margin-top:12px}
    @media(max-width:550px){.notebook-shell{padding:10px}.experiment-heading{flex-wrap:wrap}}`;
  doc.head.append(style);
  const status = doc.getElementById('runtime-status');
  const statusBar = status.closest('.runtime-bar');
  const updateStatus = () => {
    const normal = status.textContent.startsWith('Live values');
    statusBar.style.setProperty('display', normal ? 'none' : 'block', 'important');
  };
  new MutationObserver(updateStatus).observe(status, {childList: true, characterData: true, subtree: true});
  updateStatus();
  if (pendingMode !== 'editor') selectMode(pendingMode);
  sizeFrame(frame, doc.querySelector('.notebook-shell'));
  const editorButton = doc.getElementById('open-editor');
  if (editorButton) editorButton.textContent = 'Edit this program →';
  if (editorButton) editorButton.onclick = () => {
    const source = doc.getElementById('source-code').textContent;
    const tokens = [...doc.querySelectorAll('#input-area [data-position]')]
      .map(x => x.getAttribute('aria-label').match(/token (.+) at position/)[1]).join(' ');
    const url = new URL(editorFrame.dataset.src, location.href);
    url.hash = 'program=' + encodeURIComponent(JSON.stringify({ source, tokens }));
    editorFrame.src = url.href;
    selectMode('editor');
  };
}
function prepareEditor() {
  const doc = editorFrame.contentDocument;
  if (!doc?.getElementById('program') || doc.getElementById('lab-editor-style')) return;
  const style = doc.createElement('style');
  style.id = 'lab-editor-style';
  style.textContent = `body{margin:0;background:white;min-width:0}
    body>header,footer,#playground>.section-number,#playground>h2,#playground>p,#playground>.explanation{display:none!important}
    body>main{width:100%;max-width:none!important;padding:16px!important}
    #playground{padding:0;border:0}.lab{margin:0}.code-grid{grid-template-columns:1fr}
    .lab-body{padding:16px}textarea{min-height:240px}
    .lab-head,#share,#download-trace,#reset,#example-guide,
    [aria-label="Suggested inputs"],.code-grid>div:nth-child(2),
    .trace-nav,#row-explanation,#cell-note,.lab-body>h3,.lab-body>h3+p{display:none!important}
    @media(max-width:550px){body>main{padding:8px!important}.lab-body{padding:8px}}`;
  doc.head.append(style);
  const status = doc.getElementById('engine-status');
  const conciseStatus = () => {
    const text = status.textContent;
    if (text.startsWith('Showing a saved trace')) status.textContent = 'Example output. Run to evaluate your edits.';
    else if (text === 'Evaluated by the pinned Python interpreter.') status.textContent = 'Run complete.';
    else if (text.startsWith('Loading Python')) status.textContent = 'Loading interpreter…';
  };
  new MutationObserver(conciseStatus).observe(status, {childList: true, characterData: true, subtree: true});
  conciseStatus();
  sizeFrame(editorFrame, doc.querySelector('main'));
}
frame.addEventListener('load', prepareFrame);
editorFrame.addEventListener('load', prepareEditor);
if (frame.contentDocument?.readyState === 'complete') prepareFrame();
addEventListener('beforeprint', () => document.querySelectorAll('details').forEach(d => {
  d.dataset.printOpen = String(d.open); d.open = true;
}));
addEventListener('afterprint', () => document.querySelectorAll('details').forEach(d => {
  d.open = d.dataset.printOpen === 'true';
}));
