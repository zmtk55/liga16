import {useAuth} from "@/contexts/AuthContext";
import { NavLink } from "react-router";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function TeamSections() {
  const {user}=useAuth();
  const reduced=useReducedMotion();
  return <LayoutGroup><nav aria-label="Gestión de equipos" className="flex flex-wrap gap-1 border-b pb-2">{[
    { to: "/admin/equipos", label: "Parejas por torneo" },
    { to: "/admin/participantes", label: "Inscripciones y pagos" },
  ].filter(item=>user?.role!=="organizer" || item.to!=="/admin/equipos").map(item=><NavLink key={item.to} to={item.to} className="relative inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{({isActive})=><>
    {isActive && <motion.span aria-hidden layoutId="team-section-active" className="absolute inset-0 rounded-xl bg-primary/10" transition={reduced ? {duration:0} : {type:"spring",stiffness:500,damping:40}}/>}
    <span className={cn("relative",isActive ? "text-primary-strong" : "text-muted-foreground")}>{item.label}</span>
  </>}</NavLink>)}</nav></LayoutGroup>;
}
