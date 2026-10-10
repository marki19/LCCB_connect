# ─────────────────────────────────────────────────────────────────────────────
# scripts/restore-mock-data.ps1
# Restores all mock data from backup.
# ─────────────────────────────────────────────────────────────────────────────

$root   = "$PSScriptRoot\..\src\data\mock"
$backup = "$root\backup"

if (-not (Test-Path $backup)) {
  Write-Host "No backup found. Run the app once first." -ForegroundColor Red
  exit 1
}

$files = @("users.json", "posts.json", "conversations.json", "notifications.json", "comments.json")

foreach ($file in $files) {
  if (Test-Path "$backup\$file") {
    Copy-Item "$backup\$file" "$root\$file" -Force
    Write-Host "  restored: $file" -ForegroundColor Cyan
  }
}

Write-Host ""
Write-Host "  Mock data restored." -ForegroundColor Green
Write-Host "  Restart Expo (press r) to see the data." -ForegroundColor Yellow
Write-Host ""