const tg = window.Telegram.WebApp;
tg.expand();

// Определяем URL API в зависимости от среды
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
const apiMetaTag = document.querySelector('meta[name="api-base-url"]');
const apiBaseOverride = apiMetaTag?.content?.trim() || window.APP_CONFIG?.apiBaseUrl?.trim();
const apiBase = apiBaseOverride && apiBaseOverride.length > 0
  ? apiBaseOverride
  : (isLocalhost ? 'http://localhost:3000' : window.location.origin);
const API_URL = `${apiBase.replace(/\/$/, '')}/api/listings`;
const USERS_API_URL = `${apiBase.replace(/\/$/, '')}/api/users`;

console.log('API URL:', API_URL);

// Глобальные переменные
let currentUser = null;
let currentProfile = null;
let allListings = [];
let lastCreatedListingId = null;
let selectedPhotoFiles = [];
let currentListingImages = [];
let currentListingImageIndex = 0;

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
    
    // Инициализируем профиль пользователя на сервере
    initUserProfile()
        .then(() => {
            updateProfile();
            loadListings();
        })
        .catch(error => {
            console.error('Ошибка инициализации профиля:', error);
            updateProfile();
            loadListings();
        });
    
    // Настраиваем кнопки
    setupButtons();
    setupPhotoUpload();
    
    // Показываем приложение с анимацией
    setTimeout(() => {
        document.body.style.opacity = '1';
        document.body.style.transition = 'opacity 0.5s ease';
    }, 100);
}

