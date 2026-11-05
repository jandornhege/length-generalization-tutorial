import { TYPES, validateProgram, DEFAULT_ALPHABET, isTokenOperand } from "./notebook-model.js";

// Execute the typed block model directly. No parser, network, worker, or eval().
// The public editor has at most 24 blocks and 16 tokens. Arithmetic is checked
// rather than silently accepting loss of integer precision.
export function evaluateBlocks(nodes, tokens, output, alphabet = DEFAULT_ALPHABET) {
  validateProgram(nodes, alphabet);
  if (
    !Array.isArray(tokens) ||
    tokens.length < 1 ||
    tokens.length > 16 ||
    tokens.some((t) => !alphabet.includes(t))
  )
    throw new Error("Use 1–16 tokens from the selected alphabet.");
  if (output && !nodes.some((n) => n.id === output && TYPES[n.kind] === "bool"))
    throw new Error("Choose a yes/no output.");
  const env = new Map(),
    rows = [];
  const at = (name, i) => (name === "0" ? 0 : isTokenOperand(name) ? tokens[i] === name.slice(6) : env.get(name)[i]);
  for (const n of nodes) {
    let total = 0;
    const values = tokens.map((token, i) => {
      switch (n.kind) {
        case "token":
          return token === n.token;
        case "tokenCount":
          if (n.position === "i") return (i + 1) * Number(token === n.token);
          total += Number(token === n.token);
          return total;
        case "count":
          if (n.position === "i") return (i + 1) * Number(at(n.input, i));
          total += Number(at(n.input, i));
          return total;
        case "not":
          return !at(n.input, i);
        case "and":
          return at(n.left, i) && at(n.right, i);
        case "or":
          return at(n.left, i) || at(n.right, i);
        case "constant":
          return 1;
        case "true":
          return true;
        case "add":
        case "subtract": {
          const sum = n.kind === "add" ? at(n.left, i) + at(n.right, i) : at(n.left, i) - at(n.right, i);
          if (!Number.isSafeInteger(sum))
            throw new Error("This value exceeds the exact integer range of this learning editor.");
          return sum;
        }
        case "compare": {
          const left = at(n.left, i),
            right = at(n.right, i);
          switch (n.op) {
            case "<":
              return left < right;
            case "<=":
              return left <= right;
            case "==":
              return left === right;
            case ">=":
              return left >= right;
            case ">":
              return left > right;
          }
        }
      }
    });
    env.set(n.id, values);
    rows.push({ name: n.id, values });
  }
  const result = output ? env.get(output) : tokens.map(() => true);
  rows.push({ name: "Result", values: [...result] });
  return {
    tokens: [...tokens],
    rows,
    accepted: result.at(-1),
    engine: "typed-block-evaluator",
    index_base: 0,
  };
}
