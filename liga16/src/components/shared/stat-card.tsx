import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  /** Convierte la tarjeta en un enlace sin añadir un botón aparte. */
  to?: string;
  loading?: boolean;
  className?: string;
}

export function StatCard({ title, value, hint, icon, to, loading, className }: StatCardProps) {
  const body = (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
        )}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        {to && (
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
            Gestionar
            <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </CardContent>
    </>
  );

  if (to) {
    return (
      <Card className={cn("group transition-colors hover:border-primary/40", className)}>
        <Link to={to} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {body}
        </Link>
      </Card>
    );
  }

  return <Card className={cn(className)}>{body}</Card>;
}
