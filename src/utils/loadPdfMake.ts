let pdfMakePromise: Promise<any> | null = null;

export async function loadPdfMake() {
  if (!pdfMakePromise) {
    pdfMakePromise = Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ]).then(([pdfMakeModule, pdfFontsModule]) => {
      const pdfMake = (pdfMakeModule as any).default || pdfMakeModule;
      const pdfFonts = (pdfFontsModule as any).default || pdfFontsModule;
      if (pdfFonts?.pdfMake?.vfs) {
        pdfMake.vfs = pdfFonts.pdfMake.vfs;
      }
      return pdfMake;
    });
  }
  return pdfMakePromise;
}
