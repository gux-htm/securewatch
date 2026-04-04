import React, { useState } from "react";
import { useFiles, useFileHistory } from "@/hooks/use-files";
import { Card, CardContent, Badge } from "@/components/ui-elements";
import { ArrowRight, X, Shield, Cpu, Wifi, User, KeyRound, ChevronRight } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

const AC = { create:"success", edit:"warning", delete:"destructive", rename:"default", view:"outline" } as const;
type FE = { id:number; file_path?:string; filePath?:string; action:keyof typeof AC; created_at?:string; createdAt?:string; device_hostname?:string|null; deviceHostname?:string|null; device_mac?:string|null; deviceMac?:string|null; device_ip?:string|null; deviceIp?:string|null; user_name?:string|null; userName?:string|null; hash_before?:string|null; hashBefore?:string|null; hash_after?:string|null; hashAfter?:string|null; user_signature?:string|null; userSignature?:string|null; privileges_used?:string|null; privilegesUsed?:string|null; device_id?:number|null; deviceId?:number|null; user_id?:number|null; userId?:number|null; };
function N(e:FE){return{id:e.id,filePath:e.file_path??e.filePath??"",action:e.action,createdAt:e.created_at??e.createdAt??"",deviceHostname:e.device_hostname??e.deviceHostname??null,deviceMac:e.device_mac??e.deviceMac??null,deviceIp:e.device_ip??e.deviceIp??null,userName:e.user_name??e.userName??null,hashBefore:e.hash_before??e.hashBefore??null,hashAfter:e.hash_after??e.hashAfter??null,userSignature:e.user_signature??e.userSignature??null,privilegesUsed:e.privileges_used??e.privilegesUsed??null,deviceId:e.device_id??e.deviceId??null,userId:e.user_id??e.userId??null};}
type NE=ReturnType<typeof N>;
type HF="all"|"edit"|"view";

function HD({label,value}:{label:string;value?:string|null}){
  if(!value)return null;
  return(<div className="space-y-1"><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{label}</p><p className="font-mono text-[11px] text-primary break-all bg-background/50 p-2 rounded border border-border/30">{value}</p></div>);
}

