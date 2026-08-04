/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Send, Calculator, AlertTriangle, HelpCircle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface OperadorViewProps {
  onAdicionarPedido: (maquina: string, pedido: string) => Promise<void>;
  onAdicionarOcorrencia: (maquina: string, motivo: string) => Promise<void>;
}

export default function OperadorView({ onAdicionarPedido, onAdicionarOcorrencia }: OperadorViewProps) {
  // Estados de Solicitação
  const [maquina, setMaquina] = useState("K1014-1");
  const [carrinho, setCarrinho] = useState("3 Bandejas");
  const [statusEnvio, setStatusEnvio] = useState("");
  const [tipoEnvio, setTipoEnvio] = useState<"sucesso" | "erro" | "processando" | "">("");

  // Estados de Calculadora
  const [ciclo, setCiclo] = useState("");
  const [pecas, setPecas] = useState("");
  const [tempo, setTempo] = useState("");
  const [resultadoCalculo, setResultadoCalculo] = useState<string | null>(null);
  const [erroCalculo, setErroCalculo] = useState(false);

  // Estados de Alerta de Parada
  const [abrirAlerta, setAbrirAlerta] = useState(false);
  const [maquinaProblema, setMaquinaProblema] = useState("K1014-1");
  const [motivoProblema, setMotivoProblema] = useState("Peça Esfarelando no Bico / Matriz");
  const [statusAlerta, setStatusAlerta] = useState("");
  const [tipoAlerta, setTipoAlerta] = useState<"sucesso" | "">("");
  const [toastNotificacao, setToastNotificacao] = useState<string | null>(null);

  const maquinasOpcoes = [
    "K1014-1", "K1014-2", "K1014-3", "K1014-4", "K1014-6", "K1014-7",
    "K1014-8", "K1014-9", "K1014-10", "K813-1", "K813-2", "K68-1",
    "K68-2", "T-Line 1", "T-Line 2", "K1318", "TEUBERT"
  ];

  const carrinhosOpcoes = [
    "1 Bandeja", "2 Bandejas", "3 Bandejas", "6 Bandejas",
    "7 Bandejas", "9 Bandejas", "12 Bandejas", "GANCHEIRA"
  ];

  const handleEnviarPedido = async () => {
    setStatusEnvio("");
    setTipoEnvio("");

    // Bloqueio Teubert Rígido
    if (maquina.toUpperCase() === "TEUBERT" && carrinho.toUpperCase() !== "GANCHEIRA") {
      setTipoEnvio("erro");
      setStatusEnvio("❌ ERRO: A máquina TEUBERT aceita apenas o carrinho tipo GANCHEIRA!");
      return;
    }

    setTipoEnvio("processando");
    setStatusEnvio("Enviando solicitação...");

    let textoPedido = `Solicito Carrinho com ${carrinho}`;
    if (carrinho.startsWith("1 ")) {
      textoPedido = "Solicito Carrinho de 1 Bandeja";
    } else if (maquina.toUpperCase() === "TEUBERT") {
      textoPedido = "Solicito Carrinho com GANCHOS para os Bancos";
    }

    try {
      await onAdicionarPedido(maquina, textoPedido);
      setTipoEnvio("sucesso");
      setStatusEnvio("✅ SOLICITAÇÃO ENVIADA COM SUCESSO!");
      setTimeout(() => {
        setStatusEnvio("");
        setTipoEnvio("");
      }, 3500);
    } catch (e) {
      setTipoEnvio("erro");
      setStatusEnvio("❌ Falha de conexão ao enviar.");
    }
  };

  const handleCalcular = () => {
    setResultadoCalculo(null);
    setErroCalculo(false);

    const c = parseFloat(ciclo);
    const p = parseFloat(pecas);
    const t = parseFloat(tempo);

    if (c > 0 && p > 0 && t > 0) {
      const cicloMin = c / 60;
      const totalPecas = Math.round((t / cicloMin) * p);
      setResultadoCalculo(`${totalPecas} Peças Estimadas`);
    } else {
      setErroCalculo(true);
      setResultadoCalculo("Preencha todos os campos!");
    }
  };

  const handleEnviarAlerta = async () => {
    setStatusAlerta("Enviando chamado ao Líder...");
    try {
      await onAdicionarOcorrencia(maquinaProblema, motivoProblema);
      
      // Feedback imediato e fechamento da aba de reportar problema
      setToastNotificacao(`Chamado de emergência para a máquina ${maquinaProblema} foi enviado com sucesso e já está piscando e tocando sirene no painel do Líder!`);
      
      // Minimiza a aba imediatamente
      setAbrirAlerta(false);
      setStatusAlerta("");
      setTipoAlerta("");

      // Limpa a notificação depois de 8 segundos
      setTimeout(() => {
        setToastNotificacao(null);
      }, 8000);
    } catch (e) {
      setStatusAlerta("❌ Falha ao enviar chamado ao Líder. Tente novamente.");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative" id="operador-view">
      {/* Toast de Notificação de Feedback Global */}
      <AnimatePresence>
        {toastNotificacao && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-4 left-4 md:left-auto md:right-8 md:max-w-md z-50 p-4 bg-red-600 border border-red-500 text-white font-bold rounded-2xl shadow-2xl flex items-start gap-3.5"
          >
            <div className="text-2xl mt-0.5 animate-bounce">🚨</div>
            <div className="flex-1 text-xs md:text-sm leading-relaxed">
              <span className="block font-black uppercase text-white tracking-wider text-[11px] mb-1 bg-white/20 px-2 py-0.5 rounded w-fit">
                CHAMADO REGISTRADO
              </span>
              {toastNotificacao}
            </div>
            <button
              onClick={() => setToastNotificacao(null)}
              className="text-white/80 hover:text-white font-bold text-xs bg-white/10 hover:bg-white/25 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              FECHAR
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Solicitação de Carrinho */}
      <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Send className="h-5 w-5 text-blue-400" />
          Solicitar Carrinho para Linha
        </h3>
        <p className="text-xs text-slate-400">
          Selecione a sua moldadora e o tipo de carrinho necessário no momento.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
              Máquina / Moldadora
            </label>
            <select
              value={maquina}
              onChange={(e) => setMaquina(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
            >
              {maquinasOpcoes.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
              Tipo de Carrinho
            </label>
            <select
              value={carrinho}
              onChange={(e) => setCarrinho(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
            >
              {carrinhosOpcoes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {statusEnvio && (
            <div
              className={`p-3.5 rounded-xl text-center font-bold text-sm leading-normal border transition-all ${
                tipoEnvio === "sucesso"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : tipoEnvio === "erro"
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-slate-900/40 border-slate-700 text-blue-400"
              }`}
            >
              {statusEnvio}
            </div>
          )}

          <button
            onClick={handleEnviarPedido}
            disabled={tipoEnvio === "processando"}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/15 cursor-pointer text-sm transition-colors"
          >
            Confirmar Solicitação de Carrinho
          </button>
        </div>
      </div>

      {/* Calculadora de Produção */}
      <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Calculator className="h-5 w-5 text-blue-400" />
          Calculadora de Estimativas
        </h3>
        <p className="text-xs text-slate-400">
          Calcule a quantidade planejada com base no ciclo técnico e tempo programado.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
              Ciclo (s)
            </label>
            <input
              type="number"
              placeholder="Ex: 45"
              value={ciclo}
              onChange={(e) => setCiclo(e.target.value)}
              onClick={() => setCiclo("")}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
              Peças / Ciclo
            </label>
            <input
              type="number"
              placeholder="Ex: 2"
              value={pecas}
              onChange={(e) => setPecas(e.target.value)}
              onClick={() => setPecas("")}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
              Tempo (min)
            </label>
            <input
              type="number"
              placeholder="Ex: 480"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
              onClick={() => setTempo("")}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {resultadoCalculo !== null && (
          <div
            className={`p-3.5 rounded-xl text-center font-bold text-sm leading-normal border transition-all ${
              erroCalculo
                ? "bg-red-500/10 border-red-500/20 text-red-400"
                : "bg-blue-500/10 border-blue-500/20 text-blue-400"
            }`}
          >
            {resultadoCalculo}
          </div>
        )}

        <button
          onClick={handleCalcular}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/15 cursor-pointer text-sm transition-colors"
        >
          Calcular Peças Estimadas
        </button>
      </div>

      {/* Accordion Alerta de Emergência - Reportar ao Líder */}
      <div className="lg:col-span-2 bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-4">
        <button
          onClick={() => setAbrirAlerta(!abrirAlerta)}
          className="w-full flex items-center justify-between text-left focus:outline-none"
        >
          <span className="text-lg font-bold text-red-500 flex items-center gap-2">
            <AlertTriangle className="h-5.5 w-5.5 text-red-500 animate-bounce" />
            ⚠️ Reportar Problema / Chamado do Líder
          </span>
          <span className="text-xs text-slate-400 bg-slate-700 px-3 py-1.5 rounded-xl font-semibold">
            {abrirAlerta ? "Ocultar Painel" : "Exibir Painel"}
          </span>
        </button>

        {abrirAlerta && (
          <div className="pt-4 border-t border-slate-700/60 space-y-4">
            <p className="text-xs text-slate-400">
              Caso a sua moldadora selecionada acima esteja parada por problemas críticos, registre a ocorrência abaixo para alertar imediatamente a liderança de fábrica.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Máquina Afetada
                </label>
                <select
                  value={maquinaProblema}
                  onChange={(e) => setMaquinaProblema(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                >
                  {maquinasOpcoes.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Motivo da Parada
                </label>
                <select
                  value={motivoProblema}
                  onChange={(e) => setMotivoProblema(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="Peça Esfarelando no Bico / Matriz">Peça Esfarelando no Bico / Matriz</option>
                  <option value="Peça Enroscada no Molde">Peça Enroscada no Molde</option>
                  <option value="Falta de Matéria-Prima">Falta de Matéria-Prima</option>
                  <option value="Falha no travamento do Molde">Falha no travamento do Molde</option>
                </select>
              </div>
            </div>

            {statusAlerta && (
              <div
                className={`p-3.5 rounded-xl text-center font-bold text-sm border ${
                  tipoAlerta === "sucesso"
                    ? "bg-red-500/15 border-red-500/30 text-red-300"
                    : "bg-slate-900/40 border-slate-700 text-slate-400"
                }`}
              >
                {statusAlerta}
              </div>
            )}

            <button
              onClick={handleEnviarAlerta}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl shadow-lg shadow-red-500/15 cursor-pointer text-sm transition-colors"
            >
              ⚠️ CONFIRMAR E DISPARAR ALERTA INDUSTRIAL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
