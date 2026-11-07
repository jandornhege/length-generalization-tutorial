import { syntaxHint, slotCompletions, existingItemCompletions } from "./syntax-hint.js";
// Native textarea editing, with a non-modal completion list anchored to the caret.
export function attachAutocomplete(editor, getCompletions, isValidProgram = () => true) {
  const shell = document.createElement('div');
  shell.className = 'code-editor';
  editor.replaceWith(shell);
  shell.append(editor);
  const gutter = document.createElement('div');
  gutter.className = 'editor-gutter';
  gutter.setAttribute('aria-hidden', 'true');
  const lineActions = document.createElement('div');
  lineActions.className = 'editor-line-actions';
  lineActions.setAttribute('aria-label', 'Line controls');
  const activeLine = document.createElement('div');
  activeLine.className = 'editor-active-line';
  activeLine.setAttribute('aria-hidden', 'true');
  const referenceMirror = document.createElement('div');
  referenceMirror.className = 'editor-reference-mirror';
  referenceMirror.setAttribute('aria-hidden', 'true');
  shell.append(activeLine, referenceMirror, gutter, lineActions);
  const popup = document.createElement('div');
  popup.className = 'code-completions';
  popup.id = `${editor.id}-completions`;
  popup.setAttribute('role', 'listbox');
  popup.setAttribute('aria-label', 'Completions');
  popup.hidden = true;
  const mirror = document.createElement('div');
  mirror.className = 'caret-mirror';
  mirror.setAttribute('aria-hidden', 'true');
  const ghost = document.createElement('div');
  ghost.className = 'syntax-ghost';
  ghost.setAttribute('aria-label', 'Click a syntax placeholder to fill it');
  ghost.hidden = true;
  shell.append(popup, mirror, ghost);
  editor.setAttribute('aria-autocomplete', 'list');
  editor.setAttribute('aria-controls', popup.id);
  let items = [], selected = -1, composing = false, suggestionsDisabled = false;
  function updateReferenceMirror() {
    referenceMirror.replaceChildren();
    const names = /"(?:[^"\\\n]|\\.)*(?:"|(?=\n|$))|[A-Za-z][A-Za-z0-9_]*/g;
    let end = 0;
    for (const match of editor.value.matchAll(names)) {
      if (match.index > end) referenceMirror.append(document.createTextNode(editor.value.slice(end, match.index)));
      const name = document.createElement('span');
      name.className = 'editor-name';
      if (match[0].startsWith('"')) {
        try { name.dataset.alphabetSymbol = JSON.parse(match[0]); } catch {}
      } else name.dataset.variableName = match[0];
      name.textContent = match[0];
      referenceMirror.append(name);
      end = match.index + match[0].length;
    }
    if (end < editor.value.length) referenceMirror.append(document.createTextNode(editor.value.slice(end)));
  }
  function clearReferenceHighlight() {
    referenceMirror.querySelectorAll('.editor-name.is-referenced').forEach(name => name.classList.remove('is-referenced'));
  }
  function highlightReferenceAt(clientX, clientY) {
    clearReferenceHighlight();
    const target = [...referenceMirror.querySelectorAll('.editor-name')].find(name => {
      const rect = name.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    });
    if (!target) return;
    const token = target.dataset.alphabetSymbol;
    if (token !== undefined) {
      referenceMirror.querySelectorAll('.editor-name').forEach(name => {
        if (name.dataset.alphabetSymbol === token) name.classList.add('is-referenced');
      });
      return;
    }
    const variable = target.dataset.variableName;
    const declaredNames = new Set([...editor.value.matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=/gm)].map(match => match[1]));
    if (!declaredNames.has(variable)) return;
    referenceMirror.querySelectorAll('.editor-name').forEach(name => {
      if (name.dataset.variableName === variable) name.classList.add('is-referenced');
    });
  }
  function hide() {
    popup.hidden = true;
    editor.removeAttribute('aria-activedescendant');
    selected = -1;
  }
  function editLines(action, index) {
    const lines = editor.value.split('\n');
    let from, to, replacement = '';
    if (action === 'add') {
      from = lines.slice(0, index + 1).join('\n').length;
      to = from;
      replacement = '\n';
    } else {
      const start = lines.slice(0, index).join('\n').length + (index ? 1 : 0);
      const end = start + lines[index].length;
      if (lines.length === 1) { from = start; to = end; }
      else if (index < lines.length - 1) { from = start; to = end + 1; }
      else { from = start - 1; to = end; }
    }
    editor.focus();
    editor.setRangeText(replacement, from, to, 'end');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function position() {
    const style = getComputedStyle(editor);
    referenceMirror.style.font = style.font;
    referenceMirror.style.lineHeight = style.lineHeight;
    referenceMirror.style.letterSpacing = style.letterSpacing;
    referenceMirror.style.padding = style.padding;
    referenceMirror.style.tabSize = style.tabSize;
    referenceMirror.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
    const isActive = document.activeElement === editor || popup.contains(document.activeElement);
    const currentLine = editor.value.slice(0, editor.selectionStart).split('\n').length;
    const lineHeight = parseFloat(style.lineHeight);
    // No soft wrapping: line numbers and the current-line marker stay aligned.
    const lines = editor.value.split('\n');
    gutter.replaceChildren(...lines.map((_, index) => {
      const number = document.createElement('span');
      number.textContent = index + 1;
      number.className = index + 1 === currentLine ? 'current' : '';
      return number;
    }));
    lineActions.replaceChildren(...Array.from({ length: lines.length + 1 }, (_, index) => {
      const row = document.createElement('div');
      row.className = `editor-line-action-row${index === lines.length ? ' is-after-last-line' : ''}`;
      row.style.top = `${parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth) + index * lineHeight - editor.scrollTop}px`;
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'editor-add-line';
      add.textContent = index === lines.length ? '+ Add line' : 'Insert line below';
      add.setAttribute('aria-label', index === lines.length ? 'Add a line after the last line' : `Insert a line below line ${index + 1}`);
      add.title = index === lines.length ? 'Add a line after the last line' : 'Insert a line below';
      add.addEventListener('pointerdown', event => event.preventDefault());
      add.addEventListener('click', () => editLines('add', index));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'editor-remove-line';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove line ${index + 1}`);
      remove.title = 'Remove this line';
      remove.addEventListener('pointerdown', event => event.preventDefault());
      remove.addEventListener('click', () => editLines('remove', index));
      row.append(add);
      if (index < lines.length) row.append(remove);
      return row;
    }));
    gutter.style.top = `${parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth) - editor.scrollTop}px`;
    activeLine.style.top = `${parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth) + (currentLine - 1) * lineHeight - editor.scrollTop}px`;
    activeLine.style.height = `${lineHeight}px`;
    activeLine.hidden = !isActive;
    const suffix = !suggestionsDisabled && !composing && (isActive || !editor.value) && editor.selectionStart === editor.selectionEnd
      ? syntaxHint(editor.value, editor.selectionStart) : '';
    // Keep each placeholder a separate hit target, retaining the inline syntax.
    if (ghost.dataset.suffix !== suffix) {
      ghost.dataset.suffix = suffix;
      ghost.replaceChildren();
      for (const part of suffix.split(/(A\d+|Name|expression|predicate|number|operator|operand|token)/)) {
        if (!part) continue;
        if (!/^(A\d+|Name|expression|predicate|number|operator|operand|token)$/.test(part)) {
          ghost.append(document.createTextNode(part));
          continue;
        }
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'syntax-slot';
        slot.textContent = part;
        slot.tabIndex = -1; // Keyboard users have the same choices via Ctrl+Space.
        slot.setAttribute('aria-label', /^A\d+$/.test(part) ? `Use suggested variable name ${part}` : `Fill ${part}`);
        slot.title = `Choose ${part}, or type your own`;
        slot.addEventListener('pointerdown', event => event.preventDefault());
        slot.addEventListener('click', () => {
          editor.focus();
          const completionSlot = /^A\d+$|^Name$/.test(part) ? 'name' : part;
          refresh(slotCompletions(editor.value, editor.selectionStart, completionSlot, getCompletions));
        });
        ghost.append(slot);
      }
    }
    ghost.hidden = !suffix;
    if (popup.hidden && ghost.hidden) return;
    for (const key of ['font', 'lineHeight', 'letterSpacing', 'padding', 'borderWidth', 'boxSizing', 'tabSize', 'wordBreak', 'overflowWrap'])
      mirror.style[key] = style[key];
    mirror.style.width = `${editor.offsetWidth}px`;
    mirror.style.whiteSpace = 'pre';
    mirror.textContent = editor.value.slice(0, editor.selectionStart);
    const caret = document.createElement('span');
    caret.textContent = editor.value.slice(editor.selectionStart) || '\u200b';
    mirror.append(caret);
    const x = caret.offsetLeft - editor.scrollLeft;
    const y = caret.offsetTop - editor.scrollTop;
    const line = parseFloat(style.lineHeight);
    if (y < 0 || y + line > editor.clientHeight) { hide(); ghost.hidden = true; return; }
    ghost.style.left = `${Math.max(x, parseFloat(style.paddingLeft))}px`;
    ghost.hidden = !suffix || x < parseFloat(style.paddingLeft);
    ghost.style.top = `${y}px`;
    ghost.style.maxWidth = `${Math.max(0, editor.clientWidth - x - parseFloat(style.paddingRight))}px`;
    ghost.style.font = style.font;
    ghost.style.lineHeight = style.lineHeight;
    ghost.style.letterSpacing = style.letterSpacing;
    if (popup.hidden) return;
    popup.style.left = `${Math.max(4, Math.min(x, shell.clientWidth - popup.offsetWidth - 4))}px`;
    const below = y + line + 3;
    const top = below + popup.offsetHeight > editor.clientHeight ? y - popup.offsetHeight - 3 : below;
    popup.style.top = `${Math.max(4, Math.min(top, editor.clientHeight - popup.offsetHeight - 4))}px`;
  }
  function accept(index) {
    const item = items[index];
    if (!item) return;
    editor.focus();
    editor.setSelectionRange(item.from, item.to);
    if (!document.execCommand('insertText', false, item.value)) {
      editor.setRangeText(item.value, item.from, item.to, 'end');
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // A deliberate selection advances the guide to the next missing operand.
    refresh();
  }
  function refresh(choices) {
    if (suggestionsDisabled) { hide(); ghost.hidden = true; return; }
    if (document.activeElement !== editor || editor.selectionStart !== editor.selectionEnd) { hide(); ghost.hidden = true; return; }
    items = Array.isArray(choices) ? choices : getCompletions();
    selected = -1;
    editor.removeAttribute('aria-activedescendant');
    popup.replaceChildren();
    items.forEach((item, index) => {
      const option = document.createElement('div');
      option.className = 'code-completion';
      option.id = `${popup.id}-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      const label = document.createElement('span');
      label.className = 'completion-label';
      label.textContent = item.label || item.value.trim();
      const detail = document.createElement('small');
      detail.textContent = item.detail || '';
      option.append(label, detail);
      option.addEventListener('pointerdown', event => { event.preventDefault(); accept(index); });
      popup.append(option);
    });
    const hint = document.createElement('div');
    hint.className = 'completion-hint';
    hint.textContent = '↑↓ choose · Tab insert · Esc dismiss';
    popup.append(hint);
    popup.hidden = !items.length;
    position();
  }
  editor.addEventListener('input', event => { if (!event.isComposing) { updateReferenceMirror(); refresh(); } });
  editor.addEventListener('compositionstart', () => { composing = true; hide(); ghost.hidden = true; });
  editor.addEventListener('compositionend', () => { composing = false; updateReferenceMirror(); refresh(); });
  editor.addEventListener('click', () => {
    if (suggestionsDisabled) return;
    const choices = existingItemCompletions(editor.value, editor.selectionStart, getCompletions, isValidProgram);
    refresh(choices || undefined);
  });
  editor.addEventListener('focus', position);
  editor.addEventListener('select', position);
  editor.addEventListener('keyup', event => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) refresh();
    else position();
  });
  editor.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
      event.preventDefault();
      if (!suggestionsDisabled) refresh();
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey && popup.hidden && !ghost.hidden) {
      items = getCompletions();
      if (items.length) {
        event.preventDefault();
        accept(0);
        return;
      }
    }
    if (popup.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); hide(); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      selected = (selected + (event.key === 'ArrowDown' ? 1 : selected === -1 ? 0 : -1) + items.length) % items.length;
      [...popup.querySelectorAll('[role=option]')].forEach((option, i) => option.setAttribute('aria-selected', String(i === selected)));
      const active = popup.children[selected];
      editor.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    } else if ((event.key === 'Tab' && !event.shiftKey) || (event.key === 'Enter' && selected >= 0)) {
      event.preventDefault(); accept(Math.max(0, selected));
    } else if (event.key === 'Enter' || event.key === 'Tab') hide();
  });
  editor.addEventListener('blur', () => { hide(); position(); });
  editor.addEventListener('scroll', position);
  editor.addEventListener('pointermove', event => {
    const style = getComputedStyle(editor);
    const lineHeight = parseFloat(style.lineHeight);
    const offset = event.clientY - editor.getBoundingClientRect().top + editor.scrollTop
      - parseFloat(style.paddingTop) - parseFloat(style.borderTopWidth);
    const index = Math.floor(offset / lineHeight);
    lineActions.querySelectorAll('.is-hovered').forEach(row => row.classList.remove('is-hovered'));
    if (index >= 0 && index <= editor.value.split('\n').length)
      lineActions.children[index]?.classList.add('is-hovered');
  });
  editor.addEventListener('pointerleave', () => lineActions.querySelectorAll('.is-hovered').forEach(row => row.classList.remove('is-hovered')));
  editor.addEventListener('pointermove', event => highlightReferenceAt(event.clientX, event.clientY));
  shell.addEventListener('pointerleave', clearReferenceHighlight);
  const resize = new ResizeObserver(() => {
    if (!shell.isConnected) resize.disconnect();
    else position();
  });
  resize.observe(editor);
  updateReferenceMirror();
  position();
  return disabled => {
    suggestionsDisabled = Boolean(disabled);
    editor.setAttribute('aria-autocomplete', suggestionsDisabled ? 'none' : 'list');
    if (suggestionsDisabled) { hide(); ghost.hidden = true; }
    else if (document.activeElement === editor) refresh();
    else position();
  };
}
