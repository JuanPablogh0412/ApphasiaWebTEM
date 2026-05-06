import React, { useEffect, useState } from "react";
import { getTEMStorageUrl } from "../../services/temService";
import "./TEMStimulusModal.css";

const TEMStimulusModal = ({ stimulus, onClose }) => {
  const [audioUrl, setAudioUrl] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [audioSprechUrl, setAudioSprechUrl] = useState(null);
  const [videoSprechUrl, setVideoSprechUrl] = useState(null);
  const [audioHablaUrl, setAudioHablaUrl] = useState(null);
  const [videoHablaUrl, setVideoHablaUrl] = useState(null);

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
      if (stimulus?.audio_url_sprechgesang) {
        try {
          setAudioSprechUrl(await getTEMStorageUrl(stimulus.audio_url_sprechgesang));
        } catch {
          setAudioSprechUrl(null);
        }
      }
      if (stimulus?.video_url_sprechgesang) {
        try {
          setVideoSprechUrl(await getTEMStorageUrl(stimulus.video_url_sprechgesang));
        } catch {
          setVideoSprechUrl(null);
        }
      }
      if (stimulus?.audio_url_habla_normal) {
        try {
          setAudioHablaUrl(await getTEMStorageUrl(stimulus.audio_url_habla_normal));
        } catch {
          setAudioHablaUrl(null);
        }
      }
      if (stimulus?.video_url_habla_normal) {
        try {
          setVideoHablaUrl(await getTEMStorageUrl(stimulus.video_url_habla_normal));
        } catch {
          setVideoHablaUrl(null);
        }
      }
    };
    resolveUrls();
  }, [
    stimulus?.audio_url,
    stimulus?.imagen_url,
    stimulus?.video_url,
    stimulus?.audio_url_sprechgesang,
    stimulus?.video_url_sprechgesang,
    stimulus?.audio_url_habla_normal,
    stimulus?.video_url_habla_normal,
  ]);

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
            <p><strong>{stimulus.nivel_clinico === 3 ? "🎤 Audio — Entonado (melodía completa):" : "Audio de referencia:"}
              </strong>
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

        {/* Video de labios — Entonado (o único si N1/N2) */}
        {videoUrl && (
          <section className="tem-modal-audio">
            <p><strong>{stimulus.nivel_clinico === 3 ? "📹 Video — Entonado (melodía completa):" : "Video de labios (modelo articulatorio):"}</strong></p>
            <video controls preload="none" style={{ maxWidth: "100%", borderRadius: "0.5rem" }}>
              <source src={videoUrl} type="video/webm" />
              Tu navegador no soporta el elemento video.
            </video>
          </section>
        )}

        {/* Grabaciones extra para Nivel 3 */}
        {stimulus.nivel_clinico === 3 && (
          <>
            {audioSprechUrl && (
              <section className="tem-modal-audio">
                <p><strong>🎤 Audio — Sprechgesang (melodía suavizada):</strong></p>
                <audio controls preload="none">
                  <source src={audioSprechUrl} type="audio/mpeg" />
                  Tu navegador no soporta el elemento audio.
                </audio>
              </section>
            )}
            {videoSprechUrl && (
              <section className="tem-modal-audio">
                <p><strong>📹 Video — Sprechgesang (melodía suavizada):</strong></p>
                <video controls preload="none" style={{ maxWidth: "100%", borderRadius: "0.5rem" }}>
                  <source src={videoSprechUrl} type="video/webm" />
                  Tu navegador no soporta el elemento video.
                </video>
              </section>
            )}
            {audioHablaUrl && (
              <section className="tem-modal-audio">
                <p><strong>🎤 Audio — Habla normal (sin melodía):</strong></p>
                <audio controls preload="none">
                  <source src={audioHablaUrl} type="audio/mpeg" />
                  Tu navegador no soporta el elemento audio.
                </audio>
              </section>
            )}
            {videoHablaUrl && (
              <section className="tem-modal-audio">
                <p><strong>📹 Video — Habla normal (sin melodía):</strong></p>
                <video controls preload="none" style={{ maxWidth: "100%", borderRadius: "0.5rem" }}>
                  <source src={videoHablaUrl} type="video/webm" />
                  Tu navegador no soporta el elemento video.
                </video>
              </section>
            )}
          </>
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
