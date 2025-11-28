#!/bin/bash
# Скрипт для включения HTTPS в Docker конфигурации

echo "🔒 Включение HTTPS..."

CONFIG_FILE="docker/nginx/conf.d/default.conf"

# Проверка наличия SSL сертификатов
if [ ! -f "ssl/fullchain.pem" ] || [ ! -f "ssl/privkey.pem" ]; then
    echo "❌ SSL сертификаты не найдены в директории ssl/"
    echo "📝 Получите сертификаты:"
    echo "   sudo certbot certonly --standalone -d your-domain.com"
    echo "   sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./ssl/"
    echo "   sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./ssl/"
    exit 1
fi

# Создание резервной копии
cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
echo "✅ Создана резервная копия: $CONFIG_FILE.backup"

# Раскомментирование редиректа HTTP → HTTPS
sed -i 's/# server {/server {/g' "$CONFIG_FILE"
sed -i 's/#     listen 80;/    listen 80;/g' "$CONFIG_FILE"
sed -i 's/#     server_name _;/    server_name _;/g' "$CONFIG_FILE"
sed -i 's/#     return 301 https:/    return 301 https:/g' "$CONFIG_FILE"
sed -i 's/# }/}/g' "$CONFIG_FILE" | head -10

# Раскомментирование HTTPS сервера
sed -i '/# HTTPS сервер/,/# }/s/# //g' "$CONFIG_FILE"

echo "✅ HTTPS включен в конфигурации Nginx"
echo "🔄 Перезапустите контейнеры: docker-compose restart nginx"

