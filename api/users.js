// Простое хранилище профилей пользователей в памяти
let users = [];

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
                const { telegramId, username, name } = body;
                if (!telegramId) {
                    return res.status(400).json({ error: 'telegramId is required' });
                }

                let profile = users.find(u => u.telegramId === telegramId);

                if (!profile) {
                    profile = {
                        id: Date.now().toString(),
                        telegramId,
                        username: username || null,
                        name: name || null,
                        about: '',
                        rating: 5.0,
                        reviews: [],
                        createdAt: new Date().toISOString(),
                        lastSeenAt: new Date().toISOString(),
                        publicId: generatePublicId()
                    };
                    users.push(profile);
                } else {
                    profile.username = username || profile.username;
                    profile.name = name || profile.name;
                    profile.lastSeenAt = new Date().toISOString();
                }

                return res.status(200).json(profile);
            }

            // Обновление описания профиля
            if (action === 'update_about') {
                const { telegramId, about } = body;
                if (!telegramId) {
                    return res.status(400).json({ error: 'telegramId is required' });
                }

                const profile = users.find(u => u.telegramId === telegramId);
                if (!profile) {
                    return res.status(404).json({ error: 'Profile not found' });
                }

                profile.about = (about || '').trim();
                profile.lastSeenAt = new Date().toISOString();

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


