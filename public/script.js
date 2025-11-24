// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();

// URL вашего Vercel приложения
const API_URL = 'https://obmentech.vercel.app/api';

let appData = {
    user: null,
    listings: [],
    myListings: []
};

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    const user = tg.initDataUnsafe?.user;
    if (user) {
        appData.user = {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            username: user.username
        };
        updateUserProfile();
    }
    
    await loadListingsFromAPI();
}

function setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    document.getElementById('create-listing-form').addEventListener('submit', function(e) {
        e.preventDefault();
        createNewListing();
    });

    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeAllModals);
    });

    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeAllModals();
        }
    });
}

// Загрузка объявлений с сервера
async function loadListingsFromAPI() {
    try {
        const response = await fetch(`${API_URL}/listings`);
        appData.listings = await response.json();
        
        if (appData.user) {
            appData.myListings = appData.listings.filter(listing => listing.userId === appData.user.id);
        }
        
        renderListings();
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showNotification('❌ Ошибка загрузки объявлений');
        renderListings();
    }
}

// Создание объявления
async function createNewListing() {
    if (!appData.user) return;

    const form = document.getElementById('create-listing-form');
    const phoneModel = document.getElementById('phone-model').value.trim();
    const condition = document.getElementById('phone-condition').value;
    const desiredPhone = document.getElementById('desired-phone').value.trim();

    if (!phoneModel || !condition || !desiredPhone) {
        showNotification('❌ Заполните все поля');
        return;
    }

    const conditionTextMap = {
        'new': 'Новый', 'excellent': 'Отличное', 'good': 'Хорошее', 'satisfactory': 'Удовлетворительное'
    };

    const listingData = {
        userId: appData.user.id,
        userName: appData.user.firstName + (appData.user.lastName ? ' ' + appData.user.lastName : ''),
        userRating: 5.0,
        phoneModel: phoneModel,
        condition: condition,
        conditionText: conditionTextMap[condition],
        description: document.getElementById('phone-description').value.trim() || 'Описание не указано',
        desiredPhone: desiredPhone,
        location: getRandomCity(),
        isUserCreated: true
    };

    try {
        const response = await fetch(`${API_URL}/listings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(listingData)
        });

        const result = await response.json();
        
        if (result.success) {
            appData.listings.unshift(result.listing);
            appData.myListings.unshift(result.listing);
            form.reset();
            showNotification('✅ Объявление опубликовано!');
            switchTab('feed');
        }
    } catch (error) {
        showNotification('❌ Ошибка публикации');
    }
}

// Удаление объявления
async function deleteListing(listingId) {
    if (!confirm('Удалить объявление?')) return;

    try {
        const response = await fetch(`${API_URL}/listings?id=${listingId}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        
        if (result.success) {
            appData.listings = appData.listings.filter(l => l.id !== listingId);
            appData.myListings = appData.myListings.filter(l => l.id !== listingId);
            closeAllModals();
            renderListings();
            updateUserProfile();
            showNotification('🗑️ Объявление удалено');
        }
    } catch (error) {
        showNotification('❌ Ошибка удаления');
    }
}

function renderListings() {
    const container = document.querySelector('.listings-container');
    
    if (appData.listings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>📱 Пока нет объявлений</h3>
                <p>Будьте первым, кто создаст объявление!</p>
                <button class="btn btn-primary" onclick="switchTab('create')" 
                    style="margin-top: 15px; width: auto; display: inline-block; padding: 10px 20px;">
                    ➕ Создать первое объявление
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = appData.listings.map(listing => `
        <div class="listing-card" onclick="openListingModal(${listing.id})">
            <div class="listing-content">
                <div class="listing-image ${getPhoneBrand(listing.phoneModel)}">
                    ${getPhoneEmoji(listing.phoneModel)}<br>
                    ${listing.phoneModel}
                </div>
                <div class="listing-details">
                    <div class="listing-price">Обмен на ${listing.desiredPhone}</div>
                    <div class="listing-title">${listing.phoneModel} • ${listing.conditionText}</div>
                    <div class="listing-description">${listing.description}</div>
                    <div class="listing-location">📍 ${listing.location}</div>
                    <div class="listing-meta">
                        <div class="user-info">
                            <span>${listing.userName}</span>
                            <span class="rating">⭐ ${listing.userRating}</span>
                        </div>
                        <div class="timestamp">${getTimeAgo(listing.timestamp)}</div>
                    </div>
                </div>
            </div>
            ${listing.userId === appData.user?.id ? '<div class="my-listing-badge">Ваше объявление</div>' : ''}
        </div>
    `).join('');
}

// Вспомогательные функции
function getRandomCity() {
    const cities = ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань'];
    return cities[Math.floor(Math.random() * cities.length)];
}

function getPhoneBrand(model) {
    const lower = model.toLowerCase();
    if (lower.includes('iphone')) return 'iphone';
    if (lower.includes('samsung')) return 'samsung';
    if (lower.includes('xiaomi') || lower.includes('redmi')) return 'xiaomi';
    return 'iphone';
}

function getPhoneEmoji(model) {
    const lower = model.toLowerCase();
    if (lower.includes('iphone')) return '📱';
    if (lower.includes('samsung')) return '📲';
    if (lower.includes('xiaomi') || lower.includes('redmi')) return '⚡';
    return '📱';
}

function getTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / (1000 * 60 * 60));
    if (diff < 1) return 'только что';
    if (diff < 24) return `${diff} ч назад`;
    return `${Math.floor(diff / 24)} д назад`;
}

