import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/alerts";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export function useAlerts(params?: { severity?: string; acknowledged?: boolean }) {
  const qc = useQueryClient();
  const qs = new URLSearchParams();
  if (params?.severity) qs.set("severity", params.severity);
  if (params?.acknowledged !== undefined) qs.set("acknowledged", String(params.acknowledged));
  const url = `${BASE}${qs.toString() ? `?${qs}` : ""}`;

  const list = useQuery({ queryKey: ["alerts", params], queryFn: () => apiFetch(url) });

  const acknowledge = useMutation({
    mutationFn: ({ id, acknowledgedBy }: { id: number; acknowledgedBy?: string }) =>
      apiFetch(`${BASE}/${id}/acknowledge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledgedBy }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const bulkAcknowledge = useMutation({
    mutationFn: ({ ids, acknowledgedBy }: { ids: number[]; acknowledgedBy?: string }) =>
      apiFetch(`${BASE}/bulk-acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, acknowledgedBy }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const create = useMutation({
    mutationFn: (data: any) =>
      apiFetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  return { list, acknowledge, bulkAcknowledge, create, remove };
}
