// syllabifier.js
// Silabificador del español — puerto del algoritmo usado en la app móvil Flutter.
// Principio del Onset Máximo (RAE) con soporte de dígrafos, diptongos y clusters.

const DIPHTHONGS = new Set([
  "ai", "au", "ei", "eu", "oi", "ou",
  "ia", "ie", "io", "ua", "ue", "uo",
  "iu", "ui",
  // con tilde en la fuerte (no rompen el diptongo)
  "ái", "áu", "éi", "éu", "ói",
  "iá", "ié", "ió", "uá", "ué", "uó",
]);

// Clusters de consonantes que van JUNTOS al onset de la siguiente sílaba
const ONSET_CLUSTERS = new Set([
  "pr", "pl", "br", "bl", "tr", "dr",
  "cr", "cl", "fr", "fl", "gr", "gl",
]);

const STRONG_VOWELS = new Set(["a", "e", "o", "á", "é", "ó"]);

function isVowel(ch) {
  return "aeiouáéíóúü".includes(ch);
}

function isDiphthong(v1, v2) {
  const combined = v1 + v2;
  if (DIPHTHONGS.has(combined)) return true;
  const v1Strong = STRONG_VOWELS.has(v1);
  const v2Strong = STRONG_VOWELS.has(v2);
  // débil sin tilde + fuerte (o viceversa) → diptongo
  if (v1Strong !== v2Strong) return true;
  // débil + débil → diptongo (iu, ui)
  if ((v1 === "i" && v2 === "u") || (v1 === "u" && v2 === "i")) return true;
  return false;
}

function restoreDigraphs(text) {
  return text.replace(/ç/g, "ch").replace(/ł/g, "ll").replace(/ř/g, "rr");
}

/**
 * Silabifica una sola palabra en español.
 * @param {string} word
 * @returns {string[]} Array de sílabas
 */
function syllabifyWord(word) {
  if (!word) return [];

  // Codificar dígrafos como caracteres únicos para simplificar parsing
  let normalized = word
    .toLowerCase()
    .replace(/ch/g, "ç")
    .replace(/ll/g, "ł")
    .replace(/rr/g, "ř")
    .replace(/qu/g, "q");

  const syllables = []; // { onset, nucleus, coda }
  let i = 0;

  while (i < normalized.length) {
    let onset = "";
    let nucleus = "";
    let coda = "";

    // --- Recoger consonantes iniciales (onset) ---
    while (i < normalized.length && !isVowel(normalized[i])) {
      onset += normalized[i];
      i++;
    }

    // Si el onset tiene 2+ consonantes, verificar cluster válido
    if (onset.length >= 2) {
      const lastTwo = onset.slice(-2);
      if (!ONSET_CLUSTERS.has(lastTwo)) {
        // No es cluster: consonantes sobrantes van a la coda anterior
        if (syllables.length > 0) {
          const extra = onset.slice(0, -1);
          const prev = syllables[syllables.length - 1];
          prev.coda += extra;
          onset = onset.slice(-1);
        }
      } else if (onset.length > 2) {
        // Cluster válido en las 2 últimas, el resto a coda anterior
        if (syllables.length > 0) {
          const extra = onset.slice(0, -2);
          const prev = syllables[syllables.length - 1];
          prev.coda += extra;
          onset = onset.slice(-2);
        }
      }
    }

    // --- Recoger núcleo vocálico (con posible diptongo) ---
    if (i < normalized.length && isVowel(normalized[i])) {
      nucleus += normalized[i];
      i++;
      if (i < normalized.length && isVowel(normalized[i])) {
        if (isDiphthong(nucleus, normalized[i])) {
          nucleus += normalized[i];
          i++;
        }
        // Si no es diptongo → hiato, la segunda vocal queda para la siguiente sílaba
      }
    }

    // --- Recoger consonantes de cierre (coda) ---
    if (i < normalized.length && !isVowel(normalized[i])) {
      const consonantStart = i;
      let consonantCount = 0;
      while (i < normalized.length && !isVowel(normalized[i])) {
        consonantCount++;
        i++;
      }

      if (i >= normalized.length) {
        // Final de palabra: todas las consonantes van a la coda
        coda = normalized.slice(consonantStart, i);
      } else {
        if (consonantCount === 1) {
          // Una sola consonante entre vocales → va al onset de la siguiente
          i = consonantStart;
        } else if (consonantCount >= 2) {
          const lastTwo = normalized.slice(i - 2, i);
          if (ONSET_CLUSTERS.has(lastTwo)) {
            // Las 2 últimas forman cluster → van juntas al siguiente onset
            if (consonantCount > 2) {
              coda = normalized.slice(consonantStart, i - 2);
              i = consonantStart + coda.length;
            } else {
              i = consonantStart; // todas al siguiente onset
            }
          } else {
            // No es cluster: las primeras a esta coda, la última al siguiente onset
            coda = normalized.slice(consonantStart, i - 1);
            i = consonantStart + coda.length;
          }
        }
      }
    }

    // Restaurar dígrafos y guardar sílaba
    onset = restoreDigraphs(onset);
    nucleus = restoreDigraphs(nucleus);
    coda = restoreDigraphs(coda);

    if (nucleus) {
      syllables.push({ onset, nucleus, coda });
    } else if (onset || coda) {
      // Consonantes sin vocal al inicio → unir al início de la siguiente o fin de anterior
      if (syllables.length > 0) {
        syllables[syllables.length - 1].coda += onset + coda;
      }
    }
  }

  // Restaurar 'qu': donde codificamos 'qu' como 'q', el onset tiene 'q' y el
  // nucleus empieza con la vocal que sigue. Necesitamos restaurar 'qu' en el onset
  // cuando la 'q' aparece sola.
  return syllables.map((s) => {
    let o = s.onset;
    if (o.endsWith("q") && (s.nucleus.startsWith("e") || s.nucleus.startsWith("i"))) {
      o = o.slice(0, -1) + "qu";
      // la 'u' era muda, ya fue absorbida por la codificación
    }
    return o + s.nucleus + s.coda;
  });
}

/**
 * Silabifica una frase completa en español.
 * Cada palabra se silabifica de forma independiente.
 *
 * @param {string} phrase
 * @returns {string[]} Array de sílabas
 *
 * @example
 * syllabify("mamá")          // → ["ma","má"]
 * syllabify("gracias")       // → ["gra","cias"]
 * syllabify("no sé")         // → ["no","sé"]
 * syllabify("hora de comer") // → ["ho","ra","de","co","mer"]
 * syllabify("buenos días")   // → ["bue","nos","dí","as"]
 */
export function syllabify(phrase) {
  if (!phrase || !phrase.trim()) return [];
  const words = phrase.trim().split(/\s+/);
  return words.flatMap((word) => syllabifyWord(word));
}
