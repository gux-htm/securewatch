import { useQueryClient } from "@tanstack/react-query";
import { 
  useListDevices, 
  useRegisterDevice, 
  useUpdateDevice, 
  useDeleteDevice, 
  useVerifyDevice,
  getListDevicesQueryKey 
} from "@workspace/api-client-react";

export function useDevices() {
  const queryClient = useQueryClient();
  const list = useListDevices();

  const register = useRegisterDevice({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() }) }
  });

  const update = useUpdateDevice({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() }) }
  });

  const remove = useDeleteDevice({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() }) }
  });

  const verify = useVerifyDevice();

  return { list, register, update, remove, verify };
}
