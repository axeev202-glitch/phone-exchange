const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// Конфигурация
const CONFIG = {
  API_URL: 'https://phone-exchange.vercel.app',
  CITIES: ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань']
};

// Состояние приложения
const state = {
  user: null,
  listings: [],
  myListings: []
};

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
  setupEventListeners();
});

async function initializeApp() {
  // Получаем пользователя из Telegram
  const tgUser = tg.initDataUnsafe?.user;
  if (tgUser) {
    state.user = {
      id: tgUser.id,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name || '',
      username: tgUser.username
    };
    updateUserProfile();
  }

  // Загружаем объявления
  await loadListings();
}

function setupEventListeners() {
  // Навигация
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      switchTab(e.target.dataset.tab);
    });
  });

  // Форма создания объявления
  document.getElementById('create-listing-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await createListing();
  });

  // Модальные окна
  document.querySelectorAll('.close').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      closeModals();
    }
  });
}

// API функции
async function apiCall(endpoint, options = {}) {
  try {
    console.log(`API Call: ${CONFIG.API_URL}${endpoint}`, options);
    
    const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    console.log(`API Response: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('API Data:', data);
    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

async function loadListings() {
  try {
    showMessage('Загрузка объявлений...', 'info');
    state.listings = await apiCall('/listings');
    
    if (state.user) {
      state.myListings = state.listings.filter(item => item.userId === state.user.id);
    }
    
    renderListings();
  } catch (error) {
    console.error('Failed to load listings:', error);
    showMessage('Ошибка загрузки объявлений', 'error');
    renderListings();
  }
}

async function createListing() {
  if (!state.user) {
    showMessage('Пользователь не найден', 'error');
    return;
  }

  // Получаем значения напрямую из элементов (без FormData)
  const phoneModel = document.getElementById('phone-model').value.trim();
  const condition = document.getElementById('phone-condition').value;
  const desiredPhone = document.getElementById('desired-phone').value.trim();
  const description = document.getElementById('phone-description').value.trim();

  // Валидация
  if (!phoneModel || !condition || !desiredPhone) {
    showMessage('Заполните все обязательные поля', 'error');
    return;
  }

  const conditionTextMap = {
    'new': 'Новый',
    'excellent': 'Отличное', 
    'good': 'Хорошее',
    'satisfactory': 'Удовлетворительное'
  };

  const listingData = {
    userId: state.user.id,
    userName: `${state.user.firstName} ${state.user.lastName}`.trim(),
    userRating: 5.0,
    phoneModel: phoneModel,
    condition: condition,
    conditionText: conditionTextMap[condition],
    description: description || 'Описание не указано',
    desiredPhone: desiredPhone,
    location: getRandomCity()
  };

  console.log('Creating listing:', listingData);

  try {
    showMessage('Публикация объявления...', 'info');
    
    const result = await apiCall('/listings', {
      method: 'POST',
      body: JSON.stringify(listingData)
    });

    console.log('Create result:', result);

    if (result.success) {
      state.listings.unshift(result.listing);
      state.myListings.unshift(result.listing);
      
      // Очищаем форму
      document.getElementById('create-listing-form').reset();
      showMessage('Объявление успешно опубликовано!', 'success');
      switchTab('feed');
    } else {
      showMessage('Ошибка при публикации объявления', 'error');
    }
  } catch (error) {
    console.error('Create listing error:', error);
    showMessage('Ошибка при публикации объявления', 'error');
  }
}

async function deleteListing(listingId) {
  if (!confirm('Удалить это объявление?')) return;

  try {
    const result = await apiCall(`/listings?id=${listingId}`, {
      method: 'DELETE'
    });

    if (result.success) {
      state.listings = state.listings.filter(item => item.id !== listingId);
      state.myListings = state.myListings.filter(item => item.id !== listingId);
      
      closeModals();
      renderListings();
      updateUserProfile();
      showMessage('Объявление удалено', 'success');
    }
  } catch (error) {
    showMessage('Ошибка при удалении', 'error');
  }
}

// Функции отображения
function renderListings() {
  const container = document.querySelector('.listings-container');
  
  if (!state.listings || state.listings.length === 0) {
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

  container.innerHTML = state.listings.map(listing => `
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
      ${listing.userId === state.user?.id ? '<div class="my-listing-badge">Ваше объявление</div>' : ''}
    </div>
  `).join('');
}

function updateUserProfile() {
  if (state.user) {
    const nameElement = document.getElementById('user-name');
    const usernameElement = document.getElementById('user-username');
    const listingsCountElement = document.getElementById('active-listings');
    const exchangesCountElement = document.getElementById('completed-exchanges');
    
    if (nameElement) nameElement.textContent = `${state.user.firstName} ${state.user.lastName}`.trim();
    if (usernameElement) usernameElement.textContent = state.user.username ? `@${state.user.username}` : '';
    if (listingsCountElement) listingsCountElement.textContent = state.myListings.length;
    if (exchangesCountElement) exchangesCountElement.textContent = '0';
  }
}

// Вспомогательные функции
function getRandomCity() {
  return CONFIG.CITIES[Math.floor(Math.random() * CONFIG.CITIES.length)];
}

function getPhoneBrand(model) {
  const lower = model.toLowerCase();
  if (lower.includes('iphone')) return 'iphone';
  if (lower.includes('samsung')) return 'samsung';
  if (lower.includes('xiaomi') || lower.includes('redmi')) return 'xiaomi';
  return 'default';
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
  const diffHours = Math.floor((now - time) / (1000 * 60 * 60));
  
  if (diffHours < 1) return 'только что';
  if (diffHours < 24) return `${diffHours} ч назад`;
  return `${Math.floor(diffHours / 24)} д назад`;
}

function switchTab(tabName) {
  // Обновляем навигацию
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(tabName).classList.add('active');

  // Обновляем контент
  if (tabName === 'feed') renderListings();
  if (tabName === 'profile') updateUserProfile();
}

function showMessage(message, type = 'info') {
  const color = type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#0088cc';
  
  const messageEl = document.createElement('div');
  messageEl.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    background: ${color}; color: white; padding: 12px 24px; border-radius: 8px;
    z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.2); font-weight: 500;
  `;
  messageEl.textContent = message;
  
  document.body.appendChild(messageEl);
  setTimeout(() => messageEl.remove(), 4000);
}

function closeModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.style.display = 'none';
  });
}

