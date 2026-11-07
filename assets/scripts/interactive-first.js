// Build a chapter overview from the canonical shared manuscript.
const article = document.getElementById('article');
const chapters = [];
let body;
for (const node of [...article.childNodes]) {
  if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'H2') {
    const topic = document.createElement('details');
    topic.className = 'background-topic';
    const title = node.textContent.trim();
    topic.id = `chapter-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const summary = document.createElement('summary');
    body = document.createElement('div');
    body.className = 'background-body';
    topic.append(summary, body);
    article.insertBefore(topic, node);
    chapters.push({ topic, summary, body, title });
    // Preserve heading targets so internal cross-references keep working.
    node.hidden = true;
  }
  if (body) body.append(node);
}
function chapterText(className, text) {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  return element;
}
for (const [index, chapter] of chapters.entries()) {
  const { topic, summary, body, title } = chapter;
  const number = chapterText('chapter-number', String(index + 1).padStart(2, '0'));
  number.setAttribute('aria-hidden', 'true');
  const toggle = chapterText('chapter-toggle', '+');
  toggle.setAttribute('aria-hidden', 'true');
  summary.append(number, chapterText('chapter-title', title), toggle);
  const lead = body.querySelector('.chapter-lead');
  if (lead) summary.append(chapterText('chapter-description', lead.textContent.trim()));
  const sections = [...body.querySelectorAll('h3')];
  if (sections.length) {
    const preview = chapterText('chapter-contents', '');
    sections.slice(0, 3).forEach(section => preview.append(chapterText('chapter-tag', section.textContent.trim())));
    if (sections.length > 3) preview.append(chapterText('chapter-more', `+${sections.length - 3} topics`));
    summary.append(preview);
    const navigation = document.createElement('nav');
    navigation.className = 'chapter-navigation';
    navigation.setAttribute('aria-label', `${title}: sections`);
    const label = document.createElement('p');
    label.textContent = 'In this chapter';
    const links = document.createElement('ul');
    sections.forEach((section, sectionIndex) => {
      if (!section.id) section.id = `${topic.id}-section-${sectionIndex + 1}`;
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${section.id}`;
      link.textContent = section.textContent.trim();
      item.append(link);
      links.append(item);
    });
    navigation.append(label, links);
    body.prepend(navigation);
  }
  topic.addEventListener('toggle', () => {
    toggle.textContent = topic.open ? '−' : '+';
    updateOverviewState();
  });
  summary.addEventListener('click', () => {
    if (!topic.open) requestAnimationFrame(() => {
      updateOverviewState();
      summary.scrollIntoView({ block: 'start' });
    });
  });
}
const overviewButton = document.getElementById('background-toggle-all');
document.getElementById('chapter-count').textContent = `${chapters.length} chapters`;
function updateOverviewState() {
  const expanded = chapters.some(({ topic }) => topic.open);
  overviewButton.textContent = expanded ? 'Back to overview' : 'Expand all';
  overviewButton.setAttribute('aria-expanded', String(expanded));
}
overviewButton.addEventListener('click', () => {
  const expand = !chapters.some(({ topic }) => topic.open);
  chapters.forEach(({ topic }) => { topic.open = expand; });
  updateOverviewState();
  if (!expand) {
    history.replaceState(null, '', '#background');
    document.getElementById('background-title').scrollIntoView({ block: 'start' });
  }
});
updateOverviewState();
function revealFragment() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (!target) return;
  if (id === 'background') chapters.forEach(({ topic }) => { topic.open = false; });
  for (let p = target; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
  updateOverviewState();
  const visibleTarget = target.hidden ? target.closest('.background-topic')?.querySelector('summary') || target.parentElement : target;
  visibleTarget.scrollIntoView({ block: 'start' });
}
addEventListener('hashchange', revealFragment);
revealFragment();
const frame = document.getElementById('lab-frame');
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
  const shell = doc?.querySelector('.notebook-shell');
  if (!shell || doc.getElementById('lab-embed-style')) return;
  const style = doc.createElement('style');
  style.id = 'lab-embed-style';
  style.textContent = `body.notebook-page{min-width:0;margin:0;background:#fff}
    html[data-embed] .notebook-shell{width:100%;max-width:none;margin:0;padding:12px}
    html[data-embed] .experiment{padding:0;border:0;margin:0}
    .experiment-heading,.mode-description,.runtime-bar,.code-actions,
    .code-actions+p,#result-intro{display:none!important}
    .result-header{margin-top:0}
    @media(max-width:550px){html[data-embed] .notebook-shell{padding:8px}}`;
  doc.head.append(style);
  const status = doc.getElementById('runtime-status');
  const statusBar = status.closest('.runtime-bar');
  const updateStatus = () => {
    const normal = status.textContent.startsWith('Live values');
    statusBar.style.setProperty('display', normal ? 'none' : 'block', 'important');
  };
  new MutationObserver(updateStatus).observe(status, {childList: true, characterData: true, subtree: true});
  updateStatus();
  sizeFrame(frame, shell);
}
frame.addEventListener('load', prepareFrame);
if (frame.contentDocument?.readyState === 'complete') prepareFrame();
addEventListener('beforeprint', () => document.querySelectorAll('details').forEach(d => {
  d.dataset.printOpen = String(d.open); d.open = true;
}));
addEventListener('afterprint', () => document.querySelectorAll('details').forEach(d => {
  d.open = d.dataset.printOpen === 'true';
}));
