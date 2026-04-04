# Implementación de Creación de Estímulos TEM — Documento de Traspaso

> **Contexto:** Este documento describe todo lo implementado en la fase de *creación de estímulos TEM* desde la aplicación web de terapeuta (`Web-App-RehabilitIA`). Su propósito es contextualizar al equipo de la app móvil sobre el nuevo modelo de datos, las URLs de recursos y el flujo esperable para consumir los estímulos.
>
> **Última actualización:** 31 de marzo de 2026 — refactorización a grabación dual sincronizada (audio + video en un solo QR), despliegue en producción (`https://apphasia.me`), validaciones de campos obligatorios y detección de duplicados.

---

## 1. Resumen del flujo

El terapeuta crea un estímulo TEM desde la pestaña **Ejercicios → TEM** del panel web (`https://apphasia.me`), mediante un wizard de **4 pasos** (reducido desde 5 — ver cambios en sección 11):

1. **Texto y nivel clínico** → silabificación automática + patrón tonal editable + validación clínica de la rúbrica + detección de duplicados
2. **Grabación dual (audio + video)** → un único QR con el celular graba video con audio simultáneamente; el sistema separa automáticamente ambas pistas
3. **Imagen y contexto** → subir imagen de referencia (obligatoria) + pregunta del paso 5 (obligatoria) + categoría/contexto (obligatorio)
4. **Resumen + guardar** → previsualización de audio y video grabados; al confirmar se guarda el documento en Firestore (`stimuli_TEM`)

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
| `video_url` | string | URL gs:// del video de labios **sin audio** en Firebase Storage |
| `creado_por` | string | UID del terapeuta que creó el estímulo |
| `fecha_creacion` | string | ISO 8601 timestamp de creación. Ej: `"2026-03-26T05:08:45.665Z"` |

> ⚠️ **Importante para la app móvil:** `audio_url` y `video_url` provienen de la misma grabación original del celular (mismo stream). El audio fue capturado junto al video y luego separado en pistas independientes. Esto garantiza **sincronización perfecta** entre ambos archivos — el frame 0 del video corresponde exactamente al sample 0 del audio.

### ID del documento

El `docId` sigue el patrón: `ST_TEM_N{nivel}_{timestamp_ms}`

Ejemplo: `ST_TEM_N1_1774501723801`

### Ejemplo completo de documento (esquema actualizado)

```json
{
  "texto": "Marmota",
  "syllables": ["mar", "mo", "ta"],
  "num_silabas": 3,
  "patron_tonal": "LHL",
  "nivel_clinico": 1,
  "categoria": "Animales",
  "pregunta": "¿Qué animal es el de la foto?",
  "audio_url": "gs://apphasia-7a930.firebasestorage.app/tem_recordings/rec_mn70cn5r_29bx1flj_audio.webm",
  "audio_duration_ms": 4920,
  "onsets_ms": [80, 1677, 3274],
  "durations_ms": [1577, 1577, 1646],
  "imagen_url": "gs://apphasia-7a930.firebasestorage.app/tem_stimuli/ST_TEM_N1_1774501723801/imagen.png",
  "video_url": "gs://apphasia-7a930.firebasestorage.app/tem_recordings/rec_mn70cn5r_29bx1flj_video.webm",
  "creado_por": "JlS6OPiBvqV9QtFIh3kfl9ZdcIk2",
  "fecha_creacion": "2026-03-26T05:08:45.665Z"
}
```

