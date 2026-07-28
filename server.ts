import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

// Inicialização do cliente Gemini com telemetria obrigatória (inicialização tardia)
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("A variável de ambiente GEMINI_API_KEY não foi configurada.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

interface PedidoCarrinho {
  id: number;
  maquina: string;
  pedido: string;
  data: string;
  timestamp: number;
  status?: 'ATIVO' | 'FINALIZADO';
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
  senha?: string;
}

interface Turno {
  id: string;
  nome: string;
  inicio: string;
  termino: string;
}

const DEFAULT_TURNOS: Turno[] = [
  { id: "t1", nome: "1º Turno (Manhã)", inicio: "06:00", termino: "14:00" },
  { id: "t2", nome: "2º Turno (Tarde)", inicio: "14:00", termino: "22:00" },
  { id: "t3", nome: "3º Turno (Noite)", inicio: "22:00", termino: "06:00" },
];

const INITIAL_USUARIOS: Usuario[] = [
  { id: "1", login: "admin", cargo: "ADMIN", senha: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918" }, // admin
  { id: "2", login: "lider1", cargo: "LIDER", senha: "0afc392fd9f3f97a2fce42529878f57fa6ce6396e1f8047d17c3fb995735ca99" }, // lider1
  { id: "3", login: "op1", cargo: "OPERADOR", senha: "7d3c6b8d51ac8ec79a2adbf98045944f934c1279a57f689cd5ce997fc223b48e" }, // op1
  { id: "4", login: "log1", cargo: "LOGISTICA", senha: "c46928bc87de23b9a8bd235aa1fe67ccb1542c8389ad3f02bf4ab5cff506e98f" }, // log1
  { id: "5", login: "bi1", cargo: "RELATORIO", senha: "ee1d1ccf2c45ca261b7e1a0399f6e6390dbc64ddf10b6a2b5db5bc1807b4950d" }, // bi1
];

const HASH_MIGRATIONS: Record<string, string> = {
  "c7ad44cbad762a5da0a452f9e854fdc1e0e69e077478b82415d86054f91a85a8": "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // admin
  "925206263595eb48842bc02a246830dfbc39832bc83c31671239c898b9e698b6": "0afc392fd9f3f97a2fce42529878f57fa6ce6396e1f8047d17c3fb995735ca99", // lider1
  "4b971a8f90eb0ef2389a94154fa7845f94d93b1eb2130bb4d720b66ff6d7730a": "7d3c6b8d51ac8ec79a2adbf98045944f934c1279a57f689cd5ce997fc223b48e", // op1
  "ccb3bfa993e3bdf8cb81a2884efef097eb6e5b4b1a47318db5b244791feeb8b6": "c46928bc87de23b9a8bd235aa1fe67ccb1542c8389ad3f02bf4ab5cff506e98f", // log1
  "951ee11b623fb88e146747535b91b5c479bdfb676f63456cb0607da6e08f51a4": "ee1d1ccf2c45ca261b7e1a0399f6e6390dbc64ddf10b6a2b5db5bc1807b4950d"  // bi1
};

// Mock / Local state fallback if MongoDB is not connected
let localDatabase = {
  pedidos: [] as PedidoCarrinho[],
  ocorrencias: [] as OcorrenciaLider[],
  usuarios: [...INITIAL_USUARIOS] as Usuario[],
  ipsBloqueados: [] as { ip: string; tentativas: number }[],
  turnos: [...DEFAULT_TURNOS] as Turno[]
};

const LOCAL_DB_PATH = path.join(process.cwd(), "db.json");

function loadLocalDb() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const content = fs.readFileSync(LOCAL_DB_PATH, "utf8");
      localDatabase = JSON.parse(content);
      // Ensure initial users are always seeded
      if (!localDatabase.usuarios || localDatabase.usuarios.length === 0) {
        localDatabase.usuarios = [...INITIAL_USUARIOS];
        saveLocalDb();
      } else {
        // Migrate old hashes to new hashes if present
        let migrated = false;
        localDatabase.usuarios = localDatabase.usuarios.map(u => {
          if (u.senha && HASH_MIGRATIONS[u.senha]) {
            migrated = true;
            return { ...u, senha: HASH_MIGRATIONS[u.senha] };
          }
          return u;
        });
        if (migrated) {
          saveLocalDb();
          console.log("[Industrial Server] Senhas do banco local (db.json) migradas para os novos hashes corretos.");
        }
      }
    } else {
      localDatabase.usuarios = [...INITIAL_USUARIOS];
      saveLocalDb();
    }
  } catch (err) {
    console.error("Erro ao ler banco de dados local:", err);
    localDatabase.usuarios = [...INITIAL_USUARIOS];
  }
}