async function initUserProfile() {
    if (!currentUser) return;

    const payload = {
        action: 'init',
        telegramId: currentUser.id,
        username: currentUser.username,
        name: currentUser.name
    };

    const response = await fetch(USERS_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Users API error: ${response.status}`);
    }

    currentProfile = await response.json();
}

function updateProfile() {
    if (!currentUser) return;

    const userNameElement = document.getElementById('user-name');
    const userUsernameElement = document.getElementById('user-username');
    const userAboutElement = document.getElementById('user-about');
    const userPublicIdElement = document.getElementById('user-public-id');
    const ratingLargeElement = document.querySelector('.rating-large');

    if (userNameElement) {
        userNameElement.textContent = currentUser.name;
    }
    if (userUsernameElement) {
        userUsernameElement.textContent = currentUser.username ? `@${currentUser.username}` : '';
    }
    if (userAboutElement) {
        const about = currentProfile?.about?.trim();
        userAboutElement.textContent = about && about.length > 0
            ? about
            : 'Добавьте короткое описание о себе — это увидят другие пользователи.';
    }
    if (userPublicIdElement) {
        userPublicIdElement.textContent = currentProfile?.publicId || '—';
    }
    if (ratingLargeElement && currentProfile?.rating) {
        ratingLargeElement.textContent = `⭐ ${currentProfile.rating.toFixed(1)}`;
    }
}

// Чтение файла как data URL (base64)
function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Настройка превью фото
function setupPhotoUpload() {
    const photoInput = document.getElementById('phone-photo');
    const previewList = document.getElementById('photo-preview-list');
    
    if (!photoInput || !previewList) return;
    
    const updatePreview = () => {
        const files = Array.from(photoInput.files || []);

        // Добавляем новые файлы к уже выбранным
        files.forEach(file => {
            const exists = selectedPhotoFiles.some(
                f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
            );
            if (!exists) {
                selectedPhotoFiles.push(file);
            }
        });

        // Очищаем input, чтобы можно было повторно выбирать файлы
        photoInput.value = '';

        // Рендерим превью из общей коллекции
        previewList.innerHTML = '';
        if (selectedPhotoFiles.length === 0) {
            return;
        }
        
        const counter = document.createElement('div');
        counter.className = 'photo-preview-counter';
        counter.textContent = `Выбрано фото: ${selectedPhotoFiles.length}`;
        previewList.appendChild(counter);
        
        const items = document.createElement('div');
        items.className = 'photo-preview-items';
        
        selectedPhotoFiles.forEach(file => {
            const item = document.createElement('div');
            item.className = 'photo-preview-item';
            
            const img = document.createElement('img');
            img.className = 'photo-preview-thumb';
            img.src = URL.createObjectURL(file);
            img.onload = () => URL.revokeObjectURL(img.src);
            
            const name = document.createElement('span');
            name.className = 'photo-preview-name';
            name.textContent = file.name;
            
            item.appendChild(img);
            item.appendChild(name);
            items.appendChild(item);
        });
        
        previewList.appendChild(items);
    };
    
    photoInput.addEventListener('change', updatePreview);
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
        updateProfileStats();
        
    } catch (error) {
        console.error('Ошибка загрузки объявлений:', error);
        showError('Не удалось загрузить объявления с сервера.');
        // В случае ошибки просто оставляем текущий список (может быть пустым)
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

    // Читаем фото в base64 (если выбраны)
    let imagesData = [];
    if (selectedPhotoFiles.length > 0) {
        try {
            imagesData = await Promise.all(
                selectedPhotoFiles.map(file => readFileAsDataUrl(file))
            );
        } catch (fileError) {
            console.error('Ошибка чтения файла(ов) фото:', fileError);
            showError('Не удалось прочитать файл(ы) фото. Попробуйте другое изображение.');
            return;
        }
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
        userId: currentUser?.id,
        image: imagesData[0] || null,
        images: imagesData
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
            selectedPhotoFiles = [];
            const previewList = document.getElementById('photo-preview-list');
            if (previewList) previewList.innerHTML = '';
            
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
                    ${
                        item.image
                            ? `<img src="${item.image}" alt="Фото ${item.phoneModel}" class="listing-photo">`
                            : `📱<br>${item.phoneModel}`
                    }
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

function updateProfileStats() {
    if (!currentUser) return;

    const myListings = allListings.filter(
        item => item.userId === currentUser.id && !item.isDeleted && !item.isHidden
    );

    const activeEl = document.getElementById('active-listings');
    if (activeEl) {
        activeEl.textContent = myListings.length.toString();
    }
}

// Раньше тут были демо‑данные. Теперь показываем только реальные объявления от пользователей.

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
    const modal = document.getElementById('edit-profile-modal');
    const textarea = document.getElementById('profile-about-input');
    if (!modal || !textarea) return;

    textarea.value = currentProfile?.about || '';
    modal.style.display = 'block';
}

function showMyListings() {
    if (!currentUser) {
        showError('Пользователь не найден.');
        return;
    }

    const modal = document.getElementById('my-listings-modal');
    const content = document.getElementById('my-listings-content');
    if (!modal || !content) return;

    const myListings = allListings.filter(
        item => item.userId === currentUser.id && !item.isDeleted
    );

    if (myListings.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <h3>Пока нет объявлений</h3>
                <p>Создайте своё первое объявление во вкладке «Добавить».</p>
            </div>
        `;
    } else {
        content.innerHTML = myListings.map(item => `
            <div class="listing-card my-listing-card">
                <div class="listing-content">
                    <div class="listing-image ${getPhoneBrand(item.phoneModel)}">
                        ${
                            item.image
                                ? `<img src="${item.image}" alt="Фото ${item.phoneModel}" class="listing-photo">`
                                : `📱<br>${item.phoneModel}`
                        }
                    </div>
                    <div class="listing-details">
                        <div class="listing-title">${item.phoneModel}</div>
                        <div class="listing-description">${item.description}</div>
                        <div class="listing-price">→ ${item.desiredPhone}</div>
                        <div class="listing-location">📍 ${item.location}</div>
                        <div class="listing-meta">
                            <div class="user-info">
                                <span class="rating">${item.isHidden ? '👁‍🗨 Скрыто' : '✅ В ленте'}</span>
                            </div>
                            <div class="timestamp">${formatTime(item.timestamp)}</div>
                        </div>
                    </div>
                </div>
                <div class="my-listing-actions">
                    <button class="btn btn-secondary" onclick="toggleListingVisibility('${item.id}', ${!item.isHidden})">
                        ${item.isHidden ? 'Показать в ленте' : 'Скрыть из ленты'}
                    </button>
                    <button class="btn btn-secondary danger" onclick="deleteListing('${item.id}')">
                        Удалить
                    </button>
                </div>
            </div>
        `).join('');
    }

    modal.style.display = 'block';
}

async function saveProfile() {
    if (!currentUser) return;

    const textarea = document.getElementById('profile-about-input');
    const modal = document.getElementById('edit-profile-modal');
    if (!textarea || !modal) return;

    const about = textarea.value.trim();

    try {
        const response = await fetch(USERS_API_URL, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'update_about',
                telegramId: currentUser.id,
                about
            })
        });

        if (!response.ok) {
            throw new Error(`Users API error: ${response.status}`);
        }

        currentProfile = await response.json();
        updateProfile();
        modal.style.display = 'none';
        showSuccess('Профиль обновлён');
    } catch (error) {
        console.error('Ошибка обновления профиля:', error);
        showError('Не удалось сохранить профиль. Попробуйте позже.');
    }
}

