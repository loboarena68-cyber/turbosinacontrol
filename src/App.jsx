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

const COLOR_INGRESO = "#10b981"; 
const COLOR_SALIDA = "#ef4444";  
const COLOR_SALDO = "#fde047";   

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passInput, setPassInput] = useState("");

  const [records, setRecords] = useState([]);
  const [saldosSaved, setSaldosSaved] = useState({ "16": null, "17": null });
  const [saldos, setSaldos] = useState({ "16": "", "17": "" });
  
  const [statusCisternas, setStatusCisternas] = useState({ "16": "A", "17": "A" });
  const [novedades, setNovedades] = useState(""); 
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState(emptyForm("16"));
  const [tab, setTab] = useState("registro");
  const [msg, setMsg] = useState(null);
  const [editSaldo, setEditSaldo] = useState(null);

  const [personalHistory, setPersonalHistory] = useState([]);
  const [perForm, setPerForm] = useState({ periodo: currentMonthStr(), conductor: "", responsable: "" });

  // ESTADOS NUEVOS PARA EL CHATBOT ASISTENTE LOCAL
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
    const novs = localStorage.getItem("turbo-novedades");

    if (recs) setRecords(JSON.parse(recs));
    if (personal) setPersonalHistory(JSON.parse(personal));
    if (status) setStatusCisternas(JSON.parse(status));
    if (novs) setNovedades(novs);
    
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

  const saveNovedades = (val) => {
    setNovedades(val);
    localStorage.setItem("turbo-novedades", val);
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
    flash(`C-${cis} en CAT ${newStatus}`, newStatus === "C" ? "error" : "ok");
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

  // MOTOR DEL LOGÍSTICO LOCAL
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
    if (matriculaTarget) dataset = dataset.filter(r => r.matriculaAeronave.includes(matriculaTarget));

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
    if (isNaN(val) || val < 0) return flash("Error en valor", "error");
    const newSaved = { ...saldosSaved, [cis]: val };
    setSaldosSaved(newSaved);
    localStorage.setItem("turbo-iniciales", JSON.stringify(newSaved));
    setEditSaldo(null);
    flash(`Saldo inicial guardado`, "ok");
  };

  const handleSubmit = () => {
    if (!form.litros || isNaN(parseFloat(form.litros))) return flash("Error: Volumen", "error");
    if (form.tipo === "despacho" && !form.matriculaAeronave.trim()) return flash("Error: Falta matrícula", "error");
    const newRec = { ...form, id: Date.now(), litros: parseFloat(form.litros) };
    saveRecs([...records, newRec]);
    setForm(emptyForm(form.cisterna));
    flash("Registrado.", "ok");
  };

  const handleSavePersonal = () => {
    if (!perForm.conductor.trim() || !perForm.responsable.trim()) return flash("Error en personal", "error");
    const filtered = personalHistory.filter(p => p.periodo !== perForm.periodo);
    const updated = [...filtered, { ...perForm, id: Date.now() }].sort((a, b) => b.periodo.localeCompare(a.periodo));
    savePersonal(updated);
    flash("Personal asignado.", "ok");
  };

  const handleDeletePersonal = (id) => { if (confirm("Eliminar registro?")) savePersonal(personalHistory.filter(p => p.id !== id)); };
  const handleDelete = (id) => { if (confirm("Eliminar operación?")) saveRecs(records.filter((r) => r.id !== id)); };
  const flash = (text, type) => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3500); };

  const aeronavesUnicas = [...new Set(records.filter(r => r.matriculaAeronave).map(r => r.matriculaAeronave))];

  const recordsFiltrados = records.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toUpperCase();
    return (r.matriculaAeronave && r.matriculaAeronave.toUpperCase().includes(term)) || (r.tipoOperacion && r.tipoOperacion.toUpperCase().includes(term)) || (r.notas && r.notas.toUpperCase().includes(term));
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
    const match = personalHistory.find(p => p.periodo === dateStr.slice(0, 7));
    return match || { conductor: "No asignado", responsable: "No asignado" };
  };

  const activePersonnel = getActivePersonnelForMonth(form.fecha);

  // --- EXPORTACIONES ---
  const exportBackup = () => {
    const backup = { version: 3, saldosIniciales: saldosSaved, registros: records, personal17: personalHistory, estadoCisternas: statusCisternas, novedades };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Backup_A4_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    flash("Respaldo exportado.", "ok");
  };

  const importBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        saveRecs(data.registros);
        setSaldosSaved(data.saldosIniciales);
        setSaldos({ "16": data.saldosIniciales["16"] ?? "", "17": data.saldosIniciales["17"] ?? "" });
        if (data.personal17) savePersonal(data.personal17);
        if (data.estadoCisternas) setStatusCisternas(data.estadoCisternas);
        if (data.novedades) saveNovedades(data.novedades);
        flash(`Restaurado.`, "ok");
      } catch (_) { flash("Error en archivo.", "error"); }
    };
    reader.readAsText(file);
  };

  const exportCSV = () => {
    const headers = ["Fecha", "Cisterna", "Tipo", "Litros", "Aeronave", "Notas"];
    const rows = records.map((r) => [r.fecha, `C-${r.cisterna}`, r.tipo, r.litros, r.matriculaAeronave || "", r.notas || ""]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Bitacora_A4.csv`;
    a.click();
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ background: "#1e293b", padding: "40px", borderRadius: "8px", width: "100%", maxWidth: "350px", textAlign: "center", border: "1px solid #334155" }}>
          <div style={{ fontWeight: 700, color: "#94a3b8", marginBottom: 30 }}>SECCIÓN A-4 • LOGÍSTICA</div>
          <form onSubmit={handleLogin}>
            <input type="password" value={passInput} onChange={e => setPassInput(e.target.value)} placeholder="Código" style={{ ...inputStyle, textAlign: "center", marginBottom: 20 }} />
            <button type="submit" style={btnPrimary}>Autenticar</button>
          </form>
          {msg && <div style={{ marginTop: 20, color: "#ef4444" }}>{msg.text}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "'Inter', sans-serif", position: "relative" }}>
      {isAnyCatC && <div style={{ background: "#7f1d1d", color: "#fca5a5", padding: "10px", textAlign: "center", fontSize: 13, fontWeight: 700 }}>⚠️ ALERTA: UNIDAD(ES) FUERA DE SERVICIO</div>}

      <div style={{ background: "#1e293b", padding: "16px 24px", borderBottom: "1px solid #334155" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontSize: 18, fontWeight: 700 }}>CONTROL TURBOSINA</div><div style={{ fontSize: 11, color: "#94a3b8" }}>A-4 • COZUMEL</div></div>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLOR_SALDO }}>{formatNum(saldoTotal)} L</div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px", paddingBottom: "100px" }}>
        {msg && <div style={{ background: msg.type === "ok" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)", borderLeft: `4px solid ${msg.type === "ok" ? "#22c55e" : "#ef4444"}`, padding: "12px", marginBottom: 20, color: msg.type === "ok" ? "#86efac" : "#fca5a5", fontSize: 13 }}>{msg.text}</div>}
        
        {/* TABS */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid #334155", paddingBottom: 16 }}>
          {[["registro", "Registro"], ["historial", "Bitácora"], ["estadisticas", "Métricas"], ["exportar", "Admin"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ background: tab === key ? "#2563eb" : "transparent", color: tab === key ? "#fff" : "#94a3b8", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>{label}</button>
          ))}
        </div>

        {/* CONTENIDO DE TABS */}
        {tab === "registro" && (
          <div style={{ background: "#1e293b", borderRadius: 6, padding: 24, border: "1px solid #334155" }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {["16", "17"].map(cis => (
                <button key={cis} onClick={() => setForm({ ...form, cisterna: cis })} style={{ flex: 1, padding: 12, borderRadius: 4, border: `1px solid ${form.cisterna === cis ? "#3b82f6" : "#475569"}`, background: "transparent", color: "#cbd5e1" }}>Cisterna {cis}</button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inputStyle} />
              <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} style={inputStyle}>
                <option value="despacho">Despacho</option><option value="recarga">Recarga</option>
              </select>
              <input type="number" value={form.litros} onChange={e => setForm({...form, litros: e.target.value})} placeholder="Litros" style={inputStyle} />
              <input type="text" list="aeronaves" value={form.matriculaAeronave} onChange={e => setForm({...form, matriculaAeronave: e.target.value.toUpperCase()})} placeholder="Matrícula" style={inputStyle} />
              <datalist id="aeronaves">{aeronavesUnicas.map(a => <option key={a} value={a}/>)}</datalist>
            </div>
            <button onClick={handleSubmit} style={{ ...btnPrimary, marginTop: 20, width: "100%" }}>Registrar</button>
          </div>
        )}

        {tab === "estadisticas" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {["16", "17"].map(cis => (
              <div key={cis} style={{ background: "#1e293b", padding: 20, borderRadius: 6, border: "1px solid #334155" }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Cisterna {cis}</div>
                <div style={{ fontSize: 24, color: COLOR_SALDO }}>{formatNum(saldoCisterna(cis))} L</div>
              </div>
            ))}
            <div style={{ background: "#1e293b", padding: 20, borderRadius: 6, border: "1px solid #334155" }}>
              <Label>Anotaciones de Novedades (Bitácora Diaria)</Label>
              <textarea value={novedades} onChange={(e) => saveNovedades(e.target.value)} placeholder="Registrar incidencias..." style={{ ...inputStyle, height: "120px", marginTop: 10, resize: "vertical" }} />
            </div>
          </div>
        )}

        {tab === "historial" && (
           <div style={{ background: "#1e293b", borderRadius: 6, padding: 20 }}>
             {sortedDates.map(f => (
               <div key={f} style={{ marginBottom: 10 }}>
                 <div style={{ fontSize: 12, color: "#64748b", marginBottom: 5 }}>{f}</div>
                 {grouped[f].map(r => (
                   <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: 8, borderTop: "1px solid #334155" }}>
                     <span>{r.matriculaAeronave || "RECARGA"}</span><span>{formatNum(r.litros)} L</span>
                     <button onClick={() => handleDelete(r.id)} style={{ background: "none", border: "none", color: "#ef4444" }}>×</button>
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

      {/* --- INTERFAZ FLOTANTE DEL CHATBOT --- */}
      <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 1000, fontFamily: "sans-serif" }}>
        {/* Botón FAB CORREGIDO */}
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#2563eb", border: "none", color: "#fff", fontSize: "24px", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", outline: "none" }}
        >
          {isChatOpen ? "×" : "💬"}
        </button>

        {/* Ventana de Chat Overlay */}
        {isChatOpen && (
          <div style={{ position: "absolute", bottom: "70px", right: "0", width: "340px", height: "420px", background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Encabezado */}
            <div style={{ background: "#0f172a", padding: "12px 16px", borderBottom: "1px solid #334155", fontSize: "13px", fontWeight: 700, letterSpacing: "1px", color: "#94a3b8" }}>
              ASISTENTE LOGÍSTICO LOCAL A-4
            </div>
            
            {/* Contenedor de mensajes CORREGIDO */}
            <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", background: "#0f172a" }}>
              {chatMessages.map(m => (
                <div key={m.id} style={{ alignSelf: m.sender === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.sender === "user" ? "#2563eb" : "#1e293b", color: "#fff", padding: "8px 12px", borderRadius: "6px", fontSize: "12px", whiteSpace: "pre-line", border: m.sender === "bot" ? "1px solid #334155" : "none" }}>
                  {m.text}
                </div>
              ))}
            </div>

            {/* Input de comandos */}
            <form onSubmit={handleSendChat} style={{ padding: "8px", borderTop: "1px solid #334155", display: "flex", gap: "6px", background: "#1e293b" }}>
              <input 
                type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                placeholder="Ej: 'consumo total', 'mayo 2026'..." 
                style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: "4px", color: "#fff", padding: "8px", fontSize: "12px", outline: "none" }}
              />
              <button type="submit" style={{ background: "#2563eb", color: "#fff", border: "none", padding: "0 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}>Enviar</button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}

const Label = ({ children }) => <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>{children}</div>;
const inputStyle = { width: "100%", padding: "10px", background: "#0f172a", border: "1px solid #334155", color: "#fff", boxSizing: "border-box", borderRadius: 4 };
const btnPrimary = { padding: "10px", background: "#2563eb", border: "none", color: "#fff", cursor: "pointer", borderRadius: 4, fontWeight: 600 };
const btnGhost = { padding: "10px", background: "transparent", border: "1px solid #475569", color: "#fff", cursor: "pointer", borderRadius: 4 };