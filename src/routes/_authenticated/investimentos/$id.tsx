import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, Pencil } from 'lucide-react';
import { investmentsQuery, cdiQuery, contributionsQuery } from '@/lib/investments.queries';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/ui';
import { CdiStatus } from '@/components/app/CdiStatus';
import { InvestmentDetail } from '@/components/app/InvestmentDetail';
import { InvestmentForm } from '@/components/app/InvestmentForm';

export const Route = createFileRoute('/_authenticated/investimentos/$id')({
  head: () => ({ meta: [{ title: 'Projeção do investimento — Finanças Pessoais' }, { name: 'description', content: 'Saldos mensais, rendimentos e cenários do investimento.' }, { property: 'og:title', content: 'Projeção do investimento — Finanças Pessoais' }, { property: 'og:description', content: 'Saldos mensais, rendimentos e cenários do investimento.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(investmentsQuery), context.queryClient.ensureQueryData(contributionsQuery)]); }, component: Detail,
});
function Detail() {
  const { id } = Route.useParams(), { data } = useSuspenseQuery(investmentsQuery), { data: cdi } = useQuery(cdiQuery);
  const { data: contributions } = useSuspenseQuery(contributionsQuery);
  const [editing, setEditing] = useState(false), v = data.find(row => row.id === id);
  return <><Button variant="ghost" asChild className="mb-3"><Link to="/investimentos"><ArrowLeft className="h-4 w-4" />Investimentos</Link></Button>{v ? <><PageHeader title={v.nome}><Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />Editar</Button></PageHeader><CdiStatus /><InvestmentDetail key={`${v.id}-${v.aporte_mensal}-${v.taxa_anual}-${v.horizonte_anos}-${v.data_inicio}-${v.valor_inicial}-${v.capitalizacao}-${v.percentual_cdi}`} investment={v} contributions={contributions.filter(c => c.investment_id === v.id)} cdi={cdi?.rate?.taxa_anual ?? null} />{editing && <InvestmentForm investment={v} close={() => setEditing(false)} />}</> : <p className="py-10">Investimento não encontrado.</p>}</>;
}