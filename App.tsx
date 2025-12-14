
import React, { useState, useCallback, useMemo } from 'react';
import { VOICES } from './constants';
import type { VoiceOption } from './types';
import { generateSpeechFromText } from './services/geminiService';
import { encodeWav } from './utils/audioUtils';
import { PlayIcon, DownloadIcon, LoadingIcon, ClockIcon } from './components/icons';

// Hàm phân tích lỗi để hiển thị thông báo thân thiện
const getFriendlyErrorMessage = (error: any): React.ReactNode => {
  const msg = (error?.message || '').toLowerCase();
  const status = error?.status || error?.code || 0;
  const fullErrorString = JSON.stringify(error || {}).toLowerCase();

  // 1. Lỗi Quota / Rate Limit (429)
  if (
    msg.includes('429') || 
    status === 429 || 
    msg.includes('quota') || 
    msg.includes('resource_exhausted') || 
    fullErrorString.includes('resource_exhausted')
  ) {
    return (
      <div className="text-left">
        <strong className="block mb-1">⚠️ Hệ thống đang quá tải (Rate Limit)</strong>
        <p className="mb-2">Bạn đã gửi quá nhiều yêu cầu hoặc Google đang giới hạn tài nguyên miễn phí.</p>
        <ul className="list-disc list-inside bg-white/50 dark:bg-black/20 p-2 rounded text-xs">
          <li><strong>Giải pháp 1:</strong> Vui lòng chờ <strong>1-2 phút</strong> rồi thử lại.</li>
          <li><strong>Giải pháp 2:</strong> Nếu văn bản quá dài (>10k ký tự), hãy thử chia nhỏ ra.</li>
        </ul>
      </div>
    );
  }

  // 2. Lỗi Safety Filters (Nội dung nhạy cảm)
  if (msg.includes('safety') || msg.includes('blocked') || fullErrorString.includes('finishreason":"safety')) {
    return (
      <div className="text-left">
        <strong className="block mb-1">🛡️ Nội dung bị chặn bởi AI</strong>
        <p className="mb-2">Google AI phát hiện nội dung có thể vi phạm chính sách an toàn (Safety Filter).</p>
        <div className="bg-white/50 dark:bg-black/20 p-2 rounded text-xs">
          👉 <em>Khắc phục:</em> Hãy kiểm tra và loại bỏ các từ ngữ nhạy cảm, bạo lực hoặc thù ghét trong văn bản.
        </div>
      </div>
    );
  }

  // 3. Lỗi Kết nối mạng
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to connect')) {
    return (
      <div className="text-left">
        <strong className="block mb-1">🌐 Lỗi kết nối mạng</strong>
        <p>Không thể kết nối đến máy chủ Google AI. Vui lòng kiểm tra lại Internet hoặc VPN của bạn.</p>
      </div>
    );
  }
  
  // 4. Lỗi Server Google (5xx)
  if (msg.includes('503') || msg.includes('500') || msg.includes('service unavailable')) {
     return (
      <div className="text-left">
        <strong className="block mb-1">🤖 Máy chủ Google đang bảo trì</strong>
        <p>Dịch vụ đang gặp sự cố tạm thời. Vui lòng thử lại sau vài phút.</p>
      </div>
    );
  }

  // Lỗi mặc định
  return (
    <div className="text-left">
      <strong className="block mb-1">❌ Đã xảy ra lỗi không xác định</strong>
      <p>{error?.message || 'Có sự cố xảy ra trong quá trình xử lý.'}</p>
    </div>
  );
};

