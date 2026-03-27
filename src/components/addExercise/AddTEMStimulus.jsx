// AddTEMStimulus.jsx — Wizard de 5 pasos para crear un estímulo TEM.
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../common/Navbar";
import QRRecordPrompt from "../recording/QRRecordPrompt";

import { syllabify } from "../../utils/syllabifier";
import { generateTonalPattern } from "../../utils/tonalPattern";
import { validateStimulus } from "../../utils/temRubricValidator";
import { generateTimings, getAudioDurationMs } from "../../utils/audioTimings";

import { createTEMStimulus, getTEMStorageUrl } from "../../services/temService";
import { getAllContexts, createContext } from "../../services/contextService";
import { getRecordingDownloadUrl } from "../../services/recordingService";
import { auth } from "../../services/firebase";

import "./AddTEMStimulus.css";

const STEPS = [
  "Texto y nivel",
  "Audio",
  "Video",
  "Imagen y contexto",
  "Resumen",
];

export default function AddTEMStimulus() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [therapistId, setTherapistId] = useState(null);
  const [saving, setSaving] = useState(false);

  // ── Step 1 state ──
  const [texto, setTexto] = useState("");
  const [nivel, setNivel] = useState(1);
  const [syllables, setSyllables] = useState([]);
  const [tonalPattern, setTonalPattern] = useState("");
  const [validation, setValidation] = useState(null);

  // ── Step 2 state (audio) ──
  const [audioGsUrl, setAudioGsUrl] = useState("");
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [timings, setTimings] = useState({ onsets_ms: [], durations_ms: [] });
  const [showAudioQR, setShowAudioQR] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);

  // ── Step 3 state (video) ──
  const [videoGsUrl, setVideoGsUrl] = useState("");
  const [showVideoQR, setShowVideoQR] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);

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
    recalculate(v, nivel);
  };

  const handleNivelChange = (e) => {
    const n = Number(e.target.value);
    setNivel(n);
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
  // Step 2 helpers (audio)
  // ────────────────────────────────────────
  const handleAudioComplete = useCallback(
    async (storageUrl) => {
      setAudioGsUrl(storageUrl);
      setShowAudioQR(false);

      try {
        const httpUrl = await getRecordingDownloadUrl(storageUrl);
        setAudioPreviewUrl(httpUrl);
        const resp = await fetch(httpUrl);
        const blob = await resp.blob();
        const file = new File([blob], "audio.webm", { type: blob.type });
        const dur = await getAudioDurationMs(file);
        setAudioDurationMs(dur);
        setTimings(generateTimings(syllables, dur));
      } catch {
        setAudioDurationMs(0);
        setTimings({ onsets_ms: [], durations_ms: [] });
      }
    },
    [syllables]
  );

  // ────────────────────────────────────────
  // Step 3 helpers (video)
  // ────────────────────────────────────────
  const handleVideoComplete = useCallback(async (storageUrl) => {
    setVideoGsUrl(storageUrl);
    setShowVideoQR(false);
    try {
      const httpUrl = await getRecordingDownloadUrl(storageUrl);
      setVideoPreviewUrl(httpUrl);
    } catch {
      // preview not critical
    }
  }, []);

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
          video_url: videoGsUrl,
          creado_por: therapistId,
        },
        imagenFile
      );
      navigate("/ejercicios");
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
    if (step === 0) return texto.trim().length > 0 && validation?.valid;
    if (step === 1) return !!audioGsUrl;
    if (step === 2) return !!videoGsUrl;
    return true;
  };

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

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
    </>
  );

  // ── Step 2 ──
  const renderStep2 = () => (
    <>
      <h3>2. Grabación de audio</h3>
      <p style={{ color: "#666", fontSize: "0.92rem" }}>
        Escanea el código QR con tu celular para grabar el audio del estímulo.
        El audio se usa para generar los tiempos de cada sílaba.
      </p>

      {audioGsUrl && !showAudioQR ? (
        <div>
          <div className="tem-validation-panel valid">
            <strong>✅ Audio grabado correctamente</strong>
            {audioDurationMs > 0 && (
              <p style={{ margin: "0.3rem 0 0" }}>
                Duración: {(audioDurationMs / 1000).toFixed(1)}s — Timings
                generados para {syllables.length} sílabas
              </p>
            )}
          </div>
          <button
            className="tem-skip-btn"
            onClick={() => {
              setAudioGsUrl("");
              setAudioDurationMs(0);
              setTimings({ onsets_ms: [], durations_ms: [] });
              setShowAudioQR(true);
            }}
          >
            Volver a grabar
          </button>
        </div>
      ) : (
        <div className="tem-qr-section">
          {!showAudioQR && (
            <button
              className="tem-btn tem-btn-next"
              onClick={() => setShowAudioQR(true)}
            >
              Iniciar grabación de audio
            </button>
          )}
          {showAudioQR && therapistId && (
            <QRRecordPrompt
              type="audio"
              therapistId={therapistId}
              stimulusText={texto}
              onComplete={handleAudioComplete}
              onCancel={() => setShowAudioQR(false)}
            />
          )}
        </div>
      )}
    </>
  );

  // ── Step 3 ──
  const renderStep3 = () => (
    <>
      <h3>3. Grabación de video (labios)</h3>
      <p style={{ color: "#666", fontSize: "0.92rem" }}>
        Escanea el código QR para grabar un video de los labios pronunciando el
        estímulo. El video se guardará <strong>sin sonido</strong> y se sincronizará
        con el audio ya grabado.
      </p>

      {audioPreviewUrl && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#fffaf5", borderRadius: "0.6rem", border: "1px solid rgba(218,147,113,0.3)" }}>
          <p style={{ fontWeight: 600, fontSize: "0.88rem", color: "#c17d5e", margin: "0 0 0.4rem" }}>
            🎤 Audio de referencia — escucha para sincronizar el video:
          </p>
          <audio src={audioPreviewUrl} controls style={{ width: "100%" }} />
        </div>
      )}

      {videoGsUrl && !showVideoQR ? (
        <div>
          <div className="tem-validation-panel valid">
            <strong>✅ Video grabado correctamente</strong>
          </div>
          {videoPreviewUrl && (
            <video
              src={videoPreviewUrl}
              controls
              playsInline
              muted
              style={{ marginTop: "0.6rem", maxWidth: "100%", borderRadius: "0.5rem" }}
            />
          )}
          <button
            className="tem-skip-btn"
            onClick={() => {
              setVideoGsUrl("");
              setVideoPreviewUrl(null);
              setShowVideoQR(true);
            }}
          >
            Volver a grabar
          </button>
        </div>
      ) : (
        <div className="tem-qr-section">
          {!showVideoQR && (
            <button
              className="tem-btn tem-btn-next"
              onClick={() => setShowVideoQR(true)}
            >
              Iniciar grabación de video
            </button>
          )}
          {showVideoQR && therapistId && (
            <QRRecordPrompt
              type="video"
              therapistId={therapistId}
              stimulusText={texto}
              onComplete={handleVideoComplete}
              onCancel={() => setShowVideoQR(false)}
            />
          )}
        </div>
      )}
    </>
  );

  // ── Step 4 ──
  const renderStep4 = () => (
    <>
      <h3>4. Imagen, pregunta y contexto</h3>

      <div className="tem-field">
        <label>Imagen del estímulo</label>
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
            className="tem-image-upload-area"
            onClick={() => fileInputRef.current?.click()}
          >
            📁 Haz clic para seleccionar una imagen
          </div>
        )}
      </div>

      <div className="tem-field">
        <label>Pregunta (paso 5 de la terapia)</label>
        <textarea
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Ej: ¿Qué está haciendo el gato?"
          rows={2}
        />
      </div>

      <div className="tem-field">
        <label>Contexto / Categoría</label>
        <select
          value={categoria}
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
          <option value="">Sin contexto</option>
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

  const handleRerecordAudio = () => {
    setAudioGsUrl("");
    setAudioDurationMs(0);
    setTimings({ onsets_ms: [], durations_ms: [] });
    setAudioPreviewUrl(null);
    setShowAudioQR(false);
    setStep(1);
  };

  const handleRerecordVideo = () => {
    setVideoGsUrl("");
    setVideoPreviewUrl(null);
    setShowVideoQR(false);
    setStep(2);
  };

  // ── Step 5 ──
  const renderStep5 = () => (
    <>
      <h3>5. Resumen del estímulo</h3>

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
            <strong style={{ fontSize: "0.92rem" }}>🎤 Audio de referencia{audioDurationMs > 0 ? ` (${(audioDurationMs / 1000).toFixed(1)}s)` : ""}</strong>
            <button className="tem-skip-btn" style={{ marginTop: 0 }} onClick={handleRerecordAudio}>Volver a grabar audio</button>
          </div>
          {audioPreviewUrl
            ? <audio src={audioPreviewUrl} controls style={{ width: "100%" }} />
            : <span style={{ color: "#d9534f", fontSize: "0.88rem" }}>❌ Sin audio grabado</span>
          }
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
            <strong style={{ fontSize: "0.92rem" }}>📹 Video de labios (sin sonido)</strong>
            <button className="tem-skip-btn" style={{ marginTop: 0 }} onClick={handleRerecordVideo}>Volver a grabar video</button>
          </div>
          {videoPreviewUrl
            ? <video src={videoPreviewUrl} controls playsInline muted style={{ maxWidth: "100%", borderRadius: "0.5rem" }} />
            : <span style={{ color: "#d9534f", fontSize: "0.88rem" }}>❌ Sin video grabado</span>
          }
        </div>

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
    renderStep5,
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
