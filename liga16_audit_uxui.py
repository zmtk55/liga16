"""
Liga16 — UX/UI Audit con TypeSafe Jev
======================================
Web del circuito de pádel: torneos, ranking, equipos, clubes y noticias.
Stack: React 19 + TypeScript + Vite + shadcn/ui + Tailwind + Supabase

Uso:
  1. pip install typesafe-sdk
  2. Exporta tu API key: export TYPESAFE_API_KEY="tu_key"
  3. python liga16_audit_uxui.py
"""

import os
from typesafe_sdk import TypeSafeClient, Choice, Score, Noul

# ─── CONFIG ──────────────────────────────────────────────
# Poné tu API key acá o usá la variable de entorno TYPESAFE_API_KEY
os.environ.setdefault(
    "TYPESAFE_API_KEY",
    "apikey_215021618f5684c049599e7c575b92024f1d_cbe6a7e30d14715bc7e57a1ecbb43fa0daa008a009929096af91496fe5cccca7",
)

client = TypeSafeClient()


# ─── ESTADOS DE LA APP ──────────────────────────────────

STATES = {
    "homepage": """
Página principal de Liga16 (dashboard):
- Header con logo, navegación principal, búsqueda, icono de dark/light mode
- Hero/banner con torneo actual destacado
- Sección de métricas del circuito (partidos en vivo, ranking)
- Sección de noticias recientes
- Sección de sponsors
- Footer con links legales y redes sociales
    """.strip(),

    "torneos": """
Página de torneos:
- Listado de torneos en cards (TournamentCard) con info básica
- Filtros por estado (activo, próximo, finalizado) y formato
- Modal/dialog de inscripción de pareja con pago por transferencia o efectivo
- Cada card muestra: nombre, fecha, sede, categoría, cupo disponible
    """.strip(),

    "calendario": """
Página de calendario:
- Vista de partidos por fecha (react-day-picker)
- Partidos en vivo, programados y resultados
- Cada partido muestra: equipos, score, estado (jugando/terminado/por jugar)
- Posibilidad de filtrar por fecha o torneo
    """.strip(),

    "ranking": """
Página de ranking:
- Tabla/clasificación oficial de jugadores
- Filtros por rama (masculino/femenino) y ciudad
- Cada fila muestra: posición, nombre, puntos, tendencia (sube/baja)
- Link al detalle del jugador con tarjeta (player_cards), títulos, récord, movimientos
    """.strip(),

    "jugadores": """
Página/directorio de jugadores:
- Listado de jugadores con foto, nombre, equipo, categoría
- Búsqueda y filtros
- Link a detalle individual con: foto, datos, historial, ranking actual
    """.strip(),

    "equipos": """
Página/directorio de equipos:
- Listado de equipos con logo, nombre, club asociado
- Búsqueda y filtros
- Link a detalle con roster, partidos jugados, resultados
    """.strip(),

    "clubes": """
Página/directorio de clubes:
- Listado de clubes con info de contacto y sede
- Filtros por ubicación
- Link a detalle con instalaciones, equipos asociados
    """.strip(),

    "noticias": """
Página de noticias:
- Listado de artículos con imagen, título, fecha, autor
- Categorías/tags
- Vista de artículo completo
    """.strip(),

    "admin": """
Panel de administración (/admin):
- Overview con estadísticas y acciones rápidas
- Sub-secciones: torneos, jugadores, equipos, resultados, ranking, padel, noticias
- CRUD completo en cada sección
- Wizard de onboarding de 5 pasos para configuración inicial
    """.strip(),
}


# ─── QUESTIONS POR PÁGINA ───────────────────────────────

