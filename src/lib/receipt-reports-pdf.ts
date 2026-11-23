import autoTable from 'jspdf-autotable';
import type { jsPDF } from 'jspdf';
import { fmtDate, monthLabel } from './finance';
import { pdfText } from './month-report';
import { createPdf, PDF_COLORS as C, PDF_MARGIN as M, pdfMoney as money, pdfFooter, sectionHeader } from './pdf-common';
import type { ReceiptReport, ReceiptRow } from './receipt-reports';

export function renderReceiptReportPdf(r: ReceiptReport, generatedAt = new Date()): jsPDF {
  const doc = createPdf(), W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight();
  const hers=r.kind==='jessica', accent=hers?C.magenta:C.entrada;
  const title = `${hers?'Contas da Jéssica':'Reembolsos (não contabilizados)'} · ${monthLabel(r.month)}`;
  sectionHeader(doc,title,accent);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...C.cinza);
  doc.text(pdfText(hers?'Valores a acertar com o Felipe':'Itens pagos por mim e que serão reembolsados; não entram nos meus totais.'),M,27);
  const bw=(W-2*M-8)/3;
  const metrics = hers ? [['Total do mês',r.totals.total,C.cinza],['Já recebido',r.totals.recebido,C.verde],['A receber',r.totals.pendente,C.ambar]] as const
    : [['Total do mês',r.totals.total,C.cinza],['A receber',r.totals.pendente,C.ambar],['Recebido',r.totals.recebido,C.verde]] as const;
  metrics.forEach(([label,value,c],i)=>{
    const x=M+i*(bw+4); doc.setDrawColor(...C.linha); doc.rect(x,32,bw,19);
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...C.cinza); doc.text(pdfText(label),x+3,38);
    doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(...c); doc.text(money(value),x+3,47);
  });
  doc.setFillColor(...C.linha); doc.rect(M,55,W-2*M-40,3,'F');
  doc.setFillColor(...C.verde); doc.rect(M,55,(W-2*M-40)*Math.min(100,Math.max(0,r.totals.percentual))/100,3,'F');
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...C.cinza);
  doc.text(`${r.totals.percentual.toFixed(2).replace('.',',')}% recebido`,W-M,58,{align:'right'});
  let y=67;
  const room = (height: number) => { if(y+height>H-16){ doc.addPage(); y=M+4; } };
  const label = (text: string) => {
    room(25); doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...accent);
    const lines=doc.splitTextToSize(pdfText(text),W-2*M); doc.text(lines,M,y); y+=lines.length*4+3;
  };
  const drawRows = (rows: ReceiptRow[], total: number, subtotalLabel: string) => {
    autoTable(doc,{
      startY:y,margin:{left:M,right:M,top:M,bottom:16},theme:'grid',rowPageBreak:'avoid',showHead:'everyPage',showFoot:'lastPage',
      styles:{font:'helvetica',fontSize:8,cellPadding:1.5,textColor:C.cinza,lineColor:C.linha,overflow:'linebreak'},
      headStyles:{fillColor:accent,textColor:255},footStyles:{fillColor:[245,245,245],textColor:C.cinza,fontStyle:'bold'},
      head:[hers?['Vencimento','Descrição','Parcela','Valor','Status']:['Vencimento','Descrição','Categoria','Conta/cartão','Parcela','Valor','Status','Observação']],
      body:rows.map(t=>hers?[fmtDate(t.vencimento),pdfText(t.descricao),t.parcela,money(t.valor),status(t)]
        :[fmtDate(t.vencimento),pdfText(t.descricao),pdfText(t.categoria),pdfText(t.conta),t.parcela,money(t.valor),status(t),pdfText(t.observacao)]),
      foot:[hers?['',pdfText(subtotalLabel),'',money(total),'']:['',pdfText(subtotalLabel),'','','',money(total),'','']],
      columnStyles:hers?{0:{cellWidth:24},1:{cellWidth:137},2:{cellWidth:24},3:{cellWidth:37,halign:'right'},4:{cellWidth:55}}
        :{0:{cellWidth:23},1:{cellWidth:53},2:{cellWidth:32},3:{cellWidth:35},4:{cellWidth:18},5:{cellWidth:28,halign:'right'},6:{cellWidth:36},7:{cellWidth:52}},
      didParseCell:d=>{
        if(d.section==='body' && d.column.index===(hers?4:6)){
          const t=rows[d.row.index]; if(!t)return;
          d.cell.styles.fillColor=t.recebido?[222,240,226]:[253,234,198]; d.cell.styles.fontStyle='bold';
          d.cell.styles.textColor=t.recebido?C.verde:C.ambar;
        }
      },
      didDrawPage:d=>{y=d.cursor?.y??M;},
    });
    y+=9;
  };
  if(!r.groups.length){doc.setFontSize(11);doc.setTextColor(...C.cinza);doc.text('Nenhum item neste mês',M,y);y+=12;}
  for(const group of r.groups){label(group.nome);drawRows(group.rows,group.total,`Subtotal · ${group.nome}`);}
  room(15);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...accent);
  doc.text(`Total geral do mês: ${money(r.totals.total)}`,M,y);y+=13;
  if(hers){
    room(70);label('Próximos meses · somente valores já cadastrados');
    autoTable(doc,{startY:y,margin:{left:M,right:M,top:M,bottom:16},rowPageBreak:'avoid',showHead:'everyPage',theme:'grid',
      styles:{fontSize:9,cellPadding:2,lineColor:C.linha,textColor:C.cinza},headStyles:{fillColor:accent,textColor:255},
      head:[['Mês','Total previsto']],body:r.upcoming.map(t=>[pdfText(monthLabel(t.mes)),money(t.total)]),columnStyles:{1:{halign:'right'}},
      didDrawPage:d=>{y=d.cursor?.y??M;},});y+=10;
  }
  if(!hers || r.pendingOther.length){
    doc.addPage(); y=M+17;
    sectionHeader(doc,hers?'Pendente de meses anteriores':'Pendente de outros meses',accent);
    if(r.pendingOther.length)drawRows(r.pendingOther,r.pendingOtherTotal,'Total pendente do anexo');
    else{doc.setTextColor(...C.cinza);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text('Nenhum item pendente de outros meses.',M,y);y+=12;}
    if(!hers){room(14);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...C.ambar);doc.text(`Pendente acumulado total: ${money(r.pendingAccumulated)}`,M,y);}
  }
  pdfFooter(doc,r.month,hers?'Contas da Jéssica':'Reembolsos',generatedAt);
  return doc;
}
const status=(r: ReceiptRow)=>r.recebido?`Recebido${r.recebidoEm?' '+fmtDate(r.recebidoEm).slice(0,5):''}`:'A receber';
export const receiptReportFileName=(r: Pick<ReceiptReport,'kind'|'month'>)=>`${r.kind==='jessica'?'contas-jessica':'reembolsos'}-${r.month}.pdf`;