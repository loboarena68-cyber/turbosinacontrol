import { useState, useEffect } from "react";

// --- CONFIGURACIÓN DE CONTRASEÑA ---
const PASSWORD_ACCESO = "cyl4";
// -----------------------------------

const OP_TYPES = ["Adiestramiento", "Ruta Nacional", "Mantenimiento", "Otros"];

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

  // ESTADOS DEL CHATBOT ASISTENTE LOCAL FLOATING
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: "bot", text: "Asistente Logístico Local A-4 activo. Puede consultar inventarios consolidados, extracciones por matrícula o flujos logísticos por periodos de tiempo (Ej: 'consumo total', 'mayo 2026', 'aeronave 2029')." }
  ]);

  useEffect(() => {
    const authStatus = sessionStorage.getItem("turbo-auth");
    if (authStatus === "true") setIsAuthenticated(true);

    const recs = localStorage.getItem("turbo-records");
    const inits = localStorage.getItem("turbo-iniciales");
    const personal = localStorage.getItem("turbo-personal-17");
    const status = localStorage.getItem("turbo-status-cisternas");

    if (recs) setRecords(JSON.parse(recs));
    if (personal) setPersonalHistory(JSON.parse(personal));
    if (status) setStatusCisternas(JSON.parse(status));
    
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

  const savePersonal = (hist) => {
    setPersonalHistory(hist);
    localStorage.setItem("turbo-personal-17", JSON.stringify(hist));
  };

  const saveStatus = (cis, newStatus) => {
    const updated = { ...statusCisternas, [cis]: newStatus };
    setStatusCisternas(updated);
    localStorage.setItem("turbo-status-cisternas", JSON.stringify(updated));
    flash(`C-${cis} actualizada a Categoría ${newStatus}`, newStatus === "C" ? "error" : "ok");
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

  // LÓGICA DE PROCESAMIENTO LOCAL DEL CHATBOT
  const processLocalBotQuery = (queryText) => {
    const q = queryText.toLowerCase().trim();
    if (!q) return "Por favor ingrese un requerimiento o término de búsqueda.";

    let cisternaTarget = q.includes("16") ? "16" : q.includes("17") ? "17" : null;
    let tipoTarget = null;
    if (q.includes("despacho") || q.includes("salida") || q.includes("consumo") || q.includes("gasto") || q.includes("extracc")) tipoTarget = "despacho";
    if (q.includes("recarga") || q.includes("entrada") || q.includes("proveedor")) tipoTarget = "recarga";

    const meses = {
      "enero": "01", "febrero": "02", "marzo": "03", "abril": "04", "mayo": "05", "junio": "06",
      "julio": "07", "agosto": "08", "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12"
    };
    
    let periodoTarget = null;
    for (const [mes, num] of Object.entries(meses)) {
      if (q.includes(mes)) {
        periodoTarget = `2026-${num}`; 
        break;
      }
    }
    if (q.includes("este mes") || q.includes("mes en curso") || q.includes("actual")) {
      periodoTarget = currentMonthStr();
    }

    let matriculaTarget = null;
    const matriculaMatch = q.match(/\b\d{4}\b/);
    if (matriculaMatch) matriculaTarget = matriculaMatch[0];

    let dataset = [...records];
    if (cisternaTarget) dataset = dataset.filter(r => r.cisterna === cisternaTarget);
    if (tipoTarget) dataset = dataset.filter(r => r.tipo === tipoTarget);
    if (periodoTarget) dataset = dataset.filter(r => r.fecha.startsWith(periodoTarget));
    if (matriculaTarget) dataset = dataset.filter(r => r.matriculaAeronave && r.matriculaAeronave.includes(matriculaTarget));

    const sumaDespachos = dataset.filter(r => r.tipo === "despacho").reduce((a, r) => a + r.litros, 0);
    const sumaRecargas = dataset.filter(r => r.tipo === "recarga").reduce((a, r) => a + r.litros, 0);

    let analitica = `📊 **Resultados del Análisis Operativo:**\n\n`;
    analitica += `• Criterios identificados: ${[
      periodoTarget ? `Periodo [${periodoTarget}]` : "Histórico consolidado",
      cisternaTarget ? `Unidad [C-${cisternaTarget}]` : null,
      matriculaTarget ? `Aeronave [Mat. ${matriculaTarget}]` : null,
      tipoTarget ? `Flujo [${tipoTarget.toUpperCase()}]` : null
    ].filter(Boolean).join(" + ")}\n`;
    analitica += `• Transacciones evaluadas: ${dataset.length} registros.\n\n`;

    if (!tipoTarget || tipoTarget === "despacho") {
      analitica += `🔻 Extracciones Totales: ${formatNum(sumaDespachos)} L\n`;
    }
    if (!tipoTarget || tipoTarget === "recarga") {
      analitica += `🔺 Recargas de Proveedor: ${formatNum(sumaRecargas)} L\n`;
    }

    if (q.includes("inventario") || q.includes("saldo") || q.includes("existencia") || q.includes("cuanto qued") || q.includes("actual")) {
      analitica += `\n📦 **Existencias Netas en Tanque:**\n`;
      analitica += `• C-16: ${formatNum(saldoCisterna("16"))} L\n`;
      analitica += `• C-17: ${formatNum(saldoCisterna("17"))} L\n`;
      analitica += `• Balance Combinado: ${formatNum(saldoTotal)} L`;
    }

    if (dataset.length === 0) {
      return `Convenio de Datos: No se localizaron registros operativos que coincidan con la ventana de tiempo o parámetros solicitados en su mensaje ("${queryText}"). Verifique la captura en la Bitácora.`;
    }

    return analitica;
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = { id: Date.now(), sender: "user", text: chatInput };
    const botText = processLocalBotQuery(chatInput);
    const botMsg = { id: Date.now() + 1, sender: "bot", text: botText };

    setChatMessages(prev => [...prev, userMsg, botMsg]);
    setChatInput("");
  };

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

  const handleSavePersonal = () => {
    if (!perForm.conductor.trim() || !perForm.responsable.trim()) {
      return flash("Error: Ingrese Conductor y Responsable", "error");
    }
    const filtered = personalHistory.filter(p => p.periodo !== perForm.periodo);
    const updated = [...filtered, { ...perForm, id: Date.now() }].sort((a, b) => b.periodo.localeCompare(a.periodo));
    savePersonal(updated);
    setPerForm({ periodo: currentMonthStr(), conductor: "", responsable: "" });
    flash("Asignación de personal registrada.", "ok");
  };

  const handleDeletePersonal = (id) => {
    if (!confirm("¿Eliminar este registro de asignación histórica?")) return;
    savePersonal(personalHistory.filter(p => p.id !== id));
  };

  const handleDelete = (id) => {
    if (!confirm("¿Autoriza la eliminación de este registro operativo?")) return;
    saveRecs(records.filter((r) => r.id !== id));
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

  const getActivePersonnelForMonth = (dateStr) => {
    const targetMonth = dateStr.slice(0, 7);
    const match = personalHistory.find(p => p.periodo === targetMonth);
    return match || { conductor: "No asignado", responsable: "No asignado" };
  };

  const activePersonnel = getActivePersonnelForMonth(form.fecha);

  // --- EXPORTACIONES ---
  const exportBackup = () => {
    const backup = { version: 3, fecha: new Date().toISOString(), saldosIniciales: saldosSaved, registros: records, personal17: personalHistory, estadoCisternas: statusCisternas };
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
        if (!confirm(`Se sobreescribirán los datos actuales. ¿Proceder?`)) return;
        saveRecs(data.registros);
        setSaldosSaved(data.saldosIniciales);
        setSaldos({ "16": data.saldosIniciales["16"] ?? "", "17": data.saldosIniciales["17"] ?? "" });
        localStorage.setItem("turbo-iniciales", JSON.stringify(data.saldosIniciales));
        if (data.personal17) savePersonal(data.personal17);
        if (data.estadoCisternas) {
          setStatusCisternas(data.estadoCisternas);
          localStorage.setItem("turbo-status-cisternas", JSON.stringify(data.estadoCisternas));
        }
        flash(`Respaldo restaurado exitosamente.`, "ok");
      } catch (_) { flash("Error de integridad.", "error"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const exportCSV = () => {
    const headers = ["Fecha", "Cisterna", "Proveedor", "Tipo", "Litros", "Aeronave", "Operacion", "Notas"];
    const rows = records.map((r) => [
      r.fecha, `C-${r.cisterna}`, CISTERNAS[r.cisterna].proveedor, r.tipo, r.tipo === "despacho" ? -r.litros : r.litros, r.matriculaAeronave || "", r.tipoOperacion || "", r.notas || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Reporte_Mensual_Turbosina_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // --- PANTALLA DE LOGIN ---
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#f8fafc", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
        <div style={{ background: "#1e293b", padding: "40px", borderRadius: "8px", border: "1px solid #334155", width: "100%", maxWidth: "350px", textAlign: "center", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
          <div style={{ fontSize: "24px", fontWeight: "700", letterSpacing: "2px", color: "#94a3b8", marginBottom: "8px" }}>SECCIÓN A-4</div>
          <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "30px", letterSpacing: "1px" }}>SISTEMA DE CONTROL GESTIÓN TURBOSINA</div>
          <form onSubmit={handleLogin}>
            <input type="password" value={passInput} onChange={e => setPassInput(e.target.value)} placeholder="Código de Autorización" style={{ width: "100%", background: "#0f172a", border: "1px solid #475569", color: "#f8fafc", padding: "12px", borderRadius: "4px", textAlign: "center", letterSpacing: "2px", marginBottom: "20px", outline: "none", boxSizing: "border-box" }} />
            <button type="submit" style={{ width: "100%", background: "#3b82f6", color: "#fff", border: "none", padding: "12px", borderRadius: "4px", fontWeight: "600", letterSpacing: "1px", cursor: "pointer", textTransform: "uppercase", fontSize: "13px" }}>Autenticar</button>
          </form>
          {msg && <div style={{ marginTop: "20px", color: "#ef4444", fontSize: "13px" }}>{msg.text}</div>}
        </div>
      </div>
    );
  }

  // --- INTERFAZ COMPLETA ORIGINAL ---
  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "'Inter', 'Segoe UI', sans-serif", position: "relative" }}>
      
      {isAnyCatC && (
        <div style={{ background: "#7f1d1d", color: "#fca5a5", padding: "10px 20px", textAlign: "center", fontSize: 13, fontWeight: 700, letterSpacing: 1, borderBottom: "1px solid #ef4444" }}>
          ⚠️ ALERTA DE FLOTA: {(statusCisternas["16"] === "C" && statusCisternas["17"] === "C") ? "AMBAS CISTERNAS" : statusCisternas["16"] === "C" ? "CISTERNA 16" : "CISTERNA 17"} FUERA DE SERVICIO (CATEGORÍA C)
        </div>
      )}

      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "16px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1.5, color: "#f8fafc" }}>CONTROL DE TURBOSINA</div>
            <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 1, marginTop: 4 }}>GESTIÓN DE COMBUSTIBLE • SECCIÓN A-4</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase" }}>Inventario Consolidado</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: COLOR_SALDO }}>
              {formatNum(saldoTotal)} <span style={{ fontSize: 14, color: COLOR_SALDO }}>L</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px", paddingBottom: "100px" }}>

        {msg && (
          <div style={{ background: msg.type === "ok" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)", borderLeft: `4px solid ${msg.type === "ok" ? "#22c55e" : "#ef4444"}`, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: msg.type === "ok" ? "#86efac" : "#fca5a5" }}>
            {msg.text}
          </div>
        )}

        {(needsSetup || editSaldo) && (
          <div style={{ background: "#1e293b", border: "1px solid #475569", borderRadius: 6, padding: 20, marginBottom: 24 }}>
            <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" }}>Parámetros Iniciales del Mes</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {["16", "17"].map((cis) => (
                <div key={cis}>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Cisterna {cis} — <span style={{ color: CISTERNAS[cis].color }}>{CISTERNAS[cis].proveedor}</span></div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="number" value={saldos[cis]} onChange={e => setSaldos({ ...saldos, [cis]: e.target.value })} placeholder="Volumen (L)" style={inputStyle} />
                    <button onClick={() => handleSaveInicial(cis)} style={btnPrimary}>Guardar</button>
                  </div>
                </div>
              ))}
            </div>
            {editSaldo && <button onClick={() => setEditSaldo(null)} style={{ ...btnGhost, marginTop: 16 }}>Cerrar Edición</button>}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid #334155", paddingBottom: 16 }}>
          {[["registro", "Registro Operativo"], ["historial", "Bitácora"], ["estadisticas", "Métricas y Estado"], ["exportar", "Administración"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ background: tab === key ? "#2563eb" : "transparent", color: tab === key ? "#fff" : "#94a3b8", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
              {label}
            </button>
          ))}
        </div>

        {/* TAB: Registro */}
        {tab === "registro" && (
          <div style={{ background: "#1e293b", borderRadius: 6, padding: 24, border: "1px solid #334155" }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              {["16", "17"].map(cis => (
                <button key={cis} onClick={() => setForm({ ...form, cisterna: cis, tipo: "despacho" })} style={{ flex: 1, padding: "12px", borderRadius: 4, border: `1px solid ${form.cisterna === cis ? "#3b82f6" : "#475569"}`, background: form.cisterna === cis ? "rgba(255,255,255,0.05)" : "transparent", color: form.cisterna === cis ? "#f8fafc" : "#94a3b8", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>CISTERNA {cis}</div>
                  <div style={{ fontSize: 11, color: "#60a5fa", marginTop: 4 }}>{CISTERNAS[cis].proveedor}</div>
                </button>
              ))}
            </div>

            {form.cisterna === "17" && (
              <div style={{ marginBottom: 20, background: "rgba(30, 41, 59, 0.5)", border: "1px solid #475569", borderRadius: 4, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: COLOR_SALDO, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>👤 Dotación de Personal (C-17):</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8, fontSize: 13 }}>
                  <div><span style={{ color: "#94a3b8" }}>Conductor:</span> <strong style={{ color: "#f8fafc" }}>{activePersonnel.conductor}</strong></div>
                  <div><span style={{ color: "#94a3b8" }}>Responsable:</span> <strong style={{ color: "#f8fafc" }}>{activePersonnel.responsable}</strong></div>
                </div>
              </div>
            )}

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
                  <div>
                    <Label>Matrícula de Aeronave</Label>
                    <input type="text" list="aeronaves-list" value={form.matriculaAeronave} onChange={e => setForm({ ...form, matriculaAeronave: e.target.value.toUpperCase() })} placeholder="Ej. XA-..." style={inputStyle} />
                    <datalist id="aeronaves-list">{aeronavesUnicas.map(a => <option key={a} value={a} />)}</datalist>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Label>Clasificación de Operación</Label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {OP_TYPES.map(t => (
                        <button key={t} onClick={() => setForm({ ...form, tipoOperacion: t })} style={{ padding: "8px 16px", borderRadius: 4, border: "1px solid #475569", background: form.tipoOperacion === t ? "#475569" : "transparent", color: form.tipoOperacion === t ? "#fff" : "#cbd5e1", cursor: "pointer", fontSize: 12 }}>{t}</button>
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
              const isLowReserve = s < 5000;
              const cat = statusCisternas[cis];
              return (
                <div key={cis} style={{ background: "#1e293b", borderRadius: 6, padding: 24, border: `1px solid ${cat === "C" ? "#ef4444" : isLowReserve ? "#f59e0b" : "#334155"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #334155", paddingBottom: 12, marginBottom: 16 }}>
                    <div>
                      <span style={{ fontSize: 18, fontWeight: 600, color: "#f8fafc", marginRight: 16 }}>CISTERNA {cis}</span>
                      <select value={cat} onChange={e => saveStatus(cis, e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 12px", fontSize: 12, display: "inline-block", background: cat === "C" ? "#7f1d1d" : cat === "B" ? "#78350f" : "#064e3b", color: "#fff", borderColor: "transparent", fontWeight: 600 }}>
                        <option value="A">CAT A - Operativa</option><option value="B">CAT B - Condicional</option><option value="C">CAT C - Fuera de Servicio</option>
                      </select>
                    </div>
                    <button onClick={() => setEditSaldo(cis)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>Editar Saldo Inicial</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Ingresos (Recargas)</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: COLOR_INGRESO }}>+{formatNum(stats.recargas)} <span style={{ fontSize: 12, color: COLOR_INGRESO }}>L</span></div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Consumos (Despachos)</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: COLOR_SALIDA }}>-{formatNum(stats.despachos)} <span style={{ fontSize: 12, color: COLOR_SALIDA }}>L</span></div>
                    </div>
                    <div style={{ borderLeft: "1px solid #334155", paddingLeft: 16 }}>
                      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Existencia Actual</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: isLowReserve ? "#ef4444" : COLOR_SALDO }}>{formatNum(s)} <span style={{ fontSize: 12, color: isLowReserve ? "#ef4444" : COLOR_SALDO }}>L</span></div>
                      {isLowReserve && <div style={{ marginTop: 6, fontSize: 10, color: "#ef4444", fontWeight: 700, background: "rgba(239, 68, 68, 0.1)", padding: "4px 8px", borderRadius: 4, display: "inline-block" }}>⚠️ RESERVA COMPROMETIDA (&lt; 5,000 L)</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: Bitácora */}
        {tab === "historial" && (
          <div>
            <div style={{ marginBottom: 20 }}><input type="text" placeholder="🔍 Buscar por matrícula (Ej. 2029), operación o nota..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ ...inputStyle, padding: "12px 16px" }} /></div>
            {sortedDates.length === 0 && <div style={{ textAlign: "center", color: "#64748b", padding: 40, fontSize: 14 }}>No se encontraron registros.</div>}
            {sortedDates.map(fecha => (
              <div key={fecha} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 1, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", borderBottom: "1px solid #334155", paddingBottom: 8 }}>{fecha}</div>
                <div style={{ background: "#1e293b", borderRadius: 6, overflow: "hidden", border: "1px solid #334155" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.2)", color: "#cbd5e1", textAlign: "left" }}>
                        <th style={{ padding: "12px 16px", fontWeight: 500 }}>Unidad</th><th style={{ padding: "12px 16px", fontWeight: 500 }}>Operación</th><th style={{ padding: "12px 16px", fontWeight: 500 }}>Volumen</th><th style={{ padding: "12px 16px", fontWeight: 500 }}>Matrícula</th><th style={{ padding: "12px 16px", fontWeight: 500 }}>Notas</th><th style={{ padding: "12px 16px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[fecha].map((r) => (
                        <tr key={r.id} style={{ borderTop: "1px solid #334155" }}>
                          <td style={{ padding: "12px 16px", color: "#60a5fa", fontWeight: 500 }}>C-{r.cisterna}</td>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: r.tipo === "despacho" ? COLOR_SALIDA : r.tipo === "recarga" ? COLOR_INGRESO : COLOR_SALDO }}>{r.tipo === "despacho" ? "Despacho" : r.tipo === "recarga" ? "Recarga" : "Ajuste"}</td>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: r.tipo === "despacho" ? COLOR_SALIDA : r.tipo === "recarga" ? COLOR_INGRESO : COLOR_SALDO }}>{r.tipo === "despacho" ? "-" : "+"}{formatNum(r.litros)}</td>
                          <td style={{ padding: "12px 16px", color: "#f8fafc", fontWeight: 600 }}>{r.matriculaAeronave || "—"}</td>
                          <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 12 }}>{r.notas || "—"}</td>
                          <td style={{ padding: "12px 16px", textAlign: "right" }}><button onClick={() => handleDelete(r.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: Administración */}
        {tab === "exportar" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ background: "#1e293b", borderRadius: 6, padding: 24, border: "1px solid #334155" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#f8fafc", marginBottom: 4, textTransform: "uppercase" }}>Asignación Mensual de Personal (Cisterna 17)</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>Registre el relevo de la tripulación de la unidad para el control mensual.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 2fr", gap: 16, alignItems: "end", marginBottom: 20 }}>
                <div><Label>Periodo</Label><input type="month" value={perForm.periodo} onChange={e => setPerForm({...perForm, periodo: e.target.value})} style={inputStyle} /></div>
                <div><Label>Nombre del Conductor</Label><input type="text" value={perForm.conductor} onChange={e => setPerForm({...perForm, conductor: e.target.value})} placeholder="Ej. C3. Juan Pérez" style={inputStyle} /></div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}><Label>Responsable de Unidad</Label><input type="text" value={perForm.responsable} onChange={e => setPerForm({...perForm, responsable: e.target.value})} placeholder="Ej. Tte. Gómez" style={inputStyle} /></div>
                  <button onClick={handleSavePersonal} style={{ ...btnPrimary, height: "40px" }}>Fijar</button>
                </div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.1)", borderRadius: 4, border: "1px solid #334155", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "rgba(0,0,0,0.2)", color: "#cbd5e1", textAlign: "left" }}>
                      <th style={{ padding: "10px 16px", fontWeight: 500 }}>Mes / Año</th><th style={{ padding: "10px 16px", fontWeight: 500 }}>Conductor Asignado</th><th style={{ padding: "10px 16px", fontWeight: 500 }}>Responsable de Vehículo</th><th style={{ padding: "10px 16px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {personalHistory.length === 0 && <tr><td colSpan="4" style={{ padding: "16px", color: "#64748b", textAlign: "center" }}>No hay registros archivados.</td></tr>}
                    {personalHistory.map((p) => (
                      <tr key={p.id} style={{ borderTop: "1px solid #334155" }}>
                        <td style={{ padding: "10px 16px", color: COLOR_SALDO, fontWeight: 600 }}>{p.periodo}</td><td style={{ padding: "10px 16px", color: "#f8fafc" }}>{p.conductor}</td><td style={{ padding: "10px 16px", color: "#cbd5e1" }}>{p.responsable}</td><td style={{ padding: "10px 16px", textAlign: "right" }}><button onClick={() => handleDeletePersonal(p.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ background: "#1e293b", borderRadius: 6, padding: 24, border: "1px solid #334155" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#f8fafc", marginBottom: 20 }}>Administración de Datos y Reportes</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 20, border: "1px solid #334155", borderRadius: 4, background: "rgba(0,0,0,0.1)" }}>
                  <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 600, marginBottom: 8 }}>Exportar Reporte Mensual (CSV)</div>
                  <button onClick={exportCSV} style={btnGhost}>Descargar Excel (CSV)</button>
                </div>
                <div style={{ padding: 20, border: "1px solid #334155", borderRadius: 4, background: "rgba(0,0,0,0.1)" }}>
                  <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 600, marginBottom: 8 }}>Copia de Seguridad Estructural</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={exportBackup} style={btnGhost}>Exportar Resp.</button>
                    <label style={{ ...btnPrimary, background: "#334155", display: "inline-block", cursor: "pointer", textAlign: "center", padding: "8px 16px" }}>Importar Resp.<input type="file" accept=".json" onChange={importBackup} style={{ display: "none" }} /></label>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: "1px solid #334155", paddingTop: 16, textAlign: "center" }}><button onClick={() => { sessionStorage.removeItem("turbo-auth"); setIsAuthenticated(false); }} style={{ background: "transparent", color: "#ef4444", border: "1px solid #ef4444", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>Cerrar Sesión Segura</button></div>
            </div>
          </div>
        )}
      </div>

      {/* --- AGENTE DE IA FLOTANTE (ESTRUCTURA INTACTA) --- */}
      <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 1000, fontFamily: "sans-serif" }}>
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#2563eb", border: "none", color: "#fff", fontSize: "24px", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", outline: "none" }}
        >
          {isChatOpen ? "×" : "💬"}
        </button>

        {isChatOpen && (
          <div style={{ position: "absolute", bottom: "70px", right: "0", width: "340px", height: "420px", background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ background: "#0f172a", padding: "12px 16px", borderBottom: "1px solid #334155", fontSize: "13px", fontWeight: 700, letterSpacing: "1px", color: "#94a3b8" }}>
              ASISTENTE LOGÍSTICO LOCAL A-4
            </div>
            
            <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", background: "#0f172a" }}>
              {chatMessages.map(m => (
                <div key={m.id} style={{ alignSelf: m.sender === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.sender === "user" ? "#2563eb" : "#1e293b", color: "#fff", padding: "8px 12px", borderRadius: "6px", fontSize: "12px", whiteSpace: "pre-line", border: m.sender === "bot" ? "1px solid #334155" : "none" }}>
                  {m.text}
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} style={{ padding: "8px", borderTop: "1px solid #334155", display: "flex", gap: "6px", background: "#1e293b" }}>
              <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ej: 'consumo total', 'mayo 2026'..." style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: "4px", color: "#fff", padding: "8px", fontSize: "12px", outline: "none" }} />
              <button type="submit" style={{ background: "#2563eb", color: "#fff", border: "none", padding: "0 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}>Enviar</button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}

const Label = ({ children }) => <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 500 }}>{children}</div>;
const inputStyle = { width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 4, color: "#f8fafc", padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" };
const btnPrimary = { background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, padding: "10px 16px", cursor: "pointer", fontWeight: 500, fontSize: 13 };
const btnGhost = { background: "transparent", color: "#f8fafc", border: "1px solid #475569", borderRadius: 4, padding: "10px 16px", cursor: "pointer", fontSize: 13 };