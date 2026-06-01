import { useState, useEffect } from "react";

// --- CONFIGURACIÓN DE CONTRASEÑA ---
const PASSWORD_ACCESO = "A4-LOG";
// -----------------------------------

const OP_TYPES = ["Adiestramiento", "Ruta Nacional", "Mantenimiento", "Vuelo de prueba", "Otros"];

const formatNum = (n) =>
  Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const todayStr = () => new Date().toISOString().slice(0, 10);
const currentMonthStr = () => new Date().toISOString().slice(0, 7);

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
  "16": { nombre: "Cisterna 16", proveedor: "ASA COZUMEL", color: "#60a5fa" }, 
  "17": { nombre: "Cisterna 17", proveedor: "G. Mundo Maya", color: "#60a5fa" }, 
};

// --- PALETA DE COLORES SEMÁNTICOS ---
const COLOR_INGRESO = "#10b981"; 
const COLOR_SALIDA = "#ef4444";  
const COLOR_SALDO = "#fde047";   
// ------------------------------------

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passInput, setPassInput] = useState("");

  const [records, setRecords] = useState([]);
  const [saldos, setSaldos] = useState({ "16": "", "17": "" });
  const [saldosSaved, setSaldosSaved] = useState({ "16": null, "17": null });
  
  const [statusCisternas, setStatusCisternas] = useState({ "16": "A", "17": "A" });
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState(emptyForm("16"));
  const [tab, setTab] = useState("registro");
  const [msg, setMsg] = useState(null);
  const [editSaldo, setEditSaldo] = useState(null);

  const [personalHistory, setPersonalHistory] = useState([]);
  const [perForm, setPerForm] = useState({ periodo: currentMonthStr(), conductor: "", responsable: "" });

  const [notesCisternas, setNotesCisternas] = useState({ "16": [], "17": [] });
  const [noteInput, setNoteInput] = useState({ "16": "", "17": "" });

  useEffect(() => {
    const authStatus = sessionStorage.getItem("turbo-auth");
    if (authStatus === "true") setIsAuthenticated(true);

    const recs = localStorage.getItem("turbo-records");
    const inits = localStorage.getItem("turbo-iniciales");
    const personal = localStorage.getItem("turbo-personal-17");
    const status = localStorage.getItem("turbo-status-cisternas");
    const storedNotes = localStorage.getItem("turbo-notes-cisternas");

    if (recs) setRecords(JSON.parse(recs));
    if (personal) setPersonalHistory(JSON.parse(personal));
    if (status) setStatusCisternas(JSON.parse(status));
    if (storedNotes) setNotesCisternas(JSON.parse(storedNotes));
    
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
      flash("Contraseña denegada.", "error");
      setPassInput("");
    }
  };

  const saveRecs = (recs) => {
    setRecords(recs);
    localStorage.setItem("turbo-records", JSON.stringify(recs));
  };

  const savePersonal = (hist) => {
    setPersonalHistory(hist);
    localStorage.setItem("turbo-personal-17", JSON.stringify(hist));
  };

  const saveStatus = (cis, newStatus) => {
    const updated = { ...statusCisternas, [cis]: newStatus };
    setStatusCisternas(updated);
    localStorage.setItem("turbo-status-cisternas", JSON.stringify(updated));
    flash(`C-${cis} en categoría ${newStatus}`, newStatus === "C" ? "error" : "ok");
  };

  const saveNotes = (updatedNotes) => {
    setNotesCisternas(updatedNotes);
    localStorage.setItem("turbo-notes-cisternas", JSON.stringify(updatedNotes));
  };

  const handleAddNote = (cis) => {
    if (!noteInput[cis].trim()) return;
    const newNoteObj = {
      id: Date.now(),
      fecha: todayStr(),
      text: noteInput[cis].trim()
    };
    const updated = {
      ...notesCisternas,
      [cis]: [newNoteObj, ...notesCisternas[cis]]
    };
    saveNotes(updated);
    setNoteInput({ ...noteInput, [cis]: "" });
    flash("Anotación registrada.", "ok");
  };

  const handleDeleteNote = (cis, id) => {
    if (!confirm("¿Desea eliminar esta anotación permanente?")) return;
    const updated = {
      ...notesCisternas,
      [cis]: notesCisternas[cis].filter(n => n.id !== id)
    };
    saveNotes(updated);
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
    if (isNaN(val) || val < 0) return flash("Valor inválido", "error");
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
    flash("Operación registrada.", "ok");
  };

  const handleSavePersonal = () => {
    if (!perForm.conductor.trim() || !perForm.responsable.trim()) return flash("Error: Ingrese campos", "error");
    const filtered = personalHistory.filter(p => p.periodo !== perForm.periodo);
    const updated = [...filtered, { ...perForm, id: Date.now() }].sort((a, b) => b.periodo.localeCompare(a.periodo));
    savePersonal(updated);
    setPerForm({ periodo: currentMonthStr(), conductor: "", responsable: "" });
    flash("Asignación registrada.", "ok");
  };

  const handleDeletePersonal = (id) => {
    if (confirm("¿Eliminar registro?")) savePersonal(personalHistory.filter(p => p.id !== id));
  };

  const handleDelete = (id) => {
    if (confirm("¿Eliminar registro operativo?")) saveRecs(records.filter((r) => r.id !== id));
  };

  const flash = (text, type) => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  };

  const aeronavesUnicas = [...new Set(records.filter(r => r.matriculaAeronave).map(r => r.matriculaAeronave))];

  const recordsFiltrados = records.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toUpperCase();
    return (
      (r.matriculaAeronave && r.matriculaAeronave.toUpperCase().includes(term)) ||
      (r.tipoOperacion && r.tipoOperacion.toUpperCase().includes(term)) ||
      (r.notas && r.notas.toUpperCase().includes(term))
    );
  });

  // NUEVO: Cálculos consolidados basados estrictamente en el filtro actual
  const totalDespachadoFiltrado = recordsFiltrados.filter(r => r.tipo === "despacho").reduce((a, r) => a + r.litros, 0);
  const totalRecargadoFiltrado = recordsFiltrados.filter(r => r.tipo === "recarga").reduce((a, r) => a + r.litros, 0);

  const grouped = recordsFiltrados.reduce((acc, r) => {
    if (!acc[r.fecha]) acc[r.fecha] = [];
    acc[r.fecha].push(r);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  
  const needsSetup = saldosSaved["16"] === null || saldosSaved["17"] === null;
  const isAnyCatC = statusCisternas["16"] === "C" || statusCisternas["17"] === "C";

  const getStats = (cis) => {
    const despachos = records.filter(r => r.cisterna === cis && r.tipo === "despacho").reduce((a, r) => a + r.litros, 0);
    const recargas = records.filter(r => r.cisterna === cis && r.tipo === "recarga").reduce((a, r) => a + r.litros, 0);
    return { despachos, recargas };
  };

  const getMonthStats = (cis) => {
    const currentMonth = currentMonthStr();
    const monthRecords = records.filter(r => r.cisterna === cis && r.fecha.slice(0, 7) === currentMonth);
    const despachos = monthRecords.filter(r => r.tipo === "despacho").reduce((a, r) => a + r.litros, 0);
    const recargas = monthRecords.filter(r => r.tipo === "recarga").reduce((a, r) => a + r.litros, 0);
    return { despachos, recargas };
  };

  const activePersonnel = personalHistory.find(p => p.periodo === form.fecha.slice(0, 7)) || { conductor: "No asignado", responsable: "No asignado" };

  // --- EXPORTACIONES ---
  const exportBackup = () => {
    const backup = { 
      version: 4, 
      fecha: new Date().toISOString(), 
      saldosIniciales: saldosSaved, 
      registros: records, 
      personal17: personalHistory, 
      estadoCisternas: statusCisternas,
      notasCisternas: notesCisternas 
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const importBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!confirm("¿Sobrescribir datos?")) return;
        saveRecs(data.registros);
        setSaldosSaved(data.saldosIniciales);
        setSaldos({ "16": data.saldosIniciales["16"] ?? "", "17": data.saldosIniciales["17"] ?? "" });
        localStorage.setItem("turbo-iniciales", JSON.stringify(data.saldosIniciales));
        if (data.personal17) savePersonal(data.personal17);
        if (data.estadoCisternas) {
          setStatusCisternas(data.estadoCisternas);
          localStorage.setItem("turbo-status-cisternas", JSON.stringify(data.estadoCisternas));
        }
        if (data.notasCisternas) {
          saveNotes(data.notasCisternas);
        } else {
          saveNotes({ "16": [], "17": [] });
        }
        flash("Datos restaurados.", "ok");
      } catch (_) { flash("Error en archivo.", "error"); }
    };
    reader.readAsText(file);
  };

  const exportCSV = () => {
    const headers = ["Fecha", "Cisterna", "Proveedor", "Tipo", "Litros", "Aeronave", "Operacion", "Notas"];
    const rows = records.map((r) => [r.fecha, `C-${r.cisterna}`, CISTERNAS[r.cisterna].proveedor, r.tipo, r.tipo === "despacho" ? -r.litros : r.litros, r.matriculaAeronave || "", r.tipoOperacion || "", r.notas || ""]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Reporte_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#f8fafc", fontFamily: "sans-serif" }}>
        <div style={{ background: "#1e293b", padding: "40px", borderRadius: "8px", border: "1px solid #334155", width: "100%", maxWidth: "350px", textAlign: "center" }}>
          <div style={{ fontWeight: 700, letterSpacing: "2px", color: "#94a3b8", marginBottom: "20px" }}>SECCIÓN A-4</div>
          <form onSubmit={handleLogin}>
            <input type="password" value={passInput} onChange={e => setPassInput(e.target.value)} placeholder="Código" style={{ width: "100%", padding: "12px", borderRadius: "4px", marginBottom: "20px", background: "#0f172a", color: "#fff", border: "1px solid #475569" }} />
            <button type="submit" style={{ width: "100%", padding: "12px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "4px" }}>Autenticar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "sans-serif" }}>
      {isAnyCatC && (
        <div style={{ background: "#7f1d1d", color: "#fca5a5", padding: "10px", textAlign: "center", fontSize: 13, fontWeight: 700 }}>⚠️ ALERTA: UNIDAD FUERA DE SERVICIO (CAT C)</div>
      )}
      <div style={{ background: "#1e293b", padding: "20px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontSize: 18, fontWeight: 700 }}>CONTROL DE TURBOSINA</div><div style={{ fontSize: 11, color: "#94a3b8" }}>SECCIÓN A-4</div></div>
          <div style={{ fontSize: 24, fontWeight: 700, color: COLOR_SALDO }}>{formatNum(saldoTotal)} L</div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "24px auto", padding: "0 16px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid #334155" }}>
          {["registro", "historial", "estadisticas", "exportar"].map(key => (
            <button key={key} onClick={() => setTab(key)} style={{ background: tab === key ? "#2563eb" : "transparent", color: tab === key ? "#fff" : "#94a3b8", border: "none", padding: "10px", cursor: "pointer", fontSize: 13 }}>
              {key.toUpperCase()}
            </button>
          ))}
        </div>

        {tab === "registro" && (
          <div style={{ background: "#1e293b", padding: 20, borderRadius: 6 }}>
             <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                {["16", "17"].map(c => (
                  <button key={c} onClick={() => setForm({...form, cisterna: c})} style={{ flex: 1, padding: 10, background: form.cisterna === c ? "#3b82f6" : "#0f172a", border: "none", color: "#fff", cursor: "pointer" }}>C-{c}</button>
                ))}
             </div>
             {form.cisterna === "17" && (
              <div style={{ padding: 10, background: "#0f172a", marginBottom: 15, fontSize: 12 }}>
                👤 Conductor: {activePersonnel.conductor} | Resp: {activePersonnel.responsable}
              </div>
             )}
             <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inputStyle} />
             <input type="number" value={form.litros} onChange={e => setForm({...form, litros: e.target.value})} placeholder="Litros" style={{...inputStyle, marginTop: 10}} />
             <input type="text" list="a-list" value={form.matriculaAeronave} onChange={e => setForm({...form, matriculaAeronave: e.target.value.toUpperCase()})} placeholder="Matrícula" style={{...inputStyle, marginTop: 10}} />
             <datalist id="a-list">{aeronavesUnicas.map(a => <option key={a} value={a} />)}</datalist>
             <select value={form.tipoOperacion} onChange={e => setForm({...form, tipoOperacion: e.target.value})} style={{...inputStyle, marginTop: 10}}>
                {OP_TYPES.map(op => <option key={op} value={op}>{op}</option>)}
             </select>
             <button onClick={handleSubmit} style={{...btnPrimary, marginTop: 20, width: "100%"}}>Registrar</button>
          </div>
        )}

        {tab === "estadisticas" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {["16", "17"].map(c => {
               const s = saldoCisterna(c);
               const cat = statusCisternas[c];
               const monthStats = getMonthStats(c);
               const thisCisNotes = notesCisternas[c] || [];
               
               const maxVal = Math.max(monthStats.recargas, monthStats.despachos) || 1;
               const widthIngreso = (monthStats.recargas / maxVal) * 100;
               const widthSalida = (monthStats.despachos / maxVal) * 100;

               return (
                 <div key={c} style={{ background: "#1e293b", padding: 20, borderRadius: 6, border: `1px solid ${cat === "C" ? "#ef4444" : "#334155"}` }}>
                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>Cisterna {c}</span>
                      <select value={cat} onChange={e => saveStatus(c, e.target.value)} style={{ background: "#0f172a", color: "#fff", border: "1px solid #334155", padding: "4px" }}>
                        <option value="A">CAT A</option><option value="B">CAT B</option><option value="C">CAT C</option>
                      </select>
                   </div>
                   
                   <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700, color: s < 5000 ? "#ef4444" : COLOR_SALDO }}>
                     {formatNum(s)} L
                   </div>
                   {s < 5000 && <div style={{ color: "#ef4444", fontSize: 11, fontWeight: 700, marginTop: 2 }}>⚠️ RESERVA BAJA</div>}

                   {/* Rendimiento del Mes */}
                   <div style={{ marginTop: 15, paddingTop: 12, borderTop: "1px solid #334155" }}>
                      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>Rendimiento del Mes en Curso</div>
                      
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: "#94a3b8" }}>Entradas (Recargas):</span>
                          <span style={{ color: COLOR_INGRESO, fontWeight: 700 }}>+{formatNum(monthStats.recargas)} L</span>
                        </div>
                        <div style={{ width: "100%", background: "#0f172a", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ background: COLOR_INGRESO, height: "100%", width: `${widthIngreso}%` }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: "#94a3b8" }}>Salidas (Despachos):</span>
                          <span style={{ color: COLOR_SALIDA, fontWeight: 700 }}>−{formatNum(monthStats.despachos)} L</span>
                        </div>
                        <div style={{ width: "100%", background: "#0f172a", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ background: COLOR_SALIDA, height: "100%", width: `${widthSalida}%` }} />
                        </div>
                      </div>
                   </div>

                   {/* Lista de Anotaciones */}
                   <div style={{ marginTop: 20, paddingTop: 15, borderTop: "1px solid #334155" }}>
                      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>Anotaciones y Novedades de la Unidad</div>
                      
                      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <input 
                          type="text" 
                          placeholder="Escribir novedad u observación técnica..." 
                          value={noteInput[c] || ""} 
                          onChange={e => setNoteInput({ ...noteInput, [c]: e.target.value })}
                          style={{ ...inputStyle, padding: "8px 12px", fontSize: 13 }}
                        />
                        <button onClick={() => handleAddNote(c)} style={{ ...btnPrimary, padding: "0 16px", fontSize: 12 }}>Añadir</button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHHeight: "150px", overflowY: "auto" }}>
                        {thisCisNotes.length === 0 && (
                          <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>Sin novedades registradas.</div>
                        )}
                        {thisCisNotes.map(n => (
                          <div key={n.id} style={{ background: "#0f172a", padding: "8px 12px", borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: 12 }}>
                            <div style={{ flex: 1, paddingRight: 8 }}>
                              <span style={{ color: COLOR_SALDO, fontWeight: 600, marginRight: 8 }}>{n.fecha}:</span>
                              <span style={{ color: "#e2e8f0" }}>{n.text}</span>
                            </div>
                            <button onClick={() => handleDeleteNote(c, n.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0, fontSize: 14 }}>✕</button>
                          </div>
                        ))}
                      </div>
                   </div>

                 </div>
               )
            })}
          </div>
        )}

        {tab === "historial" && (
          <div>
            <input placeholder="Buscar matrícula, operación o notas..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{...inputStyle, marginBottom: 14}} />
            
            {/* NUEVO PANEL: Consolidación y sumatoria en tiempo real al filtrar */}
            <div style={{ background: "#1e293b", padding: "12px 16px", borderRadius: 4, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, border: "1px solid #334155" }}>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Extracciones (Filtrado)</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLOR_SALIDA }}>−{formatNum(totalDespachadoFiltrado)} L</div>
              </div>
              <div style={{ borderLeft: "1px solid #334155", paddingLeft: 16 }}>
                <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Recargas (Filtrado)</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLOR_INGRESO }}>+{formatNum(totalRecargadoFiltrado)} L</div>
              </div>
            </div>

            {sortedDates.length === 0 && <div style={{ textAlign: "center", color: "#64748b", padding: 40, fontSize: 14 }}>No se encontraron registros.</div>}
            
            {sortedDates.map(date => (
              <div key={date} style={{ marginBottom: 15 }}>
                <div style={{ color: "#64748b", fontSize: 12, marginBottom: 5, fontWeight: 600 }}>{date}</div>
                {grouped[date].map(r => (
                  <div key={r.id} style={{ background: "#1e293b", padding: 12, marginBottom: 5, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: 4 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>{r.matriculaAeronave || "RECARGA PROV."}</span>
                        <span style={{ fontSize: 11, background: "#0f172a", padding: "2px 6px", borderRadius: 3, color: "#94a3b8" }}>C-{r.cisterna}</span>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{r.tipoOperacion || "Suministro base"}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ color: r.tipo === "despacho" ? COLOR_SALIDA : COLOR_INGRESO, fontWeight: 700 }}>
                        {r.tipo === "despacho" ? "−" : "+"}{formatNum(r.litros)} L
                      </span>
                      <button onClick={() => handleDelete(r.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {tab === "exportar" && (
          <div style={{ background: "#1e293b", padding: 24, borderRadius: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>ADMINISTRACIÓN Y RESPALDOS</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button onClick={exportCSV} style={{ ...btnGhost, flex: 1 }}>Exportar Excel (CSV)</button>
              <button onClick={exportBackup} style={{ ...btnGhost, flex: 1 }}>Exportar Copia (.json)</button>
            </div>
            <label style={{ ...btnPrimary, display: "block", textAlign: "center", cursor: "pointer" }}>
              Importar Copia (.json)
              <input type="file" accept=".json" onChange={importBackup} style={{ display: "none" }} />
            </label>
          </div>
        )}

      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: "10px", background: "#0f172a", border: "1px solid #334155", color: "#fff", boxSizing: "border-box", borderRadius: 4 };
const btnPrimary = { padding: "10px", background: "#2563eb", border: "none", color: "#fff", cursor: "pointer", borderRadius: 4, fontWeight: 600 };
const btnGhost = { padding: "10px", background: "transparent", border: "1px solid #475569", color: "#fff", cursor: "pointer", borderRadius: 4 };