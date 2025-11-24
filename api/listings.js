// Глобальное хранилище (в памяти)
let listings = [];

export default function handler(req, res) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Обработка preflight запроса
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET - получить все объявления
    if (req.method === 'GET') {
      const activeListings = listings.filter(item => item.status === 'active');
      console.log(`GET: Returning ${activeListings.length} listings`);
      return res.status(200).json(activeListings);
    }

    // POST - создать новое объявление
    if (req.method === 'POST') {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      const newListing = {
        id: Date.now(),
        userId: data.userId,
        userName: data.userName,
        userRating: data.userRating || 5.0,
        phoneModel: data.phoneModel,
        condition: data.condition,
        conditionText: data.conditionText,
        description: data.description,
        desiredPhone: data.desiredPhone,
        location: data.location,
        status: 'active',
        timestamp: new Date().toISOString(),
        isUserCreated: true
      };

      listings.unshift(newListing);
      console.log(`POST: Created listing ${newListing.id}`);
      
      return res.status(200).json({ 
        success: true, 
        listing: newListing 
      });
    }

    // DELETE - удалить объявление
    if (req.method === 'DELETE') {
      const { id } = req.query;
      const listingIndex = listings.findIndex(item => item.id === parseInt(id));
      
      if (listingIndex !== -1) {
        listings[listingIndex].status = 'inactive';
        console.log(`DELETE: Deactivated listing ${id}`);
        return res.status(200).json({ success: true });
      }
      
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    // Метод не поддерживается
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}