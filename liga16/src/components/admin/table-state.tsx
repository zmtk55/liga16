import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TableCell, TableRow } from "@/components/ui/table";

/** Filas de carga para tablas del admin. */
export function AdminTableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return Array.from({ length: rows }).map((_, row) => (
    <TableRow key={row}>
      {Array.from({ length: columns }).map((__, column) => (
        <TableCell key={column} className="py-3.5">
          <Skeleton className={column === 0 ? "h-4 w-40" : "h-4 w-20"} />
        </TableCell>
      ))}
    </TableRow>
  ));
}

/** Estado vacío con la misma anatomía en todas las tablas. */
export function AdminTableEmpty({
  colSpan,
  title,
  description,
  icon,
  action,
}: {
  colSpan: number;
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="p-0">
        <Empty className="border-0 py-12">
          <EmptyHeader>
            {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
            <EmptyTitle className="text-base">{title}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
          {action}
        </Empty>
      </TableCell>
    </TableRow>
  );
}
