/**
 * Utility for handling offline state persistence and automatic background sync
 * when connection to the server or MongoDB is restored.
 */

import { PedidoCarrinho, OcorrenciaLider, Usuario, Turno, SyncHistoryItem } from "../types";

export interface QueuedAction {
  id: string;
  type: "ADD_PEDIDO" | "FINALIZE_PEDIDO" | "ADD_OCORRENCIA" | "RESOLVE_OCORRENCIA" | "SAVE_TURNOS";
  payload: any;
  timestamp: number;
}

export interface CachedState {
  pedidos: PedidoCarrinho[];
  ocorrencias: OcorrenciaLider[];
  usuarios: Usuario[];
  turnos: Turno[];
  ipsBloqueados: { ip: string; tentativas: number }[];
  lastUpdated: number;
}

const CACHE_KEY = "industrial_state_cache_v1";
const QUEUE_KEY = "industrial_offline_queue_v1";
const HISTORY_KEY = "industrial_sync_history_v1";

export function getSyncHistory(): SyncHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Erro ao ler histórico de sincronização:", e);
    return [];
  }
}

export function saveSyncHistory(history: SyncHistoryItem[]): void {
  try {
    // Mantém no máximo os 100 registros mais recentes
    const truncated = history.slice(0, 100);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(truncated));
  } catch (e) {
    console.error("Erro ao salvar histórico de sincronização:", e);
  }
}

export function clearSyncHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.error("Erro ao limpar histórico de sincronização:", e);
  }
}

function generateActionDescription(type: QueuedAction["type"], payload: any): { description: string; payloadInfo: string } {
  switch (type) {
    case "ADD_PEDIDO":
      return {
        description: `Novo Pedido: ${payload.maquina || 'Máquina'}`,
        payloadInfo: `Item: "${payload.pedido || ''}"`
      };
    case "FINALIZE_PEDIDO":
      return {
        description: `Finalização de Pedido #${payload.id}`,
        payloadInfo: `Atendimento de insumo concluído`
      };
    case "ADD_OCORRENCIA":
      return {
        description: `Chamado Máquina Parada: ${payload.maquina || 'Máquina'}`,
        payloadInfo: `Motivo: "${payload.motivo || ''}"`
      };
    case "RESOLVE_OCORRENCIA":
      return {
        description: `Manutenção Concluída #${payload.id}`,
        payloadInfo: `Tempo de resposta: ${payload.tempoResposta || 'N/A'}`
      };
    case "SAVE_TURNOS":
      return {
        description: `Reconfiguração de Turnos`,
        payloadInfo: `${payload.turnos?.length || 0} turno(s) atualizado(s)`
      };
    default:
      return {
        description: `Operação Operacional`,
        payloadInfo: JSON.stringify(payload)
      };
  }
}

export function getCachedState(): CachedState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("Erro ao ler cache offline:", e);
    return null;
  }
}

export function saveCachedState(state: Partial<CachedState>): void {
  try {
    const current = getCachedState() || {
      pedidos: [],
      ocorrencias: [],
      usuarios: [],
      turnos: [],
      ipsBloqueados: [],
      lastUpdated: Date.now()
    };
    const updated: CachedState = {
      ...current,
      ...state,
      lastUpdated: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Erro ao salvar cache offline:", e);
  }
}

export function getOfflineQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Erro ao ler fila offline:", e);
    return [];
  }
}

export function enqueueOfflineAction(type: QueuedAction["type"], payload: any): QueuedAction[] {
  try {
    const queue = getOfflineQueue();
    const actionId = "act_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const newAction: QueuedAction = {
      id: actionId,
      type,
      payload,
      timestamp: Date.now()
    };
    queue.push(newAction);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

    // Grava no Histórico de Sincronização
    const history = getSyncHistory();
    const { description, payloadInfo } = generateActionDescription(type, payload);
    const historyItem: SyncHistoryItem = {
      id: actionId,
      type,
      description,
      payloadInfo,
      timestamp: Date.now(),
      status: "PENDENTE",
      detalhes: "Registrado localmente em modo offline (Aguardando reestabelecimento da rede)"
    };
    history.unshift(historyItem);
    saveSyncHistory(history);

    return queue;
  } catch (e) {
    console.error("Erro ao enfileirar ação offline:", e);
    return [];
  }
}

export function clearOfflineQueue(): void {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch (e) {
    console.error("Erro ao limpar fila offline:", e);
  }
}

export async function processSyncQueue(): Promise<{
  success: boolean;
  syncedCount: number;
  data?: CachedState;
  error?: string;
}> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  const actionIdsToSync = queue.map(a => a.id);

  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queue })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const errorMsg = errJson.error || "Falha na sincronização com o servidor";

      // Atualiza histórico com tentativa com falha
      const history = getSyncHistory();
      const updatedHistory = history.map(item => {
        if (actionIdsToSync.includes(item.id)) {
          return {
            ...item,
            status: "FALHA" as const,
            detalhes: `Tentativa de envio falhou: ${errorMsg}`
          };
        }
        return item;
      });
      saveSyncHistory(updatedHistory);

      return { success: false, syncedCount: 0, error: errorMsg };
    }

    const data = await res.json();
    clearOfflineQueue();

    if (data.currentData) {
      saveCachedState(data.currentData);
    }

    // Atualiza histórico com sucesso
    const now = Date.now();
    const history = getSyncHistory();
    const updatedHistory = history.map(item => {
      if (actionIdsToSync.includes(item.id)) {
        return {
          ...item,
          status: "SUCESSO" as const,
          syncedAt: now,
          detalhes: "Processado e persistido com sucesso no banco de dados da fábrica."
        };
      }
      return item;
    });
    saveSyncHistory(updatedHistory);

    return {
      success: true,
      syncedCount: queue.length,
      data: data.currentData
    };
  } catch (err: any) {
    const errorMsg = err.message || "Servidor indisponível";
    const history = getSyncHistory();
    const updatedHistory = history.map(item => {
      if (actionIdsToSync.includes(item.id)) {
        return {
          ...item,
          status: "FALHA" as const,
          detalhes: `Servidor indisponível ao tentar conectar: ${errorMsg}`
        };
      }
      return item;
    });
    saveSyncHistory(updatedHistory);

    return { success: false, syncedCount: 0, error: errorMsg };
  }
}
