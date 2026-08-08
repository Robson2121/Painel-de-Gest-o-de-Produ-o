/**
 * Utilitário para conversão e manipulação segura de datas e timestamps.
 */

export function parsePtBrData(val: number | string | undefined | null): number | null {
  if (val === undefined || val === null || val === "") return null;

  if (typeof val === "number") {
    if (!isNaN(val) && val > 0) return val;
    return null;
  }

  const str = String(val).trim();
  if (!str) return null;

  // Se for apenas dígitos (ex: "1722730000000")
  if (/^\d+$/.test(str)) {
    const parsed = parseInt(str, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // Tenta parse direto pelo motor JS (ex: ISO 8601)
  const direct = Date.parse(str);
  if (!isNaN(direct) && direct > 0) {
    return direct;
  }

  // Tenta padrão "DD/MM/YYYY, HH:MM:SS" ou "DD/MM/YYYY HH:MM:SS" ou "DD/MM/YYYY HH:MM"
  const matchFull = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (matchFull) {
    const day = parseInt(matchFull[1], 10);
    const month = parseInt(matchFull[2], 10) - 1; // 0-indexed no Date JS
    const year = parseInt(matchFull[3], 10);
    const hour = parseInt(matchFull[4], 10);
    const min = parseInt(matchFull[5], 10);
    const sec = matchFull[6] ? parseInt(matchFull[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // Tenta padrão apenas de horário "HH:MM:SS" ou "HH:MM"
  const matchTime = str.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (matchTime) {
    const hour = parseInt(matchTime[1], 10);
    const min = parseInt(matchTime[2], 10);
    const sec = matchTime[3] ? parseInt(matchTime[3], 10) : 0;
    const d = new Date();
    d.setHours(hour, min, sec, 0);
    if (d.getTime() > Date.now() + 60000) {
      d.setDate(d.getDate() - 1);
    }
    return d.getTime();
  }

  return null;
}
