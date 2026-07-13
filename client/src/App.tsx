import { useState } from 'react';

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

function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<ProcessResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setResult(null);

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data: ProcessResult = await response.json();

      if (data.success) {
        setStatus('done');
        setResult(data);
      } else {
        setStatus('error');
        setResult(data);
      }
    } catch {
      setStatus('error');
      setResult({ success: false, error: 'Сервер не отвечает. Убедитесь, что бэкенд запущен.' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <h1 className="text-3xl font-bold text-center">
          🎌 Manga Panel Cleaner
        </h1>
        <p className="text-gray-400 text-center">
          Вставьте ссылку на главу манги, чтобы вырезать фреймы и закрасить текст
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/manga/chapter/1"
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500"
            required
          />

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {status === 'loading' ? '⏳ Обработка...' : '🚀 Обработать'}
          </button>
        </form>

        {/* Результат */}
        {status === 'done' && result?.data && (
          <div className="p-6 rounded-lg bg-green-900/30 border border-green-700 space-y-3">
            <h3 className="text-lg font-semibold text-green-300">✅ Страница обработана</h3>
            <p className="text-green-200 text-sm">
              Заголовок: <span className="font-medium">{result.data.pageTitle}</span>
            </p>
            <p className="text-green-200 text-sm">
              Найдено изображений: <span className="font-bold text-xl">{result.data.totalImages}</span>
            </p>
            {result.data.images.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-green-400 uppercase tracking-wide">Самые большие:</p>
                {result.data.images.slice(0, 5).map((img, i) => (
                  <div key={i} className="text-xs text-green-300 bg-green-950/50 p-2 rounded flex justify-between">
                    <span className="truncate mr-2">{new URL(img.url).pathname.split('/').pop()}</span>
                    <span className="font-mono whitespace-nowrap">{img.width}×{img.height}px</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ошибка */}
        {status === 'error' && (
          <div className="p-4 rounded-lg bg-red-900/50 border border-red-700 text-red-300 text-sm">
            ❌ {result?.error || 'Произошла ошибка'}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;