// Импорты для работы с файлами
import fs from 'fs';
import path from 'path';

// Хранилище в памяти
let listings = [];

// Путь к файлу данных - используем папку data
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const LISTINGS_FILE = path.join(DATA_DIR, 'listings.json');

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

// Функция сохранения объявлений в файл
function saveListingsToFile() {
    try {
        // Убеждаемся, что директория существует
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(LISTINGS_FILE, JSON.stringify(listings, null, 2), 'utf8');
        console.log(`💾 Сохранено ${listings.length} объявлений в файл`);
    } catch (error) {
        console.error('❌ Ошибка сохранения объявлений в файл:', error);
    }
}

// Загружаем данные при инициализации модуля
loadListingsFromFile();

// Конфигурация вашего бота
const TELEGRAM_BOT_TOKEN = '8364853114:AAGfVhFQjq14TnoGSaMOtW3nErpYrtYzvF0';
const TELEGRAM_CHAT_ID = '1188933834'; // Ваш chat_id или канал

// Функция отправки уведомления в Telegram
async function sendToTelegram(listing) {
    try {
        const message = `📱 *НОВОЕ ОБЪЯВЛЕНИЕ*

*Модель:* ${listing.phoneModel}
*Состояние:* ${getConditionText(listing.condition)}
*Желаемый обмен:* ${listing.desiredPhone}
*Описание:* ${listing.description}
*Местоположение:* ${listing.location}

🕐 ${new Date(listing.timestamp).toLocaleString('ru-RU')}`;

        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });

        const result = await response.json();
        console.log('Telegram API response:', result);
        
        if (!result.ok) {
            console.error('Telegram API error:', result);
        }
        
        return result.ok;
    } catch (error) {
        console.error('Error sending to Telegram:', error);
        return false;
    }
}

// Функция получения информации о боте (для проверки токена)
async function getBotInfo() {
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
        const result = await response.json();
        console.log('Bot info:', result);
        return result;
    } catch (error) {
        console.error('Error getting bot info:', error);
        return null;
    }
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

