const tg = window.Telegram.WebApp;
tg.expand();

// Определяем URL API в зависимости от среды
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
const API_URL = isLocalhost 
  ? 'http://localhost:3000/api/listings' 
  : 'https://' + window.location.hostname + '/api/listings';

console.log('API URL:', API_URL);

// Глобальные переменные
let currentUser = null;
let allListings = [];
let lastCreatedListingId = null;

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
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
        console.log('Telegram user:', currentUser);
    } else {
        // Запасной вариант для тестирования вне Telegram
        currentUser = {
            id: 'test_user_' + Date.now(),
            name: 'Test User',
            username: 'test_user'
        };
        console.log('Test user:', currentUser);
    }
    
    // Обновляем профиль
    updateProfile();
    
    // Загружаем объявления
    loadListings();
    
    // Настраиваем кнопки
    setupButtons();
    
    // Показываем приложение с анимацией
    setTimeout(() => {
        document.body.style.opacity = '1';
        document.body.style.transition = 'opacity 0.5s ease';
    }, 100);
}

function updateProfile() {
    if (currentUser) {
        const userNameElement = document.getElementById('user-name');
        const userUsernameElement = document.getElementById('user-username');
        
        if (userNameElement) {
            userNameElement.textContent = currentUser.name;
        }
        if (userUsernameElement) {
            userUsernameElement.textContent = currentUser.username ? `@${currentUser.username}` : '';
        }
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
    
    // Форма создания объявления
    const createForm = document.getElementById('create-listing-form');
    if (createForm) {
        createForm.addEventListener('submit', function(e) {
            e.preventDefault();
            createListing();
        });
    }
    
    // Закрытие модальных окон
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
}

// Загрузка объявлений
async function loadListings() {
    console.log('Loading listings from:', API_URL);
    
    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Loaded listings:', data);
        
        allListings = Array.isArray(data) ? data : [];
        showListings();
        
    } catch (error) {
        console.error('Ошибка загрузки объявлений:', error);
        showError('Не удалось загрузить объявления. Показываем демо данные.');
        showDemoListings();
    }
}

// Создание объявления
async function createListing() {
    console.log('Starting to create listing...');
    
    const phoneModel = document.getElementById('phone-model')?.value.trim();
    const condition = document.getElementById('phone-condition')?.value;
    const description = document.getElementById('phone-description')?.value.trim();
    const desiredPhone = document.getElementById('desired-phone')?.value.trim();
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    console.log('Form data:', { phoneModel, condition, description, desiredPhone });
    
    // Валидация
    if (!phoneModel || !condition || !desiredPhone) {
        showError('Заполните обязательные поля: модель, состояние и желаемый обмен!');
        return;
    }
    
    // Показываем индикатор загрузки
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';
    submitBtn.disabled = true;
    
    const listingData = {
        phoneModel: phoneModel,
        condition: condition,
        description: description || 'Нет описания',
        desiredPhone: desiredPhone,
        location: 'Москва',
        userId: currentUser?.id
    };
    
    console.log('Sending data to API:', listingData);
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(listingData)
        });
        
        console.log('API response status:', response.status);
        
        const result = await response.json();
        console.log('API response data:', result);
        
        if (response.ok && result.success) {
            // Сохраняем ID созданного объявления для подсветки
            lastCreatedListingId = result.listing.id;
            
            // Запускаем анимацию успеха и перехода
            await animateSuccessAndTransition();
            
            // Очищаем форму
            document.getElementById('create-listing-form').reset();
            
        } else {
            // Ошибка от API
            throw new Error(result.error || 'Unknown API error');
        }
        
    } catch (error) {
        console.error('Ошибка при создании объявления:', error);
        showError(`❌ Ошибка при создании объявления: ${error.message}`);
    } finally {
        // Скрываем индикатор загрузки
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
        submitBtn.disabled = false;
    }
}

// Анимация успеха и перехода к ленте
async function animateSuccessAndTransition() {
    // Создаем анимацию успеха
    const successAnimation = document.createElement('div');
    successAnimation.className = 'success-animation';
    successAnimation.innerHTML = '<div class="success-check">✅</div>';
    document.body.appendChild(successAnimation);
    
    // Ждем завершения анимации успеха
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Убираем анимацию успеха
    successAnimation.remove();
    
    // Запускаем анимацию перехода
    animateToFeed();
}

