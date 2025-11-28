# Скрипт для первоначальной настройки git и GitHub
# Использование: .\setup-git.ps1

Write-Host "🔧 Настройка Git для проекта..." -ForegroundColor Green
Write-Host ""

# Проверяем, установлен ли git
try {
    $gitVersion = git --version
    Write-Host "✅ Git установлен: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git не установлен! Установите Git с https://git-scm.com/" -ForegroundColor Red
    exit 1
}

# Инициализируем репозиторий, если нужно
if (-not (Test-Path .git)) {
    Write-Host "📦 Инициализация git репозитория..." -ForegroundColor Yellow
    git init
    
    # Устанавливаем ветку по умолчанию
    git branch -M main
    Write-Host "✅ Репозиторий инициализирован" -ForegroundColor Green
} else {
    Write-Host "✅ Git репозиторий уже инициализирован" -ForegroundColor Green
}

# Проверяем remote
$remote = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "📡 Настройка remote для GitHub:" -ForegroundColor Yellow
    Write-Host ""
    $repoUrl = Read-Host "Введите URL вашего GitHub репозитория (например: https://github.com/username/repo.git)"
    
    if ($repoUrl) {
        git remote add origin $repoUrl
        Write-Host "✅ Remote добавлен: $repoUrl" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Remote не добавлен. Добавьте вручную:" -ForegroundColor Yellow
        Write-Host "   git remote add origin https://github.com/username/repo.git" -ForegroundColor Gray
    }
} else {
    Write-Host "✅ Remote уже настроен: $remote" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Следующие шаги:" -ForegroundColor Cyan
Write-Host "1. Создайте репозиторий на GitHub (если еще не создан)" -ForegroundColor White
Write-Host "2. Добавьте remote (если не добавлен):" -ForegroundColor White
Write-Host "   git remote add origin https://github.com/username/repo.git" -ForegroundColor Gray
Write-Host "3. Используйте скрипт push.ps1 для быстрого пуша:" -ForegroundColor White
Write-Host "   .\push.ps1 'Описание изменений'" -ForegroundColor Gray
Write-Host ""

