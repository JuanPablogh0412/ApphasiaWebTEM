// MobileRecorder.jsx — Página pública de grabación desde móvil (ruta /grabar/:token)
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { signInAnonymously } from "firebase/auth";
import { auth } from "../../services/firebase";
import {
  getRecordingSession,
  uploadAndCompleteRecording,
  uploadAndCompleteDualRecording,
} from "../../services/recordingService";
import "./MobileRecorder.css";

export default function MobileRecorder() {
  const { token } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState(null);          // audio blob (audio-only o combined según tipo)
  const [videoBlob, setVideoBlob] = useState(null); // video-only blob (solo para video_audio)
  const [previewUrl, setPreviewUrl] = useState(null);   // video preview URL
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null); // audio preview URL (solo dual)
  const [timer, setTimer] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  // Camera preview state
  const [cameraReady, setCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState("user");

  const mediaRecorderRef = useRef(null);
  const audioRecorderRef = useRef(null);  // audio-only recorder para video_audio
  const chunksRef = useRef([]);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const liveVideoRef = useRef(null);

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
  const isDual = session?.type === "video_audio";    // nuevo: graba video+audio simultáneo
  const needsCamera = isVideo || isDual;

  // Abrir cámara para preview sin grabar todavía
  const openCamera = useCallback(async (facing = facingMode) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: isDual,  // dual necesita micrófono desde el inicio
        video: { facingMode: facing, width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }
      setCameraReady(true);
    } catch (e) {
      setError("No se pudo acceder a la cámara/micrófono. Verifica los permisos del navegador.");
    }
  }, [facingMode, isDual]);

  // Cambiar entre cámara frontal y trasera
  const toggleCamera = useCallback(() => {
    const newFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacing);
    openCamera(newFacing);
  }, [facingMode, openCamera]);

  const startRecording = useCallback(async () => {
    try {
      chunksRef.current = [];
      audioChunksRef.current = [];
      setBlob(null);
      setVideoBlob(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);

      let stream;

      if (isDual) {
        // Para video_audio: usar el stream del preview que ya tiene audio + video
        if (!streamRef.current) await openCamera();
        stream = streamRef.current;

        // Recorder 1: video-only (sin audio) para video_url
        const videoOnlyStream = new MediaStream(stream.getVideoTracks());
        const videoMime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8" : "video/webm";
        const videoRec = new MediaRecorder(videoOnlyStream, { mimeType: videoMime });
        mediaRecorderRef.current = videoRec;

        videoRec.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        // Recorder 2: audio-only para audio_url
        const audioOnlyStream = new MediaStream(stream.getAudioTracks());
        const audioMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus" : "audio/webm";
        const audioRec = new MediaRecorder(audioOnlyStream, { mimeType: audioMime });
        audioRecorderRef.current = audioRec;

        audioRec.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        let stoppedCount = 0;
        const onBothStopped = () => {
          stoppedCount++;
          if (stoppedCount < 2) return;
          const videoBlobResult = new Blob(chunksRef.current, { type: "video/webm" });
          const audioBlobResult = new Blob(audioChunksRef.current, { type: "audio/webm" });
          setVideoBlob(videoBlobResult);
          setBlob(audioBlobResult);
          setPreviewUrl(URL.createObjectURL(videoBlobResult));
          setAudioPreviewUrl(URL.createObjectURL(audioBlobResult));
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          setCameraReady(false);
          if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
        };

        videoRec.onstop = onBothStopped;
        audioRec.onstop = onBothStopped;

        videoRec.start(200);
        audioRec.start(200);

      } else if (isVideo) {
        // Video-only (sin audio) — flujo original
        if (!streamRef.current) await openCamera();
        stream = streamRef.current;

        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8" : "video/webm";
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const recorded = new Blob(chunksRef.current, { type: "video/webm" });
          setBlob(recorded);
          setPreviewUrl(URL.createObjectURL(recorded));
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          setCameraReady(false);
          if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
        };
        recorder.start(200);

      } else {
        // Audio-only
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus" : "audio/webm";
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const recorded = new Blob(chunksRef.current, { type: "audio/webm" });
          setBlob(recorded);
          setPreviewUrl(URL.createObjectURL(recorded));
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        };
        recorder.start(200);
      }

      setRecording(true);
      setTimer(0);
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    } catch (e) {
      setError(
        "No se pudo acceder al micrófono/cámara. Verifica los permisos del navegador."
      );
    }
  }, [isVideo, isDual, previewUrl, openCamera]);

  const stopRecording = useCallback(() => {
    if (recording) {
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      if (audioRecorderRef.current) audioRecorderRef.current.stop();
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
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      if (isDual && videoBlob) {
        // Subir ambos archivos: audio separado + video sin audio
        await uploadAndCompleteDualRecording(token, blob, videoBlob, "webm");
      } else {
        await uploadAndCompleteRecording(token, blob, "webm");
      }
      setDone(true);
    } catch (e) {
      setError("Error al subir la grabación. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  }, [blob, videoBlob, token, isDual]);

  const handleRerecord = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setBlob(null);
    setVideoBlob(null);
    setPreviewUrl(null);
    setAudioPreviewUrl(null);
    setTimer(0);
    if (needsCamera) openCamera();
  }, [previewUrl, audioPreviewUrl, needsCamera, openCamera]);

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
      <h2>{needsCamera ? "📹 Grabar video" : "🎤 Grabar audio"}</h2>

      <div className="recorder-info">
        {isDual
          ? "Graba un video de tus labios entonando el estímulo. El audio se captura simultáneamente."
          : isVideo
            ? "Graba un video de tus labios entonando el estímulo."
            : "Graba el audio entonando el estímulo."}
        {session.metadata?.stimulusText && (
          <span className="stimulus-text">
            «{session.metadata.stimulusText}»
          </span>
        )}
      </div>

      {/* Vista previa de cámara en vivo (video o video_audio) */}
      {needsCamera && !previewUrl && (
        <div className="live-preview-section">
          <video
            ref={liveVideoRef}
            autoPlay
            playsInline
            muted
            className={`live-preview ${cameraReady ? "active" : ""} ${facingMode === "user" ? "mirror" : ""}`}
          />
          {!cameraReady && (
            <button className="btn-open-camera" onClick={() => openCamera()}>
              📷 Activar cámara
            </button>
          )}
          {cameraReady && !recording && (
            <button className="btn-switch-camera" onClick={toggleCamera}>
              🔄 {facingMode === "user" ? "Trasera" : "Frontal"}
            </button>
          )}
        </div>
      )}

      {/* Timer */}
      {(recording || timer > 0) && (
        <div className="record-timer">{formatTime(timer)}</div>
      )}

      {/* Record button */}
      {!previewUrl && (!needsCamera || cameraReady) && (
        <button
          className={`record-btn ${recording ? "recording" : ""}`}
          onClick={recording ? stopRecording : startRecording}
          aria-label={recording ? "Detener grabación" : "Iniciar grabación"}
        >
          <div className="inner-circle" />
        </button>
      )}

      {!previewUrl && (!needsCamera || cameraReady) && (
        <p style={{ color: "#666", fontSize: "0.85rem" }}>
          {recording ? "Toca para detener" : "Toca para grabar"}
        </p>
      )}

      {/* Preview */}
      {previewUrl && (
        <div className="preview-section">
          {needsCamera ? (
            <video src={previewUrl} controls playsInline muted />
          ) : (
            <audio src={previewUrl} controls />
          )}
          {/* En modo dual: mostrar también el audio para verificar */}
          {isDual && audioPreviewUrl && (
            <div style={{ marginTop: "0.75rem" }}>
              <p style={{ fontSize: "0.85rem", color: "#555", margin: "0 0 0.3rem" }}>
                🎤 Verifica que el audio suena bien:
              </p>
              <audio src={audioPreviewUrl} controls style={{ width: "100%" }} />
            </div>
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
