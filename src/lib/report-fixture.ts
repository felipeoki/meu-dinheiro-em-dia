import spreadsheet from './november-2026.json';
import jessica from './jessica-2026.json';
import { buildSeries, type Tx } from './finance';
// Literal spreadsheet input shared by PDF rule tests and offline visual verification.
export function reportFixture() {
  const base = { pago:false,data_pagamento:null,nao_contabilizar:false,reembolso_de:null,recebido:false,recebido_em:null,observacoes:null,bonificacao:false };
  const felipe: Tx[]=spreadsheet.transactions.flatMap((r,n)=>buildSeries({...base,responsavel:'Felipe',tipo:r.tipo==='entrada'?'entrada':'saida',descricao:r.descricao,categoria_id:r.categoria,conta_id:r.conta,valor:r.valor,data_vencimento:`2026-11-${String(r.dia).padStart(2,'0')}`,recorrencia:r.parcelas==='Fixo'?'fixa':r.parcelas==='1'?'unica':'parcelada',bonificacao:r.bonificacao,ciclo:r.ciclo},{parcelasTotal:Number(r.parcelas)||1},`f-${n}`).map((t,i)=>({...t,id:`f-${n}-${i}`,encerrada:false})));
  const hers: Tx[]=jessica.flatMap((r,n)=>buildSeries({...base,responsavel:'Jéssica',tipo:'saida',descricao:r.descricao,categoria_id:r.categoria,conta_id:r.conta,valor:r.valor,data_vencimento:'2026-11-26',recorrencia:r.atual===0?'fixa':r.total>1?'parcelada':'unica'},{parcelasTotal:r.total,parcelasPagas:Math.max(0,r.atual-1)},`j-${n}`).map((t,i)=>({...t,id:`j-${n}-${i}`,encerrada:false})));
  const first=felipe[0];if(!first)throw new Error('Fixture missing');
  const reimbursement=(id:string,descricao:string,valor:number,date:string,received:boolean):Tx=>({...first,...base,id,grupo_id:id,tipo:'saida',recorrencia:'unica',parcela_atual:null,parcelas_total:null,descricao,valor,data_vencimento:date,conta_id:'Nubank Empresa',categoria_id:'Outros',nao_contabilizar:true,reembolso_de:'Time',recebido:received,recebido_em:received?'2026-11-10':null,observacoes:'Ação, atenção, reembolso — conferência ç ã é õ ô'});
  const reimb=[reimbursement('r1','IA EXPERIENCE',355,'2026-11-26',false),reimbursement('r2','BYD',65.60,'2026-11-26',true),reimbursement('r3','TESTE-OUT',100,'2026-10-26',false)];
  const paid=felipe.map(t=>['Aluguel AP','Luz'].includes(t.descricao)&&t.data_vencimento.startsWith('2026-11')?{...t,pago:true,data_pagamento:'2026-11-08'}:t);
  return { felipe:paid,hers,reimb,txs:[...paid,...hers,...reimb],categories:[...new Set([...felipe,...hers].map(r=>r.categoria_id??''))].map(n=>({id:n,nome:n})),accounts:spreadsheet.accounts.map(a=>({id:a.nome,nome:a.nome})),settings:{orcamento_mercado:1200,lazer_por_ciclo:500,dia_corte_ciclo:24,dia_fechamento_cartao:26} };
}