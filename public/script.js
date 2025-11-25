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
let myListings = [];
let activeExchanges = [];
let lastCreatedListingId = null;
let currentTab = 'feed';
let selectedCity = '';
let uploadedPhotos = [];
let currentListingId = null;
let listingToDelete = null;
let currentMessageListing = null;

// Список городов
const cities = [
    'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
    'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
    'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград',
    'Краснодар', 'Саратов', 'Тюмень', 'Тольятти', 'Ижевск',
    'Барнаул', 'Ульяновск', 'Иркутск', 'Хабаровск', 'Ярославль',
    'Владивосток', 'Махачкала', 'Томск', 'Оренбург', 'Кемерово'
];

// Демо данные для активных сделок
const demoExchanges = [
    {
        id: '1',
        status: 'active',
        myPhone: 'iPhone 14 Pro',
        theirPhone: 'Samsung S23',
        theirUser: '@samsung_lover',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: '2',
        status: 'pending',
        myPhone: 'Xiaomi Redmi Note 10',
        theirPhone: 'Google Pixel 6',
        theirUser: '@pixel_fan',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    }
];

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
    
    // Инициализируем выбор города
    initCitySelector();
    
    // Инициализируем загрузку фото
    initPhotoUpload();
    
    // Инициализируем поиск
    initSearch();
    
    // Загружаем объявления
    loadListings();
    
    // Загружаем активные сделки
    loadActiveExchanges();
    
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

function initCitySelector() {
    const citySearch = document.getElementById('city-search');
    const citiesList = document.getElementById('cities-list');
    
    if (!citySearch || !citiesList) return;
    
    // Заполняем список городов
    citiesList.innerHTML = cities.map(city => 
        `<div class="city-item" data-city="${city}">${city}</div>`
    ).join('');
    
    // Обработчик ввода в поиск
    citySearch.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filteredCities = cities.filter(city => 
            city.toLowerCase().includes(searchTerm)
        );
        
        citiesList.innerHTML = filteredCities.map(city => 
            `<div class="city-item" data-city="${city}">${city}</div>`
        ).join('');
        
        // Показываем/скрываем список
        if (searchTerm.length > 0 && filteredCities.length > 0) {
            citiesList.classList.add('active');
        } else {
            citiesList.classList.remove('active');
        }
    });
    
    // Обработчик выбора города
    citiesList.addEventListener('click', function(e) {
        if (e.target.classList.contains('city-item')) {
            const city = e.target.dataset.city;
            selectedCity = city;
            citySearch.value = city;
            citiesList.classList.remove('active');
            
            // Добавляем визуальное подтверждение выбора
            e.target.classList.add('selected');
            setTimeout(() => {
                e.target.classList.remove('selected');
            }, 1000);
        }
    });
    
    // Скрываем список при клике вне
    document.addEventListener('click', function(e) {
        if (!citySearch.contains(e.target) && !citiesList.contains(e.target)) {
            citiesList.classList.remove('active');
        }
    });
    
    // Исправление: делаем список городов поверх других элементов
    citiesList.style.zIndex = '1000';
    citiesList.style.position = 'absolute';
}

