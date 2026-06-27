/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { Table, Trash2, FileSpreadsheet, RefreshCw, UploadCloud, Clock, CheckSquare } from "lucide-react";
import { PedidoCarrinho, OcorrenciaLider, Estatisticas } from "../types";

interface RelatoriosViewProps {
  pedidos: PedidoCarrinho[];
  ocorrencias: OcorrenciaLider[];
  estatisticas: Estatisticas;
  onZerarRelatorio: () => Promise<void>;
  onLimparHistoricoLider: () => Promise<void>;
  onSincronizar: () => Promise<void>;
  onImportarCSV: (dadosImportados: { porMaquina: Record<string, number>; chamadosLider: any[] }) => void;
}

export default function RelatoriosView({
  pedidos,
  ocorrencias,
  estatisticas,
  onZerarRelatorio,
  onLimparHistoricoLider,
  onSincronizar,
  onImportarCSV
}: RelatoriosViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocultarPendentes, setOcultarPendentes] = useState(false);

  const chamadosResolvidos = ocorrencias.filter(o => o.status === "RESOLVIDA");
  const pedidosEntregues = pedidos.filter(p => p.status === "FINALIZADO");
  const exibidosPedidos = ocultarPendentes ? pedidos.filter(p => p.status === "FINALIZADO") : pedidos;

  // Função para exportar os dados em formato CSV (compatível com Excel)
  const handleExportarExcel = () => {
    let csvContent = "\uFEFFMaquina;Total Interacoes;Ultimo Status\n";
    
    // Lista de máquinas padrão
    const maquinas = [
      "K1014-1", "K1014-2", "K1014-3", "K1014-4", "K1014-6", "K1014-7",
      "K1014-8", "K1014-9", "K1014-10", "K813-1", "K813-2", "K68-1",
      "K68-2", "T-Line 1", "T-Line 2", "K1318", "TEUBERT"
    ];

    maquinas.forEach(m => {
      const qtd = estatisticas.porMaquina[m] || 0;
      const rawStatus = exibidosPedidos.find(p => p.maquina === m)?.pedido || "Normal";
      // Sanitiza textos para evitar quebra de colunas ou linhas no arquivo CSV/Excel
      const ultimoStatus = rawStatus.replace(/[\n\r;"]/g, " ").trim();
      csvContent += `${m};${qtd};"${ultimoStatus}"\n`;
    });

    csvContent += "\n⏱️ HISTORICO DO LIDER\nMaquina;Ocorrencia Resolvida;Tempo Resposta\n";
    chamadosResolvidos.forEach(h => {
      const motivoSanitizado = h.motivo.replace(/[\n\r;"]/g, " ").trim();
      const tempoSanitizado = (h.tempoResposta || "N/A").replace(/[\n\r;"]/g, " ").trim();
      csvContent += `${h.maquina};"${motivoSanitizado}";${tempoSanitizado}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_producao_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Função para importar o CSV e parsear no React
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
      {/* Controles do Cabeçalho */}
      <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Table className="h-5 w-5 text-blue-400" />
            Centro de Inteligência de Relatórios
          </h3>
          <p className="text-xs text-slate-400">Exporte, importe ou sincronize dados consolidados do turno atual.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={async () => {
              await onSincronizar();
              setOcultarPendentes(false);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 font-bold text-xs rounded-xl text-slate-300 hover:text-white border border-slate-600 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Sincronizar
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 font-bold text-xs rounded-xl text-slate-300 hover:text-white border border-slate-600 transition-colors cursor-pointer"
          >
            <UploadCloud className="h-4 w-4" />
            Carregar CSV
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleImportarCSV}
            className="hidden"
          />

          <button
            onClick={handleExportarExcel}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 font-bold text-xs rounded-xl text-white shadow-md shadow-emerald-500/10 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Salvar Excel (CSV)
          </button>

          <button
            onClick={async () => {
              await onZerarRelatorio();
              setOcultarPendentes(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 font-bold text-xs rounded-xl text-white shadow-md transition-colors cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            Zerar Tudo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fluxo de Carrinhos Ativos */}
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-emerald-400" />
            Fluxo de Carrinhos Ativos
          </h3>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 text-sm">
              <thead>
                <tr className="text-slate-400 text-xs font-semibold uppercase text-left">
                  <th className="py-3 px-4 bg-slate-900/60 rounded-l-xl">Máquina</th>
                  <th className="py-3 px-4 bg-slate-900/60">Carrinhos Solicitados</th>
                  <th className="py-3 px-4 bg-slate-900/60">Status</th>
                  <th className="py-3 px-4 bg-slate-900/60 rounded-r-xl text-right">Qtd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {exibidosPedidos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500 text-xs">
                      Nenhum carrinho registrado no momento.
                    </td>
                  </tr>
                ) : (
                  exibidosPedidos.map(p => {
                    const interacoes = estatisticas.porMaquina[p.maquina] || 1;
                    return (
                      <tr key={p.id} className="text-slate-300 hover:bg-slate-900/20 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">{p.maquina}</td>
                        <td className="py-3 px-4">
                          <span className="inline-block bg-slate-900 text-slate-300 text-xs px-2.5 py-1 rounded-lg border border-slate-700 font-semibold">
                            {p.pedido}
                          </span>
                        </td>
                        <td className="py-3 px-4">
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
                        <td className="py-3 px-4 text-right font-bold text-blue-400">{interacoes}</td>
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
                  <th className="py-3 px-4 bg-slate-900/60 rounded-r-xl text-right">Tempo Resposta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {chamadosResolvidos.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-500 text-xs">
                      Nenhum chamado de parada resolvido neste turno.
                    </td>
                  </tr>
                ) : (
                  chamadosResolvidos.map(h => (
                    <tr key={h.id} className="text-slate-300 hover:bg-slate-900/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{h.maquina}</td>
                      <td className="py-3 px-4 text-xs max-w-[200px] truncate">{h.motivo}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-2 py-0.5 rounded-lg">
                          ⏱️ {h.tempoResposta || "N/A"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
