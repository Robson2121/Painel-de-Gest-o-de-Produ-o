/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Users, Shield, ShieldAlert, Trash2, Key, UserPlus, Clock, Plus, Save, RotateCcw } from "lucide-react";
import { Usuario, Turno } from "../types";
import { DEFAULT_TURNOS, obterTurnoAtual } from "../utils/turnos";

interface AdminViewProps {
  usuarios: Usuario[];
  ipsBloqueados: { ip: string; tentativas: number }[];
  turnos: Turno[];
  onAdicionarUsuario: (login: string, cargo: Usuario["cargo"], senha?: string) => Promise<void>;
  onExcluirUsuario: (id: string) => Promise<void>;
  onDesbloquearIp: (ip: string) => Promise<void>;
  onSalvarTurnos: (novosTurnos: Turno[]) => Promise<void>;
  usuarioLogado: Usuario;
}

export default function AdminView({
  usuarios,
  ipsBloqueados,
  turnos,
  onAdicionarUsuario,
  onExcluirUsuario,
  onDesbloquearIp,
  onSalvarTurnos,
  usuarioLogado
}: AdminViewProps) {
  const [novoLogin, setNovoLogin] = useState("");
  const [novoCargo, setNovoCargo] = useState<Usuario["cargo"]>("OPERADOR");
  const [novaSenha, setNovaSenha] = useState("");
  const [status, setStatus] = useState("");
  const [erro, setErro] = useState("");

  // Estado dos turnos
  const [listaTurnos, setListaTurnos] = useState<Turno[]>([]);
  const [modificado, setModificado] = useState(false);
  const [statusTurno, setStatusTurno] = useState("");
  const [erroTurno, setErroTurno] = useState("");
  const [salvandoTurnos, setSalvandoTurnos] = useState(false);

  useEffect(() => {
    // Sincroniza com os turnos do servidor somente se não houver edição pendente do usuário
    if (!modificado) {
      if (turnos && turnos.length > 0) {
        setListaTurnos(turnos);
      } else {
        setListaTurnos(DEFAULT_TURNOS);
      }
    }
  }, [turnos, modificado]);

  const turnoAtivoAgora = obterTurnoAtual(listaTurnos);

  const handleAdicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("");
    setErro("");

    if (!novoLogin.trim()) {
      setErro("Insira um login válido.");
      return;
    }

    if (!novaSenha.trim()) {
      setErro("Insira uma senha de acesso válida.");
      return;
    }

    try {
      await onAdicionarUsuario(novoLogin.trim(), novoCargo, novaSenha.trim());
      setNovoLogin("");
      setNovaSenha("");
      setStatus("✅ Usuário cadastrado com sucesso!");
      setTimeout(() => setStatus(""), 4000);
    } catch (e: any) {
      setErro(e.message || "Erro ao cadastrar usuário.");
    }
  };

  const handleExcluir = async (u: Usuario) => {
    if (u.id === usuarioLogado.id) {
      setErro("❌ Você não pode excluir a si mesmo!");
      return;
    }
    try {
      await onExcluirUsuario(u.id);
      setStatus("✅ Usuário excluído com sucesso!");
      setTimeout(() => setStatus(""), 4000);
    } catch (e: any) {
      setErro(e.message || "Erro ao excluir usuário.");
    }
  };

  // Funções dos Turnos
  const handleAlterarCampoTurno = (index: number, campo: keyof Turno, valor: string) => {
    const copia = [...listaTurnos];
    copia[index] = { ...copia[index], [campo]: valor };
    setListaTurnos(copia);
    setModificado(true);
    setStatusTurno("");
  };

  const handleAdicionarTurno = () => {
    const id = `t_${Date.now()}`;
    const novoIndex = listaTurnos.length + 1;
    const novo: Turno = {
      id,
      nome: `${novoIndex}º Turno Extra`,
      inicio: "08:00",
      termino: "16:00"
    };
    setListaTurnos([...listaTurnos, novo]);
    setModificado(true);
    setStatusTurno("");
  };

  const handleRemoverTurno = (id: string) => {
    if (listaTurnos.length <= 1) {
      setErroTurno("O sistema precisa ter pelo menos 1 turno ativo.");
      return;
    }
    setListaTurnos(listaTurnos.filter(t => t.id !== id));
    setModificado(true);
    setStatusTurno("");
  };

  const handleRestaurarPadraoTurnos = () => {
    setListaTurnos(DEFAULT_TURNOS);
    setModificado(true);
    setStatusTurno("");
  };

  const handleSalvarTodosTurnos = async () => {
    setStatusTurno("");
    setErroTurno("");
    setSalvandoTurnos(true);

    try {
      await onSalvarTurnos(listaTurnos);
      setModificado(false);
      setStatusTurno("✅ Configuração de turnos salva e aplicada com sucesso!");
      setTimeout(() => setStatusTurno(""), 4000);
    } catch (e: any) {
      setErroTurno(e.message || "Erro ao salvar turnos.");
    } finally {
      setSalvandoTurnos(false);
    }
  };

  return (
    <div className="space-y-6" id="admin-view">
      {/* SEÇÃO 1: CONFIGURAÇÃO DE TURNOS DA FÁBRICA */}
      <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="h-5.5 w-5.5 text-amber-400" />
              Configuração de Turnos Operacionais
              {modificado && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-extrabold animate-pulse">
                  Alteraçoes pendentes
                </span>
              )}
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Defina os horários de início e término dos turnos de produção para diferenciar os relatórios e métricas da Dashboard.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">Turno Ativo Agora:</span>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-black rounded-lg flex items-center gap-1.5 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              {turnoAtivoAgora.nome} ({turnoAtivoAgora.inicio} às {turnoAtivoAgora.termino})
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 font-semibold text-xs text-slate-400 uppercase tracking-wider px-1 hidden md:grid">
            <div className="col-span-4">Nome do Turno</div>
            <div className="col-span-3">Início (HH:mm)</div>
            <div className="col-span-3">Término (HH:mm)</div>
            <div className="col-span-2 text-right">Ação</div>
          </div>

          {listaTurnos.map((t, index) => {
            const isAtual = t.id === turnoAtivoAgora.id;
            return (
              <div
                key={t.id}
                className={`grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3 rounded-xl border transition-all ${
                  isAtual
                    ? "bg-amber-500/10 border-amber-500/30 text-white"
                    : "bg-slate-900/50 border-slate-700 text-slate-300"
                }`}
              >
                <div className="col-span-4">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block md:hidden mb-1">
                    Nome do Turno
                  </label>
                  <input
                    type="text"
                    value={t.nome}
                    onChange={(e) => handleAlterarCampoTurno(index, "nome", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-bold"
                    placeholder="Ex: 1º Turno (Manhã)"
                  />
                </div>

                <div className="col-span-3">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block md:hidden mb-1">
                    Horário de Início
                  </label>
                  <input
                    type="time"
                    value={t.inicio}
                    onChange={(e) => handleAlterarCampoTurno(index, "inicio", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-mono font-bold [color-scheme:dark]"
                  />
                </div>

                <div className="col-span-3">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block md:hidden mb-1">
                    Horário de Término
                  </label>
                  <input
                    type="time"
                    value={t.termino}
                    onChange={(e) => handleAlterarCampoTurno(index, "termino", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-mono font-bold [color-scheme:dark]"
                  />
                </div>

                <div className="col-span-2 text-right flex items-center justify-end gap-2">
                  {isAtual && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-1 rounded-md font-bold">
                      EM ATUAÇÃO
                    </span>
                  )}
                  <button
                    onClick={() => handleRemoverTurno(t.id)}
                    className="p-2 bg-red-500/15 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all cursor-pointer"
                    title="Excluir este turno"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {statusTurno && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-bold text-xs text-center">
            {statusTurno}
          </div>
        )}
        {erroTurno && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-bold text-xs text-center">
            {erroTurno}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdicionarTurno}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-600"
            >
              <Plus className="h-4 w-4" />
              Adicionar Novo Turno
            </button>

            <button
              type="button"
              onClick={handleRestaurarPadraoTurnos}
              className="px-4 py-2 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar Padrão (3 Turnos)
            </button>
          </div>

          <button
            type="button"
            onClick={handleSalvarTodosTurnos}
            disabled={salvandoTurnos}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/15 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {salvandoTurnos ? "Salvando Turnos..." : "Salvar Configuração de Turnos"}
          </button>
        </div>
      </div>

      {/* SEÇÃO 2: USUÁRIOS E SEGURANÇA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cadastrar Usuário */}
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-400" />
            Cadastrar Novo Acesso
          </h3>

          <form onSubmit={handleAdicionar} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                Nome de Usuário (Login)
              </label>
              <input
                type="text"
                placeholder="Ex: operador1"
                value={novoLogin}
                onChange={(e) => setNovoLogin(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                Senha de Acesso
              </label>
              <input
                type="password"
                placeholder="Ex: senhaSegura123"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                Cargo Operacional (Permissão)
              </label>
              <select
                value={novoCargo}
                onChange={(e) => setNovoCargo(e.target.value as Usuario["cargo"])}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="OPERADOR">OPERADOR (Produção)</option>
                <option value="LIDER">LÍDER (Painel do Líder)</option>
                <option value="LOGISTICA">LOGÍSTICA (Carrinhos)</option>
                <option value="RELATORIO">RELATÓRIO (Gerencial/BI)</option>
                <option value="ADMIN">ADMINISTRADOR (Geral)</option>
              </select>
            </div>

            {status && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-bold text-xs text-center">
                {status}
              </div>
            )}
            {erro && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-bold text-xs text-center">
                {erro}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/15 cursor-pointer text-sm transition-colors"
            >
              Adicionar Usuário
            </button>
          </form>
        </div>

        {/* Gerenciar Usuários */}
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-4 lg:col-span-2">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            Usuários Ativos do Sistema
          </h3>

          <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1">
            <table className="min-w-full divide-y divide-slate-700 text-sm">
              <thead>
                <tr className="text-slate-400 text-xs font-semibold uppercase text-left">
                  <th className="py-2.5 px-3 bg-slate-900/60 rounded-l-xl">Login</th>
                  <th className="py-2.5 px-3 bg-slate-900/60">Cargo</th>
                  <th className="py-2.5 px-3 bg-slate-900/60 rounded-r-xl text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {usuarios.map(u => (
                  <tr key={u.id} className="text-slate-300 hover:bg-slate-900/20 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                      <Shield className={`h-4 w-4 ${u.cargo === "ADMIN" ? "text-red-400" : "text-slate-400"}`} />
                      {u.login.toUpperCase()}
                      {u.id === usuarioLogado.id && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded">
                          Você
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block bg-slate-900 border border-slate-700 text-xs font-semibold px-2 py-0.5 rounded-lg text-slate-400">
                        {u.cargo}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleExcluir(u)}
                        disabled={u.id === usuarioLogado.id}
                        className="p-1.5 bg-red-500/15 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-40 disabled:hover:bg-red-500/15 transition-all cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gerenciamento de IPs bloqueados */}
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl space-y-4 lg:col-span-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-400" />
            IPs Trancados por Força Bruta (Prevenção de Invasão)
          </h3>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 text-sm">
              <thead>
                <tr className="text-slate-400 text-xs font-semibold uppercase text-left">
                  <th className="py-2.5 px-3 bg-slate-900/60 rounded-l-xl">Endereço IP</th>
                  <th className="py-2.5 px-3 bg-slate-900/60">Tentativas Falhas</th>
                  <th className="py-2.5 px-3 bg-slate-900/60 rounded-r-xl text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {ipsBloqueados.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-500 text-xs">
                      ✅ Nenhum endereço IP bloqueado por força bruta. Segurança operacional limpa!
                    </td>
                  </tr>
                ) : (
                  ipsBloqueados.map(item => (
                    <tr key={item.ip} className="text-slate-300">
                      <td className="py-2.5 px-3 font-mono font-bold text-white">{item.ip}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
                          {item.tentativas} erros
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onDesbloquearIp(item.ip)}
                          className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg border border-emerald-500/20 transition-all font-bold text-xs cursor-pointer"
                        >
                          Liberar Acesso
                        </button>
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
