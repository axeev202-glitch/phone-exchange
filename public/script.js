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
// Username бота для открытия мини‑аппа по ссылке профиля
const BOT_USERNAME = 'ObmenTech_bot';

console.log('API URL:', API_URL);

// Глобальные переменные
let currentUser = null;
let currentProfile = null;
let allListings = [];
let filteredListings = [];
let searchQuery = '';
let activeFilters = {
    priceSegment: [],
    storage: [],
    ram: []
};
let lastCreatedListingId = null;
let selectedPhotoFiles = [];
let currentListingImages = [];
let currentListingImageIndex = 0;
let currentExchangeTargetId = null;
let currentAvatarData = null;

// Избранные объявления
let likedListings = JSON.parse(localStorage.getItem('likedListings') || '[]');

// Текущая тема (объявлена глобально для использования в initIcons)
let currentTheme = localStorage.getItem('theme') || 'ocean';

// Функция переключения избранного
function toggleLike(listingId) {
    const index = likedListings.indexOf(listingId);
    if (index > -1) {
        likedListings.splice(index, 1);
    } else {
        likedListings.push(listingId);
    }
    localStorage.setItem('likedListings', JSON.stringify(likedListings));
    // Обновляем отображение
    if (document.querySelector('.listings-container')) {
        showListings();
    }
}

// Функция проверки, в избранном ли объявление
function isLiked(listingId) {
    return likedListings.includes(listingId);
}

