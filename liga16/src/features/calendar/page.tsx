import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/data";
import type { Match, MatchStatus } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Radio, ChevronLeft, ChevronRight, Clock, MapPin, Zap } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getHours,
} from "date-fns";
import { es } from "date-fns/locale";

const statusMeta: Record<
  MatchStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  live: { label: "En vivo", variant: "destructive" },
  scheduled: { label: "Programado", variant: "secondary" },
  finished: { label: "Finalizado", variant: "outline" },
  walkover: { label: "W.O.", variant: "outline" },
  disputed: { label: "En disputa", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

function setsCompact(m: Match) {
  if (m.sets.length === 0) return "—";
  return m.sets.map((s) => `${s.a}-${s.b}`).join(" · ");
}

function totalGames(m: Match, side: "a" | "b") {
  return m.sets.reduce((sum, s) => sum + (side === "a" ? s.a : s.b), 0);
}

const DAYS = [" Lun", " Mar", " Mie", "Jue", "Vie", "Sáb", "Dom"];

export default function CalendarPage() {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 8, 1));

  useEffect(() => {
    let active = true;
    db.listRecentMatches().then((data) => {
      if (active) setMatches(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const matchesByDay = useMemo(() => {
    if (!matches) return {};
    const map: Record<string, Match[]> = {};
    matches.forEach((m) => {
      if (!m.scheduled_at) return;
      const date = new Date(m.scheduled_at);
      const key = format(date, "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return map;
  }, [matches]);

  const liveMatches = matches?.filter((m) => m.status === "live") ?? [];
  const upcomingMatches = matches?.filter((m) => m.status === "scheduled").slice(0, 3) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Calendario de Partidos</h1>
          <p className="text-muted-foreground">Partidos en vivo, programados y resultados recientes</p>
        </div>
        <div className="flex items-center gap-2">
          {liveMatches.length > 0 && (
            <Badge variant="destructive" className="text-xs font-semibold">
              <Radio className="mr-1 h-3 w-3 animate-pulse" />
              {liveMatches.length} en vivo
            </Badge>
          )}
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-none border-r"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-4 text-sm font-medium min-w-[140px] text-center">
              {format(currentMonth, "MMMM yyyy", { locale: es })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-none border-l"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {matches && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="text-sm text-muted-foreground">Vista Semanal</CardTitle>
            <span className="text-xs text-muted-foreground">
              {format(currentMonth, "MMMM yyyy", { locale: es })}
            </span>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS.map((day, i) => {
                const date = calendarDays[i];
                const isToday = date && isSameDay(date, new Date());
                return (
                  <div key={day} className="text-center py-1">
                    <span className="text-xs font-medium text-muted-foreground">{day}</span>
                    {date && (
                      <div
                        className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : isSameMonth(date, currentMonth)
                              ? "text-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {format(date, "d")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="space-y-1">
              {[8, 12, 16, 20].map((hour) => (
                <div key={hour} className="grid grid-cols-7 gap-1">
                  <div className="flex items-center text-xs text-muted-foreground pr-1 justify-end">
                    {hour}:00
                  </div>
                  {calendarDays.slice(0, 7).map((date) => {
                    const dayKey = format(date, "yyyy-MM-dd");
                    const dayMatches = matchesByDay[dayKey]?.filter((m) => {
                      const matchHour = getHours(new Date(m.scheduled_at!));
                      return Math.abs(matchHour - hour) <= 2;
                    });
                    return (
                      <div key={dayKey} className="min-h-[48px] p-0.5">
                        {dayMatches?.map((m) => (
                          <div
                            key={m.id}
                            className={`rounded px-1.5 py-1 text-[10px] font-medium truncate cursor-pointer transition-colors hover:opacity-90 ${
                              m.status === "live"
                                ? "bg-red-500 text-white"
                                : m.status === "finished"
                                  ? "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                  : "bg-primary/20 text-primary"
                            }`}
                          >
                            {m.side_a.pair_name}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Partidos</h2>
        </div>
        {matches === null ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          matches.map((m) => {
            const meta = statusMeta[m.status];
            const isLive = m.status === "live";
            return (
              <Card
                key={m.id}
                className={`${isLive ? "border-red-500/40" : "hover:border-primary/30"} transition-colors`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle
                      className={`text-sm font-medium ${isLive ? "text-red-600" : "text-muted-foreground"}`}
                    >
                      {m.tournament_name} · {m.category_name} · {m.round}
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      {isLive && (
                        <span className="flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                          <Radio className="h-3 w-3 animate-pulse" /> EN VIVO
                        </span>
                      )}
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`truncate ${m.winner === "a" ? "font-semibold text-emerald-600" : ""}`}>
                      {m.side_a.pair_name}
                    </span>
                    <span className="tabular-nums text-muted-foreground text-sm">
                      {setsCompact(m)} ({totalGames(m, "a")} juegos)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`truncate ${m.winner === "b" ? "font-semibold text-emerald-600" : ""}`}>
                      {m.side_b.pair_name}
                    </span>
                    <span className="tabular-nums text-muted-foreground text-sm">
                      {totalGames(m, "b")} juegos
                    </span>
                  </div>
                  <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(m.scheduled_at!).toLocaleString("es-MX", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {m.court_name && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {m.court_name}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {upcomingMatches.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Próximos partidos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingMatches.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{m.side_a.pair_name} vs {m.side_b.pair_name}</p>
                  <p className="text-xs text-muted-foreground">{m.tournament_name} · {m.court_name}</p>
                </div>
                <Badge variant="secondary">{statusMeta[m.status].label}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
