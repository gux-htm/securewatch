import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/settings";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function useSettings() {
  const qc = useQueryClient();
  const key = ["settings"];

  const settings = useQuery({ queryKey: key, queryFn: () => apiFetch(BASE) });

  const save = useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiFetch(BASE, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { settings, save };
}
