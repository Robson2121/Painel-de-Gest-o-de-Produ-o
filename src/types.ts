/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PedidoCarrinho {
  id: number;
  maquina: string;
  pedido: string;
  data: string;
  timestamp: number;
  status?: 'ATIVO' | 'FINALIZADO';
}

export interface OcorrenciaLider {
  id: number;
  maquina: string;
  motivo: string;
  data: string;
  timestamp: number;
  tempoResposta?: string;
  status: 'ATIVA' | 'RESOLVIDA';
}

export interface Usuario {
  id: string;
  login: string;
  cargo: 'OPERADOR' | 'LIDER' | 'LOGISTICA' | 'RELATORIO' | 'ADMIN';
  senha?: string;
}

export interface Turno {
  id: string;
  nome: string;
  inicio: string; // Formato HH:mm (ex: "06:00")
  termino: string; // Formato HH:mm (ex: "14:00")
}

export interface Estatisticas {
  total: number;
  porMaquina: Record<string, number>;
  totalProblemas: number;
  problemasPorMaquina: Record<string, number>;
}
