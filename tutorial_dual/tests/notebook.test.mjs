// Adapted from the upstream notebook tests; see ../UPSTREAM.md.
import test from "node:test";
import assert from "node:assert/strict";
import {
  DYCK,
  CONTAINS,
  BOTH_SYMBOLS,
  A_BEFORE_B,
  compile,
  validateProgram,
  moveBlock,
  structuredNode,
  canonicalNames,
} from "../static/web-assets/interactive/assets/notebook-model.js";
import { evaluateBlocks } from "../static/web-assets/interactive/assets/notebook-engine.js";

test("block editor rejects undefined and incorrectly typed inputs", () => {
  assert.throws(() => compile([{ id: "Count", kind: "count", input: "Missing" }]), /earlier/);
  assert.throws(
    () =>
      compile([
        { id: "N", kind: "tokenCount", token: "a" },
        { id: "Bad", kind: "count", input: "N" },
      ]),
    /earlier/,
  );
  assert.throws(() => compile(CONTAINS, "A2"), /yes\/no/);
  assert.throws(
    () => compile([{ id: "X", kind: "token", token: '"; arbitrary' }]),
    /supported token/,
  );
  assert.throws(() => compile([{ id: "Result", kind: "token", token: "a" }]), /names/);
});
test("dependency-violating reorder is rejected without mutating the program", () => {
  const before = structuredClone(DYCK);
  assert.throws(() => moveBlock(DYCK, 3, 0), /earlier/);
  assert.deepEqual(DYCK, before);
  const moved = moveBlock(DYCK, 1, 0);
  assert.equal(moved[0].id, "Closes");
  assert.doesNotThrow(() => validateProgram(moved));
});
test("generated output is separate from exploratory number vectors", () => {
  assert.equal(compile([]), "Result = (0 == 0)");
  assert.match(compile(CONTAINS, "A3"), /Result = A3$/);
  assert.match(compile(DYCK, "Accept"), /Accept = Safe && Balanced/);
});

test("prefix counting is inclusive and respects causality", () => {
  const trace = evaluateBlocks(DYCK, [..."()(())"], "Accept");
  assert.deepEqual(trace.rows[0].values, [1, 1, 2, 3, 3, 3]);
  assert.equal(trace.accepted, true);
  assert.equal(evaluateBlocks(DYCK, [..."())("], "Accept").accepted, false);
  const changed = evaluateBlocks(DYCK, [..."()(()("], "Accept");
  for (let i = 0; i < trace.rows.length; i++)
    assert.deepEqual(trace.rows[i].values.slice(0, 5), changed.rows[i].values.slice(0, 5));
  assert.equal(changed.accepted, false);
  assert.equal(evaluateBlocks(DYCK, [..."())(()"], "Accept").accepted, false);
});
test("empty and unsupported inputs are rejected", () => {
  assert.throws(() => evaluateBlocks(DYCK, [], "Accept"), /1–16/);
  assert.throws(() => evaluateBlocks(DYCK, ["x"], "Accept"), /1–16/);
  assert.throws(() => evaluateBlocks(DYCK, Array(17).fill("("), "Accept"), /1–16/);
});

test("general starters separate presence from order", () => {
  for (const input of ["ab", "ba"])
    assert.equal(evaluateBlocks(BOTH_SYMBOLS, [...input], "Accept").accepted, true);
  assert.equal(evaluateBlocks(BOTH_SYMBOLS, [..."aa"], "Accept").accepted, false);
  assert.equal(evaluateBlocks(A_BEFORE_B, [..."ab"], "Accept").accepted, true);
  assert.equal(evaluateBlocks(A_BEFORE_B, [..."ba"], "Accept").accepted, false);
  assert.equal(evaluateBlocks(A_BEFORE_B, [..."a()b"], "Accept").accepted, true);
});


test("structured expression choices preserve typing and earlier dependencies", () => {
  const kinds = ['token','count','compare','and','or','not','add','subtract','constant','true'];
  for (const program of [[], CONTAINS, DYCK]) {
    for (let index = 0; index <= program.length; index++) {
      for (const kind of kinds) {
        let replacement;
        try { replacement = structuredNode(program, index, kind, 'Fresh'); }
        catch { continue; }
        const candidate = structuredClone(program);
        if (index === candidate.length) candidate.push(replacement);
        else candidate[index] = replacement;
        assert.doesNotThrow(() => compile(candidate));
        assert.doesNotThrow(() => evaluateBlocks(candidate, ['a','b','a']));
      }
    }
  }
  assert.equal(structuredNode([], 0, 'count', 'C1').kind, 'tokenCount');
  assert.equal(structuredNode([], 0, 'not', 'P1').input, 'token:a');
  assert.throws(() => structuredNode(CONTAINS, 0, 'constant'), /result type/);
  const before = structuredClone(CONTAINS);
  const replacement = structuredNode(CONTAINS, 2, 'not');
  assert.equal(replacement.input, 'A1');
  assert.deepEqual(CONTAINS, before);
});


