import test from 'node:test';
import assert from 'node:assert/strict';

for (const base of ['../site/assets/', '../tutorial_dual/static/web-assets/interactive/assets/']) {
  const { parseProgram, completions, collectProgramSymbols } = await import(`${base}program-text.js`);
  const { evaluateBlocks } = await import(`${base}notebook-engine.js`);
  const { expression, compile } = await import(`${base}notebook-model.js`);
  const { existingItemCompletions } = await import(`${base}syntax-hint.js`);
  const alphabet = ['a', 'b', '(', '"', '\\'];

  test(`${base} quoted predicates need no alphabet declaration`, () => {
    const source = 'P = "z"\nC = # P\nAccept = C > 0';
    const absentInput = [...'aaa'];
    const symbols = collectProgramSymbols(source, absentInput);
    assert.deepEqual(symbols, ['a', 'z']);
    const nodes = parseProgram(source, symbols);
    assert.equal(evaluateBlocks(nodes, absentInput, 'Accept', symbols).accepted, false);
    const changedInput = [...'xz'];
    const changedSymbols = collectProgramSymbols(source, changedInput);
    assert.equal(evaluateBlocks(parseProgram(source, changedSymbols), changedInput, 'Accept', changedSymbols).accepted, true);
    assert.deepEqual(collectProgramSymbols('P = "\\\\"\nQ = "\\\\"', ['a']), ['a', '\\']);
  });

  test(`${base} suggestions follow recognized input symbols without an alphabet field`, () => {
    const source = 'P = "a"\nCount = # ';
    const suggest = input => completions(source, source.length, collectProgramSymbols(source, input))
      .filter(choice => choice.detail.startsWith('Token predicate'))
      .map(choice => choice.value);
    assert.deepEqual(suggest(['x', 'y', '🙂', 'x']), ['"x"', '"y"', '"🙂"', '"a"']);
    assert.deepEqual(suggest(['z', '(']), ['"z"', '"("', '"a"']);
  });

  test(`${base} suggests quoted symbols in every predicate position`, () => {
    for (const source of ['P = ', 'P = # ', 'P = ! ', 'P = "a" && ']) {
      const choices = completions(source, source.length, alphabet);
      for (const symbol of alphabet)
        assert.ok(choices.some(choice => choice.value === JSON.stringify(symbol)), `${source}: ${symbol}`);
      assert.ok(choices.every(choice => !choice.value.includes('Q_')));
    }
    const source = 'P = "a" ';
    const operators = completions(source, source.length, alphabet).map(choice => choice.value.trim());
    assert.ok(operators.includes('&&'));
    assert.ok(operators.includes('||'));
  });

  test(`${base} evaluates and exports quoted Boolean predicates`, () => {
    const source = 'P = "a" && ! "b"\nC = # P\nAccept = C > 0';
    const nodes = parseProgram(source, alphabet);
    const trace = evaluateBlocks(nodes, [...'aba'], 'Accept', alphabet);
    assert.deepEqual(trace.rows.find(row => row.name === 'P').values, [true, false, true]);
    assert.deepEqual(trace.rows.find(row => row.name === 'C').values, [1, 1, 2]);
    assert.equal(trace.accepted, true);
    assert.equal(evaluateBlocks(nodes, [...'bbb'], 'Accept', alphabet).accepted, false);
    assert.ok(!compile(nodes, 'Accept', alphabet).includes('Q_'));
    assert.doesNotThrow(() => parseProgram(nodes.map(node => `${node.id} = ${expression(node)}`).join('\n'), alphabet));
    assert.equal(expression({ kind: 'not', input: 'token:a' }), '! "a"');
  });

  test(`${base} replaces a quoted symbol without changing neighboring syntax`, () => {
    const source = 'P = "a" && ! "b"';
    const complete = (text, cursor) => completions(text, cursor, alphabet);
    const valid = text => { try { parseProgram(text, alphabet); return true; } catch { return false; } };
    const choices = existingItemCompletions(source, source.indexOf('a'), complete, valid);
    const replacement = choices.find(choice => choice.value.trim() === '"("');
    assert.ok(replacement);
    assert.equal(source.slice(0, replacement.from) + replacement.value + source.slice(replacement.to), 'P = "(" && ! "b"');
  });

  test(`${base} treats former aliases as ordinary variable names`, () => {
    assert.throws(() => parseProgram('P = Q_a', alphabet), /earlier variable/);
    const nodes = parseProgram('Q_a = "b"\nP = ! Q_a', alphabet);
    assert.deepEqual(evaluateBlocks(nodes, ['a', 'b'], 'P', alphabet).rows.find(row => row.name === 'P').values, [true, false]);
  });
}
