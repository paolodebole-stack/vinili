import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function formatNames(release: any): string[] {
  const formats = Array.isArray(release?.formats) ? release.formats : [];
  return formats.flatMap((f: any) => [f?.name, ...(Array.isArray(f?.descriptions) ? f.descriptions : [])]).filter(Boolean).map((v: any) => String(v));
}
function classify(formats: string[]) {
  const value = formats.join(" ").toLowerCase();
  return {
    vinyl: /\b(vinyl|lp|12"|10"|7"|45 rpm|33 1\/3 rpm|78 rpm|flexi)\b/.test(value),
    cd: /\b(cd|cd-r|compact disc|mini cd)\b/.test(value),
    digital: /\b(file|digital|mp3|flac|wav|ogg|aac|download)\b/.test(value),
  };
}
function trackMatches(tracklist: any[], requestedTitle: string) {
  const target = normalize(requestedTitle);
  return (tracklist || []).some((track: any) => track?.type_ !== "heading" && normalize(track?.title) === target);
}
function artistMatches(release: any, requestedArtist: string) {
  const target = normalize(requestedArtist);
  if (!target) return true;
  const names = [...(release?.artists || []).map((a: any) => a?.name), ...(release?.tracklist || []).flatMap((t: any) => (t?.artists || []).map((a: any) => a?.name))].map(normalize).filter(Boolean);
  return names.some((name: string) => name === target || name.includes(target) || target.includes(name));
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Metodo non supportato" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const body = await req.json();
    const artist = String(body?.artist || "").trim().slice(0, 180);
    const title = String(body?.title || "").trim().slice(0, 220);
    if (!artist || !title) return new Response(JSON.stringify({ error: "Inserisci artista e titolo del brano." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const headers: Record<string, string> = { "User-Agent": "ViniliDiscovery/1.0 +https://github.com/paolodebole-stack/vinili", "Accept": "application/vnd.discogs.v2+json" };
    const token = Deno.env.get("DISCOGS_TOKEN");
    if (token) headers.Authorization = `Discogs token=${token}`;
    const params = new URLSearchParams({ type: "release", track: title, artist, per_page: "100", page: "1" });
    const searchResponse = await fetch(`https://api.discogs.com/database/search?${params}`, { headers });
    if (searchResponse.status === 429) throw new Error("Limite temporaneo Discogs raggiunto. Attendi qualche minuto e riprova.");
    if (!searchResponse.ok) throw new Error(`Discogs ha risposto con codice ${searchResponse.status}.`);
    const search = await searchResponse.json();
    const results = Array.isArray(search?.results) ? search.results : [];
    if (!results.length) return new Response(JSON.stringify({ status: "not_found", vinyl: null, cd: null, digital: null, matches: [], message: "Nessuna pubblicazione trovata con questa ricerca." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const checked = [];
    const candidates = results.slice(0, 8);
    let checkedCount = 0;
    let verificationIncomplete = false;
    for (const candidate of candidates) {
      if (!candidate?.id) { verificationIncomplete = true; continue; }
      if (checkedCount) await sleep(1100);
      const releaseResponse = await fetch(`https://api.discogs.com/releases/${candidate.id}`, { headers });
      if (releaseResponse.status === 429) throw new Error("Limite temporaneo Discogs raggiunto. Attendi qualche minuto e riprova.");
      if (!releaseResponse.ok) { verificationIncomplete = true; continue; }
      const release = await releaseResponse.json();
      checkedCount++;
      if (!trackMatches(release?.tracklist, title) || !artistMatches(release, artist)) continue;
      const formats = formatNames(release);
      checked.push({ id: release.id, title: [release.artists_sort || artist, release.title].filter(Boolean).join(" - "), formats, year: release.year || candidate.year || "", country: release.country || candidate.country || "", labels: (release.labels || []).map((l: any) => [l.name, l.catno].filter(Boolean).join(" ")), url: release.uri || candidate.uri || `https://www.discogs.com/release/${release.id}`, classification: classify(formats) });
    }
    const searchComplete = Number(search?.pagination?.pages || 1) <= 1 && results.length <= 8 && checkedCount === candidates.length && !verificationIncomplete;
    if (!checked.length) return new Response(JSON.stringify({ status: "needs_review", vinyl: null, cd: null, digital: null, matches: [], message: "Discogs ha restituito risultati, ma non è stato possibile confermare una corrispondenza esatta nella tracklist." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const found = { vinyl: checked.some(r => r.classification.vinyl), cd: checked.some(r => r.classification.cd), digital: checked.some(r => r.classification.digital) };
    const result = { status: searchComplete ? "matched" : "needs_review", vinyl: found.vinyl ? true : searchComplete ? false : null, cd: found.cd ? true : searchComplete ? false : null, digital: found.digital ? true : searchComplete ? false : null, matches: checked.map(({ classification, ...rest }) => rest), message: searchComplete ? "" : "Sono state verificate solo alcune pubblicazioni: le categorie non confermate restano da verificare." };
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Errore durante la ricerca Discogs." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});