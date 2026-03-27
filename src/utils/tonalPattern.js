// tonalPattern.js
// Generador automático de patrón tonal (H/L) para estímulos TEM.
// Regla: sílaba tónica → H (alto), átonas → L (bajo).
// Usa reglas de acentuación del español para detectar la sílaba tónica de cada palabra.

import { syllabify } from "./syllabifier";

const VOWELS = "aeiouáéíóúü";
const ACCENTED = { á: "a", é: "e", í: "i", ó: "o", ú: "u" };

/**
 * Detecta si un carácter es vocal.
 */
function isVowel(ch) {
  return VOWELS.includes(ch);
}

/**
 * Detecta si una sílaba contiene una vocal con tilde.
 */
function hasAccent(syllable) {
  return [...syllable].some((ch) => ch in ACCENTED);
}

/**
 * Encuentra el índice de la sílaba tónica dentro de un array de sílabas
 * de una sola palabra, usando las reglas de acentuación del español:
 *
 * 1. Si alguna sílaba tiene tilde → esa es tónica.
 * 2. Si no hay tilde y la palabra termina en vocal, 'n' o 's' → penúltima (llana).
 * 3. Si no hay tilde y termina en otra consonante → última (aguda).
 * 4. Monosílabos → la única sílaba es tónica.
 */
function findStressIndex(syllables) {
  if (syllables.length === 0) return -1;
  if (syllables.length === 1) return 0;

  // Buscar tilde explícita
  for (let i = 0; i < syllables.length; i++) {
    if (hasAccent(syllables[i])) return i;
  }

  // Sin tilde: aplicar regla según última letra de la última sílaba
  const lastSyllable = syllables[syllables.length - 1];
  const lastChar = lastSyllable[lastSyllable.length - 1];

  if (isVowel(lastChar) || lastChar === "n" || lastChar === "s") {
    // Llana (penúltima)
    return syllables.length - 2;
  }
  // Aguda (última)
  return syllables.length - 1;
}

/**
 * Silabifica una sola palabra y retorna sus sílabas.
 * Reutiliza syllabify pero para una sola palabra.
 */
function syllabifyOneWord(word) {
  return syllabify(word);
}

/**
 * Genera el patrón tonal (string de H/L) para una frase completa.
 * Cada sílaba tónica recibe 'H', cada átona recibe 'L'.
 *
 * @param {string} phrase - Frase o palabra en español
 * @returns {string} Patrón tonal, ej: "LH" para "mamá", "HL" para "agua"
 *
 * @example
 * generateTonalPattern("mamá")        // → "LH"
 * generateTonalPattern("agua")        // → "HL"
 * generateTonalPattern("buenos días") // → "HLL HL" → "HLLHL" (sin espacios)
 */
export function generateTonalPattern(phrase) {
  if (!phrase || !phrase.trim()) return "";

  const words = phrase.trim().split(/\s+/);
  let pattern = "";

  for (const word of words) {
    const syls = syllabifyOneWord(word);
    const stressIdx = findStressIndex(syls);

    for (let i = 0; i < syls.length; i++) {
      pattern += i === stressIdx ? "H" : "L";
    }
  }

  return pattern;
}
