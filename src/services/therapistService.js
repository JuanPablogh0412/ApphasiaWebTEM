import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import emailjs from "@emailjs/browser";

function requireAuth() {
  if (!auth.currentUser) throw new Error("No autenticado");
}


/**
 * 🔹 Login unificado: autentica con Firebase Auth y determina rol por custom claims
 */

export async function loginUnified(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Leer custom claims del token
  const tokenResult = await user.getIdTokenResult();
  const role = tokenResult.claims.role;

  if (role === "admin") {
    return { tipo: "admin", user };
  }

  if (role === "terapeuta") {
    const ref = doc(db, "terapeutas", user.uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    return { tipo: "terapeuta", user, data };
  }

  if (role === "creador") {
    const ref = doc(db, "creadores", user.uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    return { tipo: "creador", user, data };
  }

  // Usuario autenticado pero sin rol asignado
  return { tipo: "ninguno" };
}


/**
 * 🔹 Login de terapeuta (autenticación Firebase + datos en Firestore)
 */
  export async function loginTherapist(email, password) {
    try {
      // 1️⃣ Autenticar con Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2️⃣ Obtener datos del terapeuta usando UID
      const ref = doc(db, "terapeutas", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
            return { success: true, user, data: null };
      }

      // 3️⃣ Retornar datos combinados
      return { success: true, user, data: { id: snap.id, ...snap.data() } };
    } catch (err) {
        return { success: false, error: err.message };
    }
  }

/**
 * 🔹 Obtener información del terapeuta por UID
 */
export async function getTherapistData(therapistId) {
  requireAuth();
  try {
    const ref = doc(db, "terapeutas", therapistId);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    return null;
  }
}

/**
 * 🔹 Obtener nombre de un usuario por UID (busca en terapeutas y creadores)
 */
export async function getUserDisplayInfo(uid) {
  requireAuth();
  try {
    // Buscar en terapeutas
    const tRef = doc(db, "terapeutas", uid);
    const tSnap = await getDoc(tRef);
    if (tSnap.exists()) {
      const d = tSnap.data();
      return { nombre: d.nombre || d.email || uid, role: "terapeuta", ...d, id: tSnap.id };
    }
    // Buscar en creadores
    const cRef = doc(db, "creadores", uid);
    const cSnap = await getDoc(cRef);
    if (cSnap.exists()) {
      const d = cSnap.data();
      return { nombre: d.nombre || d.email || uid, role: "creador", ...d, id: cSnap.id };
    }
    return { nombre: uid, role: "desconocido", id: uid };
  } catch {
    return { nombre: uid, role: "desconocido", id: uid };
  }
}

/**
 * 🔹 Obtener pacientes asignados a un terapeuta
 */
export function getPatientsByTherapist(therapistId, callback) {
  requireAuth();
  const ref = collection(db, "pacientes");
  const q = query(ref, where("terapeuta", "==", therapistId)); // 👈 ahora UID

  const unsubscribe = onSnapshot(q, async (snapshot) => {
    const patients = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const ejerciciosRef = collection(db, "pacientes", docSnap.id, "ejercicios_asignados");
        const ejerciciosSnap = await getDocs(ejerciciosRef);
        const cantidadEjercicios = ejerciciosSnap.size;

        return {
          id: docSnap.id,
          ...data,
          cantidadEjercicios,
        };
      })
    );

    callback(patients);
  });

  return unsubscribe;
}

/**
 * 🔹 Suscribe al conteo de ejercicios no revisados (global)
 */
export function subscribePendingExercises(callback) {
  requireAuth();
  const ejerciciosRef = collection(db, "ejercicios");
  const q = query(ejerciciosRef, where("revisado", "==", false));
  const unsubscribe = onSnapshot(q, (snap) => {
    callback(snap.size);
  });
  return unsubscribe;
}

/**
 * 🔹 Suscribe al conteo de ejercicios visibles y no revisados del terapeuta
 */
export async function subscribePendingVisibleExercises(therapistId, callback) {
  requireAuth();
  // 1️⃣ Obtener IDs (UIDs) de los pacientes del terapeuta
  const pacientesRef = collection(db, "pacientes");
  const pacientesQuery = query(pacientesRef, where("terapeuta", "==", therapistId));
  const pacientesSnap = await getDocs(pacientesQuery);
  const patientIds = pacientesSnap.docs.map((doc) => doc.id);

  // 2️⃣ Suscribirse a todos los ejercicios pendientes
  const ejerciciosRef = collection(db, "ejercicios");
  const q = query(ejerciciosRef, where("revisado", "==", false));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    // 3️⃣ Filtrar por visibilidad (usando UID)
    const visibleCount = snapshot.docs.filter((doc) => {
      const e = doc.data();
      const isPublic = e.tipo === "publico";
      const isPrivateOwn = e.tipo === "privado" && e.creado_por === therapistId;
      const isPrivatePatient =
        e.tipo === "privado" && (patientIds.includes(e.creado_por) || patientIds.includes(e.id_paciente));
      return isPublic || isPrivateOwn || isPrivatePatient;
    }).length;

    callback(visibleCount);
  });

  return unsubscribe;
}

/**
 * 🔹 Suscribe al conteo de pacientes asignados (desde el documento del terapeuta)
 */
export function subscribeAssignedPatients(therapistId, callback) {
  requireAuth();
  const ref = doc(db, "terapeutas", therapistId); // 👈 UID
  const unsubscribe = onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const numPacientes = data.pacientes ? data.pacientes.length : 0;
      callback(numPacientes);
    } else {
      callback(0);
    }
  });
  return unsubscribe;
}

/**
 * 🔹 Obtener el perfil completo del terapeuta (por UID)
 */
export async function getTherapistProfile(therapistId) {
  try {
    const ref = doc(db, "terapeutas", therapistId);
    const snap = await getDoc(ref);
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    return null;
  } catch (err) {
    throw err;
  }
}

/**
 * 🔹 Enviar solicitud de registro de terapeuta
 */
export const sendTherapistRequest = async (data) => {
  const solicitudesRef = collection(db, "solicitudes");
  await addDoc(solicitudesRef, {
    ...data,
    estado: "pendiente",
    fecha: serverTimestamp(),
  });

  // Notificar al admin por correo (fallo silencioso si EmailJS no está configurado)
  try {
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_SOLICITUD;

    if (publicKey && serviceId && templateId &&
        !publicKey.startsWith("TU_") && !serviceId.startsWith("TU_")) {
      await emailjs.send(
        serviceId,
        templateId,
        {
          nombre: data.nombre,
          email_solicitante: data.email,
          profesion: data.profesion,
          celular: data.celular || "—",
          motivacion: data.motivacion || "—",
          dashboard_url: "https://apphasia.me/admin/dashboard",
        },
        publicKey
      );
    }
  } catch (e) {
    // El fallo del email no debe bloquear el registro
    console.warn("No se pudo enviar notificación al admin:", e);
  }
};

/**
 * 🔹 Restablecer contraseña (correo real del terapeuta)
 */
export async function resetTherapistPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email, {
      url: "https://apphasia.me",
      handleCodeInApp: true,
    });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
