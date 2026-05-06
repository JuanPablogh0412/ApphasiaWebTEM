import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, functions } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import Footer from "../common/Footer";
import logoApphasia from "../../assets/logoApphasia.png";
import "./TerapeutaLogin.css";

const CreadorRegistro = () => {
  const navigate = useNavigate();
  const { refreshClaims } = useAuth();
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    password: "",
    passwordConfirm: "",
    celular: "",
    profesion: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.passwordConfirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const registrarCreador = httpsCallable(functions, "registrarCreador");
      await registrarCreador({
        email: formData.email,
        password: formData.password,
        nombre: formData.nombre,
        celular: formData.celular,
        profesion: formData.profesion,
      });

      // Auto-login tras registro exitoso
      await signInWithEmailAndPassword(auth, formData.email, formData.password);
      await refreshClaims();
      navigate("/creador/dashboard");
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("already-exists") || msg.includes("email-already")) {
        setError("Ya existe una cuenta con este correo electrónico.");
      } else {
        setError("No se pudo completar el registro. Intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="login-container">
        <div className="gradient-bg" />

        <div className="registro-card registro-card-2col fade-in">
          {/* COLUMNA IZQUIERDA */}
          <div className="login-col-left">
            <img
              src="https://raw.githubusercontent.com/Tesis-Aphasia/Web-App-RehabilitIA/refs/heads/main/src/assets/brain_logo.png"
              alt="RehabilitIA"
              className="left-logo-rehab"
            />
            <h2 className="left-title">
              Rehabilit<span className="logo-accent">IA</span>
            </h2>
            <p className="left-subtitle">
              Plataforma para apoyo terapéutico inteligente en afasia.
            </p>
            <div className="left-uniandes">
              <img
                src={logoApphasia}
                alt="Uniandes"
              />
            </div>
          </div>

          {/* COLUMNA DERECHA (FORM) */}
          <div className="registro-col-right">
            <h1 className="fw-bold text-dark fs-3 mb-1 text-center">
              Registro de Creador
            </h1>
            <p className="text-muted small text-center mb-4">
              Crea tu cuenta para diseñar estímulos TEM en{" "}
              <strong>RehabilitIA</strong>
            </p>

            <form onSubmit={handleSubmit} className="registro-form">
              <div className="mb-3">
                <label className="form-label fw-semibold small">
                  Nombre completo
                </label>
                <input
                  type="text"
                  name="nombre"
                  className="form-control rounded-3"
                  placeholder="Tu nombre completo"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small">Email</label>
                <input
                  type="email"
                  name="email"
                  className="form-control rounded-3"
                  placeholder="correo@ejemplo.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small">
                  Contraseña
                </label>
                <input
                  type="password"
                  name="password"
                  className="form-control rounded-3"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  name="passwordConfirm"
                  className="form-control rounded-3"
                  placeholder="Repite tu contraseña"
                  value={formData.passwordConfirm}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small">Celular</label>
                <input
                  type="text"
                  name="celular"
                  className="form-control rounded-3"
                  placeholder="3212345678"
                  value={formData.celular}
                  onChange={handleChange}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small">
                  Profesión
                </label>
                <input
                  type="text"
                  name="profesion"
                  className="form-control rounded-3"
                  placeholder="Ej: Lingüista, Fonoaudiólogo"
                  value={formData.profesion}
                  onChange={handleChange}
                />
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? "Registrando..." : "Crear cuenta"}
              </button>

              <p className="small text-muted text-center mt-3">
                ¿Ya tienes una cuenta?{" "}
                <a href="/" className="forgot-link fw-semibold">
                  Inicia sesión
                </a>
              </p>
            </form>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
};

export default CreadorRegistro;
