// Информация о найденном изображении
export interface FoundImage {
    url: string;           // Прямая ссылка на картинку
    width: number;         // Ширина в пикселях
    height: number;        // Высота в пикселях
    index: number;         // Порядковый номер на странице
  }
  
  // Результат парсинга страницы
  export interface ScrapeResult {
    images: FoundImage[];  // Все найденные изображения
    pageTitle: string;     // Заголовок страницы
    totalCount: number;    // Сколько всего изображений
  }
  
  // Статусы обработки для очереди
  export type JobStatus = 
    | 'pending'       // В очереди
    | 'parsing'       // Парсим страницу
    | 'downloading'   // Качаем картинки
    | 'detecting'     // Находим фреймы
    | 'erasing'       // Закрашиваем текст
    | 'archiving'     // Упаковываем в ZIP
    | 'done'          // Готово
    | 'error';        // Ошибка
  
  // Прогресс задачи
  export interface JobProgress {
    status: JobStatus;
    progress: number;      // 0–100
    foundImages?: number;
    processedPanels?: number;
    message: string;
    resultUrl?: string;    // Ссылка на ZIP когда готово
  }