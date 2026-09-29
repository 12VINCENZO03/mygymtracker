import { getTodayStr } from './storage';

export interface ExtractedBiaData {
  date: string;
  weight: string;
  height: string;
  fm: string;
  ffm: string;
  foundCount: number;
}

interface PdfItem {
  str: string;
}

interface PdfPage {
  getTextContent(): Promise<{ items: PdfItem[] }>;
}

interface PdfDocument {
  numPages: number;
  getPage(num: number): Promise<PdfPage>;
}

declare global {
  interface Window {
    pdfjsLib?: {
      getDocument(data: ArrayBuffer | Uint8Array): { promise: Promise<PdfDocument> };
    };
  }
}

export async function extractBiaFromPdf(file: File): Promise<ExtractedBiaData> {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js non è ancora caricato nel browser');
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += ' ' + textContent.items.map((item) => item.str).join(' ');
  }

  // Remove potential false matches
  fullText = fullText.replace(/(Peso Ideale|Ideal Weight)/gi, 'XXX');

  const getVals = (regex: RegExp) => {
    const match = fullText.match(regex);
    if (!match || match.index === undefined) return [];
    const chunk = fullText.substring(match.index + match[0].length).trim().substring(0, 60);
    const regexNum = /(\d+[.,]\d+|\d+)\s*(kg|%|cm|m)?/gi;
    const res: Array<{ val: number; unit: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = regexNum.exec(chunk)) !== null && res.length < 3) {
      res.push({
        val: parseFloat(m[1].replace(',', '.')),
        unit: m[2] ? m[2].toLowerCase() : ''
      });
    }
    return res;
  };

  let extWeight = '';
  let extHeight = '';
  let extFm = '';
  let extFfm = '';
  let extDate = getTodayStr();

  const dateMatch = fullText.match(/(?:Data Visita|Date|Data|Data di esecuzione)\s*[:\-]?\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i);
  if (dateMatch) {
    extDate = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
  }

  const wVals = getVals(/(?:Peso|Weight|Body weight)\b/i);
  if (wVals.length > 0) extWeight = String(wVals[0].val);

  const hVals = getVals(/(?:Altezza|Height|Statura)\b/i);
  if (hVals.length > 0) {
    let h = hVals[0].val;
    if (h < 3) h = h * 100;
    extHeight = String(h);
  }

  const fmVals = getVals(/(?:Massa Grassa|Fat Mass|Body Fat|PBF|FM)\b/i);
  const fmPer = fmVals.find((v) => v.unit === '%')?.val;
  const fmKg = fmVals.find((v) => v.unit === 'kg')?.val;

  const ffmVals = getVals(/(?:Massa Magra|Fat Free Mass|Lean Body Mass|FFM|LBM)\b/i);
  const ffmKg = ffmVals.find((v) => v.unit === 'kg')?.val;
  const ffmPer = ffmVals.find((v) => v.unit === '%')?.val;

  if (fmPer) {
    extFm = String(fmPer);
  } else if (fmKg && extWeight) {
    extFm = ((fmKg / parseFloat(extWeight)) * 100).toFixed(1);
  }

  if (ffmKg) {
    extFfm = String(ffmKg);
  } else if (ffmPer && extWeight) {
    extFfm = ((parseFloat(extWeight) * ffmPer) / 100).toFixed(1);
  } else if (extWeight && extFm) {
    extFfm = (parseFloat(extWeight) * (1 - parseFloat(extFm) / 100)).toFixed(1);
  }

  const validate = (valStr: string, min: number, max: number): string => {
    const val = parseFloat(valStr);
    return !isNaN(val) && val >= min && val <= max ? String(val) : '';
  };

  extWeight = validate(extWeight, 30, 250);
  extHeight = validate(extHeight, 100, 230);
  extFm = validate(extFm, 2, 60);
  extFfm = validate(extFfm, 20, 150);

  const foundCount = [extWeight, extHeight, extFm, extFfm].filter((v) => v !== '').length;

  return {
    date: extDate,
    weight: extWeight,
    height: extHeight,
    fm: extFm,
    ffm: extFfm,
    foundCount
  };
}
