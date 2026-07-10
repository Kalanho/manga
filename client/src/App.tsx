import { useState } from 'react';

function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('Отправляю запрос...');

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      setStatus('done');
      setMessage(`Готово: ${data.message}`);
    } catch (error) {
      setStatus('error');
      setMessage('Ошибка: сервер не отвечает');
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

        {message && (
          <div className={`p-4 rounded-lg text-center ${
            status === 'error' ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;