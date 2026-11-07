import { attachAutocomplete } from "./autocomplete.js";
import { parseProgram, completions, collectProgramSymbols } from "./program-text.js";
import { YOU_ARE_GREAT } from "./example-programs.js";
import {
  TYPES,
  DYCK,
  CONTAINS,
  BOTH_SYMBOLS,
  A_BEFORE_B,
  QUESTIONS,
  compile,
  expression,
  references,
} from "./notebook-model.js";
import { evaluateBlocks } from "./notebook-engine.js";
const $ = (id) => document.getElementById(id);
const requestedEmbed = new URLSearchParams(location.search).get("embed");
const embeddedMode = ["walk", "build"].includes(requestedEmbed) ? requestedEmbed : null;
if (embeddedMode) document.documentElement.dataset.embed = embeddedMode;
const clone = (x) => structuredClone(x);
const MODES = [
  {
    id: "walk",
    title: "01 · Walkthrough",
    short: "One assignment at a time",
    heading: "Follow the computation",
    description:
      "Start with one row, then add the next. Every column belongs to a token position. Select a token to inspect the prefix ending there; future tokens do not contribute to its count.",
  },
  {
    id: "build",
    title: "02 · Guided editor",
    short: "Write with optional suggestions",
    heading: "Write a program",
    description:
      "Write directly or click the grey syntax hints for help. You can change any line and insert new ones anywhere. Values update as soon as the program is complete.",
  },
  {
    id: "repair",
    title: "03 · Repair a rule",
    short: "Learn from a counterexample",
    heading: "What is missing from this rule?",
    description:
      "Equal final counts do not guarantee balanced parentheses. The starter rule accepts a string with an invalid prefix. Change the two choices and inspect the short test inputs to find out why.",
  },
  {
    id: "tokens",
    title: "04 · Token sandbox",
    short: "Change symbols, watch values",
    heading: "Edit the input, watch the counts",
    description:
      "Click a parenthesis to flip it. Add or remove tokens using the buttons. The program stays fixed: watch how a small input change affects this and later positions, but not earlier ones.",
  },
  {
    id: "predict",
    title: "05 · Predict a value",
    short: "Think before revealing",
    heading: "Predict one cell",
    description:
      "Look at the highlighted prefix and predict the requested value. The answer is computed from the same program used in the walkthrough. After choosing, reveal the relevant row and compare it with your reasoning.",
  },
];
const explanations = {
  Opens: "Count opening parentheses through each position, including that token.",
  Closes:
    "Count closing parentheses through each position. These counts share the same prefix as Opens.",
  Violation:
    "Yes means that this prefix has more closes than opens. One such prefix is enough to invalidate the input.",
  Violations:
    "Count the positions where Violation is yes. This remembers an earlier problem even if the counts later become equal.",
  Safe: "Yes means no violation has occurred in any prefix so far.",
  Balanced:
    "Yes means the two counts at this position are equal. This does not check earlier prefixes.",
  Accept:
    "Both checks are needed: no invalid prefix and equal counts. The value at the final position decides the whole input.",
};
const cases = [
  { tokens: "())(()", want: false, label: "Equal totals, bad prefix" },
  { tokens: "()(())", want: true, label: "Balanced input" },
  { tokens: "(()", want: false, label: "Unclosed input" },
  { tokens: ")(", want: false, label: "Starts with a close" },
];
let builderTokens = [..."abba"],
  builderAlphabet = ["a", "b"],
  mode = "walk",
  tokens = [..."()(())"],
  step = 0,
  focus = 3,
  question = 0,
  nodes = clone(CONTAINS),
  output = "A3",
  outputManuallySelected = false,
  draft = null,
  draftError = "",
  repairOp = "==",
  repairJoin = "or",
  caseIndex = 0,
  currentTrace = null,
  builderTraceDetails = null,
  builderDecisionStatus = null;