// Глобальные функции для HTML
window.openListingModal = function(listingId) {
  const listing = state.listings.find(item => item.id === listingId);
  if (!listing) return;

  const isMyListing = listing.userId === state.user?.id;
  
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
        <div><strong>📍 ${listing.location}</strong></div>
        <div>👤 ${listing.userName} ⭐ ${listing.userRating}</div>
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
};

window.editListing = function(listingId) {
  const listing = state.listings.find(item => item.id === listingId);
  if (listing) {
    document.getElementById('phone-model').value = listing.phoneModel;
    document.getElementById('phone-condition').value = listing.condition;
    document.getElementById('phone-description').value = listing.description;
    document.getElementById('desired-phone').value = listing.desiredPhone;
    
    closeModals();
    switchTab('create');
    showMessage('Редактируйте ваше объявление', 'info');
  }
};

window.startExchange = function() {
  const listingId = document.getElementById('listing-modal').dataset.listingId;
  document.getElementById('listing-modal').style.display = 'none';
  document.getElementById('exchange-modal').style.display = 'block';
  document.getElementById('exchange-modal').dataset.listingId = listingId;
};

window.contactSeller = function() {
  showMessage('Функция связи с продавцом будет доступна скоро', 'info');
  closeModals();
};

window.confirmExchange = function() {
  showMessage('Обмен оформлен! С вами свяжется гарант.', 'success');
  closeModals();
};

window.editProfile = function() {
  showMessage('Редактирование профиля будет доступно в следующем обновлении', 'info');
};

window.showMyListings = function() {
  // Показываем только мои объявления
  const myListings = state.listings.filter(item => item.userId === state.user?.id);
  
  const container = document.querySelector('.listings-container');
  if (myListings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>📱 У вас нет объявлений</h3>
        <p>Создайте первое объявление!</p>
        <button class="btn btn-primary" onclick="switchTab('create')" 
          style="margin-top: 15px; width: auto; display: inline-block; padding: 10px 20px;">
          ➕ Создать объявление
        </button>
      </div>
    `;
  } else {
    container.innerHTML = myListings.map(listing => `
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
        <div class="my-listing-badge">Ваше объявление</div>
      </div>
    `).join('');
  }
  
  switchTab('feed');
};