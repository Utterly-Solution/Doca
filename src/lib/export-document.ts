import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import jsPDF from 'jspdf';

export function exportAsTxt(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${fileName}.txt`);
}

export async function exportAsDocx(content: string, fileName: string) {
  const paragraphs = content.split('\n').map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line, size: 24 })],
        spacing: { after: 120 },
      })
  );

  const doc = new Document({
    sections: [{ children: paragraphs }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `${fileName}.docx`);
}

export function exportAsPdf(content: string, fileName: string) {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 7;
  let y = margin;

  const lines = pdf.splitTextToSize(content, maxWidth);

  for (const line of lines) {
    if (y > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(line, margin, y);
    y += lineHeight;
  }

  pdf.save(`${fileName}.pdf`);
}
