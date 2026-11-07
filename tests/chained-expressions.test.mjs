import test from 'node:test';
import assert from 'node:assert/strict';
for (const base of ['../site/assets/', '../tutorial_dual/static/web-assets/interactive/assets/']) {
  const { parseProgram, completions } = await import(base + 'program-text.js');
  const { evaluateBlocks } = await import(base + 'notebook-engine.js');
  const prefix = 'A1 = # "a"\nA2 = # "b"\n';
  test(`${base} separate comparison rules compose on a Boolean line`, () => {
    const source = prefix + 'HasB = A2 > 0\nMoreB = A2 > A1\nA3 = HasB && "b" && MoreB';
    const trace = evaluateBlocks(parseProgram(source), [...'abbab'], 'A3');
    assert.deepEqual(trace.rows.find(row => row.name === 'A3').values, [false,false,true,false,true]);
    assert.throws(() => parseProgram(prefix + 'A3 = A2 > 0 && "b" && A2 > A1'), /cannot contain counts or comparisons/);
  });
  test(`${base} comparisons suggest operands immediately, with or without spaces`, () => {
    for (const operator of ['==', '!=', '>', '<', '>=', '<=']) {
      for (const space of ['', ' ']) {
        const source = prefix + `C = A2 ${operator}${space}`;
        const choices = completions(source, source.length);
        for (const label of ['0', '1', 'A1', 'A2']) {
          const choice = choices.find(c => c.value.trim() === label);
          assert.ok(choice, source + ' → ' + label);
          const completed = source.slice(0, choice.from) + choice.value + source.slice(choice.to);
          assert.ok(completed.includes(operator));
          assert.doesNotThrow(() => parseProgram(completed));
        }
      }
    }
  });
  test(`${base} autocomplete combines earlier Boolean rules with quoted predicates`, () => {
    let source = prefix + 'HasB = A2 > 0\nMoreB = A2 > A1\nA3 = HasB && ';
    assert.ok(!completions(source, source.length).some(choice => choice.value.trim() === 'A2'));
    const pick = label => {
      const choice = completions(source, source.length).find(c => c.label === label);
      assert.ok(choice, source + ' → ' + label);
      source = source.slice(0, choice.from) + choice.value + source.slice(choice.to);
    };
    for (const choice of ['"b"', '&&', 'MoreB']) pick(choice);
    assert.deepEqual(evaluateBlocks(parseProgram(source), [...'abbab'], 'A3').rows.at(-1).values, [false,false,true,false,true]);
  });
  test(`${base} completing an earlier line leaves later lines untouched and out of scope`, () => {
    const source = prefix + 'C = A2 ==\nLater = # "a"';
    const cursor = source.indexOf('\nLater');
    const choices = completions(source, cursor);
    assert.ok(!choices.some(c => c.value.trim() === 'Later'));
    const choice = choices.find(c => c.value.trim() === 'A1');
    assert.ok(choice);
    const completed = source.slice(0, choice.from) + choice.value + source.slice(choice.to);
    assert.ok(completed.endsWith('\nLater = # "a"'));
    assert.equal(parseProgram(completed).length, 4);
  });
}

for (const base of ['../site/assets/', '../tutorial_dual/static/web-assets/interactive/assets/']) {
  const { parseProgram, completions } = await import(base + 'program-text.js');
  const prefix = 'A1 = "a"\nA2 = # A1\n';
  test(`${base} comparisons reject predicates, including nested operands`, () => {
    for (const rhs of ['A2 > A1', 'A1 < A2', 'A2 == A1', 'A2 > (A1)'])
      assert.throws(() => parseProgram(prefix + 'C = ' + rhs), /requires two number expressions/, rhs);
    assert.throws(() => parseProgram(prefix + 'C = (A2 > 0) && "b" && A2 > A1'), /cannot contain counts or comparisons/);
    assert.doesNotThrow(() => parseProgram(prefix + 'C = A2 > #A1'));
    assert.doesNotThrow(() => parseProgram(prefix + 'Count = #A1+A2'));
    assert.throws(() => parseProgram(prefix + 'Count = #A1+A1'), /requires two number expressions/);
  });
  test(`${base} comparison suggestions exclude predicates even inside parentheses`, () => {
    for (const rhs of ['A2 >', 'A2 == ', 'A2 > (', 'A2 > ((', '(A2 > 0) && "b" && A2 > ']) {
      const source = prefix + 'C = ' + rhs;
      const choices = completions(source, source.length).map(c => c.value.trim());
      assert.ok(!choices.includes('A1'), rhs);
      assert.ok(choices.includes('A2'), rhs);
      assert.ok(choices.includes('0'), rhs);
    }
  });
}
