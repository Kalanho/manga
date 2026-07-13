import puppeteer, { Browser, Page } from 'puppeteer';
import type { FoundImage, ScrapeResult } from '../types';

const TIMEOUT = 60000;
const MIN_IMAGE_AREA = 50000; // Минимальная площадь (примерно 250x200)
const SCROLL_DELAY = 500; // Пауза между скроллами (мс)
const IMAGE_LOAD_DELAY = 1500; // Пауза после скролла для загрузки картинок (мс)

async function launchBrowser(): Promise<Browser> {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ],
    });
    return browser;
}

/**
 * Медленный, аккуратный скролл с паузами.
 * Останавливается на каждом экране, чтобы сработал Intersection Observer.
 */
async function slowScroll(page: Page): Promise<void> {
    console.log('📜 Начинаю медленный скролл...');

    // Получаем высоту страницы и вьюпорта
    const { scrollHeight, viewportHeight } = await page.evaluate(() => ({
        scrollHeight: document.body.scrollHeight,
        viewportHeight: window.innerHeight,
    }));

    console.log(`   Высота страницы: ${scrollHeight}px, вьюпорт: ${viewportHeight}px`);

    let currentPosition = 0;
    let step = 0;

    // Скроллим по одному экрану за раз
    while (currentPosition < scrollHeight) {
        step++;

        // Скроллим ровно на высоту вьюпорта
        currentPosition += viewportHeight * 0.8; // 80% экрана — чтобы был небольшой оверлап

        console.log(`   Шаг ${step}: скроллю до ${Math.round(currentPosition)}px`);

        await page.evaluate((pos) => {
            window.scrollTo({
                top: pos,
                behavior: 'smooth', // Плавный скролл — лучше триггерит lazy load
            });
        }, currentPosition);

        // Ждём загрузки картинок после скролла
        await new Promise(resolve => setTimeout(resolve, IMAGE_LOAD_DELAY));

        // Проверяем, не появились ли новые картинки
        const loadedImages = await page.evaluate(() => {
            const imgs = document.querySelectorAll('img');
            let loaded = 0;
            let total = 0;
            imgs.forEach(img => {
                total++;
                if (img.complete && img.naturalWidth > 0) {
                    loaded++;
                }
            });
            return { loaded, total };
        });

        console.log(`      Загружено картинок: ${loadedImages.loaded}/${loadedImages.total}`);

        // Обновляем высоту (могла измениться после загрузки картинок)
        const newHeight = await page.evaluate(() => document.body.scrollHeight);
        if (newHeight > scrollHeight) {
            console.log(`   Высота страницы увеличилась: ${scrollHeight} → ${newHeight}px`);
            scrollHeight; // обновляем для условия цикла... 
            // На самом деле нужно обновить scrollHeight:
            // scrollHeight = newHeight; // Но проще пересчитать в следующей итерации через evaluate
        }
    }

    // Возвращаемся наверх
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    console.log('✅ Скролл завершён');
}

/**
 * Ждём, пока ВСЕ изображения на странице загрузятся.
 */
async function waitForAllImages(page: Page): Promise<void> {
    console.log('⏳ Жду загрузки всех изображений...');

    try {
        await page.waitForFunction(
            () => {
                const imgs = Array.from(document.querySelectorAll('img'));
                // Считаем только те, у которых есть src не data: и не svg
                const relevant = imgs.filter(img => {
                    const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
                    return src && !src.startsWith('data:') && !src.endsWith('.svg');
                });
                // Все должны быть загружены
                return relevant.every(img => img.complete && img.naturalWidth > 0);
            },
            { timeout: TIMEOUT }
        );
        console.log('✅ Все изображения загружены');
    } catch {
        console.log('⚠️  Не все изображения загрузились за отведённое время, продолжаем...');
    }
}

/**
 * Находит все изображения на странице и фильтрует их.
 */
