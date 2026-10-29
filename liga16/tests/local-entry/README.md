# Flujo individual aislado

Desde esta carpeta: `npm ci` y `npm test`. Requiere Chrome de Playwright disponible.
El test levanta Vite local y una base PostgreSQL/WASM en memoria, sin cuentas remotas.
Prueba autoinscripción real en ese motor: persiste, reintenta sin duplicado y no inscribe
a otro torneo. Tarifa 750 MXN es solo texto de fixture, explícitamente simulada; nunca
configura un torneo real ni registra dinero. No sustituye PostgREST/Storage E2E.

El alias de prueba usa detail-individual.preview.tsx. La ruta normal conserva el formulario
público anterior hasta una sustitución coordinada y autorizada. El servicio productivo
nuevo está desconectado y no llama RPC inexistente. No desplegar preview como flujo real.
