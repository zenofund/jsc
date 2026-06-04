export async function downloadPdfDocument(
  pdfMake: any,
  docDefinition: any,
  filename: string,
): Promise<void> {
  const pdfDoc = pdfMake.createPdf(docDefinition);
  // First: try to use pdfMake's built-in download() method (most reliable)
  // Wait a small amount and then show success, but if there's an error, show that
  try {
    pdfDoc.download(filename);
  } catch (error) {
    // If built-in download fails, try manual download via blob
    const buffer = await pdfDoc.bufferPromise;
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const navigatorWithMsSave = window.navigator as Navigator & {
      msSaveOrOpenBlob?: (blob: Blob, defaultName?: string) => boolean;
    };

    if (typeof navigatorWithMsSave.msSaveOrOpenBlob === 'function') {
      navigatorWithMsSave.msSaveOrOpenBlob(blob, filename);
      return;
    }

    const objectUrl = window.URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.rel = 'noopener';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    }
  }
}
