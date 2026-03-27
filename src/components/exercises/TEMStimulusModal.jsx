import React, { useEffect, useState } from "react";
import { getTEMStorageUrl } from "../../services/temService";
import "./TEMStimulusModal.css";

const TEMStimulusModal = ({ stimulus, onClose }) => {
  const [audioUrl, setAudioUrl] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);

  useEffect(() => {
    const resolveUrls = async () => {
      if (stimulus?.audio_url) {
        try {
          setAudioUrl(await getTEMStorageUrl(stimulus.audio_url));
        } catch {
          setAudioUrl(null);
        }
      }
      if (stimulus?.imagen_url) {
        try {
          setImageUrl(await getTEMStorageUrl(stimulus.imagen_url));
        } catch {
          setImageUrl(null);
        }
      }
      if (stimulus?.video_url) {
        try {
          setVideoUrl(await getTEMStorageUrl(stimulus.video_url));
        } catch {
          setVideoUrl(null);
        }
      }
    };
    resolveUrls();
  }, [stimulus?.audio_url, stimulus?.imagen_url, stimulus?.video_url]);

  if (!stimulus) return null;

  const syllables = stimulus.syllables || [];

  // Formatear duración del audio
  const formatDuration = (ms) => {
    if (!ms) return "—";
    const secs = (ms / 1000).toFixed(1);
    return `${secs}s`;
  };

  return (
    <div className="tem-modal-backdrop" onClick={onClose}>
      <div className="tem-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="tem-modal-header">
          <h4>Estímulo TEM: <span>{stimulus.id}</span></h4>
          <button className="close-btn" onClick={onClose}>×</button>
        </header>

        {/* Info básica */}
        <section className="tem-modal-info">
          <p><strong>Frase:</strong> {stimulus.texto || "—"}</p>
          <p><strong>Pregunta asociada:</strong> {stimulus.pregunta || "—"}</p>
          <p>
            <strong>Número de sílabas:</strong>{" "}
            {stimulus.num_silabas ?? "—"}
          </p>
          <p>
            <strong>Nivel clínico:</strong>{" "}
            <span className={`badge ${stimulus.nivel_clinico === 1 ? "bg-success" : stimulus.nivel_clinico === 2 ? "bg-warning" : stimulus.nivel_clinico === 3 ? "bg-danger" : "bg-secondary"}`}>
              Nivel {stimulus.nivel_clinico ?? "—"}
            </span>
          </p>
        </section>

        {/* Audio */}
        {audioUrl && (
          <section className="tem-modal-audio">
            <p><strong>Audio de referencia:</strong>
              {stimulus.audio_duration_ms && (
                <span className="text-muted" style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}>
                  ({formatDuration(stimulus.audio_duration_ms)})
                </span>
              )}
            </p>
            <audio controls preload="none">
              <source src={audioUrl} type="audio/mpeg" />
              Tu navegador no soporta el elemento audio.
            </audio>
          </section>
        )}

        {/* Sílabas desglosadas */}
        {syllables.length > 0 && (
          <section className="tem-syllables">
            <h5>Desglose de sílabas</h5>
            <div className="syllable-list">
              {syllables.map((syl, idx) => (
                <span key={idx} className="syllable-chip">
                  {typeof syl === "string" ? syl : syl.text || syl.syllable || JSON.stringify(syl)}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Metadata adicional */}
        <section className="tem-meta-grid">
          {stimulus.patron_tonal && (
            <p><strong>Patrón tonal:</strong> {stimulus.patron_tonal}</p>
          )}
          {stimulus.categoria && (
            <p><strong>Categoría:</strong> {stimulus.categoria}</p>
          )}
        </section>

        {/* Video de labios */}
        {videoUrl && (
          <section className="tem-modal-audio">
            <p><strong>Video de labios (modelo articulatorio):</strong></p>
            <video
              controls
              preload="none"
              style={{ maxWidth: "100%", borderRadius: "0.5rem" }}
            >
              <source src={videoUrl} type="video/webm" />
              Tu navegador no soporta el elemento video.
            </video>
          </section>
        )}

        {/* Imagen asociada */}
        {imageUrl && (
          <section className="tem-modal-image">
            <p><strong>Imagen asociada:</strong></p>
            <img src={imageUrl} alt={stimulus.texto} style={{ maxWidth: "100%", borderRadius: "0.5rem" }} />
          </section>
        )}
      </div>
    </div>
  );
};

export default TEMStimulusModal;
