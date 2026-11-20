'use client';

// Report page frame scaffolded like ResourcePage: Layout header (title, period, search,
// collapsible filters) + content. Period lives in the URL (?tu=&den=) so it survives reloads.
import type {ReactNode} from 'react';
import {useCallback, useState, useTransition} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Grid} from '@astryxdesign/core/Grid';
import {Text, Heading} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {Icon} from '@astryxdesign/core/Icon';
import {Table, type TableColumn} from '@astryxdesign/core/Table';
import {Pagination} from '@astryxdesign/core/Pagination';
import {Card} from '@astryxdesign/core/Card';
import {FunnelIcon} from '@heroicons/react/24/outline';
import type {ISODate} from './format';

export const PAGE_SIZE = 20;

type ShellProps = {
  title: string;
  description?: string;
  /** Period inputs (tu / den). Off for screens that are not period based. */
  tu?: string;
  den?: string;
  search?: {value: string; onChange: (v: string) => void; placeholder?: string};
  /** Content of the collapsible filter section. */
  filters?: ReactNode;
  filterCount?: number;
  actions?: ReactNode;
  /** Extra controls placed beside the period inputs (e.g. customer picker). */
  toolbar?: ReactNode;
  children: ReactNode;
};

export function ReportShell({title, description, tu, den, search, filters, filterCount = 0, actions, toolbar, children}: ShellProps) {
  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={3}>
            <HStack vAlign="center" hAlign="between" gap={3} wrap="wrap">
              <VStack gap={1}>
                <Heading level={2}>{title}</Heading>
                {description && (
                  <Text type="body" color="secondary" size="sm">
                    {description}
                  </Text>
                )}
              </VStack>
              {actions}
            </HStack>
            <HStack gap={2} vAlign="end" wrap="wrap">
              {tu && den && <PeriodFilter tu={tu} den={den} />}
              {toolbar}
              {search && (
                <TextInput
                  label="Tìm kiếm"
                  isLabelHidden
                  type="search"
                  value={search.value}
                  onChange={search.onChange}
                  placeholder={search.placeholder ?? 'Tìm kiếm…'}
                  hasClear
                />
              )}
            </HStack>
            {filters && (
              <Collapsible
                defaultIsOpen={false}
                chevronPosition="start"
                trigger={
                  <HStack gap={1} vAlign="center">
                    <Icon icon={FunnelIcon} size="sm" />
                    <Text type="body" size="sm" weight="semibold">
                      {filterCount ? `Bộ lọc (${filterCount} đang áp dụng)` : 'Bộ lọc'}
                    </Text>
                  </HStack>
                }>
                <Grid columns={{minWidth: 200}} gap={3}>
                  {filters}
                </Grid>
              </Collapsible>
            )}
          </VStack>
        </LayoutHeader>
      }
      content={<LayoutContent>{children}</LayoutContent>}
    />
  );
}

/** Updates the URL search params; the server component re-queries for the new period. */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const set = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      start(() => router.push(`${pathname}?${next.toString()}`));
    },
    [router, pathname, sp],
  );
  return {set, pending};
}

function PeriodFilter({tu, den}: {tu: string; den: string}) {
  const {set} = useUrlParams();
  return (
    <>
      <DateInput label="Từ ngày" value={tu as ISODate} max={den as ISODate} format="system_date" onChange={v => v && set({tu: v})} />
      <DateInput label="Đến ngày" value={den as ISODate} min={tu as ISODate} format="system_date" onChange={v => v && set({den: v})} />
    </>
  );
}

export type TotalItem = {label: string; value: string; strong?: boolean};

/** One line of totals under a table. */
export function TotalsLine({items}: {items: TotalItem[]}) {
  return (
    <Card variant="muted" padding={3}>
      <HStack gap={5} wrap="wrap" vAlign="center">
        {items.map(it => (
          <HStack key={it.label} gap={1.5} vAlign="center">
            <Text type="body" size="sm" color="secondary">
              {it.label}:
            </Text>
            <Text type="body" size="sm" weight={it.strong ? 'bold' : 'semibold'} hasTabularNumbers>
              {it.value}
            </Text>
          </HStack>
        ))}
      </HStack>
    </Card>
  );
}

type TableProps<T extends Record<string, unknown>> = {
  rows: T[];
  columns: TableColumn<T>[];
  idKey: keyof T & string;
  totals?: TotalItem[];
  /** Extra lines under the totals (e.g. returns). */
  note?: ReactNode;
  countLabel?: string;
  pageSize?: number;
};

/** Compact table + record count + pagination (20 rows) + totals line. Remount (key) to go back to page 1. */
export function ReportTable<T extends Record<string, unknown>>({rows, columns, idKey, totals, note, countLabel = 'dòng', pageSize = PAGE_SIZE}: TableProps<T>) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize);
  return (
    <VStack gap={3}>
      <Table<T> data={pageRows} columns={columns} idKey={idKey} hasHover density="compact" textOverflow="truncate" />
      <HStack hAlign="between" vAlign="center">
        <Text type="body" color="secondary" size="sm">
          {rows.length} {countLabel}
        </Text>
        {pageCount > 1 && <Pagination page={current} totalPages={pageCount} onChange={setPage} />}
      </HStack>
      {totals && totals.length > 0 && <TotalsLine items={totals} />}
      {note}
    </VStack>
  );
}
