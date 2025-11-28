# 🐳 Быстрый старт с Docker

## Минимальные требования

- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM
- 10GB свободного места

## Быстрый запуск

### 1. Клонирование и настройка

```bash
git clone https://github.com/axeev202-glitch/phone-exchange.git
cd phone-exchange

# Создайте .env файл
cp env.example .env
nano .env  # Установите DOMAIN=your-domain.com

# Создайте необходимые директории
mkdir -p data logs/nginx ssl
```

### 2. Запуск (HTTP)

```bash
# Сборка и запуск
docker-compose up -d

# Просмотр логов
docker-compose logs -f
```

Приложение доступно по адресу: `http://your-domain.com` или `http://localhost`

### 3. Настройка HTTPS

```bash
# Остановите контейнеры
docker-compose down

# Получите SSL сертификат (на хосте)
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Скопируйте сертификаты
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./ssl/
sudo chmod 644 ./ssl/fullchain.pem
sudo chmod 600 ./ssl/privkey.pem

# Включите HTTPS в docker/nginx/conf.d/default.conf
# Раскомментируйте блоки HTTPS и редирект HTTP → HTTPS

# Запустите снова
docker-compose up -d
```

## Полезные команды

### С Makefile (если установлен make)

```bash
make help      # Справка по командам
make up        # Запустить
make down      # Остановить
make logs      # Логи
make restart   # Перезапустить
make update    # Обновить приложение
```

### Без Makefile

```bash
# Запуск
docker-compose up -d

# Остановка
docker-compose down

# Логи
docker-compose logs -f

# Перезапуск
docker-compose restart

# Обновление
git pull origin main
docker-compose build
docker-compose up -d
```

## Структура проекта

```
phone-exchange/
├── docker/
│   └── nginx/
│       ├── nginx.conf          # Основная конфигурация Nginx
│       └── conf.d/
│           ├── default.conf    # HTTP конфигурация
│           └── ssl.conf        # HTTPS конфигурация (пример)
├── data/                       # Данные приложения (монтируется)
├── logs/                       # Логи (монтируется)
├── ssl/                        # SSL сертификаты (монтируется)
├── Dockerfile                  # Образ Node.js приложения
├── docker-compose.yml          # Конфигурация Docker Compose
├── .env                        # Переменные окружения (не в git)
└── DOCKER.md                   # Подробная документация
```

## Подробная документация

См. [DOCKER.md](DOCKER.md) для полной документации по:
- Настройке SSL
- Мониторингу
- Резервному копированию
- Решению проблем
- Оптимизации

