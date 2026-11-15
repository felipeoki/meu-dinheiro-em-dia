// Draws a MonthReport into an A4 landscape PDF (client-side, jsPDF).
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtBRL, fmtDate, monthLabel } from "./finance";
import { pdfText, type MonthReport, type ReportCycle, type ReportStatus } from "./month-report";

type RGB = [number, number, number];
const C = { entrada: [37, 99, 235] as RGB, cinza: [55, 65, 81] as RGB, verde: [22, 128, 61] as RGB, ambar: [180, 110, 0] as RGB,
  vermelho: [200, 30, 30] as RGB, roxo: [109, 40, 217] as RGB, azulClaro: [125, 180, 230] as RGB, nc: [130, 130, 130] as RGB, linha: [220, 220, 220] as RGB };
const STATUS_FILL: Record<ReportStatus, RGB> = { pago: [200, 235, 205], pendente: [253, 230, 180], atrasado: [248, 200, 200], provisionado: [205, 228, 248] };
const money = (v: number) => pdfText(fmtBRL(v));
const M = 10;

export function renderMonthReportPdf(r: MonthReport, generatedAt: Date = new Date()): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const t = (s: string, x: number, y: number, o?: { align?: "left" | "right" | "center" }) => doc.text(pdfText(s), x, y, o);
  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const title = pdfText(monthLabel(r.month));

  // Page 1
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); color(C.cinza);
  t(`Visão geral de ${title}`, M, M + 6);
  if (r.empty) {
    doc.setFontSize(13); doc.setFont("helvetica", "normal"); t("Nenhum lançamento neste mês.", M, M + 20);
  } else {
    const boxes: [string, number, RGB][] = [["Entradas", r.entradas, C.entrada], ["Total de contas", r.contas, C.cinza], ["Já pago", r.pago, C.verde], ["Falta pagar", r.falta, C.ambar]];
    const bw = (W - 2 * M - 4 * 4) / 5; let x = M; const y = M + 12;
    boxes.forEach(([l, v, c]) => {
      doc.setDrawColor(...C.linha); doc.roundedRect(x, y, bw, 18, 2, 2);
      doc.setFillColor(...c); doc.rect(x, y, 1.5, 18, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); color(C.cinza); t(l.toUpperCase(), x + 4, y + 6);
      doc.setFont("helvetica", "bold"); doc.setFontSize(13); color(c); t(money(v), x + 4, y + 14); x += bw + 4;
    });
    const pos = r.restaraMes >= 0;
    doc.setFillColor(...(pos ? [228, 245, 232] as RGB : [252, 228, 228] as RGB)); doc.setDrawColor(...(pos ? C.verde : C.vermelho));
    doc.roundedRect(x, y, bw, 18, 2, 2, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); color(pos ? C.verde : C.vermelho); t("RESTARÁ PARA GUARDAR NO MÊS", x + 3, y + 6);
    doc.setFontSize(13); t(money(r.restaraMes), x + 3, y + 13);
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); t(`inclui bonificações ${money(r.bonificacoes)}`, x + 3, y + 16.5);

    const cw = (W - 2 * M - 6) / 2; const cy = y + 24;
    [r.c1, r.c2].forEach((c, i) => cycleBlock(doc, c, M + i * (cw + 6), cy, cw));

    let ly = cy + 70;
    autoTable(doc, {
      startY: ly, margin: { left: M, right: W / 2 + 3 }, theme: "grid", styles: { fontSize: 8, cellPadding: 1.4, lineColor: C.linha, textColor: C.cinza },
      headStyles: { fillColor: C.entrada, textColor: 255 }, head: [["Entradas do mês", "Data", "Valor", "Situação"]],
      body: r.incomes.map(i => [pdfText(i.descricao), fmtDate(i.data), money(i.valor), i.recebido ? "Recebido" : "A receber"]),
      columnStyles: { 2: { halign: "right" } },
      didParseCell: d => { if (d.section === "body" && d.column.index === 3) d.cell.styles.fillColor = d.cell.raw === "Recebido" ? STATUS_FILL.pago : STATUS_FILL.pendente; },
    });
    // Legend
    const lx = W / 2 + 6; ly += 2;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); color(C.cinza); t("Legenda de cores", lx, ly + 3);
    const leg: [string, RGB][] = [["Pago", STATUS_FILL.pago], ["Pendente", STATUS_FILL.pendente], ["Atrasado", STATUS_FILL.atrasado], ["Provisionado", STATUS_FILL.provisionado], ["Entrada", C.entrada], ["Não contabilizado", [225, 225, 225]]];
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    leg.forEach(([l, c], i) => { const xx = lx + (i % 3) * 45, yy = ly + 8 + Math.floor(i / 3) * 7; doc.setFillColor(...c); doc.setDrawColor(...C.linha); doc.rect(xx, yy - 3.2, 5, 4, "FD"); t(l, xx + 7, yy); });
    doc.setFontSize(7); color(C.nc);
    t("Mercado: conta como pago só o que estiver marcado como pago; a diferença até o valor da linha \"Mercado Mensal\" fica como falta.", lx, ly + 26);

    // Cycle sections
    [r.c1, r.c2].forEach(c => cycleTable(doc, c));
    // Annexes
    if (r.mercado) {
      const mk = r.mercado;
      doc.addPage(); sectionHeader(doc, "Anexo 1 - Compras do mercado", C.cinza);
      const over = mk.diferenca > 0;
      autoTable(doc, {
        startY: M + 14, margin: { left: M, right: M, bottom: 14 }, theme: "grid", rowPageBreak: "avoid", showHead: "everyPage",
        styles: { fontSize: 8.5, cellPadding: 1.5, lineColor: C.linha, textColor: C.cinza }, headStyles: { fillColor: [90, 90, 90], textColor: 255 },
        head: [["Data", "Descrição", "Situação", "Valor"]], columnStyles: { 3: { halign: "right" } },
        body: mk.compras.map(p => [fmtDate(p.data), pdfText(p.descricao), p.pago ? "Pago" : "Pendente", money(p.valor)]),
        foot: [["", "Total gasto", "", money(mk.gasto)], ["", "Orçamento", "", money(mk.orcamento)],
          ["", over ? "Acima do orçamento (estourou)" : "Abaixo do orçamento", "", money(Math.abs(mk.diferenca))], ["", "Linha Mercado Mensal nos ciclos", "", money(mk.linha)]],
        footStyles: { fillColor: [245, 245, 245], textColor: C.cinza, fontStyle: "bold" },
        didParseCell: d => { if (d.section === "foot" && d.row.index === 2 && over) d.cell.styles.textColor = C.vermelho; },
      });
    }
    if (r.naoContabilizados.length) {
      doc.addPage(); sectionHeader(doc, "Anexo 2 - Não contabilizados (a receber)", C.nc);
      doc.setFontSize(9); doc.setFont("helvetica", "italic"); color(C.nc); t("Não entram nos totais.", M, M + 18);
      autoTable(doc, {
        startY: M + 21, margin: { left: M, right: M, bottom: 14 }, theme: "grid", rowPageBreak: "avoid",
        styles: { fontSize: 8.5, cellPadding: 1.5, lineColor: C.linha, textColor: C.nc }, headStyles: { fillColor: [160, 160, 160], textColor: 255 },
        head: [["Descrição", "Quem reembolsa", "Valor", "Recebido?"]], columnStyles: { 2: { halign: "right" } },
        body: r.naoContabilizados.map(n => [pdfText(n.descricao), pdfText(n.reembolsoDe), money(n.valor), n.recebido ? "Sim" : "Não"]),
      });
    }
  }
  // Footer
  const pages = doc.getNumberOfPages();
  const stamp = `${String(generatedAt.getDate()).padStart(2, "0")}/${String(generatedAt.getMonth() + 1).padStart(2, "0")}/${generatedAt.getFullYear()} ${String(generatedAt.getHours()).padStart(2, "0")}:${String(generatedAt.getMinutes()).padStart(2, "0")}`;
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); color(C.nc);
    t(`Finanças Pessoais · ${title}`, M, doc.internal.pageSize.getHeight() - 5);
    t(`Gerado em ${stamp} · Página ${p} de ${pages}`, W - M, doc.internal.pageSize.getHeight() - 5, { align: "right" });
  }
  return doc;
}

