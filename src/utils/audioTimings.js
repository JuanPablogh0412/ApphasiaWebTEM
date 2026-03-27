// audioTimings.js
// Genera timings aproximados (onsets_ms, durations_ms) distribuyendo sílabas
// proporcionalmente a lo largo de la duración del audio.
// Algoritmo equivalente a generateTimingFromWav() del seed script.

/**
 * Genera onsets_ms y durations_ms distribuyendo las sílabas
 * proporcionalmente a lo largo de la duración del audio.
 *
 * @param {string[]} syllables - Array de sílabas
 * @param {number} audioDurationMs - Duración del audio en milisegundos
 * @returns {{ onsets_ms: number[], durations_ms: number[], audio_duration_ms: number }}
 */
export function generateTimings(syllables, audioDurationMs) {
  const n = syllables.length;
  if (n === 0)
    return { onsets_ms: [], durations_ms: [], audio_duration_ms: audioDurationMs };

  const silenceStart = Math.min(80, Math.round(audioDurationMs * 0.08));
  const silenceEnd = Math.min(50, Math.round(audioDurationMs * 0.05));
  const available = audioDurationMs - silenceStart - silenceEnd;

  if (available <= 0) {
    const spacing = Math.max(100, Math.round(audioDurationMs / n));
    return {
      onsets_ms: syllables.map((_, i) => i * spacing),
      durations_ms: syllables.map(() => Math.max(50, spacing - 20)),
      audio_duration_ms: audioDurationMs,
    };
  }

  const spacing = Math.round(available / n);
  const onsets_ms = syllables.map((_, i) => silenceStart + i * spacing);
  const durations_ms = syllables.map((_, i) =>
    i === n - 1
      ? audioDurationMs - onsets_ms[i] // última sílaba: hasta el final
      : Math.max(50, spacing - 20) // las demás: pequeño gap natural
  );

  return { onsets_ms, durations_ms, audio_duration_ms: audioDurationMs };
}

/**
 * Lee la duración de un archivo de audio desde el navegador usando AudioContext.
 * Funciona con WAV, WebM, MP3 y otros formatos soportados por el navegador.
 *
 * @param {File} audioFile - El archivo de audio subido
 * @returns {Promise<number>} Duración en milisegundos
 */
export async function getAudioDurationMs(audioFile) {
  const audioCtx = new AudioContext();
  try {
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    return Math.round(audioBuffer.duration * 1000);
  } finally {
    await audioCtx.close();
  }
}
