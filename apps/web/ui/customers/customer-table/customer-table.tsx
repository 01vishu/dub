"use client";

import { getPlanCapabilities } from "@/lib/plan-capabilities";
import useCustomersCount from "@/lib/swr/use-customers-count";
import useWorkspace from "@/lib/swr/use-workspace";
import { CustomerProps } from "@/lib/types";
import EditColumnsButton from "@/ui/analytics/events/edit-columns-button";
import { CustomerRowItem } from "@/ui/customers/customer-row-item";
import { AnimatedEmptyState } from "@/ui/shared/animated-empty-state";
import { FilterButtonTableRow } from "@/ui/shared/filter-button-table-row";
import { SearchBoxPersisted } from "@/ui/shared/search-box";
import {
  AnimatedSizeContainer,
  Button,
  buttonVariants,
  CopyText,
  Filter,
  LinkLogo,
  MenuItem,
  Popover,
  Table,
  useCopyToClipboard,
  usePagination,
  useRouterStuff,
  useTable,
} from "@dub/ui";
import { Copy, Dots, User } from "@dub/ui/icons";
import {
  cn,
  COUNTRIES,
  currencyFormatter,
  fetcher,
  formatDate,
  getPrettyUrl,
} from "@dub/utils";
import { Cell, Row } from "@tanstack/react-table";
import { Command } from "cmdk";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { EXAMPLE_CUSTOMER_DATA } from "./example-data";
import { customersColumns, useColumnVisibility } from "./use-column-visibility";
import { useCustomerFilters } from "./use-customer-filters";

type ColumnMeta = {
  filterParams?: (
    args: Pick<Cell<CustomerProps, any>, "getValue">,
  ) => Record<string, any>;
};

