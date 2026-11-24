import { describe, expect, it } from 'vitest';
import { reportFixture } from './report-fixture';
import { buildMonthReport } from './month-report';
import { buildJessicaReport, buildReimbursementReport } from './receipt-reports';
import { renderReceiptReportPdf } from './receipt-reports-pdf';
import { fmtBRL } from './finance';
import { execFileSync } from 'node:child_process';

const f=reportFixture();
const month=buildMonthReport({...f,month:'2026-11',today:'2026-11-12',activeProvisionTxIds:new Set()});
const reimb=buildReimbursementReport({...f,month:'2026-11'});
const hers=buildJessicaReport({...f,month:'2026-11'});
const near=(a:number,b:number)=>expect(Math.abs(a-b)).toBeLessThanOrEqual(0.01);
describe('PDF reporting accounting and privacy',()=>{
  it('monthly C1 preserves spreadsheet totals with Jessica present',()=>{
    near(month.c1.contas,6599.995);near(month.c1.pago,1846.60);near(month.c1.falta,4753.395);near(month.c1.atrasado,3102.675);near(month.c1.pctPago,27.98);near(month.c1.restara,967.005);
  });
  it('monthly C2 and savings exclude Jessica and reimbursements',()=>{near(month.c2.contas,7555.27);near(month.c2.restara,11.73);near(month.restaraMes,2978.735);});
  it('monthly transaction tables never contain Jessica',()=>{
    const ids=new Set(f.hers.map(t=>t.id));expect([...month.c1.rows,...month.c2.rows].some(t=>ids.has(t.id))).toBe(false);
    expect(month.naoContabilizados.map(t=>t.descricao)).toEqual(['BYD','IA EXPERIENCE']);
    near(month.outside.total,3075.32);near(month.outside.jessica,2654.72);near(month.outside.reembolsos,420.60);
  });
  it('reimbursements: monthly totals 420.60, 355 pending, 65.60 received',()=>{near(reimb.totals.total,420.60);near(reimb.totals.pendente,355);near(reimb.totals.recebido,65.60);});
  it('reimbursements: other-month annex 100 and accumulated 455',()=>{expect(reimb.pendingOther.map(t=>t.descricao)).toEqual(['TESTE-OUT']);near(reimb.pendingOtherTotal,100);near(reimb.pendingAccumulated,455);});
  it('reimbursements exclude even non-accounted Jessica rows',()=>{
    const r=buildReimbursementReport({...f,txs:[...f.felipe,...f.reimb,...f.hers.map(t=>({...t,nao_contabilizar:true}))],month:'2026-11'});
    near(r.totals.total,420.60);expect(r.groups.flatMap(g=>g.rows).map(t=>t.id).sort()).toEqual(['r1','r2']);
  });
  it('Jessica November 2654.72 pending, zero received',()=>{near(hers.totals.total,2654.72);near(hers.totals.recebido,0);near(hers.totals.pendente,2654.72);});
  it('Jessica Empresa 2623.82 / 27 and Pessoal 30.90 / 1',()=>{
    const empresa=hers.groups.find(g=>g.nome==='Nubank Empresa'),pessoal=hers.groups.find(g=>g.nome==='Nubank Pessoal');
    expect(empresa?.rows).toHaveLength(27);near(empresa?.total??NaN,2623.82);expect(pessoal?.rows).toHaveLength(1);near(pessoal?.total??NaN,30.90);
  });
  it('Jessica next 6 months use only registered rows',()=>{
    expect(hers.upcoming.map(t=>t.mes)).toEqual(['2026-12','2027-01','2027-02','2027-03','2027-04','2027-05']);
    hers.upcoming.forEach((t,i)=>{const expected=[1126.07,638.38,638.38,488.38,96.43,96.43][i];if(expected===undefined)throw new Error('Expected month missing');near(t.total,expected);});
  });
  it('Jessica receipt 295.24 changes pending to 2359.48',()=>{
    const r=buildJessicaReport({...f,month:'2026-11',txs:f.txs.map(t=>t.responsavel==='Jéssica'&&t.descricao==='Posto Guaçu Brasil'&&t.valor===295.24?{...t,recebido:true,recebido_em:'2026-11-20'}:t)});
    near(r.totals.recebido,295.24);near(r.totals.pendente,2359.48);
  });
  it('Jessica document cannot expose any Felipe transaction row',()=>{
    const ids=new Set(f.felipe.map(t=>t.id));expect([...hers.groups.flatMap(g=>g.rows),...hers.pendingOther].some(t=>ids.has(t.id))).toBe(false);
    expect(hers.groups.flatMap(g=>g.rows).map(t=>t.id).sort()).toEqual(f.hers.filter(t=>t.data_vencimento.startsWith('2026-11')).map(t=>t.id).sort());
    const data=JSON.stringify(hers);
    const pdf=renderReceiptReportPdf(hers);
    const extracted=execFileSync('pdftotext',['-','-'],{input:Buffer.from(pdf.output('arraybuffer')),encoding:'utf8'});
    expect(extracted).toContain('Posto Guaçu Brasil');
    for(const privateTerm of ['Aluguel AP','Salário Ciclo','Condomínio AP','Unimed Felipe','FIES']){
      expect(data).not.toContain(privateTerm);
      expect(extracted).not.toContain(privateTerm);
    }
  });
  it('Jessica annex contains previous pending only, not future or received',()=>{
    const r=buildJessicaReport({...f,month:'2026-12'});near(r.pendingOtherTotal,2654.72);expect(r.pendingOther).toHaveLength(28);expect(r.pendingOther.every(t=>t.vencimento.startsWith('2026-11'))).toBe(true);
  });
  it('empty reports remain valid landscape PDFs',()=>{
    for(const builder of [buildJessicaReport,buildReimbursementReport]){const r=builder({...f,txs:[],month:'2026-11'});expect(r.totals.total).toBe(0);expect(r.groups).toHaveLength(0);const pdf=renderReceiptReportPdf(r);expect(pdf.output()).toMatch(/^%PDF/);expect(pdf.internal.pageSize.getWidth()).toBeGreaterThan(pdf.internal.pageSize.getHeight());}
  });
  it('uses dashboard rounding after exact decimal aggregation',()=>{
    const first=f.reimb[0];if(!first)throw new Error('Missing fixture');
    const r=buildReimbursementReport({...f,month:'2026-11',txs:[{...first,valor:49.625},{...first,id:'decimal-2',valor:61.125}]});
    expect(r.totals.total).toBe(110.75);expect(fmtBRL(967.005).replace(/\s/g,' ')).toBe('R$ 967,01');expect(fmtBRL(-1.125).replace(/\s/g,' ')).toBe('-R$ 1,12');
  });
});