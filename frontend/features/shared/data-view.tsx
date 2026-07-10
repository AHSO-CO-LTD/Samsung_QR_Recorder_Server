"use client";

import { useCallback, useEffect, useState } from "react";
import type React from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render: (item: T) => React.ReactNode;
};

type DataTablePanelProps<T> = {
  title: string;
  endpoint: string;
  columns: Column<T>[];
  getRowKey: (item: T) => string | number;
  actions?: React.ReactNode;
  onData?: (data: T[]) => void;
};

export function DataTablePanel<T>({ title, endpoint, columns, getRowKey, actions, onData }: DataTablePanelProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiGet<T[] | T>(endpoint);
      const nextItems = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
      setItems(nextItems);
      onData?.(nextItems);
    } catch (currentError) {
      const message = currentError instanceof Error ? currentError.message : "Không tải được dữ liệu.";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, onData]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <CardTitle className="truncate">{title}</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {actions}
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden="true" />
            Tải lại
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="rounded-md border p-4 text-sm text-muted-foreground">Đang tải dữ liệu...</div> : null}
        {error ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
        {!isLoading && !error && items.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">Chưa có dữ liệu.</div>
        ) : null}
        {!isLoading && !error && items.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key} className={column.className}>
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={getRowKey(item)}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.render(item)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ value }: { value?: string | boolean | null }) {
  const text = typeof value === "boolean" ? (value ? "ACTIVE" : "INACTIVE") : value || "-";
  const normalized = String(text).toUpperCase();
  const variant =
    normalized.includes("NG") ||
    normalized.includes("ERROR") ||
    normalized.includes("FAILED") ||
    normalized.includes("DISABLED") ||
    normalized.includes("INACTIVE") ||
    normalized.includes("OFFLINE")
      ? "destructive"
      : normalized.includes("PENDING") || normalized.includes("WARNING") || normalized.includes("UNKNOWN")
        ? "outline"
        : normalized.includes("OK") || normalized.includes("ACTIVE") || normalized.includes("ONLINE") || normalized.includes("DONE")
          ? "default"
          : "secondary";

  return <Badge variant={variant}>{text}</Badge>;
}

export function DateText({ value }: { value?: string | Date | null }) {
  if (!value) {
    return <span className="text-muted-foreground">-</span>;
  }

  return <span className="whitespace-nowrap">{new Date(value).toLocaleString("vi-VN")}</span>;
}

export function MonoText({ value }: { value?: string | number | null }) {
  return <span className="font-mono text-xs">{value ?? "-"}</span>;
}