export function CustomerTable() {
  const { id: workspaceId, slug: workspaceSlug, plan } = useWorkspace();

  const { canManageCustomers } = getPlanCapabilities(plan);

  const { queryParams, searchParams, getQueryString } = useRouterStuff();

  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

  const {
    filters,
    activeFilters,
    onSelect,
    onRemove,
    onRemoveAll,
    isFiltered,
  } = useCustomerFilters(
    { sortBy, sortOrder },
    { enabled: canManageCustomers },
  );

  const { data: customersCount, error: countError } = useCustomersCount({
    enabled: canManageCustomers,
  });

  const {
    data: customers,
    error,
    isLoading,
  } = useSWR<CustomerProps[]>(
    canManageCustomers &&
      `/api/customers${getQueryString({
        workspaceId,
        includeExpandedFields: "true",
      })}`,
    fetcher,
    {
      keepPreviousData: true,
    },
  );

  const { columnVisibility, setColumnVisibility } = useColumnVisibility();
  const { pagination, setPagination } = usePagination();

  if (!canManageCustomers) columnVisibility.link = false;

  const columns = useMemo(
    () =>
      [
        {
          id: "customer",
          header: "Customer",
          enableHiding: false,
          minSize: 250,
          cell: ({ row }) => {
            return (
              <CustomerRowItem
                customer={row.original}
                href={`/${workspaceSlug}/customers/${row.original.id}`}
                hideChartActivityOnHover={false}
              />
            );
          },
        },
        {
          id: "country",
          header: "Country",
          accessorKey: "country",
          meta: {
            filterParams: ({ getValue }) => ({
              country: getValue(),
            }),
          },
          minSize: 150,
          cell: ({ row }) => {
            const country = row.original.country;
            return (
              <div className="flex items-center gap-2">
                {country && (
                  <img
                    alt={`${country} flag`}
                    src={`https://hatscripts.github.io/circle-flags/flags/${country.toLowerCase()}.svg`}
                    className="size-4 shrink-0"
                  />
                )}
                <span className="min-w-0 truncate">
                  {(country ? COUNTRIES[country] : null) ?? "-"}
                </span>
              </div>
            );
          },
        },
        {
          id: "saleAmount",
          header: "Lifetime value",
          accessorKey: "saleAmount",
          cell: ({ getValue }) => (
            <div className="flex items-center gap-2">
              <span>
                {currencyFormatter(getValue() / 100, {
                  maximumFractionDigits: undefined,
                  // @ts-ignore – trailingZeroDisplay is a valid option but TS is outdated
                  trailingZeroDisplay: "stripIfInteger",
                })}
              </span>
              <span className="text-neutral-400">USD</span>
            </div>
          ),
        },
        {
          id: "createdAt",
          header: "Created",
          accessorFn: (d) => formatDate(d.createdAt, { month: "short" }),
        },
        {
          id: "link",
          header: "Referral link",
          accessorKey: "link",
          meta: {
            filterParams: ({ getValue }) => ({
              linkId: getValue().id,
            }),
          },
          cell: ({ row }) =>
            row.original.link ? (
              <Link
                href={`/${workspaceSlug}/links/${row.original.link.domain}/${row.original.link.key}`}
                target="_blank"
                className="flex cursor-alias items-center gap-3 decoration-dotted underline-offset-2 hover:underline"
              >
                <LinkLogo
                  apexDomain={row.original.link.domain}
                  className="size-4 shrink-0 sm:size-4"
                />
                <span className="truncate" title={row.original.link.shortLink}>
                  {getPrettyUrl(row.original.link.shortLink)}
                </span>
              </Link>
            ) : (
              "-"
            ),
          size: 250,
        },
        {
          id: "externalId",
          header: "External ID",
          accessorKey: "externalId",
          cell: ({ row }) =>
            row.original.externalId ? (
              <CopyText
                value={row.original.externalId}
                successMessage="Copied external ID to clipboard!"
                className="truncate"
              >
                {row.original.externalId}
              </CopyText>
            ) : (
              "-"
            ),
        },
        // Menu
        {
          id: "menu",
          enableHiding: false,
          minSize: 43,
          size: 43,
          maxSize: 43,
          header: () => <EditColumnsButton table={table} />,
          cell: ({ row }) => (
            <RowMenuButton row={row} workspaceId={workspaceId!} />
          ),
        },
      ].filter((c) => c.id === "menu" || customersColumns.all.includes(c.id)),
    [],
  );

  const { table, ...tableProps } = useTable({
    data: canManageCustomers ? customers || [] : EXAMPLE_CUSTOMER_DATA,
    columns,
    pagination,
    onPaginationChange: setPagination,
    columnVisibility,
    onColumnVisibilityChange: setColumnVisibility,
    sortableColumns: ["createdAt", "saleAmount"],
    sortBy,
    sortOrder,
    onSortChange: ({ sortBy, sortOrder }) =>
      queryParams({
        set: {
          ...(sortBy && { sortBy }),
          ...(sortOrder && { sortOrder }),
        },
        del: "page",
        scroll: false,
      }),
    columnPinning: { right: ["menu"] },
    cellRight: (cell) => {
      const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
      return (
        meta?.filterParams && (
          <FilterButtonTableRow set={meta.filterParams(cell)} />
        )
      );
    },
    thClassName: "border-l-0",
    tdClassName: "border-l-0",
    resourceName: (p) => `customer${p ? "s" : ""}`,
    rowCount: customersCount || 0,
    loading: isLoading,
    error: error || countError ? "Failed to load customers" : undefined,
  });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Filter.Select
            className="w-full md:w-fit"
            filters={filters}
            activeFilters={activeFilters}
            onSelect={onSelect}
            onRemove={onRemove}
          />
          <SearchBoxPersisted
            placeholder="Search..."
            inputClassName="md:w-72"
          />
        </div>
        <AnimatedSizeContainer height>
          <div>
            {activeFilters.length > 0 && (
              <div className="pt-3">
                <Filter.List
                  filters={filters}
                  activeFilters={activeFilters}
                  onRemove={onRemove}
                  onRemoveAll={onRemoveAll}
                />
              </div>
            )}
          </div>
        </AnimatedSizeContainer>
      </div>
      {!canManageCustomers || customers?.length !== 0 ? (
        <Table
          {...tableProps}
          table={table}
          scrollWrapperClassName={
            canManageCustomers ? undefined : "overflow-x-hidden"
          }
        >
          {!canManageCustomers && (
            <>
              <div className="absolute inset-0 flex touch-pan-y flex-col items-center justify-center bg-gradient-to-t from-[#fff_75%] to-[#fff6] px-4 text-center">
                <div className="h-40 w-full max-w-[480px] overflow-hidden [mask-image:linear-gradient(black,transparent)]">
                  <div className="relative h-96 w-full overflow-hidden rounded-lg border border-neutral-200">
                    <Image
                      src="https://assets.dub.co/misc/customer-screenshot.jpg"
                      fill
                      className="object-contain object-top"
                      alt="Customer overview screenshot"
                      draggable={false}
                    />
                  </div>
                </div>
                <div className="relative -mt-4 flex flex-col items-center justify-center">
                  <span className="text-lg font-semibold text-neutral-700">
                    Customers
                  </span>
                  <p className="mt-3 max-w-sm text-pretty text-sm text-neutral-500">
                    Upgrade to our Business Plan to see more details about your
                    customers, their activity, and how they&rsquo;ve impacted
                    your business.
                    {/* TODO: Add "Learn more" link once we have a help article */}
                  </p>
                  <div className="mt-8">
                    <Link
                      href={`/${workspaceSlug}/upgrade`}
                      className={cn(
                        buttonVariants({ variant: "primary" }),
                        "flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm",
                      )}
                    >
                      Upgrade to Business
                    </Link>
                  </div>
                </div>
              </div>
              <div className="h-[420px]" />
            </>
          )}
        </Table>
      ) : (
        <AnimatedEmptyState
          title="No customers found"
          description={
            isFiltered
              ? "No customers found for the selected filters."
              : "No customers have been added to this program yet."
          }
          cardContent={() => (
            <>
              <User className="size-4 text-neutral-700" />
              <div className="h-2.5 w-24 min-w-0 rounded-sm bg-neutral-200" />
            </>
          )}
        />
      )}
    </div>
  );
}

