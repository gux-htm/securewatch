import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetDashboardStats,
  getGetDashboardStatsQueryKey 
} from "@workspace/api-client-react";

export function useDashboard() {
  const queryClient = useQueryClient();
  const stats = useGetDashboardStats({ query: { refetchInterval: 30000 } });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
  };

  return { stats, invalidate };
}
