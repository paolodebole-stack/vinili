import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Disc3, Search, Plus, SlidersHorizontal, LogOut, Library, DiscAlbum,
  Music2, Users, Wallet, X, Check, LoaderCircle, Upload, Trash2,
  ArrowUpRight, Sparkles, CircleUserRound, Mail, LockKeyhole, ChevronDown,
  AlertCircle, RefreshCw
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from './supabase';
import './styles.css';

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
  const listing = isCollection ? collectionItems.filter(item=>{
    const q=query.trim().toLowerCase(); const search=[item.album.title,...item.artistNames,item.genreName,item.format,item.release.label,item.release.catalog_number].filter(Boolean).join(' ').toLowerCase();
    return !q||search.includes(q);
  }) : shownAlbums;

  return <div className="app-shell">
    <aside className="sidebar"><a className="brand-lockup" href="#catalog" onClick={e=>{e.preventDefault();setActiveTab('catalog')}}><div className="brand-mark"><Disc3 size={25}/></div><span>VINILI<span className="brand-dot">.</span></span></a>
      <div className="side-label">IL TUO SPAZIO</div><nav className="side-nav">
        <button className={activeTab==='catalog'?'active':''} onClick={()=>setActiveTab('catalog')}><Library size={19}/><span>Catalogo</span><span className="nav-count">{albums.length}</span></button>
        <button className={activeTab==='collection'?'active':''} onClick={()=>setActiveTab('collection')}><DiscAlbum size={19}/><span>La mia collezione</span><span className="nav-count">{myItems.length}</span></button>
      </nav>
      <div className="sidebar-note"><div className="note-icon"><Music2 size={18}/></div><p>La musica passa.<br/><b>I dischi restano.</b></p><span>Il piacere di collezionare, senza fretta.</span></div>
      <div className="sidebar-user"><div className="avatar">{(session.user.user_metadata?.display_name||session.user.email||'V').slice(0,1).toUpperCase()}</div><div className="user-details"><b>{session.user.user_metadata?.display_name||session.user.email?.split('@')[0]}</b><span>{session.user.email}</span></div><button className="icon-btn logout-btn" title="Esci" onClick={signOut}><LogOut size={17}/></button></div>
    </aside>

    <main className="main-content"><header className="topbar"><div className="crumb"><span>VINILI</span><span className="crumb-slash">/</span><b>{isCollection?'LA MIA COLLEZIONE':'CATALOGO MUSICALE'}</b></div><div className="top-actions"><span className="online-dot"/> ARCHIVIO SINCRONIZZATO <button className="avatar avatar-small" onClick={signOut} title="Esci">{(session.user.user_metadata?.display_name||session.user.email||'V').slice(0,1).toUpperCase()}</button></div></header>
      <section className="page-wrap">
        <div className="welcome-row"><div><span className="eyebrow">{isCollection?'IL TUO TESORO PERSONALE':'ESPLORA, CERCA, RICORDA'}</span><h1>{isCollection?'La tua collezione':'Il catalogo dei vinili'}<span className="title-period">.</span></h1><p className="page-subtitle">{isCollection?'Ogni copia racconta qualcosa. Qui c’è la tua storia musicale.':'Un archivio condiviso per scoprire album e custodire le tue copie.'}</p></div><button className="primary-btn add-btn" onClick={()=>setShowAdd(true)}><Plus size={18}/> Aggiungi vinile</button></div>
        <div className="stats-grid"><div className="stat-card"><div className="stat-top"><span>DISCHI A CATALOGO</span><Library size={18}/></div><div className="stat-value">{albums.length.toLocaleString('it-IT')}<span className="stat-caption">album</span></div><div className="stat-foot">Archivio condiviso</div></div><div className="stat-card"><div className="stat-top"><span>ARTISTI</span><Users size={18}/></div><div className="stat-value">{artists.length.toLocaleString('it-IT')}<span className="stat-caption">artisti</span></div><div className="stat-foot">Voci della tua musica</div></div><div className="stat-card"><div className="stat-top"><span>LA MIA COLLEZIONE</span><Disc3 size={18}/></div><div className="stat-value">{myItems.length.toLocaleString('it-IT')}<span className="stat-caption">copie</span></div><div className="stat-foot">Dischi che possiedi</div></div><div className="stat-card stat-highlight"><div className="stat-top"><span>VALORE STIMATO</span><Wallet size={18}/></div><div className="stat-value money-value">{formatMoney(collectionValue)}</div><div className="stat-foot">Somma dei valori inseriti</div></div></div>
        <section className="catalog-section"><div className="catalog-head"><div><h2>{isCollection?'Le tue copie':'Esplora i dischi'} <span className="result-count">{listing.length}</span></h2><p>{isCollection?'Edizioni e dettagli della tua collezione':'Cerca un titolo, un artista, un anno o un’etichetta.'}</p></div><div className="catalog-tools"><label className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cerca nel catalogo…"/><kbd>⌘ K</kbd>{query&&<button onClick={()=>setQuery('')} aria-label="Pulisci ricerca"><X size={15}/></button>}</label><button className={`filter-btn ${showFilters?'selected':''}`} onClick={()=>setShowFilters(s=>!s)}><SlidersHorizontal size={17}/> Filtri</button></div></div>
          {showFilters && !isCollection && <div className="filter-panel"><label>Genere<select value={genreFilter} onChange={e=>setGenreFilter(e.target.value)}><option value="all">Tutti i generi</option>{genres.map(g=><option key={g.id} value={g.name}>{g.name}</option>)}</select></label><label>Formato<select value={formatFilter} onChange={e=>setFormatFilter(e.target.value)}><option value="all">Tutti i formati</option>{formats.map(f=><option key={f} value={f}>{f}</option>)}</select></label><label className="check-filter"><input type="checkbox" checked={showMineOnly} onChange={e=>setShowMineOnly(e.target.checked)}/> Solo album che possiedo</label><button className="text-btn" onClick={()=>{setGenreFilter('all');setFormatFilter('all');setShowMineOnly(false)}}>Azzera filtri</button></div>}
          {error&&<div className="notice error page-notice"><AlertCircle size={17}/><span>{error}</span><button className="text-btn" onClick={loadData}><RefreshCw size={15}/> Riprova</button></div>}
          {successMessage&&<div className="notice success page-notice"><Check size={17}/>{successMessage}<button className="icon-btn" onClick={()=>setSuccessMessage('')}><X size={15}/></button></div>}
          {loadingData ? <div className="empty-state"><LoaderCircle className="spin" size={30}/><b>Sto aggiornando l’archivio…</b><span>Sincronizzazione con Supabase</span></div> : listing.length ? <div className="album-grid">{isCollection ? listing.map(item=><article className="album-card" key={`item-${item.id}`}><button className="album-hit-area" onClick={()=>setSelectedAlbum({...item.album,artists:item.artistNames.map(name=>({name})),artistNames:item.artistNames,genreName:item.genreName,releases:[item.release],personalItem:item})}><div className="cover-wrap"><Cover album={item.album}/><span className="format-pill">{item.format}</span><span className="owned-badge"><Check size={12}/> IN COLLEZIONE</span></div><div className="album-card-info"><span className="album-genre">{item.genreName}</span><h3>{item.album.title}</h3><p>{item.artistNames.join(', ')||'Artista non indicato'}</p><div className="album-card-foot"><span>{item.release.release_year||item.album.release_year||'Anno n.d.'}</span><span>{item.estimated_value?formatMoney(item.estimated_value):'Valore n.d.'}</span></div></div></button><button className="remove-item" title="Rimuovi dalla collezione" onClick={()=>deleteItem(item)}><Trash2 size={15}/></button></article>) : listing.map(album=><article className="album-card" key={album.id}><button className="album-hit-area" onClick={()=>setSelectedAlbum(album)}><div className="cover-wrap"><Cover album={album}/>{album.releases.length>0&&<span className="format-pill">{album.releases[0].format||'Vinile'}</span>}{album.releases.some(r=>(r.collection_items||[]).some(i=>i.owner_id===session.user.id))&&<span className="owned-badge"><Check size={12}/> IN COLLEZIONE</span>}</div><div className="album-card-info"><span className="album-genre">{album.genreName}</span><h3>{album.title}</h3><p>{artistsOf(album)}</p><div className="album-card-foot"><span>{album.release_year||'Anno n.d.'}</span><span>{album.releases.length} {album.releases.length===1?'edizione':'edizioni'}</span></div></div></button></article>)}</div> : <div className="empty-state"><div className="empty-icon"><Disc3 size={31}/></div><h3>{isCollection?'La tua collezione inizia da qui':'Il catalogo è pronto per il primo disco'}</h3><p>{query?'Nessun risultato con questa ricerca. Prova un altro termine.':isCollection?'Aggiungi il tuo primo vinile per iniziare a costruire il tuo archivio personale.':'Aggiungi un album per iniziare a costruire l’archivio condiviso con i tuoi amici.'}</p>{query?<button className="secondary-btn" onClick={()=>setQuery('')}>Pulisci ricerca</button>:<button className="primary-btn" onClick={()=>setShowAdd(true)}><Plus size={17}/> Aggiungi il primo vinile</button>}</div>}
        </section><footer className="page-footer"><span>VINILI<span className="brand-dot">.</span> — IL PIACERE DI COLLEZIONARE</span><span>CATALOGO CONDIVISO · COLLEZIONI PERSONALI</span></footer>
      </section>
    </main>
    {showAdd&&<AddAlbumModal user={session.user} onClose={()=>setShowAdd(false)} onSaved={()=>{setSuccessMessage('Vinile aggiunto correttamente.');loadData();}}/>}
    {selectedAlbum&&<AlbumDetails album={selectedAlbum} user={session.user} onClose={()=>setSelectedAlbum(null)} onChanged={()=>{setSelectedAlbum(null);loadData();}}/>}
  </div>;
}

