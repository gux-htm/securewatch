import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/accounts";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export function useAccounts() {
  const qc = useQueryClient();
  const key = ["accounts"];

  const list = useQuery({ queryKey: key, queryFn: () => apiFetch(BASE) });

  const create = useMutation({
    mutationFn: (data: any) =>
      apiFetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiFetch(`${BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const suspend = useMutation({
    mutationFn: (id: number) => apiFetch(`${BASE}/${id}/suspend`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const reactivate = useMutation({
    mutationFn: (id: number) => apiFetch(`${BASE}/${id}/reactivate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const revoke = useMutation({
    mutationFn: (id: number) => apiFetch(`${BASE}/${id}/revoke`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { list, create, update, suspend, reactivate, revoke };
}
