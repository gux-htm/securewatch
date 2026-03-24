import { useQueryClient } from "@tanstack/react-query";
import { 
  useListIdsSignatures, 
  useCreateIdsSignature, 
  useListIdsAlerts, 
  useResolveIdsAlert,
  getListIdsSignaturesQueryKey,
  getListIdsAlertsQueryKey
} from "@workspace/api-client-react";

export function useIds() {
  const queryClient = useQueryClient();
  
  const signatures = useListIdsSignatures();
  const createSignature = useCreateIdsSignature({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListIdsSignaturesQueryKey() }) }
  });

  const alerts = useListIdsAlerts({ limit: 100 });
  const resolveAlert = useResolveIdsAlert({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListIdsAlertsQueryKey() }) }
  });

  return { signatures, createSignature, alerts, resolveAlert };
}