function DP({event,onClose}:{event:NE;onClose:()=>void}){
  const [f,setF]=useState<HF>("all");
  const af=f==="edit"?"edit":f==="view"?"view":undefined;
  const hist=useFileHistory(event.filePath,af);
  const items=(Array.isArray(hist.data)?hist.data:[]).map(N);
  const tabs=[{k:"all" as HF,l:"All"},{k:"edit" as HF,l:"Edited"},{k:"view" as HF,l:"Viewed"}];
  return(
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative w-full max-w-xl h-full bg-card border-l border-border/50 overflow-y-auto shadow-2xl flex flex-col">
        <div className="sticky top-0 bg-card/95 backdrop-blur-xl border-b border-border/50 p-5 flex items-start justify-between z-10">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1"><Badge variant={AC[event.action]}>{event.action.toUpperCase()}</Badge><span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span></div>
            <p className="font-mono text-sm text-foreground break-all">{event.filePath}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-5 space-y-5 flex-1">
          <div className="rounded-xl border border-border/50 bg-secondary/20 overflow-hidden">
            <div className="px-4 py-2 bg-secondary/40 border-b border-border/30"><p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Identity &amp; Device</p></div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3"><User className="w-4 h-4 text-primary mt-0.5"/><div><p className="text-[10px] text-muted-foreground uppercase">User</p><p className="text-sm font-medium text-foreground">{event.userName||(event.userId?`User #${event.userId}`:"-")}</p></div></div>
              <div className="flex items-start gap-3"><Cpu className="w-4 h-4 text-primary mt-0.5"/><div><p className="text-[10px] text-muted-foreground uppercase">Hostname</p><p className="text-sm font-medium text-foreground">{event.deviceHostname||(event.deviceId?`Device #${event.deviceId}`:"-")}</p></div></div>
              <div className="flex items-start gap-3"><Wifi className="w-4 h-4 text-primary mt-0.5"/><div><p className="text-[10px] text-muted-foreground uppercase">IP Address</p><p className="font-mono text-sm text-foreground">{event.deviceIp||"-"}</p></div></div>
              <div className="flex items-start gap-3"><Shield className="w-4 h-4 text-primary mt-0.5"/><div><p className="text-[10px] text-muted-foreground uppercase">MAC Address</p><p className="font-mono text-sm text-foreground">{event.deviceMac||"-"}</p></div></div>
              {event.privilegesUsed&&(<div className="col-span-2 flex items-start gap-3"><KeyRound className="w-4 h-4 text-warning mt-0.5"/><div><p className="text-[10px] text-muted-foreground uppercase">Privileges</p><p className="text-sm text-warning">{event.privilegesUsed}</p></div></div>)}
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-secondary/20 overflow-hidden">
            <div className="px-4 py-2 bg-secondary/40 border-b border-border/30"><p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Integrity Hashes (SHA-256)</p></div>
            <div className="p-4 space-y-3">
              {event.hashBefore&&event.hashAfter?(<><HD label="Before" value={event.hashBefore}/><div className="flex items-center gap-2 py-1"><div className="flex-1 h-px bg-border/50"/><ArrowRight className="w-3 h-3 text-primary"/><div className="flex-1 h-px bg-border/50"/></div><HD label="After" value={event.hashAfter}/></>):(<HD label={event.hashAfter?"Current Hash":"Previous Hash"} value={event.hashAfter||event.hashBefore}/>)}
              {!event.hashBefore&&!event.hashAfter&&<p className="text-xs text-muted-foreground italic">No hash recorded.</p>}
            </div>
          </div>
          {event.userSignature&&(<div className="rounded-xl border border-border/50 bg-secondary/20 overflow-hidden"><div className="px-4 py-2 bg-secondary/40 border-b border-border/30"><p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Digital Signature</p></div><div className="p-4"><p className="font-mono text-[10px] text-primary break-all bg-background/50 p-2 rounded border border-border/30">{event.userSignature}</p></div></div>)}
          <div className="rounded-xl border border-border/50 bg-secondary/20 overflow-hidden">
            <div className="px-4 py-3 bg-secondary/40 border-b border-border/30 flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">File History ({items.length})</p>
              <div className="flex bg-background/50 rounded-lg p-0.5 border border-border/30 gap-0.5">
                {tabs.map(t=>(<button key={t.k} onClick={()=>setF(t.k)} className={cn("px-3 py-1 text-[11px] font-medium rounded-md transition-all",f===t.k?"bg-primary text-primary-foreground shadow":"text-muted-foreground hover:text-foreground")}>{t.l}</button>))}
              </div>
            </div>
            <div className="divide-y divide-border/30">
              {hist.isLoading&&<div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>}
              {!hist.isLoading&&items.length===0&&<div className="p-4 text-center text-xs text-muted-foreground">No {f!=="all"?f:""} events found.</div>}
              {items.map((h,i)=>(
                <div key={h.id} className={cn("px-4 py-3 flex items-start gap-3",h.id===event.id&&"bg-primary/5")}>
                  <span className="text-[10px] text-muted-foreground/40 font-mono mt-1 w-5 text-right flex-shrink-0">{items.length-i}</span>
                  <div className="flex-shrink-0 mt-0.5"><Badge variant={AC[h.action]} className="text-[9px] px-1.5 py-0">{h.action.toUpperCase()}</Badge></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground font-mono">{formatDate(h.createdAt)}</span>{h.id===event.id&&<span className="text-[9px] text-primary font-mono">latest</span>}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{h.userName||"-"} · {h.deviceHostname||"-"}{h.deviceIp&&` · ${h.deviceIp}`}</div>
                    {(h.hashAfter||h.hashBefore)&&<p className="text-[10px] font-mono text-primary/70 truncate">{(h.hashAfter||h.hashBefore)!.substring(0,20)}…</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function FileMonitor(){
  const {list}=useFiles();
  const [sel,setSel]=useState<NE|null>(null);
  const files=(Array.isArray(list.data)?list.data:[]).map(N);
  return(
    <div className="space-y-6">
      <div><h1 className="text-3xl font-display font-bold text-foreground">File Integrity Monitoring</h1><p className="text-muted-foreground mt-1">One row per file. Click for full history.</p></div>
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm text-left">
        <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b border-border/50"><tr>
          <th className="px-6 py-4">File</th><th className="px-6 py-4">Action</th><th className="px-6 py-4">Last Modified</th><th className="px-6 py-4">User</th><th className="px-6 py-4">Device / IP</th><th className="px-6 py-4">Hash</th><th className="px-6 py-4 w-8"></th>
        </tr></thead>
        <tbody className="divide-y divide-border/50">
          {files.map(f=>(<tr key={f.filePath} className="hover:bg-secondary/20 cursor-pointer transition-colors" onClick={()=>setSel(f)}>
            <td className="px-6 py-4 max-w-[200px]"><div className="font-medium text-foreground truncate">{f.filePath.split(/[/\\]/).pop()}</div><div className="font-mono text-[10px] text-muted-foreground truncate">{f.filePath}</div></td>
            <td className="px-6 py-4"><Badge variant={AC[f.action]}>{f.action.toUpperCase()}</Badge></td>
            <td className="px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">{formatDate(f.createdAt)}</td>
            <td className="px-6 py-4 text-xs text-muted-foreground">{f.userName||"-"}</td>
            <td className="px-6 py-4"><div className="text-xs text-muted-foreground">{f.deviceHostname||"-"}</div>{f.deviceIp&&<div className="font-mono text-[10px] text-primary">{f.deviceIp}</div>}</td>
            <td className="px-6 py-4 font-mono text-[10px] text-primary">{f.hashAfter?f.hashAfter.substring(0,16)+"…":"-"}</td>
            <td className="px-6 py-4"><ChevronRight className="w-4 h-4 text-muted-foreground"/></td>
          </tr>))}
          {files.length===0&&!list.isLoading&&<tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No monitored files yet.</td></tr>}
          {list.isLoading&&<tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">Loading...</td></tr>}
        </tbody>
      </table></div></CardContent></Card>
      {sel&&<DP event={sel} onClose={()=>setSel(null)}/>}
    </div>
  );
}
