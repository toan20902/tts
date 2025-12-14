
import type { VoiceOption } from './types';

export const VOICES: VoiceOption[] = [
  { id: 'Kore', name: 'Kore (Giọng nam Hàn Quốc)' },
  { id: 'Puck', name: 'Puck (Giọng nam Anh)' },
  { id: 'Charon', name: 'Charon (Giọng nữ Hà Lan)' },
  { id: 'Fenrir', name: 'Fenrir (Giọng nam Na Uy)' },
  { id: 'raven-horror', name: 'Raven (Anh-Mỹ: Kể Chuyện Ma Quỷ 👻 - 130wpm)' },
  { id: 'phantom-horror', name: 'Phantom (Anh-Mỹ: Ma Mị & Truyền Cảm - Nhanh +30%)' },
  { id: 'lyra-resilient', name: 'Lyra (Nữ Anh-Mỹ: Kiên Cường & Suy Tư)' },
  { id: 'shadow-creep', name: 'Shadow (Giọng Biến Thái/Creepy 😱)' },
  { id: 'Zephyr', name: 'Zephyr (Giọng nữ Anh)' },
  { id: 'gemini-dream', name: '✨ Giọng nói AI Độc đáo (Thử nghiệm)' },
  { id: 'velocity-prime', name: '⚡ Velocity Prime (Siêu Tốc & Độc Bản)' },
];

// Giảm nhẹ xuống 1200 ký tự.
// Mức này an toàn hơn để tránh lỗi timeout từ server khi xử lý audio phức tạp,
// đồng thời vẫn giữ số lượng request ở mức thấp để tránh lỗi rate limit.
export const MAX_CHUNK_LENGTH = 1200;
