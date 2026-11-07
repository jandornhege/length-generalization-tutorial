// Display-only suffixes: these placeholders never become part of the source.
export function syntaxHint(text, cursor) {
  const end = text.indexOf('\n', cursor);
  if (text.slice(cursor, end < 0 ? text.length : end).trim()) return '';
  const line = text.slice((cursor > 0 ? text.lastIndexOf('\n', cursor - 1) + 1 : 0), cursor);
  const gap = /\s$/.test(line) ? '' : ' ';
  if (!line.trim()) {
    const used = new Set([...text.matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=/gm)].map(match => match[1]));
    let index = 1;
    while (used.has(`A${index}`)) index++;
    return `A${index} = expression`;
  }
  if (/^\s*[A-Za-z][A-Za-z0-9_]*\s*$/.test(line)) return `${gap}= expression`;
  const assignment = line.match(/^\s*[A-Za-z][A-Za-z0-9_]*\s*=\s*(.*)$/);
  if (!assignment) return '';
  const rhs = assignment[1];
  if (!rhs) return `${gap}expression`;
  if (/[#!]\s*$/.test(rhs)) return `${gap}predicate`;
  if (/\(\s*$/.test(rhs)) return `${gap}expression)`;
  if (/(&&|\|\|)\s*$/.test(rhs)) return `${gap}predicate`;
  if (/(<=|>=|==|!=|<|>|\+|-)\s*$/.test(rhs)) return `${gap}number`;
  if (/^(#\s*)?"$/.test(rhs)) return 'token"';
  if (/\bif\s*$/.test(rhs)) return `${gap}predicate else 0`;
  if (/\belse\s*$/.test(rhs)) return `${gap}0`;
  if (/^[A-Za-z][A-Za-z0-9_]*\s*$/.test(rhs)) return `${gap}operator operand`;
  return '';
}

// Clicking the expression slot may skip the name slot. Offer a fresh name as
// part of the completion, but do not modify the source until a choice is made.
export function slotCompletions(text, cursor, slot, complete) {
  let ordinary = complete(text, cursor);
  if (slot === 'name') {
    return ordinary.flatMap(item => {
      const match = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*$/.exec(item.value);
      return match ? [{ ...item, value: match[1], label: match[1], detail: 'Suggested variable name' }] : [];
    });
  } else if (slot === 'predicate') {
    ordinary = ordinary.filter(item =>
      /^(Token (?:is |predicate)|Earlier yes\/no variable|Negate a predicate)/.test(item.detail || '') ||
      /^(#?\s*)?"/.test(item.value) || /^!\s*/.test(item.value));
  } else if (slot === 'number') {
    ordinary = ordinary.filter(item =>
      /^(Zero|Earlier number variable|One|Count true positions)/.test(item.detail || '') ||
      /^(?:\d|#\s)/.test(item.value));
  } else if (slot === 'token') {
    ordinary = ordinary.filter(item => /^Token (?:is |predicate)/.test(item.detail || ''));
  } else if (slot === 'operator') {
    ordinary = ordinary.filter(item => /^(Both predicates|Either predicate|Less than|At most|Equal|At least|Greater than|Add numbers|Subtract numbers)/.test(item.detail || ''));
  }
  if (slot !== 'expression') return ordinary;
  const line = text.slice((cursor > 0 ? text.lastIndexOf('\n', cursor - 1) + 1 : 0), cursor);
  if (line.includes('=')) return ordinary;
  const assignment = ordinary.find(item => /\s*=\s*$/.test(item.value));
  if (!assignment) return ordinary;
  const virtual = text.slice(0, assignment.from) + assignment.value + text.slice(assignment.to);
  const next = assignment.from + assignment.value.length;
  return complete(virtual, next).map(item => ({
    ...item,
    from: assignment.from,
    to: assignment.to,
    value: assignment.value + item.value,
  }));
}

// Turn an already-written item into a temporary completion slot. Suggestions
// replace only that item, so the rest of the line stays intact.
export function existingItemCompletions(text, cursor, complete, isValid = () => true) {
  const start = text.lastIndexOf('\n', cursor - 1) + 1;
  const endAt = text.indexOf('\n', cursor);
  const end = endAt < 0 ? text.length : endAt;
  const line = text.slice(start, end);
  const rhsOffset = line.indexOf('=');
  if (rhsOffset < 0) return null;
  const rhsStart = start + rhsOffset + 1;
  const rhs = text.slice(rhsStart, end);
  const tokens = [...rhs.matchAll(/"(?:[^"\\]|\\.)*"|[A-Za-z][A-Za-z0-9_]*|\d+|&&|\|\||<=|>=|==|!=|[#!()+<>+\-]/g)]
    .map(match => ({ value: match[0], from: rhsStart + match.index, to: rhsStart + match.index + match[0].length }));
  const item = tokens.find(token => cursor >= token.from && cursor <= token.to);
  if (!item) return null;
  const blank = text.slice(0, item.from) + text.slice(item.to);
  let choices = complete(blank, item.from).filter(choice => choice.value.trim());
  const value = item.value;
  if (/^"/.test(value)) choices = choices.filter(choice => /^Token (?:is |predicate)/.test(choice.detail || ''));
  else if (/^[A-Za-z]/.test(value)) {
    const declarations = new Map();
    for (const previous of text.slice(0, start).split('\n')) {
      const assignment = previous.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!assignment) continue;
      const [, name, rhs] = assignment;
      const referenced = rhs.match(/^[#!]?\s*([A-Za-z][A-Za-z0-9_]*)$/)?.[1];
      const type = /^#/.test(rhs) || /^\d+$/.test(rhs) || /[+\-]/.test(rhs) ? 'int'
        : /&&|\|\||!|==|!=|<=|>=|[<>]/.test(rhs) || /^"/.test(rhs) ? 'bool'
        : declarations.get(referenced) || 'bool';
      declarations.set(name, type);
    }
    const type = declarations.get(value);
    if (type === 'bool') choices = choices.filter(choice =>
      /^(Token (?:is |predicate)|Earlier yes\/no variable|Negate a predicate|Group a Boolean)/.test(choice.detail || '') ||
      /^"|^(?:!\s*|\()/.test(choice.value));
    else if (type === 'int') choices = choices.filter(choice =>
      /^(Zero|Earlier number variable|One|Count true positions|Group a number)/.test(choice.detail || '') ||
      /^(?:\d|#\s|\()/.test(choice.value));
  }
  return choices
    .map(choice => ({
      ...choice,
      // Completion strings include spacing for insertion at an empty caret.
      // Replacing an existing punctuation token must preserve its neighbors.
      value: /^[!#&|=<>+\-]+$/.test(value) ? choice.value.trim() : choice.value,
      from: item.from,
      to: item.to,
    }))
    .filter(choice => {
      const candidate = text.slice(0, choice.from) + choice.value + text.slice(choice.to);
      return isValid(candidate);
    });
}
