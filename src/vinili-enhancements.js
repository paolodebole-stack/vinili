import { supabase } from './supabase.js';
import {
  getViniliServiceWorker,
  subscribeToViniliPush,
  unsubscribeFromViniliPush,
  requestViniliPushTest,
  notifyCatalogChange,
} from './push.js';
import './vinili-enhancements.css';

/* Add-on non invasivo: mantiene intatto il main.jsx esistente e aggiunge i controlli al DOM dell'app corrente. */
if (supabase && typeof document !== 'undefined') {
  const normalized = (value) => String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[’‘`]/g, "'").replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

  let currentSession = null;
  let catalogCache = null;
  let catalogLoad = null;
  let enhancementQueued = false;
  let observer = null;
  let actionSequence = 0;

  async function getCatalog(force = false) {
    if (!force && catalogCache) return catalogCache;
    if (!force && catalogLoad) return catalogLoad;
    catalogLoad = (async () => {
      const { data, error } = await supabase.from('albums')
        .select('id,title,created_at,release_year,album_artists(artists(name)),releases(id,format,label,catalog_number,release_year,country,edition,collection_items(id,owner_id))')
        .order('title');
      if (error) throw error;
      catalogCache = (data || []).map((album) => ({
        ...album,
        artistNames: (album.album_artists || []).map((link) => link.artists?.name).filter(Boolean),
        releases: (album.releases || []).map((release) => ({ ...release, collection_items: release.collection_items || [] })),
      }));
      return catalogCache;
    })();
    try { return await catalogLoad; }
    finally { catalogLoad = null; }
  }

  async function countCatalog() {
    const [albumsResult, releasesResult] = await Promise.all([
      supabase.from('albums').select('id', { count: 'exact', head: true }),
      supabase.from('releases').select('id', { count: 'exact', head: true }),
    ]);
    if (albumsResult.error) throw albumsResult.error;
    if (releasesResult.error) throw releasesResult.error;
    return { albums: albumsResult.count || 0, releases: releasesResult.count || 0 };
  }

  async function latestCatalogAlbum() {
    const { data, error } = await supabase.from('albums')
      .select('id,title,created_at,album_artists(artists(name))')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return { title: data?.title || 'Nuovo vinile', artist: (data?.album_artists || []).map((link) => link.artists?.name).filter(Boolean).join(', ') || 'Artista non indicato' };
  }

  function findAlbum(title, artist, records) {
    const titleKey = normalized(title);
    if (!titleKey) return null;
    const matches = records.filter((record) => normalized(record.title) === titleKey);
    if (matches.length <= 1) return matches[0] || null;
    const artistKey = normalized(artist);
    if (!artistKey) return null;
    const exact = matches.find((record) => normalized(record.artistNames.join(', ')) === artistKey);
    if (exact) return exact;
    const partial = matches.filter((record) => {
      const names = record.artistNames.map(normalized);
      return names.some((name) => artistKey === name || artistKey.includes(name) || name.includes(artistKey));
    });
    return partial.length === 1 ? partial[0] : null;
  }

  function cardText(card, tableRow = false) {
    if (tableRow) {
      return {
        title: card.querySelector('.table-title-line b')?.textContent?.trim() || '',
        artist: card.querySelector('.table-subtitle')?.textContent?.trim() || '',
      };
    }
    return {
      title: card.querySelector('.album-card-info h3')?.textContent?.trim() || '',
      artist: card.querySelector('.album-card-info p')?.textContent?.trim() || '',
    };
  }

  function isOwned(album, userId) {
    return (album.releases || []).some((release) =>
      (release.collection_items || []).some((item) => item.owner_id === userId));
  }

  function makeStatusButton(album, owned, userId, { table = false } = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `vinili-ownership-toggle ${owned ? 'is-owned' : 'is-missing'}${table ? ' is-table' : ''}`;
    button.textContent = owned ? '✓ CE L’HO' : '× MI MANCA';
    button.setAttribute('aria-pressed', owned ? 'true' : 'false');
    button.title = owned ? 'Segna questo vinile come mancante dalla tua collezione' : 'Aggiungi questo vinile alla tua collezione';
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = 'Aggiorno…';
      try {
        const releaseIds = (album.releases || []).map((release) => release.id).filter(Boolean);
        if (owned) {
          if (releaseIds.length) {
            const { error } = await supabase.from('collection_items').delete()
              .eq('owner_id', userId).in('release_id', releaseIds);
            if (error) throw error;
          }
        } else {
          let release = (album.releases || [])[0];
          if (!release) {
            const { data, error } = await supabase.from('releases')
              .insert({ album_id: album.id, format: 'Vinile' })
              .select('id,album_id,format,label,catalog_number,release_year,country,edition')
              .single();
            if (error) throw error;
            release = data;
          }
          const { data: existing, error: readError } = await supabase.from('collection_items')
            .select('id').eq('owner_id', userId).eq('release_id', release.id).maybeSingle();
          if (readError) throw readError;
          if (!existing) {
            const { error } = await supabase.from('collection_items').insert({
              owner_id: userId,
              release_id: release.id,
              vinyl_condition: 'Near Mint (NM)',
              sleeve_condition: 'Very Good Plus (VG+)',
            });
            if (error) throw error;
          }
        }
        button.textContent = owned ? '× MI MANCA' : '✓ CE L’HO';
        button.classList.toggle('is-owned', !owned);
        button.classList.toggle('is-missing', owned);
        button.setAttribute('aria-pressed', owned ? 'false' : 'true');
        button.title = owned ? 'Vinile segnato come mancante' : 'Vinile aggiunto alla tua collezione';
        const badge = button.closest('.album-card')?.querySelector('.owned-badge');
        if (badge) badge.hidden = owned;
        window.setTimeout(() => window.location.reload(), 450);
      } catch (error) {
        console.error('VINILI: aggiornamento possesso fallito', error);
        button.textContent = owned ? '✓ CE L’HO' : '× MI MANCA';
        button.disabled = false;
        showToast(error?.message || 'Non è stato possibile aggiornare il possesso. Controlla i permessi Supabase.');
      }
    });
    return button;
  }

  function showToast(message) {
    let toast = document.getElementById('vinili-feature-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'vinili-feature-toast';
      toast.className = 'vinili-feature-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toast._hideTimer);
    toast._hideTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 6500);
  }

  async function enhanceOwnershipControls() {
    if (!currentSession?.user || !document.querySelector('.main-content')) return;
    const heading = document.querySelector('.topbar .crumb b')?.textContent || '';
    if (!/CATALOGO MUSICALE|LA MIA COLLEZIONE/i.test(heading)) return;
    let records;
    try { records = await getCatalog(); }
    catch (error) { console.warn('VINILI: controllo possesso non disponibile', error); return; }

    document.querySelectorAll('main.main-content .album-grid > article.album-card').forEach((card) => {
      if (card.dataset.viniliOwnershipReady === '1') return;
      const { title, artist } = cardText(card);
      const album = findAlbum(title, artist, records);
      if (!album) return;
      card.dataset.viniliOwnershipReady = '1';
      const owned = isOwned(album, currentSession.user.id);
      const button = makeStatusButton(album, owned, currentSession.user.id);
      if (card.classList.contains('collection-album-card')) {
        const actions = card.querySelector('.collection-card-actions');
        if (actions) actions.prepend(button);
        else card.appendChild(button);
      } else {
        const row = document.createElement('div');
        row.className = 'vinili-ownership-row';
        row.appendChild(button);
        card.appendChild(row);
      }
    });

    document.querySelectorAll('table.catalog-table tbody tr').forEach((row) => {
      if (row.dataset.viniliOwnershipReady === '1') return;
      const { title, artist } = cardText(row, true);
      const album = findAlbum(title, artist, records);
      const actions = row.querySelector('.table-actions');
      if (!album || !actions) return;
      row.dataset.viniliOwnershipReady = '1';
      actions.appendChild(makeStatusButton(album, isOwned(album, currentSession.user.id), currentSession.user.id, { table: true }));
    });
  }

  function ensurePreferencesTrigger() {
    const area = document.querySelector('.topbar .top-actions');
    if (!area || area.querySelector('.vinili-preferences-trigger')) return;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'vinili-preferences-trigger';
    trigger.innerHTML = '<span aria-hidden="true">⚙</span><span>Notifiche e sicurezza</span>';
    trigger.title = 'Notifiche e accesso biometrico';
    trigger.addEventListener('click', openPreferences);
    const avatar = area.querySelector('.avatar-small');
    area.insertBefore(trigger, avatar || null);
  }

  function ensurePasskeyLoginButton() {
    const panel = document.querySelector('.auth-panel');
    const form = panel?.querySelector('form.auth-form');
    const heading = panel?.querySelector('h2')?.textContent || '';
    const loginMode = /Rientra nella tua collezione/i.test(heading);
    const existing = panel?.querySelector('.vinili-passkey-login');
    if (!panel || !form || !loginMode) { existing?.remove(); return; }
    if (existing) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vinili-passkey-login';
    button.innerHTML = '<span aria-hidden="true">◉</span> Accedi con Face ID o impronta';
    button.addEventListener('click', async () => {
      button.disabled = true;
      const original = button.textContent;
      button.textContent = 'Autenticazione…';
      try {
        if (!supabase.auth.signInWithPasskey) throw new Error('Questa versione del client non include le passkey. Aggiorna e ripubblica le dipendenze.');
        const { error } = await supabase.auth.signInWithPasskey();
        if (error) throw error;
      } catch (error) {
        const msg = String(error?.message || error);
        if (/passkey_disabled/i.test(msg)) showToast('Prima abilita le passkey su Supabase → Authentication → Passkeys e imposta il dominio autorizzato.');
        else showToast(msg);
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    });
    form.insertAdjacentElement('afterend', button);
  }

  function getModal() {
    let modal = document.getElementById('vinili-device-preferences');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'vinili-device-preferences';
    modal.className = 'vinili-feature-backdrop';
    modal.innerHTML = `
      <section class="vinili-feature-modal" role="dialog" aria-modal="true" aria-labelledby="vinili-feature-title">
        <header class="vinili-feature-head"><div><span class="vinili-feature-kicker">IL TUO ACCOUNT</span><h2 id="vinili-feature-title">Notifiche e sicurezza</h2><p>Configura gli avvisi e l’accesso con passkey.</p></div><button type="button" class="vinili-feature-close" data-close aria-label="Chiudi">×</button></header>
        <section class="vinili-feature-card"><div class="vinili-feature-symbol">♧</div><div class="vinili-feature-card-body"><h3>Notifiche push</h3><p data-push-status>Controllo lo stato del dispositivo…</p><div class="vinili-feature-actions"><button type="button" class="vinili-feature-primary" data-enable-push>Attiva notifiche</button><button type="button" class="vinili-feature-secondary" data-test-push>Invia prova</button><button type="button" class="vinili-feature-secondary" data-disable-push>Disattiva</button></div></div></section>
        <section class="vinili-feature-card"><div class="vinili-feature-symbol">◉</div><div class="vinili-feature-card-body"><h3>Accesso biometrico</h3><p data-passkey-status>Usa una passkey per accedere con Face ID, Touch ID, Windows Hello, impronta o PIN, secondo il dispositivo.</p><div class="vinili-feature-actions"><button type="button" class="vinili-feature-primary" data-add-passkey>Registra passkey</button></div></div></section>
        <p class="vinili-feature-footnote">La passkey autentica l’accesso tramite Supabase. Le notifiche su iPhone/iPad richiedono iOS/iPadOS 16.4 o successivi e VINILI aggiunto alla schermata Home.</p>
        <p class="vinili-feature-feedback" role="status" aria-live="polite"></p>
      </section>`;
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-close]')) modal.classList.remove('is-open');
    });
    modal.querySelector('[data-enable-push]').addEventListener('click', async () => {
      const feedback = modal.querySelector('.vinili-feature-feedback');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('Accedi prima a VINILI.');
        await subscribeToViniliPush(supabase, session.user.id);
        feedback.textContent = 'Notifiche attivate per questo dispositivo.';
        await updatePushStatus(modal);
      } catch (error) { feedback.textContent = error?.message || String(error); }
    });
    modal.querySelector('[data-test-push]').addEventListener('click', async () => {
      const feedback = modal.querySelector('.vinili-feature-feedback');
      try {
        const result = await requestViniliPushTest(supabase);
        const found = Number(result.found ?? 0);
        const sent = Number(result.sent ?? 0);
        const failed = Number(result.failed ?? 0);
        const cleaned = Number(result.cleaned ?? 0);
        if (sent > 0) {
          feedback.textContent = `Dispositivi trovati: ${found}. Invii riusciti: ${sent}. Invii falliti: ${failed}.${cleaned ? ` Abbonamenti scaduti rimossi: ${cleaned}.` : ''}`;
        } else if (found === 0) {
          feedback.textContent = 'Diagnostica push: Supabase non trova abbonamenti associati al tuo account (dispositivi trovati: 0). Premi “Attiva notifiche”, attendi la conferma e riprova.';
        } else {
          feedback.textContent = `Diagnostica push: dispositivi trovati ${found}, invii riusciti 0, invii falliti ${failed}.${cleaned ? ` Abbonamenti scaduti rimossi: ${cleaned}.` : ''} Il dispositivo è registrato ma il servizio push rifiuta l’invio. Controlliamo i log Supabase.`;
        }
      } catch (error) { feedback.textContent = error?.message || String(error); }
    });
    modal.querySelector('[data-disable-push]').addEventListener('click', async () => {
      const feedback = modal.querySelector('.vinili-feature-feedback');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('Accedi prima a VINILI.');
        await unsubscribeFromViniliPush(supabase, session.user.id);
        feedback.textContent = 'Notifiche disattivate su questo dispositivo.';
        await updatePushStatus(modal);
      } catch (error) { feedback.textContent = error?.message || String(error); }
    });
    modal.querySelector('[data-add-passkey]').addEventListener('click', async () => {
      const feedback = modal.querySelector('.vinili-feature-feedback');
      const button = modal.querySelector('[data-add-passkey]');
      button.disabled = true;
      try {
        if (!supabase.auth.registerPasskey) throw new Error('Il client passkey non è disponibile. Controlla che @supabase/supabase-js sia aggiornato a 2.105.0 o successivo.');
        const { data, error } = await supabase.auth.registerPasskey();
        if (error) throw error;
        feedback.textContent = `Passkey registrata${data?.friendly_name ? ` (${data.friendly_name})` : ''}. Al prossimo accesso potrai scegliere Face ID, impronta, PIN o il gestore passkey.`;
        await updatePasskeyStatus(modal);
      } catch (error) {
        const msg = String(error?.message || error);
        feedback.textContent = /passkey_disabled/i.test(msg)
          ? 'Le passkey non sono abilitate su Supabase. In Authentication → Passkeys attiva la funzione e configura RP ID e Origin come paolodebole-stack.github.io e https://paolodebole-stack.github.io.'
          : msg;
      } finally { button.disabled = false; }
    });
    document.body.appendChild(modal);
    return modal;
  }

  async function updatePushStatus(modal) {
    const label = modal.querySelector('[data-push-status]');
    const enable = modal.querySelector('[data-enable-push]');
    const disable = modal.querySelector('[data-disable-push]');
    if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
      label.textContent = 'Push non disponibile in questo browser. Su iPhone apri VINILI dalla schermata Home.';
      enable.disabled = true;
      disable.disabled = true;
      return;
    }
    const permission = Notification.permission;
    let active = false;
    try {
      const registration = await navigator.serviceWorker.getRegistration(new URL(import.meta.env.BASE_URL || './', window.location.href).pathname);
      active = Boolean(await registration?.pushManager.getSubscription());
    } catch {}
    label.textContent = active && permission === 'granted'
      ? 'Attive su questo dispositivo.'
      : permission === 'denied'
        ? 'Bloccate nelle impostazioni del browser. Riabilita le notifiche nelle impostazioni del sito.'
        : 'Non ancora attive su questo dispositivo.';
    enable.disabled = active || permission === 'denied';
    disable.disabled = !active;
  }

  async function updatePasskeyStatus(modal) {
    const label = modal.querySelector('[data-passkey-status]');
    try {
      if (!supabase.auth.passkey?.list) return;
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;
      label.textContent = data?.length
        ? `${data.length} passkey registrata/e per il tuo account. Puoi accedere con il pulsante Face ID/impronta nella schermata di login.`
        : 'Nessuna passkey registrata. Tocca “Registra passkey” e conferma sul dispositivo.';
    } catch (error) {
      const msg = String(error?.message || error);
      label.textContent = /passkey_disabled/i.test(msg)
        ? 'Abilita prima le passkey nelle impostazioni Authentication → Passkeys di Supabase.'
        : 'Registra una passkey per questo account; il browser ti proporrà il metodo biometrico disponibile.';
    }
  }

  async function openPreferences() {
    const modal = getModal();
    modal.classList.add('is-open');
    modal.querySelector('.vinili-feature-feedback').textContent = '';
    await Promise.all([updatePushStatus(modal), updatePasskeyStatus(modal)]);
  }

  function scheduleEnhancement() {
    if (enhancementQueued) return;
    enhancementQueued = true;
    window.setTimeout(async () => {
      enhancementQueued = false;
      ensurePasskeyLoginButton();
      if (!currentSession?.user) return;
      ensurePreferencesTrigger();
      await enhanceOwnershipControls();
    }, 120);
  }

  function watchCatalogCreation() {
    document.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      const label = (button.textContent || '').replace(/\s+/g, ' ').trim();
      let kind = null;
      if (/^Salva il vinile$/i.test(label)) kind = 'single';
      else if (/^Importa \d+ righe$/i.test(label)) kind = 'batch';
      if (!kind || !currentSession?.user) return;
      const sequence = ++actionSequence;
      let before;
      try {
        if (catalogCache) before = { albums: catalogCache.length, releases: catalogCache.reduce((sum, album) => sum + (album.releases || []).length, 0) };
        else before = await countCatalog();
      } catch { return; }
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 7000 : 2500));
        if (sequence !== actionSequence) return;
        try {
          const after = await countCatalog();
          const albumDelta = Math.max(0, after.albums - before.albums);
          const releaseDelta = Math.max(0, after.releases - before.releases);
          if (albumDelta > 0 || releaseDelta > 0) {
            if (kind === 'single' && albumDelta > 0) {
              const latest = await latestCatalogAlbum();
              await notifyCatalogChange(supabase, { action: 'catalog-new', title: latest.title, artist: latest.artist });
            } else {
              await notifyCatalogChange(supabase, { action: 'catalog-import', count: albumDelta, releases: releaseDelta });
            }
            catalogCache = null;
            return;
          }
        } catch (error) { console.warn('VINILI: notifica automatica catalogo non inviata', error); }
      }
    }, true);
  }

  function start() {
    if (document.documentElement.dataset.viniliFeaturesStarted === '1') return;
    document.documentElement.dataset.viniliFeaturesStarted = '1';
    supabase.auth.getSession().then(({ data }) => {
      currentSession = data.session;
      scheduleEnhancement();
    }).catch(() => {});
    supabase.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
      catalogCache = null;
      catalogLoad = null;
      scheduleEnhancement();
    });
    observer = new MutationObserver(scheduleEnhancement);
    const root = document.getElementById('root');
    if (root) observer.observe(root, { childList: true, subtree: true });
    scheduleEnhancement();
    watchCatalogCreation();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
