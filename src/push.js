// La chiave pubblica VAPID è destinata al browser. La chiave privata resta nei secret Supabase.
export const VAPID_PUBLIC_KEY = 'BJFAIk8NbZv2NIGf2MTOuevNGB3_tUir60p3_uJ1nDe22Q3XdxFBkVNzcfPohhw-tDgABpMGgJsHGHSHQh7XXqk';

export function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export async function getViniliServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Questo browser non supporta le notifiche web.');
  const base = import.meta.env.BASE_URL || './';
  const workerUrl = new URL(`${base}sw.js`, window.location.href);
  await navigator.serviceWorker.register(workerUrl.href, { scope: base });
  return navigator.serviceWorker.ready;
}

export async function subscribeToViniliPush(supabase, userId) {
  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
    throw new Error('Il browser non supporta le notifiche push. Su iPhone/iPad aggiungi prima VINILI alla schermata Home e aprilo dall’icona (iOS/iPadOS 16.4 o successivi).');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Le notifiche sono bloccate nelle impostazioni del browser. Riattivale nelle impostazioni del sito.' : 'Non hai autorizzato le notifiche.');
  const registration = await getViniliServiceWorker();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const serialized = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: serialized.endpoint,
    p256dh: serialized.keys?.p256dh,
    auth: serialized.keys?.auth,
    user_agent: navigator.userAgent,
  }, { onConflict: 'endpoint' });
  if (error) throw new Error(`Il browser ha autorizzato le notifiche, ma non è stato possibile salvare il dispositivo: ${error.message}`);
  return subscription;
}

export async function unsubscribeFromViniliPush(supabase, userId) {
  const registration = await getViniliServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', subscription.endpoint);
  if (error) throw error;
  await subscription.unsubscribe();
}

export async function requestViniliPushTest(supabase) {
  const { data, error } = await supabase.functions.invoke('vinili-push', { body: { action: 'test' } });
  if (error) throw new Error(`Invio di prova non riuscito: ${error.message}`);
  if (!data?.ok) throw new Error(data?.error || 'La funzione push non ha confermato l’invio.');
  return data;
}

export async function notifyCatalogChange(supabase, payload) {
  const { data, error } = await supabase.functions.invoke('vinili-push', { body: payload });
  if (error) throw error;
  return data;
}
