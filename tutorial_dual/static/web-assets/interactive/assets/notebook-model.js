export const DEFAULT_ALPHABET = ['a', 'b', '(', ')'];
export function validateAlphabet(alphabet) {
  if (!Array.isArray(alphabet) || !alphabet.length || alphabet.length > 16 ||
      new Set(alphabet).size !== alphabet.length ||
      alphabet.some(t => typeof t !== 'string' || !t.length || t.length > 32 || /\s/.test(t)))
    throw new Error('Use 1–16 distinct symbols, separated by spaces (up to 32 characters each).');
  return alphabet;
}
// A small typed subset of C-RASP for the visual editor. This compiles syntax;
// all vector evaluation is performed by the original Python interpreter.
export const TYPES = {
  token: "bool",
  tokenCount: "int",
  count: "int",
  compare: "bool",
  and: "bool",
  or: "bool",
  not: "bool",
  add: "int",
  subtract: "int",
  constant: "int",
  true: "bool",
};
export const DYCK = [
  { id: "Opens", kind: "tokenCount", token: "(" },
  { id: "Closes", kind: "tokenCount", token: ")" },
  { id: "Violation", kind: "compare", left: "Opens", op: "<", right: "Closes" },
  { id: "Violations", kind: "count", input: "Violation" },
  { id: "Safe", kind: "compare", left: "Violations", op: "==", right: "0" },
  { id: "Balanced", kind: "compare", left: "Opens", op: "==", right: "Closes" },
  { id: "Accept", kind: "and", left: "Safe", right: "Balanced" },
];
export const CONTAINS = [
  { id: "A1", kind: "token", token: "a" },
  { id: "A2", kind: "count", input: "A1" },
  { id: "A3", kind: "compare", left: "A2", op: ">", right: "0" },
];
export const isTokenOperand = value => typeof value === "string" && value.startsWith("token:");
const operandSource = value => isTokenOperand(value) ? JSON.stringify(value.slice(6)) : value;

export function references(node) {
  if (node.kind === "count" || node.kind === "not") return isTokenOperand(node.input) ? [] : [node.input];
  if (["compare", "and", "or", "add", "subtract"].includes(node.kind))
    return [node.left, node.right].filter((x) => x !== "0" && !isTokenOperand(x));
  return [];
}
export function validateProgram(nodes, alphabet = DEFAULT_ALPHABET) {
  validateAlphabet(alphabet);
  if (nodes.length > 24) throw new Error("This learning editor supports up to 24 blocks.");
  const seen = new Map();
  const need = (id, type) => {
    if (id === "0" && type === "int") return;
    if (type === "bool" && isTokenOperand(id) && alphabet.includes(id.slice(6))) return;
    if (seen.get(id) !== type)
      throw new Error(
        `Choose an earlier ${type === "bool" ? "yes/no" : "number"} variable for ${id}.`,
      );
  };
  for (const n of nodes) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(n.id) || n.id === "Result" || seen.has(n.id))
      throw new Error("Variable names must be unique and valid.");
    if (!Object.hasOwn(TYPES, n.kind)) throw new Error("Unknown block.");
    if (["token", "tokenCount"].includes(n.kind) && !alphabet.includes(n.token))
      throw new Error("Choose a supported token.");
    if (["count", "tokenCount"].includes(n.kind) && n.position !== undefined && !["i", "j"].includes(n.position))
      throw new Error("Choose position i or j.");
    if (n.kind === "count" || n.kind === "not") need(n.input, "bool");
    if (["compare", "add", "subtract"].includes(n.kind)) {
      need(n.left, "int");
      need(n.right, "int");
    }
    if (["and", "or"].includes(n.kind)) {
      need(n.left, "bool");
      need(n.right, "bool");
    }
    if (n.kind === "compare" && !["<", "<=", "==", ">=", ">"].includes(n.op))
      throw new Error("Choose a comparison.");
    seen.set(n.id, TYPES[n.kind]);
  }
  return true;
}
export function expression(n) {
  switch (n.kind) {
    case "token":
      return JSON.stringify(n.token);
    case "tokenCount":
      return n.position === "i" ? `(# (1 == 1)) if ${JSON.stringify(n.token)} else 0` : `# ${JSON.stringify(n.token)}`;
    case "count":
      return n.position === "i" ? `(# (1 == 1)) if ${operandSource(n.input)} else 0` : `# ${operandSource(n.input)}`;
    case "not":
      return `! ${operandSource(n.input)}`;
    case "compare":
      return `${n.left} ${n.op} ${n.right}`;
    case "and":
      return `${operandSource(n.left)} && ${operandSource(n.right)}`;
    case "or":
      return `${operandSource(n.left)} || ${operandSource(n.right)}`;
    case "add":
      return `${n.left} + ${n.right}`;
    case "subtract":
      return `${n.left} - ${n.right}`;
    case "constant":
      return "1";
    case "true":
      return "(1 == 1)";
  }
}
export function compile(nodes, output, alphabet = DEFAULT_ALPHABET) {
  validateProgram(nodes, alphabet);
  if (output && !nodes.some((n) => n.id === output && TYPES[n.kind] === "bool"))
    throw new Error("The decision must be a yes/no variable.");
  // The bridge expects a Boolean final row. With no decision selected, Result
  // is merely an execution sentinel and is never presented as recognition.
  return [
    ...nodes.map((n) => `${n.id} = ${expression(n)}`),
    `Result = ${output || "(0 == 0)"}`,
  ].join("\n");
}
export function moveBlock(nodes, from, to, alphabet = DEFAULT_ALPHABET) {
  const result = structuredClone(nodes),
    [node] = result.splice(from, 1);
  result.splice(to, 0, node);
  validateProgram(result, alphabet);
  return result;
}
export const QUESTIONS = [
  {
    row: "Opens",
    col: 3,
    prompt: "How many opening parentheses occur through position 3, including that position?",
    options: [1, 2, 3, 4],
    why: "Positions 0, 2 and 3 contain an opening parenthesis. Prefix counts include the current token.",
  },
  {
    row: "Closes",
    col: 2,
    prompt: "At position 2, how many closing parentheses have occurred?",
    options: [0, 1, 2, 3],
    why: "Only position 1 is a closing parenthesis in this prefix.",
  },
  {
    row: "Balanced",
    col: 3,
    prompt: "Is the prefix ending at position 3 balanced?",
    options: [true, false],
    why: "There are 3 opens and 1 close, so the two counts are different.",
  },
  {
    row: "Safe",
    col: 4,
    prompt: "At position 4, has every prefix so far avoided an excess of closing parentheses?",
    options: [true, false],
    why: "No prefix of ()(()) has more closes than opens. Safe is true even when the current counts are unequal.",
  },
  {
    row: "Accept",
    col: 5,
    prompt: "Does the complete input satisfy both checks?",
    options: [true, false],
    why: "The final counts are equal and no earlier prefix had an excess of closes.",
  },
];

