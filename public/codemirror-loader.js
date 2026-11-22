/**
 * REMEMBER Redeem Overlay - CodeMirror 6 Retro Hardware Loader
 * Loads CodeMirror 6 with custom 1980s Hardware Deck styling,
 * high-contrast vibrant syntax colors, independent scrolling, and Prettier formatting.
 */

// Custom 1980s VHS Tape Theme for CodeMirror
const retroThemeSpec = {
  '&': {
    color: '#F4F1EA',
    backgroundColor: '#121212',
    fontFamily: "'JetBrains Mono', Consolas, monospace",
    fontSize: '13px',
    height: '380px',
    maxHeight: '380px',
    border: '2px solid #1A1A1A',
    boxShadow: '2px 2px 0px #1A1A1A',
  },
  '.cm-scroller': {
    overflow: 'auto !important',
    height: '100% !important',
    maxHeight: '380px !important',
    fontFamily: "'JetBrains Mono', Consolas, monospace",
  },
  '.cm-content': {
    caretColor: '#FCBF49',
    fontFamily: "'JetBrains Mono', Consolas, monospace",
    padding: '8px 6px',
    minHeight: '100%',
    color: '#F4F1EA',
  },
  '.cm-line': {
    lineHeight: '1.5',
    color: '#F4F1EA',
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
    color: '#7E7A70',
    borderRight: '1px solid #1A1A1A',
    fontFamily: "'JetBrains Mono', Consolas, monospace",
    minHeight: '100%',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#1A1A1A',
    color: '#FCBF49',
    fontWeight: 'bold',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
};

/**
 * Prettier code formatter with graceful fallback.
 */
export async function formatCode(code, parser = 'html') {
  if (!code || !code.trim()) return code;
  try {
    const [prettier, parserHtml, parserPostcss] = await Promise.all([
      import('https://esm.sh/prettier@3.3.3/standalone'),
      import('https://esm.sh/prettier@3.3.3/plugins/html'),
      import('https://esm.sh/prettier@3.3.3/plugins/postcss'),
    ]);
    const res = await prettier.format(code, {
      parser: parser === 'css' ? 'css' : 'html',
      plugins: [parserHtml.default || parserHtml, parserPostcss.default || parserPostcss],
      tabWidth: 2,
      useTabs: false,
      printWidth: 80,
    });
    return res;
  } catch (err) {
    console.warn('[Prettier error, using fallback format]:', err.message);
    return fallbackFormat(code, parser);
  }
}

function fallbackFormat(code, parser) {
  if (!code) return '';
  if (parser === 'css') {
    return code
      .replace(/\s*\{\s*/g, ' {\n  ')
      .replace(/;\s*/g, ';\n  ')
      .replace(/\s*\}\s*/g, '\n}\n\n')
      .replace(/\n\s*\n\s*\}/g, '\n}')
      .trim() + '\n';
  }
  // Basic HTML formatter
  let formatted = '';
  let indent = 0;
  const tokens = code.replace(/>\s*</g, '><').split(/(?=<)|(?<=>)/g).filter(Boolean);
  for (const token of tokens) {
    if (token.startsWith('</')) {
      indent = Math.max(0, indent - 1);
    }
    const isSelfClosing = token.endsWith('/>') || token.match(/<(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)[^>]*>/i);
    const line = '  '.repeat(indent) + token;
    formatted += line + '\n';
    if (token.startsWith('<') && !token.startsWith('</') && !token.startsWith('<!--') && !isSelfClosing) {
      indent++;
    }
  }
  return formatted.trim() + '\n';
}

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
      { oneDark },
      { HighlightStyle, syntaxHighlighting },
      { tags },
    ] = await Promise.all([
      import('https://esm.sh/codemirror@6.0.1'),
      import('https://esm.sh/@codemirror/state@6.4.1'),
      import('https://esm.sh/@codemirror/lang-html@6.4.9'),
      import('https://esm.sh/@codemirror/lang-css@6.2.1'),
      import('https://esm.sh/@codemirror/theme-one-dark@6.1.2'),
      import('https://esm.sh/@codemirror/language@6.10.1'),
      import('https://esm.sh/@lezer/highlight@1.2.0'),
    ]);

    // High-Contrast Vibrant Retro Analog Syntax Highlighting
    const retroHighlightStyle = HighlightStyle.define([
      { tag: tags.keyword, color: '#FF79C6', fontWeight: 'bold' },
      { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#F4F1EA' },
      { tag: [tags.propertyName], color: '#00F0FF' },
      { tag: [tags.variableName], color: '#F4F1EA' },
      { tag: [tags.function(tags.variableName), tags.labelName], color: '#50FA7B' },
      { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#BD93F9' },
      { tag: [tags.definition(tags.name), tags.separator], color: '#F4F1EA' },
      { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#FFB86C' },
      { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#00F0FF' },
      { tag: [tags.meta, tags.comment], color: '#7E7A70', fontStyle: 'italic' },
      { tag: tags.strong, fontWeight: 'bold' },
      { tag: tags.emphasis, fontStyle: 'italic' },
      { tag: tags.strikethrough, textDecoration: 'line-through' },
      { tag: tags.link, color: '#8BE9FD', textDecoration: 'underline' },
      { tag: tags.heading, fontWeight: 'bold', color: '#FCBF49' },
      { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: '#BD93F9' },
      { tag: [tags.processingInstruction, tags.string, tags.inserted], color: '#50FA7B' },
      { tag: tags.invalid, color: '#FF5555' },
      { tag: tags.tagName, color: '#FF5555', fontWeight: 'bold' },
      { tag: tags.attributeName, color: '#FFB86C' },
      { tag: tags.attributeValue, color: '#50FA7B' },
    ]);

    const theme = EditorView.theme(retroThemeSpec, { dark: true });

    // HTML Editor
    htmlView = new EditorView({
      state: EditorState.create({
        doc: initialHtml,
        extensions: [
          basicSetup,
          html(),
          oneDark,
          syntaxHighlighting(retroHighlightStyle),
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
          oneDark,
          syntaxHighlighting(retroHighlightStyle),
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
    htmlFallback.rows = 14;
    htmlContainer.appendChild(htmlFallback);
    htmlFallback.addEventListener('input', () => onHtmlChange(htmlFallback.value));

    cssFallback = document.createElement('textarea');
    cssFallback.className = 'editor-fallback-textarea';
    cssFallback.value = initialCss;
    cssFallback.rows = 14;
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