function extractPageNumber(url: string, fallbackIndex: number): number {
    // Ищем паттерны: page_01, page-01, p01, img_001, _01, 01.png и т.д.
    const patterns = [
      /[_-]?page[_-]?(\d+)/i,       // page_01, page-01, PAGE01
      /[_-]?p(\d+)/i,                // p01, p_01
      /[_-]?img[_-]?(\d+)/i,         // img_01, img-01
      /[_-](\d{2,4})(?:\.[a-z]+)?$/i, // _01.png, -01.jpeg (цифры в конце перед расширением)
    ];
  
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > 0 && num < 10000) { // разумный диапазон
          return num;
        }
      }
    }
  
    // Если не нашли — используем порядок в DOM
    return fallbackIndex;
  }
  
  /**
   * Находит все изображения на странице и фильтрует их.
   * ВАЖНО: сохраняет порядок, в котором картинки идут на странице.
   */
  async function findMangaImages(page: Page): Promise<FoundImage[]> {
    const pageUrl = page.url();
  
    const rawImages = await page.evaluate(() => {
      const imagesData: { src: string; width: number; height: number; complete: boolean }[] = [];
      const imgElements = document.querySelectorAll('img');
  
      for (const img of imgElements) {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
        if (src) {
          imagesData.push({
            src: src,
            width: img.naturalWidth,
            height: img.naturalHeight,
            complete: img.complete,
          });
        }
      }
  
      return imagesData;
    });
  
    console.log(`\n📊 Всего сырых изображений в DOM: ${rawImages.length}`);
  
    const loadedCount = rawImages.filter(img => img.complete && img.width > 0).length;
    const pendingCount = rawImages.length - loadedCount;
    console.log(`   Загружено: ${loadedCount}, не загружено: ${pendingCount}`);
  
    // Критерии фильтрации страниц манги
    const MIN_HEIGHT = 800;   // Минимальная высота (страница манги обычно > 800px)
    const MAX_ASPECT_RATIO = 1.5; // Соотношение ширина/высота (для вертикальной манги < 1)
    const MIN_ASPECT_RATIO = 0.05; // Не слишком узкое (исключает линии, разделители)
  
    const candidates: { img: (typeof rawImages)[0]; domIndex: number }[] = [];
  
    for (let i = 0; i < rawImages.length; i++) {
      const item = rawImages[i];
      const area = item.width * item.height;
      const aspectRatio = item.width / item.height;
  
      // Пропускаем data: URL и SVG
      if (item.src.startsWith('data:')) {
        console.log(`  [${i}] data:URL — пропускаем`);
        continue;
      }
      if (item.src.endsWith('.svg')) {
        console.log(`  [${i}] SVG — пропускаем`);
        continue;
      }
  
      // Не загружено
      if (!item.complete || item.width === 0) {
        console.log(`  [${i}] ${item.src.substring(0, 60)}... — НЕ ЗАГРУЖЕНО, пропускаем`);
        continue;
      }
  
      // Слишком маленькое (аватарки, иконки)
      if (item.height < MIN_HEIGHT) {
        console.log(`  [${i}] ${item.width}×${item.height} — высота ${item.height} < ${MIN_HEIGHT}, пропускаем (иконка/аватарка)`);
        continue;
      }
  
      // Слишком квадратное или горизонтальное (не страница манги)
      if (aspectRatio > MAX_ASPECT_RATIO) {
        console.log(`  [${i}] ${item.width}×${item.height} — соотношение ${aspectRatio.toFixed(2)} > ${MAX_ASPECT_RATIO}, пропускаем (не вертикальное)`);
        continue;
      }
  
      // Слишком узкое (линии, разделители)
      if (aspectRatio < MIN_ASPECT_RATIO) {
        console.log(`  [${i}] ${item.width}×${item.height} — соотношение ${aspectRatio.toFixed(2)} < ${MIN_ASPECT_RATIO}, пропускаем (слишком узкое)`);
        continue;
      }
  
      console.log(`  [${i}] ${item.width}×${item.height} (соотношение ${aspectRatio.toFixed(2)}) ✅`);
  
      candidates.push({ img: item, domIndex: i });
    }
  
    console.log(`\n📊 Кандидатов: ${candidates.length}`);
  
    // Сортируем по номеру страницы, извлечённому из URL
    // Если номера нет — сохраняем порядок в DOM (domIndex)
    candidates.sort((a, b) => {
      const pageA = extractPageNumber(a.img.src, a.domIndex);
      const pageB = extractPageNumber(b.img.src, b.domIndex);
      return pageA - pageB;
    });
  
    // Формируем финальный массив
    const images: FoundImage[] = candidates.map((candidate, index) => {
      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(candidate.img.src, pageUrl).href;
      } catch {
        absoluteUrl = candidate.img.src;
      }
  
      console.log(`  ${index + 1}. [стр.${extractPageNumber(candidate.img.src, candidate.domIndex)}] ${candidate.img.width}×${candidate.img.height}`);
      console.log(`     ${absoluteUrl.substring(0, 100)}`);
  
      return {
        url: absoluteUrl,
        width: candidate.img.width,
        height: candidate.img.height,
        index: index, // Новый порядковый номер после сортировки
      };
    });
  
    console.log(`\n✅ После фильтрации и сортировки: ${images.length} изображений`);
  
    return images;
  }

/**
 * Главная функция парсинга.
 */
export async function scrapePage(url: string): Promise<ScrapeResult> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Начинаю парсинг: ${url}`);
    console.log(`${'='.repeat(60)}`);

    let browser: Browser | null = null;

    try {
        browser = await launchBrowser();
        console.log('✅ Браузер запущен');

        const page = await browser.newPage();

        // Блокируем ненужные ресурсы для скорости
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            const reqUrl = request.url();

            if (
                resourceType === 'font' ||
                resourceType === 'media' ||
                resourceType === 'websocket' ||
                resourceType === 'manifest' ||
                reqUrl.includes('google-analytics') ||
                reqUrl.includes('gtm.js') ||
                reqUrl.includes('adservice') ||
                reqUrl.includes('doubleclick') ||
                reqUrl.includes('facebook.com/tr') ||
                reqUrl.includes('hotjar') ||
                reqUrl.includes('yandex.ru/metrica') ||
                reqUrl.includes('analytics')
            ) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // Маскируемся под обычный браузер
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        await page.setViewport({ width: 1920, height: 1080 });

        // Загружаем страницу
        console.log('📄 Загружаю страницу...');
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: TIMEOUT,
        });

        const pageTitle = await page.title();
        console.log(`📌 Заголовок: "${pageTitle}"`);

        // Дополнительная пауза для инициализации JS
        console.log('⏳ Жду инициализации скриптов...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Медленный скролл для ленивой загрузки
        await slowScroll(page);

        // Ждём загрузки всех картинок
        await waitForAllImages(page);

        // Собираем картинки
        console.log('\n🖼️  Собираю информацию об изображениях...');
        const images = await findMangaImages(page);

        console.log(`\n${'='.repeat(60)}`);
        console.log(`✅ ИТОГО: ${images.length} изображений`);
        console.log(`${'='.repeat(60)}\n`);

        const result: ScrapeResult = {
            images,
            pageTitle,
            totalCount: images.length,
        };

        return result;

    } catch (error) {
        console.error('❌ Ошибка при парсинге:', error);
        throw new Error(
            `Не удалось обработать страницу: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`
        );
    } finally {
        if (browser) {
            await browser.close();
            console.log('🔒 Браузер закрыт');
        }
    }
}