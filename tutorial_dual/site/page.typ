#import "@tola/site:0.0.0": site
#import "@tola/address:0.0.0": asset-url
#import "@tola/document:0.0.0": headings

#let page-template(page) = {
  let meta = page.source.meta
  document(page.output, format: "html", title: meta.title, description: meta.description)[
    #html.html(lang: "en")[
      #html.head[
        #html.elem("meta", attrs: (charset: "utf-8"))
        #html.elem("meta", attrs: (name: "viewport", content: "width=device-width, initial-scale=1"))
        #html.link(rel: "stylesheet", href: asset-url("/assets/css/article.css"))
        #html.link(rel: "stylesheet", href: asset-url("/assets/css/interactive-first.css"))
        #html.elem("script", attrs: (src: asset-url("/assets/scripts/interactive-first.js"), defer: ""))[]
      ]
      #html.elem("body", attrs: (class: "interactive-first"))[
        #html.elem("a", attrs: (href: "#playground", class: "skip"))[Skip to playground]
        #html.elem("header", attrs: (class: "lab-header"))[
          #html.elem("a", attrs: (href: "#", class: "lab-brand"))[C-RASP / Length generalization]
          #html.elem("a", attrs: (href: "#background"))[Theory & references ↓]
        ]
        #html.elem("main", attrs: (class: "lab-main"))[
          #html.elem("section", attrs: (class: "lab-intro"))[
            #html.elem("p", attrs: (class: "eyebrow"))[An explorable tutorial]
            #html.elem("h1")[Small program. Longer inputs.]
            #html.elem("p", attrs: (class: "deck"))[Change a symbol. Follow the counts. Build a rule that works beyond a single example.]
          ]
          #html.elem("div", attrs: (class: "lab-layout"))[
            #html.elem("section", attrs: (id: "playground", class: "lab-stage", "aria-label": "C-RASP playground"))[
              #html.elem("div", attrs: (class: "stage-label"))[
                #html.elem("strong")[Your playground]
                #html.elem("span")[Explore · build · edit]
              ]
              #html.elem("nav", attrs: (class: "lab-tabs", "aria-label": "Choose an interactive tool"))[
                #html.elem("button", attrs: ("data-lab-mode": "walk", "aria-pressed": "true"))[01 · Walkthrough]
                #html.elem("button", attrs: ("data-lab-mode": "build", "aria-pressed": "false"))[02 · Block builder]
                #html.elem("button", attrs: ("data-lab-mode": "editor", "aria-pressed": "false"))[03 · Text editor]
              ]
              #html.elem("iframe", attrs: (
                class: "lab-frame", id: "lab-frame",
                src: asset-url("/assets/interactive/notebook.html") + "#walk",
                title: "Interactive C-RASP playground: edit tokens, build programs and inspect values",
                height: "1100",
              ))[]
              #html.elem("iframe", attrs: (
                class: "lab-frame", id: "editor-frame", hidden: "",
                "data-src": asset-url("/assets/interactive/text-editor.html"),
                title: "C-RASP text editor and Python interpreter", height: "1100",
              ))[]
              #html.elem("p", attrs: (class: "stage-footnote"))[
                #link(asset-url("/assets/interactive/notebook.html"))[Open playground on its own ↗]
                · Positions start at 0; prefix counts include the current token.
              ]
            ]
            #html.elem("aside", attrs: (class: "lab-guide", "aria-label": "Things to try"))[
              #html.elem("p", attrs: (class: "eyebrow"))[Start with a question]
              #html.elem("h2")[What changes when…]
              #html.elem("button", attrs: (class: "challenge", "data-lab-mode": "walk", "aria-pressed": "true"))[
                #html.elem("span", attrs: (class: "challenge-number"))[01 / Understand]
                #html.elem("strong")[…you follow one computation?]
                #html.elem("span")[Reveal one assignment at a time and inspect its values.]
              ]
              #html.elem("button", attrs: (class: "challenge", "data-lab-mode": "build", "aria-pressed": "false"))[
                #html.elem("span", attrs: (class: "challenge-number"))[02 / Build]
                #html.elem("strong")[…you write the rule yourself?]
                #html.elem("span")[Combine typed operations and inspect every intermediate value.]
              ]
              #html.elem("button", attrs: (class: "challenge", "data-lab-mode": "editor", "aria-pressed": "false"))[
                #html.elem("span", attrs: (class: "challenge-number"))[03 / Edit]
                #html.elem("strong")[…you edit the program directly?]
                #html.elem("span")[Write C-RASP, run the Python interpreter, and examine the trace.]
              ]
              #html.elem("details", attrs: (class: "guide-note"))[
                #html.elem("summary")[New to C-RASP?]
                #html.elem("p")[Each program line computes one value per input position. Count symbols, compare counts, then combine yes/no answers. The last position decides whether to accept the input.]
                #html.elem("button", attrs: ("data-lab-mode": "walk"))[Walk through one line at a time →]
              ]
              #html.elem("details", attrs: (class: "guide-note"))[
                #html.elem("summary")[What does this tell us about transformers?]
                #html.elem("p")[The same fixed program can run on different input lengths. The walkthrough and builder evaluate a small C-RASP subset on up to 16 tokens. The text editor uses the Python interpreter and supports up to 128 tokens. Neither trains a transformer. The background below explains the connection and its limits.]
              ]
            ]
          ]
          #html.elem("section", attrs: (id: "background", class: "lab-background"))[
            #html.elem("p", attrs: (class: "eyebrow"))[Go deeper, when you need it]
            #html.elem("h2")[The ideas behind the experiment]
            #html.elem("p")[Definitions, worked programs, and the theory of length generalization. Open a topic to connect what you observed to the formal account.]
            #html.elem("div", attrs: (id: "article", class: "reference-text"))[
              #set heading(numbering: none)
              #show math.equation.where(block: true): it => html.elem("div", attrs: (class: "display-equation"), it)
              #show heading: it => html.elem("h" + str(calc.min(it.level + 1, 6)), it.body)
              #include page.source.file
            ]
          ]
        ]
      ]
    ]
  ]
}
