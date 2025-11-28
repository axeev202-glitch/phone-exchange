// Импорты для работы с файлами
import fs from 'fs';
import path from 'path';

// Простое хранилище профилей пользователей в памяти
let users = [];
let listings = [];

// Путь к файлу данных (для Vercel используем /tmp, для локальной разработки - корень проекта)
// Используем тот же файл, что и основной API users.js
const DATA_DIR = process.env.VERCEL ? '/tmp' : process.cwd();
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LISTINGS_FILE = path.join(DATA_DIR, 'listings.json');

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

// Функция загрузки объявлений из файла
function loadListingsFromFile() {
    try {
        if (fs.existsSync(LISTINGS_FILE)) {
            const data = fs.readFileSync(LISTINGS_FILE, 'utf8');
            const loaded = JSON.parse(data);
            listings = Array.isArray(loaded) ? loaded : [];
            console.log(`✅ Загружено ${listings.length} объявлений из файла`);
        } else {
            listings = [];
            console.log('📝 Файл объявлений не найден, создан новый массив');
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки объявлений из файла:', error);
        listings = [];
    }
}

// Загружаем данные при инициализации модуля
loadUsersFromFile();
loadListingsFromFile();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Перезагружаем данные из файла перед каждым запросом
        // Важно: делаем это синхронно, чтобы данные были актуальными
        loadUsersFromFile();
        loadListingsFromFile();
        
        console.log(`📊 Админ-панель: Загружено ${users.length} пользователей, ${listings.length} объявлений`);
        console.log(`📁 Путь к файлу пользователей: ${USERS_FILE}`);
        console.log(`📁 Файл пользователей существует: ${fs.existsSync(USERS_FILE)}`);
        
        // Проверяем содержимое файла напрямую
        if (fs.existsSync(USERS_FILE)) {
            try {
                const fileContent = fs.readFileSync(USERS_FILE, 'utf8');
                const fileData = JSON.parse(fileContent);
                console.log(`📄 В файле напрямую: ${Array.isArray(fileData) ? fileData.length : 'не массив'} пользователей`);
                if (Array.isArray(fileData) && fileData.length > 0) {
                    console.log(`👤 Первый пользователь в файле:`, {
                        telegramId: fileData[0].telegramId,
                        name: fileData[0].name,
                        publicId: fileData[0].publicId
                    });
                }
            } catch (fileError) {
                console.error('❌ Ошибка чтения файла напрямую:', fileError);
            }
        }
        
        if (users.length > 0) {
            console.log(`👤 Пример пользователя из памяти:`, {
                telegramId: users[0].telegramId,
                name: users[0].name,
                publicId: users[0].publicId,
                createdAt: users[0].createdAt
            });
        } else {
            console.warn('⚠️ Массив users пуст после загрузки!');
        }

        if (req.method === 'GET') {
            const { page = 1, limit = 50, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query || {};
            
            // Обогащаем пользователей информацией об объявлениях
            const enrichedUsers = users.map(user => {
                const userListings = listings.filter(l => l.userId === user.telegramId);
                const activeListings = userListings.filter(l => !l.isDeleted && !l.isHidden && l.status === 'active');
                const deletedListings = userListings.filter(l => l.isDeleted === true);
                const soldListings = userListings.filter(l => l.status === 'sold' || l.status === 'completed');
                
                return {
                    ...user,
                    listingsStats: {
                        total: userListings.length,
                        active: activeListings.length,
                        deleted: deletedListings.length,
                        sold: soldListings.length
                    }
                };
            });
            
            let filteredUsers = [...enrichedUsers];
            
            // Поиск по имени, username, telegramId или publicId
            if (search) {
                const searchLower = search.toLowerCase();
                filteredUsers = filteredUsers.filter(user => 
                    (user.name && user.name.toLowerCase().includes(searchLower)) ||
                    (user.username && user.username.toLowerCase().includes(searchLower)) ||
                    (user.telegramId && user.telegramId.toString().includes(searchLower)) ||
                    (user.publicId && user.publicId.toLowerCase().includes(searchLower))
                );
            }
            
            // Сортировка
            filteredUsers.sort((a, b) => {
                let aVal = a[sortBy] || '';
                let bVal = b[sortBy] || '';
                
                if (sortBy === 'createdAt' || sortBy === 'lastSeenAt') {
                    aVal = new Date(aVal).getTime();
                    bVal = new Date(bVal).getTime();
                }
                
                if (sortOrder === 'asc') {
                    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                } else {
                    return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
                }
            });
            
            // Пагинация
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const startIndex = (pageNum - 1) * limitNum;
            const endIndex = startIndex + limitNum;
            const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
            
            // Статистика
            const stats = {
                total: enrichedUsers.length, // Общее количество всех пользователей
                filtered: filteredUsers.length, // Количество после фильтрации
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(filteredUsers.length / limitNum)
            };
            
            return res.status(200).json({
                users: paginatedUsers,
                stats
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('❌ Ошибка в admin/users API:', error);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
}

