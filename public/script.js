const tg = window.Telegram.WebApp;
tg.expand();

const API_URL = 'https://phone-exchange.vercel.app/api';

// Глобальные переменные
let currentUser = null;
let allListings = [];

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    // Получаем пользователя
    const tgUser = tg.initDataUnsafe?.user;
    if (tgUser) {
        currentUser = {
            id: tgUser.id,
            name: `${tgUser.first_name} ${tgUser.last_name || ''}`.trim()
        };
    }
    
    // Загружаем объявления
    loadListings();
    
    // Настраиваем кнопки
    setupButtons();
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
}

// Загрузка объявлений
async function loadListings() {
    try {
        const response = await fetch(API_URL + '/listings');
        allListings = await response.json();
        showListings();
    } catch (error) {
        console.log('Ошибка загрузки:', error);
        showListings();
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
        <div class="listing-card">
            <div class="listing-content">
                <div class="listing-image">
                    📱<br>${item.phoneModel}
                </div>
                <div class="listing-details">
                    <div class="listing-title">${item.phoneModel}</div>
                    <div class="listing-description">${item.description}</div>
                    <div class="listing-price">Обмен на: ${item.desiredPhone}</div>
                    <div class="listing-location">📍 ${item.location}</div>
                </div>
            </div>
        </div>
    `).join('');
}

// Создание объявления
async function createListing() {
    const phoneModel = document.getElementById('phone-model').value.trim();
    const condition = document.getElementById('phone-condition').value;
    const description = document.getElementById('phone-description').value.trim();
    const desiredPhone = document.getElementById('desired-phone').value.trim();
    
    // Проверка
    if (!phoneModel || !condition || !desiredPhone) {
        alert('Заполните обязательные поля!');
        return;
    }
    
    const listingData = {
        phoneModel: phoneModel,
        condition: condition,
        description: description || 'Нет описания',
        desiredPhone: desiredPhone,
        location: 'Москва'
    };
    
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
            alert('✅ Объявление создано!');
            
            // Переходим в ленту и обновляем
            showTab('feed');
            loadListings();
        }
    } catch (error) {
        console.log('Ошибка создания:', error);
        alert('❌ Ошибка при создании объявления');
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
    alert('Редактирование профиля - скоро!');
}

function showMyListings() {
    alert('Мои объявления - скоро!');
    showTab('feed');
}