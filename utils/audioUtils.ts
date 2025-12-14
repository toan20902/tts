
/**
 * Giải mã chuỗi base64 thành Uint8Array.
 * @param base64 Chuỗi base64.
 * @returns Dữ liệu dưới dạng Uint8Array.
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Mã hóa dữ liệu audio PCM thô thành một file WAV.
 * @param pcmData Dữ liệu PCM 16-bit.
 * @returns Một Blob chứa dữ liệu file WAV.
 */
export function encodeWav(pcmData: Uint8Array): Blob {
    const sampleRate = 24000; // Gemini TTS sample rate
    const numChannels = 1; // Mono
    const bitsPerSample = 16;
    const dataLength = pcmData.length;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;

    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    function writeString(view: DataView, offset: number, str: string) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true); // chunkSize
    writeString(view, 8, 'WAVE');

    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // audioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Ghi dữ liệu PCM
    const pcmAsUint8 = new Uint8Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
    for (let i = 0; i < pcmData.length; i++) {
        view.setUint8(44 + i, pcmAsUint8[i]);
    }
    
    return new Blob([view], { type: 'audio/wav' });
}
