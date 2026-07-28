/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Lock, Shield, User, Landmark, Users } from "lucide-react";
import { motion } from "motion/react";
import { Usuario } from "../types";
import { hashPassword } from "../firebase";

interface LoginViewProps {
  onLoginSuccess: (usuario: Usuario) => void;
  usuariosDisponiveis: Usuario[];
}

export default function LoginView({ onLoginSuccess, usuariosDisponiveis }: LoginViewProps) {
  const [usuarioSelecionado, setUsuarioSelecionado] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    const loginFormatado = usuarioSelecionado.trim();
    if (!loginFormatado) {
      setErro("Digite o usuário para continuar.");
      return;
    }

    if (!senha) {
      setErro("Digite a senha de acesso.");
      return;
    }

    setCarregando(true);
    try {
      const usuarioEncontrado = usuariosDisponiveis.find(
        u => u.login.toLowerCase() === loginFormatado.toLowerCase()
      );

      if (usuarioEncontrado) {
        // Criptografa a senha digitada usando SHA-256
        const hashDigitada = await hashPassword(senha);

        // Se o usuário no banco possui a senha gravada criptografada, compara.
        // Como fallback para os seeded originais, aceita também o login como senha inicial.
        const senhaValida = usuarioEncontrado.senha
          ? usuarioEncontrado.senha === hashDigitada
          : usuarioEncontrado.login.toLowerCase() === senha.toLowerCase();

        if (senhaValida) {
          onLoginSuccess(usuarioEncontrado);
        } else {
          setErro("Senha incorreta. Tente novamente.");
        }
      } else {
        setErro("Usuário não cadastrado.");
      }
    } catch (err: any) {
      console.error("Erro na autenticação:", err);
      setErro(err?.message ? `Erro de autenticação: ${err.message}` : "Erro ao realizar autenticação.");
    } finally {
      setCarregando(false);
    }
  };

  const handleDemoLogin = (cargo: Usuario["cargo"]) => {
    // Busca um usuário seeded existente para preencher, ou define um padrão descritivo
    const defaultLogins: Record<string, string> = {
      ADMIN: "admin",
      OPERADOR: "op1",
      LIDER: "lider1",
      LOGISTICA: "log1",
      RELATORIO: "bi1"
    };
    
    const loginDefault = defaultLogins[cargo] || cargo.toLowerCase();
    setUsuarioSelecionado(loginDefault);
    setSenha(loginDefault);
    setErro("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12" id="login-screen">
      <div className="max-w-md w-full space-y-8 bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Landmark className="h-8 w-8 text-white animate-pulse" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-white tracking-tight">
            Painel Industrial
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Sistema de Gestão & Dashboard Unificado de Produção
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {erro && (
            <div className="bg-red-500/15 border border-red-500/30 text-red-200 p-3 rounded-lg text-sm text-center">
              {erro}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="usuario" className="block text-sm font-medium text-slate-300 mb-1">
                Nome de Usuário / Login
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="usuario"
                  type="text"
                  placeholder="Ex: operador1 ou admin"
                  value={usuarioSelecionado}
                  onChange={(e) => {
                    setUsuarioSelecionado(e.target.value);
                    setErro("");
                  }}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-slate-300 mb-1">
                Senha de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="senha"
                  type="password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => {
                    setSenha(e.target.value);
                    setErro("");
                  }}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={carregando}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
            >
              {carregando ? "Autenticando..." : "Entrar no Sistema"}
            </button>
          </div>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-xs text-slate-500 uppercase">
            <span className="bg-slate-800 px-2">Acesso Rápido de Demonstração</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleDemoLogin("ADMIN")}
            className="flex items-center justify-center py-2 px-3 bg-slate-700/50 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            <Shield className="h-4.5 w-4.5 mr-1.5 text-red-400" />
            ADMIN
          </button>
          <button
            onClick={() => handleDemoLogin("OPERADOR")}
            className="flex items-center justify-center py-2 px-3 bg-slate-700/50 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            <User className="h-4.5 w-4.5 mr-1.5 text-blue-400" />
            OPERADOR
          </button>
          <button
            onClick={() => handleDemoLogin("LIDER")}
            className="flex items-center justify-center py-2 px-3 bg-slate-700/50 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            <Users className="h-4.5 w-4.5 mr-1.5 text-amber-400" />
            LÍDER
          </button>
          <button
            onClick={() => handleDemoLogin("LOGISTICA")}
            className="flex items-center justify-center py-2 px-3 bg-slate-700/50 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            <Landmark className="h-4.5 w-4.5 mr-1.5 text-emerald-400" />
            LOGÍSTICA
          </button>
        </div>
      </div>
    </div>
  );
}
