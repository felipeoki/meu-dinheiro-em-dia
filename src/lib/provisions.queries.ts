import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { listProvisions } from './provisions.functions';

export const provisionsQuery = queryOptions({ queryKey: ['provisions'], queryFn: () => listProvisions() });
export function useProvisionRefresh() {
  const qc = useQueryClient();
  return async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ['provisions'] }), qc.invalidateQueries({ queryKey: ['tx'] })]);
  };
}