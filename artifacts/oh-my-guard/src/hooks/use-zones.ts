import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/zones";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export function useZones() {
  const qc = useQueryClient();
  const key = ["zones"];

  const list = useQuery({ queryKey: key, queryFn: () => apiFetch(BASE) });

  const create = useMutation({
    mutationFn: (data: { name: string; cidr: string; description?: string }) =>
      apiFetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { list, create, remove };
}
