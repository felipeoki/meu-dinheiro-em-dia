import { jsPDF } from 'jspdf';
import { fmtBRL, monthLabel } from './finance';
import { pdfText } from './month-report';
export type RGB = [number, number, number];
// PDF print palette: independent from the browser theme, with explicit textual labels.
export const PDF_COLORS = { entrada: [37,99,235] as RGB, cinza: [55,65,81] as RGB, verde: [22,128,61] as RGB,
  ambar: [180,110,0] as RGB, vermelho: [200,30,30] as RGB, roxo: [109,40,217] as RGB,
  magenta: [156,38,103] as RGB, nc: [110,110,110] as RGB, linha: [220,220,220] as RGB };
export const PDF_MARGIN = 10;
export const pdfMoney = (v: number) => pdfText(fmtBRL(v));
export function createPdf() { return new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); }
export function sectionHeader(doc: jsPDF, label: string, color: RGB) {
  doc.setFillColor(...color); doc.rect(PDF_MARGIN, PDF_MARGIN, doc.internal.pageSize.getWidth()-2*PDF_MARGIN,10,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(255,255,255);
  doc.text(doc.splitTextToSize(pdfText(label),doc.internal.pageSize.getWidth()-2*PDF_MARGIN-6),PDF_MARGIN+3,PDF_MARGIN+7);
}
export function pdfFooter(doc: jsPDF, month: string, label: string, generatedAt: Date) {
  const stamp = new Intl.DateTimeFormat('pt-BR',{ timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false }).format(generatedAt).replace(',','');
  const pages = doc.getNumberOfPages();
  for(let p=1;p<=pages;p++) {
    doc.setPage(p); doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...PDF_COLORS.nc);
    const y = doc.internal.pageSize.getHeight()-5;
    doc.text(pdfText(`${label} · ${monthLabel(month)}`),PDF_MARGIN,y);
    doc.text(pdfText(`Gerado em ${stamp} · Página ${p} de ${pages}`),doc.internal.pageSize.getWidth()-PDF_MARGIN,y,{align:'right'});
  }
}
export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30_000);
}