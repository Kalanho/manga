import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { scrapePage } from './services/scraper';
import sharp from 'sharp';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Тестовый маршрут
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Manga Panel Cleaner API is running'
  });
});

// Основной эндпоинт обработки
app.post('/api/process', async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Базовая валидация URL
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    // Парсим страницу
    const result = await scrapePage(url);

    // Пока возвращаем просто результат парсинга
    // На следующих шагах добавим обработку фреймов
    return res.json({
      success: true,
      data: {
        pageTitle: result.pageTitle,
        totalImages: result.totalCount,
        images: result.images.map(img => ({
          url: img.url,
          width: img.width,
          height: img.height,
        })),
      },
      message: `Найдено ${result.totalCount} изображений на странице`,
    });

  } catch (error) {
    console.error('Error processing URL:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
// Эндпоинт для получения превью картинки
// Принимает URL картинки, скачивает её, уменьшает и отдаёт
app.get('/api/preview', async (req: Request, res: Response) => {
  const imageUrl = req.query.url as string;

  if (!imageUrl) {
    return res.status(400).json({ error: 'URL parameter "url" is required' });
  }

  try {
    // Скачиваем картинку с сайта-источника
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        'Referer': new URL(imageUrl).origin,
      },
    });

    // Уменьшаем до ширины 300px (пропорционально)
    const resized = await sharp(response.data)
      .resize(300, undefined, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 70 })
      .toBuffer();

    // Кешируем на 1 час (чтобы не гонять одно и то же)
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(resized);

  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Failed to load preview' });
  }
});
// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📋 Process endpoint: POST http://localhost:${PORT}/api/process`);
});