function saveLocalDb() {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDatabase, null, 2), "utf8");
  } catch (err) {
    console.error("Erro ao salvar banco de dados local:", err);
  }
}

// Inicialização do MongoDB de forma segura
let mongoDb: any = null;
let mongoClient: MongoClient | null = null;
let isConnectedToMongo = false;

const MONGODB_URI = process.env.MONGODB_URI;

async function connectToMongo() {
  if (!MONGODB_URI) {
    console.log("[Industrial Server] MONGODB_URI não configurada. Operando com banco de dados local auto-persistido em db.json.");
    loadLocalDb();
    return;
  }
  try {
    console.log("[Industrial Server] Conectando ao MongoDB...");
    mongoClient = new MongoClient(MONGODB_URI, { connectTimeoutMS: 5000, socketTimeoutMS: 5000 });
    await mongoClient.connect();
    mongoDb = mongoClient.db("industrial_db");
    isConnectedToMongo = true;
    console.log("[Industrial Server] Conexão bem-sucedida ao MongoDB!");
    
    // Semeia usuários iniciais se coleção vazia
    const usersColl = mongoDb.collection("usuarios");
    const count = await usersColl.countDocuments();
    if (count === 0) {
      await usersColl.insertMany(INITIAL_USUARIOS);
      console.log("[Industrial Server] Usuários iniciais semeados no MongoDB.");
    } else {
      // Migrate existing old hashes in MongoDB
      const cursor = usersColl.find({ senha: { $in: Object.keys(HASH_MIGRATIONS) } });
      const usersToMigrate = await cursor.toArray();
      if (usersToMigrate.length > 0) {
        for (const u of usersToMigrate) {
          const newSenha = HASH_MIGRATIONS[u.senha];
          await usersColl.updateOne({ id: u.id }, { $set: { senha: newSenha } });
        }
        console.log(`[Industrial Server] ${usersToMigrate.length} senhas migradas para os novos hashes corretos no MongoDB.`);
      }
    }
  } catch (err: any) {
    console.error("[Industrial Server] Falha ao conectar ao MongoDB. Usando fallback local auto-persistido (db.json).", err.message);
    loadLocalDb();
  }
}

// Database helper operations
async function getPedidos(): Promise<PedidoCarrinho[]> {
  if (isConnectedToMongo && mongoDb) {
    try {
      const list = await mongoDb.collection("pedidos").find({}).toArray();
      return list.map((p: any) => {
        const { _id, ...rest } = p;
        return rest as PedidoCarrinho;
      });
    } catch (e) {
      console.error("Erro ao ler pedidos no MongoDB, usando cache local:", e);
    }
  }
  return localDatabase.pedidos;
}

async function addPedido(pedido: PedidoCarrinho): Promise<void> {
  if (isConnectedToMongo && mongoDb) {
    try {
      await mongoDb.collection("pedidos").updateOne(
        { id: pedido.id },
        { $set: pedido },
        { upsert: true }
      );
      return;
    } catch (e) {
      console.error("Erro ao salvar pedido no MongoDB, usando cache local:", e);
    }
  }
  localDatabase.pedidos.push(pedido);
  saveLocalDb();
}

async function deletePedido(id: number | string): Promise<void> {
  const numericId = typeof id === "number" ? id : parseInt(String(id), 10);
  const targetId = isNaN(numericId) ? id : numericId;

  if (isConnectedToMongo && mongoDb) {
    try {
      await mongoDb.collection("pedidos").updateOne(
        { $or: [{ id: targetId }, { id: String(id) }, { id: Number(id) }] },
        { $set: { status: "FINALIZADO" } }
      );
      return;
    } catch (e) {
      console.error("Erro ao finalizar pedido no MongoDB, usando cache local:", e);
    }
  }
  const idx = localDatabase.pedidos.findIndex(p => String(p.id) === String(id) || p.id === targetId);
  if (idx !== -1) {
    localDatabase.pedidos[idx].status = "FINALIZADO";
  }
  saveLocalDb();
}

async function getOcorrencias(): Promise<OcorrenciaLider[]> {
  if (isConnectedToMongo && mongoDb) {
    try {
      const list = await mongoDb.collection("ocorrencias").find({}).toArray();
      return list.map((o: any) => {
        const { _id, ...rest } = o;
        return rest as OcorrenciaLider;
      });
    } catch (e) {
      console.error("Erro ao ler ocorrências no MongoDB, usando cache local:", e);
    }
  }
  return localDatabase.ocorrencias;
}

async function addOcorrencia(ocorrencia: OcorrenciaLider): Promise<void> {
  if (isConnectedToMongo && mongoDb) {
    try {
      await mongoDb.collection("ocorrencias").updateOne(
        { id: ocorrencia.id },
        { $set: ocorrencia },
        { upsert: true }
      );
      return;
    } catch (e) {
      console.error("Erro ao salvar ocorrência no MongoDB, usando cache local:", e);
    }
  }
  localDatabase.ocorrencias.push(ocorrencia);
  saveLocalDb();
}

async function resolverOcorrencia(id: number | string, tempoResposta: string): Promise<void> {
  const numericId = typeof id === "number" ? id : parseInt(String(id), 10);
  const targetId = isNaN(numericId) ? id : numericId;

  if (isConnectedToMongo && mongoDb) {
    try {
      await mongoDb.collection("ocorrencias").updateOne(
        { $or: [{ id: targetId }, { id: String(id) }, { id: Number(id) }] },
        { $set: { status: "RESOLVIDA", tempoResposta } }
      );
      return;
    } catch (e) {
      console.error("Erro ao resolver ocorrência no MongoDB, usando cache local:", e);
    }
  }
  const idx = localDatabase.ocorrencias.findIndex(o => String(o.id) === String(id) || o.id === targetId);
  if (idx !== -1) {
    localDatabase.ocorrencias[idx].status = "RESOLVIDA";
    localDatabase.ocorrencias[idx].tempoResposta = tempoResposta;
    saveLocalDb();
  }
}

async function getUsuarios(): Promise<Usuario[]> {
  if (isConnectedToMongo && mongoDb) {
    try {
      const list = await mongoDb.collection("usuarios").find({}).toArray();
      return list.map((u: any) => {
        const { _id, ...rest } = u;
        return rest as Usuario;
      });
    } catch (e) {
      console.error("Erro ao ler usuários no MongoDB, usando cache local:", e);
    }
  }
  return localDatabase.usuarios;
}

async function addUsuario(usuario: Usuario): Promise<void> {
  if (isConnectedToMongo && mongoDb) {
    try {
      await mongoDb.collection("usuarios").updateOne(
        { id: usuario.id },
        { $set: usuario },
        { upsert: true }
      );
      return;
    } catch (e) {
      console.error("Erro ao salvar usuário no MongoDB, usando cache local:", e);
    }
  }
  localDatabase.usuarios.push(usuario);
  saveLocalDb();
}

async function deleteUsuario(id: string): Promise<void> {
  if (isConnectedToMongo && mongoDb) {
    try {
      await mongoDb.collection("usuarios").deleteOne({ id });
      return;
    } catch (e) {
      console.error("Erro ao deletar usuário no MongoDB, usando cache local:", e);
    }
  }
  localDatabase.usuarios = localDatabase.usuarios.filter(u => u.id !== id);
  saveLocalDb();
}

