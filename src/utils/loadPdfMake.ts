let pdfMakePromise: Promise<any> | null = null;

export async function loadPdfMake() {
  if (!pdfMakePromise) {
    pdfMakePromise = Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ]).then(([pdfMakeModule, pdfFontsModule]) => {
      const pdfMake = (pdfMakeModule as any).default || pdfMakeModule;
      const pdfFonts = (pdfFontsModule as any).default || pdfFontsModule;

      const fontVfs =
        pdfFonts?.pdfMake?.vfs ||
        pdfFonts?.vfs ||
        pdfFonts;

      const hasFontEntries =
        fontVfs &&
        typeof fontVfs === 'object' &&
        Object.keys(fontVfs).some((key) => key.toLowerCase().endsWith('.ttf'));

      if (hasFontEntries && typeof pdfMake.addVirtualFileSystem === 'function') {
        pdfMake.addVirtualFileSystem(fontVfs);
      } else if (hasFontEntries) {
        pdfMake.vfs = fontVfs;
      }

      return pdfMake;
    });
  }
  return pdfMakePromise;
}
