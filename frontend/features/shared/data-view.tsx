"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, type ApiPaginationMeta } from "@/lib/api";
import { formatAppDateTime } from "@/lib/app-time";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render: (item: T, index: number) => React.ReactNode;
};

type DataTablePanelProps<T> = {
  title: string;
  endpoint: string;
  columns: Column<T>[];
  getRowKey: (item: T) => string | number;
  actions?: React.ReactNode;
  onData?: (data: T[]) => void;
  onRowClick?: (item: T) => void;
  rowClassName?: string | ((item: T) => string);
  renderExpandedRow?: (item: T, index: number) => React.ReactNode;
  toolbarContent?: React.ReactNode;
  filterItem?: (item: T) => boolean;
  searchableText?: (item: T) => string;
  searchPlaceholder?: string;
  emptyText?: string;
  singleExpandedRow?: boolean;
  autoRefreshMs?: number;
  refreshSignal?: string | number;
  showTopHorizontalScrollbar?: boolean;
  pagination?: {
    pageSize: number;
    mode?: "client" | "server";
  };
};

export function DataTablePanel<T>({
  title,
  endpoint,
  columns,
  getRowKey,
  actions,
  onData,
  onRowClick,
  rowClassName,
  renderExpandedRow,
  toolbarContent,
  filterItem,
  searchableText,
  searchPlaceholder,
  emptyText,
  singleExpandedRow,
  autoRefreshMs,
  refreshSignal,
  showTopHorizontalScrollbar = true,
  pagination
}: DataTablePanelProps<T>) {
  const { t } = useI18n();
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationMeta, setPaginationMeta] = useState<ApiPaginationMeta | null>(null);
  const previousRefreshSignal = useRef(refreshSignal);
  const trimmedSearch = searchText.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();
  const pageSize = Math.max(pagination?.pageSize ?? 0, 0);
  const isPaginationEnabled = pageSize > 0;
  const isServerPaginated = isPaginationEnabled && pagination?.mode === "server";
  const requestEndpoint = isServerPaginated
    ? withQueryParams(endpoint, {
        take: pageSize,
        skip: (currentPage - 1) * pageSize,
        ...(trimmedSearch ? { q: trimmedSearch } : {})
      })
    : endpoint;

  const load = useCallback(async (background = false) => {
    if (!background) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const result = await apiGet<T[] | T>(requestEndpoint);
      const nextItems = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
      setItems(nextItems);
      setExpandedRows(new Set());
      setPaginationMeta(isServerPaginated ? (result.meta ?? null) : null);
      onData?.(nextItems);
      setError(null);
    } catch (currentError) {
      const message = currentError instanceof Error ? currentError.message : t("error");
      if (!background) {
        setError(message);
        toast.error(message);
      }
    } finally {
      if (!background) {
        setIsLoading(false);
      }
    }
  }, [requestEndpoint, isServerPaginated, onData, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefreshMs || autoRefreshMs <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      void load(true);
    }, autoRefreshMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoRefreshMs, load]);

  useEffect(() => {
    if (previousRefreshSignal.current === refreshSignal) {
      return;
    }

    previousRefreshSignal.current = refreshSignal;
    void load(true);
  }, [load, refreshSignal]);

  useEffect(() => {
    setCurrentPage(1);
    setExpandedRows(new Set());
  }, [endpoint]);

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    setCurrentPage(1);
    setExpandedRows(new Set());
  };

  const prefilteredItems = !isServerPaginated && filterItem ? items.filter(filterItem) : items;
  const filteredItems =
    !isServerPaginated && normalizedSearch && searchableText
      ? prefilteredItems.filter((item) => searchableText(item).toLowerCase().includes(normalizedSearch))
      : prefilteredItems;
  const totalItems = isServerPaginated ? (paginationMeta?.total ?? filteredItems.length) : filteredItems.length;
  const totalPages = isPaginationEnabled ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;
  const rowOffset = isPaginationEnabled ? (isServerPaginated ? (paginationMeta?.skip ?? (currentPage - 1) * pageSize) : (currentPage - 1) * pageSize) : 0;
  const visibleItems = isPaginationEnabled && !isServerPaginated ? filteredItems.slice(rowOffset, rowOffset + pageSize) : filteredItems;
  const paginationFrom = totalItems === 0 ? 0 : rowOffset + 1;
  const paginationTo = isServerPaginated ? Math.min(rowOffset + visibleItems.length, totalItems) : Math.min(rowOffset + visibleItems.length, totalItems);
  const hasExpandedRows = Boolean(renderExpandedRow);
  const canGoPrevious = isPaginationEnabled && currentPage > 1;
  const canGoNext = isPaginationEnabled && currentPage < totalPages;

  useEffect(() => {
    if (isPaginationEnabled && !isServerPaginated && currentPage > totalPages) {
      setCurrentPage(totalPages);
      setExpandedRows(new Set());
    }
  }, [currentPage, isPaginationEnabled, isServerPaginated, totalPages]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
    setExpandedRows(new Set());
  };

  const renderPaginationControls = (position: "top" | "bottom") => {
    if (isLoading || error || !isPaginationEnabled || totalItems === 0) {
      return null;
    }

    return (
      <div
        className={cn(
          "flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
          position === "top" ? "mb-3 border-b pb-3" : "mt-3 border-t pt-3"
        )}
      >
        <div>
          {t("paginationRange", {
            from: paginationFrom,
            to: paginationTo,
            total: totalItems
          })}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="whitespace-nowrap" onClick={() => goToPage(currentPage - 1)} disabled={!canGoPrevious}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {t("previousPage")}
          </Button>
          <span className="min-w-24 text-center">
            {t("paginationPage", {
              page: currentPage,
              total: totalPages
            })}
          </span>
          <Button type="button" variant="outline" size="sm" className="whitespace-nowrap" onClick={() => goToPage(currentPage + 1)} disabled={!canGoNext}>
            {t("nextPage")}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader
        className={cn(
          "flex flex-col items-stretch justify-between gap-3",
          toolbarContent ? "xl:flex-row xl:items-center" : "sm:flex-row sm:items-center"
        )}
      >
        <CardTitle className="shrink-0 truncate">{title}</CardTitle>
        {toolbarContent ? <div className="min-w-0 flex-1">{toolbarContent}</div> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {searchableText ? (
            <label className="relative min-w-0 sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">{searchPlaceholder ?? t("quickSearch")}</span>
              <Input
                value={searchText}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={searchPlaceholder ?? t("quickSearch")}
                className="h-9 pl-8"
              />
            </label>
          ) : null}
          {actions}
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden="true" />
            {t("retry")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("loading")}</div> : null}
        {error ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
        {!isLoading && !error && visibleItems.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            {items.length > 0 && normalizedSearch ? t("noMatchedData") : (emptyText ?? t("empty"))}
          </div>
        ) : null}
        {renderPaginationControls("top")}
        {!isLoading && !error && visibleItems.length > 0 ? (
          <div>
            <Table showTopScrollbar={showTopHorizontalScrollbar} topScrollbarLabel={t("tableTopScrollbar")}>
              <TableHeader>
                <TableRow>
                  {hasExpandedRows ? (
                    <TableHead className="w-10 min-w-10">
                      <span className="sr-only">{t("viewDetails")}</span>
                    </TableHead>
                  ) : null}
                  {columns.map((column) => (
                    <TableHead key={column.key} className={column.className}>
                      {column.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((item, rowIndex) => {
                  const rowKey = getRowKey(item);
                  const normalizedRowKey = String(rowKey);
                  const isExpanded = expandedRows.has(normalizedRowKey);
                  const absoluteRowIndex = rowOffset + rowIndex;
                  const currentRowClassName = typeof rowClassName === "function" ? rowClassName(item) : rowClassName;
                  const activateRow = () => {
                    if (renderExpandedRow) {
                      setExpandedRows((current) => {
                        if (singleExpandedRow) {
                          return current.has(normalizedRowKey) ? new Set() : new Set([normalizedRowKey]);
                        }

                        const next = new Set(current);
                        if (next.has(normalizedRowKey)) {
                          next.delete(normalizedRowKey);
                        } else {
                          next.add(normalizedRowKey);
                        }
                        return next;
                      });
                      return;
                    }

                    onRowClick?.(item);
                  };

                  return (
                    <Fragment key={rowKey}>
                      <TableRow
                        className={cn(
                          (onRowClick || renderExpandedRow) &&
                            "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                          isExpanded && "bg-muted/40",
                          currentRowClassName
                        )}
                        tabIndex={onRowClick || renderExpandedRow ? 0 : undefined}
                        aria-expanded={renderExpandedRow ? isExpanded : undefined}
                        onClick={onRowClick || renderExpandedRow ? activateRow : undefined}
                        onKeyDown={
                          onRowClick || renderExpandedRow
                            ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  activateRow();
                                }
                              }
                            : undefined
                        }
                      >
                        {hasExpandedRows ? (
                          <TableCell className="w-10 min-w-10">
                            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} aria-hidden="true" />
                          </TableCell>
                        ) : null}
                        {columns.map((column) => (
                          <TableCell key={column.key} className={column.className}>
                            {column.render(item, absoluteRowIndex)}
                          </TableCell>
                        ))}
                      </TableRow>
                      {renderExpandedRow && isExpanded ? (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={columns.length + 1} className="p-0">
                            {renderExpandedRow(item, absoluteRowIndex)}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
        {renderPaginationControls("bottom")}
      </CardContent>
    </Card>
  );
}

function withQueryParams(endpoint: string, params: Record<string, string | number>) {
  const [path, rawQuery = ""] = endpoint.split("?");
  const searchParams = new URLSearchParams(rawQuery);

  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

export function StatusBadge({ value }: { value?: string | boolean | null }) {
  const { t } = useI18n();
  const rawText = typeof value === "boolean" ? (value ? "ACTIVE" : "INACTIVE") : value || "-";
  const normalized = String(rawText).toUpperCase();
  const text = getStatusLabel(normalized, rawText, t);
  const variant =
    normalized.includes("NG") ||
    normalized.includes("ERROR") ||
    normalized.includes("FAILED") ||
    normalized.includes("DISABLED") ||
    normalized.includes("INACTIVE") ||
    normalized.includes("OFFLINE") ||
    normalized.includes("DISCONNECTED")
      ? "destructive"
      : normalized.includes("PENDING") || normalized.includes("WARNING") || normalized.includes("UNKNOWN")
        ? "outline"
        : normalized.includes("OK") || normalized.includes("ACTIVE") || normalized.includes("ONLINE") || normalized.includes("RUNNING") || normalized.includes("DONE")
          ? "default"
          : "secondary";

  return <Badge variant={variant}>{text}</Badge>;
}

export function DateText({ value }: { value?: string | Date | null }) {
  const { locale } = useI18n();

  if (!value) {
    return <span className="text-muted-foreground">-</span>;
  }

  return <span className="whitespace-nowrap">{formatAppDateTime(value, locale)}</span>;
}

export function MonoText({ value }: { value?: string | number | null }) {
  return <span className="font-mono text-xs">{value ?? "-"}</span>;
}

function getStatusLabel(normalized: string, rawText: string | boolean | number, t: ReturnType<typeof useI18n>["t"]) {
  if (normalized === "ACTIVE") return t("active");
  if (normalized === "INACTIVE" || normalized === "DISABLED") return t("inactive");
  if (normalized === "ACTIVATED") return t("activated");
  if (normalized === "NOT_ACTIVE") return t("notActive");
  if (normalized === "PENDING") return t("pending");
  if (normalized === "UNKNOWN") return t("unknown");
  if (normalized === "ONLINE") return t("online");
  if (normalized === "OFFLINE") return t("offline");
  if (normalized === "RUNNING") return t("statusRunning");
  if (normalized === "STOPPED") return t("statusStopped");
  if (normalized === "DISCONNECTED") return t("statusDisconnected");
  if (normalized === "NEW") return t("statusNew");
  if (normalized === "SENT") return t("statusSent");
  if (normalized === "PROCESSING") return t("statusProcessing");
  if (normalized === "CANCELLED") return t("statusCancelled");
  if (normalized === "READ") return t("statusRead");
  if (normalized === "DISMISSED") return t("statusDismissed");
  if (normalized === "DONE") return t("statusDone");
  if (normalized === "FAILED") return t("statusFailed");
  if (normalized === "ERROR") return t("statusError");
  if (normalized === "WARNING") return t("statusWarning");
  return String(rawText);
}
