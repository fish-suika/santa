#!/bin/sh
# 分割ソースを1枚のHTMLに結合する
cd "$(dirname "$0")"

# --- 本体 ---
cat src/00-head.html \
    src/10-config.js \
    src/12-physics.js \
    src/14-control.js \
    src/16-run.js \
    src/20-sound.js \
    src/30-world.js \
    src/40-santa.js \
    src/45-camera.js \
    src/50-input.js \
    src/60-hud.js \
    src/90-boot.js \
    src/99-tail.html > santa.html
cp santa.html index.html   # GitHub Pages はルートの index.html を配信する

# --- 検証ページ ---
# 本体と同じく1枚に結合する（<script src> で隣を読むと表示環境によって読み込まれないため）
cat src/verify-head.html \
    src/10-config.js \
    src/12-physics.js \
    src/14-control.js \
    src/16-run.js \
    src/verify-tests.js \
    src/99-tail.html > verify.html

echo "built santa.html + index.html ($(wc -c < santa.html) bytes)"
echo "built verify.html ($(wc -c < verify.html) bytes)"
