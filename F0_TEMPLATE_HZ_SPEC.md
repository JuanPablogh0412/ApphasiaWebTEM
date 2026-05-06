# Especificación: Campo `f0_template_hz` en Estímulos TEM

## Contexto

El backend Python de evaluación (pitch_analyzer.py) necesita el campo `f0_template_hz` en cada documento de `stimuli_TEM` para calcular el error de entonación del paciente:

```python
f0_error_cents = 1200 * log2(f0_measured / f0_expected)
```

Donde `f0_expected` viene de `f0_template_hz[i]` para la sílaba `i`.

**Problema:** Los estímulos creados desde la web (`createTEMStimulus` en `temService.js`) no incluyen este campo. Sin él, el backend falla con `KeyError` o assertion error al evaluar los intentos del paciente.

---

## Algoritmo

Mapeo determinístico desde `patron_tonal` (ya generado por `tonalPattern.js`):

| Carácter | Frecuencia (Hz) | Significado |
|----------|-----------------|-------------|
| `L`      | 200.0           | Sílaba átona (tono bajo) |
| `H`      | 237.8           | Sílaba tónica (tono alto) |

Los valores provienen del protocolo MIT de Terapia de Entonación Melódica:
- **L = 200.0 Hz** — frecuencia base
- **H = 237.8 Hz** — tercera menor por encima de L: `200 × 2^(3/12) ≈ 237.84`

Referencia: Sparks, Helm & Albert (1974); Norton et al. (2009)

### Implementación (5 líneas)

Crear `src/utils/f0Template.js`:

```javascript
export function generateF0Template(patronTonal) {
  const TONE_MAP = { L: 200.0, H: 237.8 };
  return patronTonal
    .split('')
    .map(ch => TONE_MAP[ch.toUpperCase()] ?? 200.0);
}
```

---

## Integración en `temService.js`

En la función `createTEMStimulus` (línea ~377), agregar el campo al objeto que se pasa a `setDoc`:

```javascript
import { generateF0Template } from '../utils/f0Template';

// Dentro de createTEMStimulus, donde se construye el objeto del estímulo:
const f0_template_hz = generateF0Template(patron_tonal);

// Agregar al objeto de setDoc:
await setDoc(docRef, {
  // ... campos existentes ...
  f0_template_hz,        // ← NUEVO
});
```

---

## Invariante de Validación

**DEBE cumplirse siempre:**

```
f0_template_hz.length === syllables.length
```

Ambos arrays tienen un elemento por sílaba. Si no coinciden, hay un bug en la generación del patrón tonal o la silabificación.

Agregar una aserción antes de guardar:

```javascript
if (f0_template_hz.length !== syllables.length) {
  throw new Error(
    `Invariante violada: f0_template_hz (${f0_template_hz.length}) ` +
    `!== syllables (${syllables.length}) para "${texto}"`
  );
}
```

---

## Migración de Estímulos Existentes

Los estímulos ya creados desde la web que no tienen `f0_template_hz` necesitan ser actualizados.

### Script de migración (ejecutar una vez)

Crear `scripts/migrateF0Template.js`:

```javascript
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../src/firebase'; // ajustar path según config
import { generateF0Template } from '../src/utils/f0Template';

async function migrate() {
  const snap = await getDocs(collection(db, 'stimuli_TEM'));
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();

    // Si ya tiene f0_template_hz, verificar consistencia
    if (data.f0_template_hz && data.f0_template_hz.length === (data.syllables?.length ?? 0)) {
      skipped++;
      continue;
    }

    const patronTonal = data.patron_tonal;
    if (!patronTonal) {
      console.warn(`⚠️ ${docSnap.id} no tiene patron_tonal — saltando`);
      skipped++;
      continue;
    }

    const f0 = generateF0Template(patronTonal);

    // Validar invariante
    if (data.syllables && f0.length !== data.syllables.length) {
      console.error(
        `❌ ${docSnap.id}: f0(${f0.length}) !== syllables(${data.syllables.length})`
      );
      continue;
    }

    await updateDoc(doc(db, 'stimuli_TEM', docSnap.id), { f0_template_hz: f0 });
    updated++;
    console.log(`✅ ${docSnap.id} → [${f0.join(', ')}]`);
  }

  console.log(`\nMigración completa: ${updated} actualizados, ${skipped} saltados`);
}

migrate().catch(console.error);
```

---

## Verificación

1. **Crear un estímulo desde la web** → verificar en Firestore que el documento contiene `f0_template_hz` como array de números
2. **Verificar invariante**: `f0_template_hz.length === syllables.length` para el estímulo creado
3. **Ejecutar migración** → verificar que estímulos existentes ahora tienen el campo
4. **Test manual**: para un estímulo con `patron_tonal: "LHL"`, verificar que `f0_template_hz` es `[200.0, 237.8, 200.0]`

---

## Resumen de Archivos

| Archivo | Acción |
|---------|--------|
| `src/utils/f0Template.js` | **CREAR** — función `generateF0Template` |
| `src/services/temService.js` | **EDITAR** — importar y agregar `f0_template_hz` al `setDoc` |
| `scripts/migrateF0Template.js` | **CREAR** — script de migración one-time |