Nótese que **ambos archivos comparten el mismo token base** (`rec_mn70cn5r_29bx1flj`) diferenciados por sufijo `_audio` y `_video.

---

## 3. Firebase Storage — rutas de archivos

| Tipo de archivo | Ruta en Storage | Sufijo |
|---|---|---|
| Audio de referencia (sin video) | `tem_recordings/{token}_audio.webm` | `_audio` |
| Video de labios (sin audio) | `tem_recordings/{token}_video.webm` | `_video` |
| Imagen del estímulo | `tem_stimuli/{docId}/imagen.{ext}` | — |

> ⚠️ **Cambio respecto a estímulos anteriores:** Los estímulos creados antes del 31 de marzo de 2026 tienen sus archivos en `tem_recordings/{token}.webm` (sin sufijo `_audio`/`_video`). Ver sección 8 para compatibilidad retroactiva.

Todos los campos `*_url` en Firestore usan el esquema `gs://` que es el path interno de Firebase Storage. Para obtener una URL descargable HTTPS se debe llamar a `getDownloadURL(ref(storage, gsUrl))`.

### Codecs y compatibilidad

| Archivo | Contenedor | Codec | Pistas |
|---|---|---|---|
| `_audio.webm` | WebM | Opus | Solo audio |
| `_video.webm` | WebM | VP8 | Solo video, sin audio |

- **Android** con ExoPlayer ≥ 2.x: soporta ambos formatos nativamente.
- **iOS** con AVPlayer: WebM/VP8 **no está soportado nativamente** — se requiere una librería como `libvpx` o transcodificar a MP4/H.264 + AAC en el servidor antes de entregar a iOS.
- **Alternativa iOS**: usar un player basado en WebView (`WKWebView`) que sí soporta WebM via MSE.

### Reglas de seguridad de Firebase Storage (actuales)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Estímulos — solo terapeutas autenticados con cuenta real (no anónimos)
    match /tem_stimuli/{allPaths=**} {
      allow read, write: if request.auth != null
                         && request.auth.token.firebase.sign_in_provider != 'anonymous';
    }
    // Grabaciones QR — requiere auth anónima (solo clientes legítimos del app)
    match /tem_recordings/{recordingId} {
      allow write: if request.auth != null
                   && request.resource.size < 100 * 1024 * 1024;
      allow read: if request.auth != null;
    }
  }
}
```

La página de grabación del celular (`/grabar/:token`) inicia sesión **anónima** en Firebase antes de subir. Esto garantiza que solo clientes con la configuración legítima del proyecto puedan escribir en Storage.

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

## 7. Sistema de grabación QR — flujo dual sincronizado

### Cambio clave respecto a versión anterior

| | Versión anterior | Versión actual |
|---|---|---|
| QRs por estímulo | 2 (audio + video por separado) | **1** (audio + video simultáneo) |
| Sincronización | Manual (terapeuta sincroniza) | **Automática** (mismo stream) |
| Tipo en Firestore | `"audio"` o `"video"` | `"video_audio"` |
| Archivos subidos | 1 archivo por sesión | **2 archivos por sesión** (`_audio` + `_video`) |

### Flujo en el celular

1. El terapeuta escanea el QR desde el wizard
2. En el celular se abre `https://apphasia.me/grabar/{token}` (página pública, sin login)
3. El usuario toca **"Activar cámara"** — se muestra la vista en vivo
4. Puede cambiar entre **cámara frontal** y **trasera** con un botón
5. Toca el botón rojo para **grabar** — internamente se abren DOS `MediaRecorder` sobre el mismo stream:
   - `recorderAudio` → captura solo la pista de audio → `{token}_audio.webm`
   - `recorderVideo` → captura solo la pista de video → `{token}_video.webm`
6. Al detener, ve **preview del video** (para verificar los labios) y un **player de audio** (para verificar que el sonido quedó bien)
7. Toca **"Confirmar y enviar"** → ambos archivos se suben simultáneamente a Storage → Firestore se actualiza con `audioStorageUrl` y `videoStorageUrl`
8. El desktop detecta el cambio vía `onSnapshot` y automáticamente avanza el wizard

### Colección `pending_recordings` (auxiliar, no permanente)