async function getIpsBloqueados(): Promise<{ ip: string; tentativas: number }[]> {
  if (isConnectedToMongo && mongoDb) {
    try {
      const list = await mongoDb.collection("ipsBloqueados").find({}).toArray();
      return list.map((i: any) => {
        const { _id, ...rest } = i;
        return rest as { ip: string; tentativas: number };
      });
    } catch (e) {
      console.error("Erro ao ler IPs bloqueados no MongoDB, usando cache local:", e);
    }
  }
  return localDatabase.ipsBloqueados;
}

async function deleteIpBloqueado(ip: string): Promise<void> {
  if (isConnectedToMongo && mongoDb) {
    try {
      await mongoDb.collection("ipsBloqueados").deleteOne({ ip });
      return;
    } catch (e) {
      console.error("Erro ao deletar IP bloqueado no MongoDB, usando cache local:", e);
    }
  }
  localDatabase.ipsBloqueados = localDatabase.ipsBloqueados.filter(i => i.ip !== ip);
  saveLocalDb();
}

async function setIpBloqueado(ip: string, tentativas: number): Promise<void> {
  if (isConnectedToMongo && mongoDb) {
    try {
      await mongoDb.collection("ipsBloqueados").updateOne(
        { ip },
        { $set: { ip, tentativas } },
        { upsert: true }
      );
      return;
    } catch (e) {
      console.error("Erro ao salvar IP bloqueado no MongoDB, usando cache local:", e);
    }
  }
  const idx = localDatabase.ipsBloqueados.findIndex(i => i.ip === ip);
  if (idx !== -1) {
    localDatabase.ipsBloqueados[idx].tentativas = tentativas;
  } else {
    localDatabase.ipsBloqueados.push({ ip, tentativas });
  }
  saveLocalDb();
}

async function resetPedidos(): Promise<void> {
  if (isConnectedToMongo && mongoDb) {
    try {
      await mongoDb.collection("pedidos").deleteMany({ status: "FINALIZADO" });
      return;
    } catch (e) {
      console.error("Erro ao resetar pedidos no MongoDB, usando cache local:", e);
    }
  }
  localDatabase.pedidos = localDatabase.pedidos.filter(p => p.status !== "FINALIZADO");
  saveLocalDb();
}

async function resetOcorrenciasResolvidas(): Promise<void> {
  if (isConnectedToMongo && mongoDb) {
    try {
      await mongoDb.collection("ocorrencias").deleteMany({ status: "RESOLVIDA" });
      return;
    } catch (e) {
      console.error("Erro ao deletar ocorrências resolvidas no MongoDB, usando cache local:", e);
    }
  }
  localDatabase.ocorrencias = localDatabase.ocorrencias.filter(o => o.status !== "RESOLVIDA");
  saveLocalDb();
}

async function getTurnos(): Promise<Turno[]> {
  if (isConnectedToMongo && mongoDb) {
    try {
      const list = await mongoDb.collection("turnos").find({}).toArray();
      if (list.length > 0) {
        return list.map((t: any) => {
          const { _id, ...rest } = t;
          return rest as Turno;
        });
      }
    } catch (e) {
      console.error("Erro ao ler turnos no MongoDB, usando cache local:", e);
    }
  }
  return localDatabase.turnos || DEFAULT_TURNOS;
}

async function saveTurnos(turnosList: Turno[]): Promise<void> {
  if (isConnectedToMongo && mongoDb) {
    try {
      await mongoDb.collection("turnos").deleteMany({});
      if (turnosList.length > 0) {
        await mongoDb.collection("turnos").insertMany(turnosList);
      }
      return;
    } catch (e) {
      console.error("Erro ao salvar turnos no MongoDB, usando cache local:", e);
    }
  }
  localDatabase.turnos = turnosList;
  saveLocalDb();
}

async function startServer() {
  // Inicializa o banco de dados local imediatamente para garantir disponibilidade imediata das APIs
  loadLocalDb();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Middleware CORS para liberar acessos de dispositivos móveis e IPs na rede local
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Expires");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // APIs do Sistema de Gestão

  // --- PEDIDOS DE CARRINHOS ---
  app.get("/api/pedidos", async (req, res) => {
    try {
      const list = await getPedidos();
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
      timestamp: Date.now(),
      status: "ATIVO"
    };

    try {
      await addPedido(novo);
      res.status(201).json(novo);
    } catch (err: any) {
      console.error("Erro no POST /api/pedidos:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/pedidos/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await deletePedido(Number(id));
      res.json({ success: true, id });
    } catch (err: any) {
      console.error("Erro no DELETE /api/pedidos:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- OCORRÊNCIAS DO LÍDER / EMERGÊNCIAS ---
  app.get("/api/ocorrencias", async (req, res) => {
    try {
      const list = await getOcorrencias();
      list.sort((a, b) => b.timestamp - a.timestamp);
      res.json(list);
    } catch (err: any) {
      console.error("Erro no GET /api/ocorrencias:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ocorrencias", async (req, res) => {
    const { maquina, motivo, data, status, tempoResposta } = req.body;
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
      status: status || "ATIVA",
      tempoResposta: tempoResposta || undefined
    };

    try {
      await addOcorrencia(nova);
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
      await resolverOcorrencia(Number(id), tempoResposta || "01m 20s");
      res.json({ success: true, id });
    } catch (err: any) {
      console.error("Erro no POST /api/ocorrencias/:id/resolver:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- IMPORTAÇÃO EM LOTE DO RELATÓRIO (MÉTODOS PERSISTENTES) ---
  app.post("/api/pedidos/importar-lote", async (req, res) => {
    const { porMaquina } = req.body;
    if (!porMaquina) {
      return res.status(400).json({ error: "Dados por máquina não informados." });
    }

    try {
      const pedidosAtuais = await getPedidos();
      const novosPedidos: PedidoCarrinho[] = [];

      for (const [maquina, qtdDesejada] of Object.entries(porMaquina)) {
        if (typeof qtdDesejada !== "number" || qtdDesejada <= 0) continue;

        const qtdAtual = pedidosAtuais.filter(p => p.maquina === maquina && p.status === "FINALIZADO").length;
        const diferenca = qtdDesejada - qtdAtual;

        if (diferenca > 0) {
          for (let i = 0; i < diferenca; i++) {
            novosPedidos.push({
              id: Date.now() + Math.floor(Math.random() * 1000000) + i,
              maquina,
              pedido: "Abastecimento Histórico (Importado)",
              data: new Date().toLocaleString("pt-BR"),
              timestamp: Date.now() - (i * 1000), // pequenos intervalos
              status: "FINALIZADO"
            });
          }
        }
      }

      if (novosPedidos.length > 0) {
        if (isConnectedToMongo && mongoDb) {
          await mongoDb.collection("pedidos").insertMany(novosPedidos);
        } else {
          localDatabase.pedidos.push(...novosPedidos);
          saveLocalDb();
        }
      }

      res.json({ success: true, adicionados: novosPedidos.length });
    } catch (err: any) {
      console.error("Erro ao importar lote de pedidos:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ocorrencias/importar-lote", async (req, res) => {
    const { chamadosLider } = req.body;
    if (!chamadosLider || !Array.isArray(chamadosLider)) {
      return res.status(400).json({ error: "Chamados do líder inválidos." });
    }

    try {
      const novasOcorrencias: OcorrenciaLider[] = chamadosLider.map((o, idx) => ({
        id: o.id || (Date.now() + Math.floor(Math.random() * 1000000) + idx),
        maquina: o.maquina,
        motivo: o.motivo,
        data: o.data || new Date().toLocaleTimeString("pt-BR"),
        timestamp: o.timestamp || Date.now(),
        tempoResposta: o.tempoResposta || "01m 20s",
        status: o.status || "RESOLVIDA"
      }));

      if (novasOcorrencias.length > 0) {
        if (isConnectedToMongo && mongoDb) {
          await mongoDb.collection("ocorrencias").insertMany(novasOcorrencias);
        } else {
          localDatabase.ocorrencias.push(...novasOcorrencias);
          saveLocalDb();
        }
      }

      res.json({ success: true, adicionados: novasOcorrencias.length });
    } catch (err: any) {
      console.error("Erro ao importar lote de ocorrências:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- USUÁRIOS E CONTROLE ---
  app.get("/api/usuarios", async (req, res) => {
    try {
      const list = await getUsuarios();
      res.json(list);
    } catch (err: any) {
      console.error("Erro no GET /api/usuarios:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/usuarios", async (req, res) => {
    const { login, cargo, senha } = req.body;
    if (!login || !cargo) {
      return res.status(400).json({ error: "Login e cargo são obrigatórios" });
    }

    try {
      const list = await getUsuarios();
      if (list.some(u => u.login.toLowerCase() === login.toLowerCase())) {
        return res.status(400).json({ error: "Usuário com este login já existe" });
      }

      const id = String(Date.now());
      const novo: Usuario = {
        id,
        login,
        cargo,
        senha: senha || login
      };

      await addUsuario(novo);
      res.status(201).json(novo);
    } catch (err: any) {
      console.error("Erro no POST /api/usuarios:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/usuarios/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await deleteUsuario(id);
      res.json({ success: true, id });
    } catch (err: any) {
      console.error("Erro no DELETE /api/usuarios:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- CONTROLE DE SEGURANÇA / IPS BLOQUEADOS ---
  app.get("/api/ips-bloqueados", async (req, res) => {
    try {
      const list = await getIpsBloqueados();
      res.json(list);
    } catch (err: any) {
      console.error("Erro no GET /api/ips-bloqueados:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ips-bloqueados", async (req, res) => {
    const { ip, tentativas } = req.body;
    if (!ip) return res.status(400).json({ error: "IP é obrigatório" });
    try {
      await setIpBloqueado(ip, tentativas || 1);
      res.status(201).json({ success: true, ip });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/ips-bloqueados/:ip", async (req, res) => {
    const { ip } = req.params;
    try {
      await deleteIpBloqueado(ip);
      res.json({ success: true, ip });
    } catch (err: any) {
      console.error("Erro no DELETE /api/ips-bloqueados:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- ZERAR / RESET DE DADOS ---
  app.post("/api/ocorrencias/limpar-resolvidas", async (req, res) => {
    try {
      await resetOcorrenciasResolvidas();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Erro no POST /api/ocorrencias/limpar-resolvidas:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/reset", async (req, res) => {
    try {
      await resetPedidos();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Erro no POST /api/reset:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- ESTATÍSTICAS ---
  app.get("/api/estatisticas", async (req, res) => {
    try {
      const listPedidos = await getPedidos();
      const listOcorrencias = await getOcorrencias();

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

  // --- CONFIGURAÇÃO DE TURNOS ---
  app.get("/api/turnos", async (req, res) => {
    try {
      const list = await getTurnos();
      res.json(list);
    } catch (err: any) {
      console.error("Erro no GET /api/turnos:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/turnos", async (req, res) => {
    const { turnos } = req.body;
    if (!Array.isArray(turnos)) {
      return res.status(400).json({ error: "Lista de turnos inválida." });
    }
    try {
      await saveTurnos(turnos);
      res.json({ success: true, turnos });
    } catch (err: any) {
      console.error("Erro no POST /api/turnos:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Setup do Vite / Static Files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
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
    
    // Conecta ao MongoDB em segundo plano para não atrasar a inicialização do applet
    connectToMongo().catch(err => {
      console.error("[Industrial Server] Falha ao tentar conectar ao MongoDB em segundo plano:", err);
    });
  });
}

startServer();
