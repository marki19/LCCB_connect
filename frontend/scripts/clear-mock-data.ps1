# ─────────────────────────────────────────────────────────────────────────────
# scripts/clear-mock-data.ps1
# Wipes ALL mock/prototype data in one command.
# The app will still boot — all screens show empty states.
# To restore: run  scripts/restore-mock-data.ps1
# ─────────────────────────────────────────────────────────────────────────────

$root = "$PSScriptRoot\..\src\data\mock"

$files = @("users.json", "posts.json", "conversations.json", "notifications.json", "comments.json")

foreach ($file in $files) {
  "[]" | Set-Content "$root\$file" -Encoding UTF8
  Write-Host "  cleared: $file" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "  All mock data cleared." -ForegroundColor Green
Write-Host "  Restart Expo (press r) to see empty-state UI." -ForegroundColor Yellow
Write-Host ""