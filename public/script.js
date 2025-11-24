const tg = window.Telegram.WebApp;
tg.expand();

const API_URL = 'https://phone-exchange.vercel.app/api';

let appData = {
    user: null,
    listings: [],
    myListings: []
};

// Добавь эту функцию для отладки
async function testAPI() {
    try {
        console.log('Testing API connection...');
        const response = await fetch(`${API_URL}/listings`);
        console.log('API Response status:', response.status);
        const data = await response.json();
        console.log('API Data:', data);
        return true;
    } catch (error) {
        console.error('API Test failed:', error);
        return false;
    }
}

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
    
    // Протестируй API перед загрузкой
    const apiWorking = await testAPI();
    if (apiWorking) {
        await loadListingsFromAPI();
    } else {
        showNotification('⚠️ Сервер временно недоступен');
        renderListings();
    }
}

async function createNewListing() {
    if (!appData.user) {
        showNotification('❌ Пользователь не определен');
        return;
    }

    const form = document.getElementById('create-listing-form');
    const phoneModel = document.getElementById('phone-model').value.trim();
    const condition = document.getElementById('phone-condition').value;
    const desiredPhone = document.getElementById('desired-phone').value.trim();

    if (!phoneModel || !condition || !desiredPhone) {
        showNotification('❌ Заполните все обязательные поля');
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
        console.log('Sending listing data:', listingData);
        
        const response = await fetch(`${API_URL}/listings`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(listingData)
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Server response:', result);
        
        if (result.success) {
            appData.listings.unshift(result.listing);
            appData.myListings.unshift(result.listing);
            form.reset();
            showNotification('✅ Объявление опубликовано!');
            switchTab('feed');
        } else {
            showNotification('❌ Ошибка при публикации');
        }
    } catch (error) {
        console.error('Publication error:', error);
        showNotification('❌ Ошибка соединения с сервером');
    }
}

// Остальные функции оставь как были...

async function loadListingsFromAPI() {
    try {
        const response = await fetch(`${API_URL}/listings`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        appData.listings = await response.json();
        
        if (appData.user) {
            appData.myListings = appData.listings.filter(listing => listing.userId === appData.user.id);
        }
        
        renderListings();
    } catch (error) {
        console.error('Load error:', error);
        showNotification('❌ Ошибка загрузки объявлений');
        renderListings();
    }
}

// Вспомогательные функции...
function getRandomCity() {
    const cities = ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань'];
    return cities[Math.floor(Math.random() * cities.length)];
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