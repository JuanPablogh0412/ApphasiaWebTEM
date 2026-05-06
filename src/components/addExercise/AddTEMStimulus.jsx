// AddTEMStimulus.jsx — Wizard de 4 pasos para crear un estímulo TEM.
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../common/Navbar";
import QRRecordPrompt from "../recording/QRRecordPrompt";

import { syllabify } from "../../utils/syllabifier";
import { generateTonalPattern } from "../../utils/tonalPattern";
import { validateStimulus } from "../../utils/temRubricValidator";
import { generateTimings, getAudioDurationMs, detectF0PerSyllable } from "../../utils/audioTimings";

import { createTEMStimulus, checkTEMStimulusDuplicate, getTEMStorageUrl } from "../../services/temService";
import { getAllContexts, createContext } from "../../services/contextService";
import { getRecordingDownloadUrl } from "../../services/recordingService";
import { auth } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";

import "./AddTEMStimulus.css";

const STEPS = [
  "Texto y nivel",
  "Grabación",
  "Imagen y contexto",
  "Resumen",
];

export default function AddTEMStimulus() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [step, setStep] = useState(0);
  const [therapistId, setTherapistId] = useState(null);
  const [saving, setSaving] = useState(false);

  // ── Step 1 state ──
  const [texto, setTexto] = useState("");
  const [nivel, setNivel] = useState(1);
  const [syllables, setSyllables] = useState([]);
  const [tonalPattern, setTonalPattern] = useState("");
  const [validation, setValidation] = useState(null);

  // Duplicate detection
  const [duplicateWarning, setDuplicateWarning] = useState(null); // null | "checking" | { found: true, texto } | { found: false }

  // ── Step 2 state — slot 1: Entonado ──
  const [audioGsUrl, setAudioGsUrl] = useState("");
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [timings, setTimings] = useState({ onsets_ms: [], durations_ms: [] });
  const [f0Entonado, setF0Entonado] = useState([]);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [videoGsUrl, setVideoGsUrl] = useState("");
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [showRecordingQR, setShowRecordingQR] = useState(false);

  // ── Step 2 state — slot 2: Sprechgesang (solo N3) ──
  const [audioSprechGsUrl, setAudioSprechGsUrl] = useState("");
  const [audioSprechPreviewUrl, setAudioSprechPreviewUrl] = useState(null);
  const [videoSprechGsUrl, setVideoSprechGsUrl] = useState("");
  const [videoSprechPreviewUrl, setVideoSprechPreviewUrl] = useState(null);
  const [audioDurationMsSprech, setAudioDurationMsSprech] = useState(0);
  const [timingsSprech, setTimingsSprech] = useState({ onsets_ms: [], durations_ms: [] });
  const [f0Sprech, setF0Sprech] = useState([]);
  const [showRecordingQR2, setShowRecordingQR2] = useState(false);

  // ── Step 2 state — slot 3: Habla normal (solo N3) ──
  const [audioHablaGsUrl, setAudioHablaGsUrl] = useState("");
  const [audioHablaPreviewUrl, setAudioHablaPreviewUrl] = useState(null);
  const [videoHablaGsUrl, setVideoHablaGsUrl] = useState("");
  const [videoHablaPreviewUrl, setVideoHablaPreviewUrl] = useState(null);
  const [audioDurationMsHabla, setAudioDurationMsHabla] = useState(0);
  const [timingsHabla, setTimingsHabla] = useState({ onsets_ms: [], durations_ms: [] });
  const [f0Habla, setF0Habla] = useState([]);
  const [showRecordingQR3, setShowRecordingQR3] = useState(false);

  // ── Step 4 state (imagen + contexto) ──
  const [imagenFile, setImagenFile] = useState(null);
  const [imagenPreview, setImagenPreview] = useState(null);
  const [pregunta, setPregunta] = useState("");
  const [categoria, setCategoria] = useState("");
  const [allContexts, setAllContexts] = useState([]);
  const [newContextName, setNewContextName] = useState("");
  const [showNewContext, setShowNewContext] = useState(false);
  const fileInputRef = useRef(null);

  // Auth check
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) return navigate("/");
      setTherapistId(user.uid);
    });
    return unsub;
  }, [navigate]);

  // Load contexts
  useEffect(() => {
    getAllContexts()
      .then(setAllContexts)
      .catch(() => {});
  }, []);

  // ────────────────────────────────────────
  // Step 1 helpers
  // ────────────────────────────────────────
  const recalculate = useCallback(
    (txt, niv) => {
      if (!txt.trim()) {
        setSyllables([]);
        setTonalPattern("");
        setValidation(null);
        return;
      }
      const syls = syllabify(txt);
      const tp = generateTonalPattern(txt);
      setSyllables(syls);
      setTonalPattern(tp);
      setValidation(
        validateStimulus({
          texto: txt,
          nivel: niv,
          syllables: syls,
          patronTonal: tp,
        })
      );
    },
    []
  );

  const handleTextoChange = (e) => {
    const v = e.target.value;
    setTexto(v);
    setDuplicateWarning(null);
    recalculate(v, nivel);
  };

  const handleNivelChange = (e) => {
    const n = Number(e.target.value);
    setNivel(n);
    setDuplicateWarning(null);
    recalculate(texto, n);
  };

  const toggleTonal = (idx) => {
    const arr = tonalPattern.split("");
    arr[idx] = arr[idx] === "H" ? "L" : "H";
    const newTp = arr.join("");
    setTonalPattern(newTp);
    setValidation(
      validateStimulus({
        texto,
        nivel,
        syllables,
        patronTonal: newTp,
      })
    );
  };

  // ────────────────────────────────────────
  // Step 2 helpers (grabación dual)
  // ────────────────────────────────────────
  const handleRecordingComplete = useCallback(
    async ({ audioStorageUrl, videoStorageUrl }) => {
      setAudioGsUrl(audioStorageUrl);
      setVideoGsUrl(videoStorageUrl);
      setShowRecordingQR(false);
      // Al re-grabar slot 1, limpiar slots 2 y 3
      setAudioSprechGsUrl(""); setVideoSprechGsUrl("");
      setAudioSprechPreviewUrl(null); setVideoSprechPreviewUrl(null);
      setShowRecordingQR2(false);
      setAudioHablaGsUrl(""); setVideoHablaGsUrl("");
      setAudioHablaPreviewUrl(null); setVideoHablaPreviewUrl(null);
      setShowRecordingQR3(false);

      try {
        const [audioHttpUrl, videoHttpUrl] = await Promise.all([
          getRecordingDownloadUrl(audioStorageUrl),
          getRecordingDownloadUrl(videoStorageUrl),
        ]);
        setAudioPreviewUrl(audioHttpUrl);
        setVideoPreviewUrl(videoHttpUrl);

        // Compute duration + timings + F0 from audio
        const resp = await fetch(audioHttpUrl);
        const blob = await resp.blob();
        const file = new File([blob], "audio.webm", { type: blob.type });
        const dur = await getAudioDurationMs(file);
        const t = generateTimings(syllables, dur);
        setAudioDurationMs(dur);
        setTimings(t);
        try {
          const f0 = await detectF0PerSyllable(file, t.onsets_ms, t.durations_ms);
          setF0Entonado(f0);
        } catch {
          setF0Entonado([]);
        }
      } catch {
        setAudioDurationMs(0);
        setTimings({ onsets_ms: [], durations_ms: [] });
        setF0Entonado([]);
      }
    },
    [syllables]
  );

  const handleRecordingComplete2 = useCallback(
    async ({ audioStorageUrl, videoStorageUrl }) => {
      setAudioSprechGsUrl(audioStorageUrl);
      setVideoSprechGsUrl(videoStorageUrl);
      setShowRecordingQR2(false);
      // Al re-grabar slot 2, limpiar slot 3
      setAudioHablaGsUrl(""); setVideoHablaGsUrl("");
      setAudioHablaPreviewUrl(null); setVideoHablaPreviewUrl(null);
      setAudioDurationMsHabla(0); setTimingsHabla({ onsets_ms: [], durations_ms: [] }); setF0Habla([]);
      setShowRecordingQR3(false);

      try {
        const [audioHttpUrl, videoHttpUrl] = await Promise.all([
          getRecordingDownloadUrl(audioStorageUrl),
          getRecordingDownloadUrl(videoStorageUrl),
        ]);
        setAudioSprechPreviewUrl(audioHttpUrl);
        setVideoSprechPreviewUrl(videoHttpUrl);

        const resp = await fetch(audioHttpUrl);
        const blob = await resp.blob();
        const file = new File([blob], "audio.webm", { type: blob.type });
        const dur = await getAudioDurationMs(file);
        const t = generateTimings(syllables, dur);
        setAudioDurationMsSprech(dur);
        setTimingsSprech(t);
        try {
          const f0 = await detectF0PerSyllable(file, t.onsets_ms, t.durations_ms);
          setF0Sprech(f0);
        } catch {
          setF0Sprech([]);
        }
      } catch {
        setAudioSprechPreviewUrl(null);
        setVideoSprechPreviewUrl(null);
        setAudioDurationMsSprech(0);
        setTimingsSprech({ onsets_ms: [], durations_ms: [] });
        setF0Sprech([]);
      }
    },
    [syllables]
  );

  const handleRecordingComplete3 = useCallback(
    async ({ audioStorageUrl, videoStorageUrl }) => {
      setAudioHablaGsUrl(audioStorageUrl);
      setVideoHablaGsUrl(videoStorageUrl);
      setShowRecordingQR3(false);

      try {
        const [audioHttpUrl, videoHttpUrl] = await Promise.all([
          getRecordingDownloadUrl(audioStorageUrl),
          getRecordingDownloadUrl(videoStorageUrl),
        ]);
        setAudioHablaPreviewUrl(audioHttpUrl);
        setVideoHablaPreviewUrl(videoHttpUrl);

        const resp = await fetch(audioHttpUrl);
        const blob = await resp.blob();
        const file = new File([blob], "audio.webm", { type: blob.type });
        const dur = await getAudioDurationMs(file);
        const t = generateTimings(syllables, dur);
        setAudioDurationMsHabla(dur);
        setTimingsHabla(t);
        try {
          const f0 = await detectF0PerSyllable(file, t.onsets_ms, t.durations_ms);
          setF0Habla(f0);
        } catch {
          setF0Habla([]);
        }
      } catch {
        setAudioHablaPreviewUrl(null);
        setVideoHablaPreviewUrl(null);
        setAudioDurationMsHabla(0);
        setTimingsHabla({ onsets_ms: [], durations_ms: [] });
        setF0Habla([]);
      }
    },
    [syllables]
  );

  // ────────────────────────────────────────
  // Step 4 helpers (imagen + contexto)
  // ────────────────────────────────────────
  const handleImageFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImagenFile(f);
    setImagenPreview(URL.createObjectURL(f));
  };

  const handleCreateContext = async () => {
    const name = newContextName.trim();
    if (!name) return;
    try {
      const id = await createContext(name);
      const ctx = { id, contexto: name };
      setAllContexts((prev) => [...prev, ctx]);
      setCategoria(name);
      setNewContextName("");
      setShowNewContext(false);
    } catch {
      alert("Error al crear el contexto.");
    }
  };

  // ────────────────────────────────────────
  // Step 5: Save
  // ────────────────────────────────────────
  const handleSave = async () => {
    // Final validation
    const v = validateStimulus({
      texto,
      nivel,
      syllables,
      patronTonal: tonalPattern,
    });
    if (!v.valid) {
      alert("El estímulo no pasa la validación clínica:\n" + v.errors.map(e => e.msg).join("\n"));
      return;
    }

    setSaving(true);
    try {
      const extraN3 = nivel === 3 ? {
        audio_url_sprechgesang: audioSprechGsUrl,
        video_url_sprechgesang: videoSprechGsUrl,
        onsets_ms_sprechgesang: timingsSprech.onsets_ms,
        durations_ms_sprechgesang: timingsSprech.durations_ms,
        audio_duration_ms_sprechgesang: audioDurationMsSprech,
        f0_template_hz_sprechgesang: f0Sprech,
        audio_url_habla_normal: audioHablaGsUrl,
        video_url_habla_normal: videoHablaGsUrl,
        onsets_ms_habla_normal: timingsHabla.onsets_ms,
        durations_ms_habla_normal: timingsHabla.durations_ms,
        audio_duration_ms_habla_normal: audioDurationMsHabla,
        f0_template_hz_habla_normal: f0Habla,
      } : {};
      await createTEMStimulus(
        {
          texto: texto.trim(),
          syllables,
          patron_tonal: tonalPattern,
          nivel_clinico: nivel,
          categoria,
          pregunta: pregunta.trim(),
          audio_url: audioGsUrl,
          audio_duration_ms: audioDurationMs,
          onsets_ms: timings.onsets_ms,
          durations_ms: timings.durations_ms,
          f0_template_hz: f0Entonado,
          video_url: videoGsUrl,
          creado_por: therapistId,
          estado: role === "creador" ? "pendiente_revision" : "aprobado",
          ...extraN3,
        },
        imagenFile
      );
      navigate(role === "creador" ? "/creador/dashboard" : "/ejercicios");
    } catch (err) {
      alert("Error al guardar el estímulo: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ────────────────────────────────────────
  // Navigation
  // ────────────────────────────────────────
  const canNext = () => {
    if (step === 0) return texto.trim().length > 0 && validation?.valid && duplicateWarning?.found !== true;
    if (step === 1) {
      if (nivel === 3) {
        return !!audioGsUrl && !!videoGsUrl &&
               !!audioSprechGsUrl && !!videoSprechGsUrl &&
               !!audioHablaGsUrl && !!videoHablaGsUrl;
      }
      return !!audioGsUrl && !!videoGsUrl;
    }
    if (step === 2) return !!imagenFile && pregunta.trim().length > 0 && !!categoria;
    return true;
  };

  const goNext = async () => {
    // En paso 0, verificar duplicados antes de avanzar
    if (step === 0) {
      setDuplicateWarning("checking");
      try {
        const dupes = await checkTEMStimulusDuplicate(texto, nivel);
        if (dupes.length > 0) {
          setDuplicateWarning({ found: true, texto: texto.trim() });
          return; // No avanza
        }
        setDuplicateWarning({ found: false });
      } catch {
        setDuplicateWarning({ found: false }); // Si falla la consulta, dejar pasar
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    if (step === 0) setDuplicateWarning(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  // ────────────────────────────────────────
  // Render helpers
  // ────────────────────────────────────────
  const renderStepper = () => (
    <div className="tem-stepper">
      {STEPS.map((label, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <div className={`tem-step-line ${i <= step ? "done" : ""}`} />
          )}
          <div
            className={`tem-step-indicator ${
              i === step ? "active" : i < step ? "done" : ""
            }`}
            title={label}
          >
            {i < step ? "✓" : i + 1}
          </div>
        </React.Fragment>
      ))}
    </div>
  );

  // ── Step 1 ──
  const renderStep1 = () => (
    <>
      <h3>1. Texto del estímulo y nivel clínico</h3>

      <div className="tem-field">
        <label>Texto del estímulo</label>
        <textarea
          value={texto}
          onChange={handleTextoChange}
          placeholder="Ej: El gato come pescado"
          rows={2}
        />
      </div>

      <div className="tem-field-row">
        <div className="tem-field">
          <label>Nivel clínico</label>
          <select value={nivel} onChange={handleNivelChange}>
            <option value={1}>Nivel 1</option>
            <option value={2}>Nivel 2</option>
            <option value={3}>Nivel 3</option>
          </select>
        </div>
        <div className="tem-field">
          <label>Sílabas ({syllables.length})</label>
          <div className="tem-syllable-chips">
            {syllables.map((s, i) => (
              <span key={i} className="tem-syllable-chip">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="tem-field">
        <label>
          Patrón tonal (clic para cambiar){" "}
          <span style={{ fontWeight: 400, color: "#999" }}>
            H = Alto, L = Bajo
          </span>
        </label>
        <div className="tem-tonal-row">
          {tonalPattern.split("").map((t, i) => (
            <button
              key={i}
              type="button"
              className={`tem-tonal-btn ${t === "H" ? "high" : "low"}`}
              onClick={() => toggleTonal(i)}
              title={syllables[i] || ""}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {validation && (
        <div
          className={`tem-validation-panel ${
            validation.valid ? "valid" : "invalid"
          }`}
        >
          <strong>
            {validation.valid
              ? "✅ El estímulo cumple la rúbrica clínica"
              : "❌ No cumple la rúbrica clínica"}
          </strong>
          {validation.errors.length > 0 && (
            <ul>
              {validation.errors.map((e, i) => (
                <li key={i}>{e.msg}</li>
              ))}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <div className="tem-validation-warnings">
              <strong>⚠ Advertencias:</strong>
              <ul>
                {validation.warnings.map((w, i) => (
                  <li key={i}>{w.msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Aviso de duplicado */}
      {duplicateWarning === "checking" && (
        <div className="tem-duplicate-checking">
          🔍 Verificando si el estímulo ya existe…
        </div>
      )}
      {duplicateWarning?.found === true && (
        <div className="tem-duplicate-error">
          <strong>⛔ Estímulo duplicado</strong>
          <p>
            Ya existe un estímulo de <strong>Nivel {nivel}</strong> con el texto{" "}
            <em>«{duplicateWarning.texto}»</em> en la base de datos. No se pueden
            crear estímulos duplicados. Modifica el texto o cambia el nivel.
          </p>
        </div>
      )}
    </>
  );

  // ── Step 2: Grabación unificada (audio + video) ──
  const renderRecordingSlot = ({
    slotNumber,
    label,
    stimulusTextSuffix,
    audioGsUrlVal,
    videoGsUrlVal,
    audioPreviewUrlVal,
    videoPreviewUrlVal,
    audioDurationMsVal,
    showQR,
    setShowQR,
    onComplete,
    onClear,
    disabled,
  }) => (
    <div className="tem-recording-slot" style={{ marginBottom: "1.5rem", padding: "1rem", border: "1px solid #e0e0e0", borderRadius: "0.5rem", opacity: disabled ? 0.5 : 1 }}>
      <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
        Grabación {slotNumber}: <span style={{ fontWeight: 400 }}>{label}</span>
      </h4>

      {audioGsUrlVal && videoGsUrlVal && !showQR ? (
        <div>
          <div className="tem-validation-panel valid" style={{ marginBottom: "0.5rem" }}>
            <strong>✅ Grabado correctamente</strong>
            {audioDurationMsVal > 0 && (
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
                Duración: {(audioDurationMsVal / 1000).toFixed(1)}s
              </p>
            )}
          </div>
          {audioPreviewUrlVal && (
            <div style={{ marginTop: "0.4rem" }}>
              <strong style={{ fontSize: "0.88rem" }}>🎤 Audio:</strong>
              <audio src={audioPreviewUrlVal} controls style={{ width: "100%", marginTop: "0.3rem" }} />
            </div>
          )}
          {videoPreviewUrlVal && (
            <div style={{ marginTop: "0.4rem" }}>
              <strong style={{ fontSize: "0.88rem" }}>📹 Video (sin sonido):</strong>
              <video src={videoPreviewUrlVal} controls playsInline muted style={{ maxWidth: "100%", borderRadius: "0.5rem", marginTop: "0.3rem" }} />
            </div>
          )}
          {!disabled && (
            <button className="tem-skip-btn" onClick={onClear}>
              Volver a grabar
            </button>
          )}
        </div>
      ) : (
        <div className="tem-qr-section">
          {!showQR && (
            <button
              className="tem-btn tem-btn-next"
              disabled={disabled}
              onClick={() => !disabled && setShowQR(true)}
            >
              Iniciar grabación
            </button>
          )}
          {showQR && therapistId && (
            <QRRecordPrompt
              type="video_audio"
              therapistId={therapistId}
              stimulusText={`${texto}${stimulusTextSuffix}`}
              syllables={syllables}
              tonalPattern={tonalPattern}
              onComplete={onComplete}
              onCancel={() => setShowQR(false)}
            />
          )}
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <>
      <h3>2. Grabación de video y audio</h3>
      <p style={{ color: "#666", fontSize: "0.92rem" }}>
        Escanea el código QR con tu celular para grabar <strong>simultáneamente</strong> el
        audio y el video del estímulo.
        {nivel === 3 && " Para Nivel 3 se requieren 3 grabaciones secuenciales."}
      </p>

      {renderRecordingSlot({
        slotNumber: 1,
        label: nivel === 3 ? "Entonado — melodía completa" : "Audio y video",
        stimulusTextSuffix: nivel === 3 ? " (Entonado — melodía completa)" : "",
        audioGsUrlVal: audioGsUrl,
        videoGsUrlVal: videoGsUrl,
        audioPreviewUrlVal: audioPreviewUrl,
        videoPreviewUrlVal: videoPreviewUrl,
        audioDurationMsVal: audioDurationMs,
        showQR: showRecordingQR,
        setShowQR: setShowRecordingQR,
        onComplete: handleRecordingComplete,
        onClear: () => {
          setAudioGsUrl(""); setVideoGsUrl("");
          setAudioDurationMs(0); setTimings({ onsets_ms: [], durations_ms: [] }); setF0Entonado([]);
          setAudioPreviewUrl(null); setVideoPreviewUrl(null);
          setShowRecordingQR(true);
          // Cascade: clear 2 and 3
          setAudioSprechGsUrl(""); setVideoSprechGsUrl("");
          setAudioSprechPreviewUrl(null); setVideoSprechPreviewUrl(null);
          setAudioDurationMsSprech(0); setTimingsSprech({ onsets_ms: [], durations_ms: [] }); setF0Sprech([]);
          setShowRecordingQR2(false);
          setAudioHablaGsUrl(""); setVideoHablaGsUrl("");
          setAudioHablaPreviewUrl(null); setVideoHablaPreviewUrl(null);
          setAudioDurationMsHabla(0); setTimingsHabla({ onsets_ms: [], durations_ms: [] }); setF0Habla([]);
          setShowRecordingQR3(false);
        },
        disabled: false,
      })}

      {nivel === 3 && renderRecordingSlot({
        slotNumber: 2,
        label: "Sprechgesang — melodía suavizada",
        stimulusTextSuffix: " (Sprechgesang — melodía suavizada)",
        audioGsUrlVal: audioSprechGsUrl,
        videoGsUrlVal: videoSprechGsUrl,
        audioPreviewUrlVal: audioSprechPreviewUrl,
        videoPreviewUrlVal: videoSprechPreviewUrl,
        audioDurationMsVal: audioDurationMsSprech,
        showQR: showRecordingQR2,
        setShowQR: setShowRecordingQR2,
        onComplete: handleRecordingComplete2,
        onClear: () => {
          setAudioSprechGsUrl(""); setVideoSprechGsUrl("");
          setAudioSprechPreviewUrl(null); setVideoSprechPreviewUrl(null);
          setAudioDurationMsSprech(0); setTimingsSprech({ onsets_ms: [], durations_ms: [] }); setF0Sprech([]);
          setShowRecordingQR2(true);
          // Cascade: clear 3
          setAudioHablaGsUrl(""); setVideoHablaGsUrl("");
          setAudioHablaPreviewUrl(null); setVideoHablaPreviewUrl(null);
          setAudioDurationMsHabla(0); setTimingsHabla({ onsets_ms: [], durations_ms: [] }); setF0Habla([]);
          setShowRecordingQR3(false);
        },
        disabled: !(audioGsUrl && videoGsUrl),
      })}

      {nivel === 3 && renderRecordingSlot({
        slotNumber: 3,
        label: "Habla normal — sin melodía",
        stimulusTextSuffix: " (Habla normal — sin melodía)",
        audioGsUrlVal: audioHablaGsUrl,
        videoGsUrlVal: videoHablaGsUrl,
        audioPreviewUrlVal: audioHablaPreviewUrl,
        videoPreviewUrlVal: videoHablaPreviewUrl,
        audioDurationMsVal: audioDurationMsHabla,
        showQR: showRecordingQR3,
        setShowQR: setShowRecordingQR3,
        onComplete: handleRecordingComplete3,
        onClear: () => {
          setAudioHablaGsUrl(""); setVideoHablaGsUrl("");
          setAudioHablaPreviewUrl(null); setVideoHablaPreviewUrl(null);
          setShowRecordingQR3(true);
        },
        disabled: !(audioSprechGsUrl && videoSprechGsUrl),
      })}
    </>
  );

  // ── Step 3 ──
  const renderStep3 = () => (
    <>
      <h3>3. Imagen, pregunta y contexto</h3>

      <div className="tem-field">
        <label>
          Imagen del estímulo <span className="tem-required">*</span>
        </label>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleImageFile}
        />
        {imagenPreview ? (
          <div>
            <img
              src={imagenPreview}
              alt="Vista previa"
              className="tem-image-preview"
            />
            <button
              className="tem-skip-btn"
              onClick={() => {
                setImagenFile(null);
                setImagenPreview(null);
              }}
            >
              Quitar imagen
            </button>
          </div>
        ) : (
          <div
            className={`tem-image-upload-area ${!imagenFile ? "tem-field-required" : ""}`}
            onClick={() => fileInputRef.current?.click()}
          >
            📁 Haz clic para seleccionar una imagen
          </div>
        )}
        {!imagenFile && (
          <span className="tem-field-hint">La imagen es obligatoria</span>
        )}
      </div>

      <div className="tem-field">
        <label>
          Pregunta (paso 5 de la terapia) <span className="tem-required">*</span>
        </label>
        <textarea
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Ej: ¿Qué está haciendo el gato?"
          rows={2}
          className={!pregunta.trim() ? "tem-input-required" : ""}
        />
        {!pregunta.trim() && (
          <span className="tem-field-hint">La pregunta es obligatoria</span>
        )}
      </div>

      <div className="tem-field">
        <label>
          Contexto / Categoría <span className="tem-required">*</span>
        </label>
        <select
          value={categoria}
          className={!categoria ? "tem-input-required" : ""}
          onChange={(e) => {
            if (e.target.value === "__new__") {
              setShowNewContext(true);
              setCategoria("");
            } else {
              setCategoria(e.target.value);
              setShowNewContext(false);
            }
          }}
        >
          <option value="">— Selecciona un contexto —</option>
          {allContexts.map((c) => (
            <option key={c.id} value={c.contexto}>
              {c.contexto}
            </option>
          ))}
          <option value="__new__">+ Crear nuevo contexto</option>
        </select>
        {showNewContext && (
          <div className="tem-new-context-row">
            <input
              type="text"
              value={newContextName}
              onChange={(e) => setNewContextName(e.target.value)}
              placeholder="Nombre del nuevo contexto"
            />
            <button onClick={handleCreateContext}>Crear</button>
          </div>
        )}
      </div>
    </>
  );

  const handleRerecord = () => {
    setAudioGsUrl("");
    setVideoGsUrl("");
    setAudioDurationMs(0);
    setTimings({ onsets_ms: [], durations_ms: [] });
    setF0Entonado([]);
    setAudioPreviewUrl(null);
    setVideoPreviewUrl(null);
    setShowRecordingQR(false);
    // Also clear slots 2 and 3 if N3
    setAudioSprechGsUrl(""); setVideoSprechGsUrl("");
    setAudioSprechPreviewUrl(null); setVideoSprechPreviewUrl(null);
    setAudioDurationMsSprech(0); setTimingsSprech({ onsets_ms: [], durations_ms: [] }); setF0Sprech([]);
    setShowRecordingQR2(false);
    setAudioHablaGsUrl(""); setVideoHablaGsUrl("");
    setAudioHablaPreviewUrl(null); setVideoHablaPreviewUrl(null);
    setAudioDurationMsHabla(0); setTimingsHabla({ onsets_ms: [], durations_ms: [] }); setF0Habla([]);
    setShowRecordingQR3(false);
    setStep(1);
  };

  // ── Step 4 ──
  const renderStep4 = () => (
    <>
      <h3>4. Resumen del estímulo</h3>

      <div className="tem-summary-section">
        <h4>Texto y nivel</h4>
        <div className="tem-summary-field">
          <strong>Texto:</strong> <span>{texto}</span>
        </div>
        <div className="tem-summary-field">
          <strong>Nivel clínico:</strong> <span>{nivel}</span>
        </div>
        <div className="tem-summary-field">
          <strong>Sílabas:</strong> <span>{syllables.join(" · ")}</span>
        </div>
        <div className="tem-summary-field">
          <strong>Patrón tonal:</strong> <span>{tonalPattern}</span>
        </div>
      </div>

      <div className="tem-summary-section">
        <h4>Verificación de medios</h4>
        <p style={{ fontSize: "0.88rem", color: "#666", marginBottom: "0.75rem" }}>
          Reproduce ambos medios para verificar la sincronización antes de guardar.
        </p>

        <div style={{ marginBottom: "1rem" }}>
          <strong style={{ fontSize: "0.92rem" }}>🎤 Audio{nivel === 3 ? " — Entonado" : ""}{audioDurationMs > 0 ? ` (${(audioDurationMs / 1000).toFixed(1)}s)` : ""}</strong>
          {audioPreviewUrl
            ? <audio src={audioPreviewUrl} controls style={{ width: "100%", marginTop: "0.3rem" }} />
            : <span style={{ color: "#d9534f", fontSize: "0.88rem" }}>❌ Sin audio grabado</span>
          }
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <strong style={{ fontSize: "0.92rem" }}>📹 Video (sin sonido){nivel === 3 ? " — Entonado" : ""}</strong>
          {videoPreviewUrl
            ? <video src={videoPreviewUrl} controls playsInline muted style={{ maxWidth: "100%", borderRadius: "0.5rem", marginTop: "0.3rem" }} />
            : <span style={{ color: "#d9534f", fontSize: "0.88rem" }}>❌ Sin video grabado</span>
          }
        </div>

        {nivel === 3 && (
          <>
            <div style={{ marginBottom: "1rem" }}>
              <strong style={{ fontSize: "0.92rem" }}>🎤 Audio — Sprechgesang</strong>
              {audioSprechPreviewUrl
                ? <audio src={audioSprechPreviewUrl} controls style={{ width: "100%", marginTop: "0.3rem" }} />
                : <span style={{ color: "#d9534f", fontSize: "0.88rem" }}>❌ Sin audio grabado</span>
              }
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <strong style={{ fontSize: "0.92rem" }}>📹 Video (sin sonido) — Sprechgesang</strong>
              {videoSprechPreviewUrl
                ? <video src={videoSprechPreviewUrl} controls playsInline muted style={{ maxWidth: "100%", borderRadius: "0.5rem", marginTop: "0.3rem" }} />
                : <span style={{ color: "#d9534f", fontSize: "0.88rem" }}>❌ Sin video grabado</span>
              }
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <strong style={{ fontSize: "0.92rem" }}>🎤 Audio — Habla normal</strong>
              {audioHablaPreviewUrl
                ? <audio src={audioHablaPreviewUrl} controls style={{ width: "100%", marginTop: "0.3rem" }} />
                : <span style={{ color: "#d9534f", fontSize: "0.88rem" }}>❌ Sin audio grabado</span>
              }
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <strong style={{ fontSize: "0.92rem" }}>📹 Video (sin sonido) — Habla normal</strong>
              {videoHablaPreviewUrl
                ? <video src={videoHablaPreviewUrl} controls playsInline muted style={{ maxWidth: "100%", borderRadius: "0.5rem", marginTop: "0.3rem" }} />
                : <span style={{ color: "#d9534f", fontSize: "0.88rem" }}>❌ Sin video grabado</span>
              }
            </div>
          </>
        )}

        <button className="tem-skip-btn" onClick={handleRerecord}>
          Volver a grabar{nivel === 3 ? " (borrará las 3 grabaciones)" : " audio y video"}
        </button>

        <div className="tem-summary-field">
          <strong>Imagen:</strong>{" "}
          <span>{imagenFile ? "✅ " + imagenFile.name : "❌ Sin imagen"}</span>
        </div>
      </div>

      <div className="tem-summary-section">
        <h4>Detalles adicionales</h4>
        <div className="tem-summary-field">
          <strong>Pregunta:</strong>{" "}
          <span>{pregunta || "(Sin pregunta)"}</span>
        </div>
        <div className="tem-summary-field">
          <strong>Contexto:</strong>{" "}
          <span>{categoria || "(Sin contexto)"}</span>
        </div>
      </div>

      {validation && !validation.valid && (
        <div className="tem-validation-panel invalid">
          <strong>❌ No se puede guardar:</strong>
          <ul>
            {validation.errors.map((e, i) => (
              <li key={i}>{e.msg}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  const stepRenderers = [
    renderStep1,
    renderStep2,
    renderStep3,
    renderStep4,
  ];

  return (
    <div className="page-container">
      <Navbar active="ejercicios" />
      <main className="tem-wizard-page">
        <h2 className="page-title">Crear estímulo TEM</h2>
        <p className="page-subtitle">
          Completa los pasos para registrar un nuevo estímulo de Terapia
          Entonación Melódica.
        </p>

        {renderStepper()}

        <div className="tem-wizard-card">{stepRenderers[step]()}</div>

        <div className="tem-wizard-nav" style={{ maxWidth: 700, width: "100%" }}>
          {step > 0 && (
            <button className="tem-btn tem-btn-back" onClick={goBack}>
              ← Atrás
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < STEPS.length - 1 ? (
            <button
              className="tem-btn tem-btn-next"
              disabled={!canNext()}
              onClick={goNext}
            >
              Siguiente →
            </button>
          ) : (
            <button
              className="tem-btn tem-btn-save"
              disabled={saving || (validation && !validation.valid)}
              onClick={handleSave}
            >
              {saving ? "Guardando…" : "Guardar estímulo"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
