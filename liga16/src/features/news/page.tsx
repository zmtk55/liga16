"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { NewsItem } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NewsThumbnail } from "@/components/cards/card-image";
import { formatDate } from "@/lib/format";

const tagColors: Record<string, "default" | "secondary" | "destructive" | "outline" | null | undefined> = {
  General: "default",
  Resultados: "secondary",
  Torneos: "destructive",
  Ligas: "outline",
  Jugadores: "default",
  Clubs: "secondary",
};

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    let active = true;
    db.listNews().then((data) => {
      if (active) setNews(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Noticias</h1>
        <p className="text-muted-foreground">
          Novedades y resultados del padel Reforma
        </p>
      </header>

      {news === null ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {news.map((n) => (
            <Card
              key={n.id}
              className="group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md animate-slide-up"
            >
              <NewsThumbnail news={n} className="transition-all duration-500 group-hover:opacity-90" />
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={tagColors[n.tag] ?? "secondary"}>{n.tag}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(n.published_at)}
                  </span>
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
    </section>
  );
}
