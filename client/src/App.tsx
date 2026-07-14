import { useState } from 'react';

// Типы
interface ImageInfo {
  url: string;
  width: number;
  height: number;
}

interface ProcessResult {
  success: boolean;
  data?: {
    pageTitle: string;
    totalImages: number;
    images: ImageInfo[];
  };
  message?: string;
  error?: string;
}

// Компонент миниатюры с крестиком
function ImageThumbnail({
  image,
  index,
  onRemove,
}: {
  image: ImageInfo;
  index: number;
  onRemove: (index: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Кодируем URL для передачи в query параметр
  const previewUrl = `/api/preview?url=${encodeURIComponent(image.url)}`;

  return (
    <div className="relative group">
      {/* Карточка */}
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-gray-500 transition-colors">
        {/* Контейнер картинки с фиксированным соотношением */}
        <div className="relative w-full" style={{ paddingBottom: '140%' }}>
          {/* Скелетон (показывается пока грузится) */}
          {!loaded && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-750">
              <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}

          {/* Ошибка загрузки */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-750 text-gray-500">
              <div className="text-center">
                <span className="text-3xl block mb-1">🖼️</span>
                <span className="text-xs">Нет превью</span>
              </div>
            </div>
          )}

          {/* Сама картинка */}
          {!error && (
            <img
              src={previewUrl}
              alt={`Страница ${index + 1}`}
              className={`absolute inset-0 w-full h-full object-contain bg-gray-900 transition-opacity duration-300 ${
                loaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
              loading="lazy"
            />
          )}

          {/* Затемнение при наведении */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200" />
        </div>

        {/* Подпись */}
        <div className="p-2 text-xs text-gray-400 flex justify-between items-center">
          <span>№{index + 1}</span>
          <span className="text-gray-500 font-mono">
            {image.width}×{image.height}
          </span>
        </div>
      </div>

      {/* Кнопка удаления (крестик) */}
      <button
        onClick={() => onRemove(index)}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 z-10"
        title="Удалить картинку"
      >
        ✕
      </button>
    </div>
  );
}

// Главный компонент
function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [selectedImages, setSelectedImages] = useState<ImageInfo[]>([]);

  // Загрузка и парсинг страницы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setResult(null);
    setSelectedImages([]);

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data: ProcessResult = await response.json();

      if (data.success && data.data) {
        setStatus('done');
        setResult(data);
        // По умолчанию выбираем все картинки
        setSelectedImages([...data.data.images]);
      } else {
        setStatus('error');
        setResult(data);
      }
    } catch {
      setStatus('error');
      setResult({ success: false, error: 'Сервер не отвечает. Убедитесь, что бэкенд запущен.' });
    }
  };

  // Удаление картинки из выбранных
  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Отмена выбора (очистить всё)
  const handleClearAll = () => {
    setSelectedImages([]);
  };

  // Выбрать всё заново
  const handleSelectAll = () => {
    if (result?.data?.images) {
      setSelectedImages([...result.data.images]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Заголовок */}
        <h1 className="text-3xl font-bold text-center mb-2">
          🎌 Manga Panel Cleaner
        </h1>
        <p className="text-gray-400 text-center mb-8">
          Вставьте ссылку на главу манги, выберите нужные страницы и обработайте их
        </p>

        {/* Форма ввода */}
        <form onSubmit={handleSubmit} className="max-w-xl mx-auto mb-8">
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/manga/chapter/1"
              className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500"
              required
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-medium transition-colors whitespace-nowrap"
            >
              {status === 'loading' ? '⏳ Анализ...' : '🔍 Найти'}
            </button>
          </div>
        </form>

        {/* Ошибка */}
        {status === 'error' && (
          <div className="max-w-xl mx-auto p-4 rounded-lg bg-red-900/50 border border-red-700 text-red-300 text-sm mb-8">
            ❌ {result?.error || 'Произошла ошибка'}
          </div>
        )}

        {/* Результат: галерея */}
        {status === 'done' && result?.data && (
          <div className="space-y-4">
            {/* Инфо-панель */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-800 rounded-lg p-4">
              <div>
                <h2 className="font-semibold text-lg">{result.data.pageTitle}</h2>
                <p className="text-sm text-gray-400">
                  Найдено: <span className="text-white font-medium">{result.data.totalImages}</span> |
                  Выбрано: <span className="text-green-400 font-medium">{selectedImages.length}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  Выбрать всё
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  Снять всё
                </button>
              </div>
            </div>

            {/* Сетка миниатюр */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {result.data.images.map((image, index) => {
                const isSelected = selectedImages.some(
                  (selected) => selected.url === image.url
                );

                return (
                  <div
                    key={image.url}
                    className={`relative cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'opacity-100 scale-100'
                        : 'opacity-40 scale-95 grayscale'
                    }`}
                    onClick={() => {
                      if (isSelected) {
                        // Если уже выбрана — убираем
                        const selectedIndex = selectedImages.findIndex(
                          (s) => s.url === image.url
                        );
                        handleRemoveImage(selectedIndex);
                      } else {
                        // Если не выбрана — добавляем
                        setSelectedImages((prev) => [...prev, image]);
                      }
                    }}
                  >
                    <ImageThumbnail
                      image={image}
                      index={index}
                      onRemove={(i) => {
                        // При клике на крестик убираем из selectedImages
                        const selectedIndex = selectedImages.findIndex(
                          (s) => s.url === result.data!.images[i].url
                        );
                        if (selectedIndex >= 0) {
                          handleRemoveImage(selectedIndex);
                        }
                      }}
                    />

                    {/* Галочка выбора */}
                    {isSelected && (
                      <div className="absolute top-2 left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-10">
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Кнопка обработки (пока заглушка) */}
            <div className="text-center pt-4">
              <button
                disabled={selectedImages.length === 0}
                className="px-8 py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500 font-medium text-lg transition-colors"
                onClick={() => {
                  alert(
                    `Выбрано ${selectedImages.length} картинок для обработки.\nФункция будет добавлена на следующем шаге!`
                  );
                }}
              >
                🎨 Обработать выбранные ({selectedImages.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;