def get_questions(pagina: str) -> dict:
    """Retorna las preguntas de audit para cada página."""

    common_problema = Choice(
        instructions="Cuál es el problema de UX más grave en esta página?",
        criteria={
            "navegacion": "El usuario no encuentra lo que busca o se pierde",
            "accesibilidad": "No cumple estándares WCAG o es inaccesible",
            "jerarquia_visual": "No queda claro qué es lo más importante",
            "consistencia": "Los patrones visuales son inconsistentes",
            "rendimiento_mobile": "La experiencia en móvil es mala",
            "completitud_formularios": "Formularios confusos o difíciles",
            "confusion": "El usuario no entiende qué hacer",
        },
    )

    common_confianza = Score(
        instructions="Qué tan confiable y profesional se ve esta página?",
        criteria=[
            "Poco profesional, genera desconfianza",
            "Decente pero mejorable",
            "Muy profesional y confiable",
        ],
    )

    questions = {
        # ── HOMEPAGE ──
        "homepage": {
            "problema_critico": common_problema,
            "jerarquia_hero": Score(
                instructions="Qué tan clara es la jerarquía del hero/banner principal?",
                criteria=[
                    "No entiendes qué ofrece la app",
                    "Parcialmente claro",
                    "Al instante entendés el propósito",
                ],
            ),
            "cta_visibilidad": Choice(
                instructions="Qué CTA es más visible/importante en el dashboard?",
                criteria={
                    "ver_torneos": "Ir a ver torneos disponibles",
                    "ver_calendario": "Ver calendario de partidos",
                    "ver_ranking": "Ver ranking actual",
                    "ver_noticias": "Leer noticias",
                },
            ),
            "noticias_accesibles": Noul(
                instructions="Las noticias recientes son fáciles de encontrar y leer?"
            ),
            "mobile_home": Noul(
                instructions="El dashboard es usable en dispositivos móviles?"
            ),
        },

        # ── TORNEOS ──
        "torneos": {
            "problema_critico": common_problema,
            "info_torneo_clara": Score(
                instructions="Qué tan clara es la información de cada torneo en las cards?",
                criteria=[
                    "Confusa, falta info importante",
                    "Parcialmente clara",
                    "Al instante sabés fecha, lugar y formato",
                ],
            ),
            "inscripcion_flujo": Score(
                instructions="Qué tan intuitivo es el flujo de inscripción a un torneo?",
                criteria=[
                    "Muy confuso, no sé cómo inscribirme",
                    "Posible pero con fricción",
                    "Rápido y sin dudas",
                ],
            ),
            "filtros_utiles": Noul(
                instructions="Los filtros de estado y formato son útiles y funcionan bien?"
            ),
            "pago_claro": Noul(
                instructions="El método de pago (transferencia/efectivo) está claro?"
            ),
            "cupo_visible": Noul(
                instructions="La cantidad de cupos disponibles es visible y clara?"
            ),
        },

        # ── CALENDARIO ──
        "calendario": {
            "problema_critico": common_problema,
            "partidos_vivos": Score(
                instructions="Qué tan bien se distinguen los partidos en vivo de los programados?",
                criteria=[
                    "Todo se ve igual, no hay diferenciación",
                    "Parcialmente distinguibles",
                    "Claramente diferenciados al instante",
                ],
            ),
            "score_legible": Score(
                instructions="Qué tan legibles son los scores/marcadores de los partidos?",
                criteria=[
                    "Confusos, no sé quién ganó o el score",
                    "Parcialmente claros",
                    "Totalmente claros al instante",
                ],
            ),
            "calendario_navegacion": Score(
                instructions="Qué tan fácil es navegar por las fechas para encontrar partidos?",
                criteria=[
                    "Difícil, no encuentro la fecha",
                    "Aceptable",
                    "Muy intuitivo",
                ],
            ),
            "vivo_actualizado": Noul(
                instructions="Los partidos en vivo se actualizan en tiempo real?"
            ),
            "mobile_calendario": Noul(
                instructions="El calendario es usable en dispositivos móviles?"
            ),
        },

        # ── RANKING ──
        "ranking": {
            "problema_critico": common_problema,
            "tabla_legible": Score(
                instructions="Qué tan legible es la tabla de ranking?",
                criteria=[
                    "Confusa, no entiendo la clasificación",
                    "Parcialmente clara",
                    "Clara al instante, todo visible",
                ],
            ),
            "filtros_ranking": Noul(
                instructions="Los filtros por rama y ciudad funcionan bien?"
            ),
            "tendencia_visible": Noul(
                instructions="La tendencia de subida/baja de posición es visualmente clara?"
            ),
            "link_detalle": Noul(
                instructions="El link al detalle del jugador es visible y accesible?"
            ),
            "mobile_ranking": Noul(
                instructions="El ranking es usable en dispositivos móviles?"
            ),
        },

        # ── JUGADORES ──
        "jugadores": {
            "problema_critico": common_problema,
            "buscador_jugadores": Score(
                instructions="Qué tan fácil es buscar un jugador específico?",
                criteria=[
                    "Muy difícil o imposible",
                    "Posible pero lento",
                    "Rápido y preciso",
                ],
            ),
            "info_jugador": Score(
                instructions="Qué tan completa es la información visible del jugador en listado?",
                criteria=[
                    "Muy incompleta",
                    "Básica pero útil",
                    "Completa y clara",
                ],
            ),
            "foto_visible": Noul(
                instructions="Las fotos/avatares de los jugadores son visibles y útiles?"
            ),
            "mobile_jugadores": Noul(
                instructions="El directorio de jugadores es usable en móviles?"
            ),
        },

        # ── EQUIPOS ──
        "equipos": {
            "problema_critico": common_problema,
            "info_equipo": Score(
                instructions="Qué tan clara es la información de cada equipo en listado?",
                criteria=[
                    "Confusa, no sé qué representa cada equipo",
                    "Parcialmente clara",
                    "Clara con logo, nombre y datos clave",
                ],
            ),
            "equipo_detalle": Score(
                instructions="Qué tan intuitivo es navegar al detalle de un equipo?",
                criteria=[
                    "No encontrás el detalle",
                    "Posible pero con pasos extra",
                    "Un click y estás ahí",
                ],
            ),
            "mobile_equipos": Noul(
                instructions="El directorio de equipos es usable en móviles?"
            ),
        },

        # ── CLUBES ──
        "clubes": {
            "problema_critico": common_problema,
            "contacto_visible": Noul(
                instructions="La información de contacto y ubicación del club es visible?"
            ),
            "clubes_busqueda": Score(
                instructions="Qué tan fácil es buscar clubes por ubicación?",
                criteria=[
                    "Muy difícil",
                    "Aceptable",
                    "Fácil y rápido",
                ],
            ),
            "mobile_clubes": Noul(
                instructions="El directorio de clubes es usable en móviles?"
            ),
        },

        # ── NOTICIAS ──
        "noticias": {
            "problema_critico": common_problema,
            "articulo_leible": Score(
                instructions="Qué tan legibles y agradables son los artículos de noticias?",
                criteria=[
                "Difícil de leer, mala tipografía o layout",
                "Aceptable pero mejorable",
                "Claro, visualmente agradable y bien estructurado",
            ],
            ),
            "categorias_claras": Noul(
                instructions="Las categorías/tags de las noticias son claras y útiles?"
            ),
            "imagenes_visibles": Noul(
                instructions="Las imágenes de las noticias son visibles y relevantes?"
            ),
            "mobile_noticias": Noul(
                instructions="Las noticias son legibles y navegables en móvil?"
            ),
        },

        # ── ADMIN ──
        "admin": {
            "problema_critico": common_problema,
            "navegacion_admin": Score(
                instructions="Qué tan fácil es navegar entre las secciones del admin?",
                criteria=[
                    "Confuso, no encuentro las secciones",
                    "Aceptable, sidebar funciona",
                    "Muy claro, todo accesible en 1 click",
                ],
            ),
            "formularios_admin": Score(
                instructions="Qué tan fáciles son los formularios CRUD del admin?",
                criteria=[
                    "Confusos, mucho campo sin guía",
                    "Usables con alguna ambigüedad",
                    "Claros con labels y validación",
                ],
            ),
            "onboarding_wizard": Score(
                instructions="Qué tan útil y claro es el wizard de onboarding de 5 pasos?",
                criteria=[
                    "No entiendo qué configurar",
                    "Parcialmente claro",
                    "Muy claro, puedo configurar todo",
                ],
            ),
            "datos_en_vivo": Noul(
                instructions="Las estadísticas del overview se actualizan en tiempo real?"
            ),
            "mobile_admin": Noul(
                instructions="El panel de admin es usable en dispositivos móviles?"
            ),
        },
    }

    return questions.get(pagina, {})


