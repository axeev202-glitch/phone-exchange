// Простое хранилище в памяти
let listings = [];

export default async function handler(req, res) {
  // Разрешаем все запросы (важно для Telegram Mini Apps)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Обрабатываем preflight запросы
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET - получить объявления
    if (req.method === 'GET') {
      console.log('GET listings:', listings.length);
      return res.status(200).json(listings);
    }

    // POST - создать объявление
    if (req.method === 'POST') {
      let body;
      
      // Обрабатываем разные форматы данных
      if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else {
        body = req.body;
      }
      
      console.log('POST body:', body);

      // Валидация обязательных полей
      if (!body.phoneModel || !body.condition || !body.desiredPhone) {
        return res.status(400).json({ 
          error: 'Missing required fields: phoneModel, condition, desiredPhone' 
        });
      }

      const newListing = {
        id: Date.now().toString(),
        phoneModel: body.phoneModel,
        condition: body.condition,
        description: body.description || 'Нет описания',
        desiredPhone: body.desiredPhone,
        location: body.location || 'Москва',
        timestamp: new Date().toISOString(),
        userId: body.userId || 'anonymous'
      };

      listings.unshift(newListing);
      console.log('New listing created:', newListing);
      
      return res.status(201).json({ 
        success: true, 
        listing: newListing,
        message: 'Объявление успешно создано!'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Server error: ' + error.message 
    });
  }
}