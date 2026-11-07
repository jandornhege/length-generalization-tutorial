import { assignmentLines, expressionNode } from "./expressions.js";
import { completeProgram } from "./completion-engine.js";
import { TYPES, validateProgram, DEFAULT_ALPHABET } from './notebook-model.js';

// Quoted predicates can mention symbols absent from the current test input.
export function collectProgramSymbols(text, input = []) {
  const symbols = new Set(input);
  for (const match of text.matchAll(/"(?:[^"\\\n]|\\.)*"/g)) {
    try { symbols.add(JSON.parse(match[0])); } catch {}
  }
  return [...symbols];
}

// The guided editor deliberately shares the local evaluator's small grammar.
export function parseProgram(text, alphabet = DEFAULT_ALPHABET) {
  const nodes = [];
  for (const { index, line } of assignmentLines(text)) {
    try {
      const assignment = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=(?!=)\s*([\s\S]*?)\s*$/);
      if (!assignment) throw new Error('Use Name = expression.');
      const [, id, rhs] = assignment;
      let m, node;
      const atom = '(?:[A-Za-z][A-Za-z0-9_]*|0|"(?:[^"\\\\]|\\\\.)*")';
      const operand = value => value.startsWith('"') ? `token:${JSON.parse(value)}` : value;
      const conditional = rhs.match(new RegExp(`^\\(# \\(1 == 1\\)\\) if (${atom}) else 0$`));
      if (rhs === '1') node = { id, kind: 'constant' };
      else if (rhs === '(1 == 1)') node = { id, kind: 'true' };
      else if (conditional) node = conditional[1].startsWith('"')
        ? { id, kind: 'tokenCount', token: JSON.parse(conditional[1]), position: 'i' }
        : { id, kind: 'count', input: conditional[1], position: 'i' };
      else if ((m = rhs.match(/^(#\s*)?("(?:[^"\\]|\\.)*")$/)))
        node = { id, kind: m[1] ? 'tokenCount' : 'token', token: JSON.parse(m[2]) };
      else if ((m = rhs.match(new RegExp(`^([#!])\\s*(${atom})$`))))
        node = { id, kind: m[1] === '#' ? 'count' : 'not', input: operand(m[2]) };
      else if ((m = rhs.match(new RegExp(`^(${atom})\\s*(<=|>=|==|<|>|&&|\\|\\||\\+|-)\\s*(${atom})$`)))) {
        const kind = { '&&': 'and', '||': 'or', '+': 'add', '-': 'subtract' }[m[2]] || 'compare';
        node = { id, kind, left: operand(m[1]), right: operand(m[3]) };
        if (kind === 'compare') node.op = m[2];
      } else node = expressionNode(id, rhs, nodes, TYPES, alphabet);
      try { validateProgram([...nodes, node], alphabet); }
      catch (error) {
        node = expressionNode(id, rhs, nodes, TYPES, alphabet);
        validateProgram([...nodes, node], alphabet);
      }
      nodes.push(node);
    } catch (error) { throw new Error(`Line ${index + 1}: ${error.message}`); }
  }
  return nodes;
}

export function completions(text, cursor, alphabet = DEFAULT_ALPHABET) {
  return completeProgram(text, cursor, {
    parse: source => parseProgram(source, alphabet),
    types: TYPES,
    alphabet: alphabet,
    extended: true,
  });
}
