/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Landmark, Check, Clock, Radio, Volume2, VolumeX, AlertTriangle, Bell, BellOff } from "lucide-react";
import { PedidoCarrinho } from "../types";
import { parsePtBrData } from "../utils/dateUtils";

interface LogisticaViewProps {
  pedidos: PedidoCarrinho[];
  onFinalizarPedido: (id: number | string) => Promise<void>;
  onSincronizar?: () => Promise<void>;
}

export default function LogisticaView({ pedidos, onFinalizarPedido }: LogisticaViewProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [sireneHabilitada, setSireneHabilitada] = useState(true);
  const [silenciado, setSilenciado] = useState(false);
  const [precisaInteracao, setPrecisaInteracao] = useState(false);

  const pedidosAtivos = pedidos.filter(p => p.status !== "FINALIZADO");

  useEffect(() => {
    // Sincroniza o relógio do cliente com o do servidor apenas se o desvio for pequeno (<15s)
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
          // Ignora offsets maiores que 15s causados por fuso horário/proxy headers
          if (Math.abs(offset) <= 15000) {
            setServerOffset(offset);
          } else {
            setServerOffset(0);
          }
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

  const obterTimestampSeguro = (p: PedidoCarrinho): number => {
    // 1. Tenta p.timestamp
    const ts1 = parsePtBrData(p.timestamp);
    if (ts1 && ts1 > 0) return ts1;

    // 2. Tenta p.id (se for um timestamp do Date.now())
    const ts2 = parsePtBrData(p.id);
    if (ts2 && ts2 > 1600000000000) return ts2;

    // 3. Tenta p.data (ex: "03/08/2026, 22:15:30")
    const ts3 = parsePtBrData(p.data);
    if (ts3 && ts3 > 0) return ts3;

    // Fallback se não houver dados válidos
    return currentTime;
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

  // Identifica pedidos que estouraram o tempo e estão vermelhos (> 3 min)
  const safeOffset = Math.abs(serverOffset) <= 15000 ? serverOffset : 0;
  const pedidosCriticos = pedidosAtivos.filter(p => {
    const ts = obterTimestampSeguro(p);
    const segundos = Math.max(0, Math.floor((currentTime - safeOffset - ts) / 1000));
    return segundos > 180;
  });
  const temPedidoCritico = pedidosCriticos.length > 0;

  // Re-ativa o som se o número de pedidos vermelhos aumentar
  const prevCriticosCount = React.useRef(0);
  useEffect(() => {
    if (pedidosCriticos.length > prevCriticosCount.current) {
      setSilenciado(false);
    }
    prevCriticosCount.current = pedidosCriticos.length;
  }, [pedidosCriticos.length]);

  // Efeito do Alerta Sonoro de Emergência para Pedidos Atrasados (Card Vermelho) - Identico ao LiderView
  useEffect(() => {
    let audioCtx: AudioContext | null = null;
    let osc: OscillatorNode | null = null;
    let lfo: OscillatorNode | null = null;
    let vibInterval: any = null;

    if (temPedidoCritico && sireneHabilitada && !silenciado) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();
          
          if (audioCtx.state === "suspended") {
            setPrecisaInteracao(true);
          } else {
            setPrecisaInteracao(false);
          }

          osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
          
          lfo = audioCtx.createOscillator();
          const lfoGain = audioCtx.createGain();
          
          lfo.frequency.value = 2.8;
          lfoGain.gain.value = 400;
          
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          
          gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
          
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.start();
          lfo.start();
        }
      } catch (err) {
        console.warn("Erro ao instanciar o áudio da sirene:", err);
        setPrecisaInteracao(true);
      }

      const executarVibracao = () => {
        if ("vibrate" in navigator) {
          try {
            navigator.vibrate([800, 400, 800, 400]);
          } catch (e) {
            console.warn("Navegador impediu ou não suporta vibração física:", e);
          }
        }
      };
      
      executarVibracao();
      vibInterval = setInterval(executarVibracao, 2400);
    } else {
      setPrecisaInteracao(false);
    }

    return () => {
      if (osc) {
        try { osc.stop(); } catch (e) {}
      }
      if (lfo) {
        try { lfo.stop(); } catch (e) {}
      }
      if (audioCtx) {
        try { audioCtx.close(); } catch (e) {}
      }
      if (vibInterval) {
        clearInterval(vibInterval);
      }
      if ("vibrate" in navigator) {
        try { navigator.vibrate(0); } catch (e) {}
      }
    };
  }, [temPedidoCritico, sireneHabilitada, silenciado]);

  const desbloquearAudio = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const dummy = new AudioContextClass();
        dummy.resume().then(() => {
          setPrecisaInteracao(false);
          dummy.close();
        });
      }
    } catch (e) {
      console.warn("Erro ao desbloquear áudio:", e);
    }
  };

  return (
    <div className="space-y-6" id="logistica-view">
      {/* Barra de Status e Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800 border border-slate-700 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-blue-400" />
          <div>
            <h3 className="text-white font-bold text-sm">Controle de Fluxo de Abastecimento</h3>
            <p className="text-xs text-slate-400">Canal de entrega e reposição de carrinhos em tempo real.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Botão de Ativar/Desativar Som Geral da Logística */}
          <button
            onClick={() => {
              setSireneHabilitada(!sireneHabilitada);
              if (!sireneHabilitada) {
                setSilenciado(false);
                desbloquearAudio();
              }
            }}
            title={sireneHabilitada ? "Som habilitado para pedidos atrasados" : "Som desativado"}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
              sireneHabilitada
                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
                : "text-slate-400 bg-slate-700/50 border-slate-600 hover:bg-slate-700"
            }`}
          >
            {sireneHabilitada ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Alerta Sonoro: <strong>ATIVADO</strong></span>
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                <span>Alerta Sonoro: <strong>DESATIVADO</strong></span>
              </>
            )}
          </button>

          <span className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border ${
            pedidosAtivos.length > 0 
              ? "text-blue-400 bg-blue-500/10 border-blue-500/20" 
              : "text-slate-400 bg-slate-700/40 border-slate-600/50"
          }`}>
            <Clock className="h-3.5 w-3.5" />
            Pendentes: <strong className="text-white font-extrabold">{pedidosAtivos.length}</strong>
          </span>

          <span className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
            <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            Conectado
          </span>
        </div>
      </div>

      {/* Banner de aviso para permissão de áudio do navegador */}
      {precisaInteracao && (
        <div
          onClick={desbloquearAudio}
          className="p-3 bg-blue-600/20 border border-blue-500/40 rounded-xl text-blue-200 text-xs flex items-center justify-between gap-3 cursor-pointer hover:bg-blue-600/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-400 animate-bounce" />
            <span><strong>Aviso de Áudio:</strong> Clique aqui para permitir os alertas sonoros no navegador.</span>
          </div>
          <span className="font-bold bg-blue-500 text-white px-2.5 py-1 rounded-lg text-[10px] uppercase">Ativar Áudio</span>
        </div>
      )}

      {/* Banner de Alerta Sonoro Ativo para Pedidos Críticos (Vermelhos) */}
      {temPedidoCritico && (
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          silenciado || !sireneHabilitada
            ? "bg-slate-800/90 border-amber-500/40 text-amber-300"
            : "bg-red-950/80 border-red-500 text-red-200 animate-pulse shadow-lg shadow-red-500/20"
        }`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-400 shrink-0" />
            <div>
              <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                🚨 ATRASO CRÍTICO NA LOGÍSTICA ({pedidosCriticos.length} pedido{pedidosCriticos.length > 1 ? "s" : ""} &gt; 3 min)
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Existem solicitações de carrinho em estado crítico aguardando atendimento urgente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {sireneHabilitada && !silenciado ? (
              <button
                onClick={() => setSilenciado(true)}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-2 transition-colors uppercase tracking-wider"
              >
                <VolumeX className="h-4 w-4" />
                DESATIVAR ALERTA SONORO
              </button>
            ) : (
              <button
                onClick={() => {
                  setSireneHabilitada(true);
                  setSilenciado(false);
                  desbloquearAudio();
                }}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-amber-300 font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-2 transition-colors border border-amber-500/30 uppercase tracking-wider"
              >
                <Volume2 className="h-4 w-4 text-amber-400" />
                {sireneHabilitada ? "REATIVAR ALERTA SONORO" : "ATIVAR ÁUDIO"}
              </button>
            )}
          </div>
        </div>
      )}

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
            const safeOffset = Math.abs(serverOffset) <= 15000 ? serverOffset : 0;
            const segundos = Math.max(0, Math.floor((currentTime - safeOffset - ts) / 1000));
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
                      Moldadora: {p.maquina}
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
