import test from 'node:test';
import assert from 'node:assert/strict';

for (const base of ['../site/assets/', '../tutorial_dual/static/web-assets/interactive/assets/']) {
  const { YOU_ARE_GREAT: example } = await import(base + 'example-programs.js');
  const { parseProgram, collectProgramSymbols } = await import(base + 'program-text.js');
  const { evaluateBlocks } = await import(base + 'notebook-engine.js');

  test(`${base} lowercase phrase example recognizes exactly you are great, ignoring spaces`, () => {
    const run = input => {
      const tokens = Array.from(input).filter(token => !/\s/u.test(token));
      const alphabet = collectProgramSymbols(example.source, tokens);
      return evaluateBlocks(parseProgram(example.source, alphabet), tokens, example.output, alphabet).accepted;
    };
    assert.equal(example.label, 'recognize "you are great"');
    assert.equal(run(example.input), true);
    assert.equal(run('youaregreat'), true);
    for (const input of ['YOU ARE GREAT', 'You are great', 'you are greax', 'you are grea', 'you are greatt', 'xou are great'])
      assert.equal(run(input), false, input);
    for (let position = 0; position < 11; position++) {
      const changed = [...'youaregreat'];
      changed[position] = 'x';
      assert.equal(run(changed.join('')), false, `wrong character at position ${position + 1}`);
    }
  });

  test(`${base} separate character checks match their own positions before combining`, () => {
    const tokens = [...'youaregreat'];
    const alphabet = collectProgramSymbols(example.source, tokens);
    const trace = evaluateBlocks(parseProgram(example.source, alphabet), tokens, example.output, alphabet);
    for (let position = 1; position <= 11; position++)
      assert.deepEqual(trace.rows.find(row => row.name === `match${position}`).values,
        tokens.map((_, index) => index + 1 === position));
    assert.deepEqual(trace.rows.find(row => row.name === 'matches').values, Array(11).fill(true));
    assert.deepEqual(trace.rows.find(row => row.name === 'mismatches').values, Array(11).fill(0));
  });
}
