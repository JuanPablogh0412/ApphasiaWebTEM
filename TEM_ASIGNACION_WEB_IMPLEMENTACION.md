# Asignación de Estímulos TEM — Implementación Web

## Resumen

Se implementó en la **web del terapeuta** la funcionalidad para que un terapeuta pueda **seleccionar manualmente estímulos TEM** del catálogo aprobado y asignarlos a un paciente específico. La app móvil debe consumir esta asignación para usarla en lugar de (o complementando) su algoritmo de selección por defecto.

---

## 1. Nueva colección Firestore: `asignaciones_TEM`

### Ubicación
```
/asignaciones_TEM/{asignacionId}
```

### Schema del documento

| Campo           | Tipo              | Descripción                                                                 |
|-----------------|-------------------|-----------------------------------------------------------------------------|
| `terapeutaId`   | `string`          | UID del terapeuta que creó la asignación                                    |
| `pacienteId`    | `string`          | UID del paciente al que se asignan los estímulos                           |
| `estimulosIds`  | `string[]`        | Array de IDs de documentos de `stimuli_TEM` seleccionados (mínimo 5)       |
| `nivel`         | `number` (1/2/3)  | Nivel clínico de los estímulos asignados                                    |
| `notas`         | `string`          | Notas clínicas del terapeuta (actualmente se envía vacío `""`)             |
| `activa`        | `boolean`         | `true` = asignación vigente, `false` = desactivada/reemplazada            |
| `activaDesde`   | `Timestamp`       | Fecha/hora en que se activó (serverTimestamp)                               |
| `createdAt`     | `Timestamp`       | Fecha/hora de creación (serverTimestamp)                                    |

### Invariantes

- **Solo puede haber UNA asignación activa (`activa == true`) por paciente a la vez.**
- Cuando el terapeuta crea una nueva asignación, la web **desactiva automáticamente** cualquier asignación previa activa (pone `activa: false`).
- El mínimo de estímulos por asignación es **5**.
- Todos los estímulos de una misma asignación pertenecen al **mismo nivel clínico**.

### Índices Firestore requeridos

La app móvil necesitará hacer queries sobre esta colección. Asegúrate de que existan estos índices compuestos (Firestore los crea automáticamente al hacer la primera query, o pueden crearse manualmente):

1. `pacienteId` ASC + `activa` ASC → para obtener la asignación activa
2. `pacienteId` ASC + `createdAt` DESC → para el historial

---

## 2. Reglas Firestore actualizadas

```javascript
match /asignaciones_TEM/{asignacionId} {
  // Cualquier usuario autenticado puede leer (la app móvil del paciente necesita esto)
  allow read: if isSignedIn();
  
  // Solo terapeutas pueden crear, y deben ser el terapeutaId del documento
  allow create: if isTerapeuta()
                  && request.resource.data.terapeutaId == request.auth.uid;
  
  // Solo el terapeuta dueño puede actualizar (para desactivar)
  allow update: if isTerapeuta()
                  && resource.data.terapeutaId == request.auth.uid;
}
```

**Nota:** La lectura es abierta para cualquier usuario autenticado porque las queries filtradas por `pacienteId` no pueden ser validadas campo-a-campo en las reglas de Firestore (limitación conocida de security rules con queries `where`).

---

## 3. Flujo desde la Web

1. El terapeuta entra a **Pacientes → Detalle del paciente → Pestaña TEM → Sub-tab "Estímulos Asignados"**.
2. Si **no hay asignación activa**, ve un estado vacío con botón "Crear asignación".
3. Si **hay asignación activa**, ve la lista de estímulos asignados con opciones de "Desactivar" o "Nueva asignación".
4. Al crear una asignación:
   - Se abre un modal con todos los estímulos aprobados de `stimuli_TEM`.
   - Filtros disponibles: nivel (1/2/3), texto, categoría.
   - El nivel se preselecciona al `nivel_actual` del paciente.
   - El terapeuta selecciona estímulos con checkboxes (mínimo 5).
   - Al confirmar, se crea el documento en `asignaciones_TEM` y se desactiva cualquier asignación previa.

---

## 4. Lo que la app móvil debe implementar

### Query para obtener la asignación activa

```kotlin
// Pseudocódigo
db.collection("asignaciones_TEM")
  .whereEqualTo("pacienteId", currentPatientId)
  .whereEqualTo("activa", true)
  .limit(1)
  .get()
```

### Lógica esperada en la app móvil

1. **Al iniciar una sesión TEM**, la app debe consultar si existe una asignación activa para el paciente.
2. **Si existe asignación activa:**
   - Usar los IDs de `estimulosIds` para obtener los estímulos de `stimuli_TEM`.
   - Si la asignación tiene **menos de 10 estímulos** (el mínimo es 5, pero podrían ser hasta el total del catálogo), la app puede **completar hasta 10** usando su algoritmo de selección existente, o usar solo los asignados — esto queda a criterio de la implementación móvil.
   - El campo `nivel` indica el nivel clínico de los estímulos asignados.
3. **Si NO existe asignación activa:**
   - Comportamiento por defecto — la app usa su algoritmo actual de selección de estímulos.

### Resolución de estímulos

Los IDs en `estimulosIds` corresponden a documentos en:
```
/stimuli_TEM/{stimulusId}
```

Cada estímulo tiene los campos: `texto`, `pregunta`, `nivel_clinico`, `categoria`, `num_silabas`, `patron_tonal`, `syllables`, `audio_url` (gs://), `video_url` (gs://), `imagen_url` (gs://), `f0_template_hz`, etc.

---

## 5. Ejemplo de documento

```json
{
  "terapeutaId": "abc123therapist",
  "pacienteId": "xyz789patient",
  "estimulosIds": [
    "stim_001",
    "stim_004",
    "stim_007",
    "stim_012",
    "stim_015",
    "stim_019",
    "stim_023"
  ],
  "nivel": 1,
  "notas": "",
  "activa": true,
  "activaDesde": "2026-04-08T22:46:00Z",
  "createdAt": "2026-04-08T22:46:00Z"
}
```

---

## 6. Archivos relevantes del lado web (referencia)

| Archivo | Propósito |
|---------|-----------|
| `src/services/asignacionesService.js` | CRUD de `asignaciones_TEM` (subscribe activa, historial, crear, desactivar) |
| `src/components/patients/TEMAssignModal.jsx` | Modal de selección de estímulos |
| `src/components/patients/TEMAssignedStimuli.jsx` | Vista de asignación activa + historial |
| `src/components/patients/PacienteTEM.jsx` | Sub-tabs "Sesiones" / "Estímulos Asignados" |
| `firestore.rules` | Reglas de seguridad actualizadas |
