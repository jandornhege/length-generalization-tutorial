// Expression trees shared by the text editor, validator, evaluator and export.
const precedence = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 3, '<=': 3, '>': 3, '>=': 3, '+': 4, '-': 4 };

// A new assignment starts a statement; other nonempty lines continue its RHS.
// Preserve physical line numbers for diagnostics and newlines inside literals.
export function* assignmentLines(source) {
  let statement = '', start = 0;
  for (const [index, line] of source.split('\n').entries()) {
    if (!line.trim()) continue;
    if (!statement || /^\s*[A-Za-z][A-Za-z0-9_]*\s*=(?!=)/.test(line)) {
      if (statement) yield { line: statement, index: start };
      statement = line;
      start = index;
    } else statement += '\n' + line;
  }
  if (statement) yield { line: statement, index: start };
}

export function parseExpression(source) {
  if (source.length > 4000) throw new Error('An expression is limited to 4,000 characters.');
  const tokens = [...source.matchAll(/\s+|"(?:[^"\\]|\\.)*"|\d+|[A-Za-z][A-Za-z0-9_]*|&&|\|\||==|!=|<=|>=|[#!()+<>-]|\S/g)]
    .filter(m => !/^\s+$/.test(m[0])).map(m => m[0]);
  if (tokens.length > 512) throw new Error('An expression is limited to 512 tokens.');
  let index = 0;
  const take = value => {
    if (tokens[index] !== value) throw new Error(`Expected ${value}.`);
    index++;
  };
  function expr(minimum = 0, depth = 0) {
    if (depth > 64) throw new Error('Expression nesting is limited to 64 levels.');
    const token = tokens[index++];
    let left;
    if (!token) throw new Error('Complete the expression with an operand.');
    if (token === '(') { left = expr(0, depth + 1); take(')'); }
    else if (token === '!' || token === '#') left = { kind: token === '!' ? 'not' : 'count', input: expr(5, depth + 1) };
    else if (/^"/.test(token)) {
      try { left = { kind: 'token', value: JSON.parse(token) }; }
      catch { throw new Error('Close the quoted token.'); }
    } else if (/^\d+$/.test(token)) left = { kind: 'int', value: Number(token) };
    else if (['true', 'false'].includes(token)) left = { kind: 'bool', value: token === 'true' };
    else if (/^[A-Za-z][A-Za-z0-9_]*$/.test(token) && !['if', 'else'].includes(token)) left = { kind: 'ref', name: token };
    else throw new Error(`Expected an operand, found ${token}.`);
    while (precedence[tokens[index]] >= minimum) {
      const op = tokens[index++];
      left = { kind: 'binary', op, left, right: expr(precedence[op] + 1, depth + 1) };
    }
    if (minimum === 0 && tokens[index] === 'if') {
      index++;
      const condition = expr(0, depth + 1);
      take('else');
      left = { kind: 'if', condition, yes: left, no: expr(0, depth + 1) };
    }
    return left;
  }
  const tree = expr();
  if (index !== tokens.length) throw new Error(`Unexpected ${tokens[index]}; use an operator between operands.`);
  return tree;
}
export function inferExpression(tree, env, alphabet, { allowNested = true } = {}, depth = 0) {
  if (depth > 64) throw new Error('Expression nesting is limited to 64 levels.');
  const infer = child => inferExpression(child, env, alphabet, { allowNested }, depth + 1);
  const predicate = child => {
    const type = infer(child);
    if (type !== 'bool') throw new Error('This operation needs a yes/no predicate.');
    if (!allowNested && !['predicate', 'boolean'].includes(child.family))
      throw new Error('Boolean operations cannot contain counts or comparisons.');
    return child.family;
  };
  let type, family;
  switch (tree.kind) {
    case 'ref':
      type = env.get(tree.name);
      if (!type) throw new Error(`Choose an earlier variable for ${tree.name}.`);
      family = type === 'bool' ? 'predicate' : 'number';
      break;
    case 'token':
      if (!alphabet.includes(tree.value)) throw new Error('Choose a supported token.');
      type = 'bool'; family = 'predicate'; break;
    case 'bool': type = 'bool'; family = 'predicate'; break;
    case 'int':
      if (!Number.isSafeInteger(tree.value) || tree.value < 0) throw new Error('Use a nonnegative safe integer.');
      type = 'int'; family = 'number'; break;
    case 'not':
      predicate(tree.input); type = 'bool'; family = 'boolean'; break;
    case 'count': {
      const inputType = infer(tree.input);
      if (inputType !== 'bool')
        throw new Error('A prefix count needs a yes/no predicate.');
      if (!allowNested && tree.input.family !== 'predicate')
        throw new Error('A prefix count takes one Boolean predicate; counts and Boolean functions cannot be mixed.');
      type = 'int'; family = 'count'; break;
    }
    case 'binary':
      if (['&&', '||'].includes(tree.op)) {
        predicate(tree.left); predicate(tree.right);
        type = 'bool'; family = 'boolean';
      } else if (Object.hasOwn(precedence, tree.op)) {
        const leftType = infer(tree.left), rightType = infer(tree.right);
        if (leftType !== 'int' || rightType !== 'int') {
          const invalid = leftType !== 'int' ? tree.left : tree.right;
          const name = invalid.kind === 'ref' ? invalid.name : 'This operand';
          throw new Error(`${name} is a yes/no predicate; ${tree.op} requires two number expressions.`);
        }
        if (['+', '-'].includes(tree.op)) { type = 'int'; family = 'arithmetic'; }
        else { type = 'bool'; family = 'comparison'; }
      } else throw new Error('Unknown operator.');
      break;
    case 'if':
      predicate(tree.condition);
      if (infer(tree.yes) !== 'int' || infer(tree.no) !== 'int') throw new Error('A conditional count needs number branches.');
      type = 'int'; family = 'conditional'; break;
    default: throw new Error('Unknown expression.');
  }
  tree.type = type;
  tree.family = family;
  return type;
}

