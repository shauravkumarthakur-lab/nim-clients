"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return <Button variant="secondary" size="sm" onClick={() => window.print()} className="no-print"><Printer size={14} /> {label}</Button>;
}