function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function button(text, fn, cls = "secondary") {
  const node = el("button", text, cls);
  node.type = "button";
  node.onclick = fn;
  return node;
}
function say(text, error = false) {
  $("interaction-message").textContent = text;
  $("interaction-message").classList.toggle("error", error);
}
function choice(label, options, value, onChange) {
  const wrap = el("label", label),
    select = el("select");
  for (const o of options) {
    const [v, t] = Array.isArray(o) ? o : [o, o];
    select.add(new Option(t, v));
  }
  select.value = value;
  select.onchange = () => onChange(select.value);
  wrap.append(select);
  return wrap;
}
function fmt(value) {
  return typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
}
function currentNodes() {
  if (mode === "build") return nodes;
  const n = clone(DYCK);
  if (mode === "repair") {
    n[2].op = repairOp;
    n[6].kind = repairJoin;
  }
  return n;
}
function currentOutput() {
  return mode === "build" ? output : "Accept";
}
function source() {
  return compile(currentNodes(), currentOutput(), mode === "build" ? builderAlphabet : ["a", "b", "(", ")"]);
}
function rowValue(name, col) {
  return currentTrace?.rows.find((r) => r.name === name)?.values[col];
}
function schedule() {
  // The small typed program runs synchronously: every displayed value belongs
  // to the current controls, including during rapid edits or offline use.
  currentTrace = null;
  $("results").setAttribute("aria-busy", "true");
  $("decision").textContent = "";
  $("decision").className = mode === "build" ? "decision builder-inline-decision" : "decision";
  $("inspection").textContent = "";
  if (mode === "build") {
    builderAlphabet = builderSymbols();
    const inputIssue = !tokens.length ? "Enter an input string to see its decision."
      : tokens.length > 16 ? "Use an input string of at most 16 symbols." : "";
    $("sequence-input")?.setAttribute("aria-invalid", String(Boolean(inputIssue)));
    if (inputIssue) {
      $("results").setAttribute("aria-busy", "false");
      $("values").replaceChildren();
      $("source-code").textContent = draft ?? "";
      $("runtime-status").textContent = "Input not evaluated";
      $("decision").textContent = inputIssue;
      $("decision").classList.add("input-invalid");
      return;
    }
  }
  if (mode === "build" && draftError) {
    $("results").setAttribute("aria-busy", "false");
    $("values").replaceChildren();
    $("source-code").textContent = draft;
    $("runtime-status").textContent = "Waiting for a complete program";
    $("inspection").textContent = "Complete this edit to see updated values.";
    $("decision").textContent = "Complete the program to see its decision.";
    return;
  }
  if (mode === "tokens") $("mode-workspace").replaceChildren();
  try {
    $("source-code").textContent = source();
    currentTrace = evaluateBlocks(currentNodes(), [...tokens], currentOutput(), mode === "build" ? builderAlphabet : ["a", "b", "(", ")"]);
    $("results").setAttribute("aria-busy", "false");
    $("runtime-status").textContent = "Live values · evaluated locally · no network needed";
    renderResults();
  } catch (error) {
    if (mode === "build") $("source-code").textContent = draft ?? "";
    $("results").setAttribute("aria-busy", "false");
    $("runtime-status").textContent = error.message;
    $("inspection").textContent = "No values are shown for this edit.";
    if (mode === "build") $("decision").textContent = "No decision available for this edit.";
    document
      .querySelectorAll(".block-values")
      .forEach((node) => (node.textContent = "Unavailable"));
  }
}
function setMode(id) {
  if (mode === "build" && id !== "build") restoreBuilderTrace();
  mode = id;
  $("experiment").dataset.mode = id;
  $("results").classList.toggle("results-builder", id === "build");
  if (id !== "build") document.getElementById("builder-syntax-reference")?.remove();
  if (id === "build") {
    tokens = [...builderTokens];
  } else tokens = [...(id === "repair" ? cases[caseIndex].tokens : "()(())")];
  focus = Math.min(3, tokens.length - 1);
  const config = MODES.find((m) => m.id === mode);
  $("mode-kicker").textContent = config.short;
  $("mode-title").textContent = config.heading;
  $("mode-description").textContent = config.description;
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === id));
  $("mode-controls").replaceChildren();
  $("mode-workspace").replaceChildren();
  $("values").replaceChildren();
  say("");
  $("results").hidden = false;
  $("result-intro").textContent =
    "Select a value to inspect it. Positions are zero-based; prefix counts include the current token.";
  if (mode === "walk") renderWalk();
  if (mode === "build") renderBuilder();
  if (mode === "repair") renderRepair();
  if (mode === "predict") renderPrediction();
  renderInput();
  schedule();
  history.replaceState(null, "", `#${id}`);
}
function restoreBuilderTrace() {
  if (!builderTraceDetails) return;
  const results = $("results");
  const resultDecision = builderDecisionStatus || $("decision");
  const runtime = document.querySelector(".runtime-bar");
  resultDecision.classList.remove("builder-inline-decision");
  results.querySelector(".result-header").append(resultDecision);
  $("mode-workspace").insertAdjacentElement("afterend", results);
  results.insertAdjacentElement("afterend", runtime);
  $("interaction-message").insertAdjacentElement("beforebegin", $("input-area"));
  builderTraceDetails.remove();
  builderTraceDetails = null;
  builderDecisionStatus = null;
}
for (const m of MODES) {
  const b = button("", () => setMode(m.id), "");
  b.dataset.mode = m.id;
  b.append(el("strong", m.title), el("small", m.short));
  b.setAttribute("aria-pressed", "false");
  $("mode-nav").append(b);
}
$("reset-design").onclick = () => {
  if (mode === "walk") step = 0;
  if (mode === "build") {
    builderTokens = [..."abba"];
    builderAlphabet = ["a", "b"];
    nodes = clone(CONTAINS);
    output = "A3";
    outputManuallySelected = false;
    draft = null;
  }
  if (mode === "repair") {
    repairOp = "==";
    repairJoin = "or";
    caseIndex = 0;
  }
  if (mode === "predict") question = 0;
  setMode(mode);
};
function builderSymbols(text = draft ?? "") {
  const symbols = collectProgramSymbols(text, tokens);
  return symbols.length ? symbols : ["a", "b"];
}
function renderInput() {
  const area = $("input-area");
  area.replaceChildren();
  const box = el("div", undefined, "input-workbench"),
    head = el("div", undefined, "input-heading"),
    sequenceSummary = el("p", undefined, "sequence-summary");
  sequenceSummary.id = "sequence-summary";
  const updateSequenceSummary = () => {
    if (mode !== "build") {
      sequenceSummary.textContent = `${tokens.length} tokens · positions 0–${tokens.length - 1}`;
      return;
    }
    sequenceSummary.textContent = `${tokens.length} ${tokens.length === 1 ? "token" : "tokens"} · spaces ignored`;
  };
  const inputHeading = el("h3", mode === "build" ? "Input string" : "Input sequence");
  inputHeading.id = "input-string-heading";
  head.append(inputHeading);
  updateSequenceSummary();
  box.append(head);

  if (mode === "build") {
    box.classList.add("builder-input");
    head.append(sequenceSummary);
    const input = el("input");
    input.type = "text";
    input.id = "sequence-input";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.value = tokens.join("");
    input.setAttribute("aria-labelledby", "input-string-heading");
    input.setAttribute("aria-describedby", "sequence-summary decision");
    input.placeholder = "Enter an input string…";
    input.oninput = () => {
      // Each non-space Unicode code point is one token; spaces are visual separators.
      tokens = Array.from(input.value).filter(token => !/\s/u.test(token));
      builderTokens = [...tokens];
      focus = Math.max(0, tokens.length - 1);
      updateSequenceSummary();
      schedule();
    };
    box.append(input);
  } else {
    const strip = el("div", undefined, "token-buttons");
    strip.id = "input-tokens";
    const prediction = mode === "predict" ? QUESTIONS[question] : null;
    tokens.forEach((t, i) => {
      const b = button("", () => {
        if (mode === "tokens") {
          tokens[i] = t === "(" ? ")" : "(";
          focus = i;
          renderInput();
          schedule();
          say(`Flipped position ${i}. Earlier prefix values stay unchanged.`);
        } else if (mode === "build") {
          const alphabet = [...new Set(tokens)];
          const current = alphabet.indexOf(t);
          tokens[i] = alphabet[(current + 1) % alphabet.length];
          builderTokens = [...tokens];
          renderInput();
          schedule();
        } else {
          focus = i;
          renderInput();
          renderResults();
        }
      }, "input-token");
      b.dataset.position = i;
      b.setAttribute("aria-label", `${mode === "tokens" ? "Flip" : "Inspect"} token ${t} at position ${i}`);
      b.setAttribute("aria-pressed", String(i === (prediction ? prediction.col : focus)));
      b.append(el("span", t, "symbol"), el("small", `position ${i}`));
      if (prediction) {
        b.classList.toggle("outside", i > prediction.col);
        b.disabled = true;
      }
      strip.append(b);
    });
    box.append(strip, sequenceSummary);
    const hint = mode === "tokens"
      ? "Click any token to flip it. The numbers below each token are Opens / Closes."
      : mode === "predict"
        ? "The outlined box is the queried position. Muted tokens lie outside its prefix."
        : "Select a token to inspect the prefix ending there.";
    box.append(el("p", hint, "small"));
  }

  const actions = el("div", undefined, "toolbar");
  if (mode === "walk") {
    actions.append(
      button("Balanced: ()(())", () => changeInput("()(())")),
      button("Counterexample: ())(()", () => changeInput("())(()")),
    );
  }
  if (mode === "tokens") {
    for (const t of ["(", ")"]) {
      const b = button(`Add ${t}`, () => {
        tokens.push(t);
        focus = tokens.length - 1;
        renderInput();
        schedule();
      });
      b.disabled = tokens.length >= 16;
      actions.append(b);
    }
    const remove = button("Remove last", () => {
      tokens.pop();
      focus = Math.min(focus, tokens.length - 1);
      renderInput();
      schedule();
    });
    remove.disabled = tokens.length <= 1;
    actions.append(remove, button("Restore ()(())", () => changeInput("()(())")));
  }
  box.append(actions);
  area.append(box);
}

