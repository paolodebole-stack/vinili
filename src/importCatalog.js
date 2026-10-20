import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

const ALIASES = {
  artist: ['artista', 'artisti', 'interprete', 'gruppo', 'band', 'cantante', 'artist', 'artists', 'performer', 'musician'],
  title: ['titolo', 'titolo album', 'titolo traccia', 'titolo traccia e p', 'titolo del disco', 'album', 'nome album', 'disco', 'titolo disco', 'record', 'album title', 'title', 'release title'],
  year: ['anno album', 'anno originale', 'anno pubblicazione', 'anno', 'year', 'album year', 'original year'],
  genre: ['genere', 'categoria', 'genre', 'style', 'stile'],
  format: ['formato', 'format', 'supporto', 'media', 'tipo disco', 'tipo'],
  label: ['etichetta', 'etichetta label', 'casa discografica', 'label', 'record label', 'publisher'],
  catalog_number: ['numero catalogo', 'numero di catalogo', 'n catalogo', 'catalogo', 'catalog number', 'cat no', 'reference', 'riferimento'],
  release_year: ['anno stampa', 'anno edizione', 'anno pressaggio', 'pressing year', 'edition year', 'stampa'],
  country: ['paese', 'paese stampa', 'country', 'made in', 'origine'],
  edition: ['edizione', 'note mix', 'note versione', 'note sulla versione', 'mix principale', 'versione mix', 'stampa', 'pressing', 'versione', 'edition', 'variant', 'remix', 'mix'],
  vinyl_condition: ['condizione disco', 'stato disco', 'vinile', 'vinyl condition', 'media condition', 'condizione vinile'],
  sleeve_condition: ['condizione copertina', 'stato copertina', 'sleeve condition', 'cover condition', 'jacket condition'],
  purchase_price: ['prezzo acquisto', 'prezzo', 'costo', 'pagato', 'purchase price', 'price', 'cost', 'paid'],
  estimated_value: ['valore stimato', 'valore', 'quotazione', 'estimated value', 'market value'],
  purchase_date: ['data acquisto', 'acquistato il', 'purchase date', 'date bought', 'acquired'],
  notes: ['note personali', 'annotazioni personali', 'commenti', 'comments', 'personal notes'],
  cover_url: ['copertina url', 'cover url', 'image url', 'cover']
};

export const normalizeCatalogText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const yearPattern = /\b(18\d{2}|19\d{2}|20\d{2}|2100)\b/;
const aliasEntries = Object.entries(ALIASES).flatMap(([field, aliases]) =>
  aliases.map((alias) => ({ field, alias: normalizeCatalogText(alias) }))
);

function fieldFromHeader(header) {
  const key = normalizeCatalogText(header);
  if (!key) return null;
  const exact = aliasEntries.find((entry) => entry.alias === key);
  if (exact) return exact.field;

  // Header labels often add clarifying words, for example "Etichetta (Label)"
  // or "Titolo Traccia / E.P.". Match only reasonably specific multi-word aliases.
  const candidate = aliasEntries
    .filter((entry) => entry.alias.length >= 5 && (key.includes(entry.alias) || entry.alias.includes(key)))
    .sort((a, b) => b.alias.length - a.alias.length)[0];
  if (candidate) return candidate.field;

  if (/\b(note|mix|remix|versione)\b/.test(key)) return 'edition';
  if (/\b(numero|n)\b.*\bcatalog/.test(key)) return 'catalog_number';
  return null;
}

function detectHeader(rows) {
  let best = { index: -1, score: 0, mapping: {} };
  for (let index = 0; index < Math.min(rows.length, 15); index++) {
    const mapping = {};
    (rows[index] || []).forEach((cell, col) => {
      const field = fieldFromHeader(cell);
      if (field && mapping[field] === undefined) mapping[field] = col;
    });
    const score = Object.keys(mapping).length;
    const hasCore = mapping.title !== undefined && mapping.artist !== undefined;
    const weighted = score + (hasCore ? 4 : 0);
    if (weighted > best.score) best = { index, score: weighted, mapping, fieldCount: score, hasCore };
  }
  return best.fieldCount >= 2 && best.hasCore
    ? best
    : { index: -1, score: 0, mapping: {} };
}

