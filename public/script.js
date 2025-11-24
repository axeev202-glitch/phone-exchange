const tg = window.Telegram.WebApp;
tg.expand();

// Используем относительный путь для API в продакшене
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api' 
  : '/api';

// Глобальные переменные
let currentUser = null;
let allListings = [];

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    console.log('Initializing app...');
    
    // Получаем пользователя из Telegram
    const tgUser = tg.initDataUnsafe?.user;
    if (tgUser) {
        currentUser = {
            id: tgUser.id.toString(),
            firstName: tgUser.first_name,
            lastName: tgUser.last_name || '',
            username: tgUser.username,
            name: `${tgUser.first_name} ${tgUser.last_name || ''}`.trim()
        };
        
        // Обновляем профиль
        updateProfile();
    } else {
        // Запасной вариант для тестирования
        currentUser = {
            id: 'test_user_' + Date.now(),
            name: 'Telegram User',
            username: 'telegram_user'
        };
    }
    
    // Загружаем объявления
    loadListings();
    
    // Настраиваем кнопки
    setupButtons();
    
    // Показываем основное содержимое
    document.body.style.opacity = '1';
}

function updateProfile() {
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.name;
        document.getElementById('user-username').textContent = currentUser.username ? `@${currentUser.username}` : '';
    }
}

function setupButtons() {
    // Навигация
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            showTab(tab);
        });
    });
    
    // Форма создания
    document.getElementById('create-listing-form').addEventListener('submit', function(e) {
        e.preventDefault();
        createListing();
    });
    
    // Закрытие модальных окон
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
}

// Загрузка объявлений
async function loadListings() {
    try {
        console.log('Loading listings from:', API_URL + '/listings');
        const response = await fetch(API_URL + '/listings');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        allListings = await response.json();
        console.log('Loaded listings:', allListings);
        showListings();
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        // Показываем демо данные при ошибке
        showDemoListings();
    }
}

