import { Pencil } from 'lucide-react';
import { isPersonalTransaction, fmtBRL, fmtDate, isOverdue, parcelaLabel, type Account, type Category, type Tx } from '@/lib/finance';
import type { Provision } from '@/lib/provisions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CatBadge, Money } from './ui';
import { openTx } from './TxForm';
import { ProvisionAction } from './ProvisionControls';
import { cn } from '@/lib/utils';

type Props = { rows: Tx[]; cats: Category[]; accounts: Account[]; provisions: Provision[]; selected: ReadonlySet<string>; select: (id: string, checked: boolean) => void; pay: (id: string, checked: boolean) => void };
export function TransactionList({ rows, cats, accounts, provisions, selected, select, pay }: Props) {
  const headers = ['Pago', 'Vencimento', 'Descrição', 'Categoria', 'Conta', 'Parcela', 'Valor', 'Ações', 'Seleção'];
  return <div role="table" aria-label="Lista de lançamentos" className="divide-y border-y">
    <div role="row" className="hidden items-center gap-2 py-2 text-xs font-semibold text-muted-foreground lg:grid lg:grid-cols-[2rem_5rem_minmax(0,1fr)_6rem_5rem_3rem_5.5rem_9rem_2.5rem]">
      {headers.map(h => <div role="columnheader" key={h}>{h}</div>)}
    </div>
    {rows.map(t => {
      const provision = provisions.find(p => p.transaction_id === t.id && p.status === 'provisionado');
      const account = accounts.find(a => a.id === t.conta_id)?.nome ?? 'Sem conta';
      return <div role="row" key={t.id} className={cn('grid grid-cols-[1.5rem_minmax(0,1fr)_auto_1.5rem] items-center gap-x-2 gap-y-1 px-1 py-2.5 lg:grid-cols-[2rem_5rem_minmax(0,1fr)_6rem_5rem_3rem_5.5rem_9rem_2.5rem]', isOverdue(t) && 'bg-destructive/10', selected.has(t.id) && 'bg-primary/10')}>
        <div role="cell"><Checkbox aria-label={`Pago: ${t.descricao || 'Sem descrição'}`} checked={t.pago} onCheckedChange={c => pay(t.id, c === true)} /></div>
        <div role="cell" className="hidden text-xs lg:block">{fmtDate(t.data_vencimento)}</div>
        <div role="cell" className="min-w-0">
          <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal p-0 text-left" onClick={() => openTx({ tx: t })}><span className={cn('break-words text-sm font-medium',t.pago && 'text-muted-foreground line-through')}>{t.descricao || 'Sem descrição'}</span></Button>
          <p className="text-[11px] text-muted-foreground lg:hidden">{fmtDate(t.data_vencimento)} · {account} · {parcelaLabel(t)}</p>
          <div className="flex flex-wrap gap-x-2 text-[11px]">
            {t.responsavel === 'Jéssica' && <span className="rounded bg-responsible/10 px-1.5 text-responsible" title="Não entra nas minhas contas">Jéssica</span>}
             {t.nao_contabilizar && <span className="text-warning-foreground">{t.recebido ? 'Recebido' : 'A receber'}</span>}
            {provision && <span className="font-semibold text-primary">Provisionado</span>}
            {isOverdue(t) && !t.nao_contabilizar && <span className="text-destructive">Atrasada</span>}
          </div>
          <span className="lg:hidden"><CatBadge cat={cats.find(c => c.id === t.categoria_id)} /></span>
        </div>
        <div role="cell" className="hidden lg:block"><CatBadge cat={cats.find(c => c.id === t.categoria_id)} /></div>
        <div role="cell" className="hidden break-words text-xs text-muted-foreground lg:block">{account}</div>
        <div role="cell" className="hidden text-xs text-muted-foreground lg:block">{parcelaLabel(t)}</div>
        <div role="cell" className="text-right">{!isPersonalTransaction(t) ? <span title="Não entra nas minhas contas" className="tabular text-xs text-muted-foreground">{fmtBRL(t.valor)}</span> : <Money v={t.valor} tipo={t.tipo} className="text-xs" />}</div>
        <div role="cell" className="col-start-2 col-end-4 flex min-w-0 items-center gap-1 lg:col-auto lg:row-auto">
          <ProvisionAction tx={t} provision={provision} />
          <Button variant="ghost" size="icon" className="hidden h-7 w-7 shrink-0 lg:flex" aria-label={`Editar ${t.descricao}`} title="Editar lançamento" onClick={() => openTx({ tx: t })}><Pencil className="h-3 w-3" /></Button>
        </div>
        <div role="cell" className="col-start-4 row-start-1 lg:col-auto lg:row-auto"><Checkbox aria-label="Selecionar para somar" checked={selected.has(t.id)} onCheckedChange={c => select(t.id,c === true)} /></div>
      </div>;
    })}
  </div>;
}