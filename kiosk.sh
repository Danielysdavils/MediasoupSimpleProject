#!/bin/bash

# Evita que a tela apague ou bloqueie
xset s noblank
xset s off
xset -dpms

# Esconde cursor
unclutter -root &

# Corrige estado de crash do Chromium
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' /home/pi/.config/chromium/Default/Preferences
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' /home/pi/.config/chromium/Default/Preferences

# Inicia Chromium em Kiosk com flags de otimização
/usr/bin/chromium-browser \
  --noerrdialogs \
  --disable-infobars \
  --disable-translate \
  --user-data-dir=/tmp/kiosk_profile \
  --lang=en-US \
  --accept-lang=en-US \
  --kiosk http://localhost:5173 \
  --user-agent="kioskoBrowser" \
  --autoplay-policy=no-user-gesture-required \
  --disable-features=TranslateUI,BackForwardCache,MediaEngagementBypassAutoplayPolicies \
  --enable-features=VaapiVideoDecoder,VaapiVideoEncoder \
  --use-gl=egl \
  --enable-gpu-rasterization \
  --ignore-gpu-blocklist \
  --disable-software-rasterizer &

# Loop infinito (mantém script rodando)
while true; do
    sleep 10
done

