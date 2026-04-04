// QRRecordPrompt.jsx — Widget que genera QR, espera grabación del móvil y notifica al padre.
import React, { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  createRecordingSession,
  subscribeRecordingSession,
  getRecordingDownloadUrl,
} from "../../services/recordingService";
import "./QRRecordPrompt.css";

/**
 * Props:
 * - type: "audio" | "video" | "video_audio"
 * - therapistId: string
 * - stimulusText: string (para mostrar en la página del móvil)
 * - onComplete: (storageUrl: string) => void                         — para audio/video
 *               ({ audioStorageUrl, videoStorageUrl }: object) => void — para video_audio
 * - onCancel: () => void  (opcional)
 */
export default function QRRecordPrompt({
  type,
  therapistId,
  stimulusText,
  onComplete,
  onCancel,
}) {
  const isDual = type === "video_audio";

  const [token, setToken] = useState(null);
  const [status, setStatus] = useState("creating"); // creating | waiting | completed
  const [previewUrl, setPreviewUrl] = useState(null);
  const [storageUrl, setStorageUrl] = useState(null);
  // Para video_audio: URLs separadas
  const [audioStorageUrl, setAudioStorageUrl] = useState(null);
  const [videoStorageUrl, setVideoStorageUrl] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const unsubRef = useRef(null);

  const qrUrl = token
    ? `${window.location.origin}/grabar/${token}`
    : null;

  // Create recording session on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const t = await createRecordingSession(type, therapistId, {
        stimulusText,
      });
      if (cancelled) return;
      setToken(t);
      setStatus("waiting");
    })();

    return () => {
      cancelled = true;
    };
  }, [type, therapistId, stimulusText]);

  // Subscribe to session status
  useEffect(() => {
    if (!token) return;

    const unsub = subscribeRecordingSession(token, async (doc) => {
      if (doc.status === "completed") {
        if (isDual && doc.audioStorageUrl && doc.videoStorageUrl) {
          setAudioStorageUrl(doc.audioStorageUrl);
          setVideoStorageUrl(doc.videoStorageUrl);
          setStorageUrl(doc.videoStorageUrl);
          setStatus("completed");
          try {
            const vUrl = await getRecordingDownloadUrl(doc.videoStorageUrl);
            setVideoPreviewUrl(vUrl);
            setPreviewUrl(vUrl);
          } catch { /* preview not critical */ }
        } else if (doc.storageUrl) {
          setStorageUrl(doc.storageUrl);
          setStatus("completed");
          try {
            const url = await getRecordingDownloadUrl(doc.storageUrl);
            setPreviewUrl(url);
          } catch { /* preview not critical */ }
        }
      }
    });

    unsubRef.current = unsub;
    return () => unsub();
  }, [token]);

  // When confirmed, notify parent
  const handleAccept = useCallback(() => {
    if (!onComplete) return;
    if (isDual && audioStorageUrl && videoStorageUrl) {
      onComplete({ audioStorageUrl, videoStorageUrl });
    } else if (storageUrl) {
      onComplete(storageUrl);
    }
  }, [isDual, audioStorageUrl, videoStorageUrl, storageUrl, onComplete]);

  // Re-record: create a new session
  const handleRerecord = useCallback(async () => {
    // Cleanup old subscription
    if (unsubRef.current) unsubRef.current();
    setPreviewUrl(null);
    setStorageUrl(null);
    setAudioStorageUrl(null);
    setVideoStorageUrl(null);
    setVideoPreviewUrl(null);
    setStatus("creating");
    setToken(null);

    const t = await createRecordingSession(type, therapistId, {
      stimulusText,
    });
    setToken(t);
    setStatus("waiting");
  }, [type, therapistId, stimulusText]);

  // ── Render ──

  if (status === "creating") {
    return (
      <div className="qr-prompt">
        <p>Generando código QR…</p>
      </div>
    );
  }

  if (status === "completed" && previewUrl) {
    return (
      <div className="qr-prompt">
        <h4>
          {isDual
            ? "📹🎤 Video y audio grabados"
            : type === "video"
            ? "📹 Video grabado"
            : "🎤 Audio grabado"}
        </h4>

        <div className="qr-completed-preview">
          {isDual || type === "video" ? (
            <video src={videoPreviewUrl || previewUrl} controls playsInline />
          ) : (
            <audio src={previewUrl} controls />
          )}
        </div>

        <div className="qr-completed-actions">
          <button className="btn-rerecord-qr" onClick={handleRerecord}>
            Volver a grabar
          </button>
          <button
            className="btn-confirm"
            style={{
              padding: "0.5rem 1.2rem",
              borderRadius: 6,
              border: "none",
              background: "#28a745",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={handleAccept}
          >
            Aceptar
          </button>
        </div>
      </div>
    );
  }

  // Waiting state: show QR
  return (
    <div className="qr-prompt">
      <h4>
        {isDual
          ? "📹🎤 Grabar video y audio del estímulo"
          : type === "video"
          ? "📹 Grabar video de labios"
          : "🎤 Grabar audio del estímulo"}
      </h4>

      <p className="qr-instructions">
        Escanea este código QR con tu celular para abrir el grabador.
        {stimulusText && (
          <>
            {" "}
            El estímulo a entonar es: <strong>«{stimulusText}»</strong>
          </>
        )}
      </p>

      {qrUrl && (
        <div className="qr-code-wrapper">
          <QRCodeSVG value={qrUrl} size={200} level="M" />
        </div>
      )}

      <div className="qr-status waiting">
        Esperando grabación desde el móvil
        <span className="dot-pulse">
          <span />
          <span />
          <span />
        </span>
      </div>

      {onCancel && (
        <button className="btn-cancel-qr" onClick={onCancel}>
          Cancelar
        </button>
      )}
    </div>
  );
}