async function toggleListingVisibility(id, isHidden) {
    if (!currentUser) return;

    try {
        const response = await fetch(API_URL, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id,
                userId: currentUser.id,
                isHidden
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        const updated = result.listing;
        allListings = allListings.map(item => (item.id === updated.id ? updated : item));
        showMyListings();
        showListings();
        updateProfileStats();
    } catch (error) {
        console.error('Ошибка изменения видимости объявления:', error);
        showError('Не удалось изменить видимость объявления.');
    }
}

async function deleteListing(id) {
    if (!currentUser) return;

    if (!confirm('Удалить это объявление? Его нельзя будет восстановить.')) {
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id,
                userId: currentUser.id
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        allListings = allListings.filter(item => item.id !== id);
        showMyListings();
        showListings();
        updateProfileStats();
    } catch (error) {
        console.error('Ошибка удаления объявления:', error);
        showError('Не удалось удалить объявление.');
    }
}

function showMyReviews() {
    const modal = document.getElementById('my-reviews-modal');
    const content = document.getElementById('my-reviews-content');
    if (!modal || !content) return;

    const reviews = currentProfile?.reviews || [];

    if (reviews.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <h3>Пока нет отзывов</h3>
                <p>Когда другие пользователи оставят вам отзывы, они появятся здесь.</p>
            </div>
        `;
    } else {
        content.innerHTML = reviews.map(r => `
            <div class="review-card">
                <div class="review-header">
                    <span class="review-rating">⭐ ${r.rating}</span>
                    <span class="review-date">${formatTime(r.createdAt)}</span>
                </div>
                <p class="review-text">${r.text || 'Без текста'}</p>
                <div class="review-author">
                    ${r.authorUsername ? '@' + r.authorUsername : 'Пользователь Telegram'}
                </div>
            </div>
        `).join('');
    }

    modal.style.display = 'block';
}

function showListingModal(listingId) {
    const listing = allListings.find(item => item.id === listingId);
    if (!listing) return;
    
    const modalContent = document.getElementById('modal-listing-content');
    if (!modalContent) return;

    // Подготавливаем изображения для слайдера
    const images = Array.isArray(listing.images) && listing.images.length > 0
        ? listing.images
        : (listing.image ? [listing.image] : []);
    currentListingImages = images;
    currentListingImageIndex = 0;
    const hasMultipleImages = images.length > 1;
    
    modalContent.innerHTML = `
        <div class="modal-header">
            <h3>${listing.phoneModel}</h3>
        </div>
        <div class="modal-body">
            <div class="listing-image-large ${getPhoneBrand(listing.phoneModel)}">
                ${
                    images.length
                        ? `<img src="${images[0]}" alt="Фото ${listing.phoneModel}" class="listing-photo-large" id="listing-photo-main">`
                        : `📱<br>${listing.phoneModel}`
                }
                ${
                    hasMultipleImages
                        ? `
                            <button class="slider-btn slider-btn-prev" onclick="prevListingPhoto()">‹</button>
                            <button class="slider-btn slider-btn-next" onclick="nextListingPhoto()">›</button>
                            <div class="slider-counter" id="listing-photo-counter">1 / ${images.length}</div>
                          `
                        : ''
                }
            </div>
            <div class="listing-details-group">
                <div class="listing-details-card">
                    <h4>Описание</h4>
                    <p class="listing-description-full">${listing.description}</p>
                </div>
                <div class="listing-details-card">
                    <h4>Желаемый обмен</h4>
                    <p class="desired-phone">${listing.desiredPhone}</p>
                </div>
                <div class="listing-details-card">
                    <h4>Состояние</h4>
                    <p><span class="listing-condition-badge">${getConditionText(listing.condition)}</span></p>
                </div>
                <div class="listing-details-card listing-details-meta">
                    <div class="listing-info">
                        <span class="location">📍 ${listing.location}</span>
                        <span class="timestamp">${formatTime(listing.timestamp)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('listing-modal').style.display = 'block';
}

function updateListingPhoto() {
    if (!currentListingImages.length) return;
    const imgEl = document.getElementById('listing-photo-main');
    const counter = document.getElementById('listing-photo-counter');
    if (!imgEl) return;
    imgEl.src = currentListingImages[currentListingImageIndex];
    if (counter) {
        counter.textContent = `${currentListingImageIndex + 1} / ${currentListingImages.length}`;
    }
}

function prevListingPhoto() {
    if (!currentListingImages.length) return;
    currentListingImageIndex =
        (currentListingImageIndex - 1 + currentListingImages.length) % currentListingImages.length;
    updateListingPhoto();
}

function nextListingPhoto() {
    if (!currentListingImages.length) return;
    currentListingImageIndex =
        (currentListingImageIndex + 1) % currentListingImages.length;
    updateListingPhoto();
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