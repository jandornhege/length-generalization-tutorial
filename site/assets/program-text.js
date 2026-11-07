import { assignmentLines, expressionNode } from "./expressions.js";
import { completeProgram } from "./completion-engine.js";
import { TYPES, validateProgram } from './notebook-model.js';

// Quoted predicates can mention symbols absent from the current test input.
export function collectProgramSymbols(text, input = []) {
  const symbols = new Set(input);
  for (const match of text.matchAll(/"(?:[^"\\\n]|\\.)*"/g)) {
    try { symbols.add(JSON.parse(match[0])); } catch {}
  }
  return [...symbols];
}

// The guided editor deliberately shares the local evaluator's small grammar.
export function parseProgram(text, alphabet = ['a', 'b', '(', ')']) {
  const nodes = [];
  for (const { index, line } of assignmentLines(text)) {
    try {
      const assignment = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=(?!=)\s*([\s\S]*?)\s*$/);
      if (!assignment) throw new Error('Use Name = expression.');
      const [, id, rhs] = assignment;
      let m, node;
      if ((m = rhs.match(/^(#\s*)?("(?:[^"\\]|\\.)*")$/))) {
        let token;
        try { token = JSON.parse(m[2]); } catch { throw new Error('Use a quoted token.'); }
        node = { id, kind: m[1] ? 'tokenCount' : 'token', token };
      }
      else if ((m = rhs.match(/^([#!])\s*([A-Za-z][A-Za-z0-9_]*)$/)))
        node = { id, kind: m[1] === '#' ? 'count' : 'not', input: m[2] };
      else if ((m = rhs.match(/^([A-Za-z][A-Za-z0-9_]*|0)\s*(<=|>=|==|<|>|&&|\|\||\+)\s*([A-Za-z][A-Za-z0-9_]*|0)$/))) {
        const kind = { '&&': 'and', '||': 'or', '+': 'add' }[m[2]] || 'compare';
        node = { id, kind, left: m[1], right: m[3] };
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

export function completions(text, cursor, alphabet = ['a', 'b', '(', ')']) {
  return completeProgram(text, cursor, {
    parse: source => parseProgram(source, alphabet),
    types: TYPES,
    alphabet,
    extended: false,
  });
}