function sanitizeNumber(value) {
  const text = clean(value).replace(/[€£$]/g, '').replace(/\s/g, '');
  if (!text) return '';
  // Accept Italian decimal comma and common thousands separators.
  if (text.includes(',') && text.includes('.')) {
    return text.lastIndexOf(',') > text.lastIndexOf('.')
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '');
  }
  return text.replace(',', '.');
}

function mapTabularRows(rows, sourceName) {
  const normalizedRows = (rows || [])
    .map((row) => (Array.isArray(row) ? row.map(clean) : [clean(row)]))
    .filter((row) => row.some(Boolean));
  if (!normalizedRows.length) return [];

  const header = detectHeader(normalizedRows);
  let dataRows = [];
  let mode = 'heuristic';
  if (header.index >= 0) {
    mode = 'columns';
    dataRows = normalizedRows.slice(header.index + 1).map((row, offset) => {
      const item = {};
      for (const field of Object.keys(ALIASES)) {
        const col = header.mapping[field];
        item[field] = col === undefined ? '' : clean(row[col]);
      }
      const title = item.title || '';
      const artist = item.artist || '';
      const year = item.year.match(yearPattern)?.[0] || '';
      return {
        ...item,
        year,
        _sourceLine: header.index + offset + 2,
        _confidence: Number(Boolean(title)) + Number(Boolean(artist)) + Number(Boolean(year)) + Number(Boolean(item.label || item.catalog_number || item.genre)),
        _mappingMode: mode,
        _source: sourceName
      };
    });
  } else if (normalizedRows.some((row) => row.length > 1)) {
    // Headerless tables: assume the first two populated cells are artist/title,
    // but mark the result for review because column order cannot be certain.
    dataRows = normalizedRows.map((row, index) => {
      const cells = row.filter(Boolean);
      return {
        artist: cells[0] || '',
        title: cells[1] || cells[0] || '',
        year: cells.find((cell) => yearPattern.test(cell))?.match(yearPattern)?.[0] || '',
        format: cells.find((cell) => /\b(12|10|7)\s*(inch|pollici|")|vinyl|vinile|lp\b/i.test(cell)) || 'Vinile',
        label: '',
        catalog_number: '',
        genre: '',
        country: '',
        edition: '',
        _sourceLine: index + 1,
        _confidence: 1,
        _mappingMode: 'headerless',
        _source: sourceName
      };
    });
  } else {
    dataRows = normalizedRows.map((row, index) => {
      const raw = clean(row[0]);
      const parsed = parseFreeTextLine(raw);
      return {
        ...parsed,
        _sourceLine: index + 1,
        _confidence: parsed.artist ? 2 : 1,
        _mappingMode: parsed.artist ? 'free-text' : 'title-only',
        _source: sourceName
      };
    });
  }

  return dataRows
    .filter((row) => clean(row.title) || clean(row.artist))
    .map((row, index) => ({
      artist: clean(row.artist),
      title: clean(row.title),
      year: clean(row.year).match(yearPattern)?.[0] || '',
      genre: clean(row.genre),
      format: clean(row.format) || 'Vinile',
      label: clean(row.label),
      catalog_number: clean(row.catalog_number),
      release_year: clean(row.release_year).match(yearPattern)?.[0] || '',
      country: clean(row.country),
      edition: clean(row.edition),
      vinyl_condition: clean(row.vinyl_condition),
      sleeve_condition: clean(row.sleeve_condition),
      purchase_price: sanitizeNumber(row.purchase_price),
      estimated_value: sanitizeNumber(row.estimated_value),
      purchase_date: clean(row.purchase_date),
      notes: clean(row.notes),
      cover_url: clean(row.cover_url),
      _rowId: `${sourceName}-${index + 1}`,
      _sourceLine: row._sourceLine,
      _confidence: row._confidence || 0,
      _mappingMode: row._mappingMode || mode,
      _source: sourceName,
      _selected: true
    }));
}

function parseFreeTextLine(line) {
  let text = clean(line)
    .replace(/^\s*(?:[-*•▪◦]|\d{1,4}[.)-])\s*/, '')
    .replace(/\s{2,}/g, ' ');
  if (!text) return { artist: '', title: '' };

  // Split on typographic separators used in ordinary Word lists.
  const match = text.match(/^(.{1,100}?)\s*(?:[–—]|(?<=\s)-(?=\s)|\s+\|\s+|;\s*)\s*(.{1,180})$/);
  if (match) {
    let artist = clean(match[1].replace(/[_]+$/g, ''));
    let title = clean(match[2]);
    // If a short title is followed by "feat." artist, retain what the file says
    // and let the user verify the result in the preview.
    return { artist, title, year: title.match(yearPattern)?.[0] || '', format: 'Vinile', _confidence: 2, _mappingMode: 'free-text' };
  }
  return { artist: '', title: text, year: text.match(yearPattern)?.[0] || '', format: 'Vinile', _confidence: 1, _mappingMode: 'title-only' };
}

async function parseDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const html = await mammoth.convertToHtml({ arrayBuffer });
  const doc = new DOMParser().parseFromString(html.value, 'text/html');
  const tables = [...doc.querySelectorAll('table')].map((table) =>
    [...table.querySelectorAll('tr')].map((tr) =>
      [...tr.querySelectorAll('th,td')].map((cell) => cell.textContent.trim())
    )
  ).filter((rows) => rows.length);
  const bestTable = tables
    .map((rows) => ({ rows, detected: detectHeader(rows) }))
    .filter((entry) => entry.detected.index >= 0)
    .sort((a, b) => b.detected.fieldCount - a.detected.fieldCount)[0];
  if (bestTable) return mapTabularRows(bestTable.rows, file.name);

  // Word lists with one record per paragraph or bullet, rather than a table.
  const raw = (await mammoth.extractRawText({ arrayBuffer })).value;
  const lines = raw.split(/\r?\n/).map(clean).filter(Boolean);
  return mapTabularRows(lines.map((line) => [line]), file.name);
}

