import test from 'node:test';
import assert from 'node:assert/strict';

const greeting = `C1 = # true

A1 = ((C1 == 1) && "h") ||
     ((C1 == 2) && "a") ||
     ((C1 == 3) && "l") ||
     ((C1 == 4) && "l") ||
     ((C1 == 5) && "o") ||
     ((C1 == 6) && "j") ||
     ((C1 == 7) && "a") ||
     ((C1 == 8) && "n")

C2 = # (!A1)

A2 = (C1 == 8) && (C2 == 0)`;

for (const base of ['../site/assets/', '../tutorial_dual/static/web-assets/interactive/assets/']) {
  const { parseProgram, collectProgramSymbols, completions } = await import(base + 'program-text.js');
  const { evaluateBlocks } = await import(base + 'notebook-engine.js');
  const { compile, references } = await import(base + 'notebook-model.js');
  const run = (source, input, output) => {
    const alphabet = collectProgramSymbols(source, [...input]);
    return evaluateBlocks(parseProgram(source, alphabet), [...input], output, alphabet);
  };

  test(`${base} pasted multiline greeting recognizes exactly hallojan`, () => {
    const trace = run(greeting, 'hallojan', 'A2');
    assert.equal(trace.accepted, true);
    assert.deepEqual(trace.rows.find(row => row.name === 'C1').values, [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(trace.rows.find(row => row.name === 'C2').values, Array(8).fill(0));
    for (const input of ['halloxan', 'xallojan', 'hallojax', 'halloja', 'hallojann'])
      assert.equal(run(greeting, input, 'A2').accepted, false, input);
  });

  test(`${base} nested counts evaluate predicates at each prefix position`, () => {
    const source = 'N = # (# "a" == 1)\nM = # (N > 1)\nInline = # (# (# "a" == 1) > 1)\nAccept = Inline == M && !(N < M)';
    const trace = run(source, 'abba', 'Accept');
    assert.deepEqual(trace.rows.find(row => row.name === 'N').values, [1, 2, 3, 3]);
    assert.deepEqual(trace.rows.find(row => row.name === 'Inline').values, [0, 1, 2, 3]);
    assert.deepEqual(trace.rows.find(row => row.name === 'M').values, [0, 1, 2, 3]);
    assert.equal(trace.accepted, true);
    const conditional = run('N = 7 if (# "a" > # "b") else 2\nAccept = N == 2', 'abba', 'Accept');
    assert.deepEqual(conditional.rows[0].values, [7, 2, 2, 2]);
  });

  test(`${base} nested expressions retain numeric and Boolean operand types`, () => {
    for (const rhs of ['# (# "a")', '# 1', '! (# "a")', '(# "a") && true'])
      assert.throws(() => parseProgram('Bad = ' + rhs), /yes\/no/, rhs);
    for (const rhs of ['# "a" > "b"', '(# "a" == 1) + 1', '# "a" == (# "b" > 0)'])
      assert.throws(() => parseProgram('Bad = ' + rhs), /requires two number expressions/, rhs);
    assert.throws(() => parseProgram('A = # (Missing > 0)'), /earlier/);
    assert.throws(() => parseProgram('A = # (A > 0)'), /earlier/);
  });

  test(`${base} nested export round trip preserves values and dependencies`, () => {
    const alphabet = collectProgramSymbols(greeting);
    const nodes = parseProgram(greeting, alphabet);
    const exported = compile(nodes, 'A2', alphabet).split('\n').slice(0, -1).join('\n');
    assert.deepEqual(run(exported, 'hallojan', 'A2').rows, run(greeting, 'hallojan', 'A2').rows);
    assert.deepEqual(references(nodes.find(node => node.id === 'A1')), ['C1']);
    assert.deepEqual(references(nodes.at(-1)), ['C1', 'C2']);
    assert.throws(() => parseProgram(greeting + '\n\nBad = # Missing', alphabet), /Line 16:.*earlier/);
  });

  test(`${base} guided suggestions keep their existing simple operand choices`, () => {
    const prefix = 'P = "a"\nN = # P\n';
    const count = prefix + 'Next = # ';
    const countChoices = completions(count, count.length).map(choice => choice.value);
    assert.deepEqual(countChoices, ['"a"', '"b"', '"("', '")"', 'P']);
    const boolean = prefix + 'Next = P && ';
    const booleanChoices = completions(boolean, boolean.length).map(choice => choice.value);
    assert.deepEqual(booleanChoices, ['"a"', '"b"', '"("', '")"', 'P', '! ']);
    const afterNestedLine = prefix + 'Match = (# P > 0) && P\nNext = # ';
    assert.ok(completions(afterNestedLine, afterNestedLine.length).some(choice => choice.value === 'Match'));
  });
}