function initPhotoUpload() {
    const uploadArea = document.getElementById('photo-upload-area');
    const fileInput = document.getElementById('photo-upload');
    const photoPreview = document.getElementById('photo-preview');
    
    if (!uploadArea || !fileInput) return;
    
    // Клик по области загрузки
    uploadArea.addEventListener('click', function() {
        fileInput.click();
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', function() {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        handleFiles(files);
    });
    
    // Выбор файлов через input
    fileInput.addEventListener('change', function(e) {
        handleFiles(e.target.files);
    });
    
    function handleFiles(files) {
        const validFiles = Array.from(files).filter(file => 
            file.type.startsWith('image/') && 
            uploadedPhotos.length + Array.from(files).length <= 5
        );
        
        if (validFiles.length === 0) {
            showError('Пожалуйста, выберите только изображения (максимум 5)');
            return;
        }
        
        validFiles.forEach(file => {
            if (uploadedPhotos.length >= 5) {
                showError('Максимум 5 фотографий');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                const photoData = {
                    id: Date.now() + Math.random(),
                    data: e.target.result,
                    file: file
                };
                uploadedPhotos.push(photoData);
                updatePhotoPreview();
            };
            reader.readAsDataURL(file);
        });
        
        // Сбрасываем input
        fileInput.value = '';
    }
    
    function updatePhotoPreview() {
        if (!photoPreview) return;
        
        photoPreview.innerHTML = uploadedPhotos.map(photo => `
            <div class="photo-preview-item">
                <img src="${photo.data}" alt="Preview">
                <button class="remove-photo" onclick="removePhoto('${photo.id}')">×</button>
            </div>
        `).join('');
        
        // Обновляем текст в области загрузки
        const uploadPlaceholder = uploadArea.querySelector('.upload-placeholder');
        if (uploadPlaceholder) {
            if (uploadedPhotos.length > 0) {
                uploadPlaceholder.innerHTML = `
                    <span class="upload-icon">📷</span>
                    <p>Добавить еще фото</p>
                    <small>Осталось ${5 - uploadedPhotos.length} из 5</small>
                `;
            } else {
                uploadPlaceholder.innerHTML = `
                    <span class="upload-icon">📷</span>
                    <p>Добавьте фото телефона</p>
                    <small>Максимум 5 фото</small>
                `;
            }
        }
    }
}

function removePhoto(photoId) {
    uploadedPhotos = uploadedPhotos.filter(photo => photo.id !== photoId);
    updatePhotoPreview();
}

function initSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    
    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = this.value.toLowerCase().trim();
            filterListings(searchTerm);
        }, 300);
    });
}

function filterListings(searchTerm) {
    const container = document.getElementById('feed-listings');
    if (!container) return;
    
    let filteredListings = allListings;
    
    if (searchTerm) {
        filteredListings = allListings.filter(listing => 
            listing.phoneModel.toLowerCase().includes(searchTerm) ||
            listing.desiredPhone.toLowerCase().includes(searchTerm) ||
            listing.description.toLowerCase().includes(searchTerm) ||
            listing.location.toLowerCase().includes(searchTerm)
        );
    }
    
    showListings(filteredListings, container);
    
    // Показываем информацию о результатах поиска
    const searchInfo = document.querySelector('.search-results-info');
    if (searchTerm && filteredListings.length === 0) {
        if (!searchInfo) {
            const infoElement = document.createElement('div');
            infoElement.className = 'search-results-info';
            infoElement.textContent = `По запросу "${searchTerm}" ничего не найдено`;
            container.parentNode.insertBefore(infoElement, container);
        } else {
            searchInfo.textContent = `По запросу "${searchTerm}" ничего не найдено`;
        }
    } else if (searchInfo) {
        searchInfo.remove();
    }
}

function setupButtons() {
    // Навигация
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            if (tab !== currentTab) {
                showTab(tab);
            }
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
        updateMyListings();
        showListings();
        
    } catch (error) {
        console.error('Ошибка загрузки объявлений:', error);
        showError('Не удалось загрузить объявления. Показываем демо данные.');
        showDemoListings();
    }
}

// Загрузка активных сделок
function loadActiveExchanges() {
    // В реальном приложении здесь был бы запрос к API
    activeExchanges = demoExchanges;
    showActiveExchanges();
}

// Обновление моих объявлений
function updateMyListings() {
    if (!currentUser) return;
    
    myListings = allListings.filter(listing => listing.userId === currentUser.id);
    
    // Обновляем счетчик
    const countElement = document.getElementById('active-listings');
    if (countElement) {
        countElement.textContent = myListings.length;
    }
    
    const completedElement = document.getElementById('completed-exchanges');
    if (completedElement) {
        completedElement.textContent = activeExchanges.filter(e => e.status === 'completed').length;
    }
    
    // Показываем мои объявления если секция видима
    showMyListings();
}

