import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  where,
} from "firebase/firestore";
import { ref, getDownloadURL, uploadBytes } from "firebase/storage";
import { db, storage } from "./firebase";

// ─── Colecciones TEM (TODAS son colecciones RAÍZ) ───
// stimuli_TEM              → catálogo global de estímulos
// sesiones_TEM             → sesiones (filtrar por pacienteId)
// analysis_results_TEM     → análisis de intentos (filtrar por sessionId)
// ejercicios_TEM           → ejercicios asignados

// ─── CONFIGURACIÓN DE PUNTUACIÓN TEM (Manual Clínico Cap. 16) ───
// Nivel 1: pasos 2-5 puntuables, cada uno 0 ó 1. Máx por estímulo = 4.
// Nivel 2: paso 2 (0-1), pasos 3-4 (0-2 con retroceso). Máx por estímulo = 5.
// Nivel 3: pasos 1,3,4,5 (0-2 con retroceso). Máx por estímulo = 8.
// Puntaje sesión = (obtenido / posible) × 100 = porcentaje.
export const TEM_SCORING = {
  1: {
    name: "Nivel 1",
    steps: {
      1: { name: "Tarareo", scored: false, max: 0 },
      2: { name: "Entonación al unísono", scored: true, max: 1 },
      3: { name: "Unísono con apagado", scored: true, max: 1 },
      4: { name: "Repetición inmediata", scored: true, max: 1 },
      5: { name: "Pregunta de prueba", scored: true, max: 1 },
    },
    maxPerStimulus: 4,
  },
  2: {
    name: "Nivel 2",
    steps: {
      1: { name: "Introducción del estímulo", scored: false, max: 0 },
      2: { name: "Unísono con apagado", scored: true, max: 1 },
      3: { name: "Repetición con pausa", scored: true, max: 2 },
      4: { name: "Pregunta de prueba", scored: true, max: 2 },
    },
    maxPerStimulus: 5,
  },
  3: {
    name: "Nivel 3",
    steps: {
      1: { name: "Repetición diferida", scored: true, max: 2 },
      2: { name: "Introducción sprechgesang", scored: false, max: 0 },
      3: { name: "Sprechgesang con apagado", scored: true, max: 2 },
      4: { name: "Repetición hablada diferida", scored: true, max: 2 },
      5: { name: "Pregunta de prueba", scored: true, max: 2 },
    },
    maxPerStimulus: 8,
  },
};

/** Obtener puntaje efectivo (override > clinical_score) */
export function getEffectiveScore(analysis) {
  if (analysis.override_score != null) return analysis.override_score;
  return analysis.clinical_score ?? 0;
}

/**
 * Calcular puntaje de un paso a partir de sus intentos.
 * Per manual: puntaje = max(efectivo de cada intento), acotado al máximo del paso.
 */
export function computeStepScore(attempts, nivel, paso) {
  const levelConfig = TEM_SCORING[nivel];
  if (!levelConfig) return 0;
  const stepConfig = levelConfig.steps[paso];
  if (!stepConfig || !stepConfig.scored) return 0;
  const best = Math.max(0, ...attempts.map((a) => getEffectiveScore(a)));
  return Math.min(best, stepConfig.max);
}

// ════════════════════════════════════════════
//  ESTÍMULOS GLOBALES (stimuli_TEM)
// ════════════════════════════════════════════

/** Obtener todos los estímulos TEM (catálogo global) */
export function subscribeTEMStimuli(callback) {
  const colRef = collection(db, "stimuli_TEM");
  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.texto || "").localeCompare(b.texto || ""));
      callback(data);
    },
    (error) => {
      console.error("[TEM] Error subscribing to stimuli_TEM:", error.message);
      callback([]);
    }
  );
  return unsubscribe;
}

/** Obtener un estímulo TEM por ID */
export async function getTEMStimulusById(stimulusId) {
  const snap = await getDoc(doc(db, "stimuli_TEM", stimulusId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ════════════════════════════════════════════
//  SESIONES TEM (colección raíz sesiones_TEM)
// ════════════════════════════════════════════

/** Suscribirse a las sesiones TEM de un paciente (tiempo real) */
export function subscribePatientTEMSessions(patientId, callback) {
  const sessionsRef = collection(db, "sesiones_TEM");
  const q = query(sessionsRef, where("pacienteId", "==", patientId));
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const ta = a.startedAt?.seconds || 0;
        const tb = b.startedAt?.seconds || 0;
        return tb - ta;
      });
      callback(data);
    },
    (error) => {
      console.error("[TEM] Error subscribing to sesiones_TEM:", error.message);
      callback([]);
    }
  );
  return unsubscribe;
}

