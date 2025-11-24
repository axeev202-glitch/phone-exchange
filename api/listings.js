// Временное хранилище (при перезапуске сервера данные очищаются)
let listings = [];

export default async function handler(req, res) {
  // Разрешаем запросы от любого источника
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Отдаем все активные объявления
      const activeListings = listings.filter(listing => listing.status === 'active');
      return res.json(activeListings);
    }

    if (req.method === 'POST') {
      // Создаем новое объявление
      const newListing = {
        id: Date.now(),
        ...req.body,
        timestamp: new Date().toISOString(),
        status: 'active'
      };
      listings.unshift(newListing);
      return res.json({ success: true, listing: newListing });
    }

    if (req.method === 'DELETE') {
      // Удаляем объявление (помечаем как неактивное)
      const { id } = req.query;
      const listingIndex = listings.findIndex(l => l.id === parseInt(id));
      
      if (listingIndex !== -1) {
        listings[listingIndex].status = 'inactive';
        return res.json({ success: true });
      }
      return res.status(404).json({ success: false });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
