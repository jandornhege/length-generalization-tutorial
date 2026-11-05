# Interactive-first variation

Branch: `blog/interactive-first`.

The HTML template puts three tools first: walkthrough, block builder, and text editor. The canonical manuscript remains the source of the optional background sections; the PDF content is unchanged. The repair, token-sandbox, and prediction modes are not exposed in this variation's embedded notebook.

Run `./build_tutorial.sh preview` to view this branch locally. The local review server may also be running at http://127.0.0.1:8794/.

Presentation files:

- `tutorial_dual/site/page.typ`
- `tutorial_dual/static/web-assets/css/interactive-first.css`
- `tutorial_dual/static/web-assets/scripts/interactive-first.js`

The walkthrough and builder run locally in JavaScript. The text editor loads its Python runtime on first use; it initially displays a saved trace and labels that state explicitly. Switching tabs preserves each iframe's state. The builder's "Continue in text editor" action transfers the program and input into the editor tab.

Publishing with `scripts/publish-personal-blog.sh` replaces the live blog. Do not use it merely to review this variation; use the local preview until publication is requested.

The simplified presentation uses one tab row without a sidebar. Routine evaluator status, duplicate instructions, generated-code toggles, and share/download controls are hidden in the embedded view. Errors remain visible. The builder shows per-block values and the final decision without a second duplicate value table. The editor retains input, source, Run/Stop, execution status, and trace.
