// Простое хранилище в памяти
let listings = [];

export default async function handler(req, res) {
  // Разрешаем все запросы
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET - получить объявления
    if (req.method === 'GET') {
      return res.json(listings);
    }

    // POST - создать объявление
    if (req.method === 'POST') {
      const body = req.body;
      
      const newListing = {
        id: Date.now(),
        phoneModel: body.phoneModel,
        condition: body.condition,
        description: body.description,
        desiredPhone: body.desiredPhone,
        location: body.location || 'Москва',
        timestamp: new Date().toISOString()
      };

      listings.unshift(newListing);
      
      return res.json({ success: true, listing: newListing });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}