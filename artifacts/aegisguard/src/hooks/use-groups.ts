import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/groups";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export function useGroups() {
  const qc = useQueryClient();
  const key = ["groups"];

  const list = useQuery({ queryKey: key, queryFn: () => apiFetch(BASE) });

  const create = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
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

  const getMembers = (groupId: number) =>
    useQuery({ queryKey: ["group-members", groupId], queryFn: () => apiFetch(`${BASE}/${groupId}/members`) });

  const addMember = useMutation({
    mutationFn: ({ groupId, accountId, username }: { groupId: number; accountId: number; username: string }) =>
      apiFetch(`${BASE}/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, username }),
      }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["group-members", vars.groupId] }),
  });

  const removeMember = useMutation({
    mutationFn: ({ groupId, memberId }: { groupId: number; memberId: number }) =>
      apiFetch(`${BASE}/${groupId}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["group-members", vars.groupId] });
      qc.invalidateQueries({ queryKey: key });
    },
  });

  return { list, create, remove, getMembers, addMember, removeMember };
}
