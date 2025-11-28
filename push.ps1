# Скрипт для быстрого пуша на GitHub
# Использование: .\push.ps1 "описание коммита"

param(
    [string]$message = "Update"
)

Write-Host "🚀 Подготовка к push на GitHub..." -ForegroundColor Green
Write-Host ""

# Проверяем, инициализирован ли git
if (-not (Test-Path .git)) {
    Write-Host "📦 Инициализация git репозитория..." -ForegroundColor Yellow
    git init
}

# Добавляем все файлы
Write-Host "📝 Добавление файлов..." -ForegroundColor Cyan
git add .

# Проверяем, есть ли изменения
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "⚠️  Нет изменений для коммита" -ForegroundColor Yellow
    exit 0
}

# Коммитим
Write-Host "💾 Создание коммита: $message" -ForegroundColor Cyan
git commit -m $message

# Проверяем, есть ли remote
$remote = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Remote 'origin' не настроен!" -ForegroundColor Yellow
    Write-Host "Настройте remote командой:" -ForegroundColor Yellow
    Write-Host "  git remote add origin https://github.com/ВАШ_USERNAME/ВАШ_РЕПОЗИТОРИЙ.git" -ForegroundColor Gray
    exit 1
}

# Пушим
Write-Host "📤 Push на GitHub..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Успешно отправлено на GitHub!" -ForegroundColor Green
} else {
    # Пробуем master вместо main
    Write-Host "Пробуем ветку master..." -ForegroundColor Yellow
    git push origin master
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Успешно отправлено на GitHub!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Ошибка при push. Проверьте настройки remote." -ForegroundColor Red
    }
}

