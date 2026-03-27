import React, { useState, useMemo, useEffect } from "react";
import { getTEMStorageUrl } from "../../services/temService";
import "./TEMTable.css";

const TEMTable = ({ stimuli, onView }) => {
  const [filterSentence, setFilterSentence] = useState("");
  const [filterSyllables, setFilterSyllables] = useState("Todos");
  const [filterNivel, setFilterNivel] = useState("Todos");
  const [filterCategoria, setFilterCategoria] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [audioUrls, setAudioUrls] = useState({});
  const pageSize = 10;

  const clearFilters = () => {
    setFilterSentence("");
    setFilterSyllables("Todos");
    setFilterNivel("Todos");
    setFilterCategoria("Todos");
    setCurrentPage(1);
  };

  // Resolver URLs de audio gs:// → https://
  useEffect(() => {
    const resolveUrls = async () => {
      const urls = {};
      for (const s of stimuli) {
        if (s.audio_url && !audioUrls[s.id]) {
          try {
            urls[s.id] = await getTEMStorageUrl(s.audio_url);
          } catch {
            urls[s.id] = null;
          }
        }
      }
      if (Object.keys(urls).length > 0) {
        setAudioUrls((prev) => ({ ...prev, ...urls }));
      }
    };
    if (stimuli.length > 0) resolveUrls();
  }, [stimuli]);

  const filteredStimuli = useMemo(() => {
    return stimuli.filter((s) => {
      if (
        filterSentence &&
        !s.texto?.toLowerCase().includes(filterSentence.toLowerCase())
      )
        return false;
      if (filterSyllables !== "Todos") {
        const count = s.num_silabas;
        if (count !== undefined && String(count) !== filterSyllables)
          return false;
      }
      if (filterNivel !== "Todos") {
        if (String(s.nivel_clinico) !== filterNivel) return false;
      }
      if (filterCategoria !== "Todos") {
        if ((s.categoria || "") !== filterCategoria) return false;
      }
      return true;
    });
  }, [stimuli, filterSentence, filterSyllables, filterNivel, filterCategoria]);

  const totalPages = Math.ceil(filteredStimuli.length / pageSize);
  const paginatedStimuli = filteredStimuli.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filterSentence, filterSyllables, filterNivel, filterCategoria]);

  // Obtener valores únicos de num_silabas para el filtro
  const syllableCounts = useMemo(() => {
    const counts = new Set(
      stimuli
        .map((s) => s.num_silabas)
        .filter((c) => c !== undefined)
    );
    return [...counts].sort((a, b) => a - b);
  }, [stimuli]);

  // Obtener categorías únicas para el filtro
  const categorias = useMemo(() => {
    const cats = new Set(
      stimuli.map((s) => s.categoria).filter(Boolean)
    );
    return [...cats].sort();
  }, [stimuli]);

  return (
    <div className="tem-page">
      <div className="tem-table-container">
        {/* --- FILTROS --- */}
        <div className="filters-box flex-wrap align-items-center">
          <div className="filter-group">
            <label>Frase:</label>
            <input
              type="text"
              placeholder="Buscar frase"
              value={filterSentence}
              onChange={(e) => setFilterSentence(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Sílabas:</label>
            <select
              value={filterSyllables}
              onChange={(e) => setFilterSyllables(e.target.value)}
            >
              <option>Todos</option>
              {syllableCounts.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Nivel:</label>
            <select
              value={filterNivel}
              onChange={(e) => setFilterNivel(e.target.value)}
            >
              <option value="Todos">Todos</option>
              <option value="1">Nivel 1</option>
              <option value="2">Nivel 2</option>
              <option value="3">Nivel 3</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Categoría:</label>
            <select
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
            >
              <option value="Todos">Todas</option>
              {categorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-outline-danger mt-2 mt-md-0"
            onClick={clearFilters}
            style={{ whiteSpace: "nowrap", minWidth: "110px" }}
          >
            Limpiar ✖
          </button>
        </div>

        {/* --- TABLA --- */}
        <div className="table-responsive">
          <table className="table align-middle mb-0 table-striped table-hover">
            <thead className="table-dark">
              <tr>
                <th>ID</th>
                <th>Frase</th>
                <th>Sílabas</th>
                <th>Nivel</th>
                <th>Patrón tonal</th>
                <th>Audio</th>
                <th className="text-end">Acción</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStimuli.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted">
                    No hay estímulos TEM con esos filtros.
                  </td>
                </tr>
              ) : (
                paginatedStimuli.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.texto || "—"}</td>
                    <td>{s.num_silabas ?? "—"}</td>
                    <td>
                      <span className={`badge ${s.nivel_clinico === 1 ? "bg-success" : s.nivel_clinico === 2 ? "bg-warning" : s.nivel_clinico === 3 ? "bg-danger" : "bg-secondary"}`}>
                        Nivel {s.nivel_clinico ?? "—"}
                      </span>
                    </td>
                    <td>{s.patron_tonal || "—"}</td>
                    <td className="audio-inline">
                      {audioUrls[s.id] ? (
                        <audio controls preload="none">
                          <source src={audioUrls[s.id]} type="audio/mpeg" />
                        </audio>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-end">
                      <button
                        className="btn-outline-secondary"
                        onClick={() => onView(s)}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* --- PAGINACIÓN --- */}
        {totalPages > 1 && (
          <div className="pagination-wrapper">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (page) => (
                <button
                  key={page}
                  className={page === currentPage ? "active" : ""}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              )
            )}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TEMTable;
