import React, { useState } from "react";
import { useFiles, useFileHistory } from "@/hooks/use-files";
import { Card, CardContent, Badge } from "@/components/ui-elements";
import { ArrowRight, X, Shield, Cpu, Wifi, User, KeyRound, ChevronRight } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

const AC = { create:"success", edit:"warning", delete:"destructive", rename:"default", view:"outline" } as const;
type AC = typeof AC;
type FE = {
  id:number; file_path?:string; filePath?:string; action:keyof AC;
  created_at?:string; createdAt?:string;
  device_hostname?:string|null;