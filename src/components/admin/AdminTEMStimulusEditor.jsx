import React, { useState, useEffect } from "react";
import { updateTEMStimulus } from "../../services/temService";
import "./AdminTEMStimulusEditor.css";

const NIVELES = ["1", "2", "3"];
const CATEGORIAS = [
  "animales", "alimentos", "objetos", "personas", "acciones",
  "lugares", "colores", "números", "ropa", "transporte",
];

export default function AdminTEMStimulusEditor({ stimulus, onClose, onSaved }) {
  const [form, setForm] = useState({
    texto: "",
    nivel_clinico: "1",
    patron_tonal: "",
    categoria: "",
    pregunta: "",
    num_silabas: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!stimulus) return;
    setForm({
      texto: stimulus.texto || "",
      nivel_clinico: String(stimulus.nivel_clinico || "1"),
      patron_tonal: stimulus.patron_tonal || "",
      categoria: stimulus.categoria || "",
      pregunta: stimulus.pregunta || "",
      num_silabas: stimulus.num_silabas ?? "",
    });
    setError("");
  }, [stimulus]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.texto.trim()) {
      setError("El texto del estímulo es obligatorio.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateTEMStimulus(stimulus.id, {
        texto: form.texto.trim(),
        nivel_clinico: Number(form.nivel_clinico),
        patron_tonal: form.patron_tonal.trim(),
        categoria: form.categoria,
        pregunta: form.pregunta.trim(),
        num_silabas: Number(form.num_silabas) || 0,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError("Error al guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (!stimulus) return null;

  return (
    <div className="tem-editor-overlay" onClick={onClose}>
      <div className="tem-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tem-editor-header">
          <h2>Editar estímulo TEM</h2>
          <button className="tem-editor-close" onClick={onClose}>✕</button>
        </div>

        <div className="tem-editor-body">
          <div className="tem-editor-field">
            <label>Texto del estímulo *</label>
            <input
              type="text"
              value={form.texto}
              onChange={(e) => handleChange("texto", e.target.value)}
              placeholder="Ej: mariposa"
            />
          </div>

          <div className="tem-editor-row">
            <div className="tem-editor-field">
              <label>Nivel clínico</label>
              <select
                value={form.nivel_clinico}
                onChange={(e) => handleChange("nivel_clinico", e.target.value)}
              >
                {NIVELES.map((n) => (
                  <option key={n} value={n}>Nivel {n}</option>
                ))}
              </select>
            </div>

            <div className="tem-editor-field">
              <label>Nº de sílabas</label>
              <input
                type="number"
                min="1"
                max="10"
                value={form.num_silabas}
                onChange={(e) => handleChange("num_silabas", e.target.value)}
              />
            </div>
          </div>

          <div className="tem-editor-row">
            <div className="tem-editor-field">
              <label>Patrón tonal</label>
              <input
                type="text"
                value={form.patron_tonal}
                onChange={(e) => handleChange("patron_tonal", e.target.value)}
                placeholder="Ej: IUM-IUM-IUM"
              />
            </div>

            <div className="tem-editor-field">
              <label>Categoría</label>
              <select
                value={form.categoria}
                onChange={(e) => handleChange("categoria", e.target.value)}
              >
                <option value="">— Sin categoría —</option>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="tem-editor-field">
            <label>Pregunta de prueba</label>
            <input
              type="text"
              value={form.pregunta}
              onChange={(e) => handleChange("pregunta", e.target.value)}
              placeholder="Ej: ¿Cómo se llama este animal?"
            />
          </div>

          <p className="tem-editor-note">
            Los archivos multimedia (audio, video, imagen) no son editables desde aquí.
          </p>

          {error && <p className="tem-editor-error">{error}</p>}
        </div>

        <div className="tem-editor-footer">
          <button className="btn-editor-cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn-editor-save" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