// Показ объявлений
function showListings() {
    const container = document.querySelector('.listings-container');
    
    if (allListings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>📱 Пока нет объявлений</h3>
                <p>Создайте первое объявление!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = allListings.map(item => `
        <div class="listing-card" onclick="showListingModal(${item.id})">
            <div class="listing-content">
                <div class="listing-image ${getPhoneBrand(item.phoneModel)}">
                    📱<br>${item.phoneModel}
                </div>
                <div class="listing-details">
                    <div class="listing-title">${item.phoneModel}</div>
                    <div class="listing-description">${item.description}</div>
                    <div class="listing-price">Обмен на: ${item.desiredPhone}</div>
                    <div class="listing-location">📍 ${item.location}</div>
                    <div class="listing-meta">
                        <div class="user-info">
                            <span class="rating">⭐ 5.0</span>
                        </div>
                        <div class="timestamp">${formatTime(item.timestamp)}</div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Демо данные для тестирования
function showDemoListings() {
    const container = document.querySelector('.listings-container');
    container.innerHTML = `
        <div class="listing-card">
            <div class="listing-content">
                <div class="listing-image iphone">
                    📱<br>iPhone 14 Pro
                </div>
                <div class="listing-details">
                    <div class="listing-title">iPhone 14 Pro</div>
                    <div class="listing-description">Отличное состояние, батарея 95%</div>
                    <div class="listing-price">Обмен на: Samsung S23</div>
                    <div class="listing-location">📍 Москва</div>
                    <div class="listing-meta">
                        <div class="user-info">
                            <span class="rating">⭐ 5.0</span>
                        </div>
                        <div class="timestamp">только что</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Создание объявления
async function createListing() {
    const phoneModel = document.getElementById('phone-model').value.trim();
    const condition = document.getElementById('phone-condition').value;
    const description = document.getElementById('phone-description').value.trim();
    const desiredPhone = document.getElementById('desired-phone').value.trim();
    
    // Проверка
    if (!phoneModel || !condition || !desiredPhone) {
        showNotification('Заполните обязательные поля!', 'error');
        return;
    }
    
    const listingData = {
        phoneModel: phoneModel,
        condition: condition,
        description: description || 'Нет описания',
        desiredPhone: desiredPhone,
        location: 'Москва',
        userId: currentUser?.id
    };
    
    console.log('Creating listing:', listingData);
    
    try {
        const response = await fetch(API_URL + '/listings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(listingData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Очищаем форму
            document.getElementById('create-listing-form').reset();
            
            // Показываем уведомление
            showNotification('✅ Объявление создано!', 'success');
            
            // Переходим в ленту и обновляем
            showTab('feed');
            loadListings();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Ошибка создания:', error);
        showNotification('❌ Ошибка при создании объявления', 'error');
    }
}

// Вспомогательные функции
function getPhoneBrand(model) {
    const lowerModel = model.toLowerCase();
    if (lowerModel.includes('iphone')) return 'iphone';
    if (lowerModel.includes('samsung')) return 'samsung';
    if (lowerModel.includes('xiaomi')) return 'xiaomi';
    if (lowerModel.includes('pixel')) return 'google';
    if (lowerModel.includes('huawei')) return 'huawei';
    return 'iphone';
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    return date.toLocaleDateString('ru-RU');
}

function showNotification(message, type = 'info') {
    // Используем Telegram Web App уведомления если доступны
    if (tg && tg.showPopup) {
        tg.showPopup({
            title: type === 'error' ? 'Ошибка' : 'Успех',
            message: message,
            buttons: [{ type: 'ok' }]
        });
    } else {
        alert(message);
    }
}

// Переключение вкладок
function showTab(tabName) {
    // Скрываем все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Убираем активность у всех кнопок
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показываем нужную вкладку
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Если перешли в ленту - обновляем объявления
    if (tabName === 'feed') {
        loadListings();
    }
}

// Простые функции для кнопок
function editProfile() {
    showNotification('Редактирование профиля - скоро!', 'info');
}

function showMyListings() {
    showNotification('Мои объявления - скоро!', 'info');
    showTab('feed');
}

// Модальные окна
function showListingModal(listingId) {
    const listing = allListings.find(item => item.id === listingId);
    if (!listing) return;
    
    const modalContent = document.getElementById('modal-listing-content');
    modalContent.innerHTML = `
        <div class="modal-header">
            <h3>${listing.phoneModel}</h3>
            <p class="listing-condition">Состояние: ${getConditionText(listing.condition)}</p>
        </div>
        <div class="modal-body">
            <div class="listing-image-large ${getPhoneBrand(listing.phoneModel)}">
                📱<br>${listing.phoneModel}
            </div>
            <div class="listing-details-modal">
                <h4>Описание:</h4>
                <p>${listing.description}</p>
                <h4>Желаемый обмен:</h4>
                <p class="desired-phone">${listing.desiredPhone}</p>
                <div class="listing-info">
                    <span class="location">📍 ${listing.location}</span>
                    <span class="timestamp">${formatTime(listing.timestamp)}</span>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('listing-modal').style.display = 'block';
}

function getConditionText(condition) {
    const conditions = {
        'new': 'Новый',
        'excellent': 'Отличное',
        'good': 'Хорошее',
        'satisfactory': 'Удовлетворительное'
    };
    return conditions[condition] || condition;
}

function startExchange() {
    document.getElementById('listing-modal').style.display = 'none';
    document.getElementById('exchange-modal').style.display = 'block';
}

function contactSeller() {
    showNotification('Функция связи с продавцом скоро будет доступна!', 'info');
}

function confirmExchange() {
    showNotification('Обмен успешно начат! Ожидайте подтверждения.', 'success');
    document.getElementById('exchange-modal').style.display = 'none';
}

// Закрытие модальных окон при клике вне контента
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}