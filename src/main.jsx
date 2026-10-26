import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Disc3, Search, Plus, SlidersHorizontal, LogOut, Library, DiscAlbum,
  Music2, Users, Wallet, X, Check, LoaderCircle, Upload, Trash2,
  ArrowUpRight, Sparkles, CircleUserRound, Mail, LockKeyhole, ChevronDown,
  AlertCircle, RefreshCw, ImagePlus, Globe, Pencil, ArrowLeftRight, Send, Eye, EyeOff, MessageCircle, CheckCircle2, Clock3, Youtube
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from './supabase';
import { parseCatalogFile, normalizeCatalogText } from './importCatalog';
import './styles.css';

// Notifiche push VINILI: un errore di push non deve bloccare l'azione principale.
async function sendViniliPush(payload) {
  try {
    const { data, error } = await supabase.functions.invoke('vinili-push', { body: payload });
    if (error) console.warn('VINILI push non inviata:', error.message);
    return data ?? null;
  } catch (error) {
    console.warn('VINILI push non inviata:', error);
    return null;
  }
}

const CONDITION_OPTIONS = ['Mint (M)', 'Near Mint (NM)', 'Very Good Plus (VG+)', 'Very Good (VG)', 'Good (G)', 'Poor (P)'];
const FORMATS = ['Vinile', 'LP', '12"', '10"', '7"', '45 giri', '33 giri', 'EP', 'Box set'];

function friendlyError(error) {
  if (!error) return 'Si è verificato un errore. Riprova.';
  const message = error.message || String(error);
  if (/Invalid login credentials/i.test(message)) return 'Email o password non corretti.';
  if (/Email not confirmed/i.test(message)) return 'Conferma prima il tuo indirizzo email, poi accedi.';
  if (/duplicate key/i.test(message)) return 'Questo dato esiste già. Prova con un nome diverso.';
  if (/row-level security|permission denied/i.test(message)) return 'Permessi Supabase non ancora configurati. Segui la sezione “Prima di iniziare” nel file LEGGIMI.';
  return message;
}

function VinylDisc({ size = 'normal' }) {
  return <div className={`vinyl-disc ${size}`} aria-hidden="true"><div className="groove groove-one"/><div className="groove groove-two"/><div className="groove groove-three"/><div className="vinyl-label"><Disc3 size={size === 'large' ? 25 : 18}/></div></div>;
}

function Cover({ album, large = false }) {
  if (album?.cover_url) return <img className={`cover-image ${large ? 'cover-large' : ''}`} src={album.cover_url} alt={`Copertina di ${album.title}`} loading="lazy" />;
  return <div className={`cover-placeholder ${large ? 'cover-large' : ''}`}><VinylDisc size={large ? 'large' : 'normal'}/><span>{album?.title?.slice(0, 1)?.toUpperCase() || 'V'}</span></div>;
}

function YouTubeLink({ title, artist, compact = false, className = '' }) {
  const query = [title, artist].filter(Boolean).join(' ').trim();
  if (!query) return null;
  const href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  return <a className={`youtube-link${compact ? ' youtube-link-compact' : ''}${className ? ` ${className}` : ''}`} href={href} target="_blank" rel="noopener noreferrer" title={`Cerca ${query} su YouTube`} aria-label={`Cerca ${query} su YouTube`} onClick={(event) => event.stopPropagation()}><Youtube size={compact ? 14 : 16}/><span>{compact ? 'YouTube' : 'Ascolta su YouTube'}</span></a>;
}

function activateCardOnKey(event, action) {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); }
}

function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault(); setLoading(true); setError(''); setMessage('');
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: displayName.trim() || email.split('@')[0], username: email.split('@')[0] } }
        });
        if (authError) throw authError;
        if (data.session) setMessage('Account creato! Sei entrato nell’archivio.');
        else setMessage('Registrazione avviata: controlla la tua email e clicca sul link di conferma. Poi torna qui per accedere.');
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      }
    } catch (err) { setError(friendlyError(err)); }
    finally { setLoading(false); }
  }

  return <main className="auth-layout">
    <section className="auth-art">
      <div className="brand-lockup"><div className="brand-mark"><Disc3 size={27}/></div><span>VINILI<span className="brand-dot">.</span></span></div>
      <div className="hero-copy"><span className="eyebrow"><Sparkles size={14}/> IL TUO ARCHIVIO MUSICALE</span><h1>Ogni disco.<br/><em>Una storia.</em></h1><p>Catalogare, ricordare e condividere la passione per il vinile. Un disco alla volta.</p></div>
      <div className="hero-vinyl"><div className="hero-orbit orbit-a"/><div className="hero-orbit orbit-b"/><VinylDisc size="large"/><div className="hero-shine"/></div>
      <div className="auth-footnote"><span>UNA PASSIONE DA COLLEZIONARE</span><span>EST. 2026</span></div>
    </section>
    <section className="auth-panel">
      <div className="mobile-brand brand-lockup"><div className="brand-mark"><Disc3 size={24}/></div><span>VINILI<span className="brand-dot">.</span></span></div>
      <div className="auth-form-wrap"><span className="eyebrow">BENVENUTO NELL’ARCHIVIO</span><h2>{mode === 'login' ? 'Rientra nella tua collezione' : 'Crea il tuo spazio musicale'}</h2><p className="muted">{mode === 'login' ? 'Accedi per vedere i tuoi dischi e scoprire il catalogo.' : 'Registrati e inizia a catalogare i tuoi vinili.'}</p>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && <label>Come ti chiami?<div className="input-shell"><CircleUserRound size={18}/><input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Nome visualizzato" autoComplete="name"/></div></label>}
          <label>Email<div className="input-shell"><Mail size={18}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@email.com" autoComplete="email" required/></div></label>
          <label>Password<div className="input-shell"><LockKeyhole size={18}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Almeno 6 caratteri" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required/></div></label>
          {error && <div className="notice error"><AlertCircle size={17}/>{error}</div>}{message && <div className="notice success"><Check size={17}/>{message}</div>}
          <button className="primary-btn full-btn" disabled={loading}>{loading ? <LoaderCircle className="spin" size={18}/> : null}{mode === 'login' ? 'Accedi all’archivio' : 'Crea account'}<ArrowUpRight size={17}/></button>
        </form>
        <div className="auth-switch">{mode === 'login' ? 'Non hai ancora un account?' : 'Hai già un account?'} <button onClick={()=>{setMode(mode === 'login' ? 'signup' : 'login');setError('');setMessage('')}}>{mode === 'login' ? 'Registrati' : 'Accedi'}</button></div>
        <p className="auth-privacy">Le collezioni personali sono separate per ogni account.</p>
      </div>
      <div className="auth-bottom">CREATO PER CHI AMA ASCOLTARE DAVVERO.</div>
    </section>
  </main>;
}

function AddAlbumModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ title:'', artist:'', year:'', genre:'', format:'Vinile', label:'', catalog_number:'', release_year:'', country:'', edition:'', vinyl_condition:'Near Mint (NM)', sleeve_condition:'Very Good Plus (VG+)', purchase_price:'', estimated_value:'', purchase_date:'', notes:'' });
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (key, val) => setForm(prev => ({...prev, [key]:val}));

  async function save(e) {
    e.preventDefault(); setSaving(true); setError('');
    let createdAlbumId = null;
    try {
      let coverUrl = null;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('vinyl-covers').upload(path, imageFile, { upsert:false, contentType:imageFile.type || undefined });
        if (uploadError) throw new Error(`Caricamento copertina: ${uploadError.message}. Controlla il bucket vinyl-covers e i permessi Storage.`);
        coverUrl = supabase.storage.from('vinyl-covers').getPublicUrl(path).data.publicUrl;
      }
      let genreId = null;
      if (form.genre.trim()) {
        const { data: genre, error: genreError } = await supabase.from('genres').upsert({name:form.genre.trim()}, {onConflict:'name'}).select('id').single();
        if (genreError) throw genreError; genreId = genre.id;
      }
      const {data: artist, error: artistError} = await supabase.from('artists').upsert({name:form.artist.trim()}, {onConflict:'name'}).select('id').single();
      if (artistError) throw artistError;
      const {data: album, error: albumError} = await supabase.from('albums').insert({title:form.title.trim(), release_year:form.year ? Number(form.year):null, genre_id:genreId, cover_url:coverUrl}).select('id').single();
      if (albumError) throw albumError; createdAlbumId = album.id;
      const {error: linkError} = await supabase.from('album_artists').upsert({album_id:album.id, artist_id:artist.id, artist_role:'main'}, {onConflict:'album_id,artist_id'});
      if (linkError) throw linkError;
      const {data: release, error: releaseError} = await supabase.from('releases').insert({album_id:album.id, label:form.label.trim()||null, catalog_number:form.catalog_number.trim()||null, release_year:form.release_year ? Number(form.release_year):null, country:form.country.trim()||null, format:form.format, edition:form.edition.trim()||null}).select('id').single();
      if (releaseError) throw releaseError;
      const item = {owner_id:user.id, release_id:release.id, vinyl_condition:form.vinyl_condition, sleeve_condition:form.sleeve_condition, purchase_price:form.purchase_price ? Number(form.purchase_price):null, estimated_value:form.estimated_value ? Number(form.estimated_value):null, purchase_date:form.purchase_date||null, notes:form.notes.trim()||null};
      const {error: itemError} = await supabase.from('collection_items').insert(item);
      if (itemError) throw itemError;
      await sendViniliPush({ action: 'catalog-new', artist: form.artist.trim(), title: form.title.trim(), sender_id: user.id });
      onSaved(); onClose();
    } catch (err) {
      setError(friendlyError(err));
      if (createdAlbumId) setError(`${friendlyError(err)} Nota: la scheda del disco potrebbe essere stata creata ma non aggiunta alla collezione. Verifica il catalogo prima di riprovare.`);
    } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal-card"><header className="modal-head"><div><span className="eyebrow">NUOVO INSERIMENTO</span><h2>Aggiungi un vinile</h2><p className="muted">Il disco entrerà nel catalogo e nella tua collezione personale.</p></div><button className="icon-btn" onClick={onClose} aria-label="Chiudi"><X size={20}/></button></header>
    <form onSubmit={save} className="album-form">
      <div className="form-section-label">IL DISCO</div><div className="form-grid">
        <label className="span-2">Titolo dell’album *<input value={form.title} onChange={e=>update('title',e.target.value)} required maxLength={160} placeholder="Es. The Dark Side of the Moon"/></label>
        <label>Artista principale *<input value={form.artist} onChange={e=>update('artist',e.target.value)} required maxLength={140} placeholder="Es. Pink Floyd"/></label>
        <label>Anno album<input type="number" min="1800" max="2100" value={form.year} onChange={e=>update('year',e.target.value)} placeholder="1973"/></label>
        <label>Genere<input value={form.genre} onChange={e=>update('genre',e.target.value)} placeholder="Rock, Jazz, Soul…"/></label>
        <label className="span-2">Copertina (facoltativa)<div className="upload-box"><Upload size={18}/><span>{imageFile ? imageFile.name : 'Scegli un’immagine JPG, PNG o WEBP'}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setImageFile(e.target.files?.[0]||null)}/></div></label>
      </div>
      <div className="form-section-label">EDIZIONE / STAMPA</div><div className="form-grid">
        <label>Formato<select value={form.format} onChange={e=>update('format',e.target.value)}>{FORMATS.map(f=><option key={f}>{f}</option>)}</select></label>
        <label>Anno stampa<input type="number" min="1800" max="2100" value={form.release_year} onChange={e=>update('release_year',e.target.value)} placeholder="1980"/></label>
        <label>Etichetta discografica<input value={form.label} onChange={e=>update('label',e.target.value)} placeholder="Es. Harvest"/></label>
        <label>Numero di catalogo<input value={form.catalog_number} onChange={e=>update('catalog_number',e.target.value)} placeholder="SHVL 804"/></label>
        <label>Paese di stampa<input value={form.country} onChange={e=>update('country',e.target.value)} placeholder="Italia"/></label>
        <label>Edizione<input value={form.edition} onChange={e=>update('edition',e.target.value)} placeholder="Prima stampa, rimasterizzato…"/></label>
      </div>
      <div className="form-section-label">LA TUA COPIA</div><div className="form-grid">
        <label>Condizione disco<select value={form.vinyl_condition} onChange={e=>update('vinyl_condition',e.target.value)}>{CONDITION_OPTIONS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Condizione copertina<select value={form.sleeve_condition} onChange={e=>update('sleeve_condition',e.target.value)}>{CONDITION_OPTIONS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Prezzo d’acquisto (€)<input type="number" min="0" step="0.01" value={form.purchase_price} onChange={e=>update('purchase_price',e.target.value)} placeholder="0,00"/></label>
        <label>Valore stimato (€)<input type="number" min="0" step="0.01" value={form.estimated_value} onChange={e=>update('estimated_value',e.target.value)} placeholder="0,00"/></label>
        <label>Data d’acquisto<input type="date" value={form.purchase_date} onChange={e=>update('purchase_date',e.target.value)}/></label>
        <label className="span-2">Note<textarea rows="2" value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder="Dove l’hai trovato, ricordi, dettagli della copia…"/></label>
      </div>
      {error && <div className="notice error"><AlertCircle size={17}/>{error}</div>}
      <footer className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Annulla</button><button className="primary-btn" disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:<Plus size={17}/>}Salva il vinile</button></footer>
    </form></section></div>;
}


