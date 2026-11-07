#let c-rasp-editor-url = "https://github.com/lacoco-lab/Length_Generalization_Tutorial/tree/blog/interactive-tutorial/site/version2"

#let chapter-intro(body) = context {
  if target() == "html" {
    html.elem("p", attrs: (class: "chapter-lead"), body)
  } else {
    body
  }
}

// Shared authoring helpers: HTML folds details; PDF always includes the full text.
#let details(title, body) = context {
  if target() == "html" {
    html.elem("details", attrs: (class: "explanation"))[
      #html.elem("summary", title)
      #html.elem("div", attrs: (class: "explanation-body"), body)
    ]
  } else {
    block(
      width: 100%,
      above: 0.9em,
      below: 1em,
      inset: 10pt,
      fill: rgb("f1f6f3"),
      stroke: 0.6pt + rgb("c5d7cd"),
      radius: 4pt,
      breakable: true,
    )[
      #block(below: 0.5em, sticky: true)[
        #text(fill: rgb("17635e"), weight: "bold", title)
      ]
      #body
    ]
  }
}

#let operation-columns(..columns) = context {
  if target() == "html" {
    html.elem("div", attrs: (class: "operation-columns"))[
      #for column in columns.pos() { html.elem("div", column) }
    ]
  } else {
    grid(columns: (1fr, 1fr), gutter: 1em, ..columns.pos())
  }
}

#let interactive-notebook() = context {
  if target() == "html" {
    // The main page provides the program builder above the background article.
    []
  } else {
    [*Try it yourself.* The #link(c-rasp-editor-url)[drag-and-drop C-RASP editor (source and launch instructions)] lets you build programs and inspect their values on sample inputs. It evaluates C-RASP programs; compilation into transformer weights is the separate construction discussed below.]
  }
}

// A visible explanatory box in both output modes.
#let notation-box(body) = context {
  if target() == "html" {
    html.elem("aside", attrs: (class: "notation-box", "aria-label": "Semantics of prefix counting"), body)
  } else {
    block(width: 100%, inset: 10pt, stroke: 0.6pt + luma(190),
      fill: luma(248), radius: 4pt, breakable: false, body)
  }
}

// Keep the operation reference spacious in print without changing the HTML tables.
#let operation-table(..cells) = context {
  if target() == "html" {
    table(columns: (auto, 1fr), row-gutter: 0pt, ..cells.pos())
  } else {
    set text(size: 9.5pt)
    set par(justify: false)
    table(columns: (0.85fr, 2fr), row-gutter: 0pt, inset: (x: 6pt, y: 10pt),
      align: left + horizon, stroke: 0.5pt + luma(205), ..cells.pos())
  }
}