function RowMenuButton({
  row,
  workspaceId,
}: {
  row: Row<CustomerProps>;
  workspaceId: string;
}) {
  const router = useRouter();
  const { slug } = useParams();
  const [isOpen, setIsOpen] = useState(false);

  const [, copyToClipboard] = useCopyToClipboard();

  return (
    <>
      <Popover
        openPopover={isOpen}
        setOpenPopover={setIsOpen}
        content={
          <Command tabIndex={0} loop className="focus:outline-none">
            <Command.List className="flex w-screen flex-col gap-1 p-1.5 text-sm focus-visible:outline-none sm:w-auto sm:min-w-[130px]">
              {row.original.externalId && (
                <MenuItem
                  as={Command.Item}
                  icon={Copy}
                  onSelect={() => {
                    toast.promise(copyToClipboard(row.original.externalId), {
                      success: "Copied to clipboard",
                    });
                    setIsOpen(false);
                  }}
                >
                  Copy external ID
                </MenuItem>
              )}
              {row.original.email && (
                <MenuItem
                  as={Command.Item}
                  icon={Copy}
                  onSelect={() => {
                    toast.promise(copyToClipboard(row.original.email!), {
                      success: "Copied to clipboard",
                    });
                    setIsOpen(false);
                  }}
                >
                  Copy email
                </MenuItem>
              )}
            </Command.List>
          </Command>
        }
        align="end"
      >
        <Button
          type="button"
          className="h-8 whitespace-nowrap px-2 disabled:border-transparent disabled:bg-transparent"
          variant="outline"
          icon={<Dots className="h-4 w-4 shrink-0" />}
          disabled={!row.original.externalId && !row.original.email}
        />
      </Popover>
    </>
  );
}
