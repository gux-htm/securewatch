import { 
  useListAuditLogs,
} from "@workspace/api-client-react";

export function useAudit() {
  const list = useListAuditLogs({ limit: 500 });
  return { list };
}
