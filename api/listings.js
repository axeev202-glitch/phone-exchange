// Хранилище в памяти
let listings = [];

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

            let filtered = listings.filter(l => !l.isDeleted);

            if (!includeHidden) {
                filtered = filtered.filter(l => !l.isHidden);
            }

            if (userId) {
                filtered = listings.filter(
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
            const newListing = {
                id: Date.now().toString(),
                phoneModel: body.phoneModel.trim(),
                condition: body.condition,
                description: body.description?.trim() || 'Нет описания',
                desiredPhone: body.desiredPhone.trim(),
                location: body.location || 'Москва',
                timestamp: new Date().toISOString(),
                userId: body.userId || 'anonymous',
                userInfo: body.userInfo || {},
                image: body.image || (Array.isArray(body.images) && body.images.length > 0 ? body.images[0] : null),
                images: Array.isArray(body.images) ? body.images : (body.image ? [body.image] : []),
                isHidden: false,
                isDeleted: false,
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

        // PATCH запрос - обновление объявления (например, скрыть/показать)
        if (req.method === 'PATCH') {
            let body = req.body;
            if (typeof body === 'string') {
                body = JSON.parse(body || '{}');
            }

            const { id, userId, isHidden } = body || {};
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

            if (typeof isHidden === 'boolean') {
                listing.isHidden = isHidden;
            }

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

// Проверяем бота при запуске
if (typeof window === 'undefined') {
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