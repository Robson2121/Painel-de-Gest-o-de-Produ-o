/**
 * Componente: Histórico de Sincronização Offline
 * Exibe uma lista cronológica das operações offline realizadas no sistema,
 * detalhando o status de sincronização (Sucesso, Pendente, Falha) após o retorno da rede.
 */

import React, { useState, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Download,
  Filter,
  Search,
  Zap,
  ArrowUpRight,
  PackageCheck,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  X
} from "lucide-react";
import { SyncHistoryItem } from "../types";
import {
  getSyncHistory,
  clearSyncHistory,
  processSyncQueue,
  getOfflineQueue,
  enqueueOfflineAction
} from "../utils/offlineSync";

interface HistoricoSincronizacaoProps {
  onClose?: () => void;
  onDataSynced?: () => void;
  servidorConectado?: boolean;
}

export default function HistoricoSincronizacao({
  onClose,
  onDataSynced,
  servidorConectado = true
}: HistoricoSincronizacaoProps) {
  const [historico, setHistorico] = useState<SyncHistoryItem[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "SUCESSO" | "PENDENTE" | "FALHA">("TODOS");
  const [termoBusca, setTermoBusca] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [mensagemFeedback, setMensagemFeedback] = useState("");

  const carregarHistorico = () => {
    const items = getSyncHistory();
    setHistorico(items);
  };

  useEffect(() => {
    carregarHistorico();
  }, []);

  const handleForcarSincronizacao = async () => {
    setSincronizando(true);
    setMensagemFeedback("");
    try {
      const res = await processSyncQueue();
      carregarHistorico();
      if (res.success) {
        if (res.syncedCount > 0) {
          setMensagemFeedback(`✅ ${res.syncedCount} operação(ões) sincronizada(s) com sucesso!`);
        } else {
          setMensagemFeedback("ℹ️ Nenhuma operação pendente para sincronizar no momento.");
        }
        if (onDataSynced) onDataSynced();
      } else {
        setMensagemFeedback(`❌ Falha na sincronização: ${res.error || "Erro de conexão"}`);
      }
    } catch (e: any) {
      setMensagemFeedback(`❌ Erro de rede ao tentar sincronizar: ${e.message}`);
    } finally {
      setSincronizando(false);
      setTimeout(() => setMensagemFeedback(""), 5000);
    }
  };

  const handleLimparHistorico = () => {
    if (window.confirm("Deseja realmente limpar todo o histórico de operações de sincronização local?")) {
      clearSyncHistory();
      setHistorico([]);
      setMensagemFeedback("🧹 Histórico de sincronização limpo.");
      setTimeout(() => setMensagemFeedback(""), 3000);
    }
  };

  const handleExportarJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(historico, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `historico_sincronizacao_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSimularOpOffline = () => {
    enqueueOfflineAction("ADD_PEDIDO", {
      maquina: "Máq-" + String(Math.floor(Math.random() * 8) + 1).padStart(2, "0"),
      pedido: "Insumo de Teste Resiliência " + new Date().toLocaleTimeString("pt-BR")
    });
    carregarHistorico();
    setMensagemFeedback("⚡ Operação de teste registrada localmente na fila offline!");
    setTimeout(() => setMensagemFeedback(""), 4000);
  };

  // Filtragem
  const historicoFiltrado = historico.filter(item => {
    const atendeStatus = filtroStatus === "TODOS" || item.status === filtroStatus;
    const atendeBusca =
      termoBusca === "" ||
      item.description.toLowerCase().includes(termoBusca.toLowerCase()) ||
      (item.payloadInfo && item.payloadInfo.toLowerCase().includes(termoBusca.toLowerCase())) ||
      (item.detalhes && item.detalhes.toLowerCase().includes(termoBusca.toLowerCase()));
    return atendeStatus && atendeBusca;
  });

  // Estatísticas
  const totalOps = historico.length;
  const totalSucesso = historico.filter(h => h.status === "SUCESSO").length;
  const totalPendentes = historico.filter(h => h.status === "PENDENTE").length;
  const totalFalhas = historico.filter(h => h.status === "FALHA").length;

  const formatarData = (ts: number) => {
    return new Date(ts).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 sm:p-6 text-slate-100 shadow-2xl space-y-6 max-w-5xl mx-auto">
      {/* Cabeçalho do Componente */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white sm:text-xl">
                Histórico de Sincronização
              </h2>
              {servidorConectado ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Wifi className="h-3 w-3" />
                  Rede Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                  <WifiOff className="h-3 w-3" />
                  Rede Offline
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Registro cronológico de operações gravadas localmente e enviadas ao servidor.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleForcarSincronizacao}
            disabled={sincronizando}
            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
            title="Tentar enviar operações pendentes para o banco"
          >
            <RefreshCw className={`h-4 w-4 ${sincronizando ? "animate-spin" : ""}`} />
            {sincronizando ? "Sincronizando..." : "Sincronizar Agora"}
          </button>

          <button
            onClick={handleSimularOpOffline}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Criar pedido de teste na fila offline para testar resiliência"
          >
            <PlusIcon className="h-3.5 w-3.5 text-amber-400" />
            + Teste Offline
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all cursor-pointer"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Cartões Resumo de Indicadores de Resiliência */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-slate-800/60 border border-slate-700/60 p-3.5 rounded-xl">
          <div className="text-slate-400 text-xs font-medium">Total Gravado</div>
          <div className="text-2xl font-black text-white mt-1">{totalOps}</div>
          <div className="text-[10px] text-slate-500 mt-1">Registros Locais</div>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl">
          <div className="text-emerald-300 text-xs font-bold flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            Sincronizadas
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{totalSucesso}</div>
          <div className="text-[10px] text-emerald-500/80 mt-1">Confirmadas no Banco</div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl">
          <div className="text-amber-300 text-xs font-bold flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            Pendentes
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1">{totalPendentes}</div>
          <div className="text-[10px] text-amber-500/80 mt-1">Fila Local Ativa</div>
        </div>

        <div className="bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl">
          <div className="text-red-300 text-xs font-bold flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
            Falhas / Erros
          </div>
          <div className="text-2xl font-black text-red-400 mt-1">{totalFalhas}</div>
          <div className="text-[10px] text-red-500/80 mt-1">Tentativas de Envio</div>
        </div>
      </div>

      {/* Banner de Feedback Mensagem */}
      {mensagemFeedback && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
          mensagemFeedback.includes("✅")
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            : mensagemFeedback.includes("⚡") || mensagemFeedback.includes("🧹") || mensagemFeedback.includes("ℹ️")
            ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
            : "bg-red-500/10 border-red-500/30 text-red-300"
        }`}>
          <span>{mensagemFeedback}</span>
          <button onClick={() => setMensagemFeedback("")} className="text-xs opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            Filtro:
          </span>
          {(["TODOS", "PENDENTE", "SUCESSO", "FALHA"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltroStatus(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                filtroStatus === f
                  ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {f === "TODOS" && `Todos (${totalOps})`}
              {f === "PENDENTE" && `Pendentes (${totalPendentes})`}
              {f === "SUCESSO" && `Sucesso (${totalSucesso})`}
              {f === "FALHA" && `Falhas (${totalFalhas})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar operação..."
              value={termoBusca}
              onChange={e => setTermoBusca(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleExportarJSON}
            disabled={historico.length === 0}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
            title="Exportar Histórico para JSON"
          >
            <Download className="h-4 w-4" />
          </button>

          <button
            onClick={handleLimparHistorico}
            disabled={historico.length === 0}
            className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/30 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
            title="Limpar Histórico"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Lista Cronológica de Operações */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/80 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-700">
                <th className="py-3 px-4">Data / Hora Local</th>
                <th className="py-3 px-4">Operação</th>
                <th className="py-3 px-4">Detalhes do Dado</th>
                <th className="py-3 px-4">Status da Conexão</th>
                <th className="py-3 px-4 text-right">Sincronizado Em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {historicoFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldCheck className="h-8 w-8 text-slate-600" />
                      <p className="font-semibold">Nenhuma operação de sincronização encontrada no histórico.</p>
                      <p className="text-[11px] text-slate-600">
                        Quando você realizar lançamentos offline, eles aparecerão aqui com status e tempo de sincronização.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                historicoFiltrado.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/50 transition-colors text-slate-300">
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {formatarData(item.timestamp)}
                    </td>

                    {/* Descrição do Tipo de Operação */}
                    <td className="py-3 px-4 whitespace-nowrap font-bold text-white">
                      <div className="flex items-center gap-2">
                        {getOperationBadge(item.type)}
                        <span>{item.description}</span>
                      </div>
                    </td>

                    {/* Informações adicionais do Payload */}
                    <td className="py-3 px-4 text-slate-300">
                      <div className="max-w-xs truncate font-mono text-[11px]">
                        {item.payloadInfo || "-"}
                      </div>
                      {item.detalhes && (
                        <div className="text-[10px] text-slate-500 truncate mt-0.5" title={item.detalhes}>
                          {item.detalhes}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.status === "SUCESSO" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3" />
                          SUCESSO
                        </span>
                      )}
                      {item.status === "PENDENTE" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                          <Clock className="h-3 w-3" />
                          PENDENTE
                        </span>
                      )}
                      {item.status === "FALHA" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-red-500/15 text-red-400 border border-red-500/30">
                          <AlertTriangle className="h-3 w-3" />
                          FALHA
                        </span>
                      )}
                    </td>

                    {/* Horário de envio e confirmação do servidor */}
                    <td className="py-3 px-4 text-right font-mono text-[11px] whitespace-nowrap text-slate-400">
                      {item.syncedAt ? (
                        <span className="text-emerald-400 font-semibold">
                          {new Date(item.syncedAt).toLocaleTimeString("pt-BR")}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Informações educativas da infraestrutura */}
      <div className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl flex items-start gap-3 text-xs text-slate-400">
        <Zap className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white block mb-0.5">Resiliência Industrial Ativa</span>
          Se a conexão da fábrica oscilar ou o servidor ficar indisponível, suas ações ficam salvas de forma blindada no armazenamento local da máquina. Assim que o sinal for reestabelecido, a fila é enviada e confirmada automaticamente sem perda de dados.
        </div>
      </div>
    </div>
  );
}

function getOperationBadge(type: SyncHistoryItem["type"]) {
  switch (type) {
    case "ADD_PEDIDO":
      return (
        <span className="p-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
          <PackageCheck className="h-3.5 w-3.5" />
        </span>
      );
    case "FINALIZE_PEDIDO":
      return (
        <span className="p-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
      );
    case "ADD_OCORRENCIA":
      return (
        <span className="p-1 rounded bg-red-500/20 text-red-400 border border-red-500/30">
          <AlertCircle className="h-3.5 w-3.5" />
        </span>
      );
    case "RESOLVE_OCORRENCIA":
      return (
        <span className="p-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
          <RotateCcw className="h-3.5 w-3.5" />
        </span>
      );
    case "SAVE_TURNOS":
      return (
        <span className="p-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <Clock className="h-3.5 w-3.5" />
        </span>
      );
    default:
      return (
        <span className="p-1 rounded bg-slate-700 text-slate-300">
          <Zap className="h-3.5 w-3.5" />
        </span>
      );
  }
}

function PlusIcon(props: any) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
    </svg>
  );
}
