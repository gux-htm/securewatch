import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/resources";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export function useResources() {
  const qc = useQueryClient();
  const key = ["resources"];

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

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const getAcl = (resourceId: number) =>
    useQuery({ queryKey: ["acl", resourceId], queryFn: () => apiFetch(`${BASE}/${resourceId}/acl`) });

  const grantAcl = useMutation({
    mutationFn: ({ resourceId, data }: { resourceId: number; data: any }) =>
      apiFetch(`${BASE}/${resourceId}/acl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["acl", vars.resourceId] }),
  });

  const revokeAcl = useMutation({
    mutationFn: ({ resourceId, entryId }: { resourceId: number; entryId: number }) =>
      apiFetch(`${BASE}/${resourceId}/acl/${entryId}/revoke`, { method: "PATCH" }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["acl", vars.resourceId] }),
  });

  return { list, create, update, remove, getAcl, grantAcl, revokeAcl };
}
