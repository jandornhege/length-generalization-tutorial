# C-RASP interactive editor and background

Branch: `blog/interactive-first`.

The main page opens directly in the C-RASP program builder. It has no tool tabs or separate text-editor iframe. The editor supports free typing, optional cursor suggestions, clickable syntax slots, insertion between lines, and line removal. Token predicates use quoted symbols such as `"a"`; suggestions include symbols from the input string and the program, without a separate alphabet declaration.

The input string appears below the program, followed by its decision. The selected Boolean variable supplies the decision at the last position. The full execution trace and syntax reference are expandable. Evaluation runs locally in JavaScript.

Background material appears as eight numbered chapter cards with short summaries and subtopic previews. Opening a chapter gives it the full reading width while the other cards remain in a grid. Each chapter offers section links, and the overview supports expanding or collapsing all chapters. The canonical prose and chapter introductions live in `tutorial_dual/manuscript.typ` and are shared by the PDF and HTML builds.

Run `./build_tutorial.sh preview` to review the main page at the URL printed by the preview server. The standalone companion at `site/` is a separate surface.

Presentation files:

- `tutorial_dual/site/page.typ`
- `tutorial_dual/static/web-assets/css/interactive-first.css`
- `tutorial_dual/static/web-assets/scripts/interactive-first.js`
- `tutorial_dual/static/web-assets/interactive/assets/notebook.js` and its editor modules

Validate with `./build_tutorial.sh both` and `./build_tutorial.sh check`. With Node.js 22 on PATH, also run `node scripts/check.mjs`, `node --test tests/*.test.mjs`, and `node --test tutorial_dual/tests/*.test.mjs`.

Publishing with `scripts/publish-personal-blog.sh` replaces the personal live blog. Run it only when publication has been requested. After committing the source changes, push `HEAD` to the personal repository's `main` branch and run the publisher; it builds for `/length-generalization-tutorial/` and updates the `gh-pages` branch.
