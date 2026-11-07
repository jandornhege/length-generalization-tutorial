import test from 'node:test';
import assert from 'node:assert/strict';
for (const base of ['../site/assets/', '../tutorial_dual/static/web-assets/interactive/assets/']) {
  const { parseProgram, completions } = await import(base + 'program-text.js');
  const { evaluateBlocks } = await import(base + 'notebook-engine.js');
  const { compile, references } = await import(base + 'notebook-model.js');
  const run = source => evaluateBlocks(parseProgram(source), [...'abba'], 'Accept');
  test(`${base} composed arithmetic and negation use every input position`, () => {
    const trace = run('A2="a"\nA3="b"\nN=#A2\nA1=N+N\nAccept=A2 && !A3');
    assert.deepEqual(trace.rows.find(r => r.name === 'A1').values, [2, 2, 2, 4]);
    assert.deepEqual(trace.rows.find(r => r.name === 'Accept').values, [true, false, false, true]);
    assert.throws(() => parseProgram('A2="a"\nA1=#A2+A2'), /requires two number expressions/);
    assert.deepEqual(references(parseProgram('P="a"\nQ="b"\nAccept=P&&!Q').at(-1)), ['P','Q']);
  });
  test(`${base} Boolean nesting and separate counts preserve their semantics`, () => {
    const trace = run('P="a"\nQ="b"\nAny=P||Q\nNotP=!P\nAnyCount=#Any\nNotPCount=#NotP\nN=AnyCount+NotPCount\nAccept=P||Q&&!P');
    assert.deepEqual(trace.rows.find(r => r.name === 'N').values, [1, 3, 5, 6]);
    assert.deepEqual(trace.rows.find(r => r.name === 'Accept').values, [true,true,true,true]);
    const grouped = run('P="a"\nQ="b"\nAccept=(P||Q)&&!P');
    assert.deepEqual(grouped.rows.find(r => r.name === 'Accept').values, [false,true,true,false]);
    assert.throws(() => parseProgram('P="a"\nQ="b"\nN=#(P||Q)'), /prefix count takes one Boolean predicate/);
    assert.equal(run('N=1+2-1\nAccept=N==2').accepted, true);
  });
  test(`${base} nested types and dependencies are validated`, () => {
    assert.throws(() => parseProgram('P="a"\nN=#P\nAccept=P&&!N'), /yes\/no/);
    assert.throws(() => parseProgram('P="a"\nAccept=P&&!Missing'), /earlier/);
    assert.throws(() => parseProgram('P="a"\nN=#(P||)'), /operand/);
    assert.throws(() => parseProgram('N=9007199254740992'), /safe integer/);
  });
  test(`${base} export round trip retains compound semantics`, () => {
    const nodes = parseProgram('P="a"\nQ="b"\nC=#P\nN=C+C\nEnough=N>1\nAccept=Enough&&!Q');
    const exported = compile(nodes, 'Accept').split('\n').slice(0,-1).join('\n');
    assert.deepEqual(evaluateBlocks(parseProgram(exported), [...'abba'], 'Accept').rows, evaluateBlocks(nodes, [...'abba'], 'Accept').rows);
  });
  test(`${base} autocomplete follows compound operands`, () => {
    const prefix = 'P="a"\nQ="b"\nN=#P\n';
    for (const [rhs, expected] of [['P&&!','Q'], ['#P+','N'], ['#(P||','Q']]) {
      const source = prefix + 'X=' + rhs;
      assert.ok(completions(source, source.length).some(c => c.value.trim() === expected), rhs);
    }
  });
}

test('compound token expressions follow changes to the alphabet without mutating the original', async () => {
  const { expressionNode, remapExpressionTokens, evaluateExpression } = await import('../site/assets/expressions.js');
  const node = expressionNode('P', '"a"&&!"b"', [], {}, ['a','b']);
  const mapped = remapExpressionTokens(node.tree, token => ({a:'x',b:'y'})[token]);
  assert.deepEqual(evaluateExpression(mapped, new Map(), ['x','y']), [true,false]);
  assert.deepEqual(evaluateExpression(node.tree, new Map(), ['a','b']), [true,false]);
});