const cycleColor = (c: 1 | 2) => (c === 1 ? C.entrada : C.roxo);

function sectionHeader(doc: jsPDF, label: string, c: RGB) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...c); doc.rect(M, M, W - 2 * M, 10, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(255, 255, 255); doc.text(pdfText(label), M + 3, M + 7);
}

function cycleBlock(doc: jsPDF, c: ReportCycle, x: number, y: number, w: number) {
  const col = cycleColor(c.ciclo);
  doc.setFillColor(...col); doc.rect(x, y, w, 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text(pdfText(`Ciclo ${c.ciclo} (${c.ciclo === 1 ? "dia 08" : "dia 22"})`), x + 3, y + 5.6);
  doc.setDrawColor(...C.linha); doc.rect(x, y, w, 64);
  let yy = y + 14;
  const row = (l: string, v: number, tc: RGB = C.cinza, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(9.5); doc.setTextColor(...C.cinza); doc.text(pdfText(l), x + 3, yy);
    doc.setTextColor(...tc); doc.text(money(v), x + w - 3, yy, { align: "right" }); yy += 6;
  };
  row("Entrada do ciclo", c.entrada, C.entrada);
  row("Total de contas", c.contas, C.cinza, true);
  row("Já pago", c.pago, C.verde);
  const pct = Math.max(0, Math.min(100, c.pctPago));
  doc.setFillColor(235, 235, 235); doc.rect(x + 3, yy - 3.5, w - 30, 3, "F");
  doc.setFillColor(...C.verde); doc.rect(x + 3, yy - 3.5, ((w - 30) * pct) / 100, 3, "F");
  doc.setFontSize(8); doc.setTextColor(...C.cinza); doc.text(pdfText(`${c.pctPago.toFixed(2).replace(".", ",")}% pago`), x + w - 3, yy - 1, { align: "right" }); yy += 5;
  row("Falta pagar", c.falta, C.ambar);
  if (c.atrasado > 0.004) row("Atrasado", c.atrasado, C.vermelho, true);
  row("Lazer do ciclo", c.lazer);
  doc.setDrawColor(...C.linha); doc.line(x + 3, yy - 3.5, x + w - 3, yy - 3.5); yy += 1.5;
  row("Restará para guardar do ciclo", c.restara, c.restara >= 0 ? C.verde : C.vermelho, true);
}

const STATUS_LABEL = (s: ReportStatus, pagoEm: string | null) => s === "pago" ? `Pago${pagoEm ? " " + fmtDate(pagoEm).slice(0, 5) : ""}` : s === "pendente" ? "Pendente" : s === "atrasado" ? "Atrasado" : "Provisionado";

function cycleTable(doc: jsPDF, c: ReportCycle) {
  doc.addPage(); sectionHeader(doc, `Ciclo ${c.ciclo} - lançamentos (${c.ciclo === 1 ? "recebe dia 08" : "recebe dia 22"})`, cycleColor(c.ciclo));
  const statuses = c.rows.map(r => r.status);
  autoTable(doc, {
    startY: M + 13, margin: { left: M, right: M, bottom: 14, top: M }, theme: "grid", rowPageBreak: "avoid", showHead: "everyPage", showFoot: "lastPage",
    styles: { fontSize: 8, cellPadding: 1.3, lineColor: C.linha, textColor: C.cinza, overflow: "linebreak" },
    headStyles: { fillColor: cycleColor(c.ciclo), textColor: 255 },
    head: [["Vencimento", "Descrição", "Categoria", "Conta/cartão", "Parcela", "Valor", "Status", "Pago em"]],
    body: c.rows.length ? c.rows.map(r => [fmtDate(r.vencimento), pdfText(r.descricao), pdfText(r.categoria), pdfText(r.conta), r.parcela, money(r.valor), STATUS_LABEL(r.status, r.pagoEm), r.pagoEm ? fmtDate(r.pagoEm) : ""])
      : [["", "Nenhum lançamento neste ciclo", "", "", "", "", "", ""]],
    foot: [["", "Total", "", "", "", money(c.contas), "", ""], ["", "Pago", "", "", "", money(c.pago), "", ""], ["", "Falta pagar", "", "", "", money(c.falta), "", ""],
      ["", "Lazer", "", "", "", money(c.lazer), "", ""], ["", "Restará para guardar", "", "", "", money(c.restara), "", ""]],
    footStyles: { fillColor: [245, 245, 245], textColor: C.cinza, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 70 }, 4: { cellWidth: 18 }, 5: { halign: "right", cellWidth: 28 }, 6: { cellWidth: 28 }, 7: { cellWidth: 22 } },
    didParseCell: d => {
      if (d.section === "body" && c.rows.length) {
        const s = statuses[d.row.index];
        if (!s) return;
        if (d.column.index === 6) { d.cell.styles.fillColor = STATUS_FILL[s]; d.cell.styles.fontStyle = "bold"; }
        else if (s === "atrasado") d.cell.styles.fillColor = [253, 238, 238];
        else if (s === "pago") d.cell.styles.fillColor = [238, 248, 240];
      }
      if (d.section === "foot" && d.row.index === 4 && d.column.index === 5) d.cell.styles.textColor = c.restara >= 0 ? C.verde : C.vermelho;
    },
  });
}

export const reportFileName = (month: string) => `financas-${month}.pdf`;