```
pending_recordings / {token}
  type: "video_audio"          ← nuevo tipo unificado
  therapistId: string
  status: "pending" | "completed"
  storageUrl: string           ← igual a videoStorageUrl (compatibilidad)
  audioStorageUrl: string      ← gs:// del archivo _audio.webm  ← NUEVO
  videoStorageUrl: string      ← gs:// del archivo _video.webm  ← NUEVO
  fileName: string             ← nombre del archivo de video
  createdAt: Timestamp
  metadata: { stimulusText: string, nivel: number }
```

Esta colección es **auxiliar** y solo existe durante el proceso de creación. Los `audioStorageUrl` y `videoStorageUrl` son los que se copian a `stimuli_TEM` como `audio_url` y `video_url`.

---

## 8. Estímulos existentes antes del 31 de marzo de 2026

Los estímulos creados **antes** de esta actualización pueden estar incompletos respecto al esquema actual. En particular:

| Campo | Estado en estímulos anteriores | Acción recomendada en la app |
|---|---|---|
| `video_url` | Puede estar vacío o apuntar a un `.webm` con audio incluido | Si vacío → no mostrar player de video |
| `audio_url` | Apunta a `{token}.webm` (sin sufijo `_audio`) y **puede contener video+audio** | Reproducir normalmente — el audio es válido |
| `creado_por` | Ausente | Ignorar |
| `fecha_creacion` | Ausente | Ignorar |
| `onsets_ms` / `durations_ms` | Pueden estar vacíos | Si vacíos → calcular proporcional en cliente |

> **Regla simple:** Si `video_url` apunta a un archivo sin sufijo `_video`, es un estímulo antiguo donde el video SÍ contiene audio. Si apunta a `_video.webm`, es un estímulo nuevo donde el video es muto y el audio está en `_audio.webm` (= `audio_url`).

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

## 10. URL de producción y despliegue

La app web está desplegada en:

**`https://apphasia.me`**

Infraestructura:
- **Servidor:** VM Ubuntu 22.04 (10.43.101.11) — red privada Pontificia Universidad Javeriana
- **Contenedor:** Docker (`juanpita0412/rehabilitia:latest` en Docker Hub), servido por nginx
- **Túnel:** Cloudflare Tunnel (`rehabilitia-vm`) → expone el puerto 80 de la VM al dominio `apphasia.me` con HTTPS automático
- **Dominio:** `apphasia.me` registrado en Namecheap, DNS administrado por Cloudflare

El QR de grabación apunta a `https://apphasia.me/grabar/{token}` — esta URL es pública y accesible desde cualquier celular con internet, sin importar si está en la red universitaria o no.

---

## 11. Checklist actualizado para la app móvil

- [ ] Resolver URLs `gs://` → HTTPS usando Firebase Storage SDK antes de mostrar medios
- [ ] Soportar reproducción de audio **WebM/Opus** (`_audio.webm`)
- [ ] Soportar reproducción de video **WebM/VP8** sin audio (`_video.webm`)
- [ ] Reproducir audio y video **en paralelo sincronizado** (mismo `currentTime`, iniciar juntos)
- [ ] Implementar fallback si `video_url` está vacío (estímulos anteriores)
- [ ] Detectar estímulos antiguos: si `video_url` no tiene sufijo `_video`, el video contiene audio → no reproducir audio separado
- [ ] Usar `onsets_ms` y `durations_ms` para animación sincronizada de sílabas (o computar proporcional si están vacíos con `audio_duration_ms / num_silabas`)
- [ ] Usar `patron_tonal` para la guía de entonación (H = tono alto, L = tono bajo)
- [ ] Filtrar estímulos por `nivel_clinico` al iniciar sesión TEM con un paciente
- [ ] Tratar `pregunta` como la pregunta del **Paso 5** del protocolo TEM
- [ ] Los campos `creado_por` y `fecha_creacion` son informativos, no necesarios para la terapia
- [ ] Considerar compatibilidad de WebM/VP8 en iOS (ExoPlayer en Android ✅, AVPlayer en iOS ❌ → requiere librería adicional o transcodificación)
