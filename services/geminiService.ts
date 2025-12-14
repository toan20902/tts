
import { GoogleGenAI, Modality } from "@google/genai";
import { MAX_CHUNK_LENGTH } from '../constants';
import { decode } from '../utils/audioUtils';

// Khởi tạo API client.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

/**
 * Chia văn bản thành các đoạn nhỏ.
 */
function chunkText(text: string): string[] {
  if (text.length <= MAX_CHUNK_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  // Tách câu dựa trên dấu chấm câu để ngắt nghỉ tự nhiên
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > MAX_CHUNK_LENGTH && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += sentence;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  // Fallback an toàn
  const finalChunks: string[] = [];
  chunks.forEach(chunk => {
      if (chunk.length > MAX_CHUNK_LENGTH) {
          for (let i = 0; i < chunk.length; i += MAX_CHUNK_LENGTH) {
              finalChunks.push(chunk.substring(i, i + MAX_CHUNK_LENGTH));
          }
      } else {
          finalChunks.push(chunk);
      }
  });

  return finalChunks;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- CƠ CHẾ THROTTLING ĐỘNG ---
// Biến toàn cục để điều tiết tốc độ.
// Bắt đầu với 3.5 giây để an toàn cho Free Tier (khoảng 15-17 RPM).
let minRequestInterval = 3500; 
let lastRequestTime = 0;

/**
 * Hàm điều tiết request.
 * Đảm bảo khoảng cách giữa các request không thấp hơn minRequestInterval.
 */
async function throttleRequest() {
    const now = Date.now();
    // Tính toán thời điểm an toàn tiếp theo có thể gọi
    const targetTime = lastRequestTime + minRequestInterval;
    const waitTime = Math.max(0, targetTime - now);
    
    // Cập nhật lastRequestTime ngay lập tức để "đặt chỗ" cho các luồng khác
    // Thêm một chút jitter (ngẫu nhiên) để tránh các luồng thức dậy cùng lúc
    const actualWait = waitTime + (Math.random() * 300);
    lastRequestTime = now + actualWait;

    if (actualWait > 0) {
        await sleep(actualWait);
    }
}

/**
 * Hàm gọi API với cơ chế Retry & Backoff mạnh mẽ.
 */
async function generateAudioSegment(
    text: string, 
    voiceName: string, 
    promptPrefix: string,
    chunkIndex: number,
    retryCount = 0
): Promise<Uint8Array> {
    // Tăng số lần thử lại lên 12 để đảm bảo vượt qua được giai đoạn rate limit
    const MAX_RETRIES = 12; 
    
    try {
        await throttleRequest();

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `${promptPrefix}${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });

        const candidate = response.candidates?.[0];
        if (candidate?.finishReason === 'SAFETY') {
            console.warn(`Chunk ${chunkIndex} bị chặn bởi bộ lọc an toàn.`);
            return new Uint8Array(0); 
        }

        const base64Audio = candidate?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            return decode(base64Audio);
        }
        
        throw new Error("Empty audio response");

    } catch (error: any) {
        // Phân loại lỗi
        const isRateLimit = 
            error.code === 429 || 
            error.status === 'RESOURCE_EXHAUSTED' || 
            (error.message && error.message.includes('429')) ||
            (error.status === 503);

        if (retryCount < MAX_RETRIES) {
            let delay = 2000;
            
            if (isRateLimit) {
                // LOGIC QUAN TRỌNG:
                // Nếu gặp lỗi 429, hệ thống đang đi quá nhanh.
                // Tăng thời gian nghỉ giữa các request (minRequestInterval) cho TOÀN BỘ hệ thống.
                // Tăng mỗi lần gặp lỗi, tối đa lên 10 giây.
                minRequestInterval = Math.min(minRequestInterval + 1500, 10000);
                
                // Exponential Backoff cho request hiện tại
                // Lần 1: ~5s, Lần 2: ~10s, Lần 3: ~20s...
                delay = (5000 * Math.pow(1.5, retryCount)) + (Math.random() * 2000);
                
                console.warn(`Rate Limit (Chunk ${chunkIndex}). Tăng interval lên ${minRequestInterval}ms. Đợi ${Math.round(delay)}ms...`);
            } else {
                delay = 2000 * Math.pow(1.5, retryCount);
            }

            await sleep(delay);
            return generateAudioSegment(text, voiceName, promptPrefix, chunkIndex, retryCount + 1);
        }
        
        console.error(`Failed chunk ${chunkIndex} after ${MAX_RETRIES} attempts.`);
        throw error;
    }
}

/**
 * Tạo âm thanh từ văn bản.
 */
export async function generateSpeechFromText(
  text: string,
  voiceId: string,
  onProgress: (progress: number) => void
): Promise<Uint8Array> {
  const textChunks = chunkText(text);
  
  // Reset interval về mức mặc định khi bắt đầu job mới
  // Nhưng không reset quá thấp nếu vừa bị limit
  minRequestInterval = Math.max(minRequestInterval - 1000, 3500);

  let actualVoiceId = voiceId;
  let promptPrefix = ''; 

  // Mapping giọng đọc (giữ nguyên logic cũ)
  if (voiceId === 'gemini-dream') {
    actualVoiceId = 'Zephyr'; 
    promptPrefix = "Giọng Fenrir nhẹ nhàng hơn: ";
  } else if (voiceId === 'velocity-prime') {
    actualVoiceId = 'Fenrir';
    promptPrefix = "Đọc cực nhanh, dứt khoát: ";
  } else if (voiceId === 'raven-horror') {
    actualVoiceId = 'Fenrir';
    promptPrefix = "Đọc bằng giọng nam Anh Mỹ (US English Accent). Tông giọng phải đáng sợ, u ám, đầy hồi hộp...: ";
  } else if (voiceId === 'phantom-horror') {
    actualVoiceId = 'Fenrir';
    promptPrefix = "Đọc bằng giọng nam Anh Mỹ (US English Accent). Tông giọng ma mị, trầm thấp và cực kỳ truyền cảm để kể chuyện kinh dị...: ";
  } else if (voiceId === 'lyra-resilient') {
    actualVoiceId = 'Zephyr';
    promptPrefix = "Đọc bằng giọng nữ Anh Mỹ... Kiên cường...: ";
  } else if (voiceId === 'shadow-creep') {
    actualVoiceId = 'Fenrir';
    promptPrefix = "Đọc bằng giọng thì thào, rợn người...: ";
  }

  const results: Uint8Array[] = new Array(textChunks.length);
  let completedCount = 0;
  let failureCount = 0;
  let lastError: any = null;
  
  // GIỮ CONCURRENCY THẤP
  // 2 là con số an toàn nhất.
  const CONCURRENCY_LIMIT = 2; 
  
  const processChunk = async (index: number) => {
      const chunk = textChunks[index];
      try {
          const audio = await generateAudioSegment(chunk, actualVoiceId, promptPrefix, index);
          results[index] = audio;
      } catch (e) {
          console.error(`Error processing chunk ${index}. Skipping segment.`);
          lastError = e; // Lưu lại lỗi để báo cáo nếu tất cả đều fail
          failureCount++;
          results[index] = new Uint8Array(0); 
      } finally {
          completedCount++;
          const progress = (completedCount / textChunks.length) * 98;
          onProgress(progress);
      }
  };

  const executing: Promise<void>[] = [];
  
  for (let i = 0; i < textChunks.length; i++) {
      const p = processChunk(i);
      executing.push(p);

      if (executing.length >= CONCURRENCY_LIMIT) {
          await Promise.race(executing);
          // Cleanup promise đã xong
          while (executing.length >= CONCURRENCY_LIMIT) {
             await Promise.race(executing);
             await sleep(10);
          }
      }
      
      // Attach cleanup logic
      p.then(() => {
          const idx = executing.indexOf(p);
          if (idx > -1) executing.splice(idx, 1);
      });
  }

  await Promise.all(executing);

  // Nếu tất cả các chunk đều thất bại, ném lỗi ra ngoài để UI hiển thị
  if (failureCount === textChunks.length && textChunks.length > 0) {
      throw lastError || new Error("Không thể tạo âm thanh. Vui lòng kiểm tra lại kết nối hoặc thử lại sau.");
  }

  // Ghép audio
  const totalLength = results.reduce((acc, chunk) => acc + (chunk ? chunk.length : 0), 0);
  const concatenatedAudio = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of results) {
    if (chunk && chunk.length > 0) {
      concatenatedAudio.set(chunk, offset);
      offset += chunk.length;
    }
  }
  
  onProgress(100);
  return concatenatedAudio;
}
