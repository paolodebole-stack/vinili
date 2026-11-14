import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, CircleHelp, Download, FileUp, LoaderCircle, Play, RotateCcw, Save, Search, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseCatalogFile } from './importCatalog';
import { supabase } from './supabase';
import './vinili-discovery.css';

const STORAGE_PREFIX = 'vinili-discovery-v1:';
const categoryLabel = (value) => value === true ? 'SÌ' : value === false ? 'NO' : 'DA VERIFICARE';
const categoryClass = (value) => value === true ? 'yes' : value === false ? 'no' : 'unknown';

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function resultLabel(result) {
  if (!result) return 'In attesa';
  if (result.status === 'matched') return 'Verificato';
  if (result.status === 'not_found') return 'Non trovato';
  if (result.status === 'needs_review') return 'Da verificare';
  return 'Errore';
}

export default function ViniliDiscovery({ user }) {
  const storageKey = STORAGE_PREFIX + (user?.id || 'guest');
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sessionName, setSessionName] = useState('Nuova ricerca');
  const [savedAt, setSavedAt] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && Array.isArray(saved.rows)) {
        setRows(saved.rows);
        setFileName(saved.fileName || '');
        setSessionName(saved.sessionName || 'Ricerca ripresa');
        setSavedAt(saved.savedAt || '');
        setNotice('Sessione precedente ripristinata. Puoi continuare o riprovare i brani non verificati.');
      }
    } catch (e) {
      console.warn('VINILI DISCOVERY: sessione locale non leggibile', e);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!rows.length) return;
    const timestamp = new Date().toISOString();
    try {
      localStorage.setItem(storageKey, JSON.stringify({ rows, fileName, sessionName, savedAt: timestamp }));
      setSavedAt(timestamp);
    } catch (e) {
      console.warn('VINILI DISCOVERY: salvataggio sessione non riuscito', e);
    }
  }, [rows, fileName, sessionName, storageKey]);

  const completed = useMemo(() => rows.filter((row) => row.result).length, [rows]);
  const verified = useMemo(() => rows.filter((row) => row.result?.status === 'matched').length, [rows]);
  const unresolved = useMemo(() => rows.filter((row) => !row.result || row.result.status !== 'matched').length, [rows]);

  async function importFile(file) {
    if (!file) return;
    setParsing(true); setError(''); setNotice(''); setRows([]);
    try {
      const parsed = await parseCatalogFile(file);
      const prepared = parsed.map((item) => ({
        id: makeId(),
        artist: item.artist || '',
        title: item.title || '',
        selected: true,
        result: null,
        error: '',
        sourceLine: item._sourceLine || '',
      }));
      if (!prepared.length) throw new Error('Nel file non ho trovato brani. Controlla il contenuto e riprova.');
      setRows(prepared);
      setFileName(file.name);
      setSessionName(file.name.replace(/\\.[^.]+$/, '') || 'Nuova ricerca');
      setNotice(`Importati ${prepared.length} brani. Controlla e correggi artista e titolo prima di avviare la ricerca.`);
    } catch (e) {
      setError(e?.message || 'Non sono riuscito a leggere il file.');
    } finally {
      setParsing(false);
    }
  }

  function updateRow(id, key, value) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [key]: value, ...(key === 'artist' || key === 'title' ? { result: null, error: '' } : {}) } : row));
  }

  function removeRow(id) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function addBlankRow() {
    setRows((current) => [...current, { id: makeId(), artist: '', title: '', selected: true, result: null, error: '', sourceLine: '' }]);
  }

  async function searchRows(retryOnly = false) {
    if (running) return;
    const queue = rows.filter((row) => row.selected && row.artist.trim() && row.title.trim() &&
      (retryOnly ? (!row.result || row.result.status !== 'matched' || row.error) : !row.result && !row.error));
    if (!queue.length) {
      setError(retryOnly ? 'Non ci sono brani selezionati da riprovare.' : 'Seleziona almeno un brano con artista e titolo compilati.');
      return;
    }
    setRunning(true); setError(''); setNotice('');
    let done = 0;
    for (const row of queue) {
      setProgress(`Controllo ${done + 1} di ${queue.length}: ${row.artist} — ${row.title}`);
      try {
        const { data, error: invokeError } = await supabase.functions.invoke('vinili-discovery', {
          body: { artist: row.artist.trim(), title: row.title.trim() }
        });
        if (invokeError) {
          let message = invokeError.message || 'Errore durante la chiamata a Discogs.';
          if (invokeError.context?.json) {
            try { const body = await invokeError.context.json(); message = body.error || message; } catch {}
          }
          throw new Error(message);
        }
        if (!data || data.error) throw new Error(data?.error || 'Risposta non valida dal servizio Discogs.');
        setRows((current) => current.map((item) => item.id === row.id ? { ...item, result: data, error: '' } : item));
      } catch (e) {
        const message = e?.message || 'Ricerca non riuscita.';
        setRows((current) => current.map((item) => item.id === row.id ? { ...item, error: message } : item));
        if (/429|limite temporaneo|rate.?limit/i.test(message)) {
          setNotice('Discogs ha imposto un limite temporaneo. I risultati già ottenuti sono stati salvati: attendi qualche minuto e riprendi la ricerca.');
          break;
        }
      }
      done += 1;
    }
    setProgress('');
    setRunning(false);
    setNotice((current) => current || 'Ricerca terminata. I risultati sono stati salvati in questa sessione; puoi esportarli o riprovare quelli da verificare.');
  }

  function exportWorkbook() {
    if (!rows.length) return;
    const summary = rows.map((row) => ({
      Artista: row.artist,
      Brano: row.title,
      VINILE: categoryLabel(row.result?.vinyl),
      CD: categoryLabel(row.result?.cd),
      DIGITALE: categoryLabel(row.result?.digital),
      Esito: row.error ? 'Errore / da riprovare' : resultLabel(row.result),
      'Messaggio': row.error || row.result?.message || '',
    }));
    const details = rows.flatMap((row) => (row.result?.matches || []).map((match) => ({
      Artista: row.artist,
      Brano: row.title,
      Pubblicazione: match.title || '',
      Formati: (match.formats || []).join(', '),
      Anno: match.year || '',
      Paese: match.country || '',
      Etichette: (match.labels || []).join('; '),
      Discogs: match.url || '',
    })));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(summary), 'Risultati');
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(details.length ? details : [{ Nota: 'Nessuna pubblicazione confermata finora.' }]), 'Pubblicazioni');
    XLSX.writeFile(book, `vinili-discovery-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function clearSession() {
    if (!window.confirm('Vuoi cancellare questa sessione e tutti i risultati salvati su questo dispositivo?')) return;
    localStorage.removeItem(storageKey);
    setRows([]); setFileName(''); setSessionName('Nuova ricerca'); setSavedAt('');
    setError(''); setNotice('Sessione cancellata.');
  }

  return <section className="vd-page">
    <div className="vd-heading">
      <div><span className="vd-eyebrow">RICERCA DISCOGRAFICA · DISCOVERY</span><h1>Vinili Discovery<span>.</span></h1>
        <p>Importa una lista di brani e verifica su Discogs in quali pubblicazioni sono presenti: vinile, CD e digitale. Non modifica il catalogo né la tua collezione.</p>
      </div>
      <div className="vd-heading-icon"><Search size={28}/></div>
    </div>

    <div className="vd-upload-panel">
      <div className="vd-upload-copy"><FileUp size={21}/><div><b>Importa la lista dei brani</b><span>Word, Excel, PDF, CSV o TXT. Puoi correggere ogni riga prima della ricerca.</span></div></div>
      <label className="vd-file-button">{parsing ? <LoaderCircle size={16} className="vd-spin"/> : <FileUp size={16}/>} {parsing ? 'Lettura file…' : 'Scegli file'}<input type="file" accept=".docx,.xlsx,.xls,.csv,.txt,.pdf" disabled={parsing || running} onChange={(e) => importFile(e.target.files?.[0])}/></label>
    </div>

    <div className="vd-session-bar">
      <label>Nome sessione<input value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Es. Brani da verificare"/></label>
      <div className="vd-session-meta">{savedAt ? `Salvataggio locale: ${new Date(savedAt).toLocaleString('it-IT')}` : 'Sessione non ancora salvata'}</div>
    </div>

    {rows.length > 0 && <>
      <div className="vd-stats">
        <div><span>BRANI IN LISTA</span><b>{rows.length}</b></div>
        <div><span>CONTROLLATI</span><b>{completed}</b></div>
        <div><span>VERIFICATI</span><b>{verified}</b></div>
        <div><span>DA COMPLETARE</span><b>{unresolved}</b></div>
      </div>

      <div className="vd-toolbar">
        <div><b>Anteprima e risultati</b><span>{fileName || 'Elenco manuale'} · {rows.length} righe</span></div>
        <div className="vd-actions">
          <button type="button" className="vd-secondary" onClick={addBlankRow} disabled={running}>+ Aggiungi brano</button>
          <button type="button" className="vd-primary" onClick={() => searchRows(false)} disabled={running || !rows.some((r) => r.selected && r.artist.trim() && r.title.trim() && !r.result && !r.error)}>{running ? <LoaderCircle size={16} className="vd-spin"/> : <Play size={16}/>} Avvia ricerca</button>
          <button type="button" className="vd-secondary" onClick={() => searchRows(true)} disabled={running || !rows.some((r) => r.selected && r.artist.trim() && r.title.trim() && (!r.result || r.result.status !== 'matched' || r.error))}><RotateCcw size={15}/> Riprova non verificati</button>
          <button type="button" className="vd-secondary" onClick={exportWorkbook}><Download size={15}/> Esporta Excel</button>
        </div>
      </div>

      {progress && <div className="vd-progress"><LoaderCircle size={17} className="vd-spin"/><span>{progress}</span></div>}
      <div className="vd-table-wrap"><table className="vd-table"><thead><tr><th>Usa</th><th>Artista</th><th>Brano</th><th>VINILE</th><th>CD</th><th>DIGITALE</th><th>Esito</th><th></th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <td><input type="checkbox" checked={row.selected} onChange={(e) => updateRow(row.id, 'selected', e.target.checked)} aria-label="Seleziona brano" disabled={running}/></td>
          <td><input className="vd-edit" value={row.artist} onChange={(e) => updateRow(row.id, 'artist', e.target.value)} placeholder="Artista" disabled={running}/></td>
          <td><input className="vd-edit" value={row.title} onChange={(e) => updateRow(row.id, 'title', e.target.value)} placeholder="Titolo brano" disabled={running}/></td>
          {['vinyl','cd','digital'].map((key) => <td key={key}><span className={`vd-result ${categoryClass(row.result?.[key])}`}>{categoryLabel(row.result?.[key])}</span></td>)}
          <td><span className={`vd-status ${row.error ? 'error' : row.result?.status || 'pending'}`}>{row.error ? 'Errore' : resultLabel(row.result)}</span>{row.error && <small className="vd-row-error">{row.error}</small>}{row.result?.message && <small className="vd-row-error">{row.result.message}</small>}</td>
          <td><button type="button" className="vd-remove" onClick={() => removeRow(row.id)} disabled={running} title="Rimuovi riga"><Trash2 size={15}/></button></td>
        </tr>)}</tbody></table></div>
      <div className="vd-foot-actions"><button type="button" className="vd-secondary" onClick={clearSession} disabled={running}><Trash2 size={15}/> Cancella sessione</button><span><Save size={14}/> La sessione viene salvata automaticamente su questo dispositivo.</span></div>
    </>}

    {!rows.length && <div className="vd-empty"><div><Search size={26}/></div><b>Nessuna lista caricata</b><p>Seleziona un documento per iniziare. Puoi anche aggiungere i brani manualmente dopo aver importato il primo file.</p></div>}

    {error && <div className="vd-alert error"><AlertCircle size={17}/>{error}</div>}
    {notice && <div className="vd-alert info"><CheckCircle2 size={17}/>{notice}</div>}
    <div className="vd-legend"><span><b>SÌ</b> = pubblicazione confermata nella tracklist</span><span><b>NO</b> = ricerca sufficientemente completa senza corrispondenza</span><span><b>DA VERIFICARE</b> = dati insufficienti o risultati ambigui</span></div>
  </section>;
}