const IMPORT_FIELD_LABELS = [
  ['artist', 'Artista'],
  ['title', 'Titolo'],
  ['year', 'Anno'],
  ['genre', 'Genere'],
  ['label', 'Etichetta'],
  ['catalog_number', 'N. catalogo'],
  ['format', 'Formato'],
  ['country', 'Paese'],
  ['edition', 'Mix / edizione']
];
const normalizeImportValue = (value) => normalizeCatalogText(value);
const makeAlbumKey = (title, artist) => `${normalizeImportValue(title)}::${normalizeImportValue(artist)}`;
const makeReleaseKey = (albumId, row) => JSON.stringify([
  String(albumId),
  normalizeImportValue(row.format || 'Vinile'),
  normalizeImportValue(row.label),
  normalizeImportValue(row.catalog_number),
  normalizeImportValue(row.release_year),
  normalizeImportValue(row.country),
  normalizeImportValue(row.edition)
]);
const toImportMoney = (value) => {
  if (value === '' || value == null) return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const parseImportDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : null;

function ImportCatalogModal({ user, currentAlbums, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [destination, setDestination] = useState('catalog');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('select');
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null);

  async function chooseFile(nextFile) {
    if (!nextFile) return;
    setFile(nextFile);
    setError('');
    setRows([]);
    setResult(null);
    setParsing(true);
    try {
      const parsed = await parseCatalogFile(nextFile);
      if (!parsed.length) throw new Error('Non ho trovato righe di catalogo. Controlla che il documento contenga testo o una tabella leggibile.');
      const missingList = /mancant|wishlist|da.?comprare|da.?acquist|ricercat|wanted/i.test(nextFile.name);
      const nextDestination = missingList ? 'catalog' : 'collection';
      setDestination(nextDestination);

      const seen = new Set();
      const prepared = parsed.map((record, index) => {
        const title = record.title || '';
        const artist = record.artist || '';
        const releaseSignature = [
          normalizeImportValue(record.format || 'Vinile'),
          normalizeImportValue(record.label),
          normalizeImportValue(record.catalog_number),
          normalizeImportValue(record.release_year),
          normalizeImportValue(record.country),
          normalizeImportValue(record.edition)
        ].join('|');
        const duplicateKey = `${makeAlbumKey(title, artist)}::${releaseSignature}`;
        const duplicateInFile = seen.has(duplicateKey);
        seen.add(duplicateKey);

        let existingAlbum = null;
        if (title) {
          existingAlbum = (currentAlbums || []).find((album) => {
            const sameTitle = normalizeImportValue(album.title) === normalizeImportValue(title);
            if (!sameTitle) return false;
            const albumArtists = (album.artistNames || (album.album_artists || []).map((link) => link.artists?.name).filter(Boolean)).map(normalizeImportValue);
            return artist ? albumArtists.includes(normalizeImportValue(artist)) : albumArtists.length === 0 || albumArtists.length === 1;
          }) || null;
        }
        const existingRelease = Boolean(existingAlbum?.releases?.some((release) =>
          makeReleaseKey(existingAlbum.id, {
            format: release.format, label: release.label, catalog_number: release.catalog_number,
            release_year: release.release_year, country: release.country, edition: release.edition
          }) === makeReleaseKey(existingAlbum.id, record)
        ));
        const alreadyOwned = Boolean(existingAlbum?.releases?.some((release) =>
          makeReleaseKey(existingAlbum.id, {
            format: release.format, label: release.label, catalog_number: release.catalog_number,
            release_year: release.release_year, country: release.country, edition: release.edition
          }) === makeReleaseKey(existingAlbum.id, record) &&
          (release.collection_items || []).some((item) => item.owner_id === user.id)
        ));
        return {
          ...record,
          _rowId: `${record._rowId || 'row'}-${index}`,
          _selected: !duplicateInFile && !alreadyOwned && !(nextDestination === 'catalog' && existingRelease),
          _duplicateInFile: duplicateInFile,
          _existingAlbum: Boolean(existingAlbum),
          _existingRelease: existingRelease,
          _alreadyOwned: alreadyOwned,
          _needsReview: !record.title || !record.artist || (record._confidence || 0) < 3
        };
      });
      setRows(prepared);
      setStage('preview');
    } catch (err) {
      setError(err?.message || 'Impossibile leggere il file. Prova con un altro formato.');
    } finally {
      setParsing(false);
    }
  }

  function changeDestination(nextDestination) {
    setDestination(nextDestination);
    setRows((old) => old.map((row) => {
      // Restore the suggested default only for duplicate cases; manual choices
      // for ordinary records remain untouched.
      const shouldSkip = row._duplicateInFile || row._alreadyOwned ||
        (nextDestination === 'catalog' && row._existingRelease);
      const newlyEligibleCopy = nextDestination === 'collection' && row._existingRelease &&
        !row._alreadyOwned && !row._duplicateInFile;
      return { ...row, _selected: shouldSkip ? false : (newlyEligibleCopy ? true : row._selected) };
    }));
  }

  function editRow(rowId, field, value) {
    setRows((old) => old.map((row) => row._rowId === rowId
      ? { ...row, [field]: value, _needsReview: !String(field === 'artist' ? value : (row.artist || '')).trim() || !String(field === 'title' ? value : (row.title || '')).trim() }
      : row));
  }

  function selectAll(checked) {
    setRows((old) => old.map((row) => ({
      ...row,
      _selected: checked && !row._alreadyOwned && !row._duplicateInFile &&
        !(destination === 'catalog' && row._existingRelease)
    })));
  }

  async function importSelected() {
    const selectedRows = rows.filter((row) => row._selected && String(row.title || '').trim());
    if (!selectedRows.length) {
      setError('Seleziona almeno una riga con un titolo.');
      return;
    }
    setImporting(true);
    setError('');
    setProgress('Leggo il catalogo già presente per evitare doppioni…');
    const counts = { albumsAdded: 0, releasesAdded: 0, copiesAdded: 0, skipped: rows.length - selectedRows.length };
    try {
      const [
        albumsResult,
        artistsResult,
        genresResult
      ] = await Promise.all([
        supabase.from('albums').select('id,title,release_year,cover_url,description,genres(id,name),album_artists(artist_role,artists(id,name,country)),releases(id,format,label,catalog_number,release_year,country,edition,collection_items(id,owner_id,vinyl_condition,sleeve_condition,purchase_price,estimated_value,purchase_date,notes))').order('title'),
        supabase.from('artists').select('id,name'),
        supabase.from('genres').select('id,name')
      ]);
      for (const response of [albumsResult, artistsResult, genresResult]) if (response.error) throw response.error;
      const albumsData = (albumsResult.data || []).map((album) => ({
        ...album,
        artistNames: (album.album_artists || []).map((link) => link.artists?.name).filter(Boolean),
        artistIds: (album.album_artists || []).map((link) => link.artists?.id).filter(Boolean),
        releases: album.releases || []
      }));

      const artistMap = new Map((artistsResult.data || []).map((artist) => [normalizeImportValue(artist.name), artist.id]));
      const genreMap = new Map((genresResult.data || []).map((genre) => [normalizeImportValue(genre.name), genre.id]));

      const uniqueArtists = [...new Map(selectedRows.filter((row) => row.artist.trim()).map((row) => [
        normalizeImportValue(row.artist), row.artist.trim()
      ])).entries()];
      const missingArtists = uniqueArtists.filter(([key]) => !artistMap.has(key)).map(([, name]) => ({ name }));
      if (missingArtists.length) {
        setProgress(`Aggiungo ${missingArtists.length} artisti al catalogo…`);
        const created = await supabase.from('artists').insert(missingArtists).select('id,name');
        if (created.error) throw created.error;
        for (const artist of (created.data || [])) artistMap.set(normalizeImportValue(artist.name), artist.id);
      }

      const uniqueGenres = [...new Map(selectedRows.filter((row) => row.genre.trim()).map((row) => [
        normalizeImportValue(row.genre), row.genre.trim()
      ])).entries()];
      const missingGenres = uniqueGenres.filter(([key]) => !genreMap.has(key)).map(([, name]) => ({ name }));
      if (missingGenres.length) {
        setProgress(`Aggiungo ${missingGenres.length} generi al catalogo…`);
        const created = await supabase.from('genres').insert(missingGenres).select('id,name');
        if (created.error) throw created.error;
        for (const genre of (created.data || [])) genreMap.set(normalizeImportValue(genre.name), genre.id);
      }

      const albumKeyMap = new Map();
      for (const album of albumsData) {
        for (const artistName of album.artistNames) {
          const key = makeAlbumKey(album.title, artistName);
          if (!albumKeyMap.has(key)) albumKeyMap.set(key, album);
        }
        if (!album.artistNames.length) {
          const key = makeAlbumKey(album.title, '');
          if (!albumKeyMap.has(key)) albumKeyMap.set(key, album);
        }
      }

      const recordToAlbumKey = new Map();
      const newAlbumGroups = new Map();
      for (const row of selectedRows) {
        const key = makeAlbumKey(row.title, row.artist);
        recordToAlbumKey.set(row._rowId, key);
        if (!albumKeyMap.has(key) && !newAlbumGroups.has(key)) {
          newAlbumGroups.set(key, {
            title: row.title.trim(),
            release_year: row.year ? Number(row.year) : null,
            genre_id: row.genre ? genreMap.get(normalizeImportValue(row.genre)) || null : null,
            cover_url: row.cover_url || null,
            description: null,
            _artist: row.artist.trim()
          });
        } else if (newAlbumGroups.has(key)) {
          const group = newAlbumGroups.get(key);
          if (!group.release_year && row.year) group.release_year = Number(row.year);
          if (!group.genre_id && row.genre) group.genre_id = genreMap.get(normalizeImportValue(row.genre)) || null;
          if (!group.cover_url && row.cover_url) group.cover_url = row.cover_url;
        }
      }

      if (newAlbumGroups.size) {
        setProgress(`Creo ${newAlbumGroups.size} nuove schede album…`);
        const groups = [...newAlbumGroups.entries()];
        const inserted = await supabase.from('albums').insert(groups.map(([, group]) => ({
          title: group.title,
          release_year: group.release_year,
          genre_id: group.genre_id,
          cover_url: group.cover_url,
          description: group.description
        }))).select('id,title,release_year,genre_id,cover_url,description');
        if (inserted.error) throw inserted.error;
        if ((inserted.data || []).length !== groups.length) throw new Error('Il database non ha restituito tutte le schede album create. Controlla il catalogo prima di ripetere l’importazione.');
        // PostgREST returns rows in the same order as the insert values.
        inserted.data.forEach((album, index) => {
          const [key, group] = groups[index];
          albumKeyMap.set(key, { ...album, artistNames: [], artistIds: [], releases: [] });
          counts.albumsAdded++;
        });
      }

      const resolvedRows = selectedRows.map((row) => ({
        ...row,
        albumKey: recordToAlbumKey.get(row._rowId),
        album: albumKeyMap.get(recordToAlbumKey.get(row._rowId)),
        artistId: row.artist.trim() ? artistMap.get(normalizeImportValue(row.artist)) : null,
        genreId: row.genre.trim() ? genreMap.get(normalizeImportValue(row.genre)) || null : null
      })).filter((row) => row.album?.id);

      const links = [];
      const linkKeys = new Set();
      for (const row of resolvedRows) {
        if (!row.artistId) continue;
        const key = `${row.album.id}:${row.artistId}`;
        const alreadyLinked = (row.album.artistIds || []).includes(row.artistId);
        if (!alreadyLinked && !linkKeys.has(key)) {
          links.push({ album_id: row.album.id, artist_id: row.artistId, artist_role: 'main' });
          linkKeys.add(key);
        }
      }
      if (links.length) {
        setProgress('Collego album e artisti…');
        const linked = await supabase.from('album_artists').insert(links);
        if (linked.error) throw linked.error;
      }

      const releaseMap = new Map();
      for (const album of albumsData) {
        for (const release of album.releases) {
          releaseMap.set(makeReleaseKey(album.id, release), { ...release, album_id: album.id });
        }
      }
      const newReleaseGroups = new Map();
      for (const row of resolvedRows) {
        const releaseKey = makeReleaseKey(row.album.id, row);
        row.releaseKey = releaseKey;
        if (!releaseMap.has(releaseKey) && !newReleaseGroups.has(releaseKey)) {
          newReleaseGroups.set(releaseKey, {
            album_id: row.album.id,
            format: row.format.trim() || 'Vinile',
            label: row.label.trim() || null,
            catalog_number: row.catalog_number.trim() || null,
            release_year: row.release_year ? Number(row.release_year) : null,
            country: row.country.trim() || null,
            edition: row.edition.trim() || null
          });
        }
      }
      if (newReleaseGroups.size) {
        setProgress(`Registro ${newReleaseGroups.size} edizioni/stampe…`);
        const groups = [...newReleaseGroups.entries()];
        const inserted = await supabase.from('releases').insert(groups.map(([, release]) => release))
          .select('id,album_id,format,label,catalog_number,release_year,country,edition');
        if (inserted.error) throw inserted.error;
        if ((inserted.data || []).length !== groups.length) throw new Error('Il database non ha restituito tutte le edizioni create. Controlla il catalogo prima di ripetere l’importazione.');
        inserted.data.forEach((release, index) => {
          const [key] = groups[index];
          releaseMap.set(key, release);
          counts.releasesAdded++;
        });
      }

      const collectionRows = [];
      const collectionReleaseIds = new Set();
      if (destination === 'collection') {
        for (const row of resolvedRows) {
          const release = releaseMap.get(row.releaseKey);
          if (!release || collectionReleaseIds.has(String(release.id))) continue;
          collectionReleaseIds.add(String(release.id));
          const existingRelease = albumsData.flatMap((album) => album.releases.map((item) => ({ ...item, album_id: album.id })))
            .find((item) => makeReleaseKey(item.album_id, item) === row.releaseKey);
          const alreadyOwned = (existingRelease?.collection_items || []).some((item) => item.owner_id === user.id);
          if (alreadyOwned) { counts.skipped++; continue; }
          collectionRows.push({
            owner_id: user.id,
            release_id: release.id,
            vinyl_condition: row.vinyl_condition || null,
            sleeve_condition: row.sleeve_condition || null,
            purchase_price: toImportMoney(row.purchase_price),
            estimated_value: toImportMoney(row.estimated_value),
            purchase_date: parseImportDate(row.purchase_date),
            notes: row.notes || null
          });
        }
        if (collectionRows.length) {
          setProgress(`Aggiungo ${collectionRows.length} copie alla tua collezione personale…`);
          const copies = await supabase.from('collection_items').insert(collectionRows);
          if (copies.error) throw copies.error;
          counts.copiesAdded = collectionRows.length;
        }
      }

      setResult(counts);
      setStage('done');
      onImported();
    } catch (err) {
      setError(friendlyError(err));
      setProgress('');
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = rows.filter((row) => row._selected && String(row.title || '').trim()).length;
  const duplicateCount = rows.filter((row) => row._duplicateInFile || row._existingRelease || row._alreadyOwned).length;
  const reviewCount = rows.filter((row) => row._needsReview).length;

  return <div className="modal-backdrop import-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !importing) onClose(); }}>
    <section className="modal-card import-modal">
      <header className="modal-head import-head">
        <div>
          <span className="eyebrow">IMPORTAZIONE INTELLIGENTE</span>
          <h2>Importa il tuo catalogo</h2>
          <p className="muted">Leggo il documento, riconosco i campi e ti faccio verificare i dati prima di salvarli.</p>
        </div>
        <button className="icon-btn" onClick={onClose} disabled={importing} aria-label="Chiudi"><X size={20}/></button>
      </header>

      <div className="import-body">
        {stage === 'select' && <div className="import-upload-area">
          <div className="import-drop-icon"><Upload size={28}/></div>
          <h3>Da che file partiamo?</h3>
          <p>Puoi caricare un Word con tabella o elenco, un Excel, CSV, TXT oppure un PDF con testo selezionabile.</p>
          <label className="primary-btn import-file-btn">
            <Upload size={17}/> Scegli il file
            <input type="file" accept=".docx,.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.pdf,.doc" onChange={(event) => chooseFile(event.target.files?.[0])} disabled={parsing}/>
          </label>
          {parsing && <div className="import-progress"><LoaderCircle className="spin" size={18}/><span>Analizzo il documento e cerco intestazioni, colonne e righe…</span></div>}
          <div className="import-format-list"><span>WORD .DOCX</span><span>EXCEL</span><span>CSV / TXT</span><span>PDF TESTUALE</span></div>
        </div>}

        {stage === 'preview' && <>
          <div className="import-file-line">
            <div className="import-file-icon"><Disc3 size={20}/></div>
            <div className="import-file-meta"><b>{file?.name}</b><span>{rows.length} righe individuate · anteprima modificabile</span></div>
            <button className="secondary-btn import-change-file" onClick={() => { setStage('select'); setRows([]); setError(''); setFile(null); }}>Cambia file</button>
          </div>
          {file && /mancant|wishlist|da.?comprare|da.?acquist|ricercat|wanted/i.test(file.name) && <div className="import-advice"><AlertCircle size={17}/><span>Il nome del file sembra indicare dischi mancanti o da cercare. Per sicurezza partirai da <b>Solo catalogo condiviso</b>: non li segnerò come già posseduti.</span></div>}
          <div className="import-destination">
            <label htmlFor="import-destination">Dove inserire i dischi?</label>
            <select id="import-destination" value={destination} onChange={(event) => changeDestination(event.target.value)}>
              <option value="catalog">Solo catalogo condiviso (non risultano posseduti)</option>
              <option value="collection">Catalogo condiviso + la mia collezione personale</option>
            </select>
          </div>
          <div className="import-summary-grid">
            <div><b>{rows.length}</b><span>righe lette</span></div>
            <div><b>{selectedCount}</b><span>selezionate</span></div>
            <div><b>{duplicateCount}</b><span>possibili doppioni</span></div>
            <div><b>{reviewCount}</b><span>da verificare</span></div>
          </div>
          <div className="import-select-tools">
            <button className="text-btn" onClick={() => selectAll(true)}>Seleziona righe importabili</button>
            <button className="text-btn" onClick={() => selectAll(false)}>Deseleziona tutte</button>
          </div>
          <div className="import-table-wrap">
            <table className="import-table">
              <thead><tr><th>Importa</th>{IMPORT_FIELD_LABELS.map(([field, label]) => <th key={field}>{label}</th>)}<th>Controllo</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row._rowId} className={`${row._needsReview ? 'needs-review' : ''} ${row._selected ? 'is-selected' : ''}`}>
                <td><input aria-label={`Importa riga ${row._sourceLine || row._rowId}`} type="checkbox" checked={Boolean(row._selected)} onChange={(event) => editRow(row._rowId, '_selected', event.target.checked)}/></td>
                {IMPORT_FIELD_LABELS.map(([field, label]) => <td key={field}><input aria-label={`${label}, riga ${row._sourceLine || row._rowId}`} value={row[field] || ''} onChange={(event) => editRow(row._rowId, field, event.target.value)} /></td>)}
                <td><div className="import-statuses">
                  {row._duplicateInFile && <span className="import-tag duplicate">Ripetuto nel file</span>}
                  {row._alreadyOwned && <span className="import-tag duplicate">Già posseduto</span>}
                  {!row._alreadyOwned && row._existingRelease && <span className="import-tag duplicate">Edizione presente</span>}
                  {row._needsReview && <span className="import-tag review">Verifica dati</span>}
                  {!row._duplicateInFile && !row._existingRelease && !row._needsReview && <span className="import-tag good">Pronto</span>}
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="import-footnote">I campi restano modificabili. Le righe incomplete sono evidenziate: controllale prima di importare. L’importazione non ricerca automaticamente le copertine e non inventa i dati mancanti.</p>
        </>}

        {stage === 'done' && result && <div className="import-finished">
          <div className="import-success-icon"><Check size={28}/></div>
          <h3>Importazione completata</h3>
          <p>Ho elaborato il file e aggiornato l’archivio.</p>
          <div className="import-result-grid">
            <div><b>{result.albumsAdded}</b><span>nuovi album</span></div>
            <div><b>{result.releasesAdded}</b><span>nuove edizioni</span></div>
            {destination === 'collection' && <div><b>{result.copiesAdded}</b><span>copie personali</span></div>}
            <div><b>{result.skipped}</b><span>righe non importate / saltate</span></div>
          </div>
          <button className="primary-btn" onClick={onClose}>Torna al catalogo</button>
        </div>}

        {importing && <div className="import-working"><LoaderCircle className="spin" size={22}/><div><b>Sto importando i dati…</b><span>{progress || 'Non chiudere questa finestra durante l’operazione.'}</span></div></div>}
        {error && <div className="notice error import-error"><AlertCircle size={17}/><span>{error}</span></div>}
      </div>

      {stage === 'preview' && <footer className="modal-actions import-actions">
        <button type="button" className="secondary-btn" disabled={importing} onClick={onClose}>Annulla</button>
        <button type="button" className="primary-btn" disabled={importing || selectedCount === 0} onClick={importSelected}>
          {importing ? <LoaderCircle className="spin" size={17}/> : <Upload size={17}/>}
          Importa {selectedCount} righe
        </button>
      </footer>}
    </section>
  </div>;
}

function CatalogEditModal({ album, onClose, onSaved }) {
  const originalRelease = (album.releases || [])[0] || null;
  const [releaseId, setReleaseId] = useState(String(originalRelease?.id || ''));
  const [form, setForm] = useState({
    title: album.title || '',
    artists: (album.artistNames || (album.artists || []).map((artist) => typeof artist === 'string' ? artist : artist.name).filter(Boolean)).join('; '),
    albumYear: album.release_year ? String(album.release_year) : '',
    genre: album.genreName && album.genreName !== 'Senza genere' ? album.genreName : (album.genres?.name || ''),
    description: album.description || '',
    format: originalRelease?.format || 'Vinile',
    label: originalRelease?.label || '',
    catalogNumber: originalRelease?.catalog_number || '',
    pressingYear: originalRelease?.release_year ? String(originalRelease.release_year) : '',
    country: originalRelease?.country || '',
    edition: originalRelease?.edition || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (field, value) => setForm((old) => ({ ...old, [field]: value }));
  const selectedRelease = (album.releases || []).find((release) => String(release.id) === releaseId) || null;

  function chooseRelease(nextId) {
    setReleaseId(nextId);
    const release = (album.releases || []).find((item) => String(item.id) === nextId);
    setForm((old) => ({
      ...old,
      format: release?.format || 'Vinile', label: release?.label || '',
      catalogNumber: release?.catalog_number || '', pressingYear: release?.release_year ? String(release.release_year) : '',
      country: release?.country || '', edition: release?.edition || ''
    }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const { error: saveError } = await supabase.rpc('update_catalog_album', {
        p_album_id: Number(album.id),
        p_title: form.title.trim(),
        p_release_year: form.albumYear ? Number(form.albumYear) : null,
        p_genre: form.genre.trim() || null,
        p_artists: form.artists.trim(),
        p_description: form.description.trim() || null,
        p_release_id: releaseId ? Number(releaseId) : null,
        p_format: form.format.trim() || 'Vinile',
        p_label: form.label.trim() || null,
        p_catalog_number: form.catalogNumber.trim() || null,
        p_pressing_year: form.pressingYear ? Number(form.pressingYear) : null,
        p_country: form.country.trim() || null,
        p_edition: form.edition.trim() || null
      });
      if (saveError) throw saveError;
      onSaved();
    } catch (err) {
      const message = err?.message || 'Non è stato possibile salvare le modifiche.';
      setError(/update_catalog_album|schema cache|function/i.test(message)
        ? 'La funzione di modifica non risulta attiva in Supabase. Controlla che lo script SQL della versione 1.4.0 sia stato applicato.'
        : friendlyError(err));
    } finally { setSaving(false); }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="modal-card catalog-edit-modal" role="dialog" aria-modal="true" aria-label="Modifica scheda album">
      <header className="modal-head"><div><span className="eyebrow">CORREZIONE CATALOGO · VINILI v1.4.0</span><h2>Modifica disco</h2><p className="muted">Le correzioni al titolo e agli artisti aggiornano la scheda condivisa da tutti gli utenti.</p></div><button className="icon-btn" onClick={onClose} disabled={saving} aria-label="Chiudi"><X size={20}/></button></header>
      <form className="album-form" onSubmit={save}>
        <div className="form-section-label">ALBUM</div>
        <div className="form-grid">
          <label className="span-2">Titolo *<input value={form.title} onChange={(event) => update('title', event.target.value)} required maxLength={180}/></label>
          <label className="span-2">Artista / artisti *<input value={form.artists} onChange={(event) => update('artists', event.target.value)} required placeholder="Separa più artisti con ;"/><small>Per più artisti, separali con un punto e virgola (;).</small></label>
          <label>Anno album<input type="number" min="1800" max="2100" value={form.albumYear} onChange={(event) => update('albumYear', event.target.value)} placeholder="1998"/></label>
          <label>Genere<input value={form.genre} onChange={(event) => update('genre', event.target.value)} placeholder="Eurodance, Jazz…"/></label>
          <label className="span-2">Note descrittive<textarea rows="2" value={form.description} onChange={(event) => update('description', event.target.value)}/></label>
        </div>
        {(album.releases || []).length > 0 && <>
          <div className="form-section-label">EDIZIONE / STAMPA DA CORREGGERE</div>
          <div className="form-grid">
            {(album.releases || []).length > 1 && <label className="span-2">Scegli l’edizione<select value={releaseId} onChange={(event) => chooseRelease(event.target.value)}>{album.releases.map((release) => <option key={release.id} value={String(release.id)}>{[release.format, release.edition, release.release_year, release.label].filter(Boolean).join(' · ') || `Edizione ${release.id}`}</option>)}</select></label>}
            <label>Formato<select value={form.format} onChange={(event) => update('format', event.target.value)}>{FORMATS.map((format) => <option key={format} value={format}>{format}</option>)}</select></label>
            <label>Anno stampa<input type="number" min="1800" max="2100" value={form.pressingYear} onChange={(event) => update('pressingYear', event.target.value)} placeholder="2001"/></label>
            <label>Etichetta<input value={form.label} onChange={(event) => update('label', event.target.value)} placeholder="TIME Records"/></label>
            <label>Numero di catalogo<input value={form.catalogNumber} onChange={(event) => update('catalogNumber', event.target.value)} placeholder="TIME 285"/></label>
            <label>Paese stampa<input value={form.country} onChange={(event) => update('country', event.target.value)} placeholder="Italia"/></label>
            <label>Edizione / mix<input value={form.edition} onChange={(event) => update('edition', event.target.value)} placeholder="Extended Mix"/></label>
          </div>
        </>}
        {error && <div className="notice error"><AlertCircle size={17}/><span>{error}</span></div>}
        <footer className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>Annulla</button><button type="submit" className="primary-btn" disabled={saving}>{saving ? <LoaderCircle size={17} className="spin"/> : <Check size={17}/>} Salva modifiche</button></footer>
      </form>
    </section>
  </div>;
}

function CollectionItemEditModal({ item, user, onClose, onSaved }) {
  const [form, setForm] = useState({
    vinyl_condition: item.vinyl_condition || 'Near Mint (NM)',
    sleeve_condition: item.sleeve_condition || 'Very Good Plus (VG+)',
    purchase_price: item.purchase_price == null ? '' : String(item.purchase_price),
    estimated_value: item.estimated_value == null ? '' : String(item.estimated_value),
    purchase_date: item.purchase_date || '',
    notes: item.notes || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (field, value) => setForm(old => ({ ...old, [field]: value }));

  async function save(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const { error: saveError } = await supabase.from('collection_items').update({
        vinyl_condition: form.vinyl_condition || null,
        sleeve_condition: form.sleeve_condition || null,
        purchase_price: form.purchase_price === '' ? null : Number(form.purchase_price),
        estimated_value: form.estimated_value === '' ? null : Number(form.estimated_value),
        purchase_date: form.purchase_date || null,
        notes: form.notes.trim() || null
      }).eq('id', item.id).eq('owner_id', user.id);
      if (saveError) throw saveError;
      onSaved();
    } catch (err) { setError(friendlyError(err)); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="modal-card catalog-edit-modal" role="dialog" aria-modal="true" aria-label="Modifica la tua copia">
      <header className="modal-head"><div><span className="eyebrow">LA MIA COLLEZIONE</span><h2>Modifica la tua copia</h2><p className="muted">Questi dati sono personali e non modificano la scheda condivisa del catalogo.</p></div><button className="icon-btn" onClick={onClose} disabled={saving} aria-label="Chiudi"><X size={20}/></button></header>
      <form className="album-form" onSubmit={save}>
        <div className="collection-edit-title"><b>{item.album?.title || item.releases?.albums?.title || 'Disco'}</b><span>{(item.artistNames || []).join(', ')}</span></div>
        <div className="form-section-label">CONDIZIONE DELLA TUA COPIA</div>
        <div className="form-grid">
          <label>Condizione vinile<select value={form.vinyl_condition} onChange={event => update('vinyl_condition', event.target.value)}>{CONDITION_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Condizione copertina<select value={form.sleeve_condition} onChange={event => update('sleeve_condition', event.target.value)}>{CONDITION_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Prezzo d’acquisto (€)<input type="number" min="0" step="0.01" value={form.purchase_price} onChange={event => update('purchase_price', event.target.value)} placeholder="0,00"/></label>
          <label>Valore stimato (€)<input type="number" min="0" step="0.01" value={form.estimated_value} onChange={event => update('estimated_value', event.target.value)} placeholder="0,00"/></label>
          <label>Data d’acquisto<input type="date" value={form.purchase_date} onChange={event => update('purchase_date', event.target.value)}/></label>
          <label className="span-2">Note personali<textarea rows="3" value={form.notes} onChange={event => update('notes', event.target.value)} placeholder="Dove l’hai trovato, difetti, dettagli…" maxLength={2000}/></label>
        </div>
        {error && <div className="notice error"><AlertCircle size={17}/><span>{error}</span></div>}
        <footer className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>Annulla</button><button type="submit" className="primary-btn" disabled={saving}>{saving ? <LoaderCircle size={17} className="spin"/> : <Check size={17}/>} Salva copia</button></footer>
      </form>
    </section>
  </div>;
}

function TradeCenter({ user, myItems, onRefresh }) {
  const [shareCollection, setShareCollection] = useState(false);
  const [sharedItems, setSharedItems] = useState([]);
  const [offers, setOffers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [target, setTarget] = useState(null);
  const [offeredItemId, setOfferedItemId] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [messageDrafts, setMessageDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [profileResult, sharedResult, offersResult] = await Promise.all([
        supabase.from('profiles').select('collection_public').eq('id', user.id).maybeSingle(),
        supabase.rpc('get_shared_collection'),
        supabase.rpc('get_trade_offers')
      ]);
      if (profileResult.error) throw profileResult.error;
      if (sharedResult.error) throw sharedResult.error;
      if (offersResult.error) throw offersResult.error;
      setShareCollection(Boolean(profileResult.data?.collection_public));
      setSharedItems(sharedResult.data || []);
      setOffers((offersResult.data || []).map((offer) => ({ ...offer, messages: Array.isArray(offer.messages) ? offer.messages : (typeof offer.messages === 'string' ? JSON.parse(offer.messages || '[]') : []) })));
    } catch (err) {
      setError(/get_shared_collection|get_trade_offers|schema cache|column.*collection_public|function/i.test(err?.message || '')
        ? 'Manca la configurazione Scambi nel database. Occorre applicare lo script SQL della versione 1.4.0.'
        : friendlyError(err));
    } finally { setLoading(false); }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  async function toggleSharing(nextValue) {
    setSaving(true); setError(''); setNotice('');
    try {
      const { error: updateError } = await supabase.from('profiles').update({ collection_public: nextValue }).eq('id', user.id);
      if (updateError) throw updateError;
      setShareCollection(nextValue);
      setNotice(nextValue ? 'La tua collezione è ora visibile agli altri utenti che hanno scelto di partecipare agli scambi.' : 'La tua collezione non è più visibile agli altri utenti.');
      await load();
    } catch (err) { setError(friendlyError(err)); }
    finally { setSaving(false); }
  }

  function offerFor(item) {
    setTarget(item);
    setOfferedItemId(String(myItems[0]?.id || ''));
    setOfferMessage(''); setError('');
  }

  async function sendOffer(event) {
    event.preventDefault();
    if (!target || !offeredItemId) { setError('Seleziona prima un tuo disco da proporre.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const { error: offerError } = await supabase.rpc('create_trade_offer', {
        p_offered_item_id: Number(offeredItemId),
        p_requested_item_id: Number(target.item_id),
        p_message: offerMessage.trim() || null
      });
      if (offerError) throw offerError;
      if (target.owner_id) {
        await sendViniliPush({ action: 'trade-offer', recipient_id: target.owner_id, sender_id: user.id, title: target.album_title });
      }
      setTarget(null); setNotice('Proposta inviata. L’altro collezionista può accettare, rifiutare o rispondere con una controproposta.');
      await load();
    } catch (err) { setError(friendlyError(err)); }
    finally { setSaving(false); }
  }

  async function respond(offer, action) {
    const message = (messageDrafts[offer.offer_id] || '').trim();
    if (action === 'counter' && !message) { setError('Scrivi una controproposta prima di inviarla.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const { error: responseError } = await supabase.rpc('respond_trade_offer', { p_offer_id: Number(offer.offer_id), p_action: action, p_message: message || null });
      if (responseError) throw responseError;
      if (offer.other_user_id) {
        await sendViniliPush({ action: 'trade-response', recipient_id: offer.other_user_id, sender_id: user.id, response: action });
      }
      setMessageDrafts((old) => ({ ...old, [offer.offer_id]: '' }));
      setNotice(action === 'accept' ? 'Accordo registrato. Il trasferimento fisico dei dischi va concordato direttamente tra voi.' : action === 'reject' ? 'Proposta rifiutata.' : action === 'withdraw' ? 'Proposta ritirata.' : 'Controproposta inviata.');
      await load();
    } catch (err) { setError(friendlyError(err)); }
    finally { setSaving(false); }
  }

  const filtered = sharedItems.filter((item) => [item.album_title, item.artist_names, item.owner_name, item.genre_name, item.format, item.label, item.edition].filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const statusLabels = { pending: 'In attesa', countered: 'Controproposta', accepted: 'Accettata', rejected: 'Rifiutata', withdrawn: 'Ritirata' };
  const activeOffers = offers.filter((offer) => ['pending', 'countered'].includes(offer.status));

  return <div className="trade-page">
    <div className="welcome-row trade-welcome"><div><span className="eyebrow">COLLEZIONISTI · SCAMBI · TRATTATIVE</span><h1>Confronta le collezioni<span className="title-period">.</span></h1><p className="page-subtitle">Scopri i dischi che gli altri collezionisti hanno scelto di condividere e proponi uno scambio.</p></div><button className="secondary-btn" onClick={load} disabled={loading}><RefreshCw size={16}/> Aggiorna</button></div>
    <section className="share-panel"><div className="share-icon"><Eye size={19}/></div><div className="share-copy"><b>Condividi la tua collezione</b><span>È disattivata per impostazione predefinita. Se la attivi, gli altri utenti vedranno i dischi che possiedi, ma non i prezzi di acquisto o il valore stimato.</span></div><button type="button" className={`share-toggle ${shareCollection ? 'enabled' : ''}`} onClick={() => toggleSharing(!shareCollection)} disabled={saving} aria-pressed={shareCollection}>{shareCollection ? <Eye size={16}/> : <EyeOff size={16}/>} {shareCollection ? 'Condivisione attiva' : 'Condividi i miei dischi'}</button></section>
    {error && <div className="notice error page-notice"><AlertCircle size={17}/><span>{error}</span></div>}{notice && <div className="notice success page-notice"><Check size={17}/><span>{notice}</span><button className="icon-btn" onClick={() => setNotice('')}><X size={15}/></button></div>}
    <section className="catalog-section trade-catalog-section"><div className="catalog-head"><div><h2>Dischi disponibili per lo scambio <span className="result-count">{filtered.length}</span></h2><p>Mostra solo i dischi degli utenti che hanno attivato la condivisione.</p></div><label className="search-box trade-search"><Search size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca artista, titolo o collezionista…"/></label></div>
      {loading ? <div className="empty-state"><LoaderCircle className="spin" size={28}/><b>Carico le collezioni condivise…</b></div> : filtered.length ? <div className="trade-record-grid">{filtered.map((item) => <article className="trade-record-card" key={item.item_id}><div className="trade-record-cover">{item.cover_url ? <img src={item.cover_url} alt={`Copertina ${item.album_title}`} loading="lazy"/> : <Cover album={{ title: item.album_title }} />}</div><div className="trade-record-details"><span className="album-genre">{item.genre_name || 'Senza genere'} · {item.owner_name}</span><div className="trade-record-title-line"><h3>{item.album_title}</h3><YouTubeLink title={item.album_title} artist={item.artist_names} compact/></div><p>{item.artist_names || 'Artista non indicato'}</p><span className="trade-record-meta">{[item.format, item.pressing_year, item.label, item.edition].filter(Boolean).join(' · ')}</span><div className="trade-record-bottom"><span>{item.vinyl_condition || 'Condizione n.d.'}</span><button className="primary-btn trade-propose-btn" onClick={() => offerFor(item)} disabled={!myItems.length}><ArrowLeftRight size={15}/> Proponi scambio</button></div></div></article>)}</div> : <div className="empty-state"><div className="empty-icon"><ArrowLeftRight size={30}/></div><h3>Nessuna collezione condivisa da mostrare</h3><p>{shareCollection ? 'Al momento gli altri utenti non hanno attivato la condivisione. Invita i tuoi amici a farlo dalla sezione Scambi.' : 'Puoi attivare la condivisione sopra per partecipare. Gli altri utenti dovranno abilitarla a loro volta per comparire qui.'}</p></div>}
    </section>
    <section className="catalog-section trade-offers-section"><div className="catalog-head"><div><h2>Proposte e contrattazioni <span className="result-count">{offers.length}</span></h2><p>Le proposte accettate registrano l’accordo, ma non trasferiscono automaticamente i dischi tra collezioni.</p></div></div>
      {!loading && offers.length === 0 ? <div className="trade-empty-note"><MessageCircle size={18}/> Qui vedrai le proposte inviate e ricevute, con le eventuali controproposte.</div> : <div className="trade-offer-list">{offers.map((offer) => {
        const myTurn = offer.turn_user_id === user.id;
        const active = ['pending', 'countered'].includes(offer.status);
        const canRespond = active && myTurn;
        const sentByMe = offer.my_role === 'sent';
        const messages = offer.messages || [];
        return <article className="trade-offer-card" key={offer.offer_id}>
          <div className="trade-offer-top"><div><span className="eyebrow">{sentByMe ? 'PROPOSTA INVIATA' : 'PROPOSTA RICEVUTA'}</span><h3>Scambio con {offer.other_user_name}</h3></div><span className={`trade-status trade-status-${offer.status}`}>{statusLabels[offer.status] || offer.status}</span></div>
          <div className="trade-pair"><div><small>DA TE / DA {sentByMe ? 'TE' : offer.other_user_name.toUpperCase()}</small><div className="trade-offer-title-line"><b>{sentByMe ? offer.offered_title : offer.requested_title}</b><YouTubeLink title={sentByMe ? offer.offered_title : offer.requested_title} artist={sentByMe ? offer.offered_artist : offer.requested_artist} compact/></div><span>{sentByMe ? offer.offered_artist : offer.requested_artist}</span></div><ArrowLeftRight size={18}/><div><small>IN CAMBIO</small><div className="trade-offer-title-line"><b>{sentByMe ? offer.requested_title : offer.offered_title}</b><YouTubeLink title={sentByMe ? offer.requested_title : offer.offered_title} artist={sentByMe ? offer.requested_artist : offer.offered_artist} compact/></div><span>{sentByMe ? offer.requested_artist : offer.offered_artist}</span></div></div>
          {messages.length > 0 && <div className="trade-chat">{messages.map((message) => <div className={`trade-chat-line ${message.sender_id === user.id ? 'mine' : ''}`} key={message.id}><b>{message.sender_name}</b><span>{message.message}</span><small>{new Date(message.created_at).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'})}</small></div>)}</div>}
          {active && <div className="trade-response-area"><label>Messaggio / controproposta<textarea rows="2" maxLength={1200} value={messageDrafts[offer.offer_id] || ''} onChange={(event) => setMessageDrafts((old) => ({ ...old, [offer.offer_id]: event.target.value }))} placeholder={canRespond ? 'Scrivi un commento o la tua controproposta…' : 'Puoi inviare un messaggio quando tocca a te rispondere.'} disabled={!canRespond || saving}/></label><div className="trade-response-actions">{canRespond && <><button className="secondary-btn" onClick={() => respond(offer, 'counter')} disabled={saving}><MessageCircle size={15}/> Controproponi</button><button className="secondary-btn" onClick={() => respond(offer, 'reject')} disabled={saving}>Rifiuta</button><button className="primary-btn" onClick={() => respond(offer, 'accept')} disabled={saving}><Check size={15}/> Accetta</button></>}{sentByMe && <button className="text-btn" onClick={() => respond(offer, 'withdraw')} disabled={saving}>Ritira proposta</button>}</div>{active && !canRespond && <small className="muted"><Clock3 size={13}/> In attesa che l’altro collezionista risponda. Puoi ritirare la proposta se l’hai inviata.</small>}</div>}
        </article>;
      })}</div>}
    </section>
    {target && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setTarget(null); }}><section className="modal-card trade-proposal-modal"><header className="modal-head"><div><span className="eyebrow">NUOVA PROPOSTA</span><h2>Proponi uno scambio</h2><p className="muted">Vuoi proporre un tuo disco in cambio di quello di {target.owner_name}?</p></div><button className="icon-btn" onClick={() => setTarget(null)} disabled={saving}><X size={20}/></button></header><form className="album-form" onSubmit={sendOffer}><div className="trade-proposal-target"><div className="trade-record-cover">{target.cover_url ? <img src={target.cover_url} alt={target.album_title}/> : <Cover album={{title:target.album_title}}/>}</div><div><div className="trade-offer-title-line"><b>{target.album_title}</b><YouTubeLink title={target.album_title} artist={target.artist_names} compact/></div><span>{target.artist_names}</span><small>Collezione di {target.owner_name}</small></div></div><label>Il tuo disco da offrire<select value={offeredItemId} onChange={(event) => setOfferedItemId(event.target.value)} required>{myItems.map((item) => <option key={item.id} value={String(item.id)}>{[item.album.title, item.artistNames.join(', '), item.format, item.release.edition].filter(Boolean).join(' · ')}</option>)}</select></label><label>Messaggio iniziale (facoltativo)<textarea rows="3" maxLength={1200} value={offerMessage} onChange={(event) => setOfferMessage(event.target.value)} placeholder="Es. Ti interessa uno scambio alla pari? Posso aggiungere altri dischi…"/></label>{error && <div className="notice error"><AlertCircle size={16}/>{error}</div>}<footer className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setTarget(null)} disabled={saving}>Annulla</button><button type="submit" className="primary-btn" disabled={saving || !offeredItemId}>{saving ? <LoaderCircle size={17} className="spin"/> : <Send size={16}/>} Invia proposta</button></footer></form></section></div>}
  </div>;
}

function FriendsCenter({ user, myItems, onRefresh }) {
  const [emailDraft, setEmailDraft] = useState('');
  const [shareEmail, setShareEmail] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [activePanel, setActivePanel] = useState('compare');
  const [comparison, setComparison] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [tradeTarget, setTradeTarget] = useState(null);
  const [tradeOfferedItemId, setTradeOfferedItemId] = useState('');
  const [tradeMessageDraft, setTradeMessageDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [compareLoading, setCompareLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadFriends = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [profileResult, friendsResult] = await Promise.all([
        supabase.from('profiles').select('share_email_with_friends').eq('id', user.id).maybeSingle(),
        supabase.rpc('get_vinyl_friendships')
      ]);
      if (profileResult.error) throw profileResult.error;
      if (friendsResult.error) throw friendsResult.error;
      setShareEmail(Boolean(profileResult.data?.share_email_with_friends));
      const rows = friendsResult.data || [];
      setFriends(rows);
      setSelectedFriendId(old => {
        if (old && rows.some(friend => String(friend.friend_id) === String(old) && friend.status === 'accepted')) return old;
        return String(rows.find(friend => friend.status === 'accepted')?.friend_id || '');
      });
    } catch (err) {
      setError(/get_vinyl_friendships|schema cache|share_email_with_friends|function/i.test(err?.message || '')
        ? 'La parte Amici non è ancora configurata nel database. Usa lo script SQL incluso nel pacchetto aggiornamento.'
        : friendlyError(err));
    } finally { if (!quiet) setLoading(false); }
  }, [user.id]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  const acceptedFriends = friends.filter(friend => friend.status === 'accepted');
  const incomingRequests = friends.filter(friend => friend.status === 'pending' && friend.direction === 'incoming');
  const outgoingRequests = friends.filter(friend => friend.status === 'pending' && friend.direction === 'outgoing');
  const selectedFriend = acceptedFriends.find(friend => String(friend.friend_id) === String(selectedFriendId)) || null;

  const loadComparison = useCallback(async (friendId, quiet = false) => {
    if (!friendId) { setComparison([]); return; }
    if (!quiet) setCompareLoading(true);
    try {
      const { data, error: compareError } = await supabase.rpc('compare_vinyl_friend_collection', { p_friend_id: friendId });
      if (compareError) throw compareError;
      setComparison(data || []);
    } catch (err) { setError(friendlyError(err)); }
    finally { if (!quiet) setCompareLoading(false); }
  }, []);

  const loadMessages = useCallback(async (friendId, quiet = false) => {
    if (!friendId) { setMessages([]); return; }
    const friendship = friends.find(item => item.status === 'accepted' && String(item.friend_id) === String(friendId));
    if (!friendship) { setMessages([]); return; }
    try {
      const { data, error: messageError } = await supabase.rpc('get_vinyl_friend_messages', { p_friendship_id: friendship.friendship_id });
      if (messageError) throw messageError;
      setMessages(data || []);
    } catch (err) { if (!quiet) setError(friendlyError(err)); }
  }, [friends]);

  useEffect(() => { if (selectedFriendId) loadComparison(selectedFriendId); else setComparison([]); }, [selectedFriendId, loadComparison]);
  useEffect(() => { if (selectedFriendId && activePanel === 'chat') loadMessages(selectedFriendId); else setMessages([]); }, [selectedFriendId, activePanel, loadMessages]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      loadFriends(true);
      if (selectedFriendId) {
        if (activePanel === 'chat') loadMessages(selectedFriendId, true);
        if (activePanel === 'compare') loadComparison(selectedFriendId, true);
      }
    }, 12000);
    return () => window.clearInterval(timer);
  }, [loadFriends, loadComparison, loadMessages, selectedFriendId, activePanel]);

  async function sendRequest(event) {
    event.preventDefault();
    const email = emailDraft.trim().toLowerCase();
    if (!email) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data, error: requestError } = await supabase.rpc('send_vinyl_friend_request', { p_email: email });
      if (requestError) throw requestError;
      const result = Array.isArray(data) ? data[0] : data;
      const messagesByResult = {
        sent: `Richiesta di amicizia inviata a ${result?.target_name || email}.`,
        already_friends: 'Siete già amici.',
        request_pending: 'Hai già inviato una richiesta a questo utente.',
        incoming_pending: 'Questo utente ti ha già inviato una richiesta: puoi accettarla qui sotto.',
        not_found: 'Non ho trovato un account con questa email. Verifica l’indirizzo e riprova.'
      };
      setNotice(messagesByResult[result?.result] || 'Richiesta elaborata.');
      if (result?.result === 'sent' && result?.target_id) {
        await sendViniliPush({ action: 'friend-request', recipient_id: result.target_id, sender_id: user.id });
      }
      setEmailDraft('');
      await loadFriends();
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  async function answerRequest(friend, action) {
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: answerError } = await supabase.rpc('respond_vinyl_friend_request', { p_friendship_id: friend.friendship_id, p_action: action });
      if (answerError) throw answerError;
      if (action === 'accept' && friend.friend_id) {
        await sendViniliPush({ action: 'friend-accepted', recipient_id: friend.friend_id, sender_id: user.id });
      }
      setNotice(action === 'accept' ? `Ora sei amico di ${friend.friend_name}.` : action === 'reject' ? 'Richiesta rifiutata.' : 'Richiesta annullata.');
      await loadFriends();
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  async function removeFriend(friend) {
    if (!friend?.friendship_id) return;
    const confirmed = window.confirm(`Vuoi rimuovere ${friend.friend_name} dagli amici? Potrai inviare nuovamente la richiesta per rifare il test delle notifiche.`);
    if (!confirmed) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: removeError } = await supabase.rpc('remove_vinyl_friend', { p_friendship_id: friend.friendship_id });
      if (removeError) throw removeError;
      setSelectedFriendId('');
      setActivePanel('compare');
      setMessages([]);
      setComparison([]);
      setNotice(`Hai rimosso ${friend.friend_name} dagli amici. Ora puoi inviare di nuovo la richiesta.`);
      await loadFriends();
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  async function toggleShareEmail() {
    setBusy(true); setError(''); setNotice('');
    try {
      const next = !shareEmail;
      const { error: updateError } = await supabase.from('profiles').update({ share_email_with_friends: next }).eq('id', user.id);
      if (updateError) throw updateError;
      setShareEmail(next);
      setNotice(next ? 'La tua email sarà visibile soltanto agli amici che hai accettato.' : 'La tua email non sarà più mostrata agli amici.');
      await loadFriends();
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!selectedFriend || !messageDraft.trim()) return;
    const friendRow = friends.find(friend => friend.status === 'accepted' && String(friend.friend_id) === String(selectedFriendId));
    if (!friendRow) return;
    setBusy(true); setError('');
    try {
      const { error: sendError } = await supabase.rpc('send_vinyl_friend_message', { p_friendship_id: friendRow.friendship_id, p_message: messageDraft.trim() });
      if (sendError) throw sendError;
      await sendViniliPush({ action: 'friend-message', recipient_id: friendRow.friend_id, sender_id: user.id, message: messageDraft.trim() });
      setMessageDraft('');
      await loadMessages(selectedFriendId);
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  function startTrade(row) {
    setTradeTarget(row);
    setTradeOfferedItemId(String(myItems[0]?.id || ''));
    setTradeMessageDraft('');
    setError(''); setNotice('');
  }

  async function sendFriendTradeOffer(event) {
    event.preventDefault();
    if (!tradeTarget?.friend_item_id || !tradeOfferedItemId) { setError('Seleziona un tuo disco da offrire.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: offerError } = await supabase.rpc('create_trade_offer', {
        p_offered_item_id: Number(tradeOfferedItemId),
        p_requested_item_id: Number(tradeTarget.friend_item_id),
        p_message: tradeMessageDraft.trim() || null
      });
      if (offerError) throw offerError;
      setTradeTarget(null);
      setActivePanel('chat');
      setNotice('Proposta inviata! La troverai anche nella sezione Scambi, dove potrete accettare o controproporre.');
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  const compareMissing = comparison.filter(row => row.friend_owns_it && !row.i_own_it);
  const compareOverlap = comparison.filter(row => row.friend_owns_it && row.i_own_it);
  const compareMineOnly = comparison.filter(row => row.i_own_it && !row.friend_owns_it);

  return <div className="friends-page">
    <div className="welcome-row"><div><span className="eyebrow">COMUNITÀ VINILI · AMICIZIE · MESSAGGI</span><h1>I tuoi amici<span className="title-period">.</span></h1><p className="page-subtitle">Collega altri collezionisti, confrontate i dischi e organizzate gli scambi nella chat privata.</p></div><button className="secondary-btn" onClick={() => loadFriends()} disabled={loading}><RefreshCw size={16}/> Aggiorna</button></div>
    <section className="friend-find-panel"><div className="friend-find-copy"><span className="friends-icon"><Users size={21}/></span><div><h2>Trova un collezionista</h2><p>Inserisci l’email con cui l’altra persona si è registrata su VINILI. La richiesta va accettata prima di poter confrontare le collezioni o chattare.</p></div></div><form className="friend-find-form" onSubmit={sendRequest}><label className="search-box"><Mail size={18}/><input type="email" required value={emailDraft} onChange={event => setEmailDraft(event.target.value)} placeholder="email@esempio.it"/></label><button className="primary-btn" type="submit" disabled={busy || !emailDraft.trim()}><Send size={16}/> Invia richiesta</button></form>
      <div className="friend-email-toggle"><div><b>Condividi la mia email con gli amici</b><span>Facoltativo. Gli amici accettati vedranno il tuo indirizzo solo se attivi questa opzione.</span></div><button className={`share-toggle ${shareEmail ? 'enabled' : ''}`} onClick={toggleShareEmail} disabled={busy} aria-pressed={shareEmail}>{shareEmail ? <Eye size={16}/> : <EyeOff size={16}/>} {shareEmail ? 'Email visibile agli amici' : 'Email privata'}</button></div>
    </section>
    {error && <div className="notice error page-notice"><AlertCircle size={17}/><span>{error}</span></div>}{notice && <div className="notice success page-notice"><Check size={17}/><span>{notice}</span><button className="icon-btn" onClick={() => setNotice('')}><X size={15}/></button></div>}
    {incomingRequests.length > 0 && <section className="catalog-section friend-requests"><div className="catalog-head"><div><h2>Richieste ricevute <span className="result-count">{incomingRequests.length}</span></h2><p>Accetta per confrontare le collezioni e aprire la chat.</p></div></div><div className="friend-request-list">{incomingRequests.map(friend => <article className="friend-request-card" key={friend.friendship_id}><div className="friend-avatar"><Users size={18}/></div><div className="friend-request-info"><b>{friend.friend_name}</b><span>{friend.friend_username ? `@${friend.friend_username}` : 'Collezionista VINILI'}</span></div><button className="secondary-btn" onClick={() => answerRequest(friend, 'reject')} disabled={busy}>Rifiuta</button><button className="primary-btn" onClick={() => answerRequest(friend, 'accept')} disabled={busy}><Check size={15}/> Accetta</button></article>)}</div></section>}
    <div className="friends-layout">
      <section className="friends-list-panel"><div className="catalog-head"><div><h2>Amici <span className="result-count">{acceptedFriends.length}</span></h2><p>Le tue connessioni su VINILI.</p></div></div>
        {loading ? <div className="empty-state compact-empty"><LoaderCircle className="spin" size={26}/><b>Carico gli amici…</b></div> : acceptedFriends.length ? <div className="friends-list">{acceptedFriends.map(friend => <button key={friend.friendship_id} className={`friend-list-row ${String(friend.friend_id) === String(selectedFriendId) ? 'selected' : ''}`} onClick={() => { setSelectedFriendId(String(friend.friend_id)); setActivePanel('compare'); }}><span className="friend-avatar"><Users size={18}/></span><span className="friend-list-meta"><b>{friend.friend_name}</b><small>{friend.friend_email || friend.last_message || 'Amico VINILI'}</small></span><ArrowUpRight size={16}/></button>)}</div> : <div className="empty-state compact-empty"><div className="empty-icon"><Users size={28}/></div><h3>La tua rete inizia qui</h3><p>Invia una richiesta tramite email. Dopo l’accettazione potrete scoprire i dischi in comune e scrivervi nella chat.</p></div>}
        {outgoingRequests.length > 0 && <div className="outgoing-requests"><b>Richieste inviate</b>{outgoingRequests.map(friend => <div className="outgoing-request-row" key={friend.friendship_id}><span>{friend.friend_name}</span><small>In attesa</small><button className="text-btn" onClick={() => answerRequest(friend, 'cancel')} disabled={busy}>Annulla</button></div>)}</div>}
      </section>
      <section className="friend-detail-panel">
        {selectedFriend ? <>
          <div className="friend-detail-head"><div className="friend-avatar large"><Users size={21}/></div><div className="friend-detail-title"><span className="eyebrow">AMICIZIA CONFERMATA</span><h2>{selectedFriend.friend_name}</h2><p>{selectedFriend.friend_email ? selectedFriend.friend_email : selectedFriend.friend_username ? `@${selectedFriend.friend_username}` : 'Collezionista VINILI'}</p></div><button className="secondary-btn" onClick={() => removeFriend(selectedFriend)} disabled={busy}>Rimuovi amicizia</button></div>
          <div className="friend-panel-switch"><button className={activePanel === 'compare' ? 'selected' : ''} onClick={() => setActivePanel('compare')}><DiscAlbum size={16}/> Confronta collezioni</button><button className={activePanel === 'chat' ? 'selected' : ''} onClick={() => setActivePanel('chat')}><MessageCircle size={16}/> Chat</button></div>
          {activePanel === 'compare' ? <div className="friend-compare-view"><div className="compare-summary"><div><b>{compareMissing.length}</b><span>Edizioni che ha e ti mancano</span></div><div><b>{compareOverlap.length}</b><span>Edizioni possedute da entrambi</span></div><div><b>{compareMineOnly.length}</b><span>Edizioni che hai e mancano all’amico</span></div></div>
            {compareLoading ? <div className="empty-state compact-empty"><LoaderCircle className="spin" size={24}/><b>Confronto in corso…</b></div> : comparison.length ? <div className="comparison-record-list">{comparison.map(row => <article className="comparison-record-row" key={`${row.release_id}-${row.album_id}`}><div className="comparison-cover">{row.cover_url ? <img src={row.cover_url} alt={row.title}/> : <Cover album={{title:row.title}}/>}</div><div className="comparison-record-main"><b>{row.title}</b><span>{row.artist_names || 'Artista non indicato'}{row.format ? ` · ${row.format}` : ''}</span><YouTubeLink title={row.title} artist={row.artist_names} compact/></div><div className="comparison-status">{row.i_own_it && row.friend_owns_it ? <span className="status-both"><Check size={13}/> Entrambi</span> : row.friend_owns_it ? <span className="status-missing">A te manca</span> : <span className="status-mine">Ce l’hai tu</span>}{row.friend_owns_it && !row.i_own_it && row.friend_item_id && myItems.length>0 && <button className="comparison-trade-btn" onClick={()=>startTrade(row)}><ArrowLeftRight size={13}/> Proponi scambio</button>}</div></article>)}</div> : <div className="empty-state compact-empty"><Disc3 size={25}/><b>Le collezioni sono vuote</b><p>Aggiungete i vostri dischi alla sezione La mia collezione.</p></div>}
          </div> : <div className="friend-chat-panel"><div className="friend-chat-messages">{messages.length ? messages.map(message => <div className={`friend-chat-bubble ${message.sender_id === user.id ? 'mine' : ''}`} key={message.message_id}><span>{message.message}</span><small>{message.sender_name} · {new Date(message.created_at).toLocaleString('it-IT', {dateStyle:'short', timeStyle:'short'})}</small></div>) : <div className="chat-empty"><MessageCircle size={24}/><b>Inizia la conversazione</b><span>Organizzate qui il vostro prossimo scambio di vinili.</span></div>}</div><form className="friend-chat-compose" onSubmit={sendMessage}><textarea rows="2" value={messageDraft} onChange={event => setMessageDraft(event.target.value)} maxLength={2000} placeholder={`Scrivi a ${selectedFriend.friend_name}…`} disabled={busy}/><button className="primary-btn" type="submit" disabled={busy || !messageDraft.trim()}><Send size={16}/> Invia</button></form></div>}
        </> : <div className="empty-state friend-detail-empty"><div className="empty-icon"><MessageCircle size={30}/></div><h3>Un archivio da condividere</h3><p>Seleziona un amico per confrontare i dischi, trovare doppioni e parlare direttamente nella chat interna.</p></div>}
      </section>
    </div>
    <p className="friend-privacy-note"><LockKeyhole size={14}/> La collezione è confrontabile solo tra amici accettati. Prezzi, valori stimati e note personali restano privati. La condivisione dell’email è facoltativa.</p>
    {tradeTarget && <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setTradeTarget(null);}}><section className="modal-card trade-proposal-modal"><header className="modal-head"><div><span className="eyebrow">PROPOSTA TRA AMICI</span><h2>Proponi uno scambio</h2><p className="muted">Questo disco appartiene a {selectedFriend?.friend_name || 'al tuo amico'}.</p></div><button className="icon-btn" onClick={()=>setTradeTarget(null)} disabled={busy}><X size={20}/></button></header><form className="album-form" onSubmit={sendFriendTradeOffer}><div className="trade-proposal-target"><div className="trade-record-cover">{tradeTarget.cover_url ? <img src={tradeTarget.cover_url} alt={tradeTarget.title}/> : <Cover album={{title:tradeTarget.title}}/>}</div><div><b>{tradeTarget.title}</b><span>{tradeTarget.artist_names || 'Artista non indicato'}{tradeTarget.format ? ` · ${tradeTarget.format}` : ''}</span><small>Collezione di {selectedFriend?.friend_name || 'amico'}</small></div></div><label>Il tuo disco da offrire<select value={tradeOfferedItemId} onChange={event=>setTradeOfferedItemId(event.target.value)} required>{myItems.map(item=><option key={item.id} value={String(item.id)}>{[item.album.title,item.artistNames.join(', '),item.format,item.release.edition].filter(Boolean).join(' · ')}</option>)}</select></label><label>Messaggio iniziale (facoltativo)<textarea rows="3" maxLength={1200} value={tradeMessageDraft} onChange={event=>setTradeMessageDraft(event.target.value)} placeholder="Es. Ti va uno scambio alla pari?"/></label>{error && <div className="notice error"><AlertCircle size={16}/>{error}</div>}<footer className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setTradeTarget(null)} disabled={busy}>Annulla</button><button type="submit" className="primary-btn" disabled={busy||!tradeOfferedItemId}>{busy ? <LoaderCircle size={17} className="spin"/> : <Send size={16}/>} Invia proposta</button></footer></form></section></div>}
  </div>;
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('catalog');
  const [albums, setAlbums] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [artists, setArtists] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(()=>{
    if (!supabase) { setAuthLoading(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({data})=>{if(alive){setSession(data.session);setAuthLoading(false);}});
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, nextSession)=>{setSession(nextSession);setAuthLoading(false);});
    return ()=>{alive=false;subscription.unsubscribe();};
  },[]);

  const loadData = useCallback(async()=>{
    if (!session?.user) return;
    setLoadingData(true);setError('');
    try {
      const [albumRes, itemRes, artistRes, genreRes] = await Promise.all([
        supabase.from('albums').select('id,title,release_year,cover_url,description,created_at,genres(id,name),album_artists(artist_role,artists(id,name,country)),releases(id,format,label,catalog_number,release_year,country,edition,collection_items(id,owner_id,vinyl_condition,sleeve_condition,purchase_price,estimated_value,purchase_date,notes))').order('title'),
        supabase.from('collection_items').select('id,owner_id,release_id,vinyl_condition,sleeve_condition,purchase_price,estimated_value,purchase_date,notes,releases(id,album_id,format,label,catalog_number,release_year,country,edition,albums(id,title,release_year,cover_url,description,genres(name),album_artists(artists(name))))').eq('owner_id',session.user.id).order('created_at',{ascending:false}),
        supabase.from('artists').select('id,name'),
        supabase.from('genres').select('id,name').order('name')
      ]);
      for (const r of [albumRes,itemRes,artistRes,genreRes]) if (r.error) throw r.error;
      const cleaned = (albumRes.data||[]).map(album=>{
        const albumArtists=(album.album_artists||[]).map(link=>link.artists).filter(Boolean);
        const releases=(album.releases||[]).map(rel=>({...rel, collection_items:(rel.collection_items||[])}));
        return {...album, artists:albumArtists, artistNames:albumArtists.map(a=>a.name), genreName:album.genres?.name||'Senza genere', releases};
      });
      const ownedIds = new Set((itemRes.data||[]).map(i=>String(i.releases?.album_id || '')));
      // Album detail includes current user's collection rows when RLS is set to owner-only.
      setAlbums(cleaned);setMyItems(itemRes.data||[]);setArtists(artistRes.data||[]);setGenres(genreRes.data||[]);
      setSelectedAlbum(prev=>prev ? cleaned.find(a=>a.id===prev.id)||null : null);
    } catch (err) { setError(friendlyError(err)); }
    finally { setLoadingData(false); }
  },[session?.user?.id]);

  useEffect(()=>{if(session?.user){loadData();ensureProfile(session.user).catch(()=>{});}},[session?.user?.id,loadData]);
  useEffect(() => { const handler = (event) => { const found = albums.find((album) => String(album.id) === String(event.detail?.albumId)); if (found) setEditingAlbum(found); }; window.addEventListener('vinili:edit-album', handler); return () => window.removeEventListener('vinili:edit-album', handler); }, [albums]);

  async function ensureProfile(user) {
    const base = (user.user_metadata?.username || user.email?.split('@')[0] || 'vinilista').toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,35) || 'vinilista';
    const {error: profileError} = await supabase.from('profiles').upsert({id:user.id, username:`${base}_${user.id.replaceAll('-','').slice(0,6)}`, display_name:user.user_metadata?.display_name || user.email?.split('@')[0] || base}, {onConflict:'id'});
    if (profileError && !/permission|row-level security/i.test(profileError.message)) console.warn('Profilo:',profileError.message);
  }

  const artistsOf = album => (album.artistNames||[]).join(', ') || 'Artista non indicato';
  const collectionItems = useMemo(()=>myItems.map(item=>{
    const release=item.releases||{};const album=release.albums||{};
    return {...item, release, album, format:release.format||'Vinile', genreName:album.genres?.name||'Senza genere', artistNames:(album.album_artists||[]).map(x=>x.artists?.name).filter(Boolean)};
  }),[myItems]);
  const formats = useMemo(()=>[...new Set(albums.flatMap(a=>a.releases.map(r=>r.format).filter(Boolean)))].sort(),[albums]);
  const shownAlbums = useMemo(()=>{
    const source = showMineOnly ? albums.filter(a=>a.releases.some(r=>(r.collection_items||[]).some(i=>i.owner_id===session?.user?.id))) : albums;
    const q=query.trim().toLowerCase();
    return source.filter(a=>{
      const searchable=[a.title,a.release_year,...a.artistNames,a.genreName,...a.releases.flatMap(r=>[r.label,r.catalog_number,r.format,r.edition,r.country])].filter(Boolean).join(' ').toLowerCase();
      return (!q||searchable.includes(q))&&(genreFilter==='all'||a.genreName===genreFilter)&&(formatFilter==='all'||a.releases.some(r=>r.format===formatFilter));
    });
  },[albums,query,genreFilter,formatFilter,showMineOnly,session?.user?.id]);
  const collectionValue = collectionItems.reduce((sum,item)=>sum+Number(item.estimated_value||0),0);
  const formatMoney = n => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(Number(n)||0);

  async function signOut(){await supabase.auth.signOut();setAlbums([]);setMyItems([]);}
  async function deleteItem(item){
    if(!window.confirm('Rimuovere questo disco dalla tua collezione personale? Il disco resta nel catalogo condiviso.'))return;
    const {error:deleteError}=await supabase.from('collection_items').delete().eq('id',item.id).eq('owner_id',session.user.id);
    if(deleteError){setError(friendlyError(deleteError));return;}setSuccessMessage('Disco rimosso dalla tua collezione.');loadData();
  }

  if (!isSupabaseConfigured) return <div className="setup-screen"><Disc3 size={38}/><h1>VINILI</h1><p>Mancano i dati di collegamento a Supabase. Copia <code>.env.example</code> in <code>.env.local</code> e inserisci URL e publishable key.</p></div>;
  if(authLoading) return <div className="loading-screen"><VinylDisc size="large"/><p>Preparazione dell’archivio…</p></div>;
  if(!session) return <AuthScreen/>;

  const isCollection = activeTab==='collection';
  const isTrades = activeTab==='trades';
  const isFriends = activeTab==='friends';
  const listing = isCollection ? collectionItems.filter(item=>{
    const q=query.trim().toLowerCase(); const search=[item.album.title,...item.artistNames,item.genreName,item.format,item.release.label,item.release.catalog_number].filter(Boolean).join(' ').toLowerCase();
    return !q||search.includes(q);
  }) : shownAlbums;

  return <div className="app-shell">
    <aside className="sidebar"><a className="brand-lockup" href="#catalog" onClick={e=>{e.preventDefault();setActiveTab('catalog')}}><div className="brand-mark"><Disc3 size={25}/></div><span>VINILI<span className="brand-dot">.</span></span></a>
      <div className="side-label">IL TUO SPAZIO</div><nav className="side-nav">
        <button className={activeTab==='catalog'?'active':''} onClick={()=>setActiveTab('catalog')}><Library size={19}/><span>Catalogo</span><span className="nav-count">{albums.length}</span></button>
        <button className={activeTab==='collection'?'active':''} onClick={()=>setActiveTab('collection')}><DiscAlbum size={19}/><span>La mia collezione</span><span className="nav-count">{myItems.length}</span></button>
        <button className={activeTab==='trades'?'active':''} onClick={()=>setActiveTab('trades')}><ArrowLeftRight size={19}/><span>Scambi</span></button>
        <button className={activeTab==='friends'?'active':''} onClick={()=>setActiveTab('friends')}><Users size={19}/><span>Amici e chat</span></button>
      </nav>
      <div className="sidebar-note"><div className="note-icon"><Music2 size={18}/></div><p>La musica passa.<br/><b>I dischi restano.</b></p><span>Il piacere di collezionare, senza fretta.</span></div>
      <div className="sidebar-user"><div className="avatar">{(session.user.user_metadata?.display_name||session.user.email||'V').slice(0,1).toUpperCase()}</div><div className="user-details"><b>{session.user.user_metadata?.display_name||session.user.email?.split('@')[0]}</b><span>{session.user.email}</span></div><button className="icon-btn logout-btn" title="Esci" onClick={signOut}><LogOut size={17}/></button></div>
      <div className="app-version">VINILI v1.4.0 · 21/10/2026</div>
    </aside>

    <main className="main-content"><header className="topbar"><div className="crumb"><span>VINILI</span><span className="crumb-slash">/</span><b>{isCollection?'LA MIA COLLEZIONE':isTrades?'SCAMBI E CONFRONTI':isFriends?'AMICI E CHAT':'CATALOGO MUSICALE'}</b></div><div className="top-actions"><span className="online-dot"/> ARCHIVIO SINCRONIZZATO <button className="avatar avatar-small" onClick={signOut} title="Esci">{(session.user.user_metadata?.display_name||session.user.email||'V').slice(0,1).toUpperCase()}</button></div></header>
      <section className="page-wrap">
        {isTrades ? <TradeCenter user={session.user} myItems={collectionItems} onRefresh={loadData}/> : isFriends ? <FriendsCenter user={session.user} myItems={collectionItems} onRefresh={loadData}/> : <>
        <div className="welcome-row"><div><span className="eyebrow">{isCollection?'IL TUO TESORO PERSONALE':'ESPLORA, CERCA, RICORDA'}</span><h1>{isCollection?'La tua collezione':'Il catalogo dei vinili'}<span className="title-period">.</span></h1><p className="page-subtitle">{isCollection?'Ogni copia racconta qualcosa. Qui c’è la tua storia musicale.':'Un archivio condiviso per scoprire album e custodire le tue copie.'}</p></div><div className="welcome-actions"><button className="secondary-btn import-launch-btn" onClick={()=>setShowImport(true)}><Upload size={17}/> Importa catalogo</button><button className="primary-btn add-btn" onClick={()=>setShowAdd(true)}><Plus size={18}/> Aggiungi vinile</button></div></div>
        <div className="stats-grid"><div className="stat-card"><div className="stat-top"><span>DISCHI A CATALOGO</span><Library size={18}/></div><div className="stat-value">{albums.length.toLocaleString('it-IT')}<span className="stat-caption">album</span></div><div className="stat-foot">Archivio condiviso</div></div><div className="stat-card"><div className="stat-top"><span>ARTISTI</span><Users size={18}/></div><div className="stat-value">{artists.length.toLocaleString('it-IT')}<span className="stat-caption">artisti</span></div><div className="stat-foot">Voci della tua musica</div></div><div className="stat-card"><div className="stat-top"><span>LA MIA COLLEZIONE</span><Disc3 size={18}/></div><div className="stat-value">{myItems.length.toLocaleString('it-IT')}<span className="stat-caption">copie</span></div><div className="stat-foot">Dischi che possiedi</div></div><div className="stat-card stat-highlight"><div className="stat-top"><span>VALORE STIMATO</span><Wallet size={18}/></div><div className="stat-value money-value">{formatMoney(collectionValue)}</div><div className="stat-foot">Somma dei valori inseriti</div></div></div>
        <div className="catalog-meaning-note"><div><b>Catalogo = schede degli album</b><span>Conta le schede registrate nell’archivio condiviso. Un album resta una sola scheda anche se più utenti lo possiedono.</span></div><div><b>La mia collezione = le tue copie</b><span>Conta le edizioni che hai aggiunto al tuo account. È un conteggio personale, non il totale di tutto il catalogo.</span></div></div>
        <section className="catalog-section"><div className="catalog-head"><div><h2>{isCollection?'Le tue copie':'Esplora i dischi'} <span className="result-count">{listing.length}</span></h2><p>{isCollection?'Edizioni e dettagli della tua collezione':'Cerca un titolo, un artista, un anno o un’etichetta.'}</p></div><div className="catalog-tools"><label className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cerca nel catalogo…"/><kbd>⌘ K</kbd>{query&&<button onClick={()=>setQuery('')} aria-label="Pulisci ricerca"><X size={15}/></button>}</label>{!isCollection && <div className="view-switch" aria-label="Visualizzazione catalogo"><button className={viewMode==='grid'?'selected':''} onClick={()=>setViewMode('grid')} title="Vista schede">Schede</button><button className={viewMode==='table'?'selected':''} onClick={()=>setViewMode('table')} title="Vista elenco tipo foglio di calcolo">Elenco</button></div>}<button className={`filter-btn ${showFilters?'selected':''}`} onClick={()=>setShowFilters(s=>!s)}><SlidersHorizontal size={17}/> Filtri</button></div></div>
          {showFilters && !isCollection && <div className="filter-panel"><label>Genere<select value={genreFilter} onChange={e=>setGenreFilter(e.target.value)}><option value="all">Tutti i generi</option>{genres.map(g=><option key={g.id} value={g.name}>{g.name}</option>)}</select></label><label>Formato<select value={formatFilter} onChange={e=>setFormatFilter(e.target.value)}><option value="all">Tutti i formati</option>{formats.map(f=><option key={f} value={f}>{f}</option>)}</select></label><label className="check-filter"><input type="checkbox" checked={showMineOnly} onChange={e=>setShowMineOnly(e.target.checked)}/> Solo album che possiedo</label><button className="text-btn" onClick={()=>{setGenreFilter('all');setFormatFilter('all');setShowMineOnly(false)}}>Azzera filtri</button></div>}
          {error&&<div className="notice error page-notice"><AlertCircle size={17}/><span>{error}</span><button className="text-btn" onClick={loadData}><RefreshCw size={15}/> Riprova</button></div>}
          {successMessage&&<div className="notice success page-notice"><Check size={17}/>{successMessage}<button className="icon-btn" onClick={()=>setSuccessMessage('')}><X size={15}/></button></div>}
          {loadingData ? <div className="empty-state"><LoaderCircle className="spin" size={30}/><b>Sto aggiornando l’archivio…</b><span>Sincronizzazione con Supabase</span></div> : listing.length ? (!isCollection && viewMode==='table') ? <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr><th>Copertina</th><th>Titolo / artista</th><th>Anno</th><th>Genere</th><th>Edizioni</th><th>Azioni</th></tr></thead><tbody>{shownAlbums.map(album=><tr key={album.id}><td className="table-cover-cell"><div className="table-cover">{album.cover_url ? <img src={album.cover_url} alt={album.title}/> : <Cover album={album}/>}</div></td><td><div className="table-title-line"><b>{album.title}</b><YouTubeLink title={album.title} artist={artistsOf(album)} compact/></div><span className="table-subtitle">{artistsOf(album)}</span></td><td>{album.release_year || '—'}</td><td>{album.genreName || 'Senza genere'}</td><td><div className="table-release-cell">{album.releases.length ? album.releases.map((release)=><span key={release.id}>{[release.format,release.release_year,release.edition].filter(Boolean).join(' · ') || 'Edizione'}</span>) : <span>Da completare</span>}</div></td><td><div className="table-actions"><button className="secondary-btn table-edit-btn" onClick={()=>setEditingAlbum(album)}><Pencil size={14}/> Modifica</button><button className="icon-btn" onClick={()=>setSelectedAlbum(album)} title="Apri scheda"><ArrowUpRight size={16}/></button></div></td></tr>)}</tbody></table></div> : <div className="album-grid">{isCollection ? listing.map(item=><article className="album-card collection-album-card" key={`item-${item.id}`}><div className="album-hit-area" role="button" tabIndex={0} onKeyDown={event=>activateCardOnKey(event,()=>setSelectedAlbum({...item.album,artists:item.artistNames.map(name=>({name})),artistNames:item.artistNames,genreName:item.genreName,releases:[item.release],personalItem:item}))} onClick={()=>setSelectedAlbum({...item.album,artists:item.artistNames.map(name=>({name})),artistNames:item.artistNames,genreName:item.genreName,releases:[item.release],personalItem:item})}><div className="cover-wrap"><Cover album={item.album}/><span className="format-pill">{item.format}</span><span className="owned-badge"><Check size={12}/> IN COLLEZIONE</span></div><div className="album-card-info"><span className="album-genre">{item.genreName}</span><div className="album-title-line"><h3>{item.album.title}</h3><YouTubeLink title={item.album.title} artist={item.artistNames.join(', ')} compact/></div><p>{item.artistNames.join(', ')||'Artista non indicato'}</p><div className="album-card-foot"><span>{item.release.release_year||item.album.release_year||'Anno n.d.'}</span><span>{item.estimated_value?formatMoney(item.estimated_value):'Valore n.d.'}</span></div></div></div><div className="collection-card-actions"><button className="collection-edit-action" title="Modifica scheda condivisa del disco" onClick={event=>{event.stopPropagation();setEditingAlbum({...item.album,artists:item.artistNames.map(name=>({name})),artistNames:item.artistNames,genreName:item.genreName,releases:[item.release]});}}><Pencil size={14}/><span>Scheda</span></button><button className="collection-edit-action" title="Modifica i dati personali della tua copia" onClick={event=>{event.stopPropagation();setEditingItem(item);}}><SlidersHorizontal size={14}/><span>Copia</span></button><button className="remove-item" title="Rimuovi dalla collezione" onClick={event=>{event.stopPropagation();deleteItem(item);}}><Trash2 size={15}/></button></div></article>) : listing.map(album=><article className="album-card" key={album.id}><div className="album-hit-area" role="button" tabIndex={0} onKeyDown={event=>activateCardOnKey(event,()=>setSelectedAlbum(album))} onClick={()=>setSelectedAlbum(album)}><div className="cover-wrap"><Cover album={album}/>{album.releases.length>0&&<span className="format-pill">{album.releases[0].format||'Vinile'}</span>}{album.releases.some(r=>(r.collection_items||[]).some(i=>i.owner_id===session.user.id))&&<span className="owned-badge"><Check size={12}/> IN COLLEZIONE</span>}</div><div className="album-card-info"><span className="album-genre">{album.genreName}</span><div className="album-title-line"><h3>{album.title}</h3><YouTubeLink title={album.title} artist={artistsOf(album)} compact/></div><p>{artistsOf(album)}</p><div className="album-card-foot"><span>{album.release_year||'Anno n.d.'}</span><span>{album.releases.length} {album.releases.length===1?'edizione':'edizioni'}</span></div></div></div></article>)}</div> : <div className="empty-state"><div className="empty-icon"><Disc3 size={31}/></div><h3>{isCollection?'La tua collezione inizia da qui':'Il catalogo è pronto per il primo disco'}</h3><p>{query?'Nessun risultato con questa ricerca. Prova un altro termine.':isCollection?'Aggiungi il tuo primo vinile per iniziare a costruire il tuo archivio personale.':'Aggiungi un album per iniziare a costruire l’archivio condiviso con i tuoi amici.'}</p>{query?<button className="secondary-btn" onClick={()=>setQuery('')}>Pulisci ricerca</button>:<button className="primary-btn" onClick={()=>setShowAdd(true)}><Plus size={17}/> Aggiungi il primo vinile</button>}</div>}
        </section></>}<footer className="page-footer"><span>VINILI<span className="brand-dot">.</span> — IL PIACERE DI COLLEZIONARE</span><span>CATALOGO CONDIVISO · COLLEZIONI PERSONALI</span></footer>
      </section>
    </main>
    {showImport&&<ImportCatalogModal user={session.user} currentAlbums={albums} onClose={()=>setShowImport(false)} onImported={()=>{setSuccessMessage('Importazione completata. Il catalogo è stato aggiornato.');loadData();}}/>}
    {editingAlbum&&<CatalogEditModal album={editingAlbum} onClose={()=>setEditingAlbum(null)} onSaved={()=>{setEditingAlbum(null);setSuccessMessage('Scheda disco aggiornata.');loadData();}}/>}
    {editingItem&&<CollectionItemEditModal item={editingItem} user={session.user} onClose={()=>setEditingItem(null)} onSaved={()=>{setEditingItem(null);setSuccessMessage('Dati personali della copia aggiornati.');loadData();}}/>}
    {showAdd&&<AddAlbumModal user={session.user} onClose={()=>setShowAdd(false)} onSaved={()=>{setSuccessMessage('Vinile aggiunto correttamente.');loadData();}}/>}
    {selectedAlbum&&<AlbumDetails album={selectedAlbum} user={session.user} onClose={()=>setSelectedAlbum(null)} onChanged={()=>{setSelectedAlbum(null);loadData();}}/>}
  </div>;
}

function CoverManagerModal({ user, album, onClose, onSaved }) {
  const artists = album.artistNames || (album.artists || []).map((artist) => typeof artist === 'string' ? artist : artist.name).filter(Boolean);
  const [query, setQuery] = useState(`${artists.join(' ')} ${album.title || ''}`.trim());
  const [results, setResults] = useState([]);
  const [selectedOnline, setSelectedOnline] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function artworkUrl(result) {
    return (result?.artworkUrl100 || result?.artworkUrl60 || '').replace(/\/\d+x\d+bb(?=\.)/, '/600x600bb');
  }

  async function searchOnline(event) {
    event?.preventDefault?.();
    const searchTerm = query.trim();
    if (!searchTerm) { setError('Scrivi artista e titolo per cercare una copertina.'); return; }
    setSearching(true); setError(''); setResults([]); setSelectedOnline(null); setImageFile(null); setPreviewUrl('');
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=album&limit=24&country=it`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Il servizio di ricerca ha risposto con codice ${response.status}.`);
      const data = await response.json();
      const items = (data.results || []).filter((item) => item.collectionName && artworkUrl(item));
      setResults(items);
      if (!items.length) setError('Nessuna copertina trovata. Prova una ricerca più breve o carica un’immagine dal dispositivo.');
    } catch (err) {
      setError(`Ricerca online non disponibile: ${err?.message || 'errore di rete'}. Puoi comunque caricare una copertina dal dispositivo.`);
    } finally { setSearching(false); }
  }

  function chooseOnline(item) {
    setSelectedOnline(item); setImageFile(null); setPreviewUrl(artworkUrl(item)); setError('');
  }

  function chooseFile(file) {
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Scegli un’immagine JPG, PNG o WEBP.'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('L’immagine supera 5 MB. Scegli un file più leggero.'); return;
    }
    setImageFile(file); setSelectedOnline(null); setPreviewUrl(URL.createObjectURL(file));
  }

  async function saveCover() {
    if (!imageFile && !selectedOnline) { setError('Scegli una copertina dalla ricerca o dal dispositivo.'); return; }
    setSaving(true); setError('');
    try {
      let coverUrl = '';
      if (imageFile) {
        const extension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const storagePath = `${user.id}/covers/album-${album.id}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('vinyl-covers').upload(storagePath, imageFile, {
          upsert: false,
          contentType: imageFile.type || 'image/jpeg',
          cacheControl: '31536000'
        });
        if (uploadError) throw new Error(`Caricamento immagine fallito: ${uploadError.message}. Controlla il bucket vinyl-covers e i relativi permessi.`);
        coverUrl = supabase.storage.from('vinyl-covers').getPublicUrl(storagePath).data.publicUrl;
      } else {
        coverUrl = artworkUrl(selectedOnline);
      }
      const { error: updateError } = await supabase.rpc('set_album_cover', {
        p_album_id: album.id,
        p_cover_url: coverUrl
      });
      if (updateError) {
        if (/set_album_cover|function|schema cache|Could not find/i.test(updateError.message || '')) {
          throw new Error('Manca una configurazione di sicurezza in Supabase. Prima di salvare, esegui una sola volta lo script supabase/set_album_cover.sql nel SQL Editor del progetto.');
        }
        throw updateError;
      }
      onSaved(coverUrl);
    } catch (err) {
      setError(err?.message || 'Non è stato possibile salvare la copertina.');
    } finally { setSaving(false); }
  }

  return <div className="modal-backdrop cover-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="cover-manager-modal" role="dialog" aria-modal="true" aria-label="Aggiungi copertina">
      <header className="modal-head cover-manager-head">
        <div><span className="eyebrow">PERSONALIZZA IL CATALOGO</span><h2>Copertina del disco</h2><p className="muted">{album.title} · {artists.join(', ') || 'Artista non indicato'}</p></div>
        <button className="icon-btn" onClick={onClose} disabled={saving} aria-label="Chiudi"><X size={20}/></button>
      </header>
      <div className="cover-manager-body">
        <section className="cover-search-section">
          <div className="form-section-label">CERCA ONLINE</div>
          <form className="cover-search-form" onSubmit={searchOnline}>
            <label className="cover-search-input"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Artista e titolo dell’album"/></label>
            <button className="primary-btn" type="submit" disabled={searching}>{searching ? <LoaderCircle size={16} className="spin"/> : <Globe size={16}/>} Cerca copertine</button>
          </form>
          <p className="muted cover-helper">Ricerca nell’archivio musicale Apple/iTunes. Se l’edizione esatta non c’è, puoi usare un’immagine dal dispositivo.</p>
          {searching && <div className="cover-search-status"><LoaderCircle className="spin" size={20}/> Sto cercando le copertine…</div>}
          {results.length > 0 && <div className="cover-results" aria-label="Risultati della ricerca">{results.map((item) => {
            const itemCover = artworkUrl(item);
            const selected = selectedOnline?.collectionId === item.collectionId && selectedOnline?.trackId === item.trackId && selectedOnline?.collectionName === item.collectionName;
            return <button type="button" className={`cover-result ${selected ? 'selected' : ''}`} key={`${item.collectionId || item.trackId || item.collectionName}-${item.artistName}`} onClick={() => chooseOnline(item)}>
              <img src={itemCover} alt={`Copertina ${item.collectionName}`} loading="lazy"/>
              <span className="cover-result-info"><b>{item.collectionName}</b><span>{item.artistName}</span><small>{item.releaseDate ? new Date(item.releaseDate).getFullYear() : ''}{item.primaryGenreName ? ` · ${item.primaryGenreName}` : ''}</small></span>
              {selected && <span className="cover-selected-check"><Check size={15}/></span>}
            </button>;
          })}</div>}
        </section>
        <section className="cover-device-section">
          <div className="form-section-label">OPPURE CARICA DAL DISPOSITIVO</div>
          <label className="cover-device-picker"><Upload size={19}/><span><b>Scegli un’immagine</b><small>JPG, PNG o WEBP · massimo 5 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0])}/></label>
        </section>
        <section className="cover-preview-section">
          <div className="form-section-label">ANTEPRIMA</div>
          <div className="cover-preview-card">
            <div className="cover-preview-image">{previewUrl ? <img src={previewUrl} alt="Anteprima della nuova copertina"/> : <div className="cover-preview-empty"><Disc3 size={34}/><span>Nessuna copertina selezionata</span></div>}</div>
            <div className="cover-preview-description"><b>{imageFile?.name || selectedOnline?.collectionName || album.title}</b><span>{imageFile ? 'Immagine dal dispositivo' : selectedOnline ? `${selectedOnline.artistName || artists.join(', ')} · copertina online` : 'Seleziona un risultato o carica un’immagine.'}</span></div>
          </div>
        </section>
        {error && <div className="notice error"><AlertCircle size={17}/><span>{error}</span></div>}
      </div>
      <footer className="modal-actions cover-manager-actions"><button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>Annulla</button><button type="button" className="primary-btn" onClick={saveCover} disabled={saving || (!imageFile && !selectedOnline)}>{saving ? <LoaderCircle size={17} className="spin"/> : <Check size={17}/>} Salva copertina</button></footer>
    </section>
  </div>;
}

function AlbumDetails({album,user,onClose,onChanged}) {
  const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  const [showCoverManager, setShowCoverManager] = useState(false);
  const artists = album.artistNames || (album.artists||[]).map(a=>typeof a==='string'?a:a.name).filter(Boolean);
  const personalItem=album.personalItem;
  const releases=album.releases||[];
  const money = n => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n)||0);
  async function addRelease(release){
    setSaving(true);setError('');
    try{
      const {data:existing,error:readError}=await supabase.from('collection_items').select('id').eq('owner_id',user.id).eq('release_id',release.id).maybeSingle();
      if(readError)throw readError;if(existing){setError('Questa edizione è già nella tua collezione.');return;}
      const {error:insertError}=await supabase.from('collection_items').insert({owner_id:user.id,release_id:release.id,vinyl_condition:'Near Mint (NM)',sleeve_condition:'Very Good Plus (VG+)'});
      if(insertError)throw insertError;onChanged();
    }catch(err){setError(friendlyError(err));}finally{setSaving(false);}
  }
  return <><div className="modal-backdrop detail-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="detail-modal"><button className="icon-btn detail-close" onClick={onClose}><X size={20}/></button><div className="detail-cover"><Cover album={album} large/><span className="detail-art-label">VINILI ARCHIVE / {String(album.id||'').padStart(4,'0')}</span></div><div className="detail-content"><span className="eyebrow">{album.genreName||album.genres?.name||'ALBUM'} · SCHEDA DISCO</span><div className="detail-title-line"><h2>{album.title}</h2><YouTubeLink title={album.title} artist={artists.join(', ')}/></div><p className="detail-artist">{artists.join(', ')||'Artista non indicato'}</p><div className="detail-meta"><div><span>ANNO ALBUM</span><b>{album.release_year||'—'}</b></div><div><span>EDIZIONI</span><b>{releases.length}</b></div></div><button type="button" className="secondary-btn cover-manage-button" onClick={() => setShowCoverManager(true)}><ImagePlus size={16}/>{album.cover_url ? 'Cambia copertina' : 'Aggiungi copertina'}</button><button type="button" className="secondary-btn catalog-detail-edit-button" onClick={() => { onClose(); window.setTimeout(() => window.dispatchEvent(new CustomEvent('vinili:edit-album',{detail:{albumId:album.id}})), 0); }}><Pencil size={16}/> Modifica scheda</button>{album.description&&<p className="detail-description">{album.description}</p>}
      <div className="form-section-label">EDIZIONI DEL DISCO</div>{releases.length? <div className="release-list">{releases.map(rel=>{const owned=(rel.collection_items||[]).some(i=>i.owner_id===user.id)||(personalItem&&personalItem.release?.id===rel.id);return <div className="release-row" key={rel.id}><div className="release-disc"><Disc3 size={19}/></div><div className="release-info"><b>{rel.format||'Vinile'}{rel.edition?` · ${rel.edition}`:''}</b><span>{[rel.release_year,rel.label,rel.catalog_number,rel.country].filter(Boolean).join(' · ')||'Dettagli stampa da completare'}</span></div>{owned?<span className="owned-inline"><Check size={14}/> Tuo</span>:<button className="add-icon-btn" disabled={saving} onClick={()=>addRelease(rel)} title="Aggiungi alla collezione"><Plus size={17}/></button>}</div>})}</div>:<p className="muted">Nessuna edizione registrata per questo album.</p>}
      {personalItem&&<div className="personal-details"><span className="eyebrow">LA TUA COPIA</span><div><span>Disco</span><b>{personalItem.vinyl_condition||'—'}</b></div><div><span>Copertina</span><b>{personalItem.sleeve_condition||'—'}</b></div><div><span>Prezzo d’acquisto</span><b>{personalItem.purchase_price!=null?money(personalItem.purchase_price):'—'}</b></div><div><span>Valore stimato</span><b>{personalItem.estimated_value!=null?money(personalItem.estimated_value):'—'}</b></div>{personalItem.notes&&<p>{personalItem.notes}</p>}</div>}
      {error&&<div className="notice error"><AlertCircle size={16}/>{error}</div>}<button className="secondary-btn full-btn" onClick={onClose}>Chiudi scheda</button>
    </div></section></div>
    {showCoverManager && <CoverManagerModal user={user} album={album} onClose={() => setShowCoverManager(false)} onSaved={() => { setShowCoverManager(false); onChanged(); }} />}
  </>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