# ─── AUDIT FUNCIONES ────────────────────────────────────

def audit_pagina(pagina: str, state: str = None) -> dict:
    """Ejecuta el audit de una página específica."""
    state = state or STATES.get(pagina)
    if not state:
        raise ValueError(f"Página desconocida: {pagina}")

    questions = get_questions(pagina)

    response = client.system_one(
        state=state,
        model="jev-latest",
        questions=questions,
    )

    answers = response.answers
    usage = getattr(response, "usage", {})

    result = {
        "pagina": pagina,
        "problema_critico": {
            "value": getattr(answers["problema_critico"], "choice", None),
            "confidence": getattr(answers["problema_critico"], "confidence", None),
            "probabilities": getattr(answers["problema_critico"], "probabilities", None),
        },
    }

    # Extraer todas las respuestas dinámicamente
    for key in answers:
        answer = answers[key]
        result[key] = {
            "type": getattr(answer, "type", None),
            "value": getattr(answer, "choice", getattr(answer, "score", getattr(answer, "noul", None))),
            "confidence": getattr(answer, "confidence", None),
        }
        if hasattr(answer, "probabilities"):
            result[key]["probabilities"] = answer.probabilities

    result["usage"] = {
        "input_tokens": getattr(usage, "input_tokens", None),
        "output_tokens": getattr(usage, "output_tokens", None),
    }

    return result


