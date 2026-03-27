import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Obtiene todos los contextos almacenados en la colección "contextos"
 * de Firestore. Cada documento debe tener al menos el campo `context`.
 */
export async function getAllContexts() {
  try {
    const snapshot = await getDocs(collection(db, "contextos"));
    const contexts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return contexts;
  } catch (err) {
    throw err;
  }
}

/**
 * Crea un nuevo contexto en la colección "contextos".
 * @param {string} nombre - Nombre del contexto (e.g. "Educación")
 * @returns {string} docId del contexto creado
 */
export async function createContext(nombre) {
  const docRef = await addDoc(collection(db, "contextos"), {
    contexto: nombre,
  });
  return docRef.id;
}
