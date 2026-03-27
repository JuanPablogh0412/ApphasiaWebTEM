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
 * - type: "audio" | "video"
 * - therapistId: string
 * - stimulusText: string (para mostrar en la página del móvil)
 * - onComplete: (storageUrl: string) => void
 * - onCancel: () => void  (opcional)
 */
export default function QRRecordPrompt({
  type,
  therapistId,
  stimulusText,
  onComplete,
  onCancel,
}) {
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState("creating"); // creating | waiting | completed
  const [previewUrl, setPreviewUrl] = useState(null);
  const [storageUrl, setStorageUrl] = useState(null);
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
      if (doc.status === "completed" && doc.storageUrl) {
        setStorageUrl(doc.storageUrl);
        setStatus("completed");
        // Resolve download URL for preview
        try {
          const url = await getRecordingDownloadUrl(doc.storageUrl);
          setPreviewUrl(url);
        } catch {
          // Preview not critical
        }
      }
    });

    unsubRef.current = unsub;
    return () => unsub();
  }, [token]);

  // When confirmed, notify parent
  const handleAccept = useCallback(() => {
    if (storageUrl && onComplete) {
      onComplete(storageUrl);
    }
  }, [storageUrl, onComplete]);

  // Re-record: create a new session
  const handleRerecord = useCallback(async () => {
    // Cleanup old subscription
    if (unsubRef.current) unsubRef.current();
    setPreviewUrl(null);
    setStorageUrl(null);
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
          {type === "video" ? "📹 Video grabado" : "🎤 Audio grabado"}
        </h4>

        <div className="qr-completed-preview">
          {type === "video" ? (
            <video src={previewUrl} controls playsInline />
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
        {type === "video"
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
