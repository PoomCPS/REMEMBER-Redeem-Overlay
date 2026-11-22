/**
 * REMEMBER Redeem Overlay - CodeMirror 6 Retro Hardware Loader
 * Loads CodeMirror 6 with custom 1980s Hardware Deck styling.
 * Falls back safely to retro-styled textareas if offline.
 */

// Custom 1980s VHS Tape Theme for CodeMirror
const retroThemeSpec = {
  '&': {
    color: '#F4F1EA',
    backgroundColor: '#121212',
    fontFamily: "'JetBrains Mono', Consolas, monospace",
    fontSize: '13px',
    height: '280px',
    border: '2px solid #1A1A1A',
    boxShadow: '2px 2px 0px #1A1A1A',
  },
  '.cm-content': {
    caretColor: '#FCBF49',
    fontFamily: "'JetBrains Mono', Consolas, monospace",
    padding: '8px 4px',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#FCBF49',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#2A2A2A !important',
  },
  '.cm-gutters': {
    backgroundColor: '#0D0D0D',
    color: '#5C5A54',
    borderRight: '1px solid #1A1A1A',
    fontFamily: "'JetBrains Mono', Consolas, monospace",
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#1A1A1A',
    color: '#FCBF49',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
};

export async function createRetroEditors({
  htmlContainer,
  cssContainer,
  initialHtml = '',
  initialCss = '',
  onHtmlChange = () => {},
  onCssChange = () => {},
}) {
  let htmlView = null;
  let cssView = null;
  let htmlFallback = null;
  let cssFallback = null;

  try {
    const [
      { EditorView, basicSetup },
      { EditorState },
      { html },
      { css },
    ] = await Promise.all([
      import('https://esm.sh/codemirror@6.0.1'),
      import('https://esm.sh/@codemirror/state@6.4.1'),
      import('https://esm.sh/@codemirror/lang-html@6.4.9'),
      import('https://esm.sh/@codemirror/lang-css@6.2.1'),
    ]);

    const theme = EditorView.theme(retroThemeSpec, { dark: true });

    // HTML Editor
    htmlView = new EditorView({
      state: EditorState.create({
        doc: initialHtml,
        extensions: [
          basicSetup,
          html(),
          theme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onHtmlChange(htmlView.state.doc.toString());
            }
          }),
        ],
      }),
      parent: htmlContainer,
    });

    // CSS Editor
    cssView = new EditorView({
      state: EditorState.create({
        doc: initialCss,
        extensions: [
          basicSetup,
          css(),
          theme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onCssChange(cssView.state.doc.toString());
            }
          }),
        ],
      }),
      parent: cssContainer,
    });

    return {
      getHtml: () => htmlView.state.doc.toString(),
      getCss: () => cssView.state.doc.toString(),
      setHtml: (text) => {
        htmlView.dispatch({
          changes: { from: 0, to: htmlView.state.doc.length, insert: text },
        });
      },
      setCss: (text) => {
        cssView.dispatch({
          changes: { from: 0, to: cssView.state.doc.length, insert: text },
        });
      },
    };
  } catch (err) {
    console.warn('[CodeMirror 6 Loader] ESM load failed or offline, falling back to textarea:', err.message);

    // Textarea fallback
    htmlFallback = document.createElement('textarea');
    htmlFallback.className = 'editor-fallback-textarea';
    htmlFallback.value = initialHtml;
    htmlFallback.rows = 12;
    htmlContainer.appendChild(htmlFallback);
    htmlFallback.addEventListener('input', () => onHtmlChange(htmlFallback.value));

    cssFallback = document.createElement('textarea');
    cssFallback.className = 'editor-fallback-textarea';
    cssFallback.value = initialCss;
    cssFallback.rows = 12;
    cssContainer.appendChild(cssFallback);
    cssFallback.addEventListener('input', () => onCssChange(cssFallback.value));

    return {
      getHtml: () => htmlFallback.value,
      getCss: () => cssFallback.value,
      setHtml: (text) => { htmlFallback.value = text; onHtmlChange(text); },
      setCss: (text) => { cssFallback.value = text; onCssChange(text); },
    };
  }
}
