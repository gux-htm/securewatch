import { useQueryClient } from "@tanstack/react-query";
import { 
  useListNetworks, 
  useCreateNetwork, 
  useDeleteNetwork, 
  useGenerateOvpn,
  getListNetworksQueryKey 
} from "@workspace/api-client-react";

export function useNetworks() {
  const queryClient = useQueryClient();
  const list = useListNetworks();

  const create = useCreateNetwork({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNetworksQueryKey() }) }
  });

  const remove = useDeleteNetwork({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNetworksQueryKey() }) }
  });

  const genOvpn = useGenerateOvpn();

  return { list, create, remove, genOvpn };
}