function changeInput(text) {
  tokens = [...text];
  focus = Math.min(focus, tokens.length - 1);
  renderInput();
  schedule();
}
function renderWalk() {
  const controls = $("mode-controls");
  controls.replaceChildren();
  const toolbar = el("div", undefined, "toolbar");
  const previous = button("← Previous assignment", () => {
    step--;
    renderWalk();
    renderResults();
  });
  previous.disabled = step === 0;
  const next = button("Add next assignment →", () => {
    step++;
    renderWalk();
    renderResults();
  });
  next.disabled = step === DYCK.length - 1;
  toolbar.append(previous, el("span", `${step + 1} of ${DYCK.length}`), next);
  controls.append(toolbar);
  const progress = el("div", undefined, "step-progress");
  progress.setAttribute("aria-hidden", "true");
  DYCK.forEach((_, i) => progress.append(el("span", undefined, i <= step ? "done" : "")));
  controls.append(progress);
  const copy = el("div", undefined, "step-copy");
  copy.append(el("h3", `${step + 1}. ${DYCK[step].id}`), el("p", explanations[DYCK[step].id]));
  controls.append(copy);
}
function renderTable(rows) {
  const scroll = el("div", undefined, "value-scroll"),
    table = el("table", undefined, "value-table");
  table.append(
    el("caption", "Each column is one token position. Yes/no values are Boolean predicates."),
  );
  const head = table.createTHead().insertRow();
  ["Variable", ...tokens.map((t, i) => `${i}: ${t}`)].forEach((t) => {
    const th = el("th", t);
    th.scope = "col";
    head.append(th);
  });
  const body = table.createTBody();
  rows.forEach((row) => {
    const tr = body.insertRow();
    tr.dataset.variable = row.name;
    if (mode === "walk" && row.name === DYCK[step].id) tr.className = "focus-row";
    const label = el("th", row.name);
    label.scope = "row";
    tr.append(label);
    row.values.forEach((v, i) => {
      const td = tr.insertCell();
      const b = button(fmt(v), () => inspect(row.name, i), "");
      b.setAttribute("aria-label", `${row.name} at position ${i}: ${fmt(v)}`);
      td.append(b);
      if (i === focus && mode === "walk" && row.name === DYCK[step].id)
        td.classList.add("focus-cell");
    });
  });
  scroll.append(table);
  return scroll;
}
function inspect(name, col) {
  focus = col;
  const value = rowValue(name, col);
  let note = `${name} at position ${col} is ${fmt(value)}. `;
  const node = currentNodes().find((n) => n.id === name);
  const refs = node ? references(node) : [];
  if (node?.kind === "tokenCount") {
    const indices = tokens
      .map((t, i) => (t === node.token && i <= col ? i : null))
      .filter((i) => i !== null);
    note += `Count “${node.token}” at ${indices.length ? "positions " + indices.join(", ") : "no positions"} in the prefix 0–${col}.`;
  } else if (node?.kind === "count") {
    const inputs = currentTrace.rows.find((r) => r.name === node.input).values;
    note += `${node.input} is yes at ${inputs.slice(0, col + 1).filter(Boolean).length} positions in this prefix.`;
  } else if (refs.length) {
    note +=
      refs.map((id) => `${id} = ${fmt(rowValue(id, col))}`).join("; ") +
      `. The operation is ${expression(node)}.`;
  } else note += "This value belongs to the current input, not to a later token.";
  $("inspection").textContent = note;
  document.querySelectorAll("#input-tokens button").forEach((b, i) => {
    b.classList.toggle("outside", i > col);
    b.classList.toggle(
      "contributor",
      node?.kind === "tokenCount" && i <= col && tokens[i] === node.token,
    );
    b.setAttribute("aria-pressed", String(i === col));
  });
}
function renderResults() {
  if (!currentTrace) return;
  $("values").replaceChildren();
  $("decision").className = mode === "build" ? "decision builder-inline-decision" : "decision";
  if (mode === "build") {
    $("result-heading").textContent = "Execution trace";
    $("result-intro").textContent =
      "Each assignment below shows its vector in input order. The selected yes/no variable determines the decision at the last token.";
    $("values").append(renderTable(currentTrace.rows.filter(row => row.name !== "Result")));
    if (!output) {
      $("decision").textContent = "No decision selected";
      $("inspection").textContent =
        "Explore number vectors, or select a yes/no variable to define acceptance.";
      return;
    }
  } else if (mode === "predict") {
    renderPrediction();
    return;
  } else {
    let rows = currentTrace.rows.filter((r) => r.name !== "Result");
    if (mode === "walk") rows = rows.slice(0, step + 1);
    $("result-heading").textContent =
      mode === "walk" ? "Assignments revealed so far" : "Values at each position";
    $("values").append(renderTable(rows));
  }
  if (mode === "walk" && step < DYCK.length - 1) {
    $("decision").textContent = "Decision introduced at step 7";
    inspect(DYCK[step].id, focus);
  } else {
    const acceptedLabel = currentTrace.accepted ? "Accepted" : "Rejected";
    $("decision").textContent = mode === "build"
      ? `${acceptedLabel} input “${tokens.join("")}”`
      : `${acceptedLabel} at the last token`;
    $("decision").classList.add(currentTrace.accepted ? "yes" : "no");
  }
  if (mode === "repair") renderRepairFeedback();
  if (mode === "tokens") renderLiveSummary();
}
function renderBuilder() {
  say("");
  document.getElementById("builder-syntax-reference")?.remove();
  const area = $("mode-workspace");
  area.replaceChildren();
  if (!builderTraceDetails) {
    builderTraceDetails = el("details", undefined, "builder-trace");
    builderTraceDetails.append(el("summary", "Show full execution trace"));
    const resultDecision = $("decision");
    builderDecisionStatus = resultDecision;
    resultDecision.classList.add("builder-inline-decision");
    resultDecision.remove();
    builderTraceDetails.append($("results"), document.querySelector(".runtime-bar"));
  }
  const resultDecision = builderDecisionStatus || $("decision");
  const examplePrograms = el("div", undefined, "example-program-panel");
  const startEmpty = button("Start empty", () => {
    nodes = [];
    output = "";
    outputManuallySelected = false;
    draft = null;
    renderBuilder();
    schedule();
  });
  startEmpty.classList.add("example-start-empty");
  const examples = choice(
    "Load example program",
    [
      ["", "Choose an example…"],
      ["contains", "Contains a"],
      ["both", "Contains both a and b"],
      ["before", "An a occurs before a b"],
      ["dyck", "Balanced parentheses"],
      ["you-are-great", YOU_ARE_GREAT.label],
    ],
    "",
    value => {
      if (!value) return;
      const example = value === "you-are-great" ? YOU_ARE_GREAT : null;
      draft = example?.source ?? null;
      tokens = Array.from(example?.input ?? (value === "contains" ? "abba" : value === "dyck" ? "()(())" : "ab"))
        .filter(token => !/\s/u.test(token));
      nodes = example ? parseProgram(draft, builderSymbols())
        : clone(value === "contains" ? CONTAINS : value === "both" ? BOTH_SYMBOLS : value === "before" ? A_BEFORE_B : DYCK);
      output = example?.output ?? (value === "contains" ? "A3" : "Accept");
      outputManuallySelected = false;
      builderTokens = [...tokens];
      renderInput();
      renderBuilder();
      schedule();
    },
  );
  examples.className = "example-program-select";
  examplePrograms.append(examples, startEmpty);
  const reference = el("details", undefined, "syntax-reference");
  reference.id = "builder-syntax-reference";
  reference.append(el("summary", "Syntax reference"));
  const referenceIntro = el("p", "Start each assignment on a new line; expressions may continue across lines. Names are unique and can refer only to earlier assignments.", "syntax-reference-intro");
  reference.append(referenceIntro);
  const referenceGroups = [
    ["Variable names", [
      ["Name = expression", "Define a variable. A name starts with a letter and may contain letters, digits and underscores."],
    ]],
    ["Boolean valued variables", [
      ['"a"', "True at positions containing the symbol a. Write symbols in double quotes, including punctuation."],
      ["!P", "Negate the yes/no value of P."],
      ["P && Q", "True when both Boolean operands P and Q are true."],
      ["P || Q", "True when either Boolean operand P or Q is true."],
      ["(P)", "Group a Boolean expression. Counts, comparisons and Boolean operations may be nested, with numeric operands for comparisons and Boolean operands for counting and logic."],
      ["true, false", "Constant yes and no predicates."],
      ["<, <=, ==, !=, >=, >", "Compare two number values; each comparison produces a Boolean value."],
    ]],
    ["Count valued variables", [
      ["#P", "Count positions where the Boolean predicate P is true, from the start through the current token."],
      ["0, 1, 42", "Nonnegative integer constants."],
      ["N", "An earlier numeric variable or count."],
      ["N + M", "Add the two number operands N and M."],
      ["N - M", "Subtract number operand M from number operand N."],
      ["(N)", "Group a number expression without changing its value."],
      ["N if P else M", "Choose numeric expression N when predicate P is true; otherwise choose numeric expression M."],
    ]],
  ];
  for (const [title, rows] of referenceGroups) {
    const section = el("section", undefined, "syntax-reference-group");
    section.append(el("h4", title));
    const table = el("table", undefined, "syntax-reference-table");
    const body = table.createTBody();
    for (const [syntax, meaning] of rows) {
      const row = body.insertRow();
      const sample = el("code", syntax);
      const syntaxCell = el("th");
      syntaxCell.scope = "row";
      syntaxCell.append(sample);
      row.append(syntaxCell, el("td", meaning));
    }
    section.append(table);
    reference.append(section);
  }
  const editor = el("textarea", undefined, "guided-program");
  editor.id = "guided-program";
  editor.setAttribute("aria-label", "C-RASP program");
  editor.spellcheck = false;
  editor.autocomplete = "off";
  editor.wrap = "off";
  editor.setAttribute("autocapitalize", "off");
  editor.setAttribute("autocorrect", "off");
  editor.value = draft ?? nodes.map(n => `${n.id} = ${expression(n)}`).join("\n");
  draft = editor.value;
  const editorHeading = el("h3", "Your program", "program-editor-heading");
  const suggestionsToggle = el("label", undefined, "suggestions-toggle");
  const suggestionsCheckbox = el("input");
  suggestionsCheckbox.type = "checkbox";
  suggestionsCheckbox.checked = true;
  suggestionsCheckbox.setAttribute("aria-label", "Suggestions");
  suggestionsToggle.append(suggestionsCheckbox, document.createTextNode(" Suggestions"));
  const editorHeader = el("div", undefined, "program-editor-header");
  editorHeader.append(editorHeading, suggestionsToggle);
  const feedback = el("p", "", "editor-feedback");
  feedback.setAttribute("role", "status");
  const decision = el("div", undefined, "builder-output");
  const update = () => {
    draft = editor.value;
    builderAlphabet = builderSymbols();
    try {
      nodes = parseProgram(draft, builderAlphabet);
      draftError = "";
      const booleanNames = nodes.filter(n => TYPES[n.kind] === "bool").map(n => n.id);
      if (outputManuallySelected && !booleanNames.includes(output)) outputManuallySelected = false;
      if (!outputManuallySelected) output = booleanNames.at(-1) || "";
      feedback.textContent = "";
      feedback.classList.remove("is-error");
      decision.replaceChildren(choice("Decision at last position of", [["", "No decision yet"], ...nodes.filter(n => TYPES[n.kind] === "bool").map(n => n.id)], output, v => { output = v; outputManuallySelected = true; schedule(); }));
    } catch (error) {
      draftError = error.message;
      const guided = /Complete a token|Use Name =/.test(draftError);
      feedback.textContent = guided ? `${draftError.split(":")[0]} · Finish this assignment to update the values.` : draftError;
      feedback.classList.toggle("is-error", document.activeElement !== editor);
      decision.replaceChildren();
    }
    schedule();
  };
  editor.addEventListener("input", update);
  area.append(examplePrograms, editorHeader, editor, feedback, decision);
  area.insertAdjacentElement("afterend", $("input-area"));
  $("input-area").insertAdjacentElement("afterend", resultDecision);
  resultDecision.insertAdjacentElement("afterend", builderTraceDetails);
  builderTraceDetails.insertAdjacentElement("afterend", reference);
  editor.addEventListener("blur", () => feedback.classList.toggle("is-error", Boolean(draftError)));
  const setSuggestionsDisabled = attachAutocomplete(
    editor,
    (text = editor.value, cursor = editor.selectionStart) => completions(text, cursor, builderSymbols(text)),
    text => { try { parseProgram(text, builderSymbols(text)); return true; } catch { return false; } },
  );
  setSuggestionsDisabled(false);
  suggestionsCheckbox.addEventListener("change", () => setSuggestionsDisabled(!suggestionsCheckbox.checked));
  update();
}

