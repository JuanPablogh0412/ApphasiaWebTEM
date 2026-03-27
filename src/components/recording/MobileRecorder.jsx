// MobileRecorder.jsx — Página pública de grabación desde móvil (ruta /grabar/:token)
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  getRecordingSession,
  uploadAndCompleteRecording,
} from "../../services/recordingService";
import "./MobileRecorder.css";

export default function MobileRecorder() {
  const { token } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [timer, setTimer] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  // Load session info
  useEffect(() => {
    (async () => {
      try {
        const data = await getRecordingSession(token);
        if (!data) {
          setError("Sesión de grabación no encontrada o expirada.");
          return;
        }
        if (data.status === "completed") {
          setDone(true);
        }
        setSession(data);
      } catch (e) {
        setError("Error al cargar la sesión.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isAudio = session?.type === "audio";
  const isVideo = session?.type === "video";

  const startRecording = useCallback(async () => {
    try {
      chunksRef.current = [];
      setBlob(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);

      const constraints = isVideo
        ? { audio: false, video: { facingMode: "user", width: 640, height: 480 } }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const mimeType = isVideo
        ? MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8"
          : "video/webm"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const type = isVideo ? "video/webm" : "audio/webm";
        const recorded = new Blob(chunksRef.current, { type });
        setBlob(recorded);
        setPreviewUrl(URL.createObjectURL(recorded));
        // Stop tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start(200); // chunks every 200ms
      setRecording(true);
      setTimer(0);
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    } catch (e) {
      setError(
        "No se pudo acceder al micrófono/cámara. Verifica los permisos del navegador."
      );
    }
  }, [isVideo, previewUrl]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [recording]);

  const handleConfirm = useCallback(async () => {
    if (!blob || !token) return;
    setUploading(true);
    try {
      await uploadAndCompleteRecording(token, blob, "webm");
      setDone(true);
    } catch (e) {
      setError("Error al subir la grabación. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  }, [blob, token]);

  const handleRerecord = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
    setTimer(0);
  }, [previewUrl]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ── Render states ──

  if (loading) {
    return (
      <div className="mobile-recorder">
        <div className="recorder-loading">
          <div className="spinner" />
          <p>Cargando sesión de grabación…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mobile-recorder">
        <div className="recorder-status error">{error}</div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mobile-recorder">
        <div className="recorder-status success">
          ✅ Grabación enviada correctamente. Puedes cerrar esta ventana.
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-recorder">
      <h2>{isVideo ? "📹 Grabar video" : "🎤 Grabar audio"}</h2>

      <div className="recorder-info">
        {isVideo
          ? "Graba un video de tus labios entonando el estímulo."
          : "Graba el audio entonando el estímulo."}
        {session.metadata?.stimulusText && (
          <span className="stimulus-text">
            «{session.metadata.stimulusText}»
          </span>
        )}
      </div>

      {/* Timer */}
      {(recording || timer > 0) && (
        <div className="record-timer">{formatTime(timer)}</div>
      )}

      {/* Record button (solo si no hay preview) */}
      {!previewUrl && (
        <button
          className={`record-btn ${recording ? "recording" : ""}`}
          onClick={recording ? stopRecording : startRecording}
          aria-label={recording ? "Detener grabación" : "Iniciar grabación"}
        >
          <div className="inner-circle" />
        </button>
      )}

      {!previewUrl && (
        <p style={{ color: "#666", fontSize: "0.85rem" }}>
          {recording ? "Toca para detener" : "Toca para grabar"}
        </p>
      )}

      {/* Preview */}
      {previewUrl && (
        <div className="preview-section">
          {isVideo ? (
            <video src={previewUrl} controls playsInline />
          ) : (
            <audio src={previewUrl} controls />
          )}
        </div>
      )}

      {/* Actions */}
      {previewUrl && !uploading && (
        <div className="recorder-actions">
          <button className="btn-rerecord" onClick={handleRerecord}>
            Volver a grabar
          </button>
          <button className="btn-confirm" onClick={handleConfirm}>
            Confirmar y enviar
          </button>
        </div>
      )}

      {uploading && (
        <div className="recorder-status uploading">Subiendo grabación…</div>
      )}
    </div>
  );
}
