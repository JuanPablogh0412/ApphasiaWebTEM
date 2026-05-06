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

/**
 * Detecta la frecuencia fundamental (F0) por sílaba usando autocorrelación sobre
 * el PCM del audio. Produce un valor F0 en Hz por cada sílaba (0 = no vocalizado).
 *
 * @param {File} audioFile - Archivo de audio (WebM, WAV, etc.)
 * @param {number[]} onsets_ms - Inicio de cada sílaba en ms
 * @param {number[]} durations_ms - Duración de cada sílaba en ms
 * @returns {Promise<number[]>} F0 en Hz por sílaba (redondeado a 1 decimal)
 */
export async function detectF0PerSyllable(audioFile, onsets_ms, durations_ms) {
  if (!onsets_ms || onsets_ms.length === 0) return [];

  const audioCtx = new AudioContext();
  try {
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const sampleRate = audioBuffer.sampleRate;
    // Mezclar a mono: promedio de todos los canales
    const numChannels = audioBuffer.numberOfChannels;
    const totalSamples = audioBuffer.length;
    const mono = new Float32Array(totalSamples);
    for (let c = 0; c < numChannels; c++) {
      const ch = audioBuffer.getChannelData(c);
      for (let i = 0; i < totalSamples; i++) mono[i] += ch[i] / numChannels;
    }

    // Rango de lag para voz humana: 80 Hz (lagMax) – 800 Hz (lagMin)
    const lagMin = Math.floor(sampleRate / 800);
    const lagMax = Math.ceil(sampleRate / 80);

    const f0s = onsets_ms.map((onset, idx) => {
      const startSample = Math.floor((onset / 1000) * sampleRate);
      const endSample = Math.min(
        totalSamples,
        Math.floor(((onset + durations_ms[idx]) / 1000) * sampleRate)
      );
      const window = mono.slice(startSample, endSample);
      if (window.length < lagMax * 2) return 0;

      // Autocorrelación normalizada (método de Yin simplificado)
      let bestLag = 0;
      let bestCorr = -1;
      for (let lag = lagMin; lag <= lagMax; lag++) {
        let corr = 0;
        let norm = 0;
        const len = window.length - lag;
        for (let i = 0; i < len; i++) {
          corr += window[i] * window[i + lag];
          norm += window[i] * window[i] + window[i + lag] * window[i + lag];
        }
        const normalized = norm > 0 ? (2 * corr) / norm : 0;
        if (normalized > bestCorr) {
          bestCorr = normalized;
          bestLag = lag;
        }
      }

      // Umbral: si la correlación es baja, consideramos unvoiced
      if (bestCorr < 0.3 || bestLag === 0) return 0;
      return Math.round((sampleRate / bestLag) * 10) / 10;
    });

    return f0s;
  } finally {
    await audioCtx.close();
  }
}
