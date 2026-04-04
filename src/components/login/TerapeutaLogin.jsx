import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUnified, resetTherapistPassword } from "../../services/therapistService";
import { useAuth } from "../../context/AuthContext";
import Footer from "../common/Footer";
import "./TerapeutaLogin.css";

const TerapeutaLogin = () => {
  const navigate = useNavigate();
  const { refreshClaims } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await loginUnified(email, password);

      // Refrescar claims en el AuthContext
      await refreshClaims();

      if (result.tipo === "admin") return navigate("/admin/dashboard");

      if (result.tipo === "terapeuta") {
        return navigate("/dashboard");
      }

      if (result.tipo === "creador") {
        return navigate("/creador/dashboard");
      }

      setError("Tu cuenta no tiene un rol asignado. Contacta al administrador.");
    } catch (err) {
      setError("Error al iniciar sesión. Verifica tus credenciales.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetMessage("");

    const res = await resetTherapistPassword(resetEmail);

    setResetMessage(
      res.success
        ? "Te enviamos un correo para restablecer tu contraseña."
        : "No se pudo enviar el correo."
    );
  };

  return (
    <>
      <div className="login-container">
        <div className="gradient-bg" />

        {/* 👉 CARD MÁS ANCHA + DOS COLUMNAS */}
        <div className="login-card login-card-2col fade-in">

          {/* ===========================
              COLUMNA IZQUIERDA
          ============================ */}
          <div className="login-col-left">

            {/* Logo RehabilitIA */}
            <img
              src="https://raw.githubusercontent.com/Tesis-Aphasia/Web-App-RehabilitIA/refs/heads/main/src/assets/brain_logo.png"
              alt="RehabilitIA"
              className="left-logo-rehab"
            />

            <h2 className="left-title">Rehabilit<span className="logo-accent">IA</span></h2>

            <p className="left-subtitle">
              Plataforma para apoyo terapéutico inteligente en afasia.
            </p>

            {/* Logo Uniandes */}
            <div className="left-uniandes">
              <img src="https://raw.githubusercontent.com/Tesis-Aphasia/Web-App-RehabilitIA/refs/heads/main/src/assets/logo_disc.png" alt="Uniandes" />

            </div>
          </div>

          {/* ===========================
              COLUMNA DERECHA (FORM)
          ============================ */}
          <div className="login-col-right">
            <div className="text-center mb-4">
              <h1 className="fw-bold text-dark fs-3 mb-1">Iniciar sesión</h1>
              <p className="text-muted small">Bienvenido a <strong>RehabilitIA</strong></p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label className="form-label fw-semibold small">Email</label>
                <input
                  type="email"
                  className="form-control rounded-3"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small">Contraseña</label>
                <input
                  type="password"
                  className="form-control rounded-3"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <div className="d-flex justify-content-end mb-3">
                <button
                  type="button"
                  className="forgot-link small"
                  onClick={() => setShowReset(true)}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? "Iniciando..." : "Iniciar sesión"}
              </button>

              <p className="small text-muted text-center mt-3">
                ¿No tienes cuenta?{" "}
                <button
                  type="button"
                  className="forgot-link fw-semibold"
                  onClick={() => navigate("/registro")}
                >
                  Regístrate como terapeuta
                </button>
              </p>
              <p className="small text-muted text-center mt-1">
                ¿Quieres crear estímulos?{" "}
                <button
                  type="button"
                  className="forgot-link fw-semibold"
                  onClick={() => navigate("/registro-creador")}
                >
                  Registro de creador
                </button>
              </p>
            </form>
          </div>
        </div>

        {/* RESET MODAL */}
        {showReset && (
          <div className="reset-overlay">
            <div className="reset-modal fade-in">
              <h3>Restablecer contraseña</h3>
              <p className="small text-muted">
                Ingresa tu correo para enviarte el enlace.
              </p>

              <form onSubmit={handlePasswordReset}>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
                <button type="submit" className="btn-login mt-2">
                  Enviar correo
                </button>
              </form>

              {resetMessage && <p className="small mt-2">{resetMessage}</p>}

              <button className="close-btn" onClick={() => setShowReset(false)}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </>
  );
};

export default TerapeutaLogin;
