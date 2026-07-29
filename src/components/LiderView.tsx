/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { AlertOctagon, CheckCircle, Clock, Volume2, VolumeX, MessageSquare } from "lucide-react";
import { OcorrenciaLider } from "../types";

interface LiderViewProps {
  ocorrencias: OcorrenciaLider[];
  onResolverOcorrencia: (id: number, tempoResposta: string) => Promise<void>;
}

export default function LiderView({ ocorrencias, onResolverOcorrencia }: LiderViewProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);

  useEffect(() => {
    // Sincroniza o relógio do cliente com o do servidor para precisão absoluta do cronômetro
    const sincronizarRelogio = async () => {
      try {
        const start = Date.now();
        const res = await fetch("/api/ocorrencias", { method: "HEAD" });
        const end = Date.now();
        const serverDateHeader = res.headers.get("Date");
        if (serverDateHeader) {
          const serverTime = new Date(serverDateHeader).getTime();
          const latency = (end - start) / 2;
          const adjustedServerTime = serverTime + latency;
          const offset = Date.now() - adjustedServerTime;
          setServerOffset(offset);
          console.log("[LiderView] Desvio de relógio detectado e sincronizado:", offset, "ms");
        }
      } catch (err) {
        console.warn("Falha ao sincronizar relógio com o servidor:", err);
      }
    };
    sincronizarRelogio();
  }, []);
  const [sireneHabilitada, setSireneAtiva] = useState(true); // Ativo por padrão para maior segurança
  const [silenciado, setSilenciado] = useState(false);
  const [precisaInteracao, setPrecisaInteracao] = useState(false);

  const chamadosAtivos = ocorrencias.filter(o => o.status === "ATIVA");

  // Reseta o silenciamento quando um novo chamado ativo é recebido
  const prevChamadosCount = React.useRef(0);
  useEffect(() => {
    if (chamadosAtivos.length > prevChamadosCount.current) {
      setSilenciado(false); // Reativa o som para novos alertas de parada
    }
    prevChamadosCount.current = chamadosAtivos.length;
  }, [chamadosAtivos.length]);

  // Alarme visual piscante e controle do estado de ativação do alarme
  useEffect(() => {
    if (chamadosAtivos.length > 0) {
      setAlarmeAtivo(true);
    } else {
      setAlarmeAtivo(false);
      setSilenciado(false);
    }
  }, [chamadosAtivos.length]);

  // Efeito principal para acionamento da Sirene Modulada e Vibração Contínua
  useEffect(() => {
    let audioCtx: AudioContext | null = null;
    let osc: OscillatorNode | null = null;
    let lfo: OscillatorNode | null = null;
    let vibInterval: any = null;

    if (alarmeAtivo && !silenciado && sireneHabilitada) {
      // 1. Toca o sintetizador de sirene de emergência (frequência oscilante realista)
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
          
          // Onda dente-de-serra (sawtooth): muito mais rica em harmônicos agudos,
          // o que dá um timbre metálico/cortante ideal para se destacar no ruído de máquinas.
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(1400, audioCtx.currentTime); // Frequência base ideal de 1400Hz (região de maior sensibilidade do ouvido humano)
          
          // LFO (Low Frequency Oscillator) rápido e de alta amplitude para varrer frequências agudas
          lfo = audioCtx.createOscillator();
          const lfoGain = audioCtx.createGain();
          
          lfo.frequency.value = 2.8; // 2.8 oscilações por segundo (ritmo rápido de sirene de evacuação)
          lfoGain.gain.value = 400;  // Varre continuamente entre 1000Hz e 1800Hz, cortando qualquer ruído grave do chão de fábrica
          
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          
          gain.gain.setValueAtTime(0.25, audioCtx.currentTime); // Volume otimizado para alta potência de saída
          
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.start();
          lfo.start();
        }
      } catch (err) {
        console.warn("Erro ao instanciar o áudio da sirene:", err);
        setPrecisaInteracao(true);
      }

      // 2. Aciona vibração contínua do celular (padrão de vibração dupla de segurança)
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
      // Limpeza imediata ao silenciar ou resolver chamados
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
  }, [alarmeAtivo, silenciado, sireneHabilitada]);

  // Desbloqueia o AudioContext do navegador sob clique/toque (obrigatório pelas políticas de segurança)
  const handleAtivarSomEInteragir = () => {
    setSilenciado(false);
    setPrecisaInteracao(false);
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const tempCtx = new AudioContextClass();
        const oscNode = tempCtx.createOscillator();
        const gainNode = tempCtx.createGain();
        oscNode.connect(gainNode);
        gainNode.connect(tempCtx.destination);
        gainNode.gain.setValueAtTime(0.02, tempCtx.currentTime);
        oscNode.start();
        oscNode.stop(tempCtx.currentTime + 0.05);
      }
    } catch (e) {
      console.log("Erro de interação para desbloqueio do áudio:", e);
    }
  };

  const obterTimestampSeguro = (o: OcorrenciaLider) => {
    if (o.timestamp) {
      if (typeof o.timestamp === "number" && !isNaN(o.timestamp) && o.timestamp > 0) {
        return o.timestamp;
      }
      if (typeof o.timestamp === "string") {
        if (/^\d+$/.test(o.timestamp)) {
          const parsed = parseInt(o.timestamp, 10);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        const parsedDate = Date.parse(o.timestamp);
        if (!isNaN(parsedDate) && parsedDate > 0) return parsedDate;
      }
    }
    if (o.id) {
      if (typeof o.id === "number" && !isNaN(o.id) && o.id > 0) {
        return o.id;
      }
      if (typeof o.id === "string") {
        if (/^\d+$/.test(o.id)) {
          const parsed = parseInt(o.id, 10);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        const parsedDate = Date.parse(o.id);
        if (!isNaN(parsedDate) && parsedDate > 0) return parsedDate;
      }
    }
    return Date.now() - serverOffset;
  };

  // Efeito do cronômetro progressivo das paradas ativas
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatarTempo = (segundos: number) => {
    if (isNaN(segundos)) return "00m 00s";
    const m = Math.floor(segundos / 60).toString().padStart(2, "0");
    const s = (segundos % 60).toString().padStart(2, "0");
    return `${m}m ${s}s`;
  };

  const handleFinalizar = async (o: OcorrenciaLider) => {
    const ts = obterTimestampSeguro(o);
    const totalSegundos = Math.max(0, Math.floor((Date.now() - serverOffset - ts) / 1000));
    const tempoGasto = formatarTempo(totalSegundos);
    await onResolverOcorrencia(o.id, tempoGasto);
  };

  const obterEstiloGravidade = (motivo: string) => {
    const m = motivo.toUpperCase();
    if (m.includes("BICO") || m.includes("BICO INJETOR")) {
      return {
        border: "border-red-500",
        bg: "bg-red-500/10",
        text: "text-red-400",
        badge: "bg-red-500/20 text-red-400 border border-red-500/30"
      };
    }
    if (m.includes("MOLDE")) {
      return {
        border: "border-purple-500",
        bg: "bg-purple-500/10",
        text: "text-purple-400",
        badge: "bg-purple-500/20 text-purple-400 border border-purple-500/30"
      };
    }
    if (m.includes("MATÉRIA") || m.includes("MATÉRIA-PRIMA")) {
      return {
        border: "border-amber-500",
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        badge: "bg-amber-500/20 text-amber-400 border border-amber-500/30"
      };
    }
    return {
      border: "border-blue-500",
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      badge: "bg-blue-500/20 text-blue-400 border border-blue-500/30"
    };
  };

  return (
    <div className="space-y-6" id="lider-view">
      {/* Banner Superior Pulsante de Emergência Ativa */}
      {alarmeAtivo && (
        <div 
          key="banner-emergencia-lider"
          className={`p-6 rounded-2xl border-2 flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-500 ${
            silenciado 
              ? "bg-slate-800/80 border-slate-700" 
              : "bg-red-950/40 border-red-500 shadow-lg shadow-red-500/20 animate-pulse"
          }`}
        >
          <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
            <div className={`p-4 rounded-full ${silenciado ? "bg-slate-700 text-slate-400" : "bg-red-500 text-white animate-bounce"}`}>
              <AlertOctagon className="h-8 w-8" />
            </div>
            <div>
              <h4 className="text-white font-black text-lg uppercase tracking-wider">
                <span>{silenciado ? "🚨 Alarme Silenciado" : "🚨 ATENÇÃO: SIRENE ATIVA!"}</span>
              </h4>
              <p className="text-xs text-slate-300 mt-1 max-w-md">
                <span>
                  {silenciado 
                    ? "A sirene foi pausada, mas as máquinas continuam paradas. O tempo de resposta está correndo." 
                    : "Há máquinas industriais com paradas de emergência em andamento! O celular está vibrando e a sirene soando."}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-center">
            {precisaInteracao && !silenciado && (
              <button
                key="btn-interacao"
                onClick={handleAtivarSomEInteragir}
                className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer animate-bounce flex items-center gap-2"
              >
                <Volume2 className="h-4 w-4" />
                <span>Ativar Som & Vibração</span>
              </button>
            )}

            {!silenciado ? (
              <button
                key="btn-silenciar"
                onClick={() => setSilenciado(true)}
                className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase rounded-xl shadow-lg shadow-red-600/30 cursor-pointer flex items-center gap-2"
              >
                <VolumeX className="h-4 w-4" />
                <span>Silenciar Alarme Atual</span>
              </button>
            ) : (
              <button
                key="btn-reativar"
                onClick={() => {
                  setSilenciado(false);
                  handleAtivarSomEInteragir();
                }}
                className="px-5 py-3 bg-slate-700 hover:bg-slate-600 text-white font-black text-xs uppercase rounded-xl cursor-pointer flex items-center gap-2"
              >
                <Volume2 className="h-4 w-4" />
                <span>Reativar Alarme</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Alerta de Sirene e Som do Navegador */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800 border border-slate-700 p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <AlertOctagon className={`h-8 w-8 ${alarmeAtivo && !silenciado ? "text-red-500 animate-bounce" : "text-slate-500"}`} />
          <div>
            <h3 className="text-white font-bold text-base">Painel de Alertas de Parada</h3>
            <p className="text-xs text-slate-400">Atendimento a paradas de injetoras plásticas e controle de MTTR.</p>
          </div>
        </div>

        <button
          key={sireneHabilitada ? "sirene-on" : "sirene-off"}
          onClick={() => setSireneAtiva(!sireneHabilitada)}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs border transition-colors cursor-pointer ${
            sireneHabilitada
              ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
              : "bg-slate-700/50 text-slate-300 border-slate-600 hover:bg-slate-700"
          }`}
        >
          {sireneHabilitada ? (
            <span key="span-sirene-on" className="flex items-center gap-2">
              <Volume2 className="h-4.5 w-4.5 animate-pulse" />
              <span>Sirene Habilitada (Auto-Alarme)</span>
            </span>
          ) : (
            <span key="span-sirene-off" className="flex items-center gap-2">
              <VolumeX className="h-4.5 w-4.5 text-slate-500" />
              <span>Sirene Desabilitada</span>
            </span>
          )}
        </button>
      </div>

      {chamadosAtivos.length === 0 ? (
        <div className="bg-slate-800 border border-dashed border-slate-700 rounded-2xl p-12 text-center text-slate-500">
          <CheckCircle className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-white font-bold text-base mb-1">Injetoras Operando Normalmente</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Não existem alarmes de máquina parada ou chamados do líder ativos neste momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {chamadosAtivos.map(o => {
            const ts = obterTimestampSeguro(o);
            const segundos = Math.max(0, Math.floor((currentTime - serverOffset - ts) / 1000));
            const estilo = obterEstiloGravidade(o.motivo);

            return (
              <div
                key={o.id}
                className={`bg-slate-800 border-2 rounded-2xl p-5 flex flex-col justify-between gap-5 relative overflow-hidden transition-all duration-300 ${estilo.border} ${
                  alarmeAtivo ? "shadow-lg shadow-red-500/5" : ""
                }`}
              >
                {/* Linha decorativa de cor na borda */}
                <div className={`absolute top-0 bottom-0 left-0 w-2.5 ${estilo.text.replace("text-", "bg-")}`} />

                <div className="pl-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-extrabold text-white tracking-tight">
                      MÁQUINA PARADA: {o.maquina}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${estilo.badge}`}>
                      Urgência Máxima
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 font-semibold block uppercase">Causa Reportada:</span>
                    <p className="text-base font-bold text-white flex items-center gap-1.5">
                      <AlertOctagon className="h-5 w-5 text-red-500 flex-shrink-0" />
                      {o.motivo}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-700 w-fit">
                    <Clock className="h-4.5 w-4.5 text-red-400 animate-spin" />
                    <div className="text-xs">
                      <span className="text-slate-400 block font-semibold uppercase">Tempo de Parada Técnico:</span>
                      <span className="text-white font-extrabold text-sm tracking-wide">
                        {formatarTempo(segundos)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pl-3">
                  <button
                    onClick={() => handleFinalizar(o)}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl shadow-lg shadow-red-500/10 cursor-pointer flex items-center justify-center gap-2 text-sm transition-colors"
                  >
                    <CheckCircle className="h-4.5 w-4.5" />
                    Finalizar Ocorrência (Manutenção Concluída)
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
