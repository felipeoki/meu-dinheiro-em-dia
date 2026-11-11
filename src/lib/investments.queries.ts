import { queryOptions } from '@tanstack/react-query';
import { atualizarCdi, listInvestments } from './investments.functions';
import { listContributions } from './contributions.functions';

export const investmentsQuery = queryOptions({ queryKey: ['investments'], queryFn: () => listInvestments() });
export const contributionsQuery = queryOptions({ queryKey: ['investment-contributions'], queryFn: () => listContributions() });
export const cdiQuery = queryOptions({ queryKey: ['cdi'], queryFn: () => atualizarCdi({ data: { force: false } }), staleTime: 12 * 60 * 60 * 1000, refetchInterval: 12 * 60 * 60 * 1000 });