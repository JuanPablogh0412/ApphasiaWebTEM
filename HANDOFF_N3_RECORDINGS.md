# Handoff: Grabaciones triples para estímulos TEM Nivel 3

## Contexto clínico

En la Terapia de Entonación Melódica (TEM), el **Nivel 3** introduce tres modalidades de presentación del mismo estímulo, en orden de mayor a menor carga melódica:

| # | Modalidad | Descripción |
|---|-----------|-------------|
| 1 | **Entonado** | Melodía completa, tal como se usa en los niveles anteriores |
| 2 | **Sprechgesang** | Melodía suavizada / intermedia (habla-canto) |
| 3 | **Habla normal** | Sin melodía, producción natural del habla |

---

## Cambios en Firestore (`stimuli_TEM`)

Los documentos de nivel 3 ahora contienen **6 campos de medios** en vez de 2:

```
// Siempre presentes (todos los niveles)
audio_url              : "gs://apphasia-7a930.appspot.com/..."   // Entonado — audio
video_url              : "gs://apphasia-7a930.appspot.com/..."   // Entonado — video

// Solo cuando nivel_clinico === 3
audio_url_sprechgesang : "gs://apphasia-7a930.appspot.com/..."   // Sprechgesang — audio
video_url_sprechgesang : "gs://apphasia-7a930.appspot.com/..."   // Sprechgesang — video
audio_url_habla_normal : "gs://apphasia-7a930.appspot.com/..."   // Habla normal — audio
video_url_habla_normal : "gs://apphasia-7a930.appspot.com/..."   // Habla normal — video
```

> **Nota:** Los campos extras solo existen en documentos con `nivel_clinico === 3`. En N1 y N2 siguen siendo solo `audio_url` y `video_url`.

---

## Cómo detectar si un estímulo es N3 con triple grabación

```js
const isN3Triple =
  stimulus.nivel_clinico === 3 &&
  stimulus.audio_url_sprechgesang &&
  stimulus.video_url_sprechgesang &&
  stimulus.audio_url_habla_normal &&
  stimulus.video_url_habla_normal;
```

---

## Flujo sugerido en la app móvil (paso de terapia N3)

El terapeuta debe presentar los 3 estímulos en secuencia dentro de la misma sesión:

```
1. Reproducir Entonado       → audio_url / video_url
2. Reproducir Sprechgesang   → audio_url_sprechgesang / video_url_sprechgesang
3. Reproducir Habla normal   → audio_url_habla_normal / video_url_habla_normal
```

Se recomienda mostrar una etiqueta visible con la modalidad activa para que el terapeuta sepa en qué fase está.

---

## stimulusText en las sesiones de grabación QR

Cuando la web crea una sesión de grabación QR para N3, el campo `stimulusText` de Firestore (`pending_recordings`) incluye el sufijo de la modalidad:

```
Slot 1 → "{texto} (Entonado — melodía completa)"
Slot 2 → "{texto} (Sprechgesang — melodía suavizada)"
Slot 3 → "{texto} (Habla normal — sin melodía)"
```

Esto permite que `MobileRecorder` muestre el texto correcto al terapeuta que graba desde el celular.

---

## Campos de referencia del documento `stimuli_TEM` (N3 completo)

```jsonc
{
  "texto": "El gato come pescado",
  "syllables": ["El", "ga", "to", "co", "me", "pes", "ca", "do"],
  "num_silabas": 8,
  "patron_tonal": "HLHLHLHL",
  "f0_template_hz": [220, 180, 220, 180, 220, 180, 220, 180],
  "nivel_clinico": 3,
  "categoria": "animales",
  "pregunta": "¿Qué está haciendo el gato?",
  "audio_url": "gs://...",
  "audio_duration_ms": 2400,
  "onsets_ms": [0, 300, 600, ...],
  "durations_ms": [280, 280, 280, ...],
  "imagen_url": "gs://...",
  "video_url": "gs://...",
  "audio_url_sprechgesang": "gs://...",
  "video_url_sprechgesang": "gs://...",
  "audio_url_habla_normal": "gs://...",
  "video_url_habla_normal": "gs://...",
  "creado_por": "uid_terapeuta",
  "fecha_creacion": "2026-04-29T...",
  "estado": "aprobado"
}
```
