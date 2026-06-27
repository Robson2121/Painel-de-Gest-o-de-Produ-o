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
import { auth, db, handleFirestoreError, OperationType, hashPassword } from "./firebase";
import { signInAnonymously } from "firebase/auth";
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, getDocs, query, limit } from "firebase/firestore";

// Importação das Visões Modulares
import LoginView from "./components/LoginView";
import DashboardView from "./components/DashboardView";
import OperadorView from "./components/OperadorView";
import LogisticaView from "./components/LogisticaView";
import LiderView from "./components/LiderView";
import RelatoriosView from "./components/RelatoriosView";
import AdminView from "./components/AdminView";

export default function App() {
  const [usuarioLogado, setUsuarioLogado] = useState<Usuario | null>(null);
  const [temaEscuro, setTemaEscuro] = useState(true);

  // Estados compartilhados de dados vindos do Express
  const [pedidos, setPedidos] = useState<PedidoCarrinho[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaLider[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [ipsBloqueados, setIpsBloqueados] = useState<{ ip: string; tentativas: number }[]>([]);
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    total: 0,
    porMaquina: {},
    totalProblemas: 0,
    problemasPorMaquina: {}
  });

  // Aba ativa atual
  const [abaAtiva, setAbaAtiva] = useState<string>("dashboard");

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

  // Autenticação anônima opcional no Firebase na inicialização
  useEffect(() => {
    const inicializarFirebase = async () => {
      try {
        await signInAnonymously(auth);
        console.log("Autenticado anonimamente no Firebase!");
      } catch (err: any) {
        console.log("Nota: Autenticação anônima indisponível no ambiente de testes. Operando com regras de acesso direto públicas seguras.", err.message);
      }
    };
    inicializarFirebase();
  }, []);

  useEffect(() => {
    // 1. Ouvinte para Pedidos
    const unsubPedidos = onSnapshot(
      collection(db, "pedidos"),
      (snapshot) => {
        const list: PedidoCarrinho[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as PedidoCarrinho);
        });
        list.sort((a, b) => a.timestamp - b.timestamp);
        setPedidos(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "pedidos");
      }
    );

    // 2. Ouvinte para Ocorrências
    const unsubOcorrencias = onSnapshot(
      collection(db, "ocorrencias"),
      (snapshot) => {
        const list: OcorrenciaLider[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as OcorrenciaLider);
        });
        list.sort((a, b) => b.timestamp - a.timestamp);
        setOcorrencias(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "ocorrencias");
      }
    );

    // 3. Ouvinte para Usuários com Seed Inicial automático se vazio
    const unsubUsuarios = onSnapshot(
      collection(db, "usuarios"),
      async (snapshot) => {
        if (snapshot.empty) {
          const INITIAL_USUARIOS: Usuario[] = [
            { id: "1", login: "admin", cargo: "ADMIN", senha: await hashPassword("admin") },
            { id: "2", login: "lider1", cargo: "LIDER", senha: await hashPassword("lider1") },
            { id: "3", login: "op1", cargo: "OPERADOR", senha: await hashPassword("op1") },
            { id: "4", login: "log1", cargo: "LOGISTICA", senha: await hashPassword("log1") },
            { id: "5", login: "bi1", cargo: "RELATORIO", senha: await hashPassword("bi1") },
          ];
          for (const u of INITIAL_USUARIOS) {
            try {
              await setDoc(doc(db, "usuarios", u.id), u);
            } catch (err) {
              console.error("Erro ao semear usuário inicial:", err);
            }
          }
          setUsuarios(INITIAL_USUARIOS);
        } else {
          const list: Usuario[] = [];
          snapshot.forEach((d) => {
            list.push(d.data() as Usuario);
          });
          setUsuarios(list);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "usuarios");
      }
    );

    // 4. Ouvinte para IPs Bloqueados
    const unsubIps = onSnapshot(
      collection(db, "ipsBloqueados"),
      (snapshot) => {
        const list: { ip: string; tentativas: number }[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as { ip: string; tentativas: number });
        });
        setIpsBloqueados(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "ipsBloqueados");
      }
    );

    return () => {
      unsubPedidos();
      unsubOcorrencias();
      unsubUsuarios();
      unsubIps();
    };
  }, []);

  // Recalcula Estatísticas Dinamicamente no Cliente baseado nas coleções do Firestore
  useEffect(() => {
    const porMaquina: Record<string, number> = {};
    pedidos.forEach(p => {
      porMaquina[p.maquina] = (porMaquina[p.maquina] || 0) + 1;
    });

    const problemasPorMaquina: Record<string, number> = {};
    ocorrencias.forEach(o => {
      problemasPorMaquina[o.maquina] = (problemasPorMaquina[o.maquina] || 0) + 1;
    });

    setEstatisticas({
      total: pedidos.length,
      porMaquina,
      totalProblemas: ocorrencias.length,
      problemasPorMaquina
    });
  }, [pedidos, ocorrencias]);

  // Handlers para as Visões

  // 1. Cadastrar pedido de carrinho no Firestore
  const handleAdicionarPedido = async (maquina: string, pedido: string) => {
    const id = Date.now();
    const novo: PedidoCarrinho = {
      id,
      maquina,
      pedido,
      data: new Date().toLocaleString("pt-BR"),
      timestamp: Date.now()
    };
    try {
      await setDoc(doc(db, "pedidos", String(id)), novo);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `pedidos/${id}`);
    }
  };

  // 2. Finalizar pedido de carrinho no Firestore
  const handleFinalizarPedido = async (id: number) => {
    try {
      await deleteDoc(doc(db, "pedidos", String(id)));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `pedidos/${id}`);
    }
  };

  // 3. Cadastrar ocorrência de máquina parada no Firestore
  const handleAdicionarOcorrencia = async (maquina: string, motivo: string) => {
    const id = Date.now();
    const nova: OcorrenciaLider = {
      id,
      maquina,
      motivo,
      data: new Date().toLocaleTimeString("pt-BR"),
      timestamp: Date.now(),
      status: "ATIVA"
    };
    try {
      await setDoc(doc(db, "ocorrencias", String(id)), nova);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `ocorrencias/${id}`);
    }
  };

  // 4. Resolver ocorrência com tempo de resposta no Firestore
  const handleResolverOcorrencia = async (id: number, tempoResposta: string) => {
    try {
      await setDoc(doc(db, "ocorrencias", String(id)), {
        status: "RESOLVIDA",
        tempoResposta
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `ocorrencias/${id}`);
    }
  };

  // 5. Cadastrar novo usuário (Admin) no Firestore com senha criptografada
  const handleAdicionarUsuario = async (login: string, cargo: Usuario["cargo"], senha?: string) => {
    if (usuarios.some(u => u.login.toLowerCase() === login.toLowerCase())) {
      throw new Error("Usuário com este login já existe");
    }
    const id = String(Date.now());
    
    // Criptografa/hash a senha usando SHA-256. Se não enviada, assume o login como senha inicial.
    const senhaFinal = senha?.trim() || login;
    const senhaCriptografada = await hashPassword(senhaFinal);

    const novo: Usuario = { 
      id, 
      login, 
      cargo, 
      senha: senhaCriptografada 
    };
    
    try {
      await setDoc(doc(db, "usuarios", id), novo);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `usuarios/${id}`);
    }
  };

  // 6. Remover usuário (Admin) do Firestore
  const handleExcluirUsuario = async (id: string) => {
    try {
      await deleteDoc(doc(db, "usuarios", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `usuarios/${id}`);
    }
  };

  // 7. Desbloquear IP bloqueado por força bruta no Firestore
  const handleDesbloquearIp = async (ip: string) => {
    try {
      await deleteDoc(doc(db, "ipsBloqueados", ip));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `ipsBloqueados/${ip}`);
    }
  };

  // 8. Zerar apenas o fluxo de carrinhos ativos no Firestore
  const handleZerarRelatorio = async () => {
    try {
      const pedidosSnapshot = await getDocs(collection(db, "pedidos"));
      const batch = writeBatch(db);
      pedidosSnapshot.forEach(docSnap => batch.delete(docSnap.ref));
      await batch.commit();
      alert("✅ Fluxo de carrinhos ativos zerado com sucesso!");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "reset_collections");
    }
  };

  // 9. Limpar histórico de chamados resolvidos do Líder no Firestore
  const handleLimparHistoricoLider = async () => {
    try {
      const ocorrenciasSnapshot = await getDocs(collection(db, "ocorrencias"));
      const batch = writeBatch(db);
      let count = 0;
      ocorrenciasSnapshot.forEach(docSnap => {
        if (docSnap.data().status === "RESOLVIDA") {
          batch.delete(docSnap.ref);
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
      alert("✅ Histórico de chamados resolvidos limpo com sucesso!");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "clear_resolved_ocorrencias");
    }
  };

  // 10. Forçar sincronização imediata com os pedidos no painel da logística e ocorrências do Líder
  const handleSincronizar = async () => {
    try {
      const pedidosSnapshot = await getDocs(collection(db, "pedidos"));
      const listPedidos: PedidoCarrinho[] = [];
      pedidosSnapshot.forEach((d) => {
        listPedidos.push(d.data() as PedidoCarrinho);
      });
      listPedidos.sort((a, b) => a.timestamp - b.timestamp);
      setPedidos(listPedidos);

      const ocorrenciasSnapshot = await getDocs(collection(db, "ocorrencias"));
      const listOcorrencias: OcorrenciaLider[] = [];
      ocorrenciasSnapshot.forEach((d) => {
        listOcorrencias.push(d.data() as OcorrenciaLider);
      });
      listOcorrencias.sort((a, b) => b.timestamp - a.timestamp);
      setOcorrencias(listOcorrencias);

      alert("✅ Sincronização realizada! Dados atualizados com os pedidos da Logística.");
    } catch (err) {
      console.error("Erro ao sincronizar:", err);
      alert("❌ Erro ao sincronizar com os dados da Logística.");
    }
  };

  // 11. Importar dados de arquivo CSV externo
  const handleImportarCSV = async (dadosImportados: { porMaquina: Record<string, number>; chamadosLider: any[] }) => {
    setEstatisticas(prev => ({
      ...prev,
      porMaquina: dadosImportados.porMaquina
    }));
    
    // Envia novos chamados do CSV para o Firestore
    for (const ocorrencia of dadosImportados.chamadosLider) {
      const id = ocorrencia.id || Date.now();
      try {
        await setDoc(doc(db, "ocorrencias", String(id)), {
          ...ocorrencia,
          id
        });
      } catch (err) {
        console.error("Erro ao importar ocorrência do CSV:", err);
      }
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
