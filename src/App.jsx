import { useState, useEffect } from "react";

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
  "16": { nombre: "Cisterna 16", proveedor: "ASA COZUMEL", color: "#3b82f6", icon: "🔵" },
  "17": { nombre: "Cisterna 17", proveedor: "Grupo Mundo Maya Campeche", color: "#f59e0b", icon: "🟡", ubicacion: "Escárcega" },
};

export default function App() {
  const [records, setRecords] = useState([]);
  const [saldos, setSaldos] = useState({ "16": "", "17": "" });
  const [saldosSaved, setSaldosSaved] = useState({ "16": null, "17": null });
  const [form, setForm] = useState(emptyForm("16"));
  const [tab, setTab] = useState("registro");
  const [msg, setMsg] = useState(null);
  const [editSaldo, setEditSaldo] = useState(null);

  useEffect(() => {
    const recs = localStorage.getItem("turbo-records");
    const inits = localStorage.getItem("turbo-iniciales");
    if (recs) setRecords(JSON.parse(recs));
    if (inits) {
      const parsed = JSON.parse(inits);
      setSaldosSaved(parsed);
      setSaldos({ "16": parsed["16"] ?? "", "17": parsed["17"] ?? "" });
    }
  }, []);

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
    flash(`Saldo inicial de Cisterna ${cis} guardado ✓`, "ok");
  };

  const handleSubmit = () => {
    if (!form.litros || isNaN(parseFloat(form.litros))) return flash("Ingresa los litros", "error");
    if (form.tipo === "despacho" && !form.matriculaAeronave.trim())
      return flash("Ingresa la matrícula de la aeronave", "error");
    const newRec = { ...form, id: Date.now(), litros: parseFloat(form.litros) };
    saveRecs([...records, newRec]);
    setForm(emptyForm(form.cisterna));
    flash("Movimiento registrado ✓", "ok");
  };

  const handleDelete = (id) => {
    if (!confirm("¿Eliminar este registro?")) return;
    saveRecs(records.filter((r) => r.id !== id));
  };

  const flash = (text, type) => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  };

  const exportCSV = () => {
    const headers = ["Fecha", "Cisterna", "Proveedor/Ubicación", "Tipo", "Litros", "Aeronave", "Tipo Operación", "Notas"];
    const rows = records.map((r) => [
      r.fecha,
      `Cisterna ${r.cisterna}`,
      CISTERNAS[r.cisterna].proveedor,
      r.tipo === "despacho" ? "Despacho" : r.tipo === "recarga" ? `Recarga (${CISTERNAS[r.cisterna].proveedor})` : "Ajuste",
      r.tipo === "despacho" ? -r.litros : r.litros,
      r.matriculaAeronave || "",
      r.tipoOperacion || "",
      r.notas || "",
    ]);

    const desp16 = records.filter(r => r.cisterna === "16" && r.tipo === "despacho").reduce((a, r) => a + r.litros, 0);
    const desp17 = records.filter(r => r.cisterna === "17" && r.tipo === "despacho").reduce((a, r) => a + r.litros, 0);
    const rec16 = records.filter(r => r.cisterna === "16" && r.tipo === "recarga").reduce((a, r) => a + r.litros, 0);
    const rec17 = records.filter(r => r.cisterna === "17" && r.tipo === "recarga").reduce((a, r) => a + r.litros, 0);

    const summary = [
      [],
      ["=== CUENTA COMPROBADA MENSUAL ==="],
      [],
      ["", "CISTERNA 16 (ASA COZUMEL)", "CISTERNA 17 (G. MUNDO MAYA - ESCÁRCEGA)", "TOTAL"],
      ["Saldo Inicial", saldosSaved["16"] || 0, saldosSaved["17"] || 0, (saldosSaved["16"] || 0) + (saldosSaved["17"] || 0)],
      ["Recargas", rec16, rec17, rec16 + rec17],
      ["Despachos", -desp16, -desp17, -(desp16 + desp17)],
      ["Saldo Final", saldo16, saldo17, saldoTotal],
    ];

    const all = [headers, ...rows, ...summary];
    const csv = all.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const mes = new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    a.download = `Turbosina_${mes}.csv`;
    a.click();
    flash("Archivo descargado. Ábrelo con Excel ✓", "ok");
  };

  const exportBackup = () => {
    const backup = {
      version: 1,
      fecha: new Date().toISOString(),
      saldosIniciales: saldosSaved,
      registros: records,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
    a.download = `Turbosina_Backup_${ts}.json`;
    a.click();
    flash("Copia de seguridad descargada ✓", "ok");
  };

  const importBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.registros || !data.saldosIniciales) throw new Error("Formato invalido");
        if (!confirm(`Se restauraran ${data.registros.length} registros. Los datos actuales seran reemplazados. Continuar?`)) return;
        saveRecs(data.registros);
        setSaldosSaved(data.saldosIniciales);
        setSaldos({ "16": data.saldosIniciales["16"] ?? "", "17": data.saldosIniciales["17"] ?? "" });
        localStorage.setItem("turbo-iniciales", JSON.stringify(data.saldosIniciales));
        flash(`Backup restaurado: ${data.registros.length} registros cargados ✓`, "ok");
      } catch (_) {
        flash("Archivo invalido. Usa un backup generado por esta app.", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Agrupado por fecha
  const grouped = records.reduce((acc, r) => {
    if (!acc[r.fecha]) acc[r.fecha] = [];
    acc[r.fecha].push(r);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const needsSetup = saldosSaved["16"] === null || saldosSaved["17"] === null;

  return (
    <div style={{ minHeight: "100vh", background: "#070d1a", color: "#e2e8f0", fontFamily: "'Courier New', monospace" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0a1628 0%, #0f2147 100%)", borderBottom: "2px solid #1e3a8a", padding: "18px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 30 }}>✈️</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, color: "#60a5fa" }}>CONTROL DE TURBOSINA</div>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: 1 }}>CISTERNA 16 · CISTERNA 17 · REGISTRO DIARIO</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: 1 }}>INVENTARIO TOTAL</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: saldoTotal < 10000 ? "#ef4444" : "#22c55e" }}>
              {formatNum(saldoTotal)} L
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 16px" }}>

        {/* Setup saldos iniciales */}
        {(needsSetup || editSaldo) && (
          <div style={{ background: "#1c1f2e", border: "1px solid #f59e0b", borderRadius: 10, padding: 18, marginBottom: 18 }}>
            <div style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, marginBottom: 14 }}>
              ⚠ CONFIGURA LOS SALDOS INICIALES DEL MES
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {["16", "17"].map((cis) => (
                <div key={cis}>
                  <div style={{ fontSize: 11, color: CISTERNAS[cis].color, marginBottom: 6, fontWeight: 700 }}>
                    {CISTERNAS[cis].icon} {CISTERNAS[cis].nombre} — {CISTERNAS[cis].proveedor}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="number"
                      value={saldos[cis]}
                      onChange={e => setSaldos({ ...saldos, [cis]: e.target.value })}
                      placeholder="Litros iniciales"
                      style={inputStyle}
                    />
                    <button onClick={() => handleSaveInicial(cis)} style={btnPrimary}>
                      {saldosSaved[cis] !== null ? "✓" : "Guardar"}
                    </button>
                  </div>
                  {saldosSaved[cis] !== null && (
                    <div style={{ fontSize: 10, color: "#22c55e", marginTop: 4 }}>✓ Guardado: {formatNum(saldosSaved[cis])} L</div>
                  )}
                </div>
              ))}
            </div>
            {editSaldo && (
              <button onClick={() => setEditSaldo(null)} style={{ ...btnGhost, marginTop: 12, fontSize: 11 }}>Cerrar</button>
            )}
          </div>
        )}

        {/* KPI Cards por cisterna + total */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          {["16", "17"].map(cis => {
            const s = saldoCisterna(cis);
            const desp = records.filter(r => r.cisterna === cis && r.tipo === "despacho").reduce((a, r) => a + r.litros, 0);
            const rec = records.filter(r => r.cisterna === cis && r.tipo === "recarga").reduce((a, r) => a + r.litros, 0);
            return (
              <div key={cis} style={{ background: "#111827", borderRadius: 10, padding: 16, border: `1px solid ${CISTERNAS[cis].color}44` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: CISTERNAS[cis].color, fontWeight: 700, letterSpacing: 1 }}>
                    {CISTERNAS[cis].icon} CISTERNA {cis}
                  </span>
                  <button onClick={() => setEditSaldo(cis)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 10 }}>✎ editar</button>
                </div>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>{CISTERNAS[cis].proveedor}</div>
                {CISTERNAS[cis].ubicacion && <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 8 }}>📍 {CISTERNAS[cis].ubicacion}</div>}
                <div style={{ fontSize: 20, fontWeight: 700, color: s < 3000 ? "#ef4444" : s < 8000 ? "#f59e0b" : "#22c55e", marginBottom: 8 }}>
                  {formatNum(s)} L
                </div>
                <div style={{ display: "flex", gap: 8, fontSize: 10 }}>
                  <span style={{ color: "#34d399" }}>+{formatNum(rec)} L</span>
                  <span style={{ color: "#6b7280" }}>|</span>
                  <span style={{ color: "#f87171" }}>−{formatNum(desp)} L</span>
                </div>
              </div>
            );
          })}
          {/* Total */}
          <div style={{ background: "#111827", borderRadius: 10, padding: 16, border: "1px solid #7c3aed44" }}>
            <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>⚡ TOTAL CONSOLIDADO</div>
            <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 8 }}>Ambas cisternas</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: saldoTotal < 10000 ? "#ef4444" : "#22c55e", marginBottom: 8 }}>
              {formatNum(saldoTotal)} L
            </div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>
              Inicial: {formatNum((saldosSaved["16"] || 0) + (saldosSaved["17"] || 0))} L
            </div>
          </div>
        </div>

        {/* Flash */}
        {msg && (
          <div style={{
            background: msg.type === "ok" ? "#14532d" : "#7f1d1d",
            border: `1px solid ${msg.type === "ok" ? "#22c55e" : "#ef4444"}`,
            borderRadius: 8, padding: "10px 16px", marginBottom: 14, fontSize: 12,
            color: msg.type === "ok" ? "#86efac" : "#fca5a5"
          }}>{msg.text}</div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 18, background: "#111827", borderRadius: 10, padding: 4 }}>
          {[["registro", "📝 Nuevo Registro"], ["historial", "📋 Historial"], ["exportar", "📊 Exportar"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: "9px 0", borderRadius: 7, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700, letterSpacing: 1, fontFamily: "'Courier New', monospace",
              background: tab === key ? "#1d4ed8" : "transparent",
              color: tab === key ? "#fff" : "#475569", transition: "all 0.2s"
            }}>{label}</button>
          ))}
        </div>

        {/* TAB: Registro */}
        {tab === "registro" && (
          <div style={{ background: "#111827", borderRadius: 12, padding: 22, border: "1px solid #1f2937" }}>
            <div style={{ fontSize: 11, color: "#6b7280", letterSpacing: 2, marginBottom: 18, fontWeight: 700 }}>NUEVO MOVIMIENTO</div>

            {/* Selector cisterna */}
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              {["16", "17"].map(cis => (
                <button key={cis} onClick={() => setForm({ ...form, cisterna: cis, tipo: "despacho" })} style={{
                  flex: 1, padding: "10px 0", borderRadius: 8, border: `2px solid ${form.cisterna === cis ? CISTERNAS[cis].color : "#1f2937"}`,
                  background: form.cisterna === cis ? `${CISTERNAS[cis].color}22` : "#0f172a",
                  color: form.cisterna === cis ? CISTERNAS[cis].color : "#475569",
                  cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: 1,
                  fontFamily: "'Courier New', monospace", transition: "all 0.2s"
                }}>
                  {CISTERNAS[cis].icon} CISTERNA {cis}<br />
                  <span style={{ fontSize: 9, fontWeight: 400 }}>{CISTERNAS[cis].proveedor}</span>
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <Label>Fecha</Label>
                <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <Label>Tipo de Movimiento</Label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
                  <option value="despacho">⛽ Despacho a aeronave</option>
                  <option value="recarga">🔄 Recarga — {CISTERNAS[form.cisterna].proveedor}</option>
                  <option value="ajuste">📋 Ajuste / Corrección</option>
                </select>
              </div>

              <div>
                <Label>Litros</Label>
                <input type="number" value={form.litros} onChange={e => setForm({ ...form, litros: e.target.value })} placeholder="0.00" style={inputStyle} />
              </div>

              {form.tipo === "despacho" && (
                <>
                  <div>
                    <Label>Matrícula Aeronave</Label>
                    <input type="text" value={form.matriculaAeronave} onChange={e => setForm({ ...form, matriculaAeronave: e.target.value.toUpperCase() })} placeholder="Ej: XA-XYZ" style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Label>Tipo de Operación</Label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {OP_TYPES.map(t => (
                        <button key={t} onClick={() => setForm({ ...form, tipoOperacion: t })} style={{
                          padding: "6px 14px", borderRadius: 6, border: `1px solid ${form.tipoOperacion === t ? "#3b82f6" : "#1f2937"}`,
                          background: form.tipoOperacion === t ? "#1d4ed8" : "#0f172a",
                          color: form.tipoOperacion === t ? "#fff" : "#475569",
                          cursor: "pointer", fontSize: 11, fontFamily: "'Courier New', monospace"
                        }}>{t}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div style={{ gridColumn: "1 / -1" }}>
                <Label>Notas (opcional)</Label>
                <input type="text" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones..." style={inputStyle} />
              </div>
            </div>

            <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
              <button onClick={handleSubmit} style={btnPrimary}>Registrar Movimiento</button>
              <button onClick={() => setForm(emptyForm(form.cisterna))} style={btnGhost}>Limpiar</button>
            </div>
          </div>
        )}

        {/* TAB: Historial */}
        {tab === "historial" && (
          <div>
            {/* Filtro visual por cisterna (informativo) */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              {["16", "17"].map(cis => {
                const count = records.filter(r => r.cisterna === cis).length;
                return (
                  <div key={cis} style={{ background: "#111827", border: `1px solid ${CISTERNAS[cis].color}44`, borderRadius: 8, padding: "8px 14px", fontSize: 11, color: CISTERNAS[cis].color }}>
                    {CISTERNAS[cis].icon} Cisterna {cis}: <strong>{count}</strong> mov.
                  </div>
                );
              })}
            </div>

            {sortedDates.length === 0 && (
              <div style={{ textAlign: "center", color: "#374151", padding: 40, fontSize: 13 }}>
                No hay registros aún.
              </div>
            )}
            {sortedDates.map(fecha => (
              <div key={fecha} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, color: "#60a5fa", letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>
                  📅 {new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).toUpperCase()}
                </div>
                <div style={{ background: "#111827", borderRadius: 10, overflow: "hidden", border: "1px solid #1f2937" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#0a0f1e", color: "#4b5563" }}>
                        <th style={th}>Cisterna</th>
                        <th style={th}>Tipo</th>
                        <th style={th}>Litros</th>
                        <th style={th}>Aeronave</th>
                        <th style={th}>Operación</th>
                        <th style={th}>Notas</th>
                        <th style={th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[fecha].map((r) => (
                        <tr key={r.id} style={{ borderTop: "1px solid #1f2937" }}>
                          <td style={td}>
                            <span style={{ color: CISTERNAS[r.cisterna]?.color, fontWeight: 700 }}>
                              {CISTERNAS[r.cisterna]?.icon} C-{r.cisterna}
                            </span>
                          </td>
                          <td style={td}>
                            <span style={{
                              background: r.tipo === "despacho" ? "#7f1d1d" : r.tipo === "recarga" ? "#14532d" : "#1e3a5f",
                              color: r.tipo === "despacho" ? "#fca5a5" : r.tipo === "recarga" ? "#86efac" : "#93c5fd",
                              padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700
                            }}>
                              {r.tipo === "despacho" ? "⛽ DESPACHO" : r.tipo === "recarga" ? "🔄 RECARGA" : "📋 AJUSTE"}
                            </span>
                          </td>
                          <td style={{ ...td, fontWeight: 700, color: r.tipo === "despacho" ? "#f87171" : "#34d399" }}>
                            {r.tipo === "despacho" ? "−" : "+"}{formatNum(r.litros)} L
                          </td>
                          <td style={td}>{r.matriculaAeronave || "—"}</td>
                          <td style={td}>{r.tipoOperacion || "—"}</td>
                          <td style={{ ...td, color: "#6b7280", fontSize: 11 }}>{r.notas || "—"}</td>
                          <td style={td}>
                            <button onClick={() => handleDelete(r.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
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

        {/* TAB: Exportar */}
        {tab === "exportar" && (
          <div style={{ background: "#111827", borderRadius: 12, padding: 24, border: "1px solid #1f2937" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#60a5fa", letterSpacing: 1 }}>CUENTA COMPROBADA MENSUAL</div>
              <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>Ambas cisternas · Exporta para Excel</div>
            </div>

            {/* Tabla resumen */}
            <div style={{ background: "#0a0f1e", borderRadius: 10, overflow: "hidden", marginBottom: 20, border: "1px solid #1f2937" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#0f172a" }}>
                    <th style={th}></th>
                    <th style={{ ...th, color: CISTERNAS["16"].color }}>🔵 CISTERNA 16</th>
                    <th style={{ ...th, color: CISTERNAS["17"].color }}>🟡 CISTERNA 17</th>
                    <th style={{ ...th, color: "#a78bfa" }}>⚡ TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Proveedor", "ASA COZUMEL", "G. MUNDO MAYA", "—"],
                    ["Saldo Inicial", formatNum(saldosSaved["16"] || 0) + " L", formatNum(saldosSaved["17"] || 0) + " L", formatNum((saldosSaved["16"] || 0) + (saldosSaved["17"] || 0)) + " L"],
                    ["Recargas",
                      "+" + formatNum(records.filter(r => r.cisterna === "16" && r.tipo === "recarga").reduce((a, r) => a + r.litros, 0)) + " L",
                      "+" + formatNum(records.filter(r => r.cisterna === "17" && r.tipo === "recarga").reduce((a, r) => a + r.litros, 0)) + " L",
                      "+" + formatNum(records.filter(r => r.tipo === "recarga").reduce((a, r) => a + r.litros, 0)) + " L",
                    ],
                    ["Despachado",
                      "−" + formatNum(records.filter(r => r.cisterna === "16" && r.tipo === "despacho").reduce((a, r) => a + r.litros, 0)) + " L",
                      "−" + formatNum(records.filter(r => r.cisterna === "17" && r.tipo === "despacho").reduce((a, r) => a + r.litros, 0)) + " L",
                      "−" + formatNum(records.filter(r => r.tipo === "despacho").reduce((a, r) => a + r.litros, 0)) + " L",
                    ],
                    ["Saldo Final", formatNum(saldo16) + " L", formatNum(saldo17) + " L", formatNum(saldoTotal) + " L"],
                  ].map(([label, c16, c17, tot], i) => (
                    <tr key={i} style={{ borderTop: "1px solid #1f2937", background: i === 4 ? "#0f172a" : "transparent" }}>
                      <td style={{ ...td, color: "#6b7280", fontWeight: 700, fontSize: 10, letterSpacing: 1 }}>{label}</td>
                      <td style={{ ...td, color: CISTERNAS["16"].color }}>{c16}</td>
                      <td style={{ ...td, color: CISTERNAS["17"].color }}>{c17}</td>
                      <td style={{ ...td, color: "#a78bfa", fontWeight: 700 }}>{tot}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: "center" }}>
              <button onClick={exportCSV} style={{ ...btnPrimary, fontSize: 13, padding: "12px 32px" }}>
                ⬇ Descargar CSV para Excel
              </button>
              <div style={{ fontSize: 10, color: "#374151", marginTop: 10 }}>
                En Excel: Datos → Desde texto/CSV → selecciona coma como delimitador
              </div>
            </div>

            {/* Backup & Restore */}
            <div style={{ marginTop: 24, borderTop: "1px solid #1f2937", paddingTop: 20 }}>
              <div style={{ fontSize: 11, color: "#6b7280", letterSpacing: 2, fontWeight: 700, marginBottom: 14 }}>
                🛡 COPIA DE SEGURIDAD
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#0a0f1e", borderRadius: 10, padding: 16, border: "1px solid #1f2937" }}>
                  <div style={{ fontSize: 12, color: "#34d399", fontWeight: 700, marginBottom: 6 }}>⬇ Exportar Backup</div>
                  <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 12 }}>
                    Guarda todos tus registros y saldos en un archivo .json. Úsalo para restaurar si cambias de dispositivo o limpias el navegador.
                  </div>
                  <button onClick={exportBackup} style={{ ...btnPrimary, background: "#065f46", width: "100%", fontSize: 11 }}>
                    Descargar Backup .json
                  </button>
                </div>
                <div style={{ background: "#0a0f1e", borderRadius: 10, padding: 16, border: "1px solid #1f2937" }}>
                  <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700, marginBottom: 6 }}>⬆ Restaurar Backup</div>
                  <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 12 }}>
                    Carga un archivo de backup para recuperar tus datos. Reemplazará los registros actuales.
                  </div>
                  <label style={{ ...btnPrimary, background: "#78350f", display: "block", textAlign: "center", cursor: "pointer", fontSize: 11, padding: "10px 20px" }}>
                    Cargar Backup .json
                    <input type="file" accept=".json" onChange={importBackup} style={{ display: "none" }} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const Label = ({ children }) => (
  <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: 1.5, marginBottom: 6, fontWeight: 700 }}>{children}</div>
);

const inputStyle = {
  width: "100%", background: "#0a0f1e", border: "1px solid #1f2937", borderRadius: 7,
  color: "#e2e8f0", padding: "9px 12px", fontSize: 12, fontFamily: "'Courier New', monospace",
  outline: "none", boxSizing: "border-box"
};

const btnPrimary = {
  background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 7,
  padding: "10px 20px", cursor: "pointer", fontWeight: 700, fontSize: 11,
  letterSpacing: 1, fontFamily: "'Courier New', monospace"
};

const btnGhost = {
  background: "transparent", color: "#4b5563", border: "1px solid #1f2937",
  borderRadius: 7, padding: "10px 20px", cursor: "pointer", fontSize: 11,
  letterSpacing: 1, fontFamily: "'Courier New', monospace"
};

const th = { padding: "10px 12px", textAlign: "left", fontSize: 10, letterSpacing: 1.5, fontWeight: 700, color: "#4b5563" };
const td = { padding: "10px 12px", color: "#9ca3af" };