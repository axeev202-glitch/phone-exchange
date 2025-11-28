# Makefile для удобного управления Docker контейнерами

.PHONY: help build up down restart logs ps shell clean

help: ## Показать справку
	@echo "Доступные команды:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Собрать Docker образы
	docker-compose build

up: ## Запустить контейнеры
	docker-compose up -d

down: ## Остановить контейнеры
	docker-compose down

restart: ## Перезапустить контейнеры
	docker-compose restart

logs: ## Показать логи
	docker-compose logs -f

logs-app: ## Показать логи приложения
	docker-compose logs -f app

logs-nginx: ## Показать логи Nginx
	docker-compose logs -f nginx

ps: ## Показать статус контейнеров
	docker-compose ps

shell: ## Войти в контейнер приложения
	docker-compose exec app sh

shell-nginx: ## Войти в контейнер Nginx
	docker-compose exec nginx sh

update: ## Обновить приложение (git pull + rebuild)
	git pull origin main
	docker-compose build
	docker-compose up -d

clean: ## Очистить неиспользуемые Docker ресурсы
	docker system prune -f

clean-all: ## Полная очистка (включая образы)
	docker system prune -a -f

stats: ## Показать использование ресурсов
	docker stats

