# dev-both.ps1 — פותח שני שרתי Metro בו-זמנית בשני חלונות נפרדים:
#   • 8081 → dev-client (אנדרואיד) — פותחים את Salinda (dev)
#   • 8082 → Expo Go + tunnel (אייפון) — פותחים ב-Expo Go
# הרצה:  קליק ימני → Run with PowerShell,  או בטרמינל:  ./dev-both.ps1

$proj = "C:\Users\User\salinda-mobile\card"

# משחרר את הפורטים אם נשארו תהליכים ישנים
foreach ($port in 8081, 8082) {
  $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }
}

# חלון 1 — אנדרואיד (dev-client)
Start-Process powershell -ArgumentList '-NoExit','-Command',"cd `"$proj`"; `$env:EXPO_PUBLIC_AUTH_SCHEME='salinda-dev'; npx expo start --dev-client --port 8081"

# חלון 2 — אייפון (Expo Go + tunnel)
Start-Process powershell -ArgumentList '-NoExit','-Command',"cd `"$proj`"; npx expo start --go --tunnel --port 8082"

Write-Host "שני שרתים נפתחו בחלונות נפרדים: 8081 dev-client (אנדרואיד) + 8082 tunnel (אייפון)."
Write-Host "ה-QR מופיע בכל חלון. לאייפון - סרוק את ה-QR של חלון ה-tunnel."
