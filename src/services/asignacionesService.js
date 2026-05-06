import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

const COL = "asignaciones_TEM";

/**
 * Suscripción real-time a la asignación activa de un paciente.
 * Solo puede haber una con activa == true a la vez.
 */
export function subscribeActiveAssignment(pacienteId, callback) {
  const q = query(
    collection(db, COL),
    where("pacienteId", "==", pacienteId),
    where("activa", "==", true)
  );
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(docs.length > 0 ? docs[0] : null);
    },
    (err) => {
      console.error("[asignaciones_TEM] subscribe active error:", err.message);
      callback(null);
    }
  );
}

/**
 * Suscripción real-time a TODAS las asignaciones de un paciente (historial).
 * Ordenadas por fecha de creación descendente.
 */
export function subscribeAssignmentHistory(pacienteId, callback) {
  const q = query(
    collection(db, COL),
    where("pacienteId", "==", pacienteId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => {
      console.error("[asignaciones_TEM] subscribe history error:", err.message);
      callback([]);
    }
  );
}

/**
 * Crea una nueva asignación TEM para un paciente.
 * Desactiva automáticamente cualquier asignación activa previa.
 */
export async function createAssignment({
  terapeutaId,
  pacienteId,
  estimulosIds,
  nivel,
  notas,
}) {
  if (!estimulosIds || estimulosIds.length < 5) {
    throw new Error("Se requieren al menos 5 estímulos para crear una asignación.");
  }

  // Desactivar asignación activa previa
  const activeQ = query(
    collection(db, COL),
    where("pacienteId", "==", pacienteId),
    where("activa", "==", true)
  );
  const activeSnap = await getDocs(activeQ);
  for (const d of activeSnap.docs) {
    await updateDoc(doc(db, COL, d.id), { activa: false });
  }

  // Crear nueva asignación
  const docRef = await addDoc(collection(db, COL), {
    terapeutaId,
    pacienteId,
    estimulosIds,
    nivel,
    notas: notas || "",
    activa: true,
    activaDesde: serverTimestamp(),
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Desactiva una asignación (marca activa = false).
 */
export async function deactivateAssignment(asignacionId) {
  await updateDoc(doc(db, COL, asignacionId), { activa: false });
}
