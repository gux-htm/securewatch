import { useQuery } from "@tanstack/react-query";

const BASE = "/api/files";

async function apiFetch(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function useFiles() {
  const list = useQuery({
    queryKey: ["file-latest"],
    queryFn: () => apiFetch(`${BASE}/latest`),
    refetchInterval: 10000,
  });
  return { list };
}

export function useFileHistory(filePath: string | null, action?: string) {
  const qs = action ? `&action=${encodeURIComponent(action)}` : "";
  return useQuery({
    queryKey: ["file-history", filePath, action],
    queryFn: () => apiFetch(`${BASE}/events/history?filePath=${encodeURIComponent(filePath!)}${qs}`),
    enabled: !!filePath,
  });
}
