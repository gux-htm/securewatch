import { useQuery } from "@tanstack/react-query";

export function useMonitoringSummary() {
  return useQuery({
    queryKey: ["monitoring-summary"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/summary");
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json() as Promise<{
        criticalAlertCount: number;
        unacknowledgedAlertCount: number;
        activeSessionCount: number;
        deviceCounts: { trusted: number; blocked: number; inactive: number };
      }>;
    },
    refetchInterval: 30000,
  });
}
