# Handoff: Timings y F0 por sílaba para estímulos TEM Nivel 3

**Fecha:** 29 de abril de 2026  
**Autor:** Web-App-RehabilitIA  
**Destinatario:** Equipo app móvil

---

## Contexto

Los estímulos TEM de Nivel 3 incluyen tres grabaciones de audio/video:

| Grabación | Campo de audio en Firestore |
|---|---|
| Entonado (melodía completa) | `audio_url` |
| Sprechgesang (melodía suavizada) | `audio_url_sprechgesang` |
| Habla normal (sin melodía) | `audio_url_habla_normal` |

Previamente, solo el audio **entonado** tenía los campos de timing (`onsets_ms`, `durations_ms`, `audio_duration_ms`) y la plantilla de pitch (`f0_template_hz`). Los otros dos audios solo tenían su URL.

---

## Qué se implementó

A partir de ahora, **cuando se aprueba y crea un estímulo N3**, la web calcula y escribe en Firestore los campos de timing y F0 para **los tres audios**. Además, `f0_template_hz` del entonado ahora es el pitch real detectado del audio (antes era solo una estimación basada en el patrón tonal H/L).

---

## Nuevos campos en Firestore (colección `stimuli_TEM`)

### Para todos los niveles (campo modificado)

| Campo | Tipo | Descripción | Cambio |
|---|---|---|---|
| `f0_template_hz` | `array<float>` | F0 real en Hz por sílaba del audio entonado, detectado por autocorrelación | Antes era estimación H/L; ahora es pitch real del audio grabado |

### Solo para `nivel_clinico == 3` (campos nuevos)

| Campo | Tipo | Descripción |
|---|---|---|
| `onsets_ms_sprechgesang` | `array<int>` | Inicio de cada sílaba en el audio sprechgesang (ms) |
| `durations_ms_sprechgesang` | `array<int>` | Duración de cada sílaba en el audio sprechgesang (ms) |
| `audio_duration_ms_sprechgesang` | `int` | Duración total del audio sprechgesang (ms) |
| `f0_template_hz_sprechgesang` | `array<float>` | F0 en Hz por sílaba del audio sprechgesang |
| `onsets_ms_habla_normal` | `array<int>` | Inicio de cada sílaba en el audio habla normal (ms) |
| `durations_ms_habla_normal` | `array<int>` | Duración de cada sílaba en el audio habla normal (ms) |
| `audio_duration_ms_habla_normal` | `int` | Duración total del audio habla normal (ms) |
| `f0_template_hz_habla_normal` | `array<float>` | F0 en Hz por sílaba del audio habla normal |

---

## Cómo se calculan los valores

### Timings (`onsets_ms`, `durations_ms`, `audio_duration_ms`)

Algoritmo proporcional uniforme (mismo que ya usaban para entonado):

- 8% de la duración total = silencio inicial (máx 80 ms)
- 5% de la duración total = silencio final (máx 50 ms)
- El 87% restante se divide equitativamente entre las `n` sílabas
- Todas las sílabas reciben el mismo peso (aproximación — no es forced alignment)

```
spacing = (audio_duration_ms - silence_start - silence_end) / n
onset[i]    = silence_start + i * spacing
duration[i] = spacing - 20ms  (última sílaba: hasta el final del audio)
```

### F0 (`f0_template_hz`, `f0_template_hz_sprechgesang`, `f0_template_hz_habla_normal`)

Detectado con **autocorrelación** sobre el PCM del audio, calculado en el navegador con `AudioContext`:

1. Decodifica el WebM a PCM con `AudioContext.decodeAudioData()`
2. Mezcla todos los canales a mono
3. Para cada sílaba (usando su ventana `[onset_ms … onset_ms + duration_ms]`):
   - Extrae los samples de esa ventana
   - Aplica autocorrelación normalizada en el rango de lags correspondiente a 80–800 Hz (voz humana típica)
   - Elige el lag con mayor correlación
   - Si la correlación normalizada es < 0.3, considera la sílaba **no vocalizada** y devuelve `0`
   - Si no, calcula `F0 = sample_rate / best_lag` (redondeado a 1 decimal)
