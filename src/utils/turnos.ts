import { Turno } from "../types";

export const DEFAULT_TURNOS: Turno[] = [
  { id: "t1", nome: "1º Turno (Manhã)", inicio: "06:00", termino: "14:00" },
  { id: "t2", nome: "2º Turno (Tarde)", inicio: "14:00", termino: "22:00" },
  { id: "t3", nome: "3º Turno (Noite)", inicio: "22:00", termino: "06:00" },
];

function converterParaMinutos(horarioStr: string): number {
  if (!horarioStr) return 0;
  const parts = horarioStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function pertenceAoTurno(timestamp: number | string, turno: Turno): boolean {
  if (!timestamp) return false;

  let date: Date;
  if (typeof timestamp === "number") {
    date = new Date(timestamp);
  } else if (/^\d+$/.test(timestamp)) {
    date = new Date(parseInt(timestamp, 10));
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) return false;

  const minAtual = date.getHours() * 60 + date.getMinutes();
  const minInicio = converterParaMinutos(turno.inicio);
  const minTermino = converterParaMinutos(turno.termino);

  if (minInicio < minTermino) {
    return minAtual >= minInicio && minAtual < minTermino;
  } else if (minInicio > minTermino) {
    // Turno que atravessa a meia-noite (ex: 22:00 às 06:00)
    return minAtual >= minInicio || minAtual < minTermino;
  } else {
    // 24 horas
    return true;
  }
}

export function obterTurnoAtual(turnos: Turno[], dateVal: Date = new Date()): Turno {
  const listaTurnos = turnos && turnos.length > 0 ? turnos : DEFAULT_TURNOS;
  const minAtual = dateVal.getHours() * 60 + dateVal.getMinutes();

  for (const t of listaTurnos) {
    const minInicio = converterParaMinutos(t.inicio);
    const minTermino = converterParaMinutos(t.termino);

    if (minInicio < minTermino) {
      if (minAtual >= minInicio && minAtual < minTermino) {
        return t;
      }
    } else if (minInicio > minTermino) {
      if (minAtual >= minInicio || minAtual < minTermino) {
        return t;
      }
    } else {
      return t;
    }
  }

  return listaTurnos[0] || DEFAULT_TURNOS[0];
}

export function tempoRestanteTurno(turno: Turno, dateVal: Date = new Date()): string {
  const minAtual = dateVal.getHours() * 60 + dateVal.getMinutes();
  const secAtual = dateVal.getSeconds();
  const minTermino = converterParaMinutos(turno.termino);

  let diffMin = 0;
  if (minTermino > minAtual) {
    diffMin = minTermino - minAtual;
  } else {
    diffMin = (1440 - minAtual) + minTermino;
  }

  let totalSegundosRestantes = diffMin * 60 - secAtual;
  if (totalSegundosRestantes < 0) totalSegundosRestantes = 0;

  const horas = Math.floor(totalSegundosRestantes / 3600);
  const minutos = Math.floor((totalSegundosRestantes % 3600) / 60);
  const segundos = totalSegundosRestantes % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(horas)}h ${pad(minutos)}m ${pad(segundos)}s`;
}
