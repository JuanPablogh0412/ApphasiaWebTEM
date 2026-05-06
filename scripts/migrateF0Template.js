import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { generateF0Template } from "../src/utils/f0Template.js";

const firebaseConfig = {
  apiKey: "AIzaSyCGbeUovCiz7fw021sVffODfSM7_WYp5XQ",
  authDomain: "apphasia-7a930.firebaseapp.com",
  projectId: "apphasia-7a930",
  storageBucket: "apphasia-7a930.firebasestorage.app",
  messagingSenderId: "835895355070",
  appId: "1:835895355070:web:48e8b7cf1339988813a0ef",
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});
const auth = getAuth(app);

async function migrate() {
  // Autenticarse como admin
  const email = process.env.FIREBASE_ADMIN_EMAIL;
  const password = process.env.FIREBASE_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Setea FIREBASE_ADMIN_EMAIL y FIREBASE_ADMIN_PASSWORD como variables de entorno");
    process.exit(1);
  }
  await signInWithEmailAndPassword(auth, email, password);
  console.log("✅ Autenticado como admin\n");

  const snap = await getDocs(collection(db, "stimuli_TEM"));
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();

    if (data.f0_template_hz && data.f0_template_hz.length === (data.syllables?.length ?? 0)) {
      skipped++;
      continue;
    }

    const patronTonal = data.patron_tonal;
    if (!patronTonal) {
      console.warn(`⚠️  ${docSnap.id} no tiene patron_tonal — saltando`);
      skipped++;
      continue;
    }

    const f0 = generateF0Template(patronTonal);

    if (data.syllables && f0.length !== data.syllables.length) {
      console.error(
        `❌ ${docSnap.id}: f0(${f0.length}) !== syllables(${data.syllables.length})`
      );
      continue;
    }

    await updateDoc(doc(db, "stimuli_TEM", docSnap.id), { f0_template_hz: f0 });
    updated++;
    console.log(`✅ ${docSnap.id} → [${f0.join(", ")}]`);
  }

  console.log(`\nMigración completa: ${updated} actualizados, ${skipped} saltados`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
