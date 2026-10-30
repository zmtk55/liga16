import { useSearchParams } from "react-router";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterMenu } from "@/components/ui/filter-menu";

import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { NewsItem } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NewsThumbnail } from "@/components/cards/card-image";
import { PageHero } from "@/components/page-hero";
import { formatDate } from "@/lib/format";
import { Newspaper, Calendar } from "lucide-react";

const tagColors: Record<string, "default" | "secondary" | "destructive" | "outline" | null | undefined> = {
  General: "default",
  Resultados: "secondary",
  Torneos: "destructive",
  Ligas: "outline",
  Jugadores: "default",
  Clubs: "secondary",
};

export default function NewsPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const tag = params.get("tag") ?? "all";
  const setParam = (key: string, value: string) => { const next = new URLSearchParams(params); if (!value || value === "all") next.delete(key); else next.set(key, value); setParams(next, { replace: true }); };
  const [news, setNews] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    let active = true;
    // Sin `catch` la página se quedaba en esqueletos para siempre si la
    // petición fallaba; con lista vacía al menos ves "no hay noticias".
    db.listNews()
      .then((data) => {
        if (active) setNews(data);
      })
      .catch(() => {
        if (active) setNews([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = (news ?? []).filter((n) => (tag === "all" || n.tag === tag) && `${n.title} ${n.excerpt}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="animate-fade-in space-y-5">
      <PageHero
        title="Noticias"
        subtitle="Novedades, resultados y las historias que mueven a Liga16."
        ghost="16"
      />

      <FilterBar search={query} onSearch={(v) => setParam("q", v)} searchPlaceholder="Buscar noticia…" resultCount={filtered.length} resultLabel="noticias" activeCount={Number(tag !== "all")} onClear={() => { const next = new URLSearchParams(params); next.delete("q"); next.delete("tag"); setParams(next, { replace: true }); }}>
        <FilterMenu label="Tema" value={tag} onChange={(v) => setParam("tag", v)} options={[...new Set((news ?? []).map((n) => n.tag))].map((t) => ({ key: t, label: t }))} allLabel="Todos" />
      </FilterBar>
      {news === null ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay noticias con estos filtros.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <Card
              key={n.id}
              className="group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md animate-slide-up"
            >
              <NewsThumbnail news={n} className="transition-all duration-500 group-hover:opacity-90" />
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={tagColors[n.tag] ?? "secondary"}><Newspaper className="mr-1 h-3 w-3" /> {n.tag}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(n.published_at)}</span>
                </div>
                <CardTitle className="text-base leading-snug">{n.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 text-sm text-muted-foreground">
                {n.excerpt}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
