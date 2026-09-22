// Backend .docx SIMPLES: uma única fonte, uma única cor (preto/automático), sem tabelas,
// sem caixas coloridas. O único elemento que varia é o tamanho da fonte dos títulos.
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Footer, PageNumber, PageBreak,
  AlignmentType, LevelFormat,
} = require("docx");

const FONTE = "Arial";      // fonte única para todo o documento
const TAM_CORPO = 20;       // 10pt — texto normal, listas e código
const TAM_H3 = 22;          // 11pt
const TAM_H2 = 24;          // 12pt
const TAM_H1 = 26;          // 13pt
const TAM_CAPA_TITULO = 32; // 16pt
const TAM_CAPA_SUB = 22;    // 11pt
const TAM_RODAPE = 16;      // 8pt

let contadorListas = 0;
const listasNumeradas = [];

/** Converte **negrito** e `código` em TextRuns, sempre na mesma fonte e sem cor (preto). */
function runs(texto, tamanho = TAM_CORPO) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let ultimo = 0, m;
  while ((m = re.exec(texto)) !== null) {
    if (m.index > ultimo) out.push(new TextRun({ text: texto.slice(ultimo, m.index), font: FONTE, size: tamanho }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, font: FONTE, size: tamanho }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, font: FONTE, size: tamanho }));
    ultimo = m.index + t.length;
  }
  if (ultimo < texto.length) out.push(new TextRun({ text: texto.slice(ultimo), font: FONTE, size: tamanho }));
  return out;
}

const h1 = (t) => new Paragraph({
  spacing: { before: 320, after: 140 }, keepNext: true,
  children: [new TextRun({ text: t, font: FONTE, size: TAM_H1, bold: true })],
});
const h2 = (t) => new Paragraph({
  spacing: { before: 240, after: 120 }, keepNext: true,
  children: [new TextRun({ text: t, font: FONTE, size: TAM_H2, bold: true })],
});
const h3 = (t) => new Paragraph({
  spacing: { before: 200, after: 100 }, keepNext: true,
  children: [new TextRun({ text: t, font: FONTE, size: TAM_H3, bold: true })],
});
const p = (t) => new Paragraph({ children: runs(t), spacing: { after: 140, line: 300 } });
const esp = () => new Paragraph({ children: [], spacing: { after: 100 } });
const quebra = () => new Paragraph({ children: [new PageBreak()] });

const bullets = (itens) => itens.map((t) => new Paragraph({
  numbering: { reference: "bullets", level: 0 }, children: runs(t), spacing: { after: 80, line: 300 },
}));

function numerada(itens) {
  const ref = "num" + (++contadorListas);
  listasNumeradas.push(ref);
  return itens.map((t) => new Paragraph({
    numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 80, line: 300 },
  }));
}

/** Bloco de código / saída de terminal: texto simples, recuado, na mesma fonte, um pouco menor. */
function codigo(texto) {
  const linhas = texto.replace(/\r/g, "").replace(/\n$/, "").split("\n");
  return linhas.map((l, i) => new Paragraph({
    indent: { left: 400 },
    spacing: { after: i === linhas.length - 1 ? 140 : 0, line: 260 },
    children: [new TextRun({ text: l === "" ? " " : l, font: FONTE, size: TAM_CORPO - 2 })],
  }));
}

const ler = (rel) => fs.readFileSync(require("path").join(__dirname, "..", "..", rel), "utf8");

/** Gera o arquivo .docx */
async function salvar(caminho, titulo, subtitulo, filhos) {
  const capa = [
    new Paragraph({ spacing: { before: 2000, after: 200 }, children: [new TextRun({ text: "Distribuição e Concorrência — 2026/1", font: FONTE, size: TAM_CAPA_SUB })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: titulo, font: FONTE, size: TAM_CAPA_TITULO, bold: true })] }),
    new Paragraph({ spacing: { after: 500 }, children: [new TextRun({ text: subtitulo, font: FONTE, size: TAM_CAPA_SUB })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Trabalho 1 — Balanceamento de Carga, Elasticidade e Failover com Kafka em Clusters Docker", font: FONTE, size: TAM_CORPO })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Mini-mundo: Sistema de Monitoramento de Sensores em uma Fábrica Inteligente", font: FONTE, size: TAM_CORPO })] }),
    new Paragraph({ spacing: { before: 500, after: 80 }, children: [new TextRun({ text: "Integrantes: [preencher nomes e matrículas]", font: FONTE, size: TAM_CORPO })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Data: [preencher]", font: FONTE, size: TAM_CORPO })] }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
  const doc = new Document({
    creator: "SmartFactory Lab", title: titulo,
    styles: { default: { document: { run: { font: FONTE, size: TAM_CORPO } } } },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "-", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 230 } } }, run: { font: FONTE, size: TAM_CORPO } } ] },
        ...listasNumeradas.map((ref) => ({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } }, run: { font: FONTE, size: TAM_CORPO } }] })),
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: titulo + " — página ", font: FONTE, size: TAM_RODAPE }), new TextRun({ children: [PageNumber.CURRENT], font: FONTE, size: TAM_RODAPE })] })] }) },
      children: [...capa, ...filhos],
    }],
  });
  fs.writeFileSync(caminho, await Packer.toBuffer(doc));
  console.log("Gerado:", caminho);
}

module.exports = { h1, h2, h3, p, bullets, numerada, codigo, esp, quebra, salvar, ler };