function renderRepair() {
  const area = $("mode-controls");
  area.replaceChildren();
  const rule = el("div", undefined, "puzzle-rule");
  rule.append(
    choice("A prefix is a violation when Opens", ["<", "==", ">"], repairOp, (v) => {
      repairOp = v;
      schedule();
    }),
    el("p", "Closes. Safe means the number of violations so far is zero.", "small"),
  );
  rule.append(
    choice(
      "Accept when Safe",
      [
        ["and", "AND"],
        ["or", "OR"],
      ],
      repairJoin,
      (v) => {
        repairJoin = v;
        schedule();
      },
    ),
    el("p", "Balanced. Balanced means Opens equals Closes.", "small"),
  );
  area.append(rule);
  const buttons = el("div", undefined, "case-buttons");
  cases.forEach((c, i) => {
    const b = button(
      `${c.tokens} · should ${c.want ? "accept" : "reject"}`,
      () => {
        caseIndex = i;
        renderRepair();
        changeInput(c.tokens);
      },
      "",
    );
    b.setAttribute("aria-pressed", String(i === caseIndex));
    buttons.append(b);
  });
  area.append(buttons);
  const feedback = el("div", undefined, "puzzle-feedback");
  feedback.id = "repair-feedback";
  feedback.append(
    el(
      "p",
      "Change one choice and inspect how the rows change. Passing these examples is not a proof for all inputs.",
    ),
  );
  area.append(feedback);
}
function renderRepairFeedback() {
  const expected = cases[caseIndex].want,
    match = currentTrace.accepted === expected;
  const box = $("repair-feedback");
  box.replaceChildren();
  let why =
    repairJoin === "or"
      ? "With OR, equal final counts can accept an input even when Safe is false."
      : repairOp !== "<"
        ? "Check the violation condition: an invalid prefix has fewer opens than closes."
        : "The rule checks both the absence of invalid prefixes and equal final counts.";
  box.append(
    el(
      "p",
      `${match ? "Matches" : "Does not match"} the expected result for this input. ${why} Try the other inputs too; this small set is not an exhaustive proof.`,
    ),
  );
}
function renderLiveSummary() {
  const area = $("mode-workspace");
  area.replaceChildren();
  const summary = el("div", undefined, "live-summary");
  const violation = currentTrace.rows.find((r) => r.name === "Violation").values.findIndex(Boolean);
  for (const [value, label] of [
    [rowValue("Opens", tokens.length - 1), "opens in the whole input"],
    [rowValue("Closes", tokens.length - 1), "closes in the whole input"],
    [violation < 0 ? "none" : violation, "first invalid prefix (position)"],
  ]) {
    const box = el("div");
    box.append(el("strong", value), el("span", label));
    summary.append(box);
  }
  area.append(summary);
  document.querySelectorAll("#input-tokens button").forEach((b, i) => {
    b.querySelector(".count-under")?.remove();
    b.append(el("span", `${rowValue("Opens", i)} / ${rowValue("Closes", i)}`, "count-under"));
  });
  $("inspection").textContent =
    violation < 0
      ? "No prefix has more closes than opens. Check the final counts separately."
      : `The first invalid prefix ends at position ${violation}. Later tokens cannot erase that earlier violation.`;
}
function renderPrediction() {
  const area = $("mode-controls");
  area.replaceChildren();
  const q = QUESTIONS[question],
    card = el("div", undefined, "prediction");
  card.append(
    el("p", `Question ${question + 1} of ${QUESTIONS.length}`, "small"),
    el("h3", q.prompt),
    el("p", `Requested cell: ${q.row}[${q.col}]`),
  );
  const options = el("div", undefined, "prediction-options");
  for (const value of q.options) {
    const b = button(fmt(value), () => {
      const actual = rowValue(q.row, q.col);
      $("prediction-feedback").textContent =
        `${value === actual ? "Correct." : "Not quite."} ${q.row}[${q.col}] = ${fmt(actual)}. ${q.why}`;
      options.querySelectorAll("button").forEach((x) => (x.disabled = true));
      $("values").replaceChildren(renderTable([currentTrace.rows.find((r) => r.name === q.row)]));
      $("result-heading").textContent = "Revealed row";
      $("result-intro").textContent = q.why;
      $("decision").textContent = "";
      next.disabled = question === QUESTIONS.length - 1;
    });
    b.disabled = !currentTrace;
    options.append(b);
  }
  card.append(options);
  const feedback = el(
    "p",
    currentTrace ? "Choose a value to reveal the row." : "Choose a value after the input is ready.",
    "prediction-feedback",
  );
  feedback.id = "prediction-feedback";
  feedback.setAttribute("role", "status");
  card.append(feedback);
  const next = button("Next question →", () => {
    question++;
    renderInput();
    renderPrediction();
    $("values").replaceChildren();
    $("result-heading").textContent = "The answer is hidden until you choose";
    $("result-intro").textContent = "";
  });
  next.disabled = true;
  card.append(
    next,
    button("Start again", () => {
      question = 0;
      renderInput();
      renderPrediction();
      $("values").replaceChildren();
    }),
  );
  area.append(card);
  $("values").replaceChildren();
  $("decision").textContent = "";
  $("result-heading").textContent = "The answer is hidden until you choose";
  $("result-intro").textContent = "";
  $("inspection").textContent = "";
}
$("toggle-code").onclick = () => {
  const hidden = !$("generated-code").hidden;
  $("generated-code").hidden = hidden;
  $("toggle-code").setAttribute("aria-expanded", String(!hidden));
  $("toggle-code").textContent = hidden ? "View generated C-RASP" : "Hide generated C-RASP";
};
setMode(
  embeddedMode ||
    (MODES.some((m) => m.id === location.hash.slice(1)) ? location.hash.slice(1) : "walk"),
);
if (embeddedMode) {
  $("reset-design").textContent =
    embeddedMode === "walk" ? "Restart walkthrough" : "Reset playground";
  if (embeddedMode === "build") {
    document.title = "C-RASP interactive editor";
    document.querySelectorAll("body > header, .skip, .notebook-intro, .mode-nav, .design-notes")
      .forEach(element => element.remove());
  }
  let previousHeight = 0;
  const notifyHeight = () => {
    const height = Math.ceil(
      document.querySelector(".notebook-shell").getBoundingClientRect().height,
    );
    if (height !== previousHeight) {
      previousHeight = height;
      window.parent.postMessage({ type: "crasp-notebook-height", height }, location.origin);
    }
  };
  new ResizeObserver(notifyHeight).observe(document.querySelector(".notebook-shell"));
  window.addEventListener("load", notifyHeight);
  notifyHeight();
}