// Инициализация иконок
function initIcons() {
    // Логотип в шапке
    const logoIcon = document.getElementById('header-logo-icon');
    if (logoIcon) {
        const gradientId = `logo-gradient-${currentTheme}`;
        const colors = getThemeLogoColors(currentTheme);
        logoIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 2H17C18.1046 2 19 2.89543 19 4V20C19 21.1046 18.1046 22 17 22H7C5.89543 22 5 21.1046 5 20V4C5 2.89543 5.89543 2 7 2Z" stroke="url(#${gradientId})" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 18H12.01" stroke="url(#${gradientId})" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <defs>
                    <linearGradient id="${gradientId}" x1="5" y1="2" x2="19" y2="22" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stop-color="${colors.start}"/>
                        <stop offset="50%" stop-color="${colors.mid}"/>
                        <stop offset="100%" stop-color="${colors.end}"/>
                    </linearGradient>
                </defs>
            </svg>
        `;
    }
    
    // Иконки в шапке
    if (typeof Icons !== 'undefined') {
        const insertIcon = (el, iconName, color, size) => {
            if (el && Icons[iconName]) {
                el.innerHTML = Icons[iconName](color, size);
            }
        };
        
        insertIcon(document.getElementById('theme-btn-icon'), 'Palette', 'white', 20);
        insertIcon(document.getElementById('bell-btn-icon'), 'Bell', 'currentColor', 20);
        insertIcon(document.getElementById('settings-btn-icon'), 'Settings', 'currentColor', 20);
        insertIcon(document.getElementById('search-icon'), 'Search', 'rgba(165, 243, 252, 0.5)', 20);
        insertIcon(document.getElementById('search-icon-2'), 'Search', 'rgba(165, 243, 252, 0.5)', 20);
        insertIcon(document.getElementById('filter-btn-icon'), 'SlidersHorizontal', 'white', 20);
        insertIcon(document.getElementById('filter-btn-icon-2'), 'SlidersHorizontal', 'white', 20);
        insertIcon(document.getElementById('nav-home-icon'), 'Home', 'currentColor', 24);
        insertIcon(document.getElementById('nav-search-icon'), 'Search', 'currentColor', 24);
        insertIcon(document.getElementById('nav-plus-icon'), 'Plus', '#ffffff', 28);
        insertIcon(document.getElementById('nav-heart-icon'), 'Heart', 'currentColor', 24);
        insertIcon(document.getElementById('nav-user-icon'), 'User', 'currentColor', 24);
        insertIcon(document.getElementById('view-all-icon'), 'TrendingUp', 'currentColor', 16);
    }
}

// Функция получения цветов логотипа для темы
function getThemeLogoColors(theme) {
    const themes = {
        white: { start: '#1F2937', mid: '#4B5563', end: '#6B7280' },
        black: { start: '#FFFFFF', mid: '#E5E7EB', end: '#9CA3AF' },
        ocean: { start: '#22D3EE', mid: '#3B82F6', end: '#2563EB' },
        sunset: { start: '#F97316', mid: '#EC4899', end: '#F43F5E' },
        forest: { start: '#34D399', mid: '#14B8A6', end: '#16A34A' },
        neon: { start: '#A855F7', mid: '#EC4899', end: '#06B6D4' },
        royal: { start: '#9333EA', mid: '#4F46E5', end: '#7C3AED' }
    };
    return themes[theme] || themes.ocean;
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    
    // Сразу закрываем все модальные окна при загрузке
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    
    // Активируем главную вкладку
    const feedTab = document.getElementById('feed');
    const feedBtn = document.querySelector('[data-tab="feed"]');
    if (feedTab) {
        feedTab.classList.add('active');
    }
    if (feedBtn) {
        feedBtn.classList.add('active');
    }
    // Скрываем остальные вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        if (tab.id !== 'feed') {
            tab.classList.remove('active');
        }
    });
    
    // Инициализация иконок
    initIcons();
    
    // Открытие профиля по ссылке ?profile=ID (веб-версия)
    const params = new URLSearchParams(window.location.search);
    const profileFromLink = params.get('profile');
    
    // Открытие профиля через startapp (Telegram Mini App)
    const startParam = tg.initDataUnsafe?.start_param;
    console.log('Start param from Telegram:', startParam);
    console.log('Profile from URL:', profileFromLink);
    
    // Применяем сохраненную тему
    if (currentTheme) {
        applyTheme(currentTheme);
    }
    
    initApp().then(() => {
        // Обновляем иконку плюса после инициализации
        const plusIcon = document.getElementById('nav-plus-icon');
        if (plusIcon && typeof Icons !== 'undefined') {
            plusIcon.innerHTML = Icons.Plus('#ffffff', 28);
        }
        
        // После инициализации проверяем параметры
        if (profileFromLink) {
            console.log('Opening profile from URL param:', profileFromLink);
            setTimeout(() => openUserProfileByPublicId(profileFromLink), 500);
            return;
        }

        if (startParam && startParam.startsWith('profile_')) {
            const publicId = startParam.replace('profile_', '');
            console.log('Opening profile from startapp:', publicId);
            setTimeout(() => {
                openUserProfileByPublicId(publicId);
            }, 800);
        }
    });
});

async function initApp() {
    console.log('Initializing app...');
    
    // Закрываем все модальные окна
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    
    // Активируем главную вкладку
    showTab('feed');
    
    // Получаем пользователя из Telegram
    const tgUser = tg.initDataUnsafe?.user;
    if (tgUser) {
        currentUser = {
            id: tgUser.id.toString(),
            firstName: tgUser.first_name,
            lastName: tgUser.last_name || '',
            username: tgUser.username,
            name: `${tgUser.first_name} ${tgUser.last_name || ''}`.trim(),
            photoUrl: tgUser.photo_url || null
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
    
    // Инициализируем профиль пользователя на сервере (авторегистрация при первом входе)
    try {
        await initUserProfile();
        updateProfile();
        await loadListings();
        // Обновляем время последнего визита после загрузки
        updateLastSeen();
    } catch (error) {
        console.error('Ошибка инициализации профиля:', error);
        updateProfile();
        await loadListings();
    }
    
    // Настраиваем кнопки
    setupButtons();
    setupPhotoUpload();
    
    // Инициализируем иконки после загрузки DOM
    if (typeof initIcons === 'function') {
        initIcons();
    }
    
    // Показываем приложение с анимацией
    setTimeout(() => {
        document.body.style.opacity = '1';
        document.body.style.transition = 'opacity 0.5s ease';
    }, 100);
}

async function initUserProfile() {
    if (!currentUser) {
        console.warn('Cannot init profile: currentUser is not set');
        return;
    }

    console.log('🔄 Начало авторегистрации для пользователя:', currentUser.id);
    console.log('📋 Данные пользователя:', {
        id: currentUser.id,
        username: currentUser.username,
        name: currentUser.name,
        photoUrl: currentUser.photoUrl
    });

    const payload = {
        action: 'init',
        telegramId: currentUser.id,
        username: currentUser.username,
        name: currentUser.name,
        avatar: currentUser.photoUrl || null
    };

    try {
        console.log('📤 Отправка запроса на сервер:', payload);
        const response = await fetch(USERS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Ошибка регистрации:', response.status, errorText);
            throw new Error(`Users API error: ${response.status}`);
        }

        currentProfile = await response.json();
        console.log('✅ Профиль успешно инициализирован:', {
            telegramId: currentProfile.telegramId,
            publicId: currentProfile.publicId,
            name: currentProfile.name,
            username: currentProfile.username,
            avatar: currentProfile.avatar,
            createdAt: currentProfile.createdAt,
            lastSeenAt: currentProfile.lastSeenAt
        });
        
        // Обновляем currentUser с данными из профиля
        if (currentProfile.username && !currentUser.username) {
            currentUser.username = currentProfile.username;
        }
        if (currentProfile.avatar && !currentUser.photoUrl) {
            currentUser.photoUrl = currentProfile.avatar;
        }
        
        // Показываем уведомление о регистрации (только при первом входе)
        if (currentProfile.createdAt && 
            new Date(currentProfile.createdAt).getTime() > Date.now() - 5000) {
            console.log('New user registered with ID:', currentProfile.publicId);
        }
    } catch (error) {
        console.error('Failed to initialize profile:', error);
        throw error;
    }
}

// Обновление времени последнего визита пользователя
async function updateLastSeen() {
    if (!currentUser || !currentUser.id) return;
    
    try {
        await fetch(USERS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'init',
                telegramId: currentUser.id,
                username: currentUser.username,
                name: currentUser.name,
                avatar: currentUser.photoUrl || null
            })
        });
    } catch (error) {
        console.error('Ошибка обновления lastSeenAt:', error);
    }
}

function updateProfile() {
    if (!currentUser) return;

    // Обновляем элементы во вкладке профиля
    const profileNameElement = document.getElementById('profile-name');
    const profileUsernameElement = document.getElementById('profile-username');
    const profileAboutElement = document.getElementById('profile-about');
    const profilePublicIdElement = document.getElementById('profile-public-id');
    const profileAvatarElement = document.getElementById('profile-avatar');
    
    if (profileNameElement) {
        profileNameElement.textContent = currentProfile?.name || currentUser.name || 'Пользователь Telegram';
    }
    
    if (profileUsernameElement) {
        const username = currentProfile?.username || currentUser.username;
        profileUsernameElement.textContent = username ? `@${username}` : '';
        profileUsernameElement.style.display = username ? 'block' : 'none';
    }
    
    if (profileAboutElement) {
        const about = currentProfile?.about?.trim();
        profileAboutElement.textContent = about && about.length > 0
            ? about
            : 'Добавьте короткое описание о себе — это увидят другие пользователи.';
    }
    
    if (profilePublicIdElement) {
        profilePublicIdElement.textContent = currentProfile?.publicId || '—';
    }
    
    if (profileAvatarElement) {
        const avatarSrc = currentProfile?.avatar || currentUser.photoUrl || null;
        setAvatar(profileAvatarElement, avatarSrc);
    }
    
    // Обновляем старые элементы (для совместимости)
    const userNameElement = document.getElementById('user-name');
    const userUsernameElement = document.getElementById('user-username');
    const userAboutElement = document.getElementById('user-about');
    const userPublicIdElement = document.getElementById('user-public-id');
    const ratingLargeElement = document.querySelector('.rating-large');
    const avatarElement = document.querySelector('.profile-card .avatar');
        
    if (userNameElement) {
        userNameElement.textContent = currentProfile?.name || currentUser.name || 'Пользователь Telegram';
    }
    if (userUsernameElement) {
        const username = currentProfile?.username || currentUser.username;
        userUsernameElement.textContent = username ? `@${username}` : '';
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
    if (ratingLargeElement) {
        const ratingValue =
            typeof currentProfile?.rating === 'number' ? currentProfile.rating : 0;
        ratingLargeElement.textContent = `⭐ ${ratingValue.toFixed(1)}`;
    }
    if (avatarElement) {
        const avatarSrc = currentProfile?.avatar || currentUser.photoUrl || null;
        setAvatar(avatarElement, avatarSrc);
    }
}

// Сжатие изображения (с увеличенными параметрами для поддержки до 100MB)
function compressImage(file, maxWidth = 2000, maxHeight = 2000, quality = 0.9) {
    return new Promise((resolve, reject) => {
        // Если файл не изображение, возвращаем как есть
        if (!file.type.startsWith('image/')) {
            readFileAsDataUrl(file).then(resolve).catch(reject);
            return;
        }

        // Если файл маленький (меньше 5MB), сжимаем меньше или не сжимаем
        const fileSizeMB = file.size / 1024 / 1024;
        let actualMaxWidth = maxWidth;
        let actualMaxHeight = maxHeight;
        let actualQuality = quality;

        if (fileSizeMB < 5) {
            // Маленькие файлы - минимальное сжатие
            actualMaxWidth = 3000;
            actualMaxHeight = 3000;
            actualQuality = 0.95;
        } else if (fileSizeMB < 20) {
            // Средние файлы - умеренное сжатие
            actualMaxWidth = 2500;
            actualMaxHeight = 2500;
            actualQuality = 0.9;
        } else {
            // Большие файлы - более агрессивное сжатие, но все еще высокое качество
            actualMaxWidth = 2000;
            actualMaxHeight = 2000;
            actualQuality = 0.85;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Вычисляем новые размеры с сохранением пропорций
                let width = img.width;
                let height = img.height;

                if (width > actualMaxWidth || height > actualMaxHeight) {
                    const ratio = Math.min(actualMaxWidth / width, actualMaxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }

                // Создаем canvas для сжатия
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                // Рисуем изображение на canvas
                ctx.drawImage(img, 0, 0, width, height);

                // Конвертируем в base64 с заданным качеством
                const compressedDataUrl = canvas.toDataURL(file.type, actualQuality);
                resolve(compressedDataUrl);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
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

// Проверка, является ли URL/данные видео
function isVideoUrl(url) {
    if (!url) return false;
    
    // Проверка по MIME type (для data URLs) - приоритет
    if (url.startsWith('data:')) {
        const mimeType = url.split(';')[0];
        if (mimeType.includes('video/') || mimeType.includes('image/gif')) {
            return true;
        }
    }
    
    // Проверка по расширению в URL
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.gif'];
    const lowerUrl = url.toLowerCase();
    if (videoExtensions.some(ext => lowerUrl.includes(ext))) {
        return true;
    }
    
    return false;
}

// Установка аватара с поддержкой видео
function setAvatar(element, avatarSrc) {
    if (!element) return;
    
    // Очищаем предыдущий контент
    element.innerHTML = '';
    element.style.backgroundImage = '';
    element.style.backgroundSize = '';
    element.style.backgroundPosition = '';
    
    if (!avatarSrc) {
        element.textContent = '👤';
        return;
    }
    
    // Проверяем, является ли это видео
    if (isVideoUrl(avatarSrc)) {
        // Создаём video элемент
        const video = document.createElement('video');
        video.src = avatarSrc;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.borderRadius = 'inherit';
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';
        
        // Обработка ошибок загрузки видео
        video.onerror = () => {
            // Если видео не загрузилось, показываем как картинку
            element.style.backgroundImage = `url('${avatarSrc}')`;
            element.style.backgroundSize = 'cover';
            element.style.backgroundPosition = 'center';
            video.remove();
        };
        
        element.appendChild(video);
    } else {
        // Обычная картинка
        element.style.backgroundImage = `url('${avatarSrc}')`;
        element.style.backgroundSize = 'cover';
        element.style.backgroundPosition = 'center';
    }
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
        
        selectedPhotoFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'photo-preview-item';
            
            const img = document.createElement('img');
            img.className = 'photo-preview-thumb';
            img.src = URL.createObjectURL(file);
            img.onload = () => URL.revokeObjectURL(img.src);
            
            const name = document.createElement('span');
            name.className = 'photo-preview-name';
            name.textContent = file.name;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'photo-preview-remove';
            removeBtn.innerHTML = '×';
            removeBtn.title = 'Удалить фото';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removePhoto(index);
            };
            
            item.appendChild(img);
            item.appendChild(removeBtn);
            item.appendChild(name);
            items.appendChild(item);
        });
        
        previewList.appendChild(items);
    };
    
    photoInput.addEventListener('change', updatePreview);
}

// Удаление фотографии из превью
function removePhoto(index) {
    if (index >= 0 && index < selectedPhotoFiles.length) {
        // Удаляем файл из массива
        selectedPhotoFiles.splice(index, 1);
        
        // Обновляем превью
        const previewList = document.getElementById('photo-preview-list');
        if (!previewList) return;
        
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
        
        selectedPhotoFiles.forEach((file, newIndex) => {
            const item = document.createElement('div');
            item.className = 'photo-preview-item';
            
            const img = document.createElement('img');
            img.className = 'photo-preview-thumb';
            img.src = URL.createObjectURL(file);
            img.onload = () => URL.revokeObjectURL(img.src);
            
            const name = document.createElement('span');
            name.className = 'photo-preview-name';
            name.textContent = file.name;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'photo-preview-remove';
            removeBtn.innerHTML = '×';
            removeBtn.title = 'Удалить фото';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removePhoto(newIndex);
            };
            
            item.appendChild(img);
            item.appendChild(removeBtn);
            item.appendChild(name);
            items.appendChild(item);
        });
        
        previewList.appendChild(items);
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
    
    // Категории фильтров
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const category = this.dataset.category;
            filterByCategory(category);
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
    
    // Форма редактирования объявления
    const editForm = document.getElementById('edit-listing-form');
    if (editForm) {
        editForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveEditedListing();
        });
    }
    
    // Инициализация поля обмена
    toggleDesiredPhoneInput();
    
    // Инициализация чипов фильтров
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            this.classList.toggle('active');
        });
    });
    
    // Закрытие модальных окон
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    // Загрузка аватара в профиле
    const avatarInput = document.getElementById('profile-avatar-input');
    const avatarPreview = document.getElementById('profile-avatar-preview');
    if (avatarInput && avatarPreview) {
        avatarInput.addEventListener('change', async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                currentAvatarData = reader.result;
                setAvatar(avatarPreview, currentAvatarData);
            };
            reader.readAsDataURL(file);
        });
    }
    
    // Поиск объявлений
    document.querySelectorAll('.search-input').forEach(searchInput => {
        searchInput.addEventListener('input', function(e) {
            searchQuery = e.target.value.trim().toLowerCase();
            filterListings();
            showListings();
        });
    });
}

// Загрузка профиля пользователя по telegramId
async function loadUserProfile(telegramId) {
    if (!telegramId) return null;
    
    try {
        const response = await fetch(`${USERS_API_URL}?telegramId=${encodeURIComponent(telegramId)}`);
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        return null;
    }
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
        
        // Загружаем профили всех продавцов для получения актуальных рейтингов
        const uniqueUserIds = [...new Set(allListings.map(l => l.userId).filter(Boolean))];
        const userRatingsMap = {};
        
        // Загружаем профили параллельно
        const profilePromises = uniqueUserIds.map(async (userId) => {
            const profile = await loadUserProfile(userId);
            if (profile) {
                userRatingsMap[userId] = typeof profile.rating === 'number' ? profile.rating : 0;
            }
        });
        
        await Promise.all(profilePromises);
        
        // Обновляем рейтинги в объявлениях
        allListings = allListings.map(listing => ({
            ...listing,
            rating: userRatingsMap[listing.userId] || 0
        }));
        
        // Инициализируем отфильтрованные объявления
        filterListings();
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
    const location = document.getElementById('phone-location')?.value.trim();
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    // Проверяем тип обмена
    const exchangeType = document.getElementById('exchange-type')?.value || 'yes';
    const desiredPhone = exchangeType === 'yes' 
        ? (document.getElementById('desired-phone')?.value.trim() || '')
        : 'Не хочу меняться';
    
    console.log('Form data:', { phoneModel, condition, description, desiredPhone, location, exchangeType });
    
    // Валидация
    if (!phoneModel || !condition || !location) {
        showError('Заполните обязательные поля: модель, состояние и город!');
        return;
    }

    // Если выбран обмен, проверяем что указано на что менять
    if (exchangeType === 'yes' && !desiredPhone) {
        showError('Укажите, на что хотите поменять!');
        return;
    }

    // Читаем и сжимаем фото в base64 (если выбраны)
    let imagesData = [];
    if (selectedPhotoFiles.length > 0) {
        try {
            console.log('Compressing images...');
            imagesData = await Promise.all(
                selectedPhotoFiles.map(file => {
                    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
                    console.log(`Compressing ${file.name} (${fileSizeMB} MB)`);
                    return compressImage(file);
                })
            );
            
            // Проверяем размер данных после сжатия
            const totalSize = imagesData.reduce((sum, dataUrl) => {
                return sum + (dataUrl.length * 3) / 4; // Примерный размер base64
            }, 0);
            const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
            console.log(`Total compressed size: ${totalSizeMB} MB`);
            
            // Если данные все еще слишком большие (больше 100MB), предупреждаем
            if (totalSize > 100 * 1024 * 1024) { // Больше 100MB
                console.warn('Compressed images exceed 100MB limit');
                showError(`Общий размер фотографий (${totalSizeMB} MB) превышает лимит 100MB. Пожалуйста, выберите меньше фотографий или уменьшите их размер.`);
                btnText.style.display = 'block';
                btnLoading.style.display = 'none';
                submitBtn.disabled = false;
                return;
            }
        } catch (fileError) {
            console.error('Ошибка чтения/сжатия файла(ов) фото:', fileError);
            showError('Не удалось обработать файл(ы) фото. Попробуйте другое изображение.');
            return;
        }
    }
    
    // Показываем индикатор загрузки
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';
    submitBtn.disabled = true;
    
    // Получаем данные фильтров
    const priceSegment = document.getElementById('phone-price-segment')?.value || null;
    const storage = document.getElementById('phone-storage')?.value ? parseInt(document.getElementById('phone-storage').value) : null;
    const ram = document.getElementById('phone-ram')?.value ? parseInt(document.getElementById('phone-ram').value) : null;
    const price = document.getElementById('phone-price')?.value ? parseInt(document.getElementById('phone-price').value) : null;
    
    const listingData = {
        phoneModel: phoneModel,
        condition: condition,
        description: description || 'Нет описания',
        desiredPhone: desiredPhone,
        location: location,
        price: price,
        userId: currentUser?.id,
        userInfo: currentUser ? {
            username: currentUser.username,
            name: currentUser.name,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            photoUrl: currentUser.photoUrl
        } : {},
        image: imagesData[0] || null,
        images: imagesData,
        // Данные фильтров
        priceSegment: priceSegment,
        storage: storage,
        ram: ram
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
        console.log('API response headers:', response.headers.get('content-type'));
        
        // Получаем текст ответа один раз
        const responseText = await response.text();
        const contentType = response.headers.get('content-type');
        let result;
        
        if (contentType && contentType.includes('application/json')) {
            // Пытаемся распарсить как JSON
            try {
                result = JSON.parse(responseText);
                console.log('API response data parsed successfully');
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.error('Response text (first 500 chars):', responseText.substring(0, 500));
                throw new Error(`Сервер вернул неверный формат данных. Попробуйте позже или уменьшите размер фотографий.`);
            }
        } else {
            // Если ответ не JSON, выводим ошибку
            console.error('Non-JSON response:', responseText.substring(0, 500));
            
            if (response.status >= 400) {
                // Пытаемся извлечь сообщение об ошибке из HTML или текста
                let errorMessage = `Ошибка сервера (${response.status})`;
                if (responseText.includes('Request Entity Too Large') || responseText.includes('413')) {
                    errorMessage = 'Фотографии слишком большие. Выберите изображения меньшего размера.';
                } else if (responseText.includes('timeout') || responseText.includes('Timeout')) {
                    errorMessage = 'Превышено время ожидания. Попробуйте позже или уменьшите размер фотографий.';
                }
                throw new Error(errorMessage);
            } else {
                throw new Error('Сервер вернул неожиданный формат данных.');
            }
        }
        
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
            
            // Обновляем время последнего визита
            updateLastSeen();
            
        } else {
            // Ошибка от API
            const errorMessage = result.error || result.message || 'Неизвестная ошибка API';
            throw new Error(errorMessage);
        }
        
    } catch (error) {
        console.error('Ошибка при создании объявления:', error);
        
        // Более понятное сообщение об ошибке
        let errorMessage = error.message;
        if (error.message.includes('JSON') || error.message.includes('parse')) {
            errorMessage = 'Ошибка обработки данных. Попробуйте уменьшить размер фотографий или создать объявление без фото.';
        } else if (error.message.includes('413') || error.message.includes('too large')) {
            errorMessage = 'Фотографии слишком большие. Выберите изображения меньшего размера.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Проблема с интернет-соединением. Проверьте подключение и попробуйте снова.';
        }
        
        showError(`❌ Ошибка при создании объявления: ${errorMessage}`);
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

// Фильтрация объявлений по поисковому запросу и фильтрам
function filterListings() {
    let filtered = [...allListings];
    
    // Фильтр по категориям
    if (currentCategory && currentCategory !== 'all') {
        filtered = filtered.filter(item => {
            const brand = getPhoneBrand(item.phoneModel);
            return brand === currentCategory;
        });
    }
    
    // Поиск по тексту
    if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        filtered = filtered.filter(item => {
            const phoneModel = (item.phoneModel || '').toLowerCase();
            const desiredPhone = (item.desiredPhone || '').toLowerCase();
            const description = (item.description || '').toLowerCase();
            const location = (item.location || '').toLowerCase();
            
            return (
                phoneModel.includes(searchLower) ||
                desiredPhone.includes(searchLower) ||
                description.includes(searchLower) ||
                location.includes(searchLower)
            );
        });
    }
    
    // Фильтры
    if (activeFilters.priceSegment.length > 0) {
        filtered = filtered.filter(item => 
            item.priceSegment && activeFilters.priceSegment.includes(item.priceSegment)
        );
    }
    
    if (activeFilters.storage.length > 0) {
        filtered = filtered.filter(item => 
            item.storage && activeFilters.storage.includes(String(item.storage))
        );
    }
    
    if (activeFilters.ram.length > 0) {
        filtered = filtered.filter(item => 
            item.ram && activeFilters.ram.includes(String(item.ram))
        );
    }
    
    filteredListings = filtered;
}

// Показ объявлений
function showListings() {
    const container = document.querySelector('.listings-container');
    if (!container) return;
    
    const hasActiveFilters = Object.values(activeFilters).some(val => {
        if (Array.isArray(val)) return val.length > 0;
        return val !== null && val !== undefined;
    });
    
    if (filteredListings.length === 0) {
        let message = 'Пока нет объявлений';
        let subMessage = 'Создайте первое объявление!';
        let icon = 'Smartphone';
        
        if (searchQuery || hasActiveFilters) {
            message = 'Ничего не найдено';
            subMessage = 'Попробуйте изменить поисковый запрос или фильтры';
            icon = 'Search';
        }
        
        const iconSvg = icon === 'Smartphone' 
            ? `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5; margin-bottom: 16px;">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                <line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>`
            : `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5; margin-bottom: 16px;">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
            </svg>`;
        
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 60px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                ${iconSvg}
                <h3 style="color: var(--theme-text); margin-bottom: 8px;">${message}</h3>
                <p style="color: var(--theme-text-secondary);">${subMessage}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredListings.map(item => {
        const isNew = new Date(item.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000);
        const isPopular = typeof item.rating === 'number' && item.rating >= 4.5;
        
        return `
        <div class="listing-card" onclick="showListingModal('${item.id}')">
            <div class="listing-badges">
                ${isNew ? '<span class="listing-badge new">Новое</span>' : ''}
                ${isPopular ? '<span class="listing-badge popular"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>Популярное</span>' : ''}
            </div>
            <button class="listing-favorite" onclick="event.stopPropagation(); toggleLike('${item.id}');" title="В избранное" data-listing-id="${item.id}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${isLiked(item.id) ? '#ef4444' : 'none'}" stroke="${isLiked(item.id) ? '#ef4444' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
            </button>
            <div class="listing-image-large ${getPhoneBrand(item.phoneModel)}">
                    ${
                        item.image
                            ? `<img src="${item.image}" alt="Фото ${item.phoneModel}" class="listing-photo">`
                        : `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #9ca3af; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3;">
                                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                                <line x1="12" y1="18" x2="12.01" y2="18"/>
                            </svg>
                        </div>`
                    }
                </div>
                <div class="listing-details">
                    <div class="listing-title">${item.phoneModel}</div>
                <div class="listing-condition">${getConditionText(item.condition)}</div>
                <div class="listing-rating-location">
                    <span class="rating">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle;">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        <span style="margin-left: 4px;">${typeof item.rating === 'number' ? item.rating.toFixed(1) : '0.0'}</span>
                    </span>
                    <span class="location">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle;">
                            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                            <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span style="margin-left: 4px;">${item.location}</span>
                    </span>
                        </div>
                <div class="listing-prices">
                    <div class="listing-price-current">${item.price ? formatPriceNumber(item.price) : (item.priceSegment ? formatPrice(item.priceSegment) : 'Цена не указана')}</div>
                    <div style="display: flex; gap: 8px;">
                        <button class="listing-profile-btn" onclick="event.stopPropagation(); openSellerProfileFromListing('${item.userId}')" title="Профиль продавца">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                        </button>
                        <button class="listing-buy-btn" onclick="event.stopPropagation(); showListingModal('${item.id}')">Купить</button>
                    </div>
                    </div>
                </div>
            </div>
    `;
    }).join('');
    
    // Обновляем иконки в карточках после рендеринга
    setTimeout(() => {
        document.querySelectorAll('.listing-favorite').forEach(btn => {
            const listingId = btn.dataset.listingId;
            if (listingId) {
                const liked = isLiked(listingId);
                btn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="${liked ? '#ef4444' : 'none'}" stroke="${liked ? '#ef4444' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                `;
            }
        });
    }, 100);
}

function updateProfileStats() {
    if (!currentUser) return;

    const myListings = allListings.filter(
        item => item.userId === currentUser.id && !item.isDeleted && !item.isHidden && item.status === 'active'
    );

    const soldListings = allListings.filter(
        item => item.userId === currentUser.id && !item.isDeleted && (item.status === 'sold' || item.status === 'completed')
    );

    const activeEl = document.getElementById('active-listings');
    if (activeEl) {
        activeEl.textContent = myListings.length.toString();
    }

    const completedEl = document.getElementById('completed-exchanges');
    if (completedEl) {
        completedEl.textContent = soldListings.length.toString();
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

function formatTime(timestamp) {
    if (!timestamp) return 'недавно';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    
    const days = Math.floor(diff / 86400000);
    if (days === 1) return '1 день назад';
    if (days < 7) return `${days} ${days < 5 ? 'дня' : 'дней'} назад`;
    
    const weeks = Math.floor(days / 7);
    if (weeks === 1) return '1 неделю назад';
    if (weeks < 4) return `${weeks} ${weeks < 5 ? 'недели' : 'недель'} назад`;
    
    return date.toLocaleDateString('ru-RU');
}

// Переход на главную страницу
function goToHome() {
    // Закрываем все модалки
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    
    // Переключаемся на вкладку ленты
    showTab('feed');
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
    
    // Обновляем контент при переходе
    if (tabName === 'feed') {
        setTimeout(() => loadListings(), 100);
    } else if (tabName === 'search') {
        setTimeout(() => {
            loadListings();
            // Фокусируемся на поисковой строке
            const searchInput = document.querySelector('#search .search-input');
            if (searchInput) {
                setTimeout(() => searchInput.focus(), 200);
            }
        }, 100);
    } else if (tabName === 'favorites') {
        // Показываем избранное
        showFavorites();
    } else if (tabName === 'profile') {
        // Показываем профиль во вкладке
        if (currentUser && currentProfile) {
            renderUserProfile();
        } else {
            showError('Профиль ещё не загружен. Попробуйте позже.');
        }
    }
}

function renderUserProfile() {
    if (!currentUser || !currentProfile) {
        console.warn('Cannot render profile: currentUser or currentProfile is not set');
        return;
    }
    
    // Обновляем профиль через updateProfile
    updateProfile();
    
    // Обновляем статистику
    updateProfileStats();
}

// Показ избранных объявлений
function showFavorites() {
    const container = document.querySelector('#favorites .listings-container');
    if (!container) return;
    
    if (likedListings.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--theme-text-secondary);">Избранных объявлений пока нет</p>';
        return;
    }
    
    const favoriteItems = allListings.filter(item => likedListings.includes(item.id));
    if (favoriteItems.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--theme-text-secondary);">Избранных объявлений пока нет</p>';
        return;
    }
    
    container.innerHTML = favoriteItems.map(item => {
        const isNew = new Date(item.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000);
        const isPopular = typeof item.rating === 'number' && item.rating >= 4.5;
        const liked = isLiked(item.id);
        
        return `
        <div class="listing-card" onclick="showListingModal('${item.id}')">
            <div class="listing-badges">
                ${isNew ? '<span class="listing-badge new">Новое</span>' : ''}
                ${isPopular ? '<span class="listing-badge popular"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>Популярное</span>' : ''}
            </div>
            <button class="listing-favorite" onclick="event.stopPropagation(); toggleLike('${item.id}');" title="В избранное" data-listing-id="${item.id}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${liked ? '#ef4444' : 'none'}" stroke="${liked ? '#ef4444' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
            </button>
            <div class="listing-image-large ${getPhoneBrand(item.phoneModel)}">
                ${
                    item.image
                        ? `<img src="${item.image}" alt="Фото ${item.phoneModel}" class="listing-photo">`
                        : `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #9ca3af; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3;">
                                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                                <line x1="12" y1="18" x2="12.01" y2="18"/>
                            </svg>
                        </div>`
                }
            </div>
            <div class="listing-details">
                <div class="listing-title">${item.phoneModel}</div>
                <div class="listing-condition">${getConditionText(item.condition)}</div>
                <div class="listing-rating-location">
                    <span class="rating">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle;">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        <span style="margin-left: 4px;">${typeof item.rating === 'number' ? item.rating.toFixed(1) : '0.0'}</span>
                    </span>
                    <span class="location">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle;">
                            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                            <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span style="margin-left: 4px;">${item.location}</span>
                    </span>
                </div>
                <div class="listing-prices">
                    <div class="listing-price-current">${item.price ? formatPriceNumber(item.price) : (item.priceSegment ? formatPrice(item.priceSegment) : 'Цена не указана')}</div>
                    <div style="display: flex; gap: 8px;">
                        <button class="listing-profile-btn" onclick="event.stopPropagation(); openSellerProfileFromListing('${item.userId}')" title="Профиль продавца">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                        </button>
                        <button class="listing-buy-btn" onclick="event.stopPropagation(); showListingModal('${item.id}')">Купить</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    }).join('');
    
    // Обновляем иконки после рендеринга
    setTimeout(() => {
        document.querySelectorAll('.listing-favorite').forEach(btn => {
            const listingId = btn.dataset.listingId;
            if (listingId) {
                const liked = isLiked(listingId);
                btn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="${liked ? '#ef4444' : 'none'}" stroke="${liked ? '#ef4444' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                `;
            }
        });
    }, 100);
}

