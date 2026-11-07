import test from 'node:test';
import assert from 'node:assert/strict';
import { syntaxHint } from '../site/assets/syntax-hint.js';
test('grey syntax follows the incomplete assignment without supplying real operands', () => {
  for (const [source, expected] of [
    ['', 'A1 = expression'], ['Count', ' = expression'], ['Count = ', 'expression'],
    ['Count = # ', 'predicate'], ['Flag = !', ' predicate'],
    ['Flag = Count > ', 'number'], ['Accept = Flag && ', 'predicate'],
    ['Flag = "', 'token"'], ['Count = # "a"', ''], ['Flag = Count > 0', ''],
  ]) assert.equal(syntaxHint(source, source.length), expected);
});
test('hints stay on the active line and do not cover existing source', () => {
  const source = 'A = "a"\n\nN = # A';
  assert.equal(syntaxHint(source, source.indexOf('\n') + 1), 'A1 = expression');
  assert.equal(syntaxHint('N = # A', 4), '');
  assert.equal(syntaxHint('N = # A', 0), '');
});

test('clickable slots insert choices at their position, including a skipped name', async () => {
  const { slotCompletions } = await import('../site/assets/syntax-hint.js');
  const { completions, parseProgram } = await import('../site/assets/program-text.js');
  const source = 'A1 = "a"\n\nN = # A1';
  const cursor = source.indexOf('\n') + 1;
  const choice = slotCompletions(source, cursor, 'expression', completions)
    .find(item => item.value === 'A2 = "b"');
  assert.ok(choice);
  const edited = source.slice(0, choice.from) + choice.value + source.slice(choice.to);
  assert.equal(parseProgram(edited).length, 3);
  assert.ok(edited.endsWith('\nN = # A1'));
  const named = slotCompletions('Flag', 4, 'expression', completions).find(item => item.value === ' = "a"');
  assert.ok(named);
  assert.deepEqual(slotCompletions('N = 0 > ', 8, 'number', completions), completions('N = 0 > ', 8));
});
