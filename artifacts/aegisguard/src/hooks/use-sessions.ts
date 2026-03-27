import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/sessions";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export function useSessions(search?: string) {
  const qc = useQueryClient();
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  const url = `${BASE}${qs.toString() ? `?${qs}` : ""}`;

  const list = useQuery({
    queryKey: ["sessions", search],
    queryFn: () => apiFetch(url),
    refetchInterval: 10000,
  });

  const terminate = useMutation({
    mutationFn: ({ id, terminatedBy }: { id: number; terminatedBy?: string }) =>
      apiFetch(`${BASE}/${id}/terminate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terminatedBy }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });

  return { list, terminate };
}