function switchTab(tabName) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');

    if (tabName === 'feed') renderListings();
    if (tabName === 'profile') updateUserProfile();
}

function updateUserProfile() {
    if (appData.user) {
        document.getElementById('user-name').textContent = 
            `${appData.user.firstName} ${appData.user.lastName || ''}`.trim();
        if (appData.user.username) {
            document.getElementById('user-username').textContent = `@${appData.user.username}`;
        }
        document.getElementById('active-listings').textContent = appData.myListings.length;
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: #0088cc; color: white; padding: 12px 20px; border-radius: 8px;
        z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// Функции для модальных окон (добавьте их)
function openListingModal(listingId) {
    const listing = appData.listings.find(l => l.id === listingId);
    if (!listing) return;

    const isMyListing = listing.userId === appData.user?.id;
    
    document.getElementById('modal-listing-content').innerHTML = `
        <div class="modal-header">
            <h3>${listing.phoneModel}</h3>
            <div style="color: #666; font-size: 0.9em;">${listing.conditionText}</div>
        </div>
        <div class="modal-body">
            <div style="text-align: center; margin-bottom: 20px;">
                <div class="listing-image ${getPhoneBrand(listing.phoneModel)}" style="margin: 0 auto;">
                    ${getPhoneEmoji(listing.phoneModel)}<br>
                    ${listing.phoneModel}
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <strong>Хочу обменять на:</strong>
                <div style="background: #fff3e0; padding: 10px; border-radius: 8px; margin-top: 5px;">
                    ${listing.desiredPhone}
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <strong>Описание:</strong>
                <p style="margin-top: 5px; color: #666;">${listing.description}</p>
            </div>
            
            <div style="display: flex; justify-content: space-between; color: #666; font-size: 0.9em;">
                <div>
                    <strong>📍 ${listing.location}</strong>
                </div>
                <div>
                    👤 ${listing.userName} ⭐ ${listing.userRating}
                </div>
            </div>
            
            ${isMyListing ? '<div class="my-listing-badge" style="margin-top: 15px;">Ваше объявление</div>' : ''}
        </div>
    `;

    const modalActions = document.querySelector('.modal-actions');
    if (isMyListing) {
        modalActions.innerHTML = `
            <button class="btn btn-secondary" onclick="editListing(${listingId})">✏️ Редактировать</button>
            <button class="btn btn-danger" onclick="deleteListing(${listingId})">🗑️ Удалить</button>
        `;
    } else {
        modalActions.innerHTML = `
            <button class="btn btn-primary" onclick="startExchange()">🔄 Начать обмен</button>
            <button class="btn btn-secondary" onclick="contactSeller()">💌 Написать продавцу</button>
        `;
    }

    document.getElementById('listing-modal').style.display = 'block';
    document.getElementById('listing-modal').dataset.listingId = listingId;
}

function editListing(listingId) {
    const listing = appData.listings.find(l => l.id === listingId);
    if (listing) {
        document.getElementById('phone-model').value = listing.phoneModel;
        document.getElementById('phone-condition').value = listing.condition;
        document.getElementById('phone-description').value = listing.description;
        document.getElementById('desired-phone').value = listing.desiredPhone;
        
        closeAllModals();
        switchTab('create');
        showNotification('✏️ Редактируйте ваше объявление');
    }
}

function startExchange() {
    const listingId = document.getElementById('listing-modal').dataset.listingId;
    document.getElementById('listing-modal').style.display = 'none';
    document.getElementById('exchange-modal').style.display = 'block';
    document.getElementById('exchange-modal').dataset.listingId = listingId;
}

function contactSeller() {
    const listingId = document.getElementById('listing-modal').dataset.listingId;
    const listing = appData.listings.find(l => l.id === parseInt(listingId));
    
    if (listing && appData.user) {
        showNotification(`💌 Напишите пользователю в Telegram для обсуждения обмена`);
    }
    
    closeAllModals();
}

function confirmExchange() {
    const listingId = document.getElementById('exchange-modal').dataset.listingId;
    showNotification('🔄 Обмен оформлен! С вами свяжется гарант в течение 24 часов.');
    closeAllModals();
}