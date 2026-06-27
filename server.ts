/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

dotenv.config();

// Inicialização do cliente Gemini com telemetria obrigatória
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

interface PedidoCarrinho {
  id: number;
  maquina: string;
  pedido: string;
  data: string;
  timestamp: number;
}

interface OcorrenciaLider {
  id: number;
  maquina: string;
  motivo: string;
  data: string;
  timestamp: number;
  tempoResposta?: string;
  status: 'ATIVA' | 'RESOLVIDA';
}

interface Usuario {
  id: string;
  login: string;
  cargo: 'OPERADOR' | 'LIDER' | 'LOGISTICA' | 'RELATORIO' | 'ADMIN';
}

// Inicializa o Firebase no servidor de forma segura usando fs para carregar a configuração
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(firebaseApp);

// Realiza a tentativa de autenticação anônima de forma opcional (não bloqueante)
signInAnonymously(auth)
  .then(() => {
    console.log("[Industrial Server] Autenticação anônima estabelecida no Firebase!");
  })
  .catch((err) => {
    console.log("[Industrial Server] Nota: Autenticação anônima indisponível no ambiente de testes. Operando com regras de acesso direto públicas seguras.", err.message);
  });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // APIs do Sistema de Gestão

  // --- PEDIDOS DE CARRINHOS ---
  app.get("/api/pedidos", async (req, res) => {
    try {
      const snap = await getDocs(collection(db, "pedidos"));
      const list = snap.docs.map(d => d.data() as PedidoCarrinho);
      list.sort((a, b) => a.timestamp - b.timestamp);
      res.json(list);
    } catch (err: any) {
      console.error("Erro no GET /api/pedidos:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/pedidos", async (req, res) => {
    const { maquina, pedido } = req.body;
    if (!maquina || !pedido) {
      return res.status(400).json({ error: "Máquina e pedido são obrigatórios" });
    }

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
      res.status(201).json(novo);
    } catch (err: any) {
      console.error("Erro no POST /api/pedidos:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/pedidos/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await deleteDoc(doc(db, "pedidos", id));
      res.json({ success: true, id });
    } catch (err: any) {
      console.error("Erro no DELETE /api/pedidos:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- OCORRÊNCIAS DO LÍDER / EMERGÊNCIAS ---
  app.get("/api/ocorrencias", async (req, res) => {
    try {
      const snap = await getDocs(collection(db, "ocorrencias"));
      const list = snap.docs.map(d => d.data() as OcorrenciaLider);
      list.sort((a, b) => b.timestamp - a.timestamp);
      res.json(list);
    } catch (err: any) {
      console.error("Erro no GET /api/ocorrencias:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ocorrencias", async (req, res) => {
    const { maquina, motivo, data } = req.body;
    if (!maquina || !motivo) {
      return res.status(400).json({ error: "Máquina e motivo são obrigatórios" });
    }

    const id = Date.now();
    const nova: OcorrenciaLider = {
      id,
      maquina,
      motivo,
      data: data || new Date().toLocaleTimeString("pt-BR"),
      timestamp: Date.now(),
      status: "ATIVA"
    };

    try {
      await setDoc(doc(db, "ocorrencias", String(id)), nova);
      res.status(201).json(nova);
    } catch (err: any) {
      console.error("Erro no POST /api/ocorrencias:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ocorrencias/:id/resolver", async (req, res) => {
    const { id } = req.params;
    const { tempoResposta } = req.body;
    
    try {
      await setDoc(doc(db, "ocorrencias", id), {
        status: "RESOLVIDA",
        tempoResposta: tempoResposta || "01m 20s"
      }, { merge: true });
      res.json({ success: true, id });
    } catch (err: any) {
      console.error("Erro no POST /api/ocorrencias/:id/resolver:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- USUÁRIOS E CONTROLE ---
  app.get("/api/usuarios", async (req, res) => {
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      const list = snap.docs.map(d => d.data() as Usuario);
      res.json(list);
    } catch (err: any) {
      console.error("Erro no GET /api/usuarios:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/usuarios", async (req, res) => {
    const { login, cargo } = req.body;
    if (!login || !cargo) {
      return res.status(400).json({ error: "Login e cargo são obrigatórios" });
    }

    try {
      const snap = await getDocs(collection(db, "usuarios"));
      const list = snap.docs.map(d => d.data() as Usuario);
      if (list.some(u => u.login.toLowerCase() === login.toLowerCase())) {
        return res.status(400).json({ error: "Usuário com este login já existe" });
      }

      const id = String(Date.now());
      const novo: Usuario = {
        id,
        login,
        cargo
      };

      await setDoc(doc(db, "usuarios", id), novo);
      res.status(201).json(novo);
    } catch (err: any) {
      console.error("Erro no POST /api/usuarios:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/usuarios/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await deleteDoc(doc(db, "usuarios", id));
      res.json({ success: true, id });
    } catch (err: any) {
      console.error("Erro no DELETE /api/usuarios:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- CONTROLE DE SEGURANÇA / IPS BLOQUEADOS ---
  app.get("/api/ips-bloqueados", async (req, res) => {
    try {
      const snap = await getDocs(collection(db, "ipsBloqueados"));
      const list = snap.docs.map(d => d.data());
      res.json(list);
    } catch (err: any) {
      console.error("Erro no GET /api/ips-bloqueados:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/ips-bloqueados/:ip", async (req, res) => {
    const { ip } = req.params;
    try {
      await deleteDoc(doc(db, "ipsBloqueados", ip));
      res.json({ success: true, ip });
    } catch (err: any) {
      console.error("Erro no DELETE /api/ips-bloqueados:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- ZERAR / RESET DE DADOS ---
  app.post("/api/ocorrencias/limpar-resolvidas", async (req, res) => {
    try {
      const snap = await getDocs(collection(db, "ocorrencias"));
      const batch = writeBatch(db);
      snap.forEach(docSnap => {
        if (docSnap.data().status === "RESOLVIDA") {
          batch.delete(docSnap.ref);
        }
      });
      await batch.commit();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Erro no POST /api/ocorrencias/limpar-resolvidas:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/reset", async (req, res) => {
    try {
      const pedidosSnapshot = await getDocs(collection(db, "pedidos"));
      const ocorrenciasSnapshot = await getDocs(collection(db, "ocorrencias"));
      const batch = writeBatch(db);
      pedidosSnapshot.forEach(docSnap => batch.delete(docSnap.ref));
      ocorrenciasSnapshot.forEach(docSnap => batch.delete(docSnap.ref));
      await batch.commit();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Erro no POST /api/reset:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- ESTATÍSTICAS ---
  app.get("/api/estatisticas", async (req, res) => {
    try {
      const pedidosSnap = await getDocs(collection(db, "pedidos"));
      const ocorrenciasSnap = await getDocs(collection(db, "ocorrencias"));

      const listPedidos = pedidosSnap.docs.map(d => d.data() as PedidoCarrinho);
      const listOcorrencias = ocorrenciasSnap.docs.map(d => d.data() as OcorrenciaLider);

      const porMaquina: Record<string, number> = {};
      listPedidos.forEach(p => {
        porMaquina[p.maquina] = (porMaquina[p.maquina] || 0) + 1;
      });

      const problemasPorMaquina: Record<string, number> = {};
      listOcorrencias.forEach(o => {
        problemasPorMaquina[o.maquina] = (problemasPorMaquina[o.maquina] || 0) + 1;
      });

      res.json({
        total: listPedidos.length,
        porMaquina,
        totalProblemas: listOcorrencias.length,
        problemasPorMaquina
      });
    } catch (err: any) {
      console.error("Erro no GET /api/estatisticas:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- INTEGRAÇÃO COM GEMINI API PARA ANÁLISE DE DADOS INTELIGENTE ---
  app.post("/api/analise-ia", async (req, res) => {
    try {
      const pedidosSnap = await getDocs(collection(db, "pedidos"));
      const ocorrenciasSnap = await getDocs(collection(db, "ocorrencias"));

      const listPedidos = pedidosSnap.docs.map(d => d.data() as PedidoCarrinho);
      const listOcorrencias = ocorrenciasSnap.docs.map(d => d.data() as OcorrenciaLider);

      const resumoPedidos = listPedidos.map(p => ({
        maquina: p.maquina,
        pedido: p.pedido,
        data: p.data
      }));

      const resumoOcorrencias = listOcorrencias.map(o => ({
        maquina: o.maquina,
        motivo: o.motivo,
        status: o.status,
        tempoResposta: o.tempoResposta || "Ainda ativa"
      }));

      const prompt = `Como um engenheiro de dados industrial especializado em Lean Manufacturing e Seis Sigma, analise o seguinte histórico de produção da nossa fábrica de injetoras plásticas.

DADOS DE SOLICITAÇÃO DE CARRINHOS (LOGÍSTICA):
${JSON.stringify(resumoPedidos.slice(-15), null, 2)}

DADOS DE OCORRÊNCIAS DE PARADAS DE MÁQUINA (LÍDER):
${JSON.stringify(resumoOcorrencias.slice(-15), null, 2)}

Escreva um relatório estruturado e perspicaz (em português do Brasil) cobrindo:
1. **Principais Gargalos de Logística**: Quais máquinas estão solicitando mais carrinhos e qual o provável impacto no fluxo de materiais.
2. **Análise Crítica de Falhas de Equipamentos**: Quais falhas de máquina ("Peça Esfarelando no Bico", "Peça Enroscada no Molde", etc.) são mais recorrentes, indicando o que as causas-raiz físicas mais prováveis seriam (por exemplo, problemas de temperatura no bico de injeção, falha de lubrificação ou desgaste de molde).
3. **Métricas de Resposta**: Avalie a eficiência da liderança e manutenção com base nos tempos de resposta reais registrados.
4. **Plano de Ação Sugerido (Rápido)**: 3 ações imediatas de manutenção preventiva ou ajustes operacionais para as injetoras mais problemáticas (como a K1014-1).

Mantenha o tom profissional, direto e acionável. Utilize formatação Markdown limpa e amigável para exibição em dashboard.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "Você é um consultor sênior de manufatura enxuta (Lean Manufacturing) e análise de BI para gerenciamento industrial."
        }
      });

      const respostaTexto = response.text || "Não foi possível gerar a análise inteligente de IA no momento.";
      res.json({ analise: respostaTexto });
    } catch (error: any) {
      console.error("Erro ao chamar o Gemini API:", error);
      res.status(500).json({ 
        error: "Erro ao processar análise inteligente", 
        details: error?.message || "Erro desconhecido" 
      });
    }
  });

  // Setup do Vite / Static Files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Industrial Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
