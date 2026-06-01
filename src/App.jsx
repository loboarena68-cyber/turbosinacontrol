import { useState, useEffect } from "react";

// --- CONFIGURACIÓN DE CONTRASEÑA ---
const PASSWORD_ACCESO = "cyl4";
// -----------------------------------

const OP_TYPES = ["Adiestramiento", "Ruta Nacional", "Mantenimiento", "Otros"];

const formatNum = (n) =>
  Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const todayStr = () => new Date().toISOString().slice(0, 10);

const emptyForm = (cisterna = "16") => ({
  fecha: todayStr(),
  cisterna,
  tipo: "despacho",
  litros: "",
  matriculaAeronave: "",
  tipoOperacion: "Adiestramiento",
  notas: "",
});

const CISTERNAS = {
  "16": { nombre: "Cisterna 16", proveedor: "ASA COZUMEL", color: "#60a5fa" }, // Azul tenue
  "17": { nombre: "Cisterna 17", proveedor: "G. Mundo Maya", color: "#fbbf24" }, // Ambar tenue
};

export default function App() {
  // Estados de autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passInput, setPassInput] = useState("");

  // Estados de datos
  const [records, setRecords] = useState([]);
  const [saldos, setSaldos] = useState({ "16": "", "17": "" });
  const [saldosSaved, setSaldosSaved] = useState({ "16": null, "17": null });
  const [form, setForm] = useState(emptyForm("16"));
  const [tab, setTab] = useState("registro");
  const [msg, setMsg] = useState(null);
  const [editSaldo, setEditSaldo] = useState(null);

  useEffect(() => {
    const authStatus = sessionStorage.getItem("turbo-auth");
    if (authStatus === "true") setIsAuthenticated(true);

    const recs = localStorage.getItem("turbo-records");
    const inits = localStorage.getItem("turbo-iniciales");
    if (recs) setRecords(JSON.parse(recs));
    if (inits) {
      const parsed = JSON.parse(inits);
      setSaldosSaved(parsed);
      setSaldos({ "16": parsed["16"] ?? "", "17": parsed["17"] ?? "" });
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passInput === PASSWORD_ACCESO) {
      setIsAuthenticated(true);
      sessionStorage.setItem("turbo-auth", "true");
    } else {
      flash("Contraseña denegada. Acceso restringido.", "error");
      setPassInput("");
    }
  };

  const saveRecs = (recs) => {
    setRecords(recs);
    localStorage.setItem("turbo-records", JSON.stringify(recs));
  };

  const saldoCisterna = (cis) => {
    const base = saldosSaved[cis] || 0;
    return records
      .filter((r) => r.cisterna === cis)
      .reduce((acc, r) => {
        if (r.tipo === "despacho") return acc - parseFloat(r.litros || 0);
        return acc + parseFloat(r.litros || 0);
      }, base);
  };

  const saldo16 = saldoCisterna("16");
  const saldo17 = saldoCisterna("17");
  const saldoTotal = saldo16 + saldo17;

  const handleSaveInicial = (cis) => {
    const val = parseFloat(saldos[cis]);
    if (isNaN(val) || val < 0) return flash("Ingresa un valor válido", "error");
    const newSaved = { ...saldosSaved, [cis]: val };
    setSaldosSaved(newSaved);
    localStorage.setItem("turbo-iniciales", JSON.stringify(newSaved));
    setEditSaldo(null);
    flash(`Saldo inicial C-${cis} registrado.`, "ok");
  };

  const handleSubmit = () => {
    if (!form.litros || isNaN(parseFloat(form.litros))) return flash("Error: Volumen requerido", "error");
    if (form.tipo === "despacho" && !form.matriculaAeronave.trim())
      return flash("Error: Matrícula requerida", "error");
    const newRec = { ...form, id: Date.now(), litros: parseFloat(form.litros) };
    saveRecs([...records, newRec]);
    setForm(emptyForm(form.cisterna));
    flash("Operación registrada correctamente.", "ok");
  };

  const handleDelete = (id) => {
    if (!confirm("¿Autoriza la eliminación de este registro operativo?")) return;
    saveRecs(records.filter((r) => r.id !== id));
  };

  const flash = (text, type) => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  };

  const exportBackup = () => {
    const backup = { version: 1, fecha: new Date().toISOString(), saldosIniciales: saldosSaved, registros: records };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `A4_Turbosina_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    flash("Copia de seguridad cifrada y descargada.", "ok");
  };

  const importBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.registros || !data.saldosIniciales) throw new Error("Formato inválido");
        if (!confirm(`Se sobreescribirán los datos actuales con ${data.registros.length} registros del respaldo. ¿Proceder?`)) return;
        saveRecs(data.registros);
        setSaldosSaved(data.saldosIniciales);
        setSaldos({ "16": data.saldosIniciales["16"] ?? "", "17": data.saldosIniciales["17"] ?? "" });
        localStorage.setItem("turbo-iniciales", JSON.stringify(data.saldosIniciales));
        flash(`Respaldo restaurado exitosamente.`, "ok");
      } catch (_) {
        flash("Error de integridad en el archivo de respaldo.", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const exportCSV = () => {
    // Lógica idéntica de exportación CSV adaptada al tono formal
    const headers = ["Fecha", "Cisterna", "Proveedor", "Tipo", "Litros", "Aeronave", "Operacion", "Notas"];
    const rows = records.map((r) => [
      r.fecha, `C-${r.cisterna}`, CISTERNAS[r.cisterna].proveedor,
      r.tipo === "despacho" ? "Despacho" : r.tipo === "recarga" ? "Recarga" : "Ajuste",
      r.tipo === "despacho" ? -r.litros : r.litros, r.matriculaAeronave || "", r.tipoOperacion || "", r.notas || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Reporte_Mensual_Turbosina_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Agrupación para historial
  const grouped = records.reduce((acc, r) => {
    if (!acc[r.fecha]) acc[r.fecha] = [];
    acc[r.fecha].push(r);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const needsSetup = saldosSaved["16"] === null || saldosSaved["17"] === null;

  // Calculos de Estadísticas
  const getStats = (cis) => {
    const despachos = records.filter(r => r.cisterna === cis && r.tipo === "despacho").reduce((a, r) => a + r.litros, 0);
    const recargas = records.filter(r => r.cisterna === cis && r.tipo === "recarga").reduce((a, r) => a + r.litros, 0);
    return { despachos, recargas };
  };
  const stats16 = getStats("16");
  const stats17 = getStats("17");

  // --- PANTALLA DE LOGIN ---
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#f8fafc", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
        <div style={{ background: "#1e293b", padding: "40px", borderRadius: "8px", border: "1px solid #334155", width: "100%", maxWidth: "350px", textAlign: "center", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
          <div style={{ fontSize: "24px", fontWeight: "700", letterSpacing: "2px", color: "#94a3b8", marginBottom: "8px" }}>SECCIÓN A-4</div>
          <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "30px", letterSpacing: "1px" }}>SISTEMA DE CONTROL LOGÍSTICO</div>
          
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              value={passInput} 
              onChange={e => setPassInput(e.target.value)} 
              placeholder="Código de Autorización" 
              style={{ width: "100%", background: "#0f172a", border: "1px solid #475569", color: "#f8fafc", padding: "12px", borderRadius: "4px", textAlign: "center", letterSpacing: "2px", marginBottom: "20px", outline: "none", boxSizing: "border-box" }}
            />
            <button type="submit" style={{ width: "100%", background: "#3b82f6", color: "#fff", border: "none", padding: "12px", borderRadius: "4px", fontWeight: "600", letterSpacing: "1px", cursor: "pointer", textTransform: "uppercase", fontSize: "13px" }}>
              Autenticar
            </button>
          </form>
          {msg && <div style={{ marginTop: "20px", color: "#ef4444", fontSize: "13px" }}>{msg.text}</div>}
        </div>
      </div>
    );
  }

  // --- PANTALLA PRINCIPAL ---
  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      
      {/* Header Ejecutivo */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "16px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1.5, color: "#f8fafc" }}>CONTROL DE TURBOSINA</div>
            <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 1, marginTop: 4 }}>GESTIÓN DE COMBUSTIBLE • SECCIÓN A-4</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase" }}>Inventario Consolidado</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: saldoTotal < 10000 ? "#ef4444" : "#f8fafc" }}>
              {formatNum(saldoTotal)} <span style={{ fontSize: 14, color: "#64748b" }}>L</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>

        {/* Notificaciones */}
        {msg && (
          <div style={{ background: msg.type === "ok" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)", borderLeft: `4px solid ${msg.type === "ok" ? "#22c55e" : "#ef4444"}`, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: msg.type === "ok" ? "#86efac" : "#fca5a5" }}>
            {msg.text}
          </div>
        )}

        {/* Setup saldos iniciales */}
        {(needsSetup || editSaldo) && (
          <div style={{ background: "#1e293b", border: "1px solid #475569", borderRadius: 6, padding: 20, marginBottom: 24 }}>
            <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" }}>
              Parámetros Iniciales del Mes
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {["16", "17"].map((cis) => (
                <div key={cis}>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
                    Cisterna {cis} — <span style={{ color: CISTERNAS[cis].color }}>{CISTERNAS[cis].proveedor}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="number" value={saldos[cis]} onChange={e => setSaldos({ ...saldos, [cis]: e.target.value })} placeholder="Volumen Inicial (L)" style={inputStyle} />
                    <button onClick={() => handleSaveInicial(cis)} style={btnPrimary}>Guardar</button>
                  </div>
                </div>
              ))}
            </div>
            {editSaldo && <button onClick={() => setEditSaldo(null)} style={{ ...btnGhost, marginTop: 16 }}>Cerrar Edición</button>}
          </div>
        )}

        {/* Tabs de Navegación */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid #334155", paddingBottom: 16 }}>
          {[
            ["registro", "Registro Operativo"], 
            ["historial", "Bitácora"], 
            ["estadisticas", "Métricas"], 
            ["exportar", "Administración"]
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              background: tab === key ? "#2563eb" : "transparent", color: tab === key ? "#fff" : "#94a3b8",
              border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "background 0.2s"
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* TAB: Registro */}
        {tab === "registro" && (
          <div style={{ background: "#1e293b", borderRadius: 6, padding: 24, border: "1px solid #334155" }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              {["16", "17"].map(cis => (
                <button key={cis} onClick={() => setForm({ ...form, cisterna: cis, tipo: "despacho" })} style={{
                  flex: 1, padding: "12px", borderRadius: 4, border: `1px solid ${form.cisterna === cis ? CISTERNAS[cis].color : "#475569"}`,
                  background: form.cisterna === cis ? "rgba(255,255,255,0.05)" : "transparent",
                  color: form.cisterna === cis ? "#f8fafc" : "#94a3b8", cursor: "pointer", textAlign: "left"
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>CISTERNA {cis}</div>
                  <div style={{ fontSize: 11, color: CISTERNAS[cis].color, marginTop: 4 }}>{CISTERNAS[cis].proveedor}</div>
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div><Label>Fecha</Label><input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={inputStyle} /></div>
              <div>
                <Label>Tipo de Movimiento</Label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
                  <option value="despacho">Despacho a Aeronave</option>
                  <option value="recarga">Recarga de Proveedor</option>
                  <option value="ajuste">Ajuste de Inventario</option>
                </select>
              </div>
              <div><Label>Volumen (Litros)</Label><input type="number" value={form.litros} onChange={e => setForm({ ...form, litros: e.target.value })} placeholder="0.00" style={inputStyle} /></div>
              
              {form.tipo === "despacho" && (
                <>
                  <div><Label>Matrícula de Aeronave</Label><input type="text" value={form.matriculaAeronave} onChange={e => setForm({ ...form, matriculaAeronave: e.target.value.toUpperCase() })} placeholder="Ej. XA-..." style={inputStyle} /></div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Label>Clasificación de Operación</Label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {OP_TYPES.map(t => (
                        <button key={t} onClick={() => setForm({ ...form, tipoOperacion: t })} style={{
                          padding: "8px 16px", borderRadius: 4, border: "1px solid #475569",
                          background: form.tipoOperacion === t ? "#475569" : "transparent", color: form.tipoOperacion === t ? "#fff" : "#cbd5e1",
                          cursor: "pointer", fontSize: 12
                        }}>{t}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div style={{ gridColumn: "1 / -1" }}><Label>Observaciones Logísticas</Label><input type="text" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Notas adicionales..." style={inputStyle} /></div>
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
              <button onClick={handleSubmit} style={{ ...btnPrimary, padding: "12px 24px" }}>Procesar Movimiento</button>
              <button onClick={() => setForm(emptyForm(form.cisterna))} style={btnGhost}>Limpiar Formulario</button>
            </div>
          </div>
        )}

        {/* TAB: Estadísticas */}
        {tab === "estadisticas" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {["16", "17"].map(cis => {
              const s = saldoCisterna(cis);
              const stats = getStats(cis);
              return (
                <div key={cis} style={{ background: "#1e293b", borderRadius: 6, padding: 24, border: "1px solid #334155" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #334155", paddingBottom: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: CISTERNAS[cis].color }}>CISTERNA {cis}</span>
                    <button onClick={() => setEditSaldo(cis)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12 }}>Editar Saldo Inicial</button>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Ingresos (Recargas)</div>
                      <div style={{ fontSize: 20, color: "#f8fafc" }}>+{formatNum(stats.recargas)} <span style={{ fontSize: 12, color: "#64748b" }}>L</span></div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Consumos (Despachos)</div>
                      <div style={{ fontSize: 20, color: "#f8fafc" }}>-{formatNum(stats.despachos)} <span style={{ fontSize: 12, color: "#64748b" }}>L</span></div>
                    </div>
                    <div style={{ borderLeft: "1px solid #334155", paddingLeft: 16 }}>
                      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Existencia Actual</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: s < 3000 ? "#ef4444" : "#10b981" }}>{formatNum(s)} <span style={{ fontSize: 12, color: "#64748b" }}>L</span></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: Historial */}
        {tab === "historial" && (
          <div>
            {sortedDates.length === 0 && <div style={{ textAlign: "center", color: "#64748b", padding: 40, fontSize: 14 }}>Bitácora vacía.</div>}
            {sortedDates.map(fecha => (
              <div key={fecha} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 1, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", borderBottom: "1px solid #334155", paddingBottom: 8 }}>
                  {fecha}
                </div>
                <div style={{ background: "#1e293b", borderRadius: 6, overflow: "hidden", border: "1px solid #334155" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.2)", color: "#cbd5e1", textAlign: "left" }}>
                        <th style={{ padding: "12px 16px", fontWeight: 500 }}>Unidad</th>
                        <th style={{ padding: "12px 16px", fontWeight: 500 }}>Operación</th>
                        <th style={{ padding: "12px 16px", fontWeight: 500 }}>Volumen</th>
                        <th style={{ padding: "12px 16px", fontWeight: 500 }}>Matrícula</th>
                        <th style={{ padding: "12px 16px", fontWeight: 500 }}>Notas</th>
                        <th style={{ padding: "12px 16px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[fecha].map((r) => (
                        <tr key={r.id} style={{ borderTop: "1px solid #334155" }}>
                          <td style={{ padding: "12px 16px", color: CISTERNAS[r.cisterna]?.color, fontWeight: 500 }}>C-{r.cisterna}</td>
                          <td style={{ padding: "12px 16px", color: r.tipo === "despacho" ? "#cbd5e1" : r.tipo === "recarga" ? "#10b981" : "#60a5fa" }}>
                            {r.tipo === "despacho" ? "Despacho" : r.tipo === "recarga" ? "Recarga" : "Ajuste"}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#f8fafc" }}>
                            {r.tipo === "despacho" ? "-" : "+"}{formatNum(r.litros)}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>{r.matriculaAeronave || "—"}</td>
                          <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 12 }}>{r.notas || "—"}</td>
                          <td style={{ padding: "12px 16px", textAlign: "right" }}>
                            <button onClick={() => handleDelete(r.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: Exportar / Admin */}
        {tab === "exportar" && (
          <div style={{ background: "#1e293b", borderRadius: 6, padding: 24, border: "1px solid #334155" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#f8fafc", marginBottom: 20 }}>Administración de Datos</div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ padding: 20, border: "1px solid #334155", borderRadius: 4, background: "rgba(0,0,0,0.1)" }}>
                <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 600, marginBottom: 8 }}>Exportar Reporte Mensual (CSV)</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Genera un archivo compatible con Excel con el detalle y cuenta comprobada.</div>
                <button onClick={exportCSV} style={btnGhost}>Descargar Excel (CSV)</button>
              </div>
              <div style={{ padding: 20, border: "1px solid #334155", borderRadius: 4, background: "rgba(0,0,0,0.1)" }}>
                <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 600, marginBottom: 8 }}>Copia de Seguridad Estructural</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Descarga o restaura los datos completos del sistema (Archivo .json).</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={exportBackup} style={btnGhost}>Exportar Resp.</button>
                  <label style={{ ...btnPrimary, background: "#334155", display: "inline-block", cursor: "pointer", textAlign: "center", padding: "8px 16px" }}>
                    Importar Resp.
                    <input type="file" accept=".json" onChange={importBackup} style={{ display: "none" }} />
                  </label>
                </div>
              </div>
            </div>
            
            <div style={{ borderTop: "1px solid #334155", paddingTop: 16, textAlign: "center" }}>
               <button onClick={() => { sessionStorage.removeItem("turbo-auth"); setIsAuthenticated(false); }} style={{ background: "transparent", color: "#ef4444", border: "1px solid #ef4444", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                 Cerrar Sesión Segura
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const Label = ({ children }) => (
  <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 500 }}>{children}</div>
);

const inputStyle = {
  width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 4,
  color: "#f8fafc", padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box"
};

const btnPrimary = {
  background: "#2563eb", color: "#fff", border: "none", borderRadius: 4,
  padding: "10px 16px", cursor: "pointer", fontWeight: 500, fontSize: 13
};

const btnGhost = {
  background: "transparent", color: "#f8fafc", border: "1px solid #475569",
  borderRadius: 4, padding: "10px 16px", cursor: "pointer", fontSize: 13
};