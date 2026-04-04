import { db, functions } from "./firebase";
import { httpsCallable } from "firebase/functions";
import emailjs from "@emailjs/browser";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { subscribeTEMStimuliPending } from "./temService";


// 🔹 obtener solicitudes (una vez)
export const getSolicitudes = async () => {
  const q = query(collection(db, "solicitudes"), orderBy("fecha", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// 🔹 suscripción en tiempo real a solicitudes
export const subscribeToSolicitudes = (callback) => {
  const q = query(collection(db, "solicitudes"), orderBy("fecha", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

export const approveSolicitud = async (solicitud) => {
  const aprobarTerapeuta = httpsCallable(functions, "aprobarTerapeuta");
  let resetLink = null;

  try {
    const result = await aprobarTerapeuta({
      email: solicitud.email,
      nombre: solicitud.nombre,
      celular: solicitud.celular,
      profesion: solicitud.profesion,
      motivacion: solicitud.motivacion || "",
      solicitudId: solicitud.id,
    });
    resetLink = result.data?.resetLink ?? null;
  } catch (err) {
    // Verificar si la aprobación igual ocurrió en Firestore (el error puede ser solo el correo SMTP)
    const snap = await getDoc(doc(db, "solicitudes", solicitud.id));
    const estado = snap.data()?.estado;
    if (estado !== "aprobada") throw err;
    // Si llegó aquí: aprobación exitosa pero sin resetLink (SMTP falló antes de retornar)
  }

  // Enviar correo al terapeuta via EmailJS con el link de activación
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_APROBACION;
  if (templateId) {
    try {
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        templateId,
        {
          to_email: solicitud.email,
          nombre: solicitud.nombre,
          titulo: '¡Tu solicitud fue aprobada!',
          header_color: '#27ae60',
          mensaje: '¡Tu solicitud de registro como terapeuta en RehabilitIA ha sido aprobada! Para acceder a la plataforma, primero debes configurar tu contraseña haciendo clic en el botón de abajo.',
          boton_texto: 'Configura tu contraseña',
          boton_url: resetLink || 'https://apphasia.me',
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      );
    } catch (emailErr) {
      console.error("EmailJS aprobación ERROR status:", emailErr?.status);
      console.error("EmailJS aprobación ERROR text:", emailErr?.text);
      console.error("EmailJS aprobación ERROR full:", emailErr);
    }
  }
};

// 🔹 rechazar solicitud
export const rejectSolicitud = async (solicitud) => {
  const rechazarTerapeuta = httpsCallable(functions, "rechazarTerapeuta");
  try {
    await rechazarTerapeuta({
      id: solicitud.id,
      email: solicitud.email,
    });
  } catch (err) {
    // Verificar si el rechazo igual ocurrió en Firestore
    const snap = await getDoc(doc(db, "solicitudes", solicitud.id));
    const estado = snap.data()?.estado;
    if (estado !== "rechazada") throw err;
  }

  // Enviar correo de rechazo al terapeuta vía EmailJS (misma plantilla, contenido distinto)
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_APROBACION;
  if (templateId) {
    try {
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        templateId,
        {
          to_email: solicitud.email,
          nombre: solicitud.nombre,
          titulo: 'Tu solicitud en RehabilitIA',
          header_color: '#c0392b',
          mensaje: 'Hemos revisado tu solicitud de registro como terapeuta en RehabilitIA. Lamentablemente, en esta ocasión tu solicitud no ha sido aprobada. Si crees que esto es un error o deseas más información, puedes contactarnos respondiendo a este correo.',
          boton_texto: 'Visitar RehabilitIA',
          boton_url: 'https://apphasia.me',
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      );
    } catch (emailErr) {
      console.error("EmailJS rechazo ERROR status:", emailErr?.status);
      console.error("EmailJS rechazo ERROR text:", emailErr?.text);
      console.error("EmailJS rechazo ERROR full:", emailErr);
    }
  }
};


// ══════════════════════════════════════════════
//  MODERACIÓN DE ESTÍMULOS TEM
// ══════════════════════════════════════════════

export { subscribeTEMStimuliPending };

export const approveEstimulo = async (stimulusId) => {
  const aprobarEstimulo = httpsCallable(functions, "aprobarEstimulo");
  const result = await aprobarEstimulo({ stimulusId });
  return result.data;
};

export const rejectEstimulo = async (stimulusId, motivo = "") => {
  const rechazarEstimulo = httpsCallable(functions, "rechazarEstimulo");
  const result = await rechazarEstimulo({ stimulusId, motivo });
  return result.data;
};