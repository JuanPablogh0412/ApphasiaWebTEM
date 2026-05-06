# Briefing Técnico — Empalme Móvil ↔ Web para Asignación de Ejercicios TEM

> **Propósito:** Guía para el agente web que va a implementar el sistema de asignación de estímulos TEM por parte del terapeuta. Describe cómo funciona actualmente la app móvil, qué datos consume, y qué debe crear la parte web para que el empalme sea correcto.

---

## 1. Colecciones actuales en Firestore (lo que ya existe)

| Colección | Descripción |
|---|---|
| `stimuli_TEM/{stimulusId}` | Estímulos clínicos con todos sus medios (audio, video, imagen) |
| `ejercicios/{ejercicioId}` | Registro general común a todas las terapias del sistema |
| `ejercicios_TEM/{ejercicioId}` | Dato específico TEM; apunta a `ejercicios/` y a `sesiones_TEM/` |
| `sesiones_TEM/{sessionId}` | Detalle clínico de cada sesión realizada por un paciente |
| `pacientes/{uid}` | Perfil del paciente: `nivel_actual`, `calibracion`, etc. |

---

## 2. Cómo la app móvil selecciona estímulos HOY (flujo actual)

```
startSession(uid)
  → getNivelActual(pacienteId)          ← lee pacientes/{uid}.nivel_actual
  → getStimuliForNivel(nivel)           ← lee stimuli_TEM donde:
                                             nivel_clinico == nivel
                                             AND estado == 'aprobado'
  → aplica 5 reglas anti-perseveración  ← algoritmo local en SessionManager
  → crea ejercicios/{ejercicioId}
  → crea ejercicios_TEM/{ejercicioId}   ← campo estimulosSecuencia: [stimId1, stimId2, ...]
  → crea sesiones_TEM/{sessionId}       ← campo estimulosSecuencia: [stimId1, stimId2, ...]
```

**El problema actual:** el algoritmo elige estímulos automáticamente sin ningún input del terapeuta. El terapeuta no controla qué estímulos ve el paciente.

---

## 3. Campos clave de `stimuli_TEM/{stimulusId}`

Estos son los campos que la app móvil consume directamente al reproducir un estímulo:

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | ID del documento Firestore |
| `texto` | string | Palabra/frase del estímulo (ej. `"mamá"`) |
| `nivel_clinico` | int | 1, 2 ó 3 |
| `estado` | string | **Debe ser `"aprobado"`** para que la móvil lo cargue |
| `patron_tonal` | string | ej. `"LH"`, `"LHL"` — usado para la regla anti-perseveración |
| `num_silabas` | int | Número de sílabas de la palabra |
| `audio_url` | string | `gs://...` — just_audio lo reproduce |
| `video_url` | string | `gs://...` — media_kit lo reproduce (formato WebM) |
| `imagen_url` | string | `gs://...` — imagen del concepto (formato AVIF) |
| `audio_duration_ms` | int | **Crítico** — duración del audio en ms; necesario para que el paso 3 (completion) funcione |
| `syllables` | list\<string\> | Sílabas separadas: `["ma", "má"]` — para resaltado visual |
| `onsets_ms` | list\<int\> | Tiempos de inicio de cada sílaba en ms |
| `durations_ms` | list\<int\> | Duración de cada sílaba en ms |
| `pregunta` | string | Pregunta que se muestra al paciente en el paso 5 |
| `num_completions` | int | Contador de completions exitosas (regla 4 del algoritmo) |
| `fallos_consecutivos` | int | Contador de fallos consecutivos (regla 3 del algoritmo) |

---

## 4. Campos de `ejercicios_TEM/{ejercicioId}` que la móvil lee

```json
{
  "id_ejercicio_general": "E0A1B2",         // enlace a ejercicios/{id}
  "sesion_tem_id":        "SES_1234567890", // enlace a sesiones_TEM/{id}
  "nivel":                1,
  "estimulosSecuencia":   ["ST_TEM_N1_xxx", "ST_TEM_N1_yyy", ...],
  "status":               "in_progress",
  "startedAt":            Timestamp,
  "scoreSesion":          null
}
```

La móvil itera `estimulosSecuencia` uno por uno, carga cada `stimuli_TEM/{id}` con un `getDoc` individual, y ejecuta el protocolo de 5 pasos sobre él.

---

## 5. Nueva colección propuesta: `asignaciones_TEM/{asignacionId}`

Esta es la colección que el **agente web debe crear**. La app móvil la consultará antes de aplicar el algoritmo automático.

```json
{
  "terapeutaId":   "uid_terapeuta",
  "pacienteId":    "uid_paciente",
  "estimulosIds":  ["ST_TEM_N1_xxx", "ST_TEM_N1_yyy", "ST_TEM_N1_zzz"],
  "nivel":         1,
  "createdAt":     Timestamp,
  "activaDesde":   Timestamp,
  "activa":        true,
  "notas":         "Texto libre del terapeuta — observaciones clínicas"
}
```

| Campo | Notas |
|---|---|
| `terapeutaId` | UID del terapeuta autenticado que crea la asignación |
| `pacienteId` | UID del paciente al que se asigna |
| `estimulosIds` | Lista de IDs de `stimuli_TEM` seleccionados por el terapeuta. **Mínimo recomendado: 5.** La móvil rellena hasta 10 con el algoritmo si hay menos |
| `nivel` | Nivel clínico de los estímulos asignados (debe coincidir con `nivel_actual` del paciente) |
| `activa` | `true` = esta asignación está vigente. Solo puede haber una activa por paciente a la vez |
| `activaDesde` | Permite programar asignaciones futuras |
| `notas` | Campo libre para el terapeuta |

---

## 6. Lógica de prioridad que la móvil aplicará (cambios en mi parte — post web)

```
Al iniciar sesión:
  1. Consultar asignaciones_TEM donde:
       pacienteId == uid
       AND activa == true
       AND activaDesde <= now()

  2. Si existe asignación activa:
       → Cargar sus estimulosIds
       → Filtrar solo los que tienen estado == 'aprobado' en stimuli_TEM
       → Usar esa lista como candidatos (aplicando reglas anti-perseveración al subconjunto)

  3. Si NO existe asignación activa:
       → Comportamiento actual sin cambios (algoritmo automático completo)
```

**El resto del flujo no cambia en absoluto:** creación de sesiones, FSM de 5 pasos, grabación, evaluación — todo igual.

---

## 7. Restricciones que el agente web DEBE respetar

| Restricción | Motivo |
|---|---|
| Solo incluir estímulos con `estado == "aprobado"` | La móvil lanza error `StateError` si carga un estímulo no aprobado |
| El `nivel` de los estímulos debe coincidir con `nivel_actual` del paciente en `pacientes/{uid}` | La FSM asume que todos los estímulos de la sesión son del mismo nivel clínico |
| `audio_duration_ms` es un campo obligatorio en el estímulo | Sin él, el paso 3 (completion — el audio se silencia a la mitad) se ignora silenciosamente |
| `estimulosSecuencia` en Firestore son listas de IDs (strings), no objetos completos | La móvil hace un `getDoc` individual por cada ID |
| La lista `estimulosIds` en la asignación debe tener al menos 5 estímulos | El protocolo MIT requiere 10 por sesión; la móvil rellena el resto con el algoritmo automático si faltan |
| Solo debe haber una asignación con `activa == true` por paciente a la vez | Al crear una nueva asignación, la anterior debe marcarse `activa = false` |

---

## 8. Reglas de seguridad Firestore a extender

Las reglas de Firestore ya están desplegadas para las colecciones existentes. La nueva colección `asignaciones_TEM` necesita las siguientes reglas:

```
// asignaciones_TEM
// - El terapeuta puede leer y escribir sus propias asignaciones
// - El paciente puede leer su propia asignación (la móvil la consulta)
// - Nadie más puede acceder

match /asignaciones_TEM/{asignacionId} {
  allow read: if request.auth != null
    && (resource.data.terapeutaId == request.auth.uid
        || resource.data.pacienteId == request.auth.uid);
  allow write: if request.auth != null
    && request.resource.data.terapeutaId == request.auth.uid;
}
```

> ⚠️ Coordinar con el agente móvil (este repositorio) para desplegar estas reglas junto con las ya existentes.

---

## 9. Resumen de tareas para el agente web

1. **Pantalla de selección de estímulos** — el terapeuta filtra por `nivel_clinico` y `estado == 'aprobado'` desde `stimuli_TEM` y selecciona los que asigna al paciente.
2. **Escritura en `asignaciones_TEM`** — con los campos del punto 5.
3. **CRUD de asignaciones** — crear, ver activa, desactivar/reemplazar (marcar `activa = false` en la anterior al crear una nueva).
4. **No tocar** `stimuli_TEM`, `ejercicios_TEM`, `sesiones_TEM` — esas colecciones las gestiona exclusivamente la app móvil al ejecutar la sesión.
5. **Actualizar reglas Firestore** con el bloque del punto 8.
