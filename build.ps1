# 정적 공개 빌드 스크립트 (Windows / PowerShell)
# 공개 가능한 정적 파일만 publish/ 폴더로 모읍니다.
# .git / .env / .kiro / llms.txt(개인 기록) / node_modules / 서버 함수(netlify)는 제외됩니다.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$pub  = Join-Path $root 'publish'

if (Test-Path $pub) { Remove-Item $pub -Recurse -Force }
New-Item -ItemType Directory -Path $pub | Out-Null

# 공개할 파일 확장자/이름 패턴 (화이트리스트)
$include = @('*.html','*.jpg','*.jpeg','*.png','*.svg','*.gif','*.webp','*.ico','*.css','*.js','robots.txt','sitemap.xml')

# 공개에서 제외할 개인/비공개 파일 이름 (블랙리스트)
$exclude = @('llms.txt')

$copied = 0
Get-ChildItem -Path $root -File | Where-Object {
    $n = $_.Name
    ($include | Where-Object { $n -like $_ }) -and ($exclude -notcontains $n)
} | ForEach-Object {
    Copy-Item $_.FullName -Destination $pub
    $copied++
}

Write-Host "publish/ 생성 완료 — 복사한 파일 수: $copied"