// Создание объявления
async function createListing() {
    console.log('Starting to create listing...');
    
    const phoneModel = document.getElementById('phone-model')?.value.trim();
    const condition = document.getElementById('phone-condition')?.value;
    const description = document.getElementById('phone-description')?.value.trim();
    const desiredPhone = document.getElementById('desired-phone')?.value.trim();
    const city = selectedCity || document.getElementById('city-search')?.value.trim();
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    console.log('Form data:', { phoneModel, condition, description, desiredPhone, city });
    
    // Валидация
    if (!phoneModel || !condition || !desiredPhone || !city) {
        showError('Заполните все обязательные поля!');
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
        location: city,
        userId: currentUser?.id,
        userInfo: {
            name: currentUser?.name,
            username: currentUser?.username
        },
        photos: uploadedPhotos.map(photo => photo.data) // В реальном приложении нужно загружать на сервер
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
            selectedCity = '';
            uploadedPhotos = [];
            updatePhotoPreview();
            
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
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Убираем анимацию успеха
    successAnimation.remove();
    
    // Запускаем анимацию перехода
    animateToFeed();
}

// Улучшенная анимация перехода к ленте
function animateToFeed() {
    const createTab = document.getElementById('create');
    const feedTab = document.getElementById('feed');
    const feedBtn = document.querySelector('[data-tab="feed"]');
    
    // Создаем оверлей для перехода
    const transitionOverlay = document.createElement('div');
    transitionOverlay.className = 'transition-overlay';
    document.body.appendChild(transitionOverlay);
    
    // Создаем анимацию телефона
    const phoneAnimation = document.createElement('div');
    phoneAnimation.className = 'phone-animation';
    phoneAnimation.innerHTML = '<div class="phone-icon">📱</div>';
    document.body.appendChild(phoneAnimation);
    
    // Создаем частицы
    createParticles();
    
    // Получаем позицию кнопки ленты для анимации
    const feedBtnRect = feedBtn.getBoundingClientRect();
    const targetX = feedBtnRect.left + feedBtnRect.width / 2;
    const targetY = feedBtnRect.top + feedBtnRect.height / 2;
    
    // Устанавливаем целевые координаты для анимации
    phoneAnimation.style.setProperty('--target-x', `${targetX}px`);
    phoneAnimation.style.setProperty('--target-y', `${targetY}px`);
    
    // Ждем завершения анимации
    setTimeout(() => {
        // Убираем элементы анимации
        transitionOverlay.remove();
        phoneAnimation.remove();
        
        // Переключаем вкладки
        switchTab('feed');
        
        // Загружаем обновленные объявления
        loadListings().then(() => {
            // После загрузки подсвечиваем новое объявление
            setTimeout(() => {
                highlightNewListing();
            }, 300);
        });
    }, 1500);
}

// Создание частиц для анимации
function createParticles() {
    const particleCount = 12;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Случайный угол и расстояние
        const angle = (i / particleCount) * Math.PI * 2;
        const distance = 100 + Math.random() * 50;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        
        // Случайная задержка
        particle.style.animationDelay = (Math.random() * 0.3) + 's';
        
        document.body.appendChild(particle);
        
        // Удаляем частицу после анимации
        setTimeout(() => {
            particle.remove();
        }, 1000);
    }
}

