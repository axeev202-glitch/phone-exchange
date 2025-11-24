// Хранилище в памяти (в продакшене используйте базу данных)
let listings = [];

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
        // Парсим тело запроса
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
        userId: body.userId || 'anonymous'
      };

      // Добавляем в массив
      listings.unshift(newListing);
      
      console.log('New listing created:', newListing);
      console.log('Total listings now:', listings.length);

      return res.status(201).json({ 
        success: true, 
        listing: newListing,
        message: 'Объявление успешно создано!'
      });
    }

    // Метод не поддерживается
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

// Для разработки - добавляем тестовые данные
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
      phoneModel: 'Xiaomi Redmi Note 12',
      condition: 'good',
      description: 'Хорошее состояние, есть чехол',
      desiredPhone: 'iPhone 12',
      location: 'Санкт-Петербург',
      timestamp: new Date().toISOString(),
      userId: 'demo_user2'
    }
  ];
}