// Хранилище в памяти
let listings = [];

// Конфигурация вашего бота
const TELEGRAM_BOT_TOKEN = '8364853114:AAGfVhFQjq14TnoGSaMOtW3nErpYrtYzvF0';
const TELEGRAM_CHAT_ID = '1188933834';

// Функция получения информации о боте
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

// Функция для проверки и настройки бота
async function setupBot() {
    try {
        const botInfo = await getBotInfo();
        if (!botInfo || !botInfo.ok) {
            console.error('❌ Bot token is invalid');
            return false;
        }
        
        console.log('✅ Bot connected:', botInfo.result.username);
        return true;
    } catch (error) {
        console.error('Error setting up bot:', error);
        return false;
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

// Улучшенная функция отправки уведомления в Telegram
async function sendToTelegram(listing) {
    try {
        const message = `📱 *НОВОЕ ОБЪЯВЛЕНИЕ*

*Модель:* ${listing.phoneModel}
*Состояние:* ${getConditionText(listing.condition)}
*Желаемый обмен:* ${listing.desiredPhone}
*Описание:* ${listing.description}
*Местоположение:* ${listing.location}
*Пользователь:* ${listing.userId || 'Аноним'}

🕐 ${new Date(listing.timestamp).toLocaleString('ru-RU')}

#обмен #${listing.phoneModel.replace(/\s+/g, '')}`;

        console.log('Sending to Telegram, chat_id:', TELEGRAM_CHAT_ID);
        
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
        console.log('Telegram API full response:', result);
        
        if (result.ok) {
            console.log('✅ Message sent successfully to Telegram');
            return true;
        } else {
            console.error('❌ Telegram API error:', result.description);
            // Пробуем отправить простое сообщение без Markdown
            return await sendSimpleTelegramMessage(listing);
        }
    } catch (error) {
        console.error('Error sending to Telegram:', error);
        return await sendSimpleTelegramMessage(listing);
    }
}

// Запасная функция для отправки простого сообщения
async function sendSimpleTelegramMessage(listing) {
    try {
        const simpleMessage = `📱 НОВОЕ ОБЪЯВЛЕНИЕ

Модель: ${listing.phoneModel}
Состояние: ${getConditionText(listing.condition)}
Желаемый обмен: ${listing.desiredPhone}
Описание: ${listing.description}
Местоположение: ${listing.location}

${new Date(listing.timestamp).toLocaleString('ru-RU')}`;

        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: simpleMessage
            })
        });

        const result = await response.json();
        return result.ok;
    } catch (error) {
        console.error('Error sending simple message:', error);
        return false;
    }
}

// Функция для получения обновлений бота (для отладки)
async function getBotUpdates() {
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`);
        const result = await response.json();
        console.log('Bot updates (last 10):', result.result?.slice(-10));
        return result;
    } catch (error) {
        console.error('Error getting bot updates:', error);
        return null;
    }
}

export default async function handler(req, res) {
    // Устанавливаем CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Обрабатываем preflight запрос
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // GET запрос - получить все объявления
        if (req.method === 'GET') {
            console.log('GET request - returning', listings.length, 'listings');
            return res.status(200).json(listings);
        }

        // POST запрос - создать новое объявление
        if (req.method === 'POST') {
            console.log('POST request received');
            
            let body;
            try {
                if (typeof req.body === 'string') {
                    body = JSON.parse(req.body);
                } else {
                    body = req.body;
                }
                console.log('Parsed body:', body);
            } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
                return res.status(400).json({ 
                    error: 'Invalid JSON format',
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
                userInfo: body.userInfo || {}
            };

            // Добавляем в массив
            listings.unshift(newListing);
            
            console.log('New listing created:', newListing);

            // Отправляем уведомление в Telegram
            let telegramSent = false;
            let telegramError = null;
            
            try {
                console.log('Sending notification to Telegram...');
                telegramSent = await sendToTelegram(newListing);
                
                if (telegramSent) {
                    console.log('✅ Telegram notification sent successfully');
                } else {
                    console.log('❌ Failed to send Telegram notification');
                    telegramError = 'Failed to send to Telegram';
                }
            } catch (tgError) {
                console.error('Error sending to Telegram:', tgError);
                telegramError = tgError.message;
            }

            return res.status(201).json({ 
                success: true, 
                listing: newListing,
                telegramSent: telegramSent,
                telegramError: telegramError,
                message: telegramSent 
                    ? 'Объявление успешно создано и отправлено в Telegram!' 
                    : 'Объявление создано, но не отправлено в Telegram'
            });
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

// Проверяем и настраиваем бота при запуске
if (typeof window === 'undefined') {
    setupBot().then(success => {
        if (success) {
            console.log('✅ Bot setup completed successfully');
            // Отправляем тестовое сообщение при запуске
            sendSimpleTelegramMessage({
                phoneModel: 'Test Phone',
                condition: 'excellent',
                description: 'Тестовое сообщение при запуске',
                desiredPhone: 'Any Phone',
                location: 'Test Location',
                timestamp: new Date().toISOString(),
                userId: 'system'
            }).then(sent => {
                if (sent) {
                    console.log('✅ Test message sent successfully');
                } else {
                    console.log('❌ Test message failed');
                }
            });
        } else {
            console.log('❌ Bot setup failed - check token and chat_id');
            getBotUpdates(); // Получаем обновления для отладки
        }
    });
}

// Демо данные для разработки
if (process.env.NODE_ENV !== 'production' && listings.length === 0) {
    listings = [
        {
            id: '1',
            phoneModel: 'iPhone 14 Pro',
            condition: 'excellent',
            description: 'Отличное состояние, батарея 95%',
            desiredPhone: 'Samsung S23',
            location: 'Москва',
            timestamp: new Date().toISOString(),
            userId: 'demo_user'
        },
        {
            id: '2',
            phoneModel: 'Samsung Galaxy S23',
            condition: 'new',
            description: 'Новый, в коробке, не распакован',
            desiredPhone: 'iPhone 15 Pro',
            location: 'Санкт-Петербург',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            userId: 'demo_user_2'
        }
    ];
    console.log('Demo data loaded:', listings.length, 'listings');
}