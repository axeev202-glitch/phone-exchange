# Dockerfile для phone-exchange
FROM node:18-alpine

# Установка рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json (если есть)
COPY package*.json ./

# Установка зависимостей
RUN npm ci --only=production

# Копирование всех файлов приложения
COPY . .

# Создание директорий для данных и логов
RUN mkdir -p data logs

# Открытие порта
EXPOSE 3000

# Запуск приложения
CMD ["node", "server.js"]