// Фильтрация по категориям
let currentCategory = 'all';

function filterByCategory(category) {
    currentCategory = category;
    filterListings();
    showListings();
}

function getPhoneBrand(model) {
    if (!model) return '';
    const lower = model.toLowerCase();
    if (lower.includes('iphone')) return 'iphone';
    if (lower.includes('samsung')) return 'samsung';
    if (lower.includes('xiaomi') || lower.includes('redmi') || lower.includes('poco')) return 'xiaomi';
    return '';
}

function editProfile() {
    const modal = document.getElementById('edit-profile-modal');
    if (!modal) return;

    // Заполняем все поля
    const nameInput = document.getElementById('profile-name-input');
    const locationInput = document.getElementById('profile-location-input');
    const phoneInput = document.getElementById('profile-phone-input');
    const emailInput = document.getElementById('profile-email-input');
    const aboutInput = document.getElementById('profile-about-input');
    const avatarPreview = document.getElementById('profile-avatar-preview');
    
    if (nameInput) nameInput.value = currentProfile?.name || currentUser?.firstName || '';
    if (locationInput) locationInput.value = currentProfile?.location || '';
    if (phoneInput) phoneInput.value = currentProfile?.phone || '';
    if (emailInput) emailInput.value = currentProfile?.email || '';
    if (aboutInput) aboutInput.value = currentProfile?.about || '';
    
    // Устанавливаем текущий аватар в превью
    if (avatarPreview) {
        const currentAvatar = currentProfile?.avatar || currentUser?.photoUrl || null;
        setAvatar(avatarPreview, currentAvatar);
        currentAvatarData = currentAvatar; // Сохраняем для отправки
    }
    
    modal.style.display = 'block';
}

