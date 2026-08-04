/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Landmark, Check, Clock, Radio } from "lucide-react";
import { PedidoCarrinho } from "../types";

interface LogisticaViewProps {
  pedidos: PedidoCarrinho[];
  onFinalizarPedido: (id: number | string) => Promise<void>;
  onSincronizar?: () => Promise<void>;
}

export default function LogisticaView({ pedidos, onFinalizarPedido }: LogisticaViewProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const pedidosAtivos = pedidos.filter(p => p.status !== "FINALIZADO");

  useEffect(() => {
    // Sincroniza o relógio do cliente com o do servidor para precisão do tempo de espera
    const sincronizarRelogio = async () => {
      try {
        const start = Date.now();
        const res = await fetch("/api/pedidos", { method: "HEAD" });
        const end = Date.now();
        const serverDateHeader = res.headers.get("Date");
        if (serverDateHeader) {
          const serverTime = new Date(serverDateHeader).getTime();
          const latency = (end - start) / 2;
          const adjustedServerTime = serverTime + latency;
          const offset = Date.now() - adjustedServerTime;
          setServerOffset(offset);
        }
      } catch (err) {
        console.warn("Falha ao sincronizar relógio com servidor:", err);
      }
    };
    sincronizarRelogio();
  }, []);

  // Ticker de 1 segundo para atualizar o tempo decorrido ao vivo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const obterTimestampSeguro = (p: PedidoCarrinho) => {
    if (p.timestamp) {
      if (typeof p.timestamp === "number" && !isNaN(p.timestamp) && p.timestamp > 0) {
        return p.timestamp;
      }
      if (typeof p.timestamp === "string") {
        if (/^\d+$/.test(p.timestamp)) {
          const parsed = parseInt(p.timestamp, 10);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        const parsedDate = Date.parse(p.timestamp);
        if (!isNaN(parsedDate) && parsedDate > 0) return parsedDate;
      }
    }
    if (p.id) {
      if (typeof p.id === "number" && !isNaN(p.id) && p.id > 0) {
        return p.id;
      }
      if (typeof p.id === "string") {
        if (/^\d+$/.test(p.id)) {
          const parsed = parseInt(p.id, 10);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        const parsedDate = Date.parse(p.id);
        if (!isNaN(parsedDate) && parsedDate > 0) return parsedDate;
      }
    }
    return Date.now() - serverOffset;
  };

  const formatarTempo = (segundosTotais: number) => {
    if (segundosTotais < 60) {
      return `Há ${segundosTotais}s`;
    } else {
      const min = Math.floor(segundosTotais / 60);
      const seg = segundosTotais % 60;
      return `Há ${min}min ${seg}s`;
    }
  };

  return (
    <div className="space-y-6" id="logistica-view">
      {/* Barra de Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800 border border-slate-700 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-blue-400" />
          <div>
            <h3 className="text-white font-bold text-sm">Controle de Fluxo de Abastecimento</h3>
            <p className="text-xs text-slate-400">Canal de entrega e reposição de carrinhos e ganchos em tempo real.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border ${
            pedidosAtivos.length > 0 
              ? "text-blue-400 bg-blue-500/10 border-blue-500/20" 
              : "text-slate-400 bg-slate-700/40 border-slate-600/50"
          }`}>
            <Clock className="h-3.5 w-3.5" />
            Solicitações Pendentes: <strong className="text-white font-extrabold">{pedidosAtivos.length}</strong>
          </span>
          <span className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
            <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            Servidor Conectado
          </span>
        </div>
      </div>

      {pedidosAtivos.length === 0 ? (
        <div className="bg-slate-800 border border-dashed border-slate-700 rounded-2xl p-12 text-center text-slate-500">
          <Check className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-white font-bold text-base mb-1">Tudo Sob Controle!</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
             Não há solicitações de carrinhos pendentes no momento. As linhas de produção estão abastecidas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pedidosAtivos.map((p, index) => {
            const ts = obterTimestampSeguro(p);
            const segundos = Math.max(0, Math.floor((currentTime - serverOffset - ts) / 1000));
            const urgenciaAlta = segundos > 180;
            const urgenciaMedia = segundos > 60 && segundos <= 180;

            return (
              <div
                key={p.id ? `${p.id}-${index}` : `pedido-${index}`}
                className={`bg-slate-800 border rounded-2xl p-5 flex flex-col justify-between gap-5 transition-all duration-300 relative overflow-hidden ${
                  urgenciaAlta
                    ? "border-red-500 shadow-lg shadow-red-500/5 animate-pulse"
                    : urgenciaMedia
                    ? "border-amber-500 shadow-md shadow-amber-500/5"
                    : "border-slate-700"
                }`}
              >
                {/* Linha decorativa de urgência lateral */}
                <div
                  className={`absolute top-0 bottom-0 left-0 w-2.5 ${
                    urgenciaAlta
                      ? "bg-red-500"
                      : urgenciaMedia
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                />

                <div className="pl-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-extrabold text-white tracking-tight">
                      Injetora: {p.maquina}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                        urgenciaAlta
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : urgenciaMedia
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {urgenciaAlta ? "Crítico (> 3m)" : urgenciaMedia ? "Urgente (> 1m)" : "Normal"}
                    </span>
                  </div>

                  <p className="text-lg font-bold text-slate-300">
                    {p.pedido}
                  </p>

                  <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 pt-1">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <span>Tempo de Espera:</span>
                    <span
                      className={`font-bold ${
                        urgenciaAlta ? "text-red-400" : urgenciaMedia ? "text-amber-400" : "text-white"
                      }`}
                    >
                      {formatarTempo(segundos)}
                    </span>
                  </div>
                </div>

                <div className="pl-3 flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onFinalizarPedido(p.id ?? p.timestamp ?? index);
                    }}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-500/10 text-white font-extrabold rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <Check className="h-4.5 w-4.5" />
                    ATENDER E FINALIZAR ✔
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
