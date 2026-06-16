import { Download, FilePlus2, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { utils, writeFile } from "xlsx";
import { api, listResource } from "../api/client";
import { ProtectedAction } from "../components/ProtectedAction";
import { Badge, Button, Card, EmptyState, Skeleton, Spinner } from "../components/ui";

type FieldType = "text" | "number" | "date" | "textarea" | "select" | "boolean" | "file";

type FieldConfig = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: Array<{ label: string; value: string | number | boolean }>;
  source?: "tours" | "families" | "payments" | "users";
};

type ResourceConfig = {
  fields: FieldConfig[];
  titleField?: string;
  lockedDelete?: boolean;
  createDisabled?: boolean;
};

const staticOptions = {
  gender: [
    { label: "Male", value: "MALE" },
    { label: "Female", value: "FEMALE" },
    { label: "Other", value: "OTHER" },
  ],
  memberStatus: [
    { label: "Confirmed", value: "CONFIRMED" },
    { label: "Pending", value: "PENDING" },
    { label: "Not Attending", value: "NOT_ATTENDING" },
  ],
  paymentMethod: [
    { label: "Cash", value: "CASH" },
    { label: "Bank", value: "BANK" },
  ],
  expenseCategory: [
    { label: "Resort", value: "RESORT" },
    { label: "Transport", value: "TRANSPORT" },
    { label: "Food", value: "FOOD" },
    { label: "Fuel", value: "FUEL" },
    { label: "Printing", value: "PRINTING" },
    { label: "Emergency", value: "EMERGENCY" },
    { label: "Entertainment", value: "ENTERTAINMENT" },
    { label: "Miscellaneous", value: "MISCELLANEOUS" },
  ],
};