const App: React.FC = () => {
  const [text, setText] = useState<string>('Xin chào, đây là chế độ Tốc Độ Cao. Hệ thống sẽ xử lý song song để chuyển đổi 50.000 ký tự chỉ trong vài phút.');
  const [selectedVoice, setSelectedVoice] = useState<string>(VOICES[0].id);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Sử dụng ReactNode cho error để hiển thị JSX
  const [error, setError] = useState<React.ReactNode | null>(null);
  
  const [progress, setProgress] = useState<number>(0);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<string>('wav');

  const estimatedTime = useMemo(() => {
    const charCount = text.length;
    if (charCount === 0) return 0;
    // Chế độ High Speed: ~500 chars/giây (nhờ xử lý song song)
    return Math.max(2, Math.ceil(charCount / 500)); 
  }, [text]);

  const handleGenerateSpeech = useCallback(async () => {
    if (!text.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setAudioUrl(null);
    setProcessingTime(null);
    setProgress(0);

    const startTime = performance.now();

    try {
      // Gọi service xử lý
      const pcmData = await generateSpeechFromText(text, selectedVoice, (p) => setProgress(p));
      
      const wavBlob = encodeWav(pcmData);
      const url = URL.createObjectURL(wavBlob);
      setAudioUrl(url);
      
      const endTime = performance.now();
      const durationInSeconds = (endTime - startTime) / 1000;
      setProcessingTime(durationInSeconds);

    } catch (err: any) {
      console.error('Critical Error:', err);
      // Sử dụng hàm helper để hiển thị lỗi đẹp hơn
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  }, [text, selectedVoice, isLoading]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <header className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gemini TTS - High Speed</h1>
            <p className="mt-2 text-blue-100 font-medium text-sm">Xử lý Song song • 50k ký tự trong 3 phút • Giọng Phantom</p>
          </header>

          <main className="p-6 md:p-8 space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Văn bản
                </label>
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md">
                        <ClockIcon />
                        Est: ~{estimatedTime}s
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {text.length} ký tự
                    </span>
                </div>
              </div>
              <textarea
                id="text-input"
                rows={8}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 bg-gray-50 dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Dán nội dung truyện dài vào đây (lên đến 100.000 ký tự)..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isLoading}
              ></textarea>
            </div>

            <div>
              <label htmlFor="voice-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Giọng đọc
              </label>
              <select
                id="voice-select"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 bg-gray-50 dark:bg-gray-700"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                disabled={isLoading}
              >
                {VOICES.map((voice: VoiceOption) => (
                  <option key={voice.id} value={voice.id}>{voice.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
                <button
                  onClick={handleGenerateSpeech}
                  disabled={isLoading || !text.trim()}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all duration-300 transform active:scale-[0.99]"
                >
                  {isLoading ? (
                    <>
                      <LoadingIcon />
                      <span>Đang tăng tốc xử lý... ({Math.round(progress)}%)</span>
                    </>
                  ) : (
                    <>
                      <PlayIcon />
                      Tạo Ngay (Tốc độ cao)
                    </>
                  )}
                </button>
            </div>

            {isLoading && (
              <div className="space-y-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <p className="text-center text-xs text-gray-500 dark:text-gray-400 animate-pulse">
                   Đang sử dụng 2 luồng xử lý song song với Smart Rate Limiting.
                </p>
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg text-sm shadow-sm">
                {error}
              </div>
            )}
            
            {audioUrl && (
              <div className="p-4 bg-blue-50 dark:bg-gray-750 border border-blue-100 dark:border-gray-700 rounded-xl space-y-4 animate-fade-in shadow-sm">
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
                    <span className="font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                      Hoàn tất
                    </span>
                    <span className="text-gray-500">
                      Thời gian xử lý: {processingTime ? `${processingTime.toFixed(1)}s` : ''}
                    </span>
                </div>
                
                <audio controls src={audioUrl} className="w-full h-10 outline-none">
                  Trình duyệt của bạn không hỗ trợ phần tử audio.
                </audio>

                <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center pt-2 border-t border-blue-100 dark:border-gray-700">
                  <div className="w-full sm:w-auto flex-1">
                    <select
                      value={downloadFormat}
                      onChange={(e) => setDownloadFormat(e.target.value)}
                      className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      <option value="wav">.WAV (Gốc)</option>
                      <option value="mp3">.MP3</option>
                    </select>
                  </div>
                  
                  <a
                    href={audioUrl}
                    download={`speech.${downloadFormat}`}
                    className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white font-medium text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    <DownloadIcon />
                    Tải về máy
                  </a>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;