// Алиас для открытия редактирования профиля
function openEditProfile() {
    editProfile();
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
                <button class="btn btn-secondary" onclick="openMyProfile(); document.getElementById('my-listings-modal').style.display='none';" style="margin-top: 16px;">👤 Открыть мой профиль</button>
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
                                : `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--theme-text-tertiary);">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px;">
                                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                                <line x1="12" y1="18" x2="12.01" y2="18"/>
                            </svg>
                            <span style="font-size: 0.85em;">${item.phoneModel}</span>
                        </div>`
                        }
                    </div>
                    <div class="listing-details">
                        <div class="listing-title">${item.phoneModel}</div>
                        <div class="listing-description">${item.description}</div>
                        <div class="listing-price">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                            ${item.desiredPhone}
                        </div>
                            <div class="listing-location">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
                                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                </svg>
                                ${item.location}
                            </div>
                        <div class="listing-meta">
                            <div class="user-info">
                                <span class="rating">${item.status === 'sold' || item.status === 'completed' ? '✅ Продано' : item.isHidden ? '👁‍🗨 Скрыто' : '✅ В ленте'}</span>
                            </div>
                            <div class="timestamp">${formatTime(item.timestamp)}</div>
                        </div>
                    </div>
                </div>
                <div class="my-listing-actions">
                    ${item.status === 'active' ? `
                        <button class="btn btn-secondary" onclick="toggleListingVisibility('${item.id}', ${!item.isHidden})">
                            ${item.isHidden ? 'Показать в ленте' : 'Скрыть из ленты'}
                        </button>
                        <button class="btn btn-secondary success" onclick="markListingAsSold('${item.id}')">
                            ✅ Отметить как проданное
                        </button>
                    ` : `
                        <span class="listing-status-badge ${item.status === 'sold' ? 'sold' : 'completed'}">
                            ${item.status === 'sold' ? '✅ Продано' : '✅ Обмен завершен'}
                        </span>
                    `}
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

    const nameInput = document.getElementById('profile-name-input');
    const locationInput = document.getElementById('profile-location-input');
    const phoneInput = document.getElementById('profile-phone-input');
    const emailInput = document.getElementById('profile-email-input');
    const aboutInput = document.getElementById('profile-about-input');
    const modal = document.getElementById('edit-profile-modal');
    if (!modal) return;

    const name = nameInput?.value.trim() || '';
    const location = locationInput?.value.trim() || '';
    const phone = phoneInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';
    const about = aboutInput?.value.trim() || '';

    try {
        const response = await fetch(USERS_API_URL, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'update_profile',
                telegramId: currentUser.id,
                name: name || currentUser.firstName || 'Пользователь Telegram',
                location,
                phone,
                email,
                about,
                avatar: currentAvatarData || currentProfile?.avatar || null
            })
        });

        if (!response.ok) {
            throw new Error(`Users API error: ${response.status}`);
        }

        currentProfile = await response.json();
        updateProfile();
        
        // Обновляем профиль в модальном окне, если оно открыто
        if (document.getElementById('user-profile-modal')?.style.display === 'block') {
            const myListings = allListings.filter(
                item => item.userId === currentUser.id && !item.isDeleted && !item.isHidden
            );
            renderUserProfileModal(currentProfile, myListings);
        }
        
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

async function markListingAsSold(id) {
    if (!currentUser) return;

    if (!confirm('Отметить это объявление как проданное? Оно будет скрыто из ленты.')) {
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id,
                userId: currentUser.id,
                status: 'sold'
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        if (result.success && result.listing) {
            // Обновляем объявление в массиве
            const index = allListings.findIndex(item => item.id === id);
            if (index !== -1) {
                allListings[index] = result.listing;
            }
            
            // Обновляем счетчик продаж в профиле
            await updateUserSalesCount();
            
            showMyListings();
            showListings();
            updateProfileStats();
            showSuccess('Объявление отмечено как проданное!');
        }
    } catch (error) {
        console.error('Ошибка отметки объявления как проданного:', error);
        showError('Не удалось отметить объявление как проданное.');
    }
}

async function updateUserSalesCount() {
    if (!currentUser) return;

    try {
        const soldListings = allListings.filter(
            item => item.userId === currentUser.id && !item.isDeleted && (item.status === 'sold' || item.status === 'completed')
        );

        // Обновляем счетчик в профиле через API (если нужно сохранять на сервере)
        // Пока просто обновляем локально, так как счетчик считается динамически
    } catch (error) {
        console.error('Ошибка обновления счетчика продаж:', error);
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
        // Обновляем время последнего визита
        updateLastSeen();
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

// Открытие объявления с переходом на ленту
function showListingFromProfile(listingId) {
    // Открываем модалку объявления поверх профиля
    // Модалка объявления имеет z-index: 2000, поэтому будет поверх профиля
    showListingModal(listingId);
}

function showListingModal(listingId) {
    const listing = allListings.find(item => item.id === listingId);
    if (!listing) {
        // Если не найдено в allListings, попробуем найти в filteredListings
        const listingInFiltered = filteredListings.find(item => item.id === listingId);
        if (listingInFiltered) {
            // Перезагружаем объявления, чтобы найти нужное
            loadListings().then(() => {
                setTimeout(() => showListingModal(listingId), 200);
            });
            return;
        }
        showError('Объявление не найдено');
        return;
    }

    // Сохраняем пользователя для возможного отзыва после сделки
    currentExchangeTargetId = listing.userId || null;
    
    const modalContent = document.getElementById('modal-listing-content');
    if (!modalContent) return;

    // Подготавливаем изображения для слайдера
    const images = Array.isArray(listing.images) && listing.images.length > 0
        ? listing.images
        : (listing.image ? [listing.image] : []);
    currentListingImages = images;
    currentListingImageIndex = 0;
    const hasMultipleImages = images.length > 1;
    
    const isOwnListing = listing.userId === currentUser?.id;
    const liked = isLiked(listing.id);
    
    modalContent.innerHTML = `
        <div class="listing-detail-header">
            <div>
                <h2 class="listing-detail-title">${listing.phoneModel}</h2>
                <div class="listing-detail-time-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>Опубликовано ${formatTime(listing.timestamp)}</span>
        </div>
            </div>
            <button class="listing-detail-close" onclick="document.getElementById('listing-modal').style.display='none'">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
                </div>
        <div class="listing-detail-scrollable">
            <div class="listing-detail-body">
                <!-- Image Gallery Section -->
                <div class="listing-detail-gallery-section">
                    <div class="listing-detail-main-image">
                        <img src="${images[currentListingImageIndex] || images[0] || ''}" alt="Фото ${listing.phoneModel}" id="listing-photo-main">
                        ${hasMultipleImages ? `
                        <div class="listing-detail-image-counter">
                            ${currentListingImageIndex + 1} / ${images.length}
                </div>
                        ` : ''}
                </div>
                    ${hasMultipleImages ? `
                    <div class="listing-detail-thumbnails">
                        ${images.map((img, idx) => `
                            <button class="listing-detail-thumbnail ${idx === currentListingImageIndex ? 'active' : ''}" onclick="currentListingImageIndex = ${idx}; updateListingPhoto();">
                                <img src="${img}" alt="Фото ${idx + 1}">
                            </button>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>

                <!-- Decorative Divider -->
                <div class="listing-detail-divider"></div>

                <!-- Price and Quick Info Section -->
                <div class="listing-detail-price-section">
                    <div class="listing-detail-price-content">
                        <div class="listing-detail-price-top-row">
                            <div class="listing-detail-price-left">
                                <div class="listing-detail-price-header">
                                    <span class="listing-detail-price-dot"></span>
                                    <span class="listing-detail-price-label">Цена</span>
                                </div>
                                <div class="listing-detail-price-main">
                                    <span class="listing-detail-price-amount">${listing.price ? formatPriceNumber(listing.price).replace(' ₽', '') : formatPrice(listing.priceSegment).replace(' ₽', '')}</span>
                                    <span class="listing-detail-price-currency">₽</span>
                                </div>
                            </div>
                            <button class="listing-detail-favorite-btn" onclick="event.stopPropagation(); toggleLike('${listing.id}');">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="${liked ? '#ef4444' : 'none'}" stroke="${liked ? '#ef4444' : '#374151'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                </svg>
                            </button>
                        </div>
                        <div class="listing-detail-quick-info">
                            <div class="listing-detail-quick-badge">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                </svg>
                                <span>${typeof listing.rating === 'number' ? listing.rating.toFixed(1) : '0.0'}</span>
                            </div>
                            <div class="listing-detail-quick-badge">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                </svg>
                                <span>${listing.location}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Decorative Divider -->
                <div class="listing-detail-divider"></div>

                <!-- Details Section -->
                <div class="listing-detail-details-section">
                    <div class="listing-detail-section-header">
                        <div class="listing-detail-section-icon listing-detail-section-icon-package"></div>
                        <h3 class="listing-detail-section-title">О товаре</h3>
                    </div>
                    <div class="listing-detail-details-grid">
                        <!-- Description -->
                        <div class="listing-detail-detail-card">
                            <h4 class="listing-detail-detail-card-title">
                                <span class="listing-detail-detail-emoji">📝</span>
                                <span>Описание</span>
                            </h4>
                            <p class="listing-detail-detail-card-text">${listing.description || listing.phoneModel}</p>
                        </div>

                        <!-- Trade Option -->
                        <div class="listing-detail-detail-card listing-detail-detail-card-emerald">
                            <h4 class="listing-detail-detail-card-title">
                                <span class="listing-detail-detail-emoji">🔄</span>
                                <span>Хочу обмен</span>
                            </h4>
                            <p class="listing-detail-detail-card-text-emerald">
                                <span class="listing-detail-detail-dot"></span>
                                ${listing.desiredPhone && listing.desiredPhone !== 'Не хочу меняться' ? listing.desiredPhone : 'Не хочу меняться'}
                            </p>
                        </div>

                        <div class="listing-detail-details-row">
                            <!-- Condition -->
                            <div class="listing-detail-detail-card">
                                <h4 class="listing-detail-detail-card-title">
                                    <span class="listing-detail-detail-emoji">✨</span>
                                    <span>Состояние</span>
                                </h4>
                                <span class="listing-detail-condition-badge-new">${getConditionText(listing.condition)}</span>
                            </div>

                            <!-- Location Details -->
                            <div class="listing-detail-detail-card">
                                <div class="listing-detail-location-mini">
                                    <div class="listing-detail-location-icon-mini">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                                            <circle cx="12" cy="10" r="3"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 class="listing-detail-location-mini-title">Местоположение</h4>
                                        <p class="listing-detail-location-mini-text">${listing.location}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                ${!isOwnListing ? `
                <!-- Decorative Divider -->
                <div class="listing-detail-divider"></div>

                <!-- Seller Info Section -->
                <div class="listing-detail-seller-section">
                    <div class="listing-detail-section-header">
                        <div class="listing-detail-section-icon listing-detail-section-icon-user"></div>
                        <h3 class="listing-detail-section-title">Продавец</h3>
                    </div>
                    <div class="listing-detail-seller-card">
                        <div class="listing-detail-seller-header-new">
                            <div class="listing-detail-seller-avatar-new"></div>
                            <div>
                                <div class="listing-detail-seller-name-new">Продавец</div>
                                <div class="listing-detail-seller-info-new">
                                    <span class="listing-detail-seller-status-dot"></span>
                                    На сайте с 2024 года
                                </div>
                            </div>
                        </div>
                        <button class="listing-detail-seller-btn-new" onclick="openSellerProfileFromModal()">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                            <span>Посмотреть профиль</span>
                        </button>
                    </div>
                </div>
                ` : ''}

                <!-- Decorative Divider -->
                <div class="listing-detail-divider"></div>

                <!-- Action Buttons Section -->
                <div class="listing-detail-actions-section">
                    <div class="listing-detail-section-header">
                        <div class="listing-detail-section-icon listing-detail-section-icon-message">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                        </div>
                        <h3 class="listing-detail-section-title">Действия</h3>
                    </div>
                    <div class="listing-detail-actions">
                        ${isOwnListing ? `
                        <button class="listing-detail-action-btn listing-detail-action-edit" onclick="editListing('${listing.id}')">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            <span>Редактировать</span>
                        </button>
                        <button class="listing-detail-action-btn listing-detail-action-delete" onclick="deleteListing('${listing.id}')">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                            <span>Удалить</span>
                        </button>
                        ` : `
                        ${listing.desiredPhone && listing.desiredPhone !== 'Не хочу меняться' ? `
                        <button class="listing-detail-action-btn listing-detail-action-primary" onclick="startExchange('${listing.id}')">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            <span>Начать обмен</span>
                        </button>
                        ` : ''}
                        <button class="listing-detail-action-btn listing-detail-action-secondary" onclick="contactSeller('${listing.id}')">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                            <span>Написать продавцу</span>
                        </button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Добавляем иконки для секций
    setTimeout(() => {
        const packageIcon = document.querySelector('.listing-detail-section-icon-package');
        if (packageIcon && !packageIcon.querySelector('svg')) {
            packageIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
        }
        
        const userIcon = document.querySelector('.listing-detail-section-icon-user');
        if (userIcon && !userIcon.querySelector('svg')) {
            userIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
        }
    }, 0);
    
    // Сохраняем ID продавца для открытия профиля
    if (!isOwnListing) {
        currentExchangeTargetId = listing.userId;
    }
    
    document.getElementById('listing-modal').style.display = 'block';
}

function updateListingPhoto() {
    if (!currentListingImages.length) return;
    const imgEl = document.getElementById('listing-photo-main');
    if (!imgEl) return;
    
    // Обновляем основное изображение
    imgEl.src = currentListingImages[currentListingImageIndex];
    
    // Обновляем счетчик изображений
    const counterEl = document.querySelector('.listing-detail-image-counter');
    if (counterEl && currentListingImages.length > 1) {
        counterEl.textContent = `${currentListingImageIndex + 1} / ${currentListingImages.length}`;
    }
    
    // Обновляем активную миниатюру
    document.querySelectorAll('.listing-detail-thumbnail').forEach((thumb, idx) => {
        if (idx === currentListingImageIndex) {
            thumb.classList.add('active');
        } else {
            thumb.classList.remove('active');
        }
    });
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

function formatPriceNumber(price) {
    // Форматирование числа с пробелами для тысяч
    return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
}

function formatPrice(priceSegment) {
    // Примерная цена на основе ценового сегмента
    const prices = {
        'budget': '25 000 ₽',
        'mid': '45 000 ₽',
        'subflagship': '75 000 ₽',
        'flagship': '120 000 ₽'
    };
    return prices[priceSegment] || 'Цена не указана';
}

function startExchange(listingId) {
    document.getElementById('listing-modal').style.display = 'none';
    document.getElementById('exchange-modal').style.display = 'block';
}

function contactSeller(telegramId) {
    if (!telegramId) {
        showError('Не удалось определить продавца для связи.');
        return;
    }
    // Здесь можно добавить логику открытия чата с продавцом
    showInfo('Функция связи с продавцом скоро будет доступна!');
}

function confirmExchange() {
    showSuccess('Обмен успешно начат! Ожидайте подтверждения.');
    document.getElementById('exchange-modal').style.display = 'none';

    // После подтверждения обмена даём возможность оставить отзыв
    if (currentExchangeTargetId && currentUser && currentExchangeTargetId !== currentUser.id) {
        const reviewModal = document.getElementById('review-modal');
        if (reviewModal) {
            reviewModal.style.display = 'block';
        }
    }
}

function openSellerProfileFromModal() {
    if (!currentExchangeTargetId) {
        showError('Не удалось определить продавца для профиля.');
        return;
    }
    
    // Закрываем модалку объявления
    const listingModal = document.getElementById('listing-modal');
    if (listingModal) {
        listingModal.style.display = 'none';
    }
    
    // Если это свой профиль, открываем свой профиль
    if (currentExchangeTargetId === currentUser?.id) {
        openMyProfile();
    } else {
        openUserProfileByTelegram(currentExchangeTargetId);
    }
}

function openSellerProfileFromListing(userId) {
    if (!userId) {
        showError('Не удалось определить продавца для профиля.');
        return;
    }
    
    // Если это свой профиль, открываем свой профиль
    if (userId === currentUser?.id) {
        openMyProfile();
    } else {
        openUserProfileByTelegram(userId);
    }
}

// Открытие своего профиля
function openMyProfile() {
    if (!currentUser || !currentProfile) {
        showError('Профиль ещё не загружен. Попробуйте позже.');
        return;
    }
    
    // Закрываем текущие модалки
    document.querySelectorAll('.modal').forEach(modal => {
        if (modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });
    
    // Загружаем свои объявления
    const myListings = allListings.filter(
        item => item.userId === currentUser.id && !item.isDeleted && !item.isHidden
    );
    
    renderUserProfileModal(currentProfile, myListings);
}

async function submitReview() {
    if (!currentExchangeTargetId || !currentUser) {
        showError('Не удалось определить пользователя для отзыва.');
        return;
    }

    const ratingSelect = document.getElementById('review-rating');
    const textArea = document.getElementById('review-text');
    if (!ratingSelect || !textArea) return;

    const rating = parseInt(ratingSelect.value, 10) || 5;
    const text = textArea.value.trim();

    try {
        const response = await fetch(USERS_API_URL, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'add_review',
                targetTelegramId: currentExchangeTargetId,
                authorTelegramId: currentUser.id,
                authorUsername: currentUser.username,
                rating,
                text
            })
        });

        if (!response.ok) {
            throw new Error(`Users API error: ${response.status}`);
        }

        // Обновляем модалку профиля, если она открыта, можно будет перечитать профиль по желанию
        showSuccess('Отзыв отправлен!');
        const reviewModal = document.getElementById('review-modal');
        if (reviewModal) {
            reviewModal.style.display = 'none';
        }
        textArea.value = '';
        ratingSelect.value = '5';
    } catch (error) {
        console.error('Ошибка отправки отзыва:', error);
        showError('Не удалось отправить отзыв. Попробуйте позже.');
    }
}

async function openUserProfileByTelegram(telegramId) {
    if (!telegramId) {
        showError('ID пользователя не указан.');
        return;
    }
    
    console.log('Opening profile by telegramId:', telegramId);
    
    // Показываем модалку сразу с базовой информацией
    const modal = document.getElementById('user-profile-modal');
    if (modal) {
        modal.style.display = 'block';
        // Показываем загрузку
        const nameEl = document.getElementById('user-profile-name');
        if (nameEl) nameEl.textContent = 'Загрузка...';
    }
    
    try {
        // Загружаем профиль и объявления параллельно для ускорения
        const [profileResp, listingsResp] = await Promise.all([
            fetch(`${USERS_API_URL}?telegramId=${encodeURIComponent(telegramId)}`),
            fetch(`${API_URL}?userId=${encodeURIComponent(telegramId)}`)
        ]);
        
        const listings = listingsResp.ok ? await listingsResp.json() : [];
        let profile;
        
        // Если профиль не найден, создаем его автоматически
        if (!profileResp.ok && profileResp.status === 404) {
            console.log('Profile not found, creating automatically...');
            
            // Пытаемся получить информацию о пользователе из объявлений
            const firstListing = listings.length > 0 ? listings[0] : null;
            const userInfo = firstListing?.userInfo || {};
            
            // Создаем профиль с базовыми данными
            const createProfileResp = await fetch(USERS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'init',
                    telegramId: telegramId,
                    username: userInfo.username || null,
                    name: userInfo.name || userInfo.firstName || `Пользователь ${telegramId}`,
                    avatar: userInfo.photoUrl || userInfo.avatar || null
                })
            });
            
            if (!createProfileResp.ok) {
                throw new Error(`Failed to create profile: ${createProfileResp.status}`);
            }
            
            profile = await createProfileResp.json();
            console.log('Profile created automatically:', profile);
        } else if (!profileResp.ok) {
            throw new Error(`Profile API error: ${profileResp.status}`);
        } else {
            profile = await profileResp.json();
            console.log('Profile loaded:', profile);
        }
        
        console.log('Listings loaded:', listings.length);
        // Используем requestAnimationFrame для плавного рендеринга
        requestAnimationFrame(() => {
            renderUserProfileModal(profile, listings);
        });
    } catch (error) {
        console.error('Ошибка открытия профиля пользователя:', error);
        if (modal) modal.style.display = 'none';
        showError(`Не удалось открыть профиль пользователя: ${error.message}`);
    }
}

async function openUserProfileByPublicId(publicId) {
    if (!publicId) {
        console.error('PublicId is empty');
        return;
    }
    
    console.log('Opening profile by publicId:', publicId);
    
    // Показываем модалку сразу с базовой информацией
    const modal = document.getElementById('user-profile-modal');
    if (modal) {
        modal.style.display = 'block';
        // Показываем загрузку
        const nameEl = document.getElementById('user-profile-name');
        if (nameEl) nameEl.textContent = 'Загрузка...';
    }
    
    try {
        const profileResp = await fetch(
            `${USERS_API_URL}?publicId=${encodeURIComponent(publicId)}`
        );

        if (!profileResp.ok) {
            if (profileResp.status === 404) {
                if (modal) modal.style.display = 'none';
                showError('Профиль не найден. Проверьте правильность ссылки.');
                return;
            }
            throw new Error(`Profile API error: ${profileResp.status}`);
        }

        const profile = await profileResp.json();
        console.log('Profile loaded by publicId:', profile);
        
        if (!profile.telegramId) {
            if (modal) modal.style.display = 'none';
            showError('Профиль найден, но не содержит данных пользователя.');
            return;
        }
        
        // Загружаем объявления параллельно
        const listingsResp = await fetch(
            `${API_URL}?userId=${encodeURIComponent(profile.telegramId)}`
        );
        const listings = listingsResp.ok ? await listingsResp.json() : [];
        console.log('Listings loaded:', listings.length);

        // Используем requestAnimationFrame для плавного рендеринга
        requestAnimationFrame(() => {
            renderUserProfileModal(profile, listings);
        });
    } catch (error) {
        console.error('Ошибка открытия профиля по ID:', error);
        if (modal) modal.style.display = 'none';
        showError(`Профиль по ссылке не найден: ${error.message}`);
    }
}

function renderUserProfileModal(profile, listings) {
    const modal = document.getElementById('user-profile-modal');
    if (!modal) return;

    // Запоминаем этого пользователя как текущую цель для отзыва
    currentExchangeTargetId = profile.telegramId || null;
    const isOwnProfile = profile.telegramId === currentUser?.id;

    // Основная информация
    const nameEl = document.getElementById('user-profile-name');
    const avatarEl = document.getElementById('user-profile-avatar');
    const aboutEl = document.getElementById('user-profile-about');
    const locationEl = document.getElementById('user-profile-location');
    const joinedEl = document.getElementById('user-profile-joined');
    const phoneEl = document.getElementById('user-profile-phone');
    const emailEl = document.getElementById('user-profile-email');

    if (nameEl) nameEl.textContent = profile.name || 'Пользователь Telegram';
    
    if (avatarEl) {
        if (profile.avatar) {
            const img = document.createElement('img');
            img.src = profile.avatar;
            img.alt = profile.name || 'User';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '12px';
            avatarEl.innerHTML = '';
            avatarEl.appendChild(img);
        } else {
            avatarEl.innerHTML = '';
            const userIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            userIcon.setAttribute('width', '48');
            userIcon.setAttribute('height', '48');
            userIcon.setAttribute('viewBox', '0 0 24 24');
            userIcon.setAttribute('fill', 'none');
            userIcon.setAttribute('stroke', 'white');
            userIcon.setAttribute('stroke-width', '2');
            userIcon.setAttribute('stroke-linecap', 'round');
            userIcon.setAttribute('stroke-linejoin', 'round');
            const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path1.setAttribute('d', 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2');
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '12');
            circle.setAttribute('cy', '7');
            circle.setAttribute('r', '4');
            userIcon.appendChild(path1);
            userIcon.appendChild(circle);
            avatarEl.appendChild(userIcon);
        }
        avatarEl.classList.add('user-profile-avatar-large');
    }

    if (locationEl) {
        const location = profile.location || 'Не указано';
        const locationSpan = locationEl.querySelector('span');
        if (locationSpan) {
            locationSpan.textContent = location;
        } else {
            locationEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg><span>${location}</span>`;
        }
    }

    if (joinedEl) {
        const createdAt = profile.createdAt ? new Date(profile.createdAt) : new Date();
        const yearsOnSite = Math.floor((new Date() - createdAt) / (1000 * 60 * 60 * 24 * 365));
        const joinedText = yearsOnSite > 0 
            ? `На сайте ${yearsOnSite} ${yearsOnSite === 1 ? 'год' : yearsOnSite < 5 ? 'года' : 'лет'}`
            : 'На сайте недавно';
        const joinedSpan = joinedEl.querySelector('span');
        if (joinedSpan) {
            joinedSpan.textContent = joinedText;
        } else {
            joinedEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>${joinedText}</span>`;
        }
    }

    if (aboutEl) {
        const about = profile.about?.trim();
        aboutEl.textContent =
            about && about.length > 0
                ? about
                : 'Пользователь пока не рассказал о себе.';
    }

    // Подсчитываем статистику
    const activeListings = Array.isArray(listings)
        ? listings.filter(l => !l.isDeleted && !l.isHidden && l.status === 'active')
        : [];
    const soldListings = Array.isArray(listings)
        ? listings.filter(l => !l.isDeleted && (l.status === 'sold' || l.status === 'completed'))
        : [];
    const reviews = Array.isArray(profile.reviews) ? profile.reviews : [];
    const ratingValue = typeof profile.rating === 'number' ? profile.rating : 0;

    // Обновляем статистику
    const ratingEl = document.getElementById('user-profile-rating-number');
    const activeCountEl = document.getElementById('user-profile-active-count');
    const salesCountEl = document.getElementById('user-profile-sales-count');
    const reviewsCountEl = document.getElementById('user-profile-reviews-count');

    if (ratingEl) ratingEl.textContent = ratingValue.toFixed(1);
    if (activeCountEl) activeCountEl.textContent = activeListings.length.toString();
    if (salesCountEl) salesCountEl.textContent = soldListings.length.toString();
    if (reviewsCountEl) reviewsCountEl.textContent = reviews.length.toString();

    // Обновляем контактную информацию
    if (phoneEl) phoneEl.textContent = profile.phone || '—';
    if (emailEl) emailEl.textContent = profile.email || '—';

    // Отображаем товары продавца
    const sellerItemsEl = document.getElementById('user-profile-seller-items');
    if (sellerItemsEl) {
        const displayItems = activeListings.slice(0, 4); // Показываем первые 4 товара
        if (displayItems.length === 0) {
            sellerItemsEl.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">Нет активных товаров</p>';
        } else {
            sellerItemsEl.innerHTML = displayItems.map(item => `
                <div class="user-profile-seller-item-card" onclick="showListingModal('${item.id}')">
                    <div class="user-profile-seller-item-image">
                        ${item.image 
                            ? `<img src="${item.image}" alt="${item.phoneModel}">`
                            : `<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f3f4f6; color: #9ca3af;">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                                    <line x1="12" y1="18" x2="12.01" y2="18"/>
                                </svg>
                            </div>`
                        }
                    </div>
                    <div class="user-profile-seller-item-info">
                        <div class="user-profile-seller-item-price">${item.price ? formatPriceNumber(item.price) : (item.priceSegment ? formatPrice(item.priceSegment) : 'Цена не указана')}</div>
                        <div class="user-profile-seller-item-name">${item.phoneModel}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    // Отображаем отзывы
    const reviewsListEl = document.getElementById('user-profile-reviews-list');
    if (reviewsListEl) {
        const displayReviews = reviews.slice(0, 3); // Показываем первые 3 отзыва
        if (displayReviews.length === 0) {
            reviewsListEl.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">Отзывов пока нет</p>';
        } else {
            reviewsListEl.innerHTML = displayReviews.map(r => {
                const authorInitial = (r.authorUsername || r.authorName || 'П').charAt(0).toUpperCase();
                return `
                    <div class="user-profile-review-card">
                        <div class="user-profile-review-header">
                            <div class="user-profile-review-avatar" style="background: #dbeafe; color: #1e40af;">${authorInitial}</div>
                            <div class="user-profile-review-info">
                                <div class="user-profile-review-name">${r.authorUsername || r.authorName || 'Пользователь'}</div>
                                <div class="user-profile-review-rating">
                                    ${[...Array(5)].map((_, i) => `
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${i < (r.rating || 5) ? '#fbbf24' : 'none'}" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                        </svg>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="user-profile-review-date">${formatTime(r.createdAt)}</div>
                        </div>
                        <p class="user-profile-review-text">${r.text || 'Без текста'}</p>
                    </div>
                `;
            }).join('');
        }
    }

    modal.style.display = 'block';
}

function contactSellerFromProfile() {
    if (!currentExchangeTargetId) {
        showError('Не удалось определить продавца для связи.');
        return;
    }
    contactSeller(currentExchangeTargetId);
}

function callSeller() {
    if (!currentExchangeTargetId) {
        showError('Не удалось определить продавца для звонка.');
        return;
    }
    const profile = currentProfile || {};
    const phone = profile.phone;
    if (phone) {
        window.location.href = `tel:${phone}`;
    } else {
        showError('Номер телефона не указан.');
    }
}

function shareSellerProfile() {
    if (!currentExchangeTargetId) {
        showError('Не удалось определить профиль для публикации.');
        return;
    }
    // Здесь можно добавить логику публикации профиля
    showInfo('Функция публикации профиля в разработке');
}

function toggleSellerBookmark() {
    // Здесь можно добавить логику добавления в закладки
    showInfo('Функция закладок в разработке');
}

function viewAllSellerItems() {
    // Закрываем модальное окно профиля
    document.getElementById('user-profile-modal').style.display = 'none';
    // Переходим на вкладку поиска и фильтруем по продавцу
    showTab('search');
    // Здесь можно добавить фильтрацию по продавцу
}

function viewAllSellerReviews() {
    // Здесь можно добавить модальное окно со всеми отзывами
    showInfo('Все отзывы продавца');
}

function shareProfile() {
    if (!currentProfile || !currentProfile.publicId) {
        showError('ID профиля не найден.');
        return;
    }
    
    const profileUrl = `${window.location.origin}?profile=${currentProfile.publicId}`;
    
    // Пытаемся скопировать в буфер обмена
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(profileUrl).then(() => {
            showSuccess('Ссылка на профиль скопирована в буфер обмена!');
        }).catch(() => {
            // Если не удалось скопировать, показываем ссылку
            showInfo(`Ссылка на профиль: ${profileUrl}`);
        });
    } else {
        // Fallback для старых браузеров
        showInfo(`Ссылка на профиль: ${profileUrl}`);
    }
}

