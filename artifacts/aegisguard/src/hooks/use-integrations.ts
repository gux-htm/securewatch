import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/integrations";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export function useIntegrations() {
  const qc = useQueryClient();
  const key = ["integrations"];

  const list = useQuery({
    queryKey: key,
    queryFn: () => apiFetch(BASE),
    refetchInterval: 30000,
  });

  const create = useMutation({
    mutationFn: (data: any) =>
      apiFetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const heartbeat = useMutation({
    mutationFn: ({ id, status }: { id: number; status?: string }) =>
      apiFetch(`${BASE}/${id}/heartbeat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { list, create, heartbeat, remove };
}