// Подсветка нового объявления
function highlightNewListing() {
    if (lastCreatedListingId) {
        const newListingElement = document.querySelector(`[data-listing-id="${lastCreatedListingId}"]`);
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

// Переключение вкладок с анимацией
function showTab(tabName) {
    if (tabName === currentTab) return;
    
    const oldTab = currentTab;
    currentTab = tabName;
    
    // Анимация перехода между вкладками
    animateTabTransition(oldTab, tabName);
}

function animateTabTransition(fromTab, toTab) {
    const fromElement = document.getElementById(fromTab);
    const toElement = document.getElementById(toTab);
    const fromBtn = document.querySelector(`[data-tab="${fromTab}"]`);
    const toBtn = document.querySelector(`[data-tab="${toTab}"]`);
    
    if (!fromElement || !toElement) return;
    
    // Добавляем классы анимации
    fromElement.classList.add('leaving');
    toElement.classList.add('entering');
    
    // Убираем активность у кнопок
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Ждем завершения анимации выхода
    setTimeout(() => {
        fromElement.classList.remove('active', 'leaving');
        toElement.classList.add('active');
        toBtn.classList.add('active');
        
        // Убираем класс входа после завершения анимации
        setTimeout(() => {
            toElement.classList.remove('entering');
        }, 500);
        
        // Обновляем контент при переходе
        if (toTab === 'feed') {
            setTimeout(() => loadListings(), 100);
        } else if (toTab === 'exchanges') {
            setTimeout(() => showActiveExchanges(), 100);
        }
    }, 400);
}

// Простая функция переключения вкладок (без анимации)
function switchTab(tabName) {
    // Скрываем все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Убираем активность у всех кнопок
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показываем нужную вкладку
    const targetTab = document.getElementById(tabName);
    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
    
    if (targetTab) targetTab.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');
    
    currentTab = tabName;
}

// Показ объявлений в ленте
function showListings(listings = allListings, container = document.getElementById('feed-listings')) {
    if (!container) return;
    
    if (listings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>📱 Пока нет объявлений</h3>
                <p>Создайте первое объявление!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = listings.map((item, index) => `
        <div class="listing-card" data-listing-id="${item.id}" onclick="showListingModal('${item.id}')" style="animation-delay: ${index * 0.1}s">
            <div class="listing-content">
                <div class="listing-image ${getPhoneBrand(item.phoneModel)}">
                    ${item.photos && item.photos.length > 0 ? 
                        `<img src="${item.photos[0]}" alt="${item.phoneModel}" style="width:100%;height:100%;object-fit:cover;border-radius:18px;">` : 
                        `📱<br>${item.phoneModel}`
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
                            <span class="user-name">${item.userInfo?.name || 'Аноним'}</span>
                        </div>
                        <div class="timestamp">${formatTime(item.timestamp)}</div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Показ моих объявлений в профиле
function showMyListings() {
    const container = document.getElementById('my-listings-container');
    const section = document.getElementById('my-listings-section');
    
    if (!container || !section) return;
    
    if (myListings.length === 0) {
        container.innerHTML = `
            <div class="empty-listings">
                <div class="empty-icon">📱</div>
                <h3>У вас пока нет объявлений</h3>
                <p>Создайте первое объявление!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = myListings.map((item, index) => `
        <div class="listing-card" data-listing-id="${item.id}" style="animation-delay: ${index * 0.1}s">
            <div class="listing-content">
                <div class="listing-image ${getPhoneBrand(item.phoneModel)}">
                    ${item.photos && item.photos.length > 0 ? 
                        `<img src="${item.photos[0]}" alt="${item.phoneModel}" style="width:100%;height:100%;object-fit:cover;border-radius:18px;">` : 
                        `📱<br>${item.phoneModel}`
                    }
                </div>
                <div class="listing-details">
                    <div class="listing-title">${item.phoneModel}</div>
                    <div class="listing-description">${item.description}</div>
                    <div class="listing-price">→ ${item.desiredPhone}</div>
                    <div class="listing-location">📍 ${item.location}</div>
                    <div class="listing-meta">
                        <div class="timestamp">${formatTime(item.timestamp)}</div>
                    </div>
                    <div class="my-listing-actions">
                        <button class="btn btn-secondary" onclick="editListing('${item.id}')">✏️ Редактировать</button>
                        <button class="btn btn-danger" onclick="deleteListing('${item.id}')">🗑️ Удалить</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Показ активных сделок
function showActiveExchanges() {
    const container = document.getElementById('exchanges-list');
    if (!container) return;
    
    if (activeExchanges.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>🔄 Нет активных сделок</h3>
                <p>Начните обмен с другим пользователем!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = activeExchanges.map((exchange, index) => `
        <div class="exchange-item" style="animation-delay: ${index * 0.1}s">
            <div class="exchange-header">
                <div class="exchange-title">Обмен #${exchange.id}</div>
                <div class="exchange-status status-${exchange.status}">
                    ${exchange.status === 'pending' ? 'Ожидание' : 
                      exchange.status === 'active' ? 'Активна' : 'Завершена'}
                </div>
            </div>
            <div class="exchange-parties">
                <div class="exchange-party">
                    <div class="exchange-phone">${exchange.myPhone}</div>
                    <div class="exchange-user">Вы</div>
                </div>
                <div class="exchange-arrow">⇄</div>
                <div class="exchange-party">
                    <div class="exchange-phone">${exchange.theirPhone}</div>
                    <div class="exchange-user">${exchange.theirUser}</div>
                </div>
            </div>
            <div class="exchange-meta">
                <div class="timestamp">Начато: ${formatTime(exchange.timestamp)}</div>
            </div>
            <div class="exchange-actions">
                ${exchange.status === 'pending' ? `
                    <button class="btn btn-primary" onclick="acceptExchange('${exchange.id}')">✅ Принять</button>
                    <button class="btn btn-secondary" onclick="declineExchange('${exchange.id}')">❌ Отклонить</button>
                ` : exchange.status === 'active' ? `
                    <button class="btn btn-primary" onclick="completeExchange('${exchange.id}')">✅ Завершить</button>
                    <button class="btn btn-secondary" onclick="contactUser('${exchange.theirUser}')">💌 Написать</button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Демо данные при ошибке загрузки
function showDemoListings() {
    const container = document.getElementById('feed-listings');
    if (!container) return;
    
    const demoListings = [
        {
            id: 'demo1',
            phoneModel: 'iPhone 14 Pro',
            condition: 'excellent',
            description: 'Отличное состояние, батарея 95%',
            desiredPhone: 'Samsung S23',
            location: 'Москва',
            timestamp: new Date().toISOString(),
            userId: 'demo_user_1',
            userInfo: { name: 'Иван Петров', username: 'ivan_tech' }
        },
        {
            id: 'demo2',
            phoneModel: 'Samsung Galaxy S23',
            condition: 'new',
            description: 'Новый, в коробке, все чеки',
            desiredPhone: 'iPhone 15',
            location: 'Санкт-Петербург',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            userId: 'demo_user_2',
            userInfo: { name: 'Анна Сидорова', username: 'anna_mobile' }
        }
    ];
    
    allListings = demoListings;
    showListings();
}

// Показать мои объявления в профиле
function showMyListings() {
    const section = document.getElementById('my-listings-section');
    if (section) {
        section.style.display = 'block';
        // Перезагружаем список моих объявлений
        updateMyListings();
    }
}

// Скрыть мои объявления в профиле
function hideMyListings() {
    const section = document.getElementById('my-listings-section');
    if (section) {
        section.style.display = 'none';
    }
}

// Переключиться на вкладку моих объявлений (для кнопки в профиле)
function showMyListingsTab() {
    showTab('profile');
    setTimeout(() => {
        showMyListings();
    }, 500);
}

// Показать активные сделки
function showActiveExchanges() {
    showTab('exchanges');
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

function editProfile() {
    showError('Редактирование профиля - скоро!');
}

function editListing(listingId) {
    showError('Редактирование объявления - скоро!');
}

// Удаление объявления
function deleteListing(listingId) {
    listingToDelete = listingId;
    document.getElementById('delete-modal').style.display = 'block';
}

function closeDeleteModal() {
    document.getElementById('delete-modal').style.display = 'none';
    listingToDelete = null;
}

async function confirmDelete() {
    if (!listingToDelete) return;
    
    try {
        // В реальном приложении здесь был бы DELETE запрос к API
        allListings = allListings.filter(listing => listing.id !== listingToDelete);
        
        // Обновляем интерфейс
        updateMyListings();
        showListings();
        
        showSuccess('Объявление успешно удалено!');
        closeDeleteModal();
        
    } catch (error) {
        showError('Ошибка при удалении объявления');
    }
}

// Функции для сделок
function acceptExchange(exchangeId) {
    const exchange = activeExchanges.find(e => e.id === exchangeId);
    if (exchange) {
        exchange.status = 'active';
        showActiveExchanges();
        showSuccess('Сделка принята!');
    }
}

function declineExchange(exchangeId) {
    activeExchanges = activeExchanges.filter(e => e.id !== exchangeId);
    showActiveExchanges();
    showSuccess('Сделка отклонена');
}

function completeExchange(exchangeId) {
    const exchange = activeExchanges.find(e => e.id === exchangeId);
    if (exchange) {
        exchange.status = 'completed';
        showActiveExchanges();
        showSuccess('Сделка завершена!');
        updateMyListings();
    }
}

function contactUser(username) {
    if (tg && tg.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/${username.replace('@', '')}`);
    } else {
        showError(`Напишите пользователю: ${username}`);
    }
}

// Модальное окно объявления
function showListingModal(listingId) {
    const listing = allListings.find(item => item.id === listingId);
    if (!listing) return;
    
    const modalContent = document.getElementById('modal-listing-content');
    if (!modalContent) return;
    
    // Сохраняем ID текущего объявления для сообщений
    currentListingId = listingId;
    currentMessageListing = listing;
    
    const photosHtml = listing.photos && listing.photos.length > 0 ? `
        <div class="listing-gallery">
            <div class="gallery-main">
                <img src="${listing.photos[0]}" alt="${listing.phoneModel}">
            </div>
            ${listing.photos.length > 1 ? `
                <div class="gallery-thumbs">
                    ${listing.photos.map((photo, index) => `
                        <div class="gallery-thumb ${index === 0 ? 'active' : ''}" onclick="changeMainPhoto(this, '${photo}')">
                            <img src="${photo}" alt="${listing.phoneModel}">
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    ` : `
        <div class="listing-image-large ${getPhoneBrand(listing.phoneModel)}">
            📱<br>${listing.phoneModel}
        </div>
    `;
    
    modalContent.innerHTML = `
        <div class="modal-header">
            <h3>${listing.phoneModel}</h3>
            <p class="listing-condition">${getConditionText(listing.condition)}</p>
        </div>
        <div class="modal-body">
            ${photosHtml}
            <div class="listing-details-modal">
                <h4>Описание</h4>
                <p>${listing.description}</p>
                <h4>Желаемый обмен</h4>
                <p class="desired-phone">${listing.desiredPhone}</p>
                <div class="user-info-modal">
                    <h4>Продавец</h4>
                    <p><strong>${listing.userInfo?.name || 'Аноним'}</strong></p>
                    ${listing.userInfo?.username ? `<p>@${listing.userInfo.username}</p>` : ''}
                    <div class="rating">⭐ 5.0</div>
                </div>
                <div class="listing-info">
                    <span class="location">📍 ${listing.location}</span>
                    <span class="timestamp">${formatTime(listing.timestamp)}</span>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('listing-modal').style.display = 'block';
}

function changeMainPhoto(thumbElement, photoUrl) {
    const mainImage = document.querySelector('.gallery-main img');
    if (mainImage) {
        mainImage.src = photoUrl;
    }
    
    // Обновляем активный класс
    document.querySelectorAll('.gallery-thumb').forEach(thumb => {
        thumb.classList.remove('active');
    });
    thumbElement.classList.add('active');
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
    document.getElementById('listing-modal').style.display = 'none';
    document.getElementById('message-modal').style.display = 'block';
}

function closeMessageModal() {
    document.getElementById('message-modal').style.display = 'none';
    currentMessageListing = null;
}

function sendMessage() {
    const messageText = document.getElementById('message-text').value.trim();
    
    if (!messageText) {
        showError('Введите сообщение');
        return;
    }
    
    if (!currentMessageListing) {
        showError('Ошибка: объявление не найдено');
        return;
    }
    
    // В реальном приложении здесь была бы отправка сообщения
    const sellerUsername = currentMessageListing.userInfo?.username;
    
    if (sellerUsername && tg && tg.openTelegramLink) {
        const telegramUrl = `https://t.me/${sellerUsername.replace('@', '')}`;
        tg.openTelegramLink(telegramUrl);
    } else {
        showSuccess(`Сообщение отправлено продавцу: "${messageText}"`);
    }
    
    // Очищаем форму и закрываем модальное окно
    document.getElementById('message-text').value = '';
    closeMessageModal();
}

function confirmExchange() {
    showSuccess('Обмен успешно начат! Ожидайте подтверждения.');
    document.getElementById('exchange-modal').style.display = 'none';
    
    // Добавляем демо сделку
    if (currentMessageListing) {
        const newExchange = {
            id: Date.now().toString(),
            status: 'pending',
            myPhone: currentMessageListing.desiredPhone,
            theirPhone: currentMessageListing.phoneModel,
            theirUser: currentMessageListing.userInfo?.username || 'unknown',
            timestamp: new Date().toISOString()
        };
        activeExchanges.unshift(newExchange);
        showActiveExchanges();
    }
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