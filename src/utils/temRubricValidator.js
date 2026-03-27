// temRubricValidator.js
// Validador de la rúbrica clínica para estímulos TEM (Cap. 16 Manual de la Afasia).
// Bloques A (universal) + B (N1) + C (N2) + D (N3) + E (restricciones).

// Clusters consonánticos prohibidos en Nivel 1
const CONSONANT_CLUSTERS = /[bcdfgklmnpqrstvxz](?:r|l)/gi;
// Regex más específica para grupos consonánticos del español
const CLUSTER_REGEX = /(?:pr|pl|br|bl|tr|dr|cr|cl|fr|fl|gr|gl|str)/i;

// Consonantes bilabiales y articulatoriamente visibles
const VISIBLE_CONSONANTS = /[pbm]/i;

/**
 * Verifica si una sílaba contiene un grupo consonántico.
 */
function hasConsonantCluster(syllable) {
  return CLUSTER_REGEX.test(syllable);
}

/**
 * Cuenta palabras en una frase.
 */
function wordCount(texto) {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Valida un estímulo TEM según la rúbrica clínica completa.
 *
 * @param {object} params
 * @param {string} params.texto - La frase/palabra del estímulo
 * @param {number} params.nivel - Nivel clínico (1, 2 o 3)
 * @param {string[]} params.syllables - Sílabas separadas
 * @param {string} params.patronTonal - Patrón H/L (opcional para validación parcial)
 * @returns {{ valid: boolean, errors: Array<{code:string, msg:string}>, warnings: Array<{code:string, msg:string}> }}
 */
export function validateStimulus({ texto, nivel, syllables, patronTonal }) {
  const errors = [];
  const warnings = [];

  if (!texto || !texto.trim()) {
    errors.push({ code: "A_EMPTY", msg: "El estímulo no puede estar vacío." });
    return { valid: false, errors, warnings };
  }

  const numSyllables = syllables?.length || 0;
  const words = wordCount(texto);

  // ═══════════════════════════════════════════════════
  // BLOQUE A — Criterios universales (todos los niveles)
  // ═══════════════════════════════════════════════════

  // A.1 — Mínimo 2 sílabas (prohibición de monosílabos — Bloque E.2)
  if (numSyllables < 2) {
    errors.push({
      code: "A_MONOSYLLABLE",
      msg: `El estímulo debe tener al menos 2 sílabas. Tiene ${numSyllables}. Los monosílabos están contraindicados en todos los niveles (Bloque E.2).`,
    });
  }

  // A.2 — Patrón tonal definido y con longitud correcta
  if (patronTonal) {
    if (patronTonal.length !== numSyllables) {
      errors.push({
        code: "A_TONAL_LENGTH",
        msg: `El patrón tonal tiene ${patronTonal.length} caracteres pero hay ${numSyllables} sílabas. Deben coincidir.`,
      });
    }
    if (!/^[HL]+$/i.test(patronTonal)) {
      errors.push({
        code: "A_TONAL_INVALID",
        msg: "El patrón tonal solo puede contener caracteres H (alto) y L (bajo).",
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // BLOQUE B — Nivel 1
  // ═══════════════════════════════════════════════════
  if (nivel === 1) {
    // B.1 — 2 a 3 sílabas
    if (numSyllables > 3) {
      errors.push({
        code: "B_SYLLABLE_COUNT",
        msg: `Nivel 1 requiere 2–3 sílabas. El estímulo tiene ${numSyllables}.`,
      });
    }

    // B.1 — Sin grupos consonánticos
    if (syllables) {
      const clustersFound = [];
      for (const syl of syllables) {
        if (hasConsonantCluster(syl)) {
          clustersFound.push(syl);
        }
      }
      if (clustersFound.length > 0) {
        errors.push({
          code: "B_CLUSTER",
          msg: `Nivel 1 prohíbe grupos consonánticos (bl, tr, pr, gr, etc.). Encontrado en: "${clustersFound.join('", "')}".`,
        });
      }
    }

    // B.1 — Preferencia por consonantes bilabiales (warning, no error)
    if (syllables) {
      const textoLower = texto.toLowerCase();
      if (!VISIBLE_CONSONANTS.test(textoLower)) {
        warnings.push({
          code: "B_VISIBLE_CONSONANTS",
          msg: "Nivel 1 recomienda consonantes articulatoriamente visibles (p, b, m). Este estímulo no contiene ninguna.",
        });
      }
    }

    // B.2 — Longitud: palabra aislada o sintagma de 2–3 palabras
    if (words > 3) {
      warnings.push({
        code: "B_WORD_COUNT",
        msg: `Nivel 1 trabaja con palabras aisladas o sintagmas de 2–3 palabras. Este tiene ${words} palabras.`,
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // BLOQUE C — Nivel 2
  // ═══════════════════════════════════════════════════
  if (nivel === 2) {
    // C.1 — 2 a 5 sílabas
    if (numSyllables > 5) {
      errors.push({
        code: "C_SYLLABLE_COUNT",
        msg: `Nivel 2 requiere 2–5 sílabas. El estímulo tiene ${numSyllables}.`,
      });
    }

    // C.1 — Grupos consonánticos tolerados con warning
    if (syllables) {
      for (const syl of syllables) {
        if (hasConsonantCluster(syl)) {
          warnings.push({
            code: "C_CLUSTER",
            msg: `Nivel 2 tolera grupos consonánticos si el paciente los produce correctamente. Se encontró en "${syl}".`,
          });
          break; // Un solo warning es suficiente
        }
      }
    }

    // C.2 — Sintagmas de 2 a 5 palabras
    if (words > 5) {
      warnings.push({
        code: "C_WORD_COUNT",
        msg: `Nivel 2 trabaja con sintagmas de hasta 5 palabras. Este tiene ${words}.`,
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // BLOQUE D — Nivel 3
  // ═══════════════════════════════════════════════════
  if (nivel === 3) {
    // D.2 — Oración completa: mínimo 4 palabras
    if (words < 4) {
      warnings.push({
        code: "D_SENTENCE_SHORT",
        msg: `Nivel 3 trabaja con oraciones completas (≥4 palabras). Este tiene ${words} palabras.`,
      });
    }

    // D.2 — 4 a 8 palabras recomendadas
    if (words > 8) {
      warnings.push({
        code: "D_SENTENCE_LONG",
        msg: `Nivel 3 recomienda oraciones de 4–8 palabras. Este tiene ${words}. Puede exceder la memoria de trabajo del paciente.`,
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // BLOQUE E — Restricciones absolutas
  // ═══════════════════════════════════════════════════

  // E.4 — Frecuencia léxica (heurístico: verificar longitud excesiva de palabra)
  const longestWord = texto
    .trim()
    .split(/\s+/)
    .reduce((max, w) => (w.length > max.length ? w : max), "");
  if (longestWord.length > 12) {
    warnings.push({
      code: "E_LOW_FREQUENCY",
      msg: `La palabra "${longestWord}" tiene ${longestWord.length} letras. Verifique que sea de alta frecuencia y uso cotidiano.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