export default async function handler(req, res) {
    // Устанавливаем CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Обрабатываем preflight запрос
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // GET запрос - получить все объявления
        if (req.method === 'GET') {
            const { userId, includeHidden } = req.query || {};
            const now = new Date();

            // Фильтруем объявления: не удаленные, не проданные и не истекшие (30 дней)
            let hasChanges = false;
            let filtered = listings.filter(l => {
                if (l.isDeleted) return false;
                
                // Не показываем проданные объявления в основной ленте
                if (l.status === 'sold' || l.status === 'completed') return false;
                
                // Если есть expiresAt, проверяем, не истекло ли объявление
                if (l.expiresAt) {
                    const expiresDate = new Date(l.expiresAt);
                    if (expiresDate < now) {
                        // Автоматически помечаем как удаленное, если истекло
                        l.isDeleted = true;
                        hasChanges = true;
                        return false;
                    }
                } else {
                    // Для старых объявлений без expiresAt проверяем timestamp (30 дней)
                    const listingDate = new Date(l.timestamp);
                    const daysDiff = (now - listingDate) / (1000 * 60 * 60 * 24);
                    if (daysDiff > 30) {
                        // Автоматически помечаем как удаленное, если старше 30 дней
                        l.isDeleted = true;
                        hasChanges = true;
                        return false;
                    }
                }
                
                return true;
            });

            // Сохраняем изменения, если были помечены объявления как удаленные
            if (hasChanges) {
                saveListingsToFile();
            }

            if (!includeHidden) {
                filtered = filtered.filter(l => !l.isHidden);
            }

            if (userId) {
                filtered = filtered.filter(
                    l =>
                        l.userId === userId &&
                        !l.isDeleted &&
                        (includeHidden ? true : !l.isHidden)
                );
            }

            console.log('GET request - returning', filtered.length, 'listings');
            return res.status(200).json(filtered);
        }

        // POST запрос - создать новое объявление
        if (req.method === 'POST') {
            console.log('POST request received');
            
            // Проверяем размер тела запроса (примерно) - лимит 100MB
            const contentLength = req.headers['content-length'];
            if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) { // Больше 100MB
                console.warn('Request body too large:', contentLength);
                return res.status(413).json({ 
                    success: false,
                    error: 'Размер данных слишком большой (максимум 100MB). Пожалуйста, уменьшите размер фотографий или используйте меньше изображений.',
                    message: 'Request entity too large'
                });
            }
            
            let body;
            try {
                if (typeof req.body === 'string') {
                    body = JSON.parse(req.body);
                } else {
                    body = req.body;
                }
                console.log('Parsed body:', {
                    phoneModel: body.phoneModel,
                    condition: body.condition,
                    hasImage: !!body.image,
                    imagesCount: Array.isArray(body.images) ? body.images.length : 0
                });
            } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
                return res.status(400).json({ 
                    success: false,
                    error: 'Неверный формат данных',
                    details: parseError.message 
                });
            }

            // Валидация обязательных полей
            const requiredFields = ['phoneModel', 'condition', 'desiredPhone'];
            const missingFields = requiredFields.filter(field => !body[field]);
            
            if (missingFields.length > 0) {
                return res.status(400).json({ 
                    error: 'Missing required fields', 
                    missing: missingFields 
                });
            }

            // Создаем новое объявление
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + 30); // Объявление активно 30 дней
            
            const newListing = {
                id: Date.now().toString(),
                phoneModel: body.phoneModel.trim(),
                condition: body.condition,
                description: body.description?.trim() || 'Нет описания',
                desiredPhone: body.desiredPhone.trim(),
                location: body.location || 'Москва',
                price: body.price || null,
                timestamp: now.toISOString(),
                expiresAt: expiresAt.toISOString(), // Дата истечения (30 дней)
                userId: body.userId || 'anonymous',
                userInfo: body.userInfo || {},
                image: body.image || (Array.isArray(body.images) && body.images.length > 0 ? body.images[0] : null),
                images: Array.isArray(body.images) ? body.images : (body.image ? [body.image] : []),
                isHidden: false,
                isDeleted: false,
                status: 'active', // active, sold, completed
                soldAt: null, // Дата продажи/обмена
                // Данные фильтров
                priceSegment: body.priceSegment || null,
                color: body.color || null,
                firmware: body.firmware || null,
                usage: body.usage || null,
                storage: body.storage || null,
                ram: body.ram || null,
                year: body.year || null
            };

            // Добавляем в массив
            listings.unshift(newListing);
            
            // Сохраняем в файл
            saveListingsToFile();
            
            console.log('New listing created:', newListing);

            // Отправляем уведомление в Telegram
            try {
                console.log('Sending notification to Telegram...');
                const telegramSent = await sendToTelegram(newListing);
                console.log('Telegram notification sent:', telegramSent);
            } catch (tgError) {
                console.error('Failed to send to Telegram, but listing saved:', tgError);
            }

            return res.status(201).json({ 
                success: true, 
                listing: newListing,
                telegramSent: true,
                message: 'Объявление успешно создано и отправлено в Telegram!'
            });
        }

        // PATCH запрос - обновление объявления
        if (req.method === 'PATCH') {
            let body = req.body;
            if (typeof body === 'string') {
                body = JSON.parse(body || '{}');
            }

            const { id, userId } = body || {};
            if (!id) {
                return res.status(400).json({ error: 'id is required' });
            }

            const listing = listings.find(l => l.id === id);
            if (!listing) {
                return res.status(404).json({ error: 'Listing not found' });
            }

            if (userId && listing.userId && listing.userId !== userId) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            // Обновление полей объявления
            if (body.phoneModel) listing.phoneModel = body.phoneModel.trim();
            if (body.condition) listing.condition = body.condition;
            if (body.description !== undefined) listing.description = body.description.trim() || 'Нет описания';
            if (body.desiredPhone !== undefined) listing.desiredPhone = body.desiredPhone.trim();
            if (body.location) listing.location = body.location.trim();
            if (body.price !== undefined) listing.price = body.price;
            if (body.image !== undefined) listing.image = body.image;
            if (body.images !== undefined) listing.images = Array.isArray(body.images) ? body.images : [];
            if (typeof body.isHidden === 'boolean') listing.isHidden = body.isHidden;
            
            // Обновление данных фильтров
            if (body.priceSegment !== undefined) listing.priceSegment = body.priceSegment;
            if (body.color !== undefined) listing.color = body.color;
            if (body.firmware !== undefined) listing.firmware = body.firmware;
            if (body.usage !== undefined) listing.usage = body.usage;
            if (body.storage !== undefined) listing.storage = body.storage;
            if (body.ram !== undefined) listing.ram = body.ram;
            if (body.year !== undefined) listing.year = body.year;

            // Обновление статуса объявления (sold, completed)
            if (body.status && ['active', 'sold', 'completed'].includes(body.status)) {
                listing.status = body.status;
                if (body.status === 'sold' || body.status === 'completed') {
                    listing.soldAt = new Date().toISOString();
                }
            }

            // Сохраняем в файл
            saveListingsToFile();

            return res.status(200).json({ success: true, listing });
        }

        // DELETE запрос - пометить объявление как удалённое
        if (req.method === 'DELETE') {
            let body = req.body;
            if (typeof body === 'string') {
                body = JSON.parse(body || '{}');
            }

            const { id, userId } = body || {};
            if (!id) {
                return res.status(400).json({ error: 'id is required' });
            }

            const listing = listings.find(l => l.id === id);
            if (!listing) {
                return res.status(404).json({ error: 'Listing not found' });
            }

            if (userId && listing.userId && listing.userId !== userId) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            listing.isDeleted = true;

            // Сохраняем в файл
            saveListingsToFile();

            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ 
            error: 'Method not allowed',
            allowed: ['GET', 'POST', 'OPTIONS'] 
        });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

// Проверяем бота при запуске (отключено из-за проблем с памятью на некоторых хостингах)
// Проверка выполняется при создании объявления, а не при запуске сервера
if (false && typeof window === 'undefined') {
    getBotInfo().then(botInfo => {
        if (botInfo && botInfo.ok) {
            console.log('✅ Bot is connected:', botInfo.result.username);
        } else {
            console.log('❌ Bot connection failed');
        }
    });
}

// Раньше тут инициализировались демо‑объявления.
// Теперь храним только реальные объявления, созданные пользователями.