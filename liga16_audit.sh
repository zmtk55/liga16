#!/bin/bash
# ========================================
# Liga16 — UX/UI Audit con TypeSafe Jev
# ========================================
# Requiere: curl, jq (opcional)
# API Key: la de tu variable TYPESAFE_API_KEY o la del .env

API_KEY="${TYPESAFE_API_KEY:-apikey_215021618f5684c049599e7c575b92024f1d_cbe6a7e30d14715bc7e57a1ecbb43fa0daa008a009929096af91496fe5cccca7}"
ENDPOINT="https://api.typesafe.ai/v1/systemone"

echo "🚀 Liga16 UX/UI Audit — TypeSafe Jev"
echo "========================================"

# ── 1. HOMEPAGE / DASHBOARD ──
echo -e "\n🔍 Auditing: HOMEPAGE (dashboard)"
curl -s -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "state": "Página principal de Liga16 (dashboard de circuito de pádel): Header con logo, navegación principal, búsqueda, toggle dark/light mode. Hero/banner con torneo actual destacado. Sección de métricas del circuito (partidos en vivo, ranking). Sección de noticias recientes. Sección de sponsors. Footer con links legales y redes sociales.",
    "model": "jev-latest",
    "questions": {
      "problema_critico": {
        "type": "choice",
        "instructions": "Cuál es el problema de UX más grave en esta página?",
        "criteria": {
          "navegacion": "El usuario no encuentra lo que busca",
          "accesibilidad": "No cumple estándares WCAG",
          "jerarquia_visual": "No queda claro qué es lo más importante",
          "consistencia": "Patrones visuales inconsistentes",
          "rendimiento_mobile": "Experiencia en móvil es mala",
          "confusion": "El usuario no entiende qué hacer"
        }
      },
      "jerarquia_hero": {
        "type": "score",
        "instructions": "Qué tan clara es la jerarquía del hero/banner principal?",
        "criteria": [
          "No entiendes qué ofrece la app",
          "Parcialmente claro",
          "Al instante entendés el propósito"
        ]
      },
      "cta_principal": {
        "type": "choice",
        "instructions": "Qué CTA es más importante en el dashboard?",
        "criteria": {
          "ver_torneos": "Ir a ver torneos",
          "ver_calendario": "Ver calendario de partidos",
          "ver_ranking": "Ver ranking",
          "ver_noticias": "Leer noticias"
        }
      },
      "mobile_home": {
        "type": "noul",
        "instructions": "El dashboard es usable en dispositivos móviles?"
      }
    }
  }' | python3 -m json.tool 2>/dev/null || echo "(instala jq para formato)"

# ── 2. TORNEOS ──
echo -e "\n🔍 Auditing: TORNEOS"
curl -s -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "state": "Página de torneos de Liga16 (circuito de pádel): Listado de torneos en cards con info básica (nombre, fecha, sede, categoría, cupo disponible). Filtros por estado (activo, próximo, finalizado) y formato. Modal de inscripción de pareja con pago por transferencia o efectivo.",
    "model": "jev-latest",
    "questions": {
      "problema_critico": {
        "type": "choice",
        "instructions": "Cuál es el problema de UX más grave?",
        "criteria": {
          "navegacion": "El usuario se pierde",
          "accesibilidad": "Problemas WCAG",
          "jerarquia_visual": "No sé qué es importante",
          "consistencia": "Inconsistente",
          "rendimiento_mobile": "Mala en móvil",
          "inscripcion_confusa": "El flujo de inscripción es confuso"
        }
      },
      "info_torneo_clara": {
        "type": "score",
        "instructions": "Qué tan clara es la info de cada torneo en las cards?",
        "criteria": [
          "Confusa, falta info",
          "Parcialmente clara",
          "Al instante sabés todo"
        ]
      },
      "inscripcion_flujo": {
        "type": "score",
        "instructions": "Qué tan intuitivo es inscribirse a un torneo?",
        "criteria": [
          "Confuso, no sé cómo inscribirme",
          "Posible pero con fricción",
          "Rápido y sin dudas"
        ]
      },
      "filtros_utiles": {
        "type": "noul",
        "instructions": "Los filtros por estado y formato son útiles?"
      },
      "pago_claro": {
        "type": "noul",
        "instructions": "El método de pago (transferencia/efectivo) está claro?"
      }
    }
  }' | python3 -m json.tool 2>/dev/null

