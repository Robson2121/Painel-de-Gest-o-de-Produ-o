/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { BarChart2, AlertTriangle, TrendingUp, Activity, Cpu, Clock, Filter, Layers, CheckCircle2 } from "lucide-react";
import { PedidoCarrinho, OcorrenciaLider, Estatisticas, Turno } from "../types";
import { obterTurnoAtual, tempoRestanteTurno, pertenceAoTurno, DEFAULT_TURNOS } from "../utils/turnos";

interface DashboardViewProps {
  pedidos: PedidoCarrinho[];
  ocorrencias: OcorrenciaLider[];
  estatisticas: Estatisticas;
  turnos?: Turno[];
}

export default function DashboardView({ pedidos, ocorrencias, estatisticas, turnos = DEFAULT_TURNOS }: DashboardViewProps) {
  const listaTurnos = turnos && turnos.length > 0 ? turnos : DEFAULT_TURNOS;
  
  // Turno selecionado no filtro ("ATUAL", "TODOS", ou id do turno)
  const [filtroTurnoId, setFiltroTurnoId] = useState<string>("ATUAL");
  const [agora, setAgora] = useState(new Date());

  // Atualiza o relógio interno a cada segundo para o contador regressivo de turno
  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const turnoAtualSistema = obterTurnoAtual(listaTurnos, agora);

  // Determina qual turno está sendo visualizado
  const turnoExibido = filtroTurnoId === "TODOS"
    ? null
    : filtroTurnoId === "ATUAL"
    ? turnoAtualSistema
    : listaTurnos.find(t => t.id === filtroTurnoId) || turnoAtualSistema;

  // Filtra pedidos e ocorrências pelo turno selecionado
  const pedidosFiltrados = turnoExibido
    ? pedidos.filter(p => pertenceAoTurno(p.timestamp, turnoExibido))
    : pedidos;

  const ocorrenciasFiltradas = turnoExibido
    ? ocorrencias.filter(o => pertenceAoTurno(o.timestamp, turnoExibido))
    : ocorrencias;

  // Recalcula estatísticas para o filtro de turno
  const porMaquinaFiltrado: Record<string, number> = {};
  pedidosFiltrados.forEach(p => {
    porMaquinaFiltrado[p.maquina] = (porMaquinaFiltrado[p.maquina] || 0) + 1;
  });

  const maquinasLista = [
    "K1014-1", "K1014-2", "K1014-3", "K1014-4", "K1014-6", "K1014-7",
    "K1014-8", "K1014-9", "K1014-10", "K813-1", "K813-2", "K68-1",
    "K68-2", "T-Line 1", "T-Line 2", "K1318", "TEUBERT"
  ];

  // Identifica máquinas com ocorrência ativa
  const maquinasParadas = ocorrenciasFiltradas
    .filter(o => o.status === "ATIVA")
    .map(o => o.maquina);

  // Top máquina
  const topMaquina = Object.entries(porMaquinaFiltrado).length > 0
    ? Object.entries(porMaquinaFiltrado).sort((a, b) => b[1] - a[1])[0]
    : ["-", 0];

  const contagemRegressiva = tempoRestanteTurno(turnoAtualSistema, agora);

  return (
    <div className="space-y-6" id="dashboard-view">
      {/* CARD PAINEL DE MONITORAMENTO DO TURNO EM TEMPO REAL */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Turno Ativo no Sistema:
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black rounded-md flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                  {turnoAtualSistema.nome}
                </span>
              </div>
              <p className="text-white font-extrabold text-lg mt-0.5">
                Horário Operacional: <span className="text-amber-400">{turnoAtualSistema.inicio} às {turnoAtualSistema.termino}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-900/90 border border-slate-700 px-4 py-2 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Tempo para Próximo Turno
              </span>
              <span className="text-sm font-black font-mono text-amber-400">
                ⏱️ {contagemRegressiva}
              </span>
            </div>

            {/* Selector de Filtro por Turno */}
            <div className="flex items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-700 overflow-x-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase px-2 flex items-center gap-1">
                <Filter className="h-3 w-3" /> Turno:
              </span>
              <button
                onClick={() => setFiltroTurnoId("ATUAL")}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  filtroTurnoId === "ATUAL"
                    ? "bg-amber-500 text-slate-950 shadow-md font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Atual
              </button>
              {listaTurnos.map(t => (
                <button
                  key={t.id}
                  onClick={() => setFiltroTurnoId(t.id)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    filtroTurnoId === t.id
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t.nome.split(" ")[0]}
                </button>
              ))}
              <button
                onClick={() => setFiltroTurnoId("TODOS")}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  filtroTurnoId === "TODOS"
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Todos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Indicadores Principais Filtrados por Turno */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">
              Solicitações Ativas ({turnoExibido ? turnoExibido.nome.split(" ")[0] : "Geral"})
            </span>
            <span className="text-3xl font-extrabold text-white mt-1 block">
              {pedidosFiltrados.filter(p => p.status !== "FINALIZADO").length}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <Activity className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">
              Moldadoras Paradas (Líder)
            </span>
            <span className="text-3xl font-extrabold text-red-500 mt-1 block">
              {maquinasParadas.length}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 text-red-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">
              Interações no Turno
            </span>
            <span className="text-3xl font-extrabold text-emerald-400 mt-1 block">
              {pedidosFiltrados.length}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">
              Gargalo / Top Moldadora
            </span>
            <span className="text-xl font-extrabold text-amber-400 mt-1 block truncate max-w-[150px]">
              {topMaquina[0]} ({topMaquina[1]} int.)
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <Cpu className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Produtividade do Turno */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-4 overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-blue-400" />
              Volume de Interações por Moldadora
            </h3>
            <span className="text-xs text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              {turnoExibido ? turnoExibido.nome : "Todos os Turnos"}
            </span>
          </div>

          <div className="overflow-x-auto pb-4 pt-2 -mx-2 px-2">
            <div className="h-[220px] min-w-[620px] flex items-end justify-between gap-2.5 pt-6 border-b border-slate-700 pr-4">
              {maquinasLista.map(m => {
                const qtd = porMaquinaFiltrado[m] || 0;
                const maxQtd = Math.max(...Object.values(porMaquinaFiltrado), 1);
                const heightPercent = (qtd / maxQtd) * 160;
                const estaParada = maquinasParadas.includes(m);
                const barHeight = estaParada ? Math.max(heightPercent, 28) : heightPercent;

                return (
                  <div key={m} className="flex-1 flex flex-col items-center group min-w-[22px]">
                    <div className="relative w-full flex justify-center">
                      <span className={`absolute -top-7 text-[10px] font-bold ${estaParada ? "text-red-400 animate-pulse opacity-100 font-black" : "text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"}`}>
                        {estaParada ? "PARADA" : qtd}
                      </span>
                      <div
                        style={{ height: `${barHeight}px` }}
                        className={`w-full max-w-[18px] rounded-t-sm transition-all duration-500 ${
                          estaParada
                            ? "bg-red-500 animate-pulse shadow-lg shadow-red-500/50 ring-2 ring-red-400 ring-offset-1 ring-offset-slate-800"
                            : qtd > 0
                            ? "bg-blue-500 shadow-md shadow-blue-500/20"
                            : "bg-slate-700"
                        }`}
                      />
                    </div>
                    <span className={`text-[9px] font-bold mt-2 rotate-45 origin-left tracking-tight whitespace-nowrap block w-3 overflow-visible ${estaParada ? "text-red-400 font-black animate-pulse" : "text-slate-400"}`}>
                      {m}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="pt-8 flex justify-end gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-700 block"></span>
              Sem Interação
            </span>
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="h-2 w-2 rounded-full bg-blue-500 block"></span>
              Ativo
            </span>
            <span className="flex items-center gap-1.5 text-red-500">
              <span className="h-2 w-2 rounded-full bg-red-500 block"></span>
              Parada / Alerta
            </span>
          </div>
        </div>

        {/* Status em tempo real das Moldadoras */}
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-400 animate-pulse" />
              Status de Linha ({turnoExibido ? turnoExibido.nome.split(" ")[0] : "Visão Geral"})
            </h3>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[220px] pr-2">
              {maquinasLista.map(m => {
                const parou = maquinasParadas.includes(m);
                const interacoes = porMaquinaFiltrado[m] || 0;

                return (
                  <div
                    key={m}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                      parou
                        ? "bg-red-500/10 border-red-500/30 text-red-300"
                        : "bg-slate-900/50 border-slate-700 text-slate-300"
                    }`}
                  >
                    <div>
                      <span className="font-bold block text-white">{m}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {interacoes} interações
                      </span>
                    </div>
                    <span
                      className={`h-2.5 w-2.5 rounded-full block ${
                        parou ? "bg-red-500 animate-ping" : "bg-emerald-500"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* CONSOLIDAÇÃO COMPARATIVA ENTRE OS TURNOS */}
      <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Layers className="h-5 w-5 text-amber-400" />
          Resumo e Comparativo de Produção por Turno
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {listaTurnos.map(t => {
            const pTurno = pedidos.filter(p => pertenceAoTurno(p.timestamp, t));
            const oTurno = ocorrencias.filter(o => pertenceAoTurno(o.timestamp, t));
            const isAtual = t.id === turnoAtualSistema.id;

            return (
              <div
                key={t.id}
                className={`p-4 rounded-xl border space-y-3 ${
                  isAtual
                    ? "bg-amber-500/10 border-amber-500/30 text-white"
                    : "bg-slate-900/60 border-slate-700 text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm flex items-center gap-2">
                    {t.nome}
                    {isAtual && (
                      <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded uppercase">
                        Atual
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {t.inicio} - {t.termino}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Solicitações</span>
                    <span className="text-xl font-black text-blue-400 mt-0.5 block">{pTurno.length}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Ocorrências</span>
                    <span className="text-xl font-black text-red-400 mt-0.5 block">{oTurno.length}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
