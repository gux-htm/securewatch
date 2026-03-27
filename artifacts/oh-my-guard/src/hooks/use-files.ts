import { useQueryClient } from "@tanstack/react-query";
import { 
  useListFileEvents,
  getListFileEventsQueryKey
} from "@workspace/api-client-react";

export function useFiles() {
  const list = useListFileEvents({ limit: 200 });
  return { list };
}