// Анимация перехода к ленте
function animateToFeed() {
    const createTab = document.getElementById('create');
    const feedTab = document.getElementById('feed');
    const feedBtn = document.querySelector('[data-tab="feed"]');
    const createBtn = document.querySelector('[data-tab="create"]');
    
    // Создаем элемент для анимации перехода
    const transitionElement = document.createElement('div');
    transitionElement.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        transform: translate(-50%, -50%) scale(0);
        z-index: 10000;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2em;
        color: white;
        box-shadow: 0 0 50px rgba(102, 126, 234, 0.5);
    `;
    transitionElement.innerHTML = '📱';
    document.body.appendChild(transitionElement);
    
    // Анимация расширения круга
    const animation = transitionElement.animate([
        { 
            transform: 'translate(-50%, -50%) scale(0)',
            opacity: 1
        },
        { 
            transform: 'translate(-50%, -50%) scale(1.5)',
            opacity: 0.8
        },
        { 
            transform: 'translate(-50%, -50%) scale(4)',
            opacity: 0
        }
    ], {
        duration: 800,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    });
    
    // Плавное скрытие формы создания
    createTab.classList.add('hiding');
    
    animation.onfinish = () => {
        // Убираем элемент анимации
        transitionElement.remove();
        
        // Переключаем вкладки
        createTab.classList.remove('active', 'hiding');
        feedTab.classList.add('active', 'showing');
        
        createBtn.classList.remove('active');
        feedBtn.classList.add('active');
        
        // Загружаем обновленные объявления
        loadListings().then(() => {
            // После загрузки подсвечиваем новое объявление
            setTimeout(() => {
                highlightNewListing();
            }, 300);
        });
        
        // Убираем класс showing после анимации
        setTimeout(() => {
            feedTab.classList.remove('showing');
        }, 500);
    };
}

// Подсветка нового объявления
function highlightNewListing() {
    if (lastCreatedListingId) {
        const newListingElement = document.querySelector(`[onclick="showListingModal('${lastCreatedListingId}')"]`);
        if (newListingElement) {
            newListingElement.classList.add('new-listing');
            newListingElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            // Убираем подсветку через 3 секунды
            setTimeout(() => {
                newListingElement.classList.remove('new-listing');
            }, 3000);
        }
    }
}

// Показ объявлений
function showListings() {
    const container = document.querySelector('.listings-container');
    if (!container) return;
    
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
        <div class="listing-card" onclick="showListingModal('${item.id}')">
            <div class="listing-content">
                <div class="listing-image ${getPhoneBrand(item.phoneModel)}">
                    📱<br>${item.phoneModel}
                </div>
                <div class="listing-details">
                    <div class="listing-title">${item.phoneModel}</div>
                    <div class="listing-description">${item.description}</div>
                    <div class="listing-price">→ ${item.desiredPhone}</div>
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

// Демо данные при ошибке загрузки
function showDemoListings() {
    const container = document.querySelector('.listings-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="listing-card" onclick="showListingModal('demo1')">
            <div class="listing-content">
                <div class="listing-image iphone">
                    📱<br>iPhone 14 Pro
                </div>
                <div class="listing-details">
                    <div class="listing-title">iPhone 14 Pro</div>
                    <div class="listing-description">Отличное состояние, батарея 95%</div>
                    <div class="listing-price">→ Samsung S23</div>
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
        <div class="listing-card" onclick="showListingModal('demo2')">
            <div class="listing-content">
                <div class="listing-image samsung">
                    📱<br>Samsung S23
                </div>
                <div class="listing-details">
                    <div class="listing-title">Samsung Galaxy S23</div>
                    <div class="listing-description">Новый, в коробке</div>
                    <div class="listing-price">→ iPhone 15</div>
                    <div class="listing-location">📍 Санкт-Петербург</div>
                    <div class="listing-meta">
                        <div class="user-info">
                            <span class="rating">⭐ 4.8</span>
                        </div>
                        <div class="timestamp">2 часа назад</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Уведомления
function showSuccess(message) {
    if (tg && tg.showPopup) {
        tg.showPopup({
            title: 'Успех',
            message: message,
            buttons: [{ type: 'ok' }]
        });
    } else {
        alert(message);
    }
}

function showError(message) {
    if (tg && tg.showPopup) {
        tg.showPopup({
            title: 'Ошибка',
            message: message,
            buttons: [{ type: 'ok' }]
        });
    } else {
        alert(message);
    }
}

// Вспомогательные функции
function getPhoneBrand(model) {
    if (!model) return 'iphone';
    const lowerModel = model.toLowerCase();
    if (lowerModel.includes('iphone')) return 'iphone';
    if (lowerModel.includes('samsung')) return 'samsung';
    if (lowerModel.includes('xiaomi') || lowerModel.includes('redmi')) return 'xiaomi';
    if (lowerModel.includes('pixel')) return 'google';
    if (lowerModel.includes('huawei')) return 'huawei';
    return 'iphone';
}

function formatTime(timestamp) {
    if (!timestamp) return 'недавно';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    return date.toLocaleDateString('ru-RU');
}

// Переключение вкладок
function showTab(tabName) {
    // Скрываем все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active', 'showing', 'hiding');
    });
    
    // Убираем активность у всех кнопок
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показываем нужную вкладку
    const targetTab = document.getElementById(tabName);
    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
    
    if (targetTab) {
        targetTab.classList.add('active', 'showing');
        setTimeout(() => {
            targetTab.classList.remove('showing');
        }, 500);
    }
    if (targetBtn) targetBtn.classList.add('active');
    
    // Обновляем ленту при переходе
    if (tabName === 'feed') {
        setTimeout(() => loadListings(), 100);
    }
}

function editProfile() {
    showError('Редактирование профиля - скоро!');
}

function showMyListings() {
    showError('Мои объявления - скоро!');
    showTab('feed');
}

function showListingModal(listingId) {
    const listing = allListings.find(item => item.id === listingId);
    if (!listing) return;
    
    const modalContent = document.getElementById('modal-listing-content');
    if (!modalContent) return;
    
    modalContent.innerHTML = `
        <div class="modal-header">
            <h3>${listing.phoneModel}</h3>
            <p class="listing-condition">${getConditionText(listing.condition)}</p>
        </div>
        <div class="modal-body">
            <div class="listing-image-large ${getPhoneBrand(listing.phoneModel)}">
                📱<br>${listing.phoneModel}
            </div>
            <div class="listing-details-modal">
                <h4>Описание</h4>
                <p>${listing.description}</p>
                <h4>Желаемый обмен</h4>
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
    showError('Функция связи с продавцом скоро будет доступна!');
}

function confirmExchange() {
    showSuccess('Обмен успешно начат! Ожидайте подтверждения.');
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