function AlbumDetails({album,user,onClose,onChanged}) {
  const [saving,setSaving]=useState(false);const [error,setError]=useState('');
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
  return <div className="modal-backdrop detail-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="detail-modal"><button className="icon-btn detail-close" onClick={onClose}><X size={20}/></button><div className="detail-cover"><Cover album={album} large/><span className="detail-art-label">VINILI ARCHIVE / {String(album.id||'').padStart(4,'0')}</span></div><div className="detail-content"><span className="eyebrow">{album.genreName||album.genres?.name||'ALBUM'} · SCHEDA DISCO</span><h2>{album.title}</h2><p className="detail-artist">{artists.join(', ')||'Artista non indicato'}</p><div className="detail-meta"><div><span>ANNO ALBUM</span><b>{album.release_year||'—'}</b></div><div><span>EDIZIONI</span><b>{releases.length}</b></div></div>{album.description&&<p className="detail-description">{album.description}</p>}
      <div className="form-section-label">EDIZIONI DEL DISCO</div>{releases.length? <div className="release-list">{releases.map(rel=>{const owned=(rel.collection_items||[]).some(i=>i.owner_id===user.id)||(personalItem&&personalItem.release?.id===rel.id);return <div className="release-row" key={rel.id}><div className="release-disc"><Disc3 size={19}/></div><div className="release-info"><b>{rel.format||'Vinile'}{rel.edition?` · ${rel.edition}`:''}</b><span>{[rel.release_year,rel.label,rel.catalog_number,rel.country].filter(Boolean).join(' · ')||'Dettagli stampa da completare'}</span></div>{owned?<span className="owned-inline"><Check size={14}/> Tuo</span>:<button className="add-icon-btn" disabled={saving} onClick={()=>addRelease(rel)} title="Aggiungi alla collezione"><Plus size={17}/></button>}</div>})}</div>:<p className="muted">Nessuna edizione registrata per questo album.</p>}
      {personalItem&&<div className="personal-details"><span className="eyebrow">LA TUA COPIA</span><div><span>Disco</span><b>{personalItem.vinyl_condition||'—'}</b></div><div><span>Copertina</span><b>{personalItem.sleeve_condition||'—'}</b></div><div><span>Prezzo d’acquisto</span><b>{personalItem.purchase_price!=null?money(personalItem.purchase_price):'—'}</b></div><div><span>Valore stimato</span><b>{personalItem.estimated_value!=null?money(personalItem.estimated_value):'—'}</b></div>{personalItem.notes&&<p>{personalItem.notes}</p>}</div>}
      {error&&<div className="notice error"><AlertCircle size={16}/>{error}</div>}<button className="secondary-btn full-btn" onClick={onClose}>Chiudi scheda</button>
    </div></section></div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
