import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram, completions } from '../site/assets/program-text.js';
import { DYCK, expression } from '../site/assets/notebook-model.js';
import { evaluateBlocks } from '../site/assets/notebook-engine.js';
const source = DYCK.map(n => `${n.id} = ${expression(n)}`).join('\n');
test('typed text reproduces the starter and evaluates edits to earlier lines', () => {
  assert.deepEqual(parseProgram(source), DYCK);
  assert.equal(evaluateBlocks(parseProgram(source), [...'()(())'], 'Accept').accepted, true);
  assert.equal(evaluateBlocks(parseProgram(source.replace('Opens < Closes', 'Opens > Closes')), [...'()(())'], 'Accept').accepted, false);
});
test('insertion and blank lines preserve dependencies; broken edits identify the line', () => {
  assert.equal(parseProgram(source.replace('Closes =', 'Extra = "a"\n\nCloses =')).length, 8);
  assert.throws(() => parseProgram('X = # Later\nLater = "a"'), /Line 1.*earlier/);
  assert.throws(() => parseProgram('X = "a"\nN = #'), /Line 2/);
  assert.throws(() => parseProgram('N = # "a"\nX = ! N'), /Line 2.*yes\/no/);
});
test('suggestions follow cursor position and operand types', () => {
  const text = 'Flag = "a"\nN = # Flag\nX = ! \nFuture = "b"';
  const cursor = text.indexOf('\nFuture');
  assert.ok(completions(text, cursor).some(x => x.value === 'Flag'));
  assert.ok(!completions(text, cursor).some(x => ['N', 'Future'].includes(x.value)));
  const comparison = 'N = # "a"\nX = N > ';
  assert.ok(['0', '1', 'N'].every(value => completions(comparison, comparison.length).some(x => x.value === value)));
  const middle = 'Flag = "a"\nX = ! Flag';
  const item = completions(middle, middle.length - 2)[0];
  assert.equal(middle.slice(0, item.from) + item.value + middle.slice(item.to), middle);
});

test('article editor preserves custom alphabets and extended operations', async () => {
  const { parseProgram: parse } = await import('../tutorial_dual/static/web-assets/interactive/assets/program-text.js');
  const { expression: print } = await import('../tutorial_dual/static/web-assets/interactive/assets/notebook-model.js');
  const nodes = [
    {id:'P', kind:'token', token:'hello'},
    {id:'C', kind:'tokenCount', token:'hello', position:'i'},
    {id:'D', kind:'constant'}, {id:'T', kind:'true'},
    {id:'E', kind:'subtract', left:'C', right:'D'},
    {id:'F', kind:'and', left:'P', right:'token:hello'},
  ];
  assert.deepEqual(parse(nodes.map(n => `${n.id} = ${print(n)}`).join('\n'), ['hello']), nodes);
});

test('completions support inserting before later names and editing quoted tokens in place', () => {
  const source = '\nA1 = "a"';
  assert.equal(completions(source, 0)[0].value, 'A2 = ');
  const quoted = 'P = "b"\nQ = "a"';
  const item = completions(quoted, 5).find(item => item.value === '"a"');
  assert.equal(quoted.slice(0, item.from) + item.value + quoted.slice(item.to), 'P = "a"\nQ = "a"');
  assert.deepEqual(completions('P = "a"', 0), []);
});
test('extended completion guides subtraction, quoted predicates and count position', async () => {
  const { completions: complete, parseProgram: parse } = await import('../tutorial_dual/static/web-assets/interactive/assets/program-text.js');
  for (const [source, wanted] of [
    ['N = # "a"\nR = N - ', 'N'],
    ['P = "a" && ', '"b"'],
    ['N = (# (1 == 1)) if ', '"a"'],
    ['N = (# (1 == 1)) if "a" ', 'else 0'],
  ]) {
    const item = complete(source, source.length).find(item => item.value === wanted);
    assert.ok(item, source);
    if (!source.endsWith('if ')) assert.doesNotThrow(() => parse(source.slice(0, item.from) + item.value + source.slice(item.to)));
  }
});
