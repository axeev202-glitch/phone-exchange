import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Порт из переменной окружения (хостинг устанавливает автоматически)
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Логирование всех запросов для отладки
app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/www/api/')) {
        console.log(`🔵 API ${req.method} ${req.path}`);
        console.log(`   Query:`, req.query);
        if (req.body && Object.keys(req.body).length > 0) {
            const bodyPreview = JSON.stringify(req.body).substring(0, 200);
            console.log(`   Body: ${bodyPreview}...`);
        }
    } else {
        console.log(`📥 ${req.method} ${req.path}`);
    }
    next();
});

// Статические файлы - сначала проверяем корень, потом public (для совместимости)
// Если файлы в корне www/ - используем корень, иначе public/
// ВАЖНО: Статические файлы должны быть ПОСЛЕ API routes, но ПЕРЕД catch-all маршрутом
const rootPath = __dirname;
const publicPath = path.join(__dirname, 'public');

// Проверяем, где находятся статические файлы
const indexPath = fs.existsSync(path.join(rootPath, 'index.html')) 
    ? rootPath 
    : (fs.existsSync(path.join(publicPath, 'index.html')) ? publicPath : rootPath);

// Импортируем API handlers
import usersHandler from './api/users.js';
import listingsHandler from './api/listings.js';
import adminUsersHandler from './api/admin/users.js';

console.log('✅ API handlers загружены');
console.log('   - usersHandler:', typeof usersHandler);
console.log('   - listingsHandler:', typeof listingsHandler);
console.log('   - adminUsersHandler:', typeof adminUsersHandler);

// Адаптер для преобразования Express запросов в формат API handlers
function createApiAdapter(handler) {
    return async (req, res) => {
        // Преобразуем Express req/res в формат API handlers
        const apiReq = {
            method: req.method,
            query: req.query,
            body: req.body,
            headers: req.headers
        };
        
        const apiRes = {
            status: (code) => {
                res.status(code);
                return apiRes;
            },
            json: (data) => res.json(data),
            setHeader: (name, value) => res.setHeader(name, value),
            end: () => res.end()
        };
        
        try {
            await handler(apiReq, apiRes);
        } catch (error) {
            console.error('Handler error:', error);
            res.status(500).json({ error: 'Internal server error', message: error.message });
        }
    };
}

// API Routes - ПЕРЕД статическими файлами и другими маршрутами!
// Поддерживаем как с префиксом /www, так и без него
app.use('/api/users', createApiAdapter(usersHandler));
app.use('/api/listings', createApiAdapter(listingsHandler));
app.use('/api/admin/users', createApiAdapter(adminUsersHandler));

// Также поддерживаем пути с префиксом /www (для случая, когда URI = /www)
app.use('/www/api/users', createApiAdapter(usersHandler));
app.use('/www/api/listings', createApiAdapter(listingsHandler));
app.use('/www/api/admin/users', createApiAdapter(adminUsersHandler));

console.log('✅ API routes зарегистрированы:');
console.log('   - /api/users, /www/api/users');
console.log('   - /api/listings, /www/api/listings');
console.log('   - /api/admin/users, /www/api/admin/users');

// Статические файлы ПОСЛЕ API routes
app.use(express.static(indexPath, {
    maxAge: '1d', // Кэширование статических файлов
    etag: true
}));

// Главная страница - отдаем index.html
app.get('/', (req, res) => {
    // Сначала проверяем корень, потом public
    let indexPath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(indexPath)) {
        indexPath = path.join(__dirname, 'public', 'index.html');
    }
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Файл index.html не найден');
    }
});

// Страница админки
app.get('/admin', (req, res) => {
    // Сначала проверяем корень, потом public
    let adminPath = path.join(__dirname, 'admin.html');
    if (!fs.existsSync(adminPath)) {
        adminPath = path.join(__dirname, 'public', 'admin.html');
    }
    
    if (fs.existsSync(adminPath)) {
        res.sendFile(adminPath);
    } else {
        res.status(404).send('Файл admin.html не найден');
    }
});

// Обработка всех остальных маршрутов - отдаем index.html (для SPA)
// ВАЖНО: Этот маршрут должен быть ПОСЛЕДНИМ и НЕ перехватывать API запросы
app.get('*', (req, res) => {
    // Пропускаем API запросы - они уже обработаны выше
    if (req.path.startsWith('/api/') || req.path.startsWith('/www/api/')) {
        // Если дошли сюда - значит API route не сработал, возвращаем 404
        res.status(404).json({ error: 'API endpoint not found', path: req.path });
        return;
    }
    
    // Для всех остальных - отдаем index.html
    // Сначала проверяем корень, потом public
    let indexPath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(indexPath)) {
        indexPath = path.join(__dirname, 'public', 'index.html');
    }
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Страница не найдена');
    }
});

// Создаем директорию для данных, если её нет
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`✅ Создана директория для данных: ${dataDir}`);
}

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📁 Рабочая директория: ${__dirname}`);
    console.log(`🌐 Статические файлы из: ${indexPath}`);
    console.log(`💾 Данные сохраняются в: ${dataDir}`);
    console.log(`✅ Сервер готов к работе!`);
});

