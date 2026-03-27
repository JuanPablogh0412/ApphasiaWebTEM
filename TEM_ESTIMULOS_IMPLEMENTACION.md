# Implementación de Creación de Estímulos TEM — Documento de Traspaso

> **Contexto:** Este documento describe todo lo implementado en la fase de *creación de estímulos TEM* desde la aplicación web de terapeuta (`Web-App-RehabilitIA`). Su propósito es contextualizar al equipo de la app móvil sobre el nuevo modelo de datos, las URLs de recursos y el flujo esperable para consumir los estímulos.

---

## 1. Resumen del flujo

El terapeuta crea un estímulo TEM desde la pestaña **Ejercicios → TEM** del panel web, mediante un wizard de 5 pasos:

1. **Texto y nivel clínico** → silabificación automática + patrón tonal + validación clínica de la rúbrica
2. **Grabación de audio** → escanear QR con el celular y grabar el audio de referencia
3. **Grabación de video de labios** → escanear QR con el celular y grabar el modelo articulatorio
4. **Imagen y contexto** → subir imagen representativa + pregunta del paso 5 + categoría
5. **Resumen + guardar** → guarda el documento en Firestore (`stimuli_TEM`) con todos los campos

Al finalizar, el estímulo queda disponible de inmediato en la colección raíz `stimuli_TEM` de Firestore para ser consumido por la app móvil.

---

## 2. Modelo de datos — colección `stimuli_TEM`

Cada documento en `stimuli_TEM` tiene el siguiente esquema (todos los campos son escritos por la web):

```
stimuli_TEM / {docId}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `texto` | string | Frase o palabra del estímulo. Ej: `"Marmota"` |
| `syllables` | string[] | Sílabas separadas. Ej: `["mar", "mo", "ta"]` |
| `num_silabas` | int | Cantidad de sílabas. Ej: `3` |
| `patron_tonal` | string | Patrón H (alto) / L (bajo) por sílaba. Ej: `"LHL"` |
| `nivel_clinico` | int | Nivel TEM: `1`, `2` o `3` |
| `categoria` | string | Categoría semántica. Ej: `"Animales"` |
| `pregunta` | string | Pregunta del paso 5 de la terapia. Ej: `"¿Qué animal es el de la foto?"` |
| `audio_url` | string | URL gs:// del audio de referencia en Firebase Storage |
| `audio_duration_ms` | int | Duración total del audio en milisegundos |
| `onsets_ms` | int[] | Tiempo de inicio de cada sílaba en ms desde el inicio del audio |
| `durations_ms` | int[] | Duración de cada sílaba en ms |
| `imagen_url` | string | URL gs:// de la imagen en Firebase Storage |
| `video_url` | string | URL gs:// del video de labios en Firebase Storage |
| `creado_por` | string | UID del terapeuta que creó el estímulo |
| `fecha_creacion` | string | ISO 8601 timestamp de creación. Ej: `"2026-03-26T05:08:45.665Z"` |

### ID del documento

El `docId` sigue el patrón: `ST_TEM_N{nivel}_{timestamp_ms}`

Ejemplo: `ST_TEM_N1_1774501723801`

### Ejemplo completo de documento real (Firestore)

```json
{
  "texto": "Marmota",
  "syllables": ["mar", "mo", "ta"],
  "num_silabas": 3,
  "patron_tonal": "LHL",
  "nivel_clinico": 1,
  "categoria": "Animales",
  "pregunta": "¿Qué animal es el de la foto?",
  "audio_url": "gs://apphasia-7a930.firebasestorage.app/tem_recordings/rec_mn70cn5r_29bx1flj.webm",
  "audio_duration_ms": 4920,
  "onsets_ms": [80, 1677, 3274],
  "durations_ms": [1577, 1577, 1646],
  "imagen_url": "gs://apphasia-7a930.firebasestorage.app/tem_stimuli/ST_TEM_N1_1774501723801/imagen.png",
  "video_url": "gs://apphasia-7a930.firebasestorage.app/tem_recordings/rec_mn70ee6m_e3d1luhk.webm",
  "creado_por": "JlS6OPiBvqV9QtFIh3kfl9ZdcIk2",
  "fecha_creacion": "2026-03-26T05:08:45.665Z"
}
```

---

## 3. Firebase Storage — rutas de archivos

| Tipo de archivo | Ruta en Storage |
|---|---|
| Audio de referencia | `tem_recordings/{token}.webm` |
| Video de labios | `tem_recordings/{token}.webm` |
| Imagen del estímulo | `tem_stimuli/{docId}/imagen.{ext}` |

Todos los campos `*_url` en Firestore usan el esquema `gs://` que es el path interno de Firebase Storage. Para obtener una URL descargable HTTPS se debe llamar a `getDownloadURL(ref(storage, gsUrl))`.

### Importante para la app móvil
- **No** hardcodear las URLs HTTPS — siempre resolver a partir del `gs://` almacenado en Firestore.
- Los archivos de audio y video están en formato **WebM** (codec opus para audio, VP8+opus para video), grabados desde el navegador móvil. Verificar compatibilidad del player en la app.
- Si la app usa `ExoPlayer` (Android) o `AVPlayer` (iOS), ambos soportan WebM/VP8+Opus en versiones recientes.

---

## 4. Timings de sílabas — `onsets_ms` y `durations_ms`

Estos arrays permiten mostrar animación sincronizada sílaba por sílaba durante la reproducción del audio.

- `onsets_ms[i]` = milisegundo exacto en el que empieza la sílaba `i`
- `durations_ms[i]` = duración en ms de la sílaba `i`

