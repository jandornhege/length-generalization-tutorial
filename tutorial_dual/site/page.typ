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
        #html.elem("title")[C-RASP interactive editor]
        #html.link(rel: "stylesheet", href: asset-url("/assets/css/article.css"))
        #html.link(rel: "stylesheet", href: asset-url("/assets/css/interactive-first.css") + "?v=20261107-expanded-chapter-grid")
        #html.elem("script", attrs: (src: asset-url("/assets/scripts/interactive-first.js") + "?v=20261107-expanded-chapter-grid", defer: ""))[]
      ]
      #html.elem("body", attrs: (class: "interactive-first"))[
        #html.elem("a", attrs: (href: "#playground", class: "skip"))[Skip to editor]
        #html.elem("header", attrs: (class: "lab-header"))[
          #html.elem("a", attrs: (href: "#", class: "lab-brand"))[C-RASP]
          #html.elem("nav", attrs: (class: "page-nav", "aria-label": "Page sections"))[
            #html.elem("a", attrs: (href: "#playground"))[Editor]
            #html.elem("a", attrs: (href: "#background"))[Background]
          ]
        ]
        #html.elem("main", attrs: (class: "lab-main"))[
          #html.elem("section", attrs: (class: "lab-intro"))[
            #html.elem("h1")[C-RASP interactive editor]
            #html.elem("p", attrs: (class: "deck"))[C-RASP programs combine Boolean predicates and prefix counts to compute a value at every input position. Write a program, try different input strings, and expand the execution trace to see how its decision is computed.]
          ]
          #html.elem("div", attrs: (class: "lab-layout"))[
            #html.elem("section", attrs: (id: "playground", class: "lab-stage", "aria-label": "C-RASP interactive editor"))[
              #html.elem("iframe", attrs: (
                class: "lab-frame", id: "lab-frame",
                src: asset-url("/assets/interactive/notebook.html") + "?embed=build&v=20261107-builder-only",
                title: "C-RASP interactive editor",
                height: "640",
              ))[]
            ]
          ]
          #html.elem("section", attrs: (id: "background", class: "lab-background"))[
            #html.elem("h2", attrs: (id: "background-title"))[Background]
            #html.elem("p", attrs: (class: "background-intro"))[Explore the ideas behind the editor: the C-RASP language, its connection to transformers, and the assumptions behind length generalization guarantees. Choose a chapter to read its explanation and worked examples.]
            #html.elem("div", attrs: (class: "background-tools"))[
              #html.elem("p", attrs: (id: "chapter-count"))[Chapter overview]
              #html.elem("button", attrs: (id: "background-toggle-all", type: "button", "aria-controls": "article", "aria-expanded": "false"))[Expand all]
            ]
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
