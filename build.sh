#!/usr/bin/env bash
# 정적 공개 빌드 스크립트 (Netlify Linux 빌드 환경용)
# 공개 가능한 정적 파일만 publish/ 폴더로 모읍니다.
# .git / .env / .kiro / llms.txt(개인 기록) / node_modules / 서버 함수(netlify)는 제외됩니다.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PUB="$ROOT/publish"

rm -rf "$PUB"
mkdir -p "$PUB"

copied=0
shopt -s nullglob nocaseglob
for f in "$ROOT"/*.html "$ROOT"/*.jpg "$ROOT"/*.jpeg "$ROOT"/*.png \
         "$ROOT"/*.svg "$ROOT"/*.gif "$ROOT"/*.webp "$ROOT"/*.ico \
         "$ROOT"/*.css "$ROOT"/*.js "$ROOT"/robots.txt "$ROOT"/sitemap.xml; do
  base="$(basename "$f")"
  # 개인 기록 제외
  if [ "$base" = "llms.txt" ]; then
    continue
  fi
  cp "$f" "$PUB/"
  copied=$((copied + 1))
done

echo "publish/ 생성 완료 — 복사한 파일 수: $copied"