// General-purpose starter programs, separate from the Dyck-1 lesson.
export const BOTH_SYMBOLS = [
  { id: "As", kind: "tokenCount", token: "a" },
  { id: "Bs", kind: "tokenCount", token: "b" },
  { id: "HasA", kind: "compare", left: "As", op: ">", right: "0" },
  { id: "HasB", kind: "compare", left: "Bs", op: ">", right: "0" },
  { id: "Accept", kind: "and", left: "HasA", right: "HasB" },
];
export const A_BEFORE_B = [
  { id: "As", kind: "tokenCount", token: "a" },
  { id: "SeenA", kind: "compare", left: "As", op: ">", right: "0" },
  { id: "IsB", kind: "token", token: "b" },
  { id: "Witness", kind: "and", left: "SeenA", right: "IsB" },
  { id: "Witnesses", kind: "count", input: "Witness" },
  { id: "Accept", kind: "compare", left: "Witnesses", op: ">", right: "0" },
];

// Construct an expression using only earlier, correctly typed operands. Replacing
// a row preserves its result type so later references remain valid.
export function structuredNode(nodes, index, kind, id, alphabet = DEFAULT_ALPHABET) {
  validateAlphabet(alphabet);
  const earlier = nodes.slice(0, index);
  const bools = earlier.filter(n => TYPES[n.kind] === 'bool').map(n => n.id);
  const ints = earlier.filter(n => TYPES[n.kind] === 'int').map(n => n.id);
  if (!Object.hasOwn(TYPES, kind)) throw new Error('Unknown operation.');
  const old = nodes[index];
  if (old && TYPES[old.kind] !== TYPES[kind]) throw new Error('Keep the result type of this line.');
  let node = {id: old?.id || id, kind};
  if (kind === 'token' || kind === 'tokenCount') node.token = alphabet[0];
  if (kind === 'count' && !bools.length) node = {id: node.id, kind: 'tokenCount', token: alphabet[0]};
  else if (kind === 'count' || kind === 'not') {
    node.input = bools.at(-1) || `token:${alphabet[0]}`;
  }
  if (['and', 'or'].includes(kind)) {
    node.left = bools.at(-1) || `token:${alphabet[0]}`;
    node.right = bools.at(-2) || bools.at(-1) || `token:${alphabet[1] || alphabet[0]}`;
  }
  if (['add', 'subtract', 'compare'].includes(kind)) {
    node.left = ints.at(-1) || '0'; node.right = '0';
    if (kind === 'compare') node.op = '<=';
  }
  const candidate = nodes.map(n => ({...n}));
  if (old) candidate[index] = node; else candidate.push(node);
  validateProgram(candidate, alphabet);
  return node;
}

export function canonicalNames(nodes, output = '') {
  let predicates = 0, counts = 0;
  const names = new Map(nodes.map(n => [n.id,
    TYPES[n.kind] === 'bool' ? `P${++predicates}` : `C_${++counts}`]));
  return {
    nodes: nodes.map(n => {
      const renamed = {...n, id: names.get(n.id)};
      for (const key of ['input', 'left', 'right']) {
        if (Object.hasOwn(n, key) && names.has(n[key])) renamed[key] = names.get(n[key]);
      }
      return renamed;
    }),
    output: names.get(output) || '',
  };
}