**Algoritmo de generación (proporcional):**
1. Se reserva un 8% del audio como silencio inicial
2. Se reserva un 5% del audio como silencio final
3. El tiempo restante (87%) se divide proporcionalmente entre las `n` sílabas
4. Actualmente todas las sílabas reciben el mismo peso (duración uniforme)

Esto es una **aproximación automática**. En una mejora futura se puede reemplazar por timings detectados por el modelo de voz en la app móvil.

---

## 5. Patrón tonal — `patron_tonal`

Es un string de caracteres `H` (tono alto) y `L` (tono bajo), uno por sílaba.

- Generado automáticamente desde las reglas de acentuación del español (llanas, agudas, esdrújulas, con tilde explícita)
- El terapeuta puede editarlo manualmente antes de guardar
- La app móvil debe usar este patrón para la guía visual/auditiva de entonación durante la terapia

Ejemplos:
- `"ma-má"` → `"LH"` (aguda)
- `"mar-mo-ta"` → `"LHL"` (llana)
- `"mú-si-ca"` → `"HLL"` (esdrújula)

---

## 6. Validación clínica (Rúbrica TEM — Cap. 16)

Los estímulos son validados antes de guardarse contra la rúbrica clínica del Manual de la Afasia (Cap. 16). La validación es obligatoria y no permite guardar si hay errores.

| Bloque | Aplica a | Regla principal |
|---|---|---|
| A | Todos | Mínimo 2 sílabas, patrón tonal longitud correcta, solo H/L |
| B | Nivel 1 | 2–3 sílabas, sin grupos consonánticos (bl, tr, pr...), preferencia bilabiales (p,b,m) |
| C | Nivel 2 | 2–5 sílabas, grupos consonánticos tolerados con advertencia |
| D | Nivel 3 | Oración completa ≥4 palabras, recomendado ≤8 palabras |
| E | Todos | Prohibición de monosílabos |

---

## 7. Sistema de grabación QR

Para grabar audio y video, la web genera un token único y un código QR que apunta a:

```
https://{dominio}/grabar/{token}
```

El terapeuta escanea el QR con su celular. La página `/grabar/:token` es **pública** (sin autenticación) y permite:
- Grabar audio (WebM, Opus) o video (WebM, VP8+Opus, cámara frontal)
- Ver preview antes de confirmar
- Subir el archivo a Firebase Storage bajo `tem_recordings/{token}.webm`
- Actualizar el documento `pending_recordings/{token}` en Firestore con `status: "completed"` y el `storageUrl`

La web escucha en tiempo real (onSnapshot) ese documento y, al detectar `status: "completed"`, obtiene el `storageUrl` y lo guarda en el estado del wizard.

### Colección `pending_recordings` (auxiliar, no permanente)

```
pending_recordings / {token}
  type: "audio" | "video"
  therapistId: string
  status: "pending" | "completed"
  storageUrl: string   (gs://)
  createdAt: Timestamp
  metadata: { stimulusText: string }
```

Esta colección es **auxiliar** y solo existe durante el proceso de creación. Los `storageUrl` resultantes son los que se copian a `stimuli_TEM`.

---

## 8. Estímulos existentes antes de esta implementación

Los estímulos que existían en `stimuli_TEM` **antes** de esta actualización pueden estar incompletos respecto al nuevo esquema. En particular, les pueden faltar los campos:

- `video_url` — no existía antes (campo nuevo)
- `creado_por` — no existía antes
- `fecha_creacion` — no existía antes
- `onsets_ms` / `durations_ms` — pueden estar vacíos si no se generaron timings

**Recomendación para la app móvil:** tratar todos estos campos como opcionales y tener fallbacks:
- Si `video_url` está vacío → no mostrar el reproductor de video
- Si `onsets_ms` está vacío → reproducir el audio sin animación de sílabas, o calcular timings proporcionales en el cliente usando `audio_duration_ms` y `syllables.length`
- Si `imagen_url` está vacío → mostrar placeholder

---

## 9. Colecciones relevantes para la app móvil

Todas las colecciones TEM son **colecciones raíz** en Firestore (no subcolecciones):

| Colección | Descripción |
|---|---|
| `stimuli_TEM` | Catálogo global de estímulos creados por terapeutas |
| `sesiones_TEM` | Sesiones de terapia por paciente (`pacienteId`, `nivel`, `status`) |
| `analysis_results_TEM` | Resultados de análisis por intento (`sessionId`, `stimulusId`, `paso`) |
| `ejercicios_TEM` | Ejercicios asignados a pacientes (vincula paciente ↔ estímulo) |
| `contextos` | Catálogo de categorías/contextos (`contexto: "Animales"`) |
| `pending_recordings` | Auxiliar para el sistema de grabación QR (solo durante creación) |

---

## 10. Checklist para la app móvil

- [ ] Resolver URLs `gs://` → HTTPS usando Firebase Storage SDK antes de mostrar medios
- [ ] Soportar reproducción de audio **WebM/Opus**
- [ ] Soportar reproducción de video **WebM/VP8+Opus**
- [ ] Implementar fallback si `video_url` está vacío
- [ ] Usar `onsets_ms` y `durations_ms` para animación sincronizada de sílabas (o computar proporcional si están vacíos)
- [ ] Usar `patron_tonal` para la guía de entonación (H = solicitar tono alto, L = tono bajo)
- [ ] Filtrar estímulos por `nivel_clinico` al iniciar sesión TEM con un paciente
- [ ] Tratar `pregunta` como la pregunta del **Paso 5** del protocolo TEM
- [ ] Los campos `creado_por` y `fecha_creacion` son informativos, no necesarios para la terapia