// Keep autocomplete's existing simple operand families, independently of the
// richer expressions accepted when typing a program directly.
export function inferGuidedExpression(tree, env, alphabet) {
  return inferExpression(tree, env, alphabet, { allowNested: false });
}

export function expressionReferences(tree) {
  if (tree.kind === 'ref') return [tree.name];
  return [...new Set(['input', 'left', 'right', 'condition', 'yes', 'no'].flatMap(key => tree[key] ? expressionReferences(tree[key]) : []))];
}
export function printExpression(tree) {
  const print = printExpression;
  // C-RASP's arithmetic grammar expects numeric expressions. Make the 0/1
  // interpretation of a predicate explicit when exporting compound arithmetic.
  const number = child => child.type === 'bool' ? `(1 if ${print(child)} else 0)` : print(child);
  switch (tree.kind) {
    case 'ref': return tree.name;
    case 'token': return JSON.stringify(tree.value);
    case 'int': return String(tree.value);
    case 'bool': return tree.value ? '(1 == 1)' : '(1 == 0)';
    case 'count': return `(# (${print(tree.input)}))`;
    case 'not': return `(! (${print(tree.input)}))`;
    case 'binary': {
      const operand = ['&&', '||'].includes(tree.op) ? print : number;
      return `(${operand(tree.left)} ${tree.op} ${operand(tree.right)})`;
    }
    case 'if': return `(${number(tree.yes)} if ${print(tree.condition)} else ${number(tree.no)})`;
  }
}
export function evaluateExpression(tree, env, tokens) {
  const memo = new Map();
  const safe = value => {
    if (!Number.isSafeInteger(value)) throw new Error('This value exceeds the exact integer range of this learning editor.');
    return value;
  };
  function values(n) {
    if (memo.has(n)) return memo.get(n);
    let result;
    switch (n.kind) {
      case 'ref': result = env.get(n.name); break;
      case 'token': result = tokens.map(token => token === n.value); break;
      case 'int': case 'bool': result = tokens.map(() => n.value); break;
      case 'not': result = values(n.input).map(value => !value); break;
      case 'count': {
        let total = 0;
        result = values(n.input).map(value => total += Number(value)); break;
      }
      case 'binary': {
        const a = values(n.left), b = values(n.right);
        result = a.map((left, i) => {
          const right = b[i];
          switch (n.op) {
            case '&&': return left && right;
            case '||': return left || right;
            case '+': return safe(Number(left) + Number(right));
            case '-': return safe(Number(left) - Number(right));
            case '<': return Number(left) < Number(right);
            case '<=': return Number(left) <= Number(right);
            case '==': return Number(left) === Number(right);
            case '!=': return Number(left) !== Number(right);
            case '>=': return Number(left) >= Number(right);
            case '>': return Number(left) > Number(right);
          }
        }); break;
      }
      case 'if': {
        const condition = values(n.condition), yes = values(n.yes), no = values(n.no);
        result = condition.map((value, i) => Number(value ? yes[i] : no[i])); break;
      }
    }
    memo.set(n, result);
    return result;
  }
  return values(tree);
}
export function expressionNode(id, source, nodes, types, alphabet) {
  const tree = parseExpression(source);
  const type = inferExpression(tree, new Map(nodes.map(n => [n.id, types[n.kind]])), alphabet);
  return { id, kind: type === 'bool' ? 'expressionBool' : 'expressionInt', tree };
}
export function remapExpressionTokens(tree, remap) {
  const result = { ...tree };
  if (tree.kind === 'token') result.value = remap(tree.value);
  for (const key of ['input', 'left', 'right', 'condition', 'yes', 'no'])
    if (tree[key]) result[key] = remapExpressionTokens(tree[key], remap);
  return result;
}