// Функция для связи с пользователем
function contactUser() {
    if (currentExchangeTargetId && tg && tg.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/${currentExchangeTargetId}`);
    } else {
        showError('Не удалось открыть чат с пользователем');
    }
}

function openReviewForCurrentProfile() {
    if (!currentExchangeTargetId || !currentUser) {
        showError('Не удалось определить пользователя для отзыва.');
        return;
    }
    const reviewModal = document.getElementById('review-modal');
    if (reviewModal) {
        reviewModal.style.display = 'block';
    }
}

// Открытие модального окна фильтров

// Функция открытия модального окна выбора темы
function openThemeSelector() {
    const modal = document.getElementById('theme-selector-modal');
    if (modal) {
        modal.style.display = 'block';
        // Отмечаем текущую тему
        document.querySelectorAll('.theme-card').forEach(card => {
            const check = card.querySelector('.theme-check');
            if (card.dataset.theme === currentTheme) {
                check.style.display = 'flex';
                card.style.borderColor = '#a855f7';
                card.style.boxShadow = '0 0 0 3px rgba(168, 85, 247, 0.2)';
            } else {
                check.style.display = 'none';
                card.style.borderColor = '';
                card.style.boxShadow = '';
            }
        });
    }
}

// Функция установки темы
function setTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('theme', theme);
    applyTheme(theme);
    // Обновляем визуальное выделение
    document.querySelectorAll('.theme-card').forEach(card => {
        const check = card.querySelector('.theme-check');
        if (card.dataset.theme === theme) {
            check.style.display = 'flex';
            card.style.borderColor = '#a855f7';
            card.style.boxShadow = '0 0 0 3px rgba(168, 85, 247, 0.2)';
        } else {
            check.style.display = 'none';
            card.style.borderColor = '';
            card.style.boxShadow = '';
        }
    });
    // Закрываем модальное окно
    const modal = document.getElementById('theme-selector-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    // Обновляем отображение
    if (document.querySelector('.listings-container')) {
        showListings();
    }
}

// Получение стилей темы
function getThemeStyles(theme) {
    const themes = {
        white: {
            bg: '#f9fafb',
            headerBg: 'rgba(255, 255, 255, 0.95)',
            headerBorder: '#e5e7eb',
            cardBg: '#ffffff',
            cardBorder: '#e5e7eb',
            cardHoverBorder: '#d1d5db',
            text: '#111827',
            textSecondary: '#4b5563',
            textTertiary: '#6b7280',
            inputBg: '#f3f4f6',
            inputBorder: '#e5e7eb',
            inputFocusBorder: '#111827',
            buttonBg: '#111827',
            buttonHover: '#1f2937',
            categoryActive: '#111827',
            categoryInactiveBg: '#ffffff',
            categoryInactiveText: '#374151',
            navBg: 'rgba(255, 255, 255, 0.95)',
            navBorder: '#e5e7eb',
            navActiveBg: '#f3f4f6',
            navActiveText: '#111827',
            navInactiveText: '#6b7280',
            accentGradient: 'linear-gradient(90deg, #111827 0%, #374151 100%)'
        },
        black: {
            bg: '#000000',
            headerBg: 'rgba(3, 7, 18, 0.95)',
            headerBorder: '#1f2937',
            cardBg: '#030712',
            cardBorder: '#1f2937',
            cardHoverBorder: '#374151',
            text: '#ffffff',
            textSecondary: '#d1d5db',
            textTertiary: '#6b7280',
            inputBg: '#1f2937',
            inputBorder: '#1f2937',
            inputFocusBorder: '#ffffff',
            buttonBg: '#ffffff',
            buttonHover: '#f3f4f6',
            categoryActive: '#ffffff',
            categoryInactiveBg: '#1f2937',
            categoryInactiveText: '#d1d5db',
            navBg: 'rgba(3, 7, 18, 0.95)',
            navBorder: '#1f2937',
            navActiveBg: '#1f2937',
            navActiveText: '#ffffff',
            navInactiveText: '#6b7280',
            accentGradient: 'linear-gradient(90deg, #ffffff 0%, #d1d5db 100%)'
        },
        ocean: {
            bg: 'linear-gradient(135deg, #0c1220 0%, #0a1628 50%, #0f172a 100%)',
            headerBg: 'rgba(15, 23, 42, 0.95)',
            headerBorder: 'rgba(30, 58, 138, 1)',
            cardBg: 'rgba(30, 58, 138, 0.5)',
            cardBorder: 'rgba(30, 58, 138, 1)',
            cardHoverBorder: 'rgba(8, 145, 178, 1)',
            text: '#ffffff',
            textSecondary: 'rgba(207, 250, 254, 1)',
            textTertiary: 'rgba(165, 243, 252, 1)',
            inputBg: 'rgba(30, 58, 138, 0.5)',
            inputBorder: 'rgba(30, 58, 138, 1)',
            inputFocusBorder: 'rgba(6, 182, 212, 1)',
            buttonBg: 'linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%)',
            buttonHover: 'rgba(6, 182, 212, 0.5)',
            categoryActive: 'linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%)',
            categoryInactiveBg: 'rgba(30, 58, 138, 0.5)',
            categoryInactiveText: 'rgba(186, 230, 253, 1)',
            navBg: 'rgba(15, 23, 42, 0.95)',
            navBorder: 'rgba(30, 58, 138, 1)',
            navActiveBg: 'rgba(6, 182, 212, 0.2)',
            navActiveText: 'rgba(165, 243, 252, 1)',
            navInactiveText: 'rgba(14, 165, 233, 1)',
            accentGradient: 'linear-gradient(90deg, #22d3ee 0%, #3b82f6 100%)'
        },
        sunset: {
            bg: 'linear-gradient(135deg, #fff7ed 0%, #ffe4e6 50%, #fce7f3 100%)',
            headerBg: 'rgba(255, 255, 255, 0.8)',
            headerBorder: '#fed7aa',
            cardBg: '#ffffff',
            cardBorder: '#fed7aa',
            cardHoverBorder: '#fb7185',
            text: '#111827',
            textSecondary: '#374151',
            textTertiary: '#4b5563',
            inputBg: '#ffffff',
            inputBorder: '#fed7aa',
            inputFocusBorder: '#ec4899',
            buttonBg: 'linear-gradient(90deg, #f97316 0%, #ec4899 100%)',
            buttonHover: 'rgba(236, 72, 153, 0.5)',
            categoryActive: 'linear-gradient(90deg, #f97316 0%, #ec4899 100%)',
            categoryInactiveBg: '#ffffff',
            categoryInactiveText: '#374151',
            navBg: 'rgba(255, 255, 255, 0.9)',
            navBorder: '#fed7aa',
            navActiveBg: '#fce7f3',
            navActiveText: '#ec4899',
            navInactiveText: '#6b7280',
            accentGradient: 'linear-gradient(90deg, #f97316 0%, #ec4899 100%)'
        },
        forest: {
            bg: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
            headerBg: 'rgba(6, 78, 59, 0.95)',
            headerBorder: 'rgba(5, 150, 105, 1)',
            cardBg: 'rgba(5, 150, 105, 0.5)',
            cardBorder: 'rgba(5, 150, 105, 1)',
            cardHoverBorder: 'rgba(20, 184, 166, 1)',
            text: '#ffffff',
            textSecondary: 'rgba(209, 250, 229, 1)',
            textTertiary: 'rgba(167, 243, 208, 1)',
            inputBg: 'rgba(5, 150, 105, 0.5)',
            inputBorder: 'rgba(5, 150, 105, 1)',
            inputFocusBorder: 'rgba(20, 184, 166, 1)',
            buttonBg: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
            buttonHover: 'rgba(16, 185, 129, 0.5)',
            categoryActive: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
            categoryInactiveBg: 'rgba(5, 150, 105, 0.5)',
            categoryInactiveText: 'rgba(167, 243, 208, 1)',
            navBg: 'rgba(6, 78, 59, 0.95)',
            navBorder: 'rgba(5, 150, 105, 1)',
            navActiveBg: 'rgba(16, 185, 129, 0.2)',
            navActiveText: 'rgba(167, 243, 208, 1)',
            navInactiveText: 'rgba(20, 184, 166, 1)',
            accentGradient: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)'
        },
        neon: {
            bg: 'linear-gradient(135deg, #581c87 0%, #000000 50%, #831843 100%)',
            headerBg: 'rgba(0, 0, 0, 0.95)',
            headerBorder: 'rgba(88, 28, 135, 1)',
            cardBg: 'rgba(88, 28, 135, 0.3)',
            cardBorder: 'rgba(124, 58, 237, 1)',
            cardHoverBorder: 'rgba(236, 72, 153, 1)',
            text: '#ffffff',
            textSecondary: 'rgba(250, 245, 255, 1)',
            textTertiary: 'rgba(221, 214, 254, 1)',
            inputBg: 'rgba(88, 28, 135, 0.3)',
            inputBorder: 'rgba(124, 58, 237, 1)',
            inputFocusBorder: 'rgba(236, 72, 153, 1)',
            buttonBg: 'linear-gradient(90deg, #a855f7 0%, #ec4899 50%, #06b6d4 100%)',
            buttonHover: 'rgba(236, 72, 153, 0.5)',
            categoryActive: 'linear-gradient(90deg, #a855f7 0%, #ec4899 50%, #06b6d4 100%)',
            categoryInactiveBg: 'rgba(88, 28, 135, 0.3)',
            categoryInactiveText: 'rgba(221, 214, 254, 1)',
            navBg: 'rgba(0, 0, 0, 0.95)',
            navBorder: 'rgba(88, 28, 135, 1)',
            navActiveBg: 'rgba(236, 72, 153, 0.2)',
            navActiveText: 'rgba(251, 113, 133, 1)',
            navInactiveText: 'rgba(147, 51, 234, 1)',
            accentGradient: 'linear-gradient(90deg, #a855f7 0%, #ec4899 50%, #06b6d4 100%)'
        },
        royal: {
            bg: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 50%, #ddd6fe 100%)',
            headerBg: 'rgba(255, 255, 255, 0.8)',
            headerBorder: '#e9d5ff',
            cardBg: '#ffffff',
            cardBorder: '#e9d5ff',
            cardHoverBorder: '#a78bfa',
            text: '#111827',
            textSecondary: '#374151',
            textTertiary: '#4b5563',
            inputBg: '#ffffff',
            inputBorder: '#e9d5ff',
            inputFocusBorder: '#6366f1',
            buttonBg: 'linear-gradient(90deg, #9333ea 0%, #4f46e5 100%)',
            buttonHover: 'rgba(99, 102, 241, 0.5)',
            categoryActive: 'linear-gradient(90deg, #9333ea 0%, #4f46e5 100%)',
            categoryInactiveBg: '#ffffff',
            categoryInactiveText: '#374151',
            navBg: 'rgba(255, 255, 255, 0.9)',
            navBorder: '#e9d5ff',
            navActiveBg: '#f3e8ff',
            navActiveText: '#9333ea',
            navInactiveText: '#6b7280',
            accentGradient: 'linear-gradient(90deg, #9333ea 0%, #4f46e5 100%)'
        }
    };
    
    return themes[theme] || themes.ocean;
}

// Применение темы
function applyTheme(theme) {
    const root = document.documentElement;
    currentTheme = theme;
    const themeStyles = getThemeStyles(theme);
    
    // Устанавливаем data-theme для селекторов
    root.setAttribute('data-theme', theme);
    
    // Применяем CSS переменные
    root.style.setProperty('--theme-bg', themeStyles.bg);
    root.style.setProperty('--theme-header-bg', themeStyles.headerBg);
    root.style.setProperty('--theme-header-border', themeStyles.headerBorder);
    root.style.setProperty('--theme-card-bg', themeStyles.cardBg);
    root.style.setProperty('--theme-card-border', themeStyles.cardBorder);
    root.style.setProperty('--theme-card-hover-border', themeStyles.cardHoverBorder);
    root.style.setProperty('--theme-text', themeStyles.text);
    root.style.setProperty('--theme-text-secondary', themeStyles.textSecondary);
    root.style.setProperty('--theme-text-tertiary', themeStyles.textTertiary);
    root.style.setProperty('--theme-input-bg', themeStyles.inputBg);
    root.style.setProperty('--theme-input-border', themeStyles.inputBorder);
    root.style.setProperty('--theme-input-focus-border', themeStyles.inputFocusBorder);
    root.style.setProperty('--theme-button-bg', themeStyles.buttonBg);
    root.style.setProperty('--theme-button-hover-shadow', themeStyles.buttonHover);
    root.style.setProperty('--theme-category-active', themeStyles.categoryActive);
    root.style.setProperty('--theme-category-inactive-bg', themeStyles.categoryInactiveBg);
    root.style.setProperty('--theme-category-inactive-text', themeStyles.categoryInactiveText);
    root.style.setProperty('--theme-nav-bg', themeStyles.navBg);
    root.style.setProperty('--theme-nav-border', themeStyles.navBorder);
    root.style.setProperty('--theme-nav-active-bg', themeStyles.navActiveBg);
    root.style.setProperty('--theme-nav-active-text', themeStyles.navActiveText);
    root.style.setProperty('--theme-nav-inactive-text', themeStyles.navInactiveText);
    root.style.setProperty('--theme-accent-gradient', themeStyles.accentGradient);
    
    // Фон body обновляется автоматически через CSS переменную --theme-bg
    // Убираем inline стиль, если он был установлен ранее
    document.body.style.background = '';
    
    // Обновляем логотип
    const logoIcon = document.getElementById('header-logo-icon');
    if (logoIcon) {
        const gradientId = `logo-gradient-${theme}`;
        const colors = getThemeLogoColors(theme);
        logoIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 2H17C18.1046 2 19 2.89543 19 4V20C19 21.1046 18.1046 22 17 22H7C5.89543 22 5 21.1046 5 20V4C5 2.89543 5.89543 2 7 2Z" stroke="url(#${gradientId})" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 18H12.01" stroke="url(#${gradientId})" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <defs>
                    <linearGradient id="${gradientId}" x1="5" y1="2" x2="19" y2="22" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stop-color="${colors.start}"/>
                        <stop offset="50%" stop-color="${colors.mid}"/>
                        <stop offset="100%" stop-color="${colors.end}"/>
                    </linearGradient>
                </defs>
            </svg>
        `;
    }
    
    // Обновляем градиент заголовка
    const headerTitle = document.querySelector('.header-text h1');
    if (headerTitle) {
        const gradients = {
            white: 'linear-gradient(90deg, #1F2937 0%, #4B5563 50%, #6B7280 100%)',
            black: 'linear-gradient(90deg, #FFFFFF 0%, #E5E7EB 50%, #9CA3AF 100%)',
            ocean: 'linear-gradient(90deg, #22D3EE 0%, #3B82F6 50%, #2563EB 100%)',
            sunset: 'linear-gradient(90deg, #F97316 0%, #EC4899 50%, #F43F5E 100%)',
            forest: 'linear-gradient(90deg, #34D399 0%, #14B8A6 50%, #16A34A 100%)',
            neon: 'linear-gradient(90deg, #A855F7 0%, #EC4899 50%, #06B6D4 100%)',
            royal: 'linear-gradient(90deg, #9333EA 0%, #4F46E5 50%, #7C3AED 100%)'
        };
        headerTitle.style.background = gradients[theme] || gradients.ocean;
        headerTitle.style.webkitBackgroundClip = 'text';
        headerTitle.style.webkitTextFillColor = 'transparent';
        headerTitle.style.backgroundClip = 'text';
    }
    
    // Обновляем иконку плюса для правильного цвета на всех темах
    const plusIcon = document.getElementById('nav-plus-icon');
    if (plusIcon && typeof Icons !== 'undefined') {
        // Плюсик всегда белый на всех темах
        plusIcon.innerHTML = Icons.Plus('#ffffff', 28);
    }
}

// Инициализация темы при загрузке (вызывается после загрузки DOM)

function openFiltersModal() {
    const modal = document.getElementById('filters-modal');
    if (modal) {
        // Инициализируем иконку фильтра
        const iconEl = document.getElementById('filters-modal-icon');
        if (iconEl && typeof Icons !== 'undefined') {
            iconEl.innerHTML = Icons.SlidersHorizontal('#9333ea', 24);
        }
        
        // Восстанавливаем выбранные фильтры
        restoreFilterChips();
        
        modal.style.display = 'block';
    }
}

function restoreFilterChips() {
    // Сбрасываем все чипы
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    
    // Восстанавливаем выбранные фильтры
    if (activeFilters.priceSegment && activeFilters.priceSegment.length > 0) {
        activeFilters.priceSegment.forEach(value => {
            const chip = document.querySelector(`.filter-chip[data-filter="price-segment"][data-value="${value}"]`);
            if (chip) chip.classList.add('active');
        });
    }
    
    if (activeFilters.storage && activeFilters.storage.length > 0) {
        activeFilters.storage.forEach(value => {
            const chip = document.querySelector(`.filter-chip[data-filter="storage"][data-value="${value}"]`);
            if (chip) chip.classList.add('active');
        });
    }
    
    if (activeFilters.ram && activeFilters.ram.length > 0) {
        activeFilters.ram.forEach(value => {
            const chip = document.querySelector(`.filter-chip[data-filter="ram"][data-value="${value}"]`);
            if (chip) chip.classList.add('active');
        });
    }
}

// Применение фильтров
function applyFilters() {
    // Собираем выбранные фильтры
    activeFilters = {
        priceSegment: [],
        storage: [],
        ram: []
    };
    
    // Собираем активные чипы
    document.querySelectorAll('.filter-chip.active').forEach(chip => {
        const filterType = chip.dataset.filter;
        const value = chip.dataset.value;
        
        if (filterType === 'price-segment') {
            activeFilters.priceSegment.push(value);
        } else if (filterType === 'storage') {
            activeFilters.storage.push(value);
        } else if (filterType === 'ram') {
            activeFilters.ram.push(value);
        }
    });
    
    // Закрываем модальное окно
    const modal = document.getElementById('filters-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Применяем фильтры
    filterListings();
    showListings();
    
    showSuccess('Фильтры применены');
}

// Очистка фильтров
function showHelp() {
    if (tg && tg.showPopup) {
        tg.showPopup({
            title: 'Помощь',
            message: 'Здесь будет информация о том, как пользоваться приложением.',
            buttons: [{ type: 'ok' }]
        });
    } else {
        alert('Помощь: Используйте навигацию внизу для перехода между разделами. Кнопка "+" создает новое объявление.');
    }
}

function clearFilters() {
    // Сбрасываем все чипы
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    
    // Сбрасываем активные фильтры
    activeFilters = {
        priceSegment: [],
        storage: [],
        ram: []
    };
    
    // Применяем фильтры (очищенные)
    filterListings();
    showListings();
    
    // Закрываем модалку
    const modal = document.getElementById('filters-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    showSuccess('Фильтры очищены');
}

function shareMyProfile() {
    if (!currentProfile?.publicId) {
        showError('Профиль ещё не инициализирован. Попробуйте перезапустить приложение.');
        return;
    }

    // Ссылка на Mini App бота с параметром startapp
    // Формат: https://t.me/bot_username?startapp=profile_XXXX
    let link = `https://t.me/${BOT_USERNAME}?startapp=profile_${encodeURIComponent(
        currentProfile.publicId
    )}`;

    const text = `Мой профиль на PhoneExchange: ${link}`;

    try {
        if (tg && tg.openTelegramLink) {
            const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
                link
            )}&text=${encodeURIComponent(text)}`;
            tg.openTelegramLink(shareUrl);
        } else {
            window.prompt('Скопируйте ссылку на ваш профиль:', link);
        }
    } catch (error) {
        console.error('Ошибка при попытке поделиться профилем:', error);
        window.prompt('Скопируйте ссылку на ваш профиль:', link);
    }
}

// Переключение видимости поля "На что хотите поменять"
function toggleDesiredPhoneInput() {
    const exchangeType = document.getElementById('exchange-type');
    const desiredPhoneInput = document.getElementById('desired-phone');
    
    if (exchangeType && desiredPhoneInput) {
        if (exchangeType.value === 'no') {
            desiredPhoneInput.style.display = 'none';
            desiredPhoneInput.removeAttribute('required');
            desiredPhoneInput.value = 'Не хочу меняться';
        } else {
            desiredPhoneInput.style.display = 'block';
            desiredPhoneInput.setAttribute('required', 'required');
            if (desiredPhoneInput.value === 'Не хочу меняться') {
                desiredPhoneInput.value = '';
            }
        }
    }
}

// Переключение видимости поля "На что хотите поменять" в форме редактирования
function toggleEditDesiredPhoneInput() {
    const exchangeType = document.getElementById('edit-exchange-type');
    const desiredPhoneInput = document.getElementById('edit-desired-phone');
    
    if (exchangeType && desiredPhoneInput) {
        if (exchangeType.value === 'no') {
            desiredPhoneInput.style.display = 'none';
            desiredPhoneInput.removeAttribute('required');
            desiredPhoneInput.value = 'Не хочу меняться';
        } else {
            desiredPhoneInput.style.display = 'block';
            desiredPhoneInput.setAttribute('required', 'required');
            if (desiredPhoneInput.value === 'Не хочу меняться') {
                desiredPhoneInput.value = '';
            }
        }
    }
}

// Редактирование объявления
let editingListingId = null;
let editSelectedPhotoFiles = [];

function editListing(listingId) {
    const listing = allListings.find(item => item.id === listingId);
    if (!listing) {
        showError('Объявление не найдено');
        return;
    }
    
    if (listing.userId !== currentUser?.id) {
        showError('Вы можете редактировать только свои объявления');
        return;
    }
    
    editingListingId = listingId;
    editSelectedPhotoFiles = [];
    
    // Заполняем форму
    document.getElementById('edit-phone-model').value = listing.phoneModel || '';
    document.getElementById('edit-phone-condition').value = listing.condition || '';
    document.getElementById('edit-phone-description').value = listing.description || '';
    document.getElementById('edit-phone-location').value = listing.location || '';
    document.getElementById('edit-phone-price').value = listing.price || '';
    document.getElementById('edit-phone-price-segment').value = listing.priceSegment || '';
    document.getElementById('edit-phone-storage').value = listing.storage || '';
    document.getElementById('edit-phone-ram').value = listing.ram || '';
    
    // Обработка обмена
    if (listing.desiredPhone === 'Не хочу меняться') {
        document.getElementById('edit-exchange-type').value = 'no';
        document.getElementById('edit-desired-phone').value = 'Не хочу меняться';
    } else {
        document.getElementById('edit-exchange-type').value = 'yes';
        document.getElementById('edit-desired-phone').value = listing.desiredPhone || '';
    }
    toggleEditDesiredPhoneInput();
    
    // Показываем текущие фото
    const images = Array.isArray(listing.images) && listing.images.length > 0
        ? listing.images
        : (listing.image ? [listing.image] : []);
    
    const previewList = document.getElementById('edit-photo-preview-list');
    previewList.innerHTML = '';
    images.forEach((img, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'photo-preview-item';
        previewItem.innerHTML = `
            <img src="${img}" alt="Фото ${index + 1}">
            <button type="button" class="photo-remove-btn" onclick="removeEditPhoto(${index})">×</button>
        `;
        previewList.appendChild(previewItem);
    });
    
    // Настройка загрузки новых фото
    const photoInput = document.getElementById('edit-phone-photo');
    photoInput.onchange = function(e) {
        const files = Array.from(e.target.files);
        editSelectedPhotoFiles = [...editSelectedPhotoFiles, ...files];
        updateEditPhotoPreview();
    };
    
    // Закрываем модальное окно объявления и открываем форму редактирования
    document.getElementById('listing-modal').style.display = 'none';
    document.getElementById('edit-listing-modal').style.display = 'block';
}

function removeEditPhoto(index) {
    const listing = allListings.find(item => item.id === editingListingId);
    if (!listing) return;
    
    const images = Array.isArray(listing.images) && listing.images.length > 0
        ? listing.images
        : (listing.image ? [listing.image] : []);
    
    images.splice(index, 1);
    listing.images = images;
    listing.image = images[0] || null;
    
    // Обновляем превью
    const previewList = document.getElementById('edit-photo-preview-list');
    previewList.innerHTML = '';
    images.forEach((img, idx) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'photo-preview-item';
        previewItem.innerHTML = `
            <img src="${img}" alt="Фото ${idx + 1}">
            <button type="button" class="photo-remove-btn" onclick="removeEditPhoto(${idx})">×</button>
        `;
        previewList.appendChild(previewItem);
    });
}

function updateEditPhotoPreview() {
    const previewList = document.getElementById('edit-photo-preview-list');
    const listing = allListings.find(item => item.id === editingListingId);
    
    if (!listing) return;
    
    const existingImages = Array.isArray(listing.images) && listing.images.length > 0
        ? listing.images
        : (listing.image ? [listing.image] : []);
    
    previewList.innerHTML = '';
    
    // Показываем существующие фото
    existingImages.forEach((img, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'photo-preview-item';
        previewItem.innerHTML = `
            <img src="${img}" alt="Фото ${index + 1}">
            <button type="button" class="photo-remove-btn" onclick="removeEditPhoto(${index})">×</button>
        `;
        previewList.appendChild(previewItem);
    });
    
    // Показываем новые фото
    editSelectedPhotoFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewItem = document.createElement('div');
            previewItem.className = 'photo-preview-item';
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="Новое фото ${index + 1}">
                <button type="button" class="photo-remove-btn" onclick="removeNewEditPhoto(${index})">×</button>
            `;
            previewList.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
}

function removeNewEditPhoto(index) {
    editSelectedPhotoFiles.splice(index, 1);
    updateEditPhotoPreview();
}

async function saveEditedListing() {
    if (!editingListingId) return;
    
    const listing = allListings.find(item => item.id === editingListingId);
    if (!listing || listing.userId !== currentUser?.id) {
        showError('Объявление не найдено или у вас нет прав на редактирование');
        return;
    }
    
    const phoneModel = document.getElementById('edit-phone-model')?.value.trim();
    const condition = document.getElementById('edit-phone-condition')?.value;
    const description = document.getElementById('edit-phone-description')?.value.trim();
    const location = document.getElementById('edit-phone-location')?.value.trim();
    const exchangeType = document.getElementById('edit-exchange-type')?.value || 'yes';
    const desiredPhone = exchangeType === 'yes' 
        ? (document.getElementById('edit-desired-phone')?.value.trim() || '')
        : 'Не хочу меняться';
    const price = document.getElementById('edit-phone-price')?.value ? parseInt(document.getElementById('edit-phone-price').value) : null;
    const priceSegment = document.getElementById('edit-phone-price-segment')?.value || null;
    const storage = document.getElementById('edit-phone-storage')?.value ? parseInt(document.getElementById('edit-phone-storage').value) : null;
    const ram = document.getElementById('edit-phone-ram')?.value ? parseInt(document.getElementById('edit-phone-ram').value) : null;
    
    // Валидация
    if (!phoneModel || !condition || !location) {
        showError('Заполните обязательные поля: модель, состояние и город!');
        return;
    }
    
    if (exchangeType === 'yes' && !desiredPhone) {
        showError('Укажите, на что хотите поменять!');
        return;
    }
    
    const submitBtn = document.getElementById('edit-submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';
    submitBtn.disabled = true;
    
    // Обрабатываем новые фото
    let newImagesData = [];
    if (editSelectedPhotoFiles.length > 0) {
        try {
            newImagesData = await Promise.all(
                editSelectedPhotoFiles.map(file => compressImage(file))
            );
        } catch (error) {
            console.error('Ошибка обработки новых фото:', error);
            showError('Не удалось обработать новые фото');
            btnText.style.display = 'block';
            btnLoading.style.display = 'none';
            submitBtn.disabled = false;
            return;
        }
    }
    
    // Объединяем существующие и новые фото
    const existingImages = Array.isArray(listing.images) && listing.images.length > 0
        ? listing.images
        : (listing.image ? [listing.image] : []);
    const allImages = [...existingImages, ...newImagesData];
    
    const updateData = {
        id: editingListingId,
        userId: currentUser.id,
        phoneModel,
        condition,
        description: description || 'Нет описания',
        desiredPhone,
        location,
        price: price,
        priceSegment,
        storage,
        ram,
        images: allImages,
        image: allImages[0] || null
    };
    
    try {
        const response = await fetch(`${API_URL}/listings`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Ошибка обновления объявления');
        }
        
        const result = await response.json();
        
        // Обновляем объявление в локальном массиве
        Object.assign(listing, updateData);
        
        // Обновляем отображение
        await loadListings();
        
        showSuccess('Объявление успешно обновлено!');
        closeEditListingModal();
        
        // Обновляем время последнего визита
        updateLastSeen();
        
        // Показываем обновленное объявление
        setTimeout(() => {
            showListingModal(editingListingId);
        }, 500);
        
    } catch (error) {
        console.error('Ошибка обновления объявления:', error);
        showError('Не удалось обновить объявление. Попробуйте еще раз.');
    } finally {
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
        submitBtn.disabled = false;
    }
}

function closeEditListingModal() {
    document.getElementById('edit-listing-modal').style.display = 'none';
    editingListingId = null;
    editSelectedPhotoFiles = [];
    document.getElementById('edit-listing-form').reset();
    document.getElementById('edit-photo-preview-list').innerHTML = '';
}

async function deleteListing(listingId) {
    if (!confirm('Вы уверены, что хотите удалить это объявление?')) {
        return;
    }
    
    const listing = allListings.find(item => item.id === listingId);
    if (!listing || listing.userId !== currentUser?.id) {
        showError('Объявление не найдено или у вас нет прав на удаление');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/listings`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: listingId,
                userId: currentUser.id
            })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка удаления объявления');
        }
        
        showSuccess('Объявление удалено');
        document.getElementById('listing-modal').style.display = 'none';
        await loadListings();
        
        // Обновляем время последнего визита
        updateLastSeen();
        
    } catch (error) {
        console.error('Ошибка удаления объявления:', error);
        showError('Не удалось удалить объявление');
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