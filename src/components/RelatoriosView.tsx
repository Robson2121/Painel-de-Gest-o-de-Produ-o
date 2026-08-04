/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { Table, FileSpreadsheet, FileText, RefreshCw, UploadCloud, Clock, CheckSquare, Filter, Layers } from "lucide-react";
import { PedidoCarrinho, OcorrenciaLider, Estatisticas, Turno } from "../types";
import { DEFAULT_TURNOS, pertenceAoTurno } from "../utils/turnos";
import { exportarParaExcel, exportarParaWord } from "../utils/exportHelpers";

interface RelatoriosViewProps {
  pedidos: PedidoCarrinho[];
  ocorrencias: OcorrenciaLider[];
  estatisticas: Estatisticas;
  turnos?: Turno[];
  onZerarRelatorio?: () => Promise<void>;
  onLimparHistoricoLider: () => Promise<void>;
  onSincronizar: () => Promise<void>;
  onImportarCSV: (dadosImportados: { porMaquina: Record<string, number>; chamadosLider: any[] }) => void;
}

export default function RelatoriosView({
  pedidos,
  ocorrencias,
  estatisticas,
  turnos = DEFAULT_TURNOS,
  onLimparHistoricoLider,
  onSincronizar,
  onImportarCSV
}: RelatoriosViewProps) {
  const listaTurnos = turnos && turnos.length > 0 ? turnos : DEFAULT_TURNOS;
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [filtroTurnoId, setFiltroTurnoId] = useState<string>("TODOS");
  const [ocultarPendentes, setOcultarPendentes] = useState(false);
  const [gerandoWord, setGerandoWord] = useState(false);

  const turnoSelecionado = filtroTurnoId === "TODOS"
    ? null
    : listaTurnos.find(t => t.id === filtroTurnoId);

  // Filtragem dos dados pelo turno selecionado
  const pedidosFiltrados = turnoSelecionado
    ? pedidos.filter(p => pertenceAoTurno(p.timestamp, turnoSelecionado))
    : pedidos;

  const ocorrenciasFiltradas = turnoSelecionado
    ? ocorrencias.filter(o => pertenceAoTurno(o.timestamp, turnoSelecionado))
    : ocorrencias;

  const chamadosResolvidos = ocorrenciasFiltradas.filter(o => o.status === "RESOLVIDA");
  const exibidosPedidos = ocultarPendentes
    ? pedidosFiltrados.filter(p => p.status === "FINALIZADO")
    : pedidosFiltrados;

  // Exportação em Excel (.xlsx)
  const handleExportarExcel = () => {
    exportarParaExcel(pedidosFiltrados, ocorrenciasFiltradas, estatisticas, listaTurnos);
  };

  // Exportação em Word (.docx)
  const handleExportarWord = async () => {
    setGerandoWord(true);
    try {
      await exportarParaWord(pedidosFiltrados, ocorrenciasFiltradas, estatisticas, listaTurnos);
    } catch (e) {
      console.error("Erro ao exportar Word:", e);
    } finally {
      setGerandoWord(false);
    }
  };

  // Importar CSV
  const handleImportarCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const linhas = text.split("\n");
      
      let porMaquina: Record<string, number> = {};
      let chamadosLider: any[] = [];
      let blocoLiderIniciado = false;

      for (let i = 1; i < linhas.length; i++) {
        const linha = linhas[i].trim();
        if (!linha) continue;

        if (linha.includes("HISTORICO DO LIDER") || linha.includes("HISTÓRICO")) {
          blocoLiderIniciado = true;
          continue;
        }

        const colunas = linha.split(";");
        if (!blocoLiderIniciado) {
          if (colunas.length >= 2) {
            const m = colunas[0].replace(/"/g, "").trim();
            const q = parseInt(colunas[1]) || 0;
            if (m && m !== "Maquina" && m !== "Máquina") {
              porMaquina[m] = q;
            }
          }
        } else {
          if (colunas.length >= 3 && !colunas[0].includes("Maquina") && !colunas[0].includes("Máquina")) {
            chamadosLider.push({
              id: Date.now() + i,
              maquina: colunas[0].replace(/"/g, "").trim(),
              motivo: colunas[1].replace(/"/g, "").trim(),
              tempoResposta: colunas[2].replace(/"/g, "").trim(),
              status: "RESOLVIDA",
              timestamp: Date.now()
            });
          }
        }
      }

      await onImportarCSV({ porMaquina, chamadosLider });
      setOcultarPendentes(false);
    };
    reader.readAsText(file, "UTF-8");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6" id="relatorios-view">
      {/* Controles do Cabeçalho e Botões de Exportação */}
      <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Table className="h-5 w-5 text-blue-400" />
            Centro Local de Gerador de Relatórios (Word & Excel)
          </h3>
          <p className="text-xs text-slate-400">Exporte relatórios oficiais em arquivo Word (.docx) ou planilha Excel (.xlsx) com divisão por turnos.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Filtro de Turno */}
          <div className="flex items-center gap-1 bg-slate-900 px-2 py-1.5 rounded-xl border border-slate-700">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={filtroTurnoId}
              onChange={(e) => setFiltroTurnoId(e.target.value)}
              className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="TODOS" className="bg-slate-900 text-white">Todos os Turnos</option>
              {listaTurnos.map((t, idx) => (
                <option key={t.id ? `turno-opt-${t.id}-${idx}` : `turno-opt-${idx}`} value={t.id} className="bg-slate-900 text-white">
                  {t.nome} ({t.inicio} - {t.termino})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={async () => {
              await onSincronizar();
              setOcultarPendentes(false);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 font-bold text-xs rounded-xl text-slate-300 hover:text-white border border-slate-600 transition-colors cursor-pointer"
            title="Sincronizar pedidos do painel da logística e ocorrências do dia atual"
          >
            <RefreshCw className="h-4 w-4" />
            Sincronizar
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 font-bold text-xs rounded-xl text-slate-300 hover:text-white border border-slate-600 transition-colors cursor-pointer"
            title="Carregar dados de arquivo CSV"
          >
            <UploadCloud className="h-4 w-4" />
            CSV
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleImportarCSV}
            className="hidden"
          />

          {/* Exportar Excel */}
          <button
            onClick={handleExportarExcel}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 font-bold text-xs rounded-xl text-white shadow-md shadow-emerald-500/10 transition-colors cursor-pointer"
            title="Exportar para arquivo Excel (.xlsx)"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel (.xlsx)
          </button>

          {/* Exportar Word */}
          <button
            onClick={handleExportarWord}
            disabled={gerandoWord}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 font-bold text-xs rounded-xl text-white shadow-md shadow-blue-500/10 transition-colors cursor-pointer disabled:opacity-50"
            title="Exportar para documento Word (.docx)"
          >
            <FileText className="h-4 w-4" />
            {gerandoWord ? "Gerando Word..." : "Exportar Word (.docx)"}
          </button>
        </div>
      </div>

      {/* PAINEL CONSOLIDADO DE PRODUÇÃO POR TURNO */}
      <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Layers className="h-5 w-5 text-amber-400" />
          Consolidação de Múltiplos Turnos
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {listaTurnos.map((t, idx) => {
            const pTurno = pedidos.filter(p => pertenceAoTurno(p.timestamp, t));
            const oTurno = ocorrencias.filter(o => pertenceAoTurno(o.timestamp, t));
            const ent = pTurno.filter(p => p.status === "FINALIZADO").length;
            const res = oTurno.filter(o => o.status === "RESOLVIDA").length;

            return (
              <div
                key={t.id ? `turno-card-${t.id}-${idx}` : `turno-card-${idx}`}
                className={`p-4 rounded-xl border space-y-2 ${
                  filtroTurnoId === t.id
                    ? "bg-amber-500/10 border-amber-500/40 text-white"
                    : "bg-slate-900/60 border-slate-700 text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <span className="font-extrabold text-sm">{t.nome}</span>
                  <span className="text-xs font-mono text-amber-400">{t.inicio} - {t.termino}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Carrinhos:</span>
                    <span className="font-bold text-blue-400">{pTurno.length} total ({ent} entregues)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Ocorrências:</span>
                    <span className="font-bold text-red-400">{oTurno.length} total ({res} resolvidas)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fluxo de Carrinhos Ativos */}
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-emerald-400" />
            Fluxo de Carrinhos Ativos ({turnoSelecionado ? turnoSelecionado.nome : "Todos os Turnos"})
          </h3>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 text-sm">
              <thead>
                <tr className="text-slate-400 text-xs font-semibold uppercase text-left">
                  <th className="py-3 px-4 bg-slate-900/60 rounded-l-xl">Máquina</th>
                  <th className="py-3 px-4 bg-slate-900/60">Solicitação</th>
                  <th className="py-3 px-4 bg-slate-900/60">Turno</th>
                  <th className="py-3 px-4 bg-slate-900/60 rounded-r-xl text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {exibidosPedidos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500 text-xs">
                      Nenhum carrinho registrado para este filtro de turno.
                    </td>
                  </tr>
                ) : (
                  exibidosPedidos.map((p, idx) => {
                    const turnoNome = listaTurnos.find(t => pertenceAoTurno(p.timestamp, t))?.nome || "Indefinido";
                    return (
                      <tr key={p.id ? `pedido-${p.id}-${idx}` : `pedido-idx-${idx}`} className="text-slate-300 hover:bg-slate-900/20 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">{p.maquina}</td>
                        <td className="py-3 px-4">
                          <span className="inline-block bg-slate-900 text-slate-300 text-xs px-2.5 py-1 rounded-lg border border-slate-700 font-semibold">
                            {p.pedido}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                            {turnoNome.split(" ")[0]}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {p.status === "FINALIZADO" ? (
                            <span className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase">
                              Entregue
                            </span>
                          ) : (
                            <span className="inline-block bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase animate-pulse">
                              Pendente
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Histórico do Líder */}
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" />
              Histórico de Chamados Resolvidos
            </h3>

            <button
              onClick={onLimparHistoricoLider}
              className="text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/10 transition-colors cursor-pointer"
            >
              Limpar Chamados
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 text-sm">
              <thead>
                <tr className="text-slate-400 text-xs font-semibold uppercase text-left">
                  <th className="py-3 px-4 bg-slate-900/60 rounded-l-xl">Máquina</th>
                  <th className="py-3 px-4 bg-slate-900/60">Ocorrência</th>
                  <th className="py-3 px-4 bg-slate-900/60">Turno</th>
                  <th className="py-3 px-4 bg-slate-900/60 rounded-r-xl text-right">Tempo Resposta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {chamadosResolvidos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500 text-xs">
                      Nenhum chamado de parada resolvido neste turno.
                    </td>
                  </tr>
                ) : (
                  chamadosResolvidos.map((h, idx) => {
                    const turnoNome = listaTurnos.find(t => pertenceAoTurno(h.timestamp, t))?.nome || "Indefinido";
                    return (
                      <tr key={h.id ? `chamado-${h.id}-${idx}` : `chamado-idx-${idx}`} className="text-slate-300 hover:bg-slate-900/20 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">{h.maquina}</td>
                        <td className="py-3 px-4 text-xs max-w-[150px] truncate">{h.motivo}</td>
                        <td className="py-3 px-4">
                          <span className="inline-block bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                            {turnoNome.split(" ")[0]}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-2 py-0.5 rounded-lg">
                            ⏱️ {h.tempoResposta || "N/A"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
