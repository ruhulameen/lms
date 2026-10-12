import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { firstParam, listHref as href, type SearchParams } from "@/lib/table-params";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  // Search-param value used for sorting; also the React key.
  key: string;
  header: string;
  // Renders the header as a sort link; the page must whitelist `key` (see sortParams).
  sortable?: boolean;
  cell: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  // Path of the list page, e.g. "/admin/users"; links are built from it.
  basePath: string;
  // The page's raw searchParams; every param is kept when sorting or paging.
  searchParams: SearchParams;
  // Active sort, as parsed by sortParams().
  sort?: { sort: string; order: "asc" | "desc" };
  page: number;
  pageSize: number;
  total: number;
  // Usually a <DataTableToolbar> with a search box and filters.
  toolbar?: ReactNode;
  // Shown when rows is empty.
  emptyTitle?: string;
  emptyDescription?: string;
  // Accessible name of the table.
  caption: string;
};

// Page numbers around the current one, with gaps shown as 0 (an ellipsis).
function pageWindow(page: number, pages: number) {
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return list.flatMap((n, i) => (i > 0 && n - list[i - 1] > 1 ? [0, n] : [n]));
}

// "Showing x-y of n" plus page links, shared by tables and other paged lists.
export function ListPagination({
  basePath,
  searchParams,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  searchParams: SearchParams;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t p-3 text-sm text-slate-500 sm:flex-row sm:p-4">
      <p>
        {total === 0 ? "No results" : `Showing ${first}-${last} of ${total}`}
      </p>
      {pages > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={href(basePath, searchParams, { page: String(Math.max(1, page - 1)) })}
                aria-disabled={page <= 1}
                className={cn(page <= 1 && "pointer-events-none opacity-50")}
              />
            </PaginationItem>
            {pageWindow(page, pages).map((n, i) => (
              <PaginationItem key={`${n}-${i}`}>
                {n === 0 ? (
                  <span aria-hidden className="px-2">...</span>
                ) : (
                  <PaginationLink
                    href={href(basePath, searchParams, { page: n === 1 ? undefined : String(n) })}
                    isActive={n === page}
                  >
                    {n}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href={href(basePath, searchParams, { page: String(Math.min(pages, page + 1)) })}
                aria-disabled={page >= pages}
                className={cn(page >= pages && "pointer-events-none opacity-50")}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

// Server-rendered table: sorting and paging are plain links over URL params.
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  basePath,
  searchParams,
  sort,
  page,
  pageSize,
  total,
  toolbar,
  emptyTitle = "Nothing found",
  emptyDescription = "Try changing or clearing the filters.",
  caption,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      {toolbar && <div className="border-b p-3 sm:p-4">{toolbar}</div>}

      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              {columns.map((column) => {
                const active = sort?.sort === column.key;
                const nextOrder = active && sort.order === "asc" ? "desc" : "asc";
                const SortIcon = !active ? ArrowUpDown : sort.order === "asc" ? ArrowUp : ArrowDown;
                return (
                  <TableHead
                    key={column.key}
                    className={column.className}
                    aria-sort={
                      active ? (sort.order === "asc" ? "ascending" : "descending") : undefined
                    }
                  >
                    {column.sortable ? (
                      <Link
                        href={href(basePath, searchParams, {
                          sort: column.key,
                          order: nextOrder,
                          page: undefined,
                        })}
                        className="-mx-1 inline-flex items-center gap-1 rounded px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        {column.header}
                        <SortIcon
                          className={cn("size-3.5", !active && "opacity-40")}
                          aria-hidden
                        />
                      </Link>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ListPagination
        basePath={basePath}
        searchParams={searchParams}
        page={page}
        pageSize={pageSize}
        total={total}
      />
    </div>
  );
}

type DataTableToolbarProps = {
  // Same basePath as the table; the form submits here with GET.
  basePath: string;
  // Current sort params are carried through so filtering keeps the order.
  searchParams: SearchParams;
  // Name of the search param.
  searchName?: string;
  searchPlaceholder?: string;
  // Other params to carry through a submit (view, folder, ...).
  keepParams?: string[];
  // Filter controls, e.g. <FilterSelect> or date inputs.
  children?: ReactNode;
};

// GET form: search box plus filters. Submitting resets to page 1.
export function DataTableToolbar({
  basePath,
  searchParams,
  searchName = "q",
  searchPlaceholder = "Search",
  keepParams = [],
  children,
}: DataTableToolbarProps) {
  return (
    <form
      method="get"
      action={basePath}
      role="search"
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
    >
      {["sort", "order", ...keepParams].map((name) => {
        const value = firstParam(searchParams[name]);
        return value ? <input key={name} type="hidden" name={name} value={value} /> : null;
      })}
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <Input
          type="search"
          name={searchName}
          defaultValue={firstParam(searchParams[searchName])}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="pl-8"
        />
      </div>
      {children}
      <div className="flex gap-2">
        <Button type="submit">Apply</Button>
        <Button variant="ghost" render={<Link href={basePath} />}>
          Reset
        </Button>
      </div>
    </form>
  );
}

type FilterSelectProps = {
  name: string;
  // Accessible label, also shown as the "all" option.
  label: string;
  options: { value: string; label: string }[];
  searchParams: SearchParams;
};

// Native select so the filter works in a plain GET form with no client JS.
export function FilterSelect({ name, label, options, searchParams }: FilterSelectProps) {
  return (
    <select
      name={name}
      aria-label={label}
      defaultValue={firstParam(searchParams[name]) ?? ""}
      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