async function parsePdf(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const byY = new Map();
    for (const part of content.items) {
      if (!part.str?.trim()) continue;
      const y = Math.round(part.transform?.[5] || 0);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push({ x: part.transform?.[4] || 0, text: part.str });
    }
    for (const [, items] of [...byY.entries()].sort((a, b) => b[0] - a[0])) {
      const line = items.sort((a, b) => a.x - b.x).map((item) => item.text).join('   ').trim();
      if (line) lines.push([line]);
    }
  }
  const records = mapTabularRows(lines, file.name);
  if (!records.length) throw new Error('Non ho trovato testo leggibile nel PDF. Se è una scansione, converti le pagine in testo o Excel e riprova.');
  return records;
}

export async function parseCatalogFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) return parseDocx(file);
  if (/\.(xlsx|xls|xlsm|ods)$/i.test(name)) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return mapTabularRows(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }), file.name);
  }
  if (/\.(csv|tsv)$/i.test(name)) {
    const readOptions = { type: 'string', raw: false };
    if (name.endsWith('.tsv')) readOptions.FS = '\t';
    const workbook = XLSX.read(await file.text(), readOptions);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return mapTabularRows(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }), file.name);
  }
  if (name.endsWith('.txt')) {
    return mapTabularRows((await file.text()).split(/\r?\n/).map((line) => [line]), file.name);
  }
  if (name.endsWith('.pdf')) return parsePdf(file);
  if (name.endsWith('.doc')) throw new Error('Il formato Word .doc è quello storico. Aprilo in Word e salvalo come .docx, poi riprova.');
  throw new Error('Formato non supportato. Usa Word (.docx), Excel (.xlsx/.xls), CSV, TSV, TXT o PDF testuale.');
}
