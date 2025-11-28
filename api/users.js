// Импорты для работы с файлами
import fs from 'fs';
import path from 'path';

// Простое хранилище профилей пользователей в памяти
let users = [];

// Путь к файлу данных (для Vercel используем /tmp, для локальной разработки - корень проекта)
const DATA_DIR = process.env.VERCEL ? '/tmp' : process.cwd();
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Функция загрузки профилей из файла
function loadUsersFromFile() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            const loaded = JSON.parse(data);
            users = Array.isArray(loaded) ? loaded : [];
            console.log(`✅ Загружено ${users.length} профилей из файла`);
        } else {
            users = [];
            console.log('📝 Файл профилей не найден, создан новый массив');
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки профилей из файла:', error);
        users = [];
    }
}

// Функция сохранения профилей в файл
function saveUsersToFile() {
    try {
        // Убеждаемся, что директория существует
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
        console.log(`💾 Сохранено ${users.length} профилей в файл`);
    } catch (error) {
        console.error('❌ Ошибка сохранения профилей в файл:', error);
    }
}

// Загружаем данные при инициализации модуля
loadUsersFromFile();

function generatePublicId() {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let id = 'PE-';
    for (let i = 0; i < 6; i++) {
        id += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return id;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Получить профиль по telegramId или publicId
        if (req.method === 'GET') {
            const { telegramId, publicId } = req.query || {};
            if (!telegramId && !publicId) {
                return res.status(400).json({ error: 'telegramId or publicId is required' });
            }

            const profile = users.find(
                u =>
                    (telegramId && u.telegramId === telegramId) ||
                    (publicId && u.publicId === publicId)
            );

            if (!profile) {
                return res.status(404).json({ error: 'Profile not found' });
            }

            return res.status(200).json(profile);
        }

        // Создание / инициализация профиля и добавление отзывов
        if (req.method === 'POST' || req.method === 'PATCH') {
            let body = req.body;
            if (typeof body === 'string') {
                body = JSON.parse(body || '{}');
            }

            const { action } = body;

            // Инициализация / обновление профиля по Telegram
            if (!action || action === 'init') {
                const { telegramId, username, name, avatar } = body;
                if (!telegramId) {
                    return res.status(400).json({ error: 'telegramId is required' });
                }

                let profile = users.find(u => u.telegramId === telegramId);

                if (!profile) {
                    console.log(`🆕 Создание нового профиля для пользователя: ${telegramId}`);
                    profile = {
                        id: Date.now().toString(),
                        telegramId,
                        username: username || null,
                        name: name || null,
                        about: '',
                        avatar: avatar || null,
                        rating: 0,
                        reviews: [],
                        salesCount: 0, // Счетчик продаж/обменов
                        createdAt: new Date().toISOString(),
                        lastSeenAt: new Date().toISOString(),
                        publicId: generatePublicId()
                    };
                    users.push(profile);
                    console.log(`✅ Новый профиль создан:`, {
                        telegramId: profile.telegramId,
                        publicId: profile.publicId,
                        name: profile.name,
                        username: profile.username
                    });
                } else {
                    console.log(`🔄 Обновление существующего профиля: ${telegramId}`);
                    // Обновляем данные профиля, если они изменились
                    if (username) profile.username = username;
                    if (name) profile.name = name;
                    if (avatar) profile.avatar = avatar;
                    profile.lastSeenAt = new Date().toISOString();
                    // Инициализируем salesCount если его нет
                    if (typeof profile.salesCount !== 'number') {
                        profile.salesCount = 0;
                    }
                }

                // Сохраняем в файл
                saveUsersToFile();

                return res.status(200).json(profile);
            }

            // Обновление описания профиля
            if (action === 'update_about') {
                const { telegramId, about, avatar } = body;
                if (!telegramId) {
                    return res.status(400).json({ error: 'telegramId is required' });
                }

                const profile = users.find(u => u.telegramId === telegramId);
                if (!profile) {
                    return res.status(404).json({ error: 'Profile not found' });
                }

                profile.about = (about || '').trim();
                if (avatar) {
                    profile.avatar = avatar;
                }
                profile.lastSeenAt = new Date().toISOString();

                // Сохраняем в файл
                saveUsersToFile();

                return res.status(200).json(profile);
            }

            // Добавление отзыва пользователю
            if (action === 'add_review') {
                const {
                    targetTelegramId,
                    targetPublicId,
                    authorTelegramId,
                    authorUsername,
                    rating,
                    text
                } = body;

                if (!targetTelegramId && !targetPublicId) {
                    return res.status(400).json({ error: 'targetTelegramId or targetPublicId is required' });
                }
                if (!authorTelegramId) {
                    return res.status(400).json({ error: 'authorTelegramId is required' });
                }

                const profile = users.find(
                    u =>
                        (targetTelegramId && u.telegramId === targetTelegramId) ||
                        (targetPublicId && u.publicId === targetPublicId)
                );

                if (!profile) {
                    return res.status(404).json({ error: 'Target profile not found' });
                }

                const review = {
                    id: Date.now().toString(),
                    rating: typeof rating === 'number' ? rating : 5,
                    text: (text || '').trim(),
                    authorTelegramId,
                    authorUsername: authorUsername || null,
                    createdAt: new Date().toISOString()
                };

                profile.reviews.unshift(review);

                // Пересчёт среднего рейтинга
                if (profile.reviews.length > 0) {
                    const sum = profile.reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
                    profile.rating = Math.round((sum / profile.reviews.length) * 10) / 10;
                }

                // Сохраняем в файл
                saveUsersToFile();

                return res.status(200).json(profile);
            }

            return res.status(400).json({ error: 'Unknown action' });
        }

        return res.status(405).json({
            error: 'Method not allowed',
            allowed: ['GET', 'POST', 'PATCH', 'OPTIONS']
        });
    } catch (error) {
        console.error('Users API error:', error);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
}


