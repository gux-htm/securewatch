import { useQueryClient } from "@tanstack/react-query";
import { 
  useListFirewallRules, 
  useCreateFirewallRule, 
  useUpdateFirewallRule, 
  useDeleteFirewallRule,
  getListFirewallRulesQueryKey 
} from "@workspace/api-client-react";

export function useFirewall() {
  const queryClient = useQueryClient();
  const list = useListFirewallRules();

  const create = useCreateFirewallRule({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFirewallRulesQueryKey() }) }
  });

  const update = useUpdateFirewallRule({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFirewallRulesQueryKey() }) }
  });

  const remove = useDeleteFirewallRule({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFirewallRulesQueryKey() }) }
  });

  return { list, create, update, remove };
}