test("predicate and count names have separate numbering and preserve evaluation", () => {
  const renamed = canonicalNames(DYCK, 'Accept');
  assert.deepEqual(renamed.nodes.map(n => n.id), ['C_1','C_2','P1','C_3','P2','P3','P4']);
  assert.equal(renamed.output, 'P4');
  for (const input of ['()(())','())(']) {
    const original = evaluateBlocks(DYCK, [...input], 'Accept');
    const result = evaluateBlocks(renamed.nodes, [...input], renamed.output);
    assert.deepEqual(result.rows.map(r => r.values), original.rows.map(r => r.values));
  }
  assert.match(compile(renamed.nodes, renamed.output), /C_3 = # P1/);
  assert.deepEqual(canonicalNames(renamed.nodes, renamed.output), renamed);
});


test("custom alphabets support arbitrary symbols in predicates and prefix counts", () => {
  const alphabet = ['open', 'close', 'x'];
  const nodes = [
    {id:'P1',kind:'token',token:'open'},
    {id:'C_1',kind:'count',input:'P1'},
    {id:'P2',kind:'compare',left:'C_1',op:'>',right:'0'},
  ];
  assert.deepEqual(evaluateBlocks(nodes, ['open','close','open'], 'P2', alphabet).rows[1].values, [1,1,2]);
  assert.match(compile(nodes, 'P2', alphabet), /P1 = "open"/);
  assert.equal(structuredNode([], 0, 'count', 'C_1', alphabet).token, 'open');
  assert.throws(() => evaluateBlocks(nodes, ['a'], 'P2', alphabet), /selected alphabet/);
  assert.throws(() => compile(nodes, 'P2', ['x']), /supported token/);
  assert.throws(() => structuredNode([], 0, 'count', 'C_1', []), /distinct symbols/);
  assert.throws(() => structuredNode([], 0, 'count', 'C_1', ['x','x']), /distinct symbols/);
});


test("token indicators work directly in Boolean operands and respect the alphabet", () => {
  const nodes = [
    {id:'P1',kind:'or',left:'token:a',right:'token:b'},
    {id:'P2',kind:'and',left:'P1',right:'token:a'},
    {id:'P3',kind:'not',input:'token:b'},
  ];
  assert.deepEqual(evaluateBlocks(nodes, [...'aba'], 'P3').rows.map(r => r.values),
    [[true,true,true],[true,false,true],[true,false,true],[true,false,true]]);
  assert.match(compile(nodes, 'P3'), /P1 = "a" \|\| "b"/);
  assert.match(compile(nodes, 'P3'), /P3 = ! "b"/);
  assert.throws(() => compile(nodes, 'P3', ['a']), /earlier/);
  assert.throws(() => compile([{id:'C_1',kind:'add',left:'token:a',right:'0'}]), /earlier/);
  for (const kind of ['and','or','not'])
    assert.doesNotThrow(() => compile([structuredNode([], 0, kind, 'P1')]));
});

test("prefix counts distinguish predicates at i from predicates at j", () => {
  const nodes = [
    {id:'P1',kind:'token',token:'a'},
    {id:'C_1',kind:'count',input:'P1',position:'j'},
    {id:'C_2',kind:'count',input:'P1',position:'i'},
    {id:'C_3',kind:'tokenCount',token:'a',position:'i'},
    {id:'C_4',kind:'tokenCount',token:'a',position:'j'},
  ];
  assert.deepEqual(evaluateBlocks(nodes, [...'aba'], 'P1').rows.slice(1,5).map(r => r.values),
    [[1,1,2],[1,0,3],[1,0,3],[1,1,2]]);
  assert.match(compile(nodes, 'P1'), /C_2 = \(# \(1 == 1\)\) if P1 else 0/);
  assert.throws(() => compile([{...nodes[1], input:'token:a',position:'k'}]), /position/);
});
