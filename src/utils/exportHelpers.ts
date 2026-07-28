import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle
} from "docx";
import { PedidoCarrinho, OcorrenciaLider, Estatisticas, Turno } from "../types";
import { pertenceAoTurno } from "./turnos";

export function exportarParaExcel(
  pedidos: PedidoCarrinho[],
  ocorrencias: OcorrenciaLider[],
  estatisticas: Estatisticas,
  turnos: Turno[]
) {
  const wb = XLSX.utils.book_new();

  // 1. Aba Resumo por Turno
  const resumoTurnosData = turnos.map(t => {
    const pTurno = pedidos.filter(p => pertenceAoTurno(p.timestamp, t));
    const oTurno = ocorrencias.filter(o => pertenceAoTurno(o.timestamp, t));
    const entregues = pTurno.filter(p => p.status === "FINALIZADO").length;
    const pendentes = pTurno.filter(p => p.status !== "FINALIZADO").length;
    const ativas = oTurno.filter(o => o.status === "ATIVA").length;
    const resolvidas = oTurno.filter(o => o.status === "RESOLVIDA").length;

    return {
      "Turno": t.nome,
      "Horário": `${t.inicio} às ${t.termino}`,
      "Total Solicitações": pTurno.length,
      "Entregues": entregues,
      "Pendentes": pendentes,
      "Ocorrências Paradas": oTurno.length,
      "Paradas Resolvidas": resolvidas,
      "Paradas Ativas": ativas
    };
  });

  const wsResumo = XLSX.utils.json_to_sheet(resumoTurnosData);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo por Turno");

  // 2. Aba de Solicitações de Carrinhos
  const producaoData = pedidos.map(p => {
    const turnoDoPedido = turnos.find(t => pertenceAoTurno(p.timestamp, t))?.nome || "Indefinido";
    return {
      "ID": p.id,
      "Máquina": p.maquina,
      "Solicitação": p.pedido,
      "Data/Hora": p.data,
      "Turno": turnoDoPedido,
      "Status": p.status || "ATIVO"
    };
  });

  const wsProducao = XLSX.utils.json_to_sheet(producaoData);
  XLSX.utils.book_append_sheet(wb, wsProducao, "Solicitações de Carrinhos");

  // 3. Aba de Ocorrências do Líder
  const ocorrenciasData = ocorrencias.map(o => {
    const turnoOcorrencia = turnos.find(t => pertenceAoTurno(o.timestamp, t))?.nome || "Indefinido";
    return {
      "ID": o.id,
      "Máquina": o.maquina,
      "Ocorrência / Motivo": o.motivo,
      "Data/Hora": o.data,
      "Tempo de Resposta": o.tempoResposta || "Ainda Ativa",
      "Turno": turnoOcorrencia,
      "Status": o.status
    };
  });

  const wsOcorrencias = XLSX.utils.json_to_sheet(ocorrenciasData);
  XLSX.utils.book_append_sheet(wb, wsOcorrencias, "Ocorrências do Líder");

  // Exporta o arquivo XLSX
  const dataHoje = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `relatorio_industrial_${dataHoje}.xlsx`);
}

export async function exportarParaWord(
  pedidos: PedidoCarrinho[],
  ocorrencias: OcorrenciaLider[],
  estatisticas: Estatisticas,
  turnos: Turno[]
) {
  const dataHojeStr = new Date().toLocaleString("pt-BR");

  // Tabela 1: Resumo por Turno
  const tableRowsResumo = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Turno", bold: true })] })], width: { size: 25, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Horário", bold: true })] })], width: { size: 20, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Carrinhos (Total)", bold: true })] })], width: { size: 25, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Ocorrências", bold: true })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
      ],
    }),
    ...turnos.map(t => {
      const pTurno = pedidos.filter(p => pertenceAoTurno(p.timestamp, t));
      const oTurno = ocorrencias.filter(o => pertenceAoTurno(o.timestamp, t));
      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(t.nome)] }),
          new TableCell({ children: [new Paragraph(`${t.inicio} - ${t.termino}`)] }),
          new TableCell({ children: [new Paragraph(String(pTurno.length))] }),
          new TableCell({ children: [new Paragraph(String(oTurno.length))] }),
        ]
      });
    })
  ];

  // Tabela 2: Últimas Solicitações de Carrinhos
  const ultimosPedidos = pedidos.slice(0, 25);
  const tableRowsPedidos = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Máquina", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Solicitação", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Turno", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Status", bold: true })] })] }),
      ]
    }),
    ...ultimosPedidos.map(p => {
      const turnoNome = turnos.find(t => pertenceAoTurno(p.timestamp, t))?.nome || "Indefinido";
      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(p.maquina)] }),
          new TableCell({ children: [new Paragraph(p.pedido)] }),
          new TableCell({ children: [new Paragraph(turnoNome)] }),
          new TableCell({ children: [new Paragraph(p.status || "ATIVO")] }),
        ]
      });
    })
  ];

  // Tabela 3: Histórico de Ocorrências do Líder
  const ultimasOcorrencias = ocorrencias.slice(0, 25);
  const tableRowsOcorrencias = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Máquina", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Ocorrência / Motivo", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tempo Resposta", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Turno", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Status", bold: true })] })] }),
      ]
    }),
    ...ultimasOcorrencias.map(o => {
      const turnoNome = turnos.find(t => pertenceAoTurno(o.timestamp, t))?.nome || "Indefinido";
      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(o.maquina)] }),
          new TableCell({ children: [new Paragraph(o.motivo)] }),
          new TableCell({ children: [new Paragraph(o.tempoResposta || "Em andamento")] }),
          new TableCell({ children: [new Paragraph(turnoNome)] }),
          new TableCell({ children: [new Paragraph(o.status)] }),
        ]
      });
    })
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: "RELATÓRIO DE DESEMPENHO OPERACIONAL INDUSTRIAL",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Data de Emissão: ${dataHojeStr}`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),

          new Paragraph({
            text: "1. Consolidação de Produção por Turno",
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            text: "Abaixo é apresentada a distribuição das atividades produtivas e eventos operacionais divididos por turnos de trabalho configurados."
          }),
          new Paragraph({ text: "" }),
          new Table({
            rows: tableRowsResumo,
            width: { size: 100, type: WidthType.PERCENTAGE }
          }),
          new Paragraph({ text: "" }),

          new Paragraph({
            text: "2. Registro de Solicitações de Carrinhos (Logística)",
            heading: HeadingLevel.HEADING_2,
          }),
          new Table({
            rows: tableRowsPedidos,
            width: { size: 100, type: WidthType.PERCENTAGE }
          }),
          new Paragraph({ text: "" }),

          new Paragraph({
            text: "3. Histórico de Chamados e Paradas de Máquina (Líder)",
            heading: HeadingLevel.HEADING_2,
          }),
          new Table({
            rows: tableRowsOcorrencias,
            width: { size: 100, type: WidthType.PERCENTAGE }
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio_industrial_${Date.now()}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