/** Obtener una sesión TEM específica */
export async function getTEMSession(sessionId) {
  const snap = await getDoc(doc(db, "sesiones_TEM", sessionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ════════════════════════════════════════════
//  ANÁLISIS DE SESIÓN (colección raíz analysis_results_TEM)
// ════════════════════════════════════════════

/** Obtener todos los análisis de una sesión, agrupados por estímulo y paso */
export async function getSessionAnalysisResults(sessionId) {
  const analysisRef = collection(db, "analysis_results_TEM");
  const q = query(analysisRef, where("sessionId", "==", sessionId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ════════════════════════════════════════════
//  OVERRIDE DEL TERAPEUTA
// ════════════════════════════════════════════

/** Sobreescribir la evaluación de un análisis y recalcular puntaje de sesión */
export async function overrideTEMAnalysis(
  analysisDocId,
  { override_score, override_notes },
  sessionId
) {
  const analysisRef = doc(db, "analysis_results_TEM", analysisDocId);
  await updateDoc(analysisRef, {
    override_score,
    override_notes,
    override_at: new Date(),
  });
  // Recalcular puntaje de la sesión tras sobreescribir
  if (sessionId) {
    await recalculateSessionScore(sessionId);
  }
}

/**
 * Recalcular y guardar el puntaje correcto de la sesión TEM.
 * Per Manual Cap. 16: (total obtenido / total posible) × 100.
 * Puntaje por paso = max(puntaje efectivo de cada intento), acotado por nivel/paso.
 */
export async function recalculateSessionScore(sessionId) {
  const session = await getTEMSession(sessionId);
  if (!session) return null;
  const nivel = session.nivel || 1;
  const levelConfig = TEM_SCORING[nivel];
  if (!levelConfig) return null;

  const results = await getSessionAnalysisResults(sessionId);

  // Agrupar por estímulo → paso
  const grouped = {};
  for (const r of results) {
    const sid = r.stimulusId;
    if (!grouped[sid]) grouped[sid] = {};
    const paso = r.paso ?? 0;
    if (!grouped[sid][paso]) grouped[sid][paso] = [];
    grouped[sid][paso].push(r);
  }

  let totalObtained = 0;
  const stimulusIds = Object.keys(grouped);
  for (const stimId of stimulusIds) {
    for (const [paso, attempts] of Object.entries(grouped[stimId])) {
      totalObtained += computeStepScore(attempts, nivel, Number(paso));
    }
  }

  // Estímulos intentados = unión de completados + abandonados + analizados
  const attemptedSet = new Set([
    ...(session.completedStimuli || []),
    ...(session.abandonedStimuli || []),
    ...stimulusIds,
  ]);
  const totalPossible = attemptedSet.size * levelConfig.maxPerStimulus;
  const percentage =
    totalPossible > 0 ? Math.round((totalObtained / totalPossible) * 100) : 0;

  // Guardar campos calculados (sin sobreescribir scoreSesion del móvil)
  const sessionRef = doc(db, "sesiones_TEM", sessionId);
  await updateDoc(sessionRef, {
    temScoreObtenido: totalObtained,
    temScorePosible: totalPossible,
    temPorcentaje: percentage,
  });

  return { obtained: totalObtained, possible: totalPossible, percentage };
}

// ════════════════════════════════════════════
//  CALIBRACIÓN
// ════════════════════════════════════════════

/** Obtener la calibración del paciente */
export async function getPatientCalibration(patientId) {
  const calRef = collection(db, "pacientes", patientId, "calibration");
  const snap = await getDocs(calRef);
  if (snap.empty) return null;
  const latestDoc = snap.docs[snap.docs.length - 1];
  return { id: latestDoc.id, ...latestDoc.data() };
}

// ════════════════════════════════════════════
//  UTILIDADES — RESOLVER gs:// → HTTPS
// ════════════════════════════════════════════

/** Convertir gs:// URL a HTTPS descargable (sirve para audio e imágenes) */
export async function getTEMStorageUrl(gsUrl) {
  if (!gsUrl) return null;
  if (gsUrl.startsWith("https://")) return gsUrl;
  const storageRef = ref(storage, gsUrl);
  return await getDownloadURL(storageRef);
}

// Alias para retrocompatibilidad
export const getTEMAudioUrl = getTEMStorageUrl;

// ════════════════════════════════════════════
//  CONTADORES PARA DASHBOARD
// ════════════════════════════════════════════

/** Contar sesiones TEM completadas para los pacientes de un terapeuta */
export async function subscribeTEMPendingSessions(therapistId, callback) {
  const pacientesRef = collection(db, "pacientes");
  const qPac = query(pacientesRef, where("terapeuta", "==", therapistId));
  const pacientesSnap = await getDocs(qPac);
  const patientIds = pacientesSnap.docs.map((d) => d.id);

  if (patientIds.length === 0) {
    callback(0);
    return () => {};
  }

  // Firestore "in" soporta hasta 30 valores
  const batches = [];
  for (let i = 0; i < patientIds.length; i += 30) {
    batches.push(patientIds.slice(i, i + 30));
  }

  const unsubscribes = batches.map((batch) => {
    const sessionsRef = collection(db, "sesiones_TEM");
    const qSessions = query(
      sessionsRef,
      where("pacienteId", "in", batch),
      where("status", "==", "completed")
    );
    return onSnapshot(qSessions, () => {
      countPendingTEMSessions(patientIds).then(callback);
    });
  });

  const initialCount = await countPendingTEMSessions(patientIds);
  callback(initialCount);

  return () => unsubscribes.forEach((unsub) => unsub());
}

async function countPendingTEMSessions(patientIds) {
  let total = 0;
  const batches = [];
  for (let i = 0; i < patientIds.length; i += 30) {
    batches.push(patientIds.slice(i, i + 30));
  }
  for (const batch of batches) {
    const sessionsRef = collection(db, "sesiones_TEM");
    const q = query(
      sessionsRef,
      where("pacienteId", "in", batch),
      where("status", "==", "completed")
    );
    const snap = await getDocs(q);
    total += snap.size;
  }
  return total;
}

// ════════════════════════════════════════════
//  CREACIÓN DE ESTÍMULOS TEM
// ════════════════════════════════════════════

/**
 * Crea un nuevo estímulo en stimuli_TEM.
 * @param {Object} data - Campos del estímulo
 * @param {File|null} imagenFile - Archivo de imagen (opcional)
 * @returns {string} docId
 */
/**
 * Verifica si ya existe un estímulo con el mismo texto y nivel clínico.
 * Devuelve el array de documentos duplicados (vacío si no hay).
 */
export async function checkTEMStimulusDuplicate(texto, nivel) {
  const textoNorm = texto.trim().toLowerCase();
  const snap = await getDocs(
    query(
      collection(db, "stimuli_TEM"),
      where("nivel_clinico", "==", Number(nivel))
    )
  );
  return snap.docs.filter(
    (d) => d.data().texto?.trim().toLowerCase() === textoNorm
  );
}

export async function createTEMStimulus(data, imagenFile = null) {
  const docId = `ST_TEM_N${data.nivel_clinico}_${Date.now()}`;
  let imagen_url = data.imagen_url || "";

  // Subir imagen a Storage si se proporcionó un archivo
  if (imagenFile) {
    const ext = imagenFile.name.split(".").pop();
    const storagePath = `tem_stimuli/${docId}/imagen.${ext}`;
    const imgRef = ref(storage, storagePath);
    await uploadBytes(imgRef, imagenFile);
    imagen_url = `gs://${imgRef.bucket}/${imgRef.fullPath}`;
  }

  const docData = {
    texto: data.texto,
    syllables: data.syllables,
    num_silabas: data.syllables.length,
    patron_tonal: data.patron_tonal,
    nivel_clinico: data.nivel_clinico,
    categoria: data.categoria || "",
    pregunta: data.pregunta || "",
    audio_url: data.audio_url || "",
    audio_duration_ms: data.audio_duration_ms || 0,
    onsets_ms: data.onsets_ms || [],
    durations_ms: data.durations_ms || [],
    imagen_url,
    video_url: data.video_url || "",
    creado_por: data.creado_por || "",
    fecha_creacion: new Date().toISOString(),
    estado: data.estado || "aprobado",
  };

  await setDoc(doc(db, "stimuli_TEM", docId), docData);
  return docId;
}

// ════════════════════════════════════════════
//  SUSCRIPCIONES FILTRADAS POR ESTADO
// ════════════════════════════════════════════

/** Solo estímulos aprobados (para terapia y catálogo visible) */
export function subscribeTEMStimuliApproved(callback) {
  const colRef = collection(db, "stimuli_TEM");
  const q = query(colRef, where("estado", "==", "aprobado"));
  return onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.texto || "").localeCompare(b.texto || ""));
      callback(data);
    },
    (error) => {
      console.error("[TEM] Error subscribing to approved stimuli:", error.message);
      callback([]);
    }
  );
}

/** Estímulos pendientes de revisión (para admin) */
export function subscribeTEMStimuliPending(callback) {
  const colRef = collection(db, "stimuli_TEM");
  const q = query(colRef, where("estado", "==", "pendiente_revision"));
  return onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.fecha_creacion || "").localeCompare(b.fecha_creacion || ""));
      callback(data);
    },
    (error) => {
      console.error("[TEM] Error subscribing to pending stimuli:", error.message);
      callback([]);
    }
  );
}

/** Estímulos creados por un usuario específico (para dashboard del creador) */
export function subscribeTEMStimuliByCreator(creadorUid, callback) {
  const colRef = collection(db, "stimuli_TEM");
  const q = query(colRef, where("creado_por", "==", creadorUid));
  return onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.fecha_creacion || "").localeCompare(a.fecha_creacion || ""));
      callback(data);
    },
    (error) => {
      console.error("[TEM] Error subscribing to creator stimuli:", error.message);
      callback([]);
    }
  );
}
