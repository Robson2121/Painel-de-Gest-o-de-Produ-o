/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Users, Shield, ShieldAlert, Trash2, Key, UserPlus } from "lucide-react";
import { Usuario } from "../types";

interface AdminViewProps {
  usuarios: Usuario[];
  ipsBloqueados: { ip: string; tentativas: number }[];
  onAdicionarUsuario: (login: string, cargo: Usuario["cargo"], senha?: string) => Promise<void>;
  onExcluirUsuario: (id: string) => Promise<void>;
  onDesbloquearIp: (ip: string) => Promise<void>;
  usuarioLogado: Usuario;
}

export default function AdminView({
  usuarios,
  ipsBloqueados,
  onAdicionarUsuario,
  onExcluirUsuario,
  onDesbloquearIp,
  usuarioLogado
}: AdminViewProps) {
  const [novoLogin, setNovoLogin] = useState("");
  const [novoCargo, setNovoCargo] = useState<Usuario["cargo"]>("OPERADOR");
  const [novaSenha, setNovaSenha] = useState("");
  const [status, setStatus] = useState("");
  const [erro, setErro] = useState("");

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

  return (
    <div className="space-y-6" id="admin-view">
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