const resourceConfigs: Record<string, ResourceConfig> = {
  "/families/": {
    titleField: "family_head",
    fields: [
      { name: "tour", label: "Tour", type: "select", source: "tours", required: true },
      { name: "family_head", label: "Family Head", required: true },
      { name: "contact_number", label: "Contact Number", required: true },
      { name: "alternate_contact", label: "Alternate Contact" },
      { name: "address", label: "Address", type: "textarea" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  "/members/": {
    titleField: "name",
    fields: [
      { name: "family", label: "Family", type: "select", source: "families", required: true },
      { name: "name", label: "Member Name", required: true },
      { name: "age", label: "Age", type: "number", required: true },
      { name: "gender", label: "Gender", type: "select", options: staticOptions.gender, required: true },
      { name: "phone", label: "Phone" },
      { name: "status", label: "Status", type: "select", options: staticOptions.memberStatus, required: true },
    ],
  },
  "/payments/": {
    titleField: "family_head",
    fields: [
      { name: "family", label: "Family", type: "select", source: "families", required: true },
      { name: "amount_expected", label: "Amount Expected", type: "number", required: true },
    ],
  },
  "/payment-transactions/": {
    titleField: "family_head",
    lockedDelete: true,
    fields: [
      { name: "payment", label: "Payment Account", type: "select", source: "payments", required: true },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "method", label: "Payment Method", type: "select", options: staticOptions.paymentMethod, required: true },
      { name: "transaction_reference", label: "Transaction Reference" },
      { name: "received_by", label: "Received By", type: "select", source: "users", required: true },
      { name: "receipt", label: "Receipt", type: "file" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  "/users/": {
    titleField: "username",
    fields: [
      { name: "username", label: "Username", required: true },
      { name: "first_name", label: "First Name" },
      { name: "last_name", label: "Last Name" },
      { name: "email", label: "Email" },
      {
        name: "role",
        label: "Role",
        type: "select",
        required: true,
        options: [
          { label: "Super Admin", value: "SUPER_ADMIN" },
          { label: "Tour Committee", value: "TOUR_COMMITTEE" },
        ],
      },
      { name: "password", label: "Password" },
      { name: "is_active", label: "Active", type: "boolean" },
    ],
  },
  "/tours/": {
    titleField: "name",
    fields: [
      { name: "name", label: "Tour Name", required: true },
      { name: "starts_on", label: "Starts On", type: "date" },
      { name: "ends_on", label: "Ends On", type: "date" },
      { name: "is_active", label: "Active", type: "boolean" },
    ],
  },
  "/committee-wallets/": {
    titleField: "member_name",
    createDisabled: true,
    fields: [
      { name: "opening_balance", label: "Opening Balance", type: "number", required: true },
    ],
  },
  "/bank-accounts/": {
    titleField: "name",
    createDisabled: true,
    fields: [
      { name: "opening_balance", label: "Opening Balance", type: "number", required: true },
    ],
  },
  "/expenses/": {
    titleField: "category",
    lockedDelete: true,
    fields: [
      { name: "paid_by", label: "Paid By", type: "select", source: "users", required: true },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "category", label: "Category", type: "select", options: staticOptions.expenseCategory, required: true },
      { name: "source", label: "Source", type: "select", options: staticOptions.paymentMethod, required: true },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "receipt", label: "Receipt", type: "file" },
      { name: "narration", label: "Narration", type: "textarea", required: true },
    ],
  },
  "/transfers/": {
    titleField: "narration",
    lockedDelete: true,
    fields: [
      { name: "from_member", label: "From Member", type: "select", source: "users", required: true },
      { name: "to_member", label: "To Member", type: "select", source: "users", required: true },
      { name: "source", label: "Source Account", type: "select", options: staticOptions.paymentMethod, required: true },
      { name: "destination", label: "Destination Account", type: "select", options: staticOptions.paymentMethod, required: true },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "receipt", label: "Receipt", type: "file" },
      { name: "narration", label: "Narration", type: "textarea" },
    ],
  },
  "/announcements/": {
    titleField: "title",
    fields: [
      { name: "tour", label: "Tour", type: "select", source: "tours", required: true },
      { name: "title", label: "Title", required: true },
      { name: "category", label: "Category", required: true },
      { name: "body", label: "Body", type: "textarea", required: true },
      { name: "is_pinned", label: "Pinned", type: "boolean" },
    ],
  },
};

const hiddenTableColumns = new Set(["created_at", "updated_at", "notes", "body", "address", "published_by"]);
const exportColumnLabels: Record<string, string> = {
  family_head: "Family Head",
  family_id: "Family ID",
  family_id_display: "Family ID",
  family_code: "Family ID",
  amount_expected: "Amount Expected",
  amount_paid: "Amount Paid",
  collection_percentage: "Collection Percentage",
  received_by_name: "Received By",
  user_name: "User",
};

export function ResourcePage({
  title,
  resource,
  readOnly = false,
  endpointMode = "paginated",
}: {
  title: string;
  resource: string;
  readOnly?: boolean;
  endpointMode?: "paginated" | "object";
}) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const config = resourceConfigs[resource];
  const canMutate = Boolean(config) && endpointMode === "paginated" && !readOnly;

  const query = useQuery({
    queryKey: [resource, search],
    queryFn: async () => {
      if (endpointMode === "object") {
        const { api } = await import("../api/client");
        return { results: [await api.get(resource).then((r) => r.data as Record<string, unknown>)] };
      }
      return listResource<Record<string, unknown>>(resource, search ? { search } : undefined);
    },
  });
  const rows = query.data?.results ?? [];
  const optionQueries = useResourceOptions(canMutate || modalOpen);

  function exportLoadedRows() {
    if (!rows.length) {
      setMessage({ type: "error", text: `No ${title.toLowerCase()} data is loaded to export.` });
      return;
    }
    exportRowsToExcel(rows, `${title.toLowerCase().replace(/\s+/g, "-")}.xlsx`, title);
    setMessage({ type: "success", text: `${title} exported successfully.` });
  }

  function exportLoadedRowsPdf() {
    if (!rows.length) {
      setMessage({ type: "error", text: `No ${title.toLowerCase()} data is loaded to export.` });
      return;
    }
    exportRowsToPdf(rows, `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`, title);
    setMessage({ type: "success", text: `${title} PDF exported successfully.` });
  }

  useEffect(() => {
    if (searchParams.get("new") === "1" && canMutate && !config?.createDisabled) {
      setEditingRow(null);
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [canMutate, searchParams, setSearchParams]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown> | FormData) => {
      if (!editingRow?.id) {
        return api.post(resource, payload);
      }
      return api.patch(`${resource}${editingRow.id}/`, payload);
    },
    onSuccess: () => {
      setMessage({ type: "success", text: `${title} saved successfully.` });
      setModalOpen(false);
      setEditingRow(null);
      queryClient.invalidateQueries({ queryKey: [resource] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["treasury-summary"] });
    },
    onError: (error: unknown) => setMessage({ type: "error", text: readableApiError(error) }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: Record<string, unknown>) => api.delete(`${resource}${row.id}/`),
    onSuccess: () => {
      setMessage({ type: "success", text: `${title} deleted successfully.` });
      queryClient.invalidateQueries({ queryKey: [resource] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["treasury-summary"] });
    },
    onError: (error: unknown) => setMessage({ type: "error", text: readableApiError(error) }),
  });

  const columns = useMemo(() => {
    if (!rows[0]) return [];
    return displayColumnsForResource(resource, rows[0]).slice(0, 7);
  }, [resource, rows]);

  return (
    <div className="space-y-5 animate-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">Search, filter, review, import, export, and operate tour data.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <ProtectedAction variant="outline" onClick={exportLoadedRows}>
            <Download className="h-4 w-4" />
            Excel
          </ProtectedAction>
          <ProtectedAction variant="outline" onClick={exportLoadedRowsPdf}>
            <Download className="h-4 w-4" />
            PDF
          </ProtectedAction>
          {canMutate && !config?.createDisabled && (
            <ProtectedAction
              onClick={() => {
                setEditingRow(null);
                setModalOpen(true);
              }}
            >
              <FilePlus2 className="h-4 w-4" />
              Add
            </ProtectedAction>
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <input
            className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm">
            <option>All statuses</option>
            <option>Confirmed</option>
            <option>Pending</option>
            <option>Paid</option>
          </select>
          <select className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm">
            <option>Family Tour 2026</option>
            <option>Family Tour 2027</option>
          </select>
        </div>
      </Card>

      {message && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            message.type === "success" ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {message.text}
        </div>
      )}

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()} yet`} body="Public viewers can inspect data once it is added by an authorized committee user." />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  {columns.map((key) => (
                    <th key={key} className="px-4 py-3 font-medium">
                      {key.replaceAll("_", " ")}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={String(row.id ?? index)} className="border-t">
                    {columns
                      .map((key) => [key, row[key]] as const)
                      .map(([key, value]) => (
                        <td key={key} className="px-4 py-3">
                          <CellValue field={key} value={value} />
                        </td>
                      ))}
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canMutate && (
                          <ProtectedAction
                            variant="ghost"
                            onClick={() => {
                              setEditingRow(row);
                              setModalOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </ProtectedAction>
                        )}
                        {canMutate && !config.lockedDelete && (
                          <ProtectedAction
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Delete ${String(row[config.titleField ?? "id"] ?? title)}?`)) {
                                deleteMutation.mutate(row);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
                          </ProtectedAction>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y md:hidden">
            {rows.map((row, index) => (
              <div key={String(row.id ?? index)} className="space-y-3 p-4">
                {resource === "/families/" && (
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Family Head</p>
                    <p className="break-words text-base font-semibold">{String(row.family_head ?? "-")}</p>
                  </div>
                )}
                <div className="grid gap-2">
                  {columns.map((key) => (
                    <div key={key} className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 text-sm">
                      <span className="text-muted-foreground">{key.replaceAll("_", " ")}</span>
                      <div className="min-w-0 break-words font-medium">
                        <CellValue field={key} value={row[key]} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  {canMutate && (
                    <ProtectedAction
                      variant="outline"
                      onClick={() => {
                        setEditingRow(row);
                        setModalOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </ProtectedAction>
                  )}
                  {canMutate && !config.lockedDelete && (
                    <ProtectedAction
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(`Delete ${String(row[config.titleField ?? "id"] ?? title)}?`)) {
                          deleteMutation.mutate(row);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </ProtectedAction>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {canMutate && config && (
        <ResourceFormModal
          config={config}
          title={title}
          row={editingRow}
          open={modalOpen}
          saving={saveMutation.isPending}
          optionQueries={optionQueries}
          onClose={() => {
            setModalOpen(false);
            setEditingRow(null);
          }}
          onSubmit={(payload) => saveMutation.mutate(payload)}
        />
      )}
    </div>
  );
}

function displayColumnsForResource(resource: string, row: Record<string, unknown>) {
  const keys = Object.keys(row).filter((key) => !hiddenTableColumns.has(key));
  if (resource !== "/families/") return keys;
  const priority = ["family_id", "family_head"];
  return [...priority.filter((key) => keys.includes(key)), ...keys.filter((key) => !priority.includes(key))];
}

function exportRowsToExcel(rows: Record<string, unknown>[], filename: string, sheetName: string) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const exportRows = rows.map((row) =>
    Object.fromEntries(
      columns.map((key) => [exportColumnLabels[key] ?? key.replaceAll("_", " "), normalizeExportValue(row[key])])
    )
  );
  const worksheet = utils.json_to_sheet(exportRows);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31) || "Export");
  writeFile(workbook, filename);
}

function exportRowsToPdf(rows: Record<string, unknown>[], filename: string, title: string) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 8);
  const lines = [
    title,
    `Generated: ${new Date().toLocaleString()}`,
    "",
    ...rows.flatMap((row, index) => [
      `${index + 1}. ${rowTitle(row)}`,
      ...columns.map((key) => {
        const label = exportColumnLabels[key] ?? key.replaceAll("_", " ");
        return `   ${label}: ${String(normalizeExportValue(row[key])).slice(0, 110)}`;
      }),
      "",
    ]),
  ];
  saveTextPdf(lines, filename);
}

function saveTextPdf(lines: string[], filename: string) {
  const pageHeight = 792;
  const marginTop = 48;
  const lineHeight = 14;
  const linesPerPage = Math.floor((pageHeight - marginTop * 2) / lineHeight);
  const pages = chunk(lines, linesPerPage);
  const objects: string[] = [];
  const addObject = (content: string) => {
    objects.push(content);
    return objects.length;
  };
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageRefs: number[] = [];

  for (const pageLines of pages) {
    const textCommands = pageLines
      .map((line, index) => `BT /F1 10 Tf 40 ${pageHeight - marginTop - index * lineHeight} Td (${escapePdfText(line)}) Tj ET`)
      .join("\n");
    const contentId = addObject(`<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream`);
    pageRefs.push(addObject(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  }

  const pagesId = objects.length + 1;
  pageRefs.forEach((ref, index) => {
    objects[ref - 1] = objects[ref - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  });
  addObject(`<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`);
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const offsets: number[] = [];
  let pdf = "%PDF-1.4\n";
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  downloadBlob(new Blob([pdf], { type: "application/pdf" }), filename);
}

function rowTitle(row: Record<string, unknown>) {
  return String(row.family_head ?? row.name ?? row.username ?? row.action ?? row.id ?? "Record");
}

function escapePdfText(value: string) {
  return value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, " ");
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks.length ? chunks : [[]];
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function normalizeExportValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function CellValue({ field, value }: { field: string; value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">-</span>;
  if (field.includes("status") || field.includes("category") || field.includes("role")) {
    return <Badge className="bg-muted">{String(value).replaceAll("_", " ")}</Badge>;
  }
  if (typeof value === "boolean") return <Badge className={value ? "border-success text-success" : ""}>{value ? "Yes" : "No"}</Badge>;
  if (field.includes("receipt") && typeof value === "string") {
    const href = value.startsWith("http") ? value : `${api.defaults.baseURL?.replace(/\/api\/?$/, "")}${value}`;
    return (
      <a className="text-primary underline underline-offset-2" href={href} target="_blank" rel="noreferrer">
        Preview
      </a>
    );
  }
  if (typeof value === "object") return <span className="text-muted-foreground">Structured data</span>;
  return <span>{String(value)}</span>;
}

function useResourceOptions(enabled: boolean) {
  const tours = useQuery({
    queryKey: ["/tours/", "options"],
    enabled,
    queryFn: () => listResource<Record<string, unknown>>("/tours/"),
  });
  const families = useQuery({
    queryKey: ["/families/", "options"],
    enabled,
    queryFn: () => listResource<Record<string, unknown>>("/families/"),
  });
  const payments = useQuery({
    queryKey: ["/payments/", "options"],
    enabled,
    queryFn: () => listResource<Record<string, unknown>>("/payments/"),
  });
  const users = useQuery({
    queryKey: ["/users/", "options"],
    enabled,
    queryFn: () => listResource<Record<string, unknown>>("/users/"),
  });
  return { tours, families, payments, users };
}

function ResourceFormModal({
  config,
  title,
  row,
  open,
  saving,
  optionQueries,
  onClose,
  onSubmit,
}: {
  config: ResourceConfig;
  title: string;
  row: Record<string, unknown> | null;
  open: boolean;
  saving: boolean;
  optionQueries: ReturnType<typeof useResourceOptions>;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown> | FormData) => void;
}) {
  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const hasFile = config.fields.some((field) => field.type === "file" && (form.get(field.name) as File | null)?.size);
    const payload: Record<string, unknown> | FormData = hasFile ? new FormData() : {};
    const setPayload = (key: string, value: unknown) => {
      if (payload instanceof FormData) {
        payload.set(key, value as string | Blob);
      } else {
        payload[key] = value;
      }
    };
    config.fields.forEach((field) => {
      if (field.type === "boolean") {
        setPayload(field.name, payload instanceof FormData ? (form.get(field.name) === "on" ? "true" : "false") : form.get(field.name) === "on");
        return;
      }
      if (field.type === "file") {
        const file = form.get(field.name) as File | null;
        if (file?.size) setPayload(field.name, file);
        return;
      }
      const raw = form.get(field.name);
      if (raw === null || raw === "") {
        if (!field.required && !(payload instanceof FormData)) payload[field.name] = null;
        return;
      }
      setPayload(field.name, field.type === "number" || field.source ? (payload instanceof FormData ? String(Number(raw)) : Number(raw)) : String(raw));
    });
    onSubmit(payload);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <Card className="max-h-[92vh] w-full max-w-2xl overflow-auto p-5 shadow-soft animate-in">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{row ? `Edit ${title}` : `Add ${title}`}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Committee and super admin changes are written directly to the API.</p>
          </div>
          <Button variant="ghost" className="h-8 w-8 px-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          {config.fields.map((field) => (
            <FieldInput key={field.name} field={field} value={row?.[field.name]} optionQueries={optionQueries} />
          ))}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />}
              Save
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function FieldInput({
  field,
  value,
  optionQueries,
}: {
  field: FieldConfig;
  value: unknown;
  optionQueries: ReturnType<typeof useResourceOptions>;
}) {
  const common = "h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30";
  const options = field.options ?? sourceOptions(field, optionQueries);
  const defaultValue = value === null || value === undefined ? "" : String(value);

  return (
    <label className={field.type === "textarea" ? "space-y-1 sm:col-span-2" : "space-y-1"}>
      <span className="text-sm font-medium">{field.label}</span>
      {field.type === "textarea" ? (
        <textarea name={field.name} required={field.required} defaultValue={defaultValue} className={`${common} min-h-24 w-full py-2`} />
      ) : field.type === "select" ? (
        <select name={field.name} required={field.required} defaultValue={defaultValue} className={`${common} w-full`}>
          <option value="">Select {field.label}</option>
          {options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.type === "boolean" ? (
        <span className="flex h-10 items-center gap-2">
          <input name={field.name} type="checkbox" defaultChecked={Boolean(value)} className="h-4 w-4 rounded border" />
          <span className="text-sm text-muted-foreground">Enabled</span>
        </span>
      ) : field.type === "file" ? (
        <input name={field.name} type="file" accept=".jpg,.jpeg,.png,.pdf" className={`${common} w-full py-2`} />
      ) : (
        <input
          name={field.name}
          required={field.required}
          defaultValue={defaultValue}
          type={field.type ?? "text"}
          step={field.type === "number" ? "0.01" : undefined}
          className={`${common} w-full`}
        />
      )}
    </label>
  );
}

function sourceOptions(field: FieldConfig, optionQueries: ReturnType<typeof useResourceOptions>) {
  if (!field.source) return [];
  const records = optionQueries[field.source].data?.results ?? [];
  return records.map((record) => ({
    value: Number(record.id),
    label: optionLabel(field.source!, record),
  }));
}

function optionLabel(source: NonNullable<FieldConfig["source"]>, record: Record<string, unknown>) {
  if (source === "tours") return String(record.name ?? record.id);
  if (source === "families") return `${record.family_id ?? record.id} - ${record.family_head ?? "Family"}`;
  if (source === "payments") return `${record.family_code ?? record.id} - ${record.family_head ?? "Payment"}`;
  if (source === "users") return String(`${record.first_name ?? ""} ${record.last_name ?? ""}`.trim() || record.username || record.id);
  return String(record.id);
}

function readableApiError(error: unknown) {
  const fallback = "Action failed. Please check permissions and required fields.";
  if (!error || typeof error !== "object" || !("response" in error)) return fallback;
  const response = (error as { response?: { data?: unknown; status?: number } }).response;
  if (!response?.data) return `${fallback} ${response?.status ?? ""}`.trim();
  if (typeof response.data === "string") return response.data;
  try {
    return Object.entries(response.data as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
      .join(" ");
  } catch {
    return fallback;
  }
}
