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
  FileText,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PedidoCarrinho, OcorrenciaLider, Usuario, Estatisticas, Turno } from "./types";
import { hashPassword } from "./firebase";
import { DEFAULT_TURNOS } from "./utils/turnos";
import {
  getCachedState,
  saveCachedState,
  getOfflineQueue,
  enqueueOfflineAction,
  processSyncQueue,
  getFinalizedLocalIds,
  addFinalizedLocalId,
  getResolvedLocalIds,
  addResolvedLocalId
} from "./utils/offlineSync";

// Importação das Visões Modulares
import LoginView from "./components/LoginView";
import DashboardView from "./components/DashboardView";
import OperadorView from "./components/OperadorView";
import LogisticaView from "./components/LogisticaView";
import LiderView from "./components/LiderView";
import RelatoriosView from "./components/RelatoriosView";
import AdminView from "./components/AdminView";
import HistoricoSincronizacao from "./components/HistoricoSincronizacao";

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

  // Lê estado inicial armazenado no cache local offline
  const initialCache = getCachedState();

  // Estados compartilhados de dados vindos do Express e MongoDB / Local Fallback
  const [pedidos, setPedidos] = useState<PedidoCarrinho[]>(initialCache?.pedidos || []);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaLider[]>(initialCache?.ocorrencias || []);
  const [usuarios, setUsuarios] = useState<Usuario[]>(initialCache?.usuarios || INITIAL_USUARIOS);
  const [ipsBloqueados, setIpsBloqueados] = useState<{ ip: string; tentatives?: number; tentativas: number }[]>(initialCache?.ipsBloqueados || []);
  const [turnos, setTurnos] = useState<Turno[]>(initialCache?.turnos || DEFAULT_TURNOS);
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    total: 0,
    porMaquina: {},
    totalProblemas: 0,
    problemasPorMaquina: {}
  });

  // Estados de resiliência e sincronização de conexão offline
  const [servidorConectado, setServidorConectado] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [pendentesSyncCount, setPendentesSyncCount] = useState<number>(() => getOfflineQueue().length);
  const [statusSyncMsg, setStatusSyncMsg] = useState<string>("");
  const [modalSyncAberto, setModalSyncAberto] = useState(false);

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
    // 1. Processa fila de ações pendentes se o servidor estiver disponível
    const queue = getOfflineQueue();
    setPendentesSyncCount(queue.length);

    if (queue.length > 0 && !sincronizando) {
      setSincronizando(true);
      try {
        const syncResult = await processSyncQueue();
        if (syncResult.success) {
          setServidorConectado(true);
          setPendentesSyncCount(0);
          if (syncResult.syncedCount > 0) {
            setStatusSyncMsg(`✅ ${syncResult.syncedCount} ação(ões) offline sincronizada(s) automaticamente com o servidor!`);
            setTimeout(() => setStatusSyncMsg(""), 4000);
          }
        }
      } catch (e) {
        setServidorConectado(false);
      } finally {
        setSincronizando(false);
      }
    }

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
        success = false;
        return null;
      }
    };

    try {
      const [resPedidos, resOcorrencias, resUsuarios, resIps, resTurnos] = await Promise.all([
        fetchSafe("/api/pedidos"),
        fetchSafe("/api/ocorrencias"),
        fetchSafe("/api/usuarios"),
        fetchSafe("/api/ips-bloqueados"),
        fetchSafe("/api/turnos")
      ]);

      if (success) {
        setServidorConectado(true);
      } else {
        setServidorConectado(false);
      }

      let novosPedidos = pedidos;
      let novasOcorrencias = ocorrencias;
      let novosUsuarios = usuarios;
      let novosIps = ipsBloqueados;
      let novosTurnos = turnos;

      // Se o servidor respondeu, mescla os dados do servidor respeitando ações pendentes e finalizações locais
      if (resPedidos !== null) {
        const currentQueue = getOfflineQueue();
        const pendingFinalizedIds = new Set([
          ...currentQueue.filter(q => q.type === "FINALIZE_PEDIDO" && q.payload?.id).map(q => String(q.payload.id)),
          ...getFinalizedLocalIds()
        ]);
        const pedidosAjustados = resPedidos.map((p: PedidoCarrinho) => 
          pendingFinalizedIds.has(String(p.id)) ? { ...p, status: "FINALIZADO" as const } : p
        );
        setPedidos(pedidosAjustados);
        novosPedidos = pedidosAjustados;
      } else {
        // Fallback para cache local em modo offline
        const cached = getCachedState();
        if (cached && cached.pedidos && cached.pedidos.length > 0) {
          const pendingFinalizedIds = new Set(getFinalizedLocalIds());
          const pedidosAjustados = cached.pedidos.map((p: PedidoCarrinho) =>
            pendingFinalizedIds.has(String(p.id)) ? { ...p, status: "FINALIZADO" as const } : p
          );
          setPedidos(pedidosAjustados);
          novosPedidos = pedidosAjustados;
        }
      }

      if (resOcorrencias !== null) {
        const currentQueue = getOfflineQueue();
        const pendingResolvedIds = new Set([
          ...currentQueue.filter(q => q.type === "RESOLVE_OCORRENCIA" && q.payload?.id).map(q => String(q.payload.id)),
          ...getResolvedLocalIds()
        ]);
        const ocorrenciasAjustadas = resOcorrencias.map((o: OcorrenciaLider) => 
          pendingResolvedIds.has(String(o.id)) ? { ...o, status: "RESOLVIDA" as const } : o
        );
        setOcorrencias(ocorrenciasAjustadas);
        novasOcorrencias = ocorrenciasAjustadas;
      } else {
        const cached = getCachedState();
        if (cached && cached.ocorrencias && cached.ocorrencias.length > 0) {
          const pendingResolvedIds = new Set(getResolvedLocalIds());
          const ocorrenciasAjustadas = cached.ocorrencias.map((o: OcorrenciaLider) =>
            pendingResolvedIds.has(String(o.id)) ? { ...o, status: "RESOLVIDA" as const } : o
          );
          setOcorrencias(ocorrenciasAjustadas);
          novasOcorrencias = ocorrenciasAjustadas;
        }
      }

      if (resUsuarios !== null) {
        setUsuarios(resUsuarios);
        novosUsuarios = resUsuarios;
      }
      if (resIps !== null) {
        setIpsBloqueados(resIps);
        novosIps = resIps;
      }
      if (resTurnos !== null && Array.isArray(resTurnos) && resTurnos.length > 0) {
        setTurnos(prev => {
          if (JSON.stringify(prev) === JSON.stringify(resTurnos)) return prev;
          novosTurnos = resTurnos;
          return resTurnos;
        });
      }

      // Atualiza cache local para garantia de funcionamento se o servidor cair
      saveCachedState({
        pedidos: novosPedidos,
        ocorrencias: novasOcorrencias,
        usuarios: novosUsuarios,
        ipsBloqueados: novosIps,
        turnos: novosTurnos
      });

      return success;
    } catch (err) {
      setServidorConectado(false);
      const cached = getCachedState();
      if (cached) {
        if (cached.pedidos) setPedidos(cached.pedidos);
        if (cached.ocorrencias) setOcorrencias(cached.ocorrencias);
      }
      return false;
    }
  };

  // Efeito para monitorar status online/offline do navegador
  useEffect(() => {
    const handleOnline = () => {
      setServidorConectado(true);
      carregarDados();
    };
    const handleOffline = () => {
      setServidorConectado(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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

  // 1. Cadastrar pedido de carrinho no MongoDB / Fallback Offline
  const handleAdicionarPedido = async (maquina: string, pedido: string) => {
    const now = Date.now();
    const novoPedido: PedidoCarrinho = {
      id: now,
      maquina,
      pedido,
      data: new Date(now).toLocaleString("pt-BR"),
      timestamp: now,
      status: "ATIVO"
    };

    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novoPedido)
      });
      if (!res.ok) throw new Error("Servidor indisponível");
      carregarDados();
    } catch (err) {
      console.warn("Servidor offline ao cadastrar pedido. Salvando localmente...", err);
      setPedidos(prev => {
        const updated = [...prev, novoPedido];
        saveCachedState({ pedidos: updated });
        return updated;
      });
      enqueueOfflineAction("ADD_PEDIDO", novoPedido);
      setPendentesSyncCount(getOfflineQueue().length);
      setStatusSyncMsg("⚡ Conexão offline: Pedido gravado localmente. Será sincronizado automaticamente ao restabelecer o servidor.");
      setTimeout(() => setStatusSyncMsg(""), 5000);
    }
  };

  // 2. Finalizar pedido de carrinho no MongoDB / Fallback Offline
  const handleFinalizarPedido = async (id: number | string) => {
    addFinalizedLocalId(id);

    // Atualização otimista imediata da interface
    setPedidos(prev => {
      let matched = false;
      let updated = prev.map(p => {
        if (String(p.id) === String(id) || p.id === id) {
          matched = true;
          return { ...p, status: "FINALIZADO" as const };
        }
        return p;
      });
      if (!matched) {
        const activeIdx = updated.findIndex(p => p.status === "ATIVO");
        if (activeIdx !== -1) {
          addFinalizedLocalId(updated[activeIdx].id);
          updated[activeIdx] = { ...updated[activeIdx], status: "FINALIZADO" as const };
        }
      }
      saveCachedState({ pedidos: updated });
      return updated;
    });

    try {
      const res = await fetch(`/api/pedidos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Servidor indisponível");
      carregarDados();
    } catch (err) {
      console.warn("Servidor offline ao finalizar pedido. Enfileirando ação...", err);
      enqueueOfflineAction("FINALIZE_PEDIDO", { id });
      setPendentesSyncCount(getOfflineQueue().length);
      setStatusSyncMsg("⚡ Conexão offline: Finalização gravada na fila de sincronização.");
      setTimeout(() => setStatusSyncMsg(""), 4000);
    }
  };

  // 3. Cadastrar ocorrência de máquina parada no MongoDB / Fallback Offline
  const handleAdicionarOcorrencia = async (maquina: string, motivo: string) => {
    const now = Date.now();
    const novaOcorrencia: OcorrenciaLider = {
      id: now,
      maquina,
      motivo,
      data: new Date(now).toLocaleTimeString("pt-BR"),
      timestamp: now,
      status: "ATIVA"
    };

    try {
      const res = await fetch("/api/ocorrencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novaOcorrencia)
      });
      if (!res.ok) throw new Error("Servidor indisponível");
      carregarDados();
    } catch (err) {
      console.warn("Servidor offline ao adicionar ocorrência. Salvando localmente...", err);
      setOcorrencias(prev => {
        const updated = [novaOcorrencia, ...prev];
        saveCachedState({ ocorrencias: updated });
        return updated;
      });
      enqueueOfflineAction("ADD_OCORRENCIA", novaOcorrencia);
      setPendentesSyncCount(getOfflineQueue().length);
      setStatusSyncMsg("🚨 Conexão offline: Chamado gravado localmente. Será enviado assim que o servidor retornar.");
      setTimeout(() => setStatusSyncMsg(""), 5000);
    }
  };

  // 4. Resolver ocorrência com tempo de resposta no MongoDB / Fallback Offline
  const handleResolverOcorrencia = async (id: number | string, tempoResposta: string) => {
    addResolvedLocalId(id);

    setOcorrencias(prev => {
      let matched = false;
      let updated = prev.map(o => {
        if (String(o.id) === String(id) || o.id === id) {
          matched = true;
          return { ...o, status: "RESOLVIDA" as const, tempoResposta };
        }
        return o;
      });
      if (!matched) {
        const activeIdx = updated.findIndex(o => o.status === "ATIVA");
        if (activeIdx !== -1) {
          addResolvedLocalId(updated[activeIdx].id);
          updated[activeIdx] = { ...updated[activeIdx], status: "RESOLVIDA" as const, tempoResposta };
        }
      }
      saveCachedState({ ocorrencias: updated });
      return updated;
    });

    try {
      const res = await fetch(`/api/ocorrencias/${id}/resolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempoResposta })
      });
      if (!res.ok) throw new Error("Servidor indisponível");
      carregarDados();
    } catch (err) {
      console.warn("Servidor offline ao resolver ocorrência. Enfileirando ação...", err);
      enqueueOfflineAction("RESOLVE_OCORRENCIA", { id, tempoResposta });
      setPendentesSyncCount(getOfflineQueue().length);
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

  // 10. Forçar sincronização imediata com os pedidos no painel da logística e ocorrências do dia
  const handleSincronizar = async () => {
    try {
      // 1. Processa qualquer ação pendente na fila offline
      await processSyncQueue();

      // 2. Sincroniza e recarrega todos os pedidos da Logística e ocorrências do servidor
      const ok = await carregarDados();
      if (ok) {
        alert("✅ Sincronização concluída! Dados atualizados com todos os pedidos do painel da logística e ocorrências ocorridas no dia de hoje.");
      } else {
        alert("⚠️ Alguns dados de rede podem estar desatualizados. Verifique a conexão com o servidor.");
      }
    } catch (err) {
      console.error("Erro ao sincronizar:", err);
      alert("❌ Erro ao sincronizar com os dados da Logística e Ocorrências.");
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
        { id: "admin", label: "Administração", icon: Users },
        { id: "sync_history", label: "Histórico Sync", icon: Zap }
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

  const handleSalvarTurnos = async (novosTurnos: Turno[]) => {
    setTurnos(novosTurnos);
    try {
      const res = await fetch("/api/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnos: novosTurnos })
      });
      if (!res.ok) throw new Error("Servidor indisponível");
      await carregarDados();
    } catch (err) {
      console.warn("Servidor offline ao salvar turnos. Enfileirando ação...", err);
      enqueueOfflineAction("SAVE_TURNOS", { turnos: novosTurnos });
      setPendentesSyncCount(getOfflineQueue().length);
    }
  };

  const abasDisponiveis = getAbasDisponiveis();

  return (
    <div className={`min-h-screen transition-colors duration-300 ${temaEscuro ? "bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-800"}`}>
      {/* Cabeçalho do Painel Unificado */}
      <header className={`border-b ${temaEscuro ? "bg-slate-800 border-slate-700/60" : "bg-white border-slate-200"} sticky top-0 z-50 transition-colors`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
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

              {/* Indicador de Status Online / Offline / Sync */}
              <button
                onClick={() => {
                  if (usuarioLogado?.cargo === "ADMIN") {
                    setModalSyncAberto(true);
                  }
                }}
                className={`ml-2 transition-transform ${
                  usuarioLogado?.cargo === "ADMIN" ? "cursor-pointer hover:scale-105" : "cursor-default"
                }`}
                title={usuarioLogado?.cargo === "ADMIN" ? "Clique para abrir o Histórico de Sincronização de Rede" : undefined}
              >
                {sincronizando ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-500/15 text-blue-300 border border-blue-500/30 animate-pulse">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Sincronizando...
                  </span>
                ) : !servidorConectado ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <WifiOff className="h-3 w-3 text-amber-400" />
                    Modo Offline {pendentesSyncCount > 0 ? `(${pendentesSyncCount} pendentes)` : ""}
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    <Wifi className="h-3 w-3 text-emerald-400" />
                    Online (MongoDB/Sync OK)
                  </span>
                )}
              </button>
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
              const pedidosAtivosCount = pedidos.filter(p => p.status !== "FINALIZADO").length;

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
                turnos={turnos}
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
                turnos={turnos}
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
                turnos={turnos}
                onAdicionarUsuario={handleAdicionarUsuario}
                onExcluirUsuario={handleExcluirUsuario}
                onDesbloquearIp={handleDesbloquearIp}
                onSalvarTurnos={handleSalvarTurnos}
                usuarioLogado={usuarioLogado}
              />
            )}
            {abaAtiva === "sync_history" && usuarioLogado?.cargo === "ADMIN" && (
              <HistoricoSincronizacao
                servidorConectado={servidorConectado}
                onDataSynced={carregarDados}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modal Overlay do Histórico de Sincronização (Apenas ADMIN) */}
      <AnimatePresence>
        {modalSyncAberto && usuarioLogado?.cargo === "ADMIN" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
            onClick={() => setModalSyncAberto(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-5xl my-auto"
            >
              <HistoricoSincronizacao
                servidorConectado={servidorConectado}
                onDataSynced={carregarDados}
                onClose={() => setModalSyncAberto(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
