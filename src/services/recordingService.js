// recordingService.js
// Gestiona sesiones de grabación para el flujo QR (terapeuta genera QR → móvil graba → sube a Storage).

import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";

const RECORDINGS_COL = "pending_recordings";

/**
 * Genera un token único para la sesión de grabación.
 */
function generateToken() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `rec_${ts}_${rand}`;
}

/**
 * Crea una sesión de grabación pendiente en Firestore.
 *
 * @param {"audio"|"video"} type - Tipo de grabación
 * @param {string} therapistId - UID del terapeuta que la solicita
 * @param {object} [metadata] - Info contextual (stimulusText, nivel, etc.)
 * @returns {Promise<string>} El token de la sesión
 */
export async function createRecordingSession(type, therapistId, metadata = {}) {
  const token = generateToken();
  const docRef = doc(db, RECORDINGS_COL, token);

  await setDoc(docRef, {
    token,
    type,
    status: "pending",
    createdAt: serverTimestamp(),
    createdBy: therapistId,
    storageUrl: null,
    fileName: null,
    metadata,
  });

  return token;
}

/**
 * Suscripción en tiempo real al estado de una sesión de grabación.
 * Se usa en el desktop para detectar cuando el móvil completa la grabación.
 *
 * @param {string} token
 * @param {function} callback - Recibe el documento completo
 * @returns {function} unsubscribe
 */
export function subscribeRecordingSession(token, callback) {
  const docRef = doc(db, RECORDINGS_COL, token);
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() });
    }
  });
}

/**
 * Lee una sesión de grabación (lectura única, para la página del móvil).
 *
 * @param {string} token
 * @returns {Promise<object|null>}
 */
export async function getRecordingSession(token) {
  const docRef = doc(db, RECORDINGS_COL, token);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Sube el archivo grabado a Storage y marca la sesión como completada.
 * Se llama desde la página del móvil tras grabar.
 *
 * @param {string} token
 * @param {Blob|File} file - El archivo grabado
 * @param {string} extension - Extensión del archivo (ej: "webm", "wav", "mp4")
 * @returns {Promise<string>} URL gs:// del archivo subido
 */
export async function uploadAndCompleteRecording(token, file, extension) {
  const fileName = `${token}.${extension}`;
  const storageRef = ref(storage, `tem_recordings/${fileName}`);

  await uploadBytes(storageRef, file);
  const gsUrl = `gs://${storageRef.bucket}/${storageRef.fullPath}`;

  const docRef = doc(db, RECORDINGS_COL, token);
  await updateDoc(docRef, {
    status: "completed",
    storageUrl: gsUrl,
    fileName,
  });

  return gsUrl;
}

/**
 * Obtiene la URL de descarga HTTPS de un archivo en Storage.
 *
 * @param {string} gsUrl - URL gs://
 * @returns {Promise<string>} URL HTTPS
 */
export async function getRecordingDownloadUrl(gsUrl) {
  if (!gsUrl) return null;
  const path = gsUrl.replace(/^gs:\/\/[^/]+\//, "");
  const storageRef = ref(storage, path);
  return getDownloadURL(storageRef);
}
