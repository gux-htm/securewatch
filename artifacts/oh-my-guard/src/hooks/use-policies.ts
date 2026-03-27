import { useQueryClient } from "@tanstack/react-query";
import { 
  useListPolicies, 
  useCreatePolicy, 
  useUpdatePolicy, 
  useDeletePolicy,
  getListPoliciesQueryKey 
} from "@workspace/api-client-react";

export function usePolicies() {
  const queryClient = useQueryClient();
  const list = useListPolicies();

  const create = useCreatePolicy({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPoliciesQueryKey() }) }
  });

  const update = useUpdatePolicy({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPoliciesQueryKey() }) }
  });

  const remove = useDeletePolicy({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPoliciesQueryKey() }) }
  });

  return { list, create, update, remove };
}
