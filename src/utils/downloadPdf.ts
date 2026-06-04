export async function downloadPdfDocument(
  pdfMake: any,
  docDefinition: any,
  filename: string,
): Promise<void> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      pdfMake.createPdf(docDefinition).getBlob((generatedBlob: Blob | null | undefined) => {
        if (!generatedBlob || generatedBlob.size === 0) {
          reject(new Error('Failed to generate PDF blob'));
          return;
        }

        resolve(generatedBlob);
      });
    } catch (error) {
      reject(error);
    }
  });

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