def audit_completo():
    """Ejecuta el audit completo de todas las páginas."""
    resultados = []
    for pagina in STATES:
        print(f"\n🔍 Auditing: {pagina}...")
        try:
            result = audit_pagina(pagina)
            resultados.append(result)
            print(f"   ✅ Problema: {result['problema_critico']['value']}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

    return resultados


# ─── IMPRESIÓN DE RESULTADOS ────────────────────────────

def print_result(result: dict):
    """Formatea y muestra un resultado de audit."""
    print(f"\n{'='*60}")
    print(f"📄 PÁGINA: {result['pagina'].upper()}")
    print(f"{'='*60}")
    print(f"❌ Problema crítico: {result['problema_critico']['value']}")
    print(f"   Confianza: {result['problema_critico']['confidence']}")

    for key, val in result.items():
        if key in ("pagina", "problema_critico", "usage"):
            continue
        conf = val.get("confidence", "N/A")
        value = val.get("value", "N/A")
        q_type = val.get("type", "")
        label = key.replace("_", " ").title()
        print(f"  {label}: {value} (confianza: {conf}) [{q_type}]")

    usage = result.get("usage", {})
    if usage.get("input_tokens"):
        print(f"\n⚡ Tokens: {usage['input_tokens']} in / {usage['output_tokens']} out")


def print_summary(resultados: list):
    """Muestra resumen ejecutivo."""
    print(f"\n{'='*60}")
    print("📊 RESUMEN EJECUTIVO — AUDIT UX/UI LIGA16")
    print(f"{'='*60}")

    pagina_prioridad = []
    for r in resultados:
        problema = r["problema_critico"]["value"]
        conf = r["problema_critico"]["confidence"] or 0
        pagina_prioridad.append((r["pagina"], problema, conf))

    # Ordenar por confianza descendente (más seguro = más claro el problema)
    pagina_prioridad.sort(key=lambda x: x[2] or 0, reverse=True)

    print("\n🥇 PRIORIDAD DE REFACTORIZACIÓN (más problemático primero):")
    for i, (pagina, problema, conf) in enumerate(pagina_prioridad, 1):
        print(f"  {i}. {pagina}: {problema} (confianza: {conf})")

    print("\n📋 DIMENSIONES MÁS DÉBILES (promedio de confidence por tipo):")
    dimensiones = {}
    for r in resultados:
        for key, val in r.items():
            if key in ("pagina", "problema_critico", "usage"):
                continue
            conf = val.get("confidence", 0) or 0
            dim = key.replace("_", " ")
            if dim not in dimensiones:
                dimensiones[dim] = []
            dimensiones[dim].append(conf)

    for dim, scores in sorted(dimensiones.items(), key=lambda x: sum(x[1])/len(x[1])):
        avg = sum(scores) / len(scores)
        print(f"  {dim}: {avg:.2f} promedio")


# ─── MAIN ────────────────────────────────────────────────

if __name__ == "__main__":
    print("🚀 Liga16 UX/UI Audit con TypeSafe Jev")
    print("=" * 50)

    # Opción 1: Audit completo
    print("\n📊 Ejecutando audit completo de todas las páginas...")
    resultados = audit_completo()

    # Mostrar resultados por página
    for r in resultados:
        print_result(r)

    # Resumen ejecutivo
    print_summary(resultados)

    # Opción 2: Audit rápido de una página
    print("\n\n" + "=" * 60)
    print("💡 Para auditear una página específica:")
    print("   audit_pagina('torneos')")
    print("   audit_pagina('calendario')")
    print("   audit_pagina('ranking')")
    print("   audit_pagina('admin')")
    print("=" * 60)
