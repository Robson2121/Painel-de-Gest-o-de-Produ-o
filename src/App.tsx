/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Layout,
  Send,
  Landmark,
  Shield,
  Users,
  LogOut,
  Moon,
  Sun,
  Activity,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PedidoCarrinho, OcorrenciaLider, Usuario, Estatisticas } from "./types";
import { hashPassword } from "./firebase";

// Importação das Visões Modulares
import LoginView from "./components/LoginView";
import DashboardView from "./components/DashboardView";
import OperadorView from "./components/OperadorView";
import LogisticaView from "./components/LogisticaView";
import LiderView from "./components/LiderView";
import RelatoriosView from "./components/RelatoriosView";
import AdminView from "./components/AdminView";

export default function App() {
  const [usuarioLogado, setUsuarioLogado] = useState<Usuario | null>(() => {
    const saved = localStorage.getItem("usuarioLogado");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [temaEscuro, setTemaEscuro] = useState(true);

  // Estados compartilhados de dados vindos do Express
  const [pedidos, setPedidos] = useState<PedidoCarrinho[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaLider[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>(INITIAL_USUARIOS);
  const [ipsBloqueados, setIpsBloqueados] = useState<{ ip: string; tentatives?: number; tentativas: number }[]>([]);
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    total: 0,
    porMaquina: {},
    totalProblemas: 0,
    problemasPorMaquina: {}
  });

  // Aba ativa atual
  const [abaAtiva, setAbaAtiva] = useState<string>(() => {
    return localStorage.getItem("abaAtiva") || "dashboard";
  });


  // Controle de notificações de emergência no navegador e som unificado
  const [lastOcorrenciaIds, setLastOcorrenciaIds] = useState<number[]>([]);
  const [notificacaoAtiva, setNotificacaoAtiva] = useState<{
    id: number;
    maquina: string;
    motivo: string;
  } | null>(null);

  // Carrega configurações de tema salvas
  useEffect(() => {
    const savedTheme = localStorage.getItem("temaFabrica");
    if (savedTheme === "claro") {
      setTemaEscuro(false);
      document.documentElement.classList.remove("dark-theme");
    } else {
      setTemaEscuro(true);
      document.documentElement.classList.add("dark-theme");
    }
  }, []);

  const alternarTema = () => {
    const novoTema = !temaEscuro;
    setTemaEscuro(novoTema);
    if (novoTema) {
      document.documentElement.classList.add("dark-theme");
      localStorage.setItem("temaFabrica", "escuro");
    } else {
      document.documentElement.classList.remove("dark-theme");
      localStorage.setItem("temaFabrica", "claro");
    }
  };

  // Solicita permissão para notificações nativas quando líder ou admin faz login
  useEffect(() => {
    if (usuarioLogado && (usuarioLogado.cargo === "LIDER" || usuarioLogado.cargo === "ADMIN")) {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(err => console.log("Erro ao solicitar permissão de notificações:", err));
      }
    }
  }, [usuarioLogado]);

  // Monitora ocorrências em tempo real e emite som/alerta se houver novos chamados ativos
  useEffect(() => {
    const ativas = ocorrencias.filter(o => o.status === "ATIVA");
    if (ativas.length > 0) {
      // Verifica se existe alguma ocorrência que não estava na lista anterior
      const novasOcorrencias = ativas.filter(o => !lastOcorrenciaIds.includes(o.id));
      
      if (novasOcorrencias.length > 0) {
        const maisRecente = novasOcorrencias[novasOcorrencias.length - 1];
        
        // Ativa a notificação global
        setNotificacaoAtiva({
          id: maisRecente.id,
          maquina: maisRecente.maquina,
          motivo: maisRecente.motivo
        });

        // 1. Envia notificação nativa do sistema operacional/navegador
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(`🚨 MÁQUINA PARADA: ${maisRecente.maquina}`, {
              body: `Motivo: ${maisRecente.motivo}\nChamado ativo de manutenção enviado ao Líder!`,
              icon: "https://cdn-icons-png.flaticon.com/512/179/179386.png",
              requireInteraction: true
            });
          } catch (e) {
            console.error("Falha ao abrir notificação do sistema:", e);
          }
        }

        // 2. Emite sinal sonoro de alarme industrial unificado
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          
          const tocarBipe = (frequencia: number, inicio: number, duracao: number) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.type = "sine";
            osc.frequency.setValueAtTime(frequencia, inicio);
            
            gainNode.gain.setValueAtTime(0, inicio);
            gainNode.gain.linearRampToValueAtTime(0.25, inicio + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, inicio + duracao);
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.start(inicio);
            osc.stop(inicio + duracao);
          };

          // Duplo bipe de alta frequência clássico de painel de controle
          tocarBipe(880, audioCtx.currentTime, 0.25);
          tocarBipe(880, audioCtx.currentTime + 0.35, 0.25);
          tocarBipe(1100, audioCtx.currentTime + 0.7, 0.35);
        } catch (err) {
          console.log("AudioContext bloqueado pelo navegador até interação do usuário.", err);
        }
      }
    }
    
    // Atualiza os IDs conhecidos
    setLastOcorrenciaIds(ocorrencias.map(o => o.id));
  }, [ocorrencias]);

  // Sincroniza usuário logado com localStorage
  useEffect(() => {
    if (usuarioLogado) {
      localStorage.setItem("usuarioLogado", JSON.stringify(usuarioLogado));
    } else {
      localStorage.removeItem("usuarioLogado");
      localStorage.removeItem("abaAtiva");
    }
  }, [usuarioLogado]);

  // Sincroniza aba ativa com localStorage
  useEffect(() => {
    if (usuarioLogado) {
      localStorage.setItem("abaAtiva", abaAtiva);
    }
  }, [abaAtiva, usuarioLogado]);

  // Função para carregar todos os dados do Express em lote de forma resiliente e segura
  const carregarDados = async () => {
    let success = true;
    const fetchSafe = async (url: string) => {
      try {
        const separator = url.includes("?") ? "&" : "?";
        const res = await fetch(`${url}${separator}_t=${Date.now()}`, {
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
          }
        });
        if (!res.ok) {
          success = false;
          return null;
        }
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await res.json();
        }
        success = false;
        return null;
      } catch (err) {
        // Ignora silenciosamente erros de conexão ou de rede temporários
        success = false;
        return null;
      }
    };

    try {
      const [resPedidos, resOcorrencias, resUsuarios, resIps] = await Promise.all([
        fetchSafe("/api/pedidos"),
        fetchSafe("/api/ocorrencias"),
        fetchSafe("/api/usuarios"),
        fetchSafe("/api/ips-bloqueados")
      ]);

      if (resPedidos !== null) setPedidos(resPedidos);
      if (resOcorrencias !== null) setOcorrencias(resOcorrencias);
      if (resUsuarios !== null) setUsuarios(resUsuarios);
      if (resIps !== null) setIpsBloqueados(resIps);
      return success;
    } catch (err) {
      // Ignora quaisquer outros erros inesperados no lote
      return false;
    }
  };

  // Efeito de polling a cada 2 segundos
  useEffect(() => {
    carregarDados();
    const interval = setInterval(carregarDados, 2000);
    return () => clearInterval(interval);
  }, []);

  // Recalcula Estatísticas Dinamicamente no Cliente baseado nas coleções carregadas
  useEffect(() => {
    const porMaquina: Record<string, number> = {};
    const pedidosFinalizados = pedidos.filter(p => p.status === "FINALIZADO");
    pedidosFinalizados.forEach(p => {
      porMaquina[p.maquina] = (porMaquina[p.maquina] || 0) + 1;
    });

    const problemasPorMaquina: Record<string, number> = {};
    ocorrencias.forEach(o => {
      problemasPorMaquina[o.maquina] = (problemasPorMaquina[o.maquina] || 0) + 1;
    });

    setEstatisticas({
      total: pedidosFinalizados.length,
      porMaquina,
      totalProblemas: ocorrencias.length,
      problemasPorMaquina
    });
  }, [pedidos, ocorrencias]);

  // Handlers para as Visões

  // 1. Cadastrar pedido de carrinho no MongoDB
  const handleAdicionarPedido = async (maquina: string, pedido: string) => {
    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maquina, pedido })
      });
      if (!res.ok) throw new Error("Erro ao adicionar pedido");
      carregarDados();
    } catch (err) {
      console.error("Erro ao adicionar pedido:", err);
    }
  };

  // 2. Finalizar pedido de carrinho no MongoDB
  const handleFinalizarPedido = async (id: number) => {
    try {
      const res = await fetch(`/api/pedidos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao finalizar pedido");
      carregarDados();
    } catch (err) {
      console.error("Erro ao finalizar pedido:", err);
    }
  };

  // 3. Cadastrar ocorrência de máquina parada no MongoDB
  const handleAdicionarOcorrencia = async (maquina: string, motivo: string) => {
    try {
      const res = await fetch("/api/ocorrencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maquina, motivo })
      });
      if (!res.ok) throw new Error("Erro ao adicionar ocorrência");
      carregarDados();
    } catch (err) {
      console.error("Erro ao adicionar ocorrência:", err);
    }
  };

  // 4. Resolver ocorrência com tempo de resposta no MongoDB
  const handleResolverOcorrencia = async (id: number, tempoResposta: string) => {
    try {
      const res = await fetch(`/api/ocorrencias/${id}/resolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempoResposta })
      });
      if (!res.ok) throw new Error("Erro ao resolver ocorrência");
      carregarDados();
    } catch (err) {
      console.error("Erro ao resolver ocorrência:", err);
    }
  };

  // 5. Cadastrar novo usuário (Admin) no MongoDB com senha criptografada
  const handleAdicionarUsuario = async (login: string, cargo: Usuario["cargo"], senha?: string) => {
    if (usuarios.some(u => u.login.toLowerCase() === login.toLowerCase())) {
      throw new Error("Usuário com este login já existe");
    }
    
    // Criptografa/hash a senha usando SHA-256. Se não enviada, assume o login como senha inicial.
    const senhaFinal = senha?.trim() || login;
    const senhaCriptografada = await hashPassword(senhaFinal);

    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, cargo, senha: senhaCriptografada })
      });
      if (!res.ok) throw new Error("Erro ao adicionar usuário");
      carregarDados();
    } catch (err) {
      console.error("Erro ao adicionar usuário:", err);
    }
  };

  // 6. Remover usuário (Admin) do MongoDB
  const handleExcluirUsuario = async (id: string) => {
    try {
      const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir usuário");
      carregarDados();
    } catch (err) {
      console.error("Erro ao excluir usuário:", err);
    }
  };

  // 7. Desbloquear IP bloqueado por força bruta no MongoDB
  const handleDesbloquearIp = async (ip: string) => {
    try {
      const res = await fetch(`/api/ips-bloqueados/${ip}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao desbloquear IP");
      carregarDados();
    } catch (err) {
      console.error("Erro ao desbloquear IP:", err);
    }
  };

  // 8. Zerar apenas o fluxo de carrinhos ativos no MongoDB
  const handleZerarRelatorio = async () => {
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      if (!res.ok) throw new Error("Erro ao zerar carrinhos");
      await carregarDados();
      alert("✅ Fluxo de carrinhos entregues (finalizados) zerado com sucesso! Os pedidos pendentes na Logística foram mantidos ativos.");
    } catch (err) {
      console.error("Erro ao resetar relatórios:", err);
    }
  };

  // 9. Limpar histórico de chamados resolvidos do Líder no MongoDB
  const handleLimparHistoricoLider = async () => {
    try {
      const res = await fetch("/api/ocorrencias/limpar-resolvidas", { method: "POST" });
      if (!res.ok) throw new Error("Erro ao limpar histórico");
      await carregarDados();
      alert("✅ Histórico de chamados resolvidos limpo com sucesso!");
    } catch (err) {
      console.error("Erro ao limpar histórico do líder:", err);
    }
  };

  // 10. Forçar sincronização imediata com os pedidos no painel da logística e ocorrências do Líder
  const handleSincronizar = async () => {
    try {
      const ok = await carregarDados();
      if (ok) {
        alert("✅ Sincronização realizada! Dados atualizados com os pedidos da Logística.");
      } else {
        alert("⚠️ Alguns dados podem não ter sido sincronizados. Verifique a conexão com o servidor.");
      }
    } catch (err) {
      console.error("Erro ao sincronizar:", err);
      alert("❌ Erro ao sincronizar com os dados da Logística.");
    }
  };

  // 11. Importar dados de arquivo CSV externo
  const handleImportarCSV = async (dadosImportados: { porMaquina: Record<string, number>; chamadosLider: any[] }) => {
    try {
      // 1. Envia as estatísticas/pedidos por máquina em lote para persistência durável no banco
      const resPedidos = await fetch("/api/pedidos/importar-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ porMaquina: dadosImportados.porMaquina })
      });
      if (!resPedidos.ok) throw new Error("Erro ao importar lote de pedidos");

      // 2. Envia os chamados resolvidos do líder em lote para persistência durável no banco
      if (dadosImportados.chamadosLider.length > 0) {
        const resOcorrencias = await fetch("/api/ocorrencias/importar-lote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chamadosLider: dadosImportados.chamadosLider })
        });
        if (!resOcorrencias.ok) throw new Error("Erro ao importar lote de ocorrências");
      }

      await carregarDados();
      alert("✅ Dados do CSV carregados e sincronizados com o servidor com sucesso!");
    } catch (err) {
      console.error("Erro ao importar CSV:", err);
      alert("❌ Falha ao carregar e persistir dados do CSV no servidor.");
    }
  };

  const handleLogout = () => {
    setUsuarioLogado(null);
    setAbaAtiva("dashboard");
  };

  // Filtros de abas por privilégio de cargo
  const getAbasDisponiveis = () => {
    if (!usuarioLogado) return [];
    
    const cargo = usuarioLogado.cargo;
    if (cargo === "ADMIN") {
      return [
        { id: "dashboard", label: "Dashboard BI", icon: Layout },
        { id: "operador", label: "Produção", icon: Send },
        { id: "logistica", label: "Logística", icon: Landmark },
        { id: "lider", label: "Liderança", icon: Activity },
        { id: "relatorios", label: "Relatórios", icon: FileText },
        { id: "admin", label: "Administração", icon: Users }
      ];
    }

    const abas = [];
    if (cargo === "OPERADOR") abas.push({ id: "operador", label: "Produção", icon: Send });
    if (cargo === "LOGISTICA") abas.push({ id: "logistica", label: "Logística", icon: Landmark });
    if (cargo === "LIDER") abas.push({ id: "lider", label: "Liderança", icon: Activity });
    if (cargo === "RELATORIO") {
      abas.push({ id: "dashboard", label: "Dashboard BI", icon: Layout });
      abas.push({ id: "relatorios", label: "Relatórios", icon: FileText });
    }

    return abas;
  };

  // Se o usuário não estiver logado, exibe tela de login de altíssimo nível
  if (!usuarioLogado) {
    return (
      <LoginView
        onLoginSuccess={(u) => {
          setUsuarioLogado(u);
          // Configura a aba padrão correta dependendo do cargo para melhor usabilidade
          if (u.cargo === "OPERADOR") setAbaAtiva("operador");
          else if (u.cargo === "LOGISTICA") setAbaAtiva("logistica");
          else if (u.cargo === "LIDER") setAbaAtiva("lider");
          else if (u.cargo === "RELATORIO") setAbaAtiva("relatorios");
          else setAbaAtiva("dashboard");
        }}
        usuariosDisponiveis={usuarios.length > 0 ? usuarios : INITIAL_USUARIOS}
      />
    );
  }

  const abasDisponiveis = getAbasDisponiveis();

  return (
    <div className={`min-h-screen transition-colors duration-300 ${temaEscuro ? "bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-800"}`}>
      {/* Cabeçalho do Painel Unificado */}
      <header className={`border-b ${temaEscuro ? "bg-slate-800 border-slate-700/60" : "bg-white border-slate-200"} sticky top-0 z-50 transition-colors`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-blue-500/10">
                ⚙️
              </span>
              <div>
                <h1 className="text-sm font-black tracking-tight text-white sm:text-base">
                  Painel de Gestão Fábrica 2026
                </h1>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                  Tecnologia e Controle Operacional
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Informações do Operador Ativo */}
              <div className="hidden md:flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs font-bold text-white block">
                    {usuarioLogado.login.toUpperCase()}
                  </span>
                  <span className="text-[9px] bg-slate-700 px-2 py-0.5 rounded-full font-bold text-slate-300 block mt-0.5 w-fit ml-auto">
                    {usuarioLogado.cargo}
                  </span>
                </div>
                <div className="h-9 w-9 bg-slate-700/40 rounded-full flex items-center justify-center font-bold border border-slate-600/50 text-white">
                  {usuarioLogado.login[0].toUpperCase()}
                </div>
              </div>

              {/* Botão de Alternar Tema */}
              <button
                onClick={alternarTema}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  temaEscuro
                    ? "bg-slate-700/40 border-slate-600/50 hover:bg-slate-700 text-yellow-400"
                    : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {temaEscuro ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
              </button>

              {/* Botão Sair */}
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 cursor-pointer transition-colors"
                title="Sair do Sistema"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Navegação por Abas Unificadas */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {abasDisponiveis.map(aba => {
              const Icon = aba.icon;
              const ativa = abaAtiva === aba.id;
              const chamadosAtivosCount = ocorrencias.filter(o => o.status === "ATIVA").length;
              const pedidosAtivosCount = pedidos.length;

              return (
                <button
                  key={aba.id}
                  onClick={() => setAbaAtiva(aba.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border whitespace-nowrap cursor-pointer transition-all ${
                    ativa
                      ? "bg-blue-600 text-white border-transparent shadow-lg shadow-blue-500/15"
                      : temaEscuro
                      ? "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700"
                      : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{aba.label}</span>
                  
                  {aba.id === "lider" && chamadosAtivosCount > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white animate-pulse shadow-md shadow-red-500/20">
                      {chamadosAtivosCount}
                    </span>
                  )}

                  {aba.id === "logistica" && pedidosAtivosCount > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white shadow-md shadow-blue-500/20">
                      {pedidosAtivosCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Área de Conteúdo Principal das Abas */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Banner de Notificação de Emergência Global para Líderes e Administradores */}
        <AnimatePresence>
          {notificacaoAtiva && usuarioLogado && (usuarioLogado.cargo === "LIDER" || usuarioLogado.cargo === "ADMIN") && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="mb-6 z-40 max-w-7xl mx-auto"
            >
              <div className="bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white rounded-2xl p-4 shadow-2xl border border-red-500 flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center gap-3.5">
                  <div className="bg-white text-red-600 h-10 w-10 rounded-full flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                    🚨
                  </div>
                  <div>
                    <h4 className="font-black text-sm uppercase tracking-wider text-white flex items-center gap-2">
                      CHAMADO DE EMERGÊNCIA ATIVO!
                    </h4>
                    <p className="text-xs text-white/95 mt-0.5">
                      A <span className="font-black underline">Injetora {notificacaoAtiva.maquina}</span> está PARADA por: <span className="font-bold">"{notificacaoAtiva.motivo}"</span>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                  <button
                    onClick={() => {
                      setAbaAtiva("lider");
                      setNotificacaoAtiva(null);
                    }}
                    className="flex-1 md:flex-none px-4 py-2 bg-white text-red-600 hover:bg-red-50 font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer text-center uppercase"
                  >
                    Ver no Painel
                  </button>
                  <button
                    onClick={() => setNotificacaoAtiva(null)}
                    className="px-3 py-2 bg-black/20 hover:bg-black/30 text-white/90 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer uppercase"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={abaAtiva}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            {abaAtiva === "dashboard" && (
              <DashboardView
                pedidos={pedidos}
                ocorrencias={ocorrencias}
                estatisticas={estatisticas}
              />
            )}
            {abaAtiva === "operador" && (
              <OperadorView
                onAdicionarPedido={handleAdicionarPedido}
                onAdicionarOcorrencia={handleAdicionarOcorrencia}
              />
            )}
            {abaAtiva === "logistica" && (
              <LogisticaView
                pedidos={pedidos}
                onFinalizarPedido={handleFinalizarPedido}
                onSincronizar={handleSincronizar}
              />
            )}
            {abaAtiva === "lider" && (
              <LiderView
                ocorrencias={ocorrencias}
                onResolverOcorrencia={handleResolverOcorrencia}
              />
            )}
            {abaAtiva === "relatorios" && (
              <RelatoriosView
                pedidos={pedidos}
                ocorrencias={ocorrencias}
                estatisticas={estatisticas}
                onZerarRelatorio={handleZerarRelatorio}
                onLimparHistoricoLider={handleLimparHistoricoLider}
                onSincronizar={handleSincronizar}
                onImportarCSV={handleImportarCSV}
              />
            )}
            {abaAtiva === "admin" && (
              <AdminView
                usuarios={usuarios}
                ipsBloqueados={ipsBloqueados}
                onAdicionarUsuario={handleAdicionarUsuario}
                onExcluirUsuario={handleExcluirUsuario}
                onDesbloquearIp={handleDesbloquearIp}
                usuarioLogado={usuarioLogado}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// Fallback inicial em caso de ausência do banco Express
const INITIAL_USUARIOS: Usuario[] = [
  { id: "1", login: "admin", cargo: "ADMIN" },
  { id: "2", login: "lider1", cargo: "LIDER" },
  { id: "3", login: "op1", cargo: "OPERADOR" },
  { id: "4", login: "log1", cargo: "LOGISTICA" },
  { id: "5", login: "bi1", cargo: "RELATORIO" },
];