4. Resultado: un array de `n` floats, uno por sílaba

**Notas importantes:**
- Un valor `0.0` significa que esa sílaba no se detectó como vocalizada (silencio, fricativa, etc.)
- Los valores son una estimación; no es un analizador de pitch profesional (no usa YIN ni CREPE)
- Si la detección falla completamente, se guarda `[]` (array vacío) — la app móvil debe manejarlo

---

## Compatibilidad retroactiva

- **Estímulos N1 y N2**: no se modifican; siguen teniendo solo `onsets_ms`, `durations_ms`, `audio_duration_ms` y `f0_template_hz` del entonado
- **Estímulos N3 creados antes de esta actualización**: no tienen los nuevos campos (`onsets_ms_sprechgesang`, etc.) — la app debe leer con fallback a `[]` / `0`
- **`f0_template_hz` en estímulos anteriores**: sigue siendo la estimación H/L; solo los nuevos tendrán el pitch real

---

## Ejemplo de documento Firestore N3 (campos relevantes)

```json
{
  "texto": "El gato come",
  "nivel_clinico": 3,
  "syllables": ["El", "ga", "to", "co", "me"],
  "patron_tonal": "LHLHL",

  "audio_url": "gs://apphasia-7a930.appspot.com/tem_recordings/abc_audio.webm",
  "audio_duration_ms": 2400,
  "onsets_ms": [192, 630, 1068, 1506, 1944],
  "durations_ms": [418, 418, 418, 418, 456],
  "f0_template_hz": [142.3, 218.7, 134.2, 210.5, 128.9],

  "audio_url_sprechgesang": "gs://apphasia-7a930.appspot.com/tem_recordings/def_audio.webm",
  "audio_duration_ms_sprechgesang": 2650,
  "onsets_ms_sprechgesang": [212, 688, 1164, 1640, 2116],
  "durations_ms_sprechgesang": [456, 456, 456, 456, 534],
  "f0_template_hz_sprechgesang": [138.1, 0.0, 131.5, 198.4, 125.2],

  "audio_url_habla_normal": "gs://apphasia-7a930.appspot.com/tem_recordings/ghi_audio.webm",
  "audio_duration_ms_habla_normal": 2100,
  "onsets_ms_habla_normal": [168, 546, 924, 1302, 1680],
  "durations_ms_habla_normal": [358, 358, 358, 358, 420],
  "f0_template_hz_habla_normal": [0.0, 0.0, 0.0, 0.0, 0.0],

  "video_url": "gs://...",
  "video_url_sprechgesang": "gs://...",
  "video_url_habla_normal": "gs://..."
}
```

> Nota: el array de F0 de habla normal con todos ceros es un caso válido (habla sin entonación → difícil detectar pitch fundamental).

---

## Patrón de lectura sugerido para la app móvil

```dart
// Leer con fallback para retrocompatibilidad
final onsetsEntonado    = (doc['onsets_ms']    as List?)?.cast<int>() ?? [];
final onsetsSprech      = (doc['onsets_ms_sprechgesang'] as List?)?.cast<int>() ?? [];
final onsetsHabla       = (doc['onsets_ms_habla_normal'] as List?)?.cast<int>() ?? [];

final f0Entonado        = (doc['f0_template_hz'] as List?)?.cast<double>() ?? [];
final f0Sprech          = (doc['f0_template_hz_sprechgesang'] as List?)?.cast<double>() ?? [];
final f0Habla           = (doc['f0_template_hz_habla_normal'] as List?)?.cast<double>() ?? [];
```

---

## Archivos modificados en la web

| Archivo | Cambio |
|---|---|
| `src/utils/audioTimings.js` | Nueva función exportada `detectF0PerSyllable(audioFile, onsets_ms, durations_ms)` |
| `src/components/addExercise/AddTEMStimulus.jsx` | `handleRecordingComplete2/3` ahora calculan timings + F0; `handleSave` pasa los 8 nuevos campos |
| `src/services/temService.js` | `createTEMStimulus` escribe los 8 campos nuevos en N3; `f0_template_hz` usa el pitch real del audio |
