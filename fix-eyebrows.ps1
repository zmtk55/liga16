# Eliminar eyebrow= y stats={[...]} de todos los PageHero en features/
$files = @(
  "liga16/src/features/home/page.tsx",
  "liga16/src/features/teams/page.tsx",
  "liga16/src/features/rankings/page.tsx",
  "liga16/src/features/players/page.tsx",
  "liga16/src/features/clubs/page.tsx",
  "liga16/src/features/news/page.tsx",
  "liga16/src/features/calendar/page.tsx",
  "liga16/src/features/admin/dashboard.tsx"
)

foreach ($file in $files) {
  if (-not (Test-Path $file)) { Write-Host "SKIP (missing): $file"; continue }
  $content = Get-Content $file -Raw

  # 1. Eliminar líneas con eyebrow= (dentro de PageHero, con cualquier valor)
  $content = $content -replace '\s*eyebrow="[^"]*"\s*\n', ''

  # 2. Eliminar bloques stats={[ ... ]} multilinea
  $content = $content -replace '\s*stats=\{\[.*?\]\}\s*\n', ''

  Set-Content $file -Value $content -Encoding UTF8
  Write-Host "FIXED: $file"
}