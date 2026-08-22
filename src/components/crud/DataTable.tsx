import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useFeaturePermission } from "@/hooks/useFeaturePermission";
import type { OutletFeatureKey } from "@/lib/outletFeatures";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onAdd?: () => void;
  addLabel?: string;
  addDisabled?: boolean;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** Jika diisi, tombol Tambah/Edit/Hapus disembunyikan sesuai hak akses karyawan & outlet. */
  featureKey?: OutletFeatureKey;
  keyExtractor?: (row: T) => string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  emptyMessage = "Belum ada data",
  onAdd,
  addLabel = "Tambah",
  addDisabled = false,
  onEdit,
  onDelete,
  featureKey,
  keyExtractor = (r) => r.id,
}: DataTableProps<T>) {
  const perm = useFeaturePermission(featureKey);
  const showAdd = onAdd && (!featureKey || perm.can_create);
  const showEdit = onEdit && (!featureKey || perm.can_update);
  const showDelete = onDelete && (!featureKey || perm.can_delete);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
      {showAdd && (
        <div className="flex justify-end border-b border-[var(--border)] p-3 sm:p-4">
          <Button onClick={onAdd} disabled={addDisabled} className="min-h-10 touch-manipulation">
            {addLabel}
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          </div>
        ) : data.length === 0 ? (
          <div className="py-16 text-center text-[var(--muted-foreground)]">{emptyMessage}</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-3 py-2 font-medium text-[var(--foreground)] sm:px-4 sm:py-3 ${col.className ?? ""}`}
                  >
                    {col.header}
                  </th>
                ))}
                {(showEdit || showDelete) && (
                  <th className="w-20 whitespace-nowrap px-2 py-2 font-medium text-[var(--foreground)] sm:w-24 sm:px-4 sm:py-3">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-3 py-2 sm:px-4 sm:py-3 ${col.className ?? ""}`}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? "-")}
                    </td>
                  ))}
                  {(showEdit || showDelete) && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {showEdit && onEdit && (
                          <Button variant="outline" size="sm" onClick={() => onEdit(row)}>
                            Edit
                          </Button>
                        )}
                        {showDelete && onDelete && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDelete(row)}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            Hapus
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
