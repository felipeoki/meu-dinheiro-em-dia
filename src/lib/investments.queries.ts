import { queryOptions } from '@tanstack/react-query';
import { atualizarCdi, listInvestments } from './investments.functions';

export const investmentsQuery = queryOptions({ queryKey: ['investments'], queryFn: () => listInvestments() });
export const cdiQuery = queryOptions({ queryKey: ['cdi'], queryFn: () => atualizarCdi({ data: { force: false } }), staleTime: 12 * 60 * 60 * 1000, refetchInterval: 12 * 60 * 60 * 1000 });