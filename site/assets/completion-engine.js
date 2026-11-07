import { parseExpression, inferExpression } from "./expressions.js";
// Cursor-aware completion for the learning editor's grammar. A completion
// replaces one token, never the rest of a line or any following assignment.
export function completeProgram(text, cursor, { parse, types, alphabet, extended = false }) {
  const lineStart = (cursor > 0 ? text.lastIndexOf('\n', cursor - 1) + 1 : 0);
  const before = text.slice(lineStart, cursor);
  const lineEnd = text.indexOf('\n', cursor);
  const after = text.slice(cursor, lineEnd < 0 ? text.length : lineEnd);
  let earlier;
  try { earlier = parse(text.slice(0, lineStart)); } catch { return []; }
  const bools = earlier.filter(n => types[n.kind] === 'bool').map(n => n.id);
  const ints = ['0', ...earlier.filter(n => types[n.kind] === 'int').map(n => n.id)];
  const names = new Set([...text.matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=/gm)].map(m => m[1]));
  const entry = (value, detail, label = value.trim()) => ({ value, label, detail });
  const tokenChoices = alphabet.map(t => entry(JSON.stringify(t), `Token predicate for ${JSON.stringify(t)}`));
  const predicateChoices = bools.map(v => entry(v, 'Earlier yes/no variable'));
  const numberChoices = ints.map(v => entry(v, v === '0' ? 'Zero' : 'Earlier number variable'));
  const predicates = [...tokenChoices, ...predicateChoices];
  const comparisons = ['<', '<=', '==', '!=', '>=', '>'];
  const comparisonStarts = [...numberChoices, entry('1', 'One'), entry('# ', 'Count true positions', '# predicate')];
  const numericStarts = [...numberChoices, entry('1', 'One'), entry('# ', 'Count a Boolean predicate', '# predicate')];
  const booleanStarts = [...predicates, entry('! ', 'Negate a predicate', '! predicate')];
  if (!before.includes('=')) {
    if (after.trim()) return [];
    if (!before.trim()) {
      let i = 1;
      while (names.has(`A${i}`)) i++;
      return [{ ...entry(`A${i} = `, 'Start an assignment; you can rename it'), from: cursor, to: cursor }];
    }
    if (/^\s*[A-Za-z][A-Za-z0-9_]*\s*$/.test(before))
      return [{ ...entry(/\s$/.test(before) ? '= ' : ' = ', 'Assign an expression'), from: cursor, to: cursor }];
    return [];
  }
  const rhsStart = lineStart + before.indexOf('=') + 1;
  const rhs = text.slice(rhsStart, cursor);
  // Keep partial words, quotes and operators so completions work during typing.
  const lex = [...rhs.matchAll(/"(?:[^"\\]|\\.)*(?:"|$)|[A-Za-z][A-Za-z0-9_]*|\d+|&&?|\|\|?|[<>]=?|!=|==?|[#!+\-()]|\S/g)]
    .map(m => ({ value: m[0], start: rhsStart + m.index, end: rhsStart + m.index + m[0].length }));
  const operatorChoices = value => {
    let isTokenPredicate = false;
    if (value.startsWith('"')) {
      try { isTokenPredicate = alphabet.includes(JSON.parse(value)); } catch {}
    }
    if (bools.includes(value) || isTokenPredicate)
      return [entry('&& ', 'Both predicates are true'), entry('|| ', 'Either predicate is true')];
    if (ints.includes(value)) return [
      entry('< ', 'Less than'), entry('<= ', 'At most'), entry('== ', 'Equal'),
      entry('>= ', 'At least'), entry('> ', 'Greater than'), entry('+ ', 'Add numbers'),
      ...(extended ? [entry('- ', 'Subtract numbers')] : []),
    ];
    return [];
  };
  const expected = consumed => {
    if (!consumed.length) return [
      ...tokenChoices, entry('# ', 'Count true positions in the prefix', '# predicate'),
      entry('! ', 'Negate a predicate', '! predicate'),
      ...predicateChoices, ...numberChoices,
      ...(extended ? [entry('1', 'Constant one')] : []),
    ];
    if (consumed.length === 1 && ['#', '!'].includes(consumed[0]))
      return consumed[0] === '#' ? [...tokenChoices, ...predicateChoices] : predicates;
    if (consumed.length === 1 && operatorChoices(consumed[0]).length) return operatorChoices(consumed[0]);
    if (consumed.length === 2 && operatorChoices(consumed[0]).some(c => c.value.trim() === consumed[1]))
      return ['&&', '||'].includes(consumed[1]) ? booleanStarts : comparisons.includes(consumed[1]) ? comparisonStarts : numericStarts;
    if (extended && consumed.join(' ') === '( # ( 1 == 1 ) ) if') return [...tokenChoices, ...predicateChoices];
    if (extended && consumed.slice(0, 9).join(' ') === '( # ( 1 == 1 ) ) if') {
      if (consumed.length === 10) return [entry('else 0', 'Otherwise zero')];
      if (consumed.length === 11 && consumed[10] === 'else') return [entry('0', 'Otherwise zero')];
    }
    const last = consumed.at(-1);
    if (last === '!') return booleanStarts;
    if (last === '#') return [...tokenChoices, ...predicateChoices];
    if (['&&', '||', 'if'].includes(last)) return booleanStarts;
    if (comparisons.includes(last)) return comparisonStarts;
    if (['+', '-', 'else'].includes(last)) return numericStarts;
    if (last === '(') {
      const contexts = [];
      consumed.forEach((token, i) => {
        if (token === '(') {
          const previous = consumed[i - 1];
          contexts.push(comparisons.includes(previous) ? 'comparison'
            : ['+', '-'].includes(previous) ? 'arithmetic'
            : ['#', '!', '&&', '||', 'if'].includes(previous) ? 'boolean'
            : contexts.at(-1) || 'any');
        } else if (token === ')') contexts.pop();
      });
      return contexts.at(-1) === 'comparison' ? comparisonStarts
        : contexts.at(-1) === 'arithmetic' ? numericStarts
        : contexts.at(-1) === 'boolean' ? booleanStarts : expected([]);
    }
    // After a composed operand, suggest operations for its inferred type.
    let start = 0, open = 0;
    const stack = [];
    consumed.forEach((value, i) => {
      if (value === '(') { stack.push(i); open++; }
      if (value === ')') { stack.pop(); open--; }
    });
    if (stack.length) start = stack.at(-1) + 1;
    // A number after &&/|| can begin the next comparison, even though the
    // entire line is not Boolean until the comparison has been completed.
    let nested = 0;
    for (let i = start; i < consumed.length; i++) {
      if (consumed[i] === '(') nested++;
      else if (consumed[i] === ')') nested--;
      else if (!nested && ['&&', '||'].includes(consumed[i])) start = i + 1;
    }
    try {
      const tree = parseExpression(consumed.slice(start).join(' '));
      const type = inferExpression(tree, new Map(earlier.map(n => [n.id, types[n.kind]])), alphabet);
      const operators = tree.family === 'boolean' || tree.family === 'predicate'
        ? [entry('&& ', 'Both predicates are true'), entry('|| ', 'Either predicate is true')]
        : tree.family === 'number' || tree.family === 'count' || tree.family === 'arithmetic'
          ? operatorChoices('0') : [];
      if (open > 0) operators.unshift(entry(')', 'Close this group'));
      return operators;
    } catch { return []; }
  };
  let from = cursor, to = cursor, choices;
  const last = lex.at(-1);
  const hasFollowingOperator = /^\s*(?:<=|>=|==|!=|&&|\|\||[<>+\-])/.test(after);
  if (last && last.end === cursor && hasFollowingOperator &&
      !['==', '!=', '<', '<=', '>', '>=', '&&', '||', '+', '-'].includes(last.value)) {
    // A completed operand is already followed by an operator. Keep that
    // operator in place; it can be changed by clicking it directly.
    choices = [];
  } else if (last && last.end === cursor && ['==', '!=', '<', '<=', '>', '>=', '&&', '||', '+', '-'].includes(last.value)) {
    // If an operand is already written after the caret, editing the operator
    // must leave it in place without offering another operand to insert.
    const hasFollowingOperand = /^\s*(?:[A-Za-z][A-Za-z0-9_]*|\d+|"(?:[^"\\]|\\.)*"|\()/.test(after);
    choices = hasFollowingOperand ? []
      : expected(lex.map(t => t.value)).map(c => ({ ...c, value: ' ' + c.value }));
  } else if (last && last.end === cursor) {
    const consumed = lex.slice(0, -1).map(t => t.value);
    choices = expected(consumed).filter(c => c.value.startsWith(last.value) && c.value.trim() !== last.value);
    if (choices.length) {
      const prefix = last.value;
      from = last.start;
      // Finish a token in the middle without leaving its old suffix behind.
      const tail = prefix.startsWith('"') ? after.match(/^(?:[^"\\]|\\.)*"?/)?.[0]
        : /^\w/.test(prefix) ? after.match(/^\w*/)?.[0] : after.match(/^[=|&]*/)?.[0];
      to = cursor + (tail?.length || 0);
    } else {
      choices = expected(lex.map(t => t.value));
      choices = choices.map(c => ({ ...c, value: ' ' + c.value }));
    }
  } else choices = expected(lex.map(t => t.value));
  return choices.map(c => ({ ...c, from, to }));
}
