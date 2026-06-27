/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { BarChart2, Brain, AlertTriangle, CheckCircle, TrendingUp, ChevronRight, Activity, Cpu } from "lucide-react";
import { motion } from "motion/react";
import { PedidoCarrinho, OcorrenciaLider, Estatisticas } from "../types";

interface DashboardViewProps {
  pedidos: PedidoCarrinho[];
  ocorrencias: OcorrenciaLider[];
  estatisticas: Estatisticas;
}

export default function DashboardView({ pedidos, ocorrencias, estatisticas }: DashboardViewProps) {
  const [analiseIa, setAnaliseIa] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erroIa, setErroIa] = useState("");

  const maquinasLista = [
    "K1014-1", "K1014-2", "K1014-3", "K1014-4", "K1014-6", "K1014-7",
    "K1014-8", "K1014-9", "K1014-10", "K813-1", "K813-2", "K68-1",
    "K68-2", "T-Line 1", "T-Line 2", "K1318", "TEUBERT"
  ];

  // Identifica máquinas com ocorrência ativa
  const maquinasParadas = ocorrencias
    .filter(o => o.status === "ATIVA")
    .map(o => o.maquina);

  // Calcula a máquina campeã de interações
  const topMaquina = Object.entries(estatisticas.porMaquina).length > 0
    ? Object.entries(estatisticas.porMaquina).sort((a, b) => b[1] - a[1])[0]
    : ["-", 0];

  const requisitarAnaliseIa = async () => {
    setGerando(true);
    setErroIa("");
    try {
      const response = await fetch("/api/analise-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const data = await response.json();
        setAnaliseIa(data.analise);
      } else {
        throw new Error("Erro de conexão com o servidor Express.");
      }
    } catch (e: any) {
      setErroIa(e.message || "Não foi possível contactar o assistente de IA.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="space-y-6" id="dashboard-view">
      {/* Indicadores Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">
              Solicitações Ativas
            </span>
            <span className="text-3xl font-extrabold text-white mt-1 block">
              {pedidos.length}
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
              {estatisticas.total}
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
        {/* Painel do BI / Gráfico de Produtividade */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-blue-400" />
              Volume de Interações por Moldadora
            </h3>
            <span className="text-xs text-slate-400 font-semibold bg-slate-700 px-2 py-1 rounded">
              Turno Atual
            </span>
          </div>

          <div className="h-[220px] flex items-end justify-between gap-3 pt-6 border-b border-slate-700">
            {maquinasLista.map(m => {
              const qtd = estatisticas.porMaquina[m] || 0;
              const maxQtd = Math.max(...Object.values(estatisticas.porMaquina), 1);
              const heightPercent = (qtd / maxQtd) * 160;

              return (
                <div key={m} className="flex-1 flex flex-col items-center group">
                  <div className="relative w-full flex justify-center">
                    <span className="absolute -top-7 text-[10px] font-bold text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {qtd}
                    </span>
                    <div
                      style={{ height: `${heightPercent}px` }}
                      className={`w-full max-w-[18px] rounded-t-sm transition-all duration-500 ${
                        maquinasParadas.includes(m)
                          ? "bg-red-500 shadow-md shadow-red-500/20"
                          : qtd > 0
                          ? "bg-blue-500 shadow-md shadow-blue-500/20"
                          : "bg-slate-700"
                      }`}
                    />
                  </div>
                  <span className="text-[8px] font-bold text-slate-400 mt-2 rotate-45 origin-left tracking-tight whitespace-nowrap block w-3 overflow-visible">
                    {m}
                  </span>
                </div>
              );
            })}
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
              Status de Linha de Moldadoras
            </h3>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[220px] pr-2">
              {maquinasLista.map(m => {
                const parou = maquinasParadas.includes(m);
                const interacoes = estatisticas.porMaquina[m] || 0;

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

      {/* Relatório Inteligente de IA (Gemini 3.5-flash) */}
      <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Brain className="h-5.5 w-5.5 text-purple-400" />
              Análise e Diagnóstico de IA (Gemini)
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Descubra gargalos recorrentes, tempos de resposta e recomendações de Lean Seis Sigma baseadas em dados.
            </p>
          </div>
          <button
            onClick={requisitarAnaliseIa}
            disabled={gerando}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-purple-500/15 disabled:cursor-not-allowed cursor-pointer"
          >
            {gerando ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Processando BI...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                Gerar Relatório de IA
              </>
            )}
          </button>
        </div>

        {erroIa && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-4 rounded-xl text-sm">
            ❌ {erroIa}
          </div>
        )}

        {analiseIa ? (
          <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-6 text-sm text-slate-300 leading-relaxed max-h-[400px] overflow-y-auto whitespace-pre-wrap font-sans">
            {analiseIa}
          </div>
        ) : (
          !gerando && (
            <div className="bg-slate-900/30 border border-dashed border-slate-700 rounded-xl p-8 text-center text-slate-500">
              <Brain className="h-10 w-10 text-slate-600 mx-auto mb-2" />
              Nenhum relatório gerado para este turno. Clique no botão acima para iniciar a análise por IA.
            </div>
          )
        )}
      </div>
    </div>
  );
}