# ── 3. CALENDARIO ──
echo -e "\n🔍 Auditing: CALENDARIO"
curl -s -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "state": "Página de calendario de Liga16: Vista de partidos por fecha con react-day-picker. Muestra partidos en vivo, programados y resultados. Cada partido muestra equipos, score, estado. Filtros por fecha o torneo.",
    "model": "jev-latest",
    "questions": {
      "problema_critico": {
        "type": "choice",
        "instructions": "Cuál es el problema de UX más grave?",
        "criteria": {
          "navegacion": "No encuentro los partidos",
          "accesibilidad": "Problemas WCAG",
          "jerarquia_visual": "No sé qué es importante",
          "consistencia": "Inconsistente",
          "rendimiento_mobile": "Mala en móvil"
        }
      },
      "partidos_vivos": {
        "type": "score",
        "instructions": "Qué tan bien se distinguen los partidos en vivo de los programados?",
        "criteria": [
          "Todo se ve igual",
          "Parcialmente distinguibles",
          "Claramente diferenciados"
        ]
      },
      "score_legible": {
        "type": "score",
        "instructions": "Qué tan legibles son los scores/marcadores?",
        "criteria": [
          "Confusos",
          "Parcialmente claros",
          "Claros al instante"
        ]
      },
      "vivo_actualizado": {
        "type": "noul",
        "instructions": "Los partidos en vivo se actualizan en tiempo real?"
      },
      "mobile_calendar": {
        "type": "noul",
        "instructions": "El calendario es usable en móviles?"
      }
    }
  }' | python3 -m json.tool 2>/dev/null

# ── 4. RANKING ──
echo -e "\n🔍 Auditing: RANKING"
curl -s -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "state": "Página de ranking de Liga16 (circuito de pádel): Tabla de clasificación oficial de jugadores con filtros por rama (masculino/femenino) y ciudad. Cada fila muestra posición, nombre, puntos, tendencia (sube/baja). Link al detalle del jugador.",
    "model": "jev-latest",
    "questions": {
      "problema_critico": {
        "type": "choice",
        "instructions": "Cuál es el problema de UX más grave?",
        "criteria": {
          "navegacion": "El usuario se pierde",
          "accesibilidad": "Problemas WCAG",
          "jerarquia_visual": "No sé qué es importante",
          "consistencia": "Inconsistente",
          "rendimiento_mobile": "Mala en móvil"
        }
      },
      "tabla_legible": {
        "type": "score",
        "instructions": "Qué tan legible es la tabla de ranking?",
        "criteria": [
          "Confusa, no entiendo la clasificación",
          "Parcialmente clara",
          "Clara al instante"
        ]
      },
      "tendencia_visible": {
        "type": "noul",
        "instructions": "La tendencia de subida/baja es visualmente clara?"
      },
      "filtros_rank": {
        "type": "noul",
        "instructions": "Los filtros por rama y ciudad funcionan bien?"
      },
      "mobile_rank": {
        "type": "noul",
        "instructions": "El ranking es usable en móviles?"
      }
    }
  }' | python3 -m json.tool 2>/dev/null

# ── 5. ADMIN PANEL ──
echo -e "\n🔍 Auditing: ADMIN"
curl -s -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "state": "Panel de administración de Liga16 (/admin): Overview con estadísticas y acciones rápidas. Sub-secciones CRUD para torneos, jugadores, equipos, resultados, ranking, configuración de padel y noticias. Incluye wizard de onboarding de 5 pasos para configuración inicial.",
    "model": "jev-latest",
    "questions": {
      "problema_critico": {
        "type": "choice",
        "instructions": "Cuál es el problema de UX más grave en el admin?",
        "criteria": {
          "navegacion": "No encuentro las secciones",
          "accesibilidad": "Problemas WCAG",
          "jerarquia_visual": "No sé qué es importante",
          "consistencia": "Inconsistente",
          "rendimiento_mobile": "Mala en móvil",
          "formularios": "Los formularios son confusos"
        }
      },
      "navegacion_admin": {
        "type": "score",
        "instructions": "Qué tan fácil es navegar entre las secciones del admin?",
        "criteria": [
          "Confuso, no encuentro las secciones",
          "Aceptable, sidebar funciona",
          "Muy claro, todo accesible"
        ]
      },
      "formularios_claros": {
        "type": "score",
        "instructions": "Qué tan claros son los formularios CRUD?",
        "criteria": [
          "Confusos, muchos campos sin guía",
          "Usables con ambigüedad",
          "Claros con labels y validación"
        ]
      },
      "onboarding_claro": {
        "type": "score",
        "instructions": "Qué tan útil y claro es el wizard de onboarding?",
        "criteria": [
          "No entiendo qué configurar",
          "Parcialmente claro",
          "Muy claro, puedo configurar todo"
        ]
      },
      "mobile_admin": {
        "type": "noul",
        "instructions": "El panel admin es usable en móviles?"
      }
    }
  }' | python3 -m json.tool 2>/dev/null

echo -e "\n✅ Audit completo ejecutado."
echo "💡 Para auditear OTRA pantalla, pegá el state en un curl POST a: $ENDPOINT"
