import { defineConfig } from 'vite';

// Remplace, à la compilation, l'ancien lecteur PDF simplifié de src/main.js
// (du `let plumePdfDocument=null,` jusqu'à `async function openRead`) par des
// appels au lecteur cloné d'Aurore Archives (src/aurore-archives-pdf-reader.js).
// Si les repères ne sont pas retrouvés, main.js est laissé tel quel (aucune casse).
function archivesReaderSwap() {
  const START = 'let plumePdfDocument=null,';
  const END = 'async function openRead(id) {';
  return {
    name: 'aurore-archives-reader-swap',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0].replace(/\\/g, '/');
      if (!file.endsWith('/src/main.js')) return null;
      const a = code.indexOf(START);
      const b = code.indexOf(END);
      if (a < 0 || b < 0 || b < a) {
        this.warn('aurore-archives-reader-swap : repères introuvables, ancien lecteur conservé.');
        return null;
      }
      const remplacement = [
        "import { openArchivesPdfReader, closeArchivesPdfReader } from './aurore-archives-pdf-reader.js';",
        "async function openPdfReader(blob, title = 'Lecture du document', workId = null) {",
        "  if (!(blob instanceof Blob)) throw new Error('Le document PDF est indisponible.');",
        "  await openArchivesPdfReader(blob, { title, workId, onReopen: openRead });",
        "}",
        "function updatePlumePdfReader() {}",
        "function closePdfReader() { closeArchivesPdfReader(); }",
        ''
      ].join('\n');
      return { code: code.slice(0, a) + remplacement + code.slice(b), map: null };
    }
  };
}

export default defineConfig({
  plugins: [archivesReaderSwap()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        diagnostic: 'diagnostic.html'
      }
    }
  }
});
