// Utilitário de geração de .docx (usado pelos 3 scripts de documentos)
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, AlignmentType, HeadingLevel, LevelFormat, Footer, PageNumber, PageBreak,
} = require("docx");

const FONTE = "Calibri";
const MONO = "Consolas";
const LARGURA = 9638; // A4 com margens de 2 cm: 11906 - 2*1134 (em DXA)
let contadorListas = 0;
const listasNumeradas = [];

/** Converte **negrito** e `codigo` em TextRuns. */
function runs(texto, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let ultimo = 0, m;
  while ((m = re.exec(texto)) !== null) {
    if (m.index > ultimo) out.push(new TextRun({ text: texto.slice(ultimo, m.index), font: FONTE, ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, font: FONTE, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), font: MONO, size: 20, shading: { type: ShadingType.CLEAR, fill: "EEF1F5" }, ...base, }));
    ultimo = m.index + t.length;
  }
  if (ultimo < texto.length) out.push(new TextRun({ text: texto.slice(ultimo), font: FONTE, ...base }));
  return out;
}

const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: FONTE })], pageBreakBefore: false });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: FONTE })] });
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: t, font: FONTE })] });
const p = (t, opts = {}) => new Paragraph({ children: runs(t), spacing: { after: 120, line: 276 }, alignment: opts.alignment, keepNext: opts.keepNext });
const quebra = () => new Paragraph({ children: [new PageBreak()] });

const bullets = (itens) => itens.map((t) => new Paragraph({
  numbering: { reference: "bullets", level: 0 }, children: runs(t), spacing: { after: 60, line: 276 },
}));

function numerada(itens) {
  const ref = "num" + (++contadorListas);
  listasNumeradas.push(ref);
  return itens.map((t) => new Paragraph({
    numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 60, line: 276 },
  }));
}

/** Bloco de código / saída de terminal: uma linha por parágrafo, fundo cinza, fonte monoespaçada. */
function codigo(texto) {
  const linhas = texto.replace(/\r/g, "").replace(/\n$/, "").split("\n");
  return linhas.map((l, i) => new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: "F3F4F6" },
    spacing: { after: i === linhas.length - 1 ? 160 : 0, line: 240 },
    indent: { left: 120, right: 120 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: "9CA3AF", space: 6 },
    },
    children: [new TextRun({ text: l === "" ? " " : l, font: MONO, size: 17 })],
  }));
}

/** Caixa de destaque (nota, atenção, resultado). tipo: nota | atencao | ok */
function caixa(tipo, titulo, texto) {
  const cores = { nota: ["E8F1FB", "2B6CB0"], atencao: ["FFF4E0", "C77800"], ok: ["E7F6EC", "2F855A"] }[tipo];
  const b = (c) => ({ style: BorderStyle.SINGLE, size: 4, color: c });
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA }, columnWidths: [LARGURA],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: LARGURA, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: cores[0] },
      margins: { top: 100, bottom: 100, left: 160, right: 160 },
      borders: { top: b(cores[0]), bottom: b(cores[0]), right: b(cores[0]), left: { style: BorderStyle.SINGLE, size: 24, color: cores[1] } },
      children: [
        new Paragraph({ children: [new TextRun({ text: titulo, bold: true, font: FONTE, color: cores[1] })], spacing: { after: 60 } }),
        ...(Array.isArray(texto) ? texto : [texto]).map((t) => new Paragraph({ children: runs(t), spacing: { after: 60, line: 264 } })),
      ],
    })] })],
  });
}

/** Tabela com cabeçalho. larguras em DXA (soma = LARGURA) */
function tabela(cabecalho, linhas, larguras) {
  const soma = larguras.reduce((a, b) => a + b, 0);
  const borda = { style: BorderStyle.SINGLE, size: 4, color: "BFC5CD" };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const cel = (t, w, cab) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: bordas,
    shading: cab ? { type: ShadingType.CLEAR, fill: "1F3A5F" } : undefined,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    children: String(t).split("\n").map((ln) => new Paragraph({
      spacing: { after: 20, line: 250 },
      children: cab ? [new TextRun({ text: ln, bold: true, color: "FFFFFF", font: FONTE, size: 20 })] : runs(ln, { size: 20 }),
    })),
  });
  return new Table({
    width: { size: soma, type: WidthType.DXA }, columnWidths: larguras,
    rows: [
      new TableRow({ tableHeader: true, children: cabecalho.map((c, i) => cel(c, larguras[i], true)) }),
      ...linhas.map((l) => new TableRow({ cantSplit: true, children: l.map((c, i) => cel(c, larguras[i], false)) })),
    ],
  });
}

const esp = () => new Paragraph({ children: [], spacing: { after: 120 } });

/** Gera o arquivo .docx */
async function salvar(caminho, titulo, subtitulo, filhos) {
  const capa = [
    new Paragraph({ spacing: { before: 2400, after: 200 }, children: [new TextRun({ text: "Distribuição e Concorrência — 2026/1", font: FONTE, size: 26, color: "6B7280" })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: titulo, font: FONTE, size: 52, bold: true, color: "1F3A5F" })] }),
    new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: subtitulo, font: FONTE, size: 28, color: "374151" })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Trabalho 1 — Balanceamento de Carga, Elasticidade e Failover com Kafka em Clusters Docker", font: FONTE, size: 22 })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Mini-mundo: Sistema de Monitoramento de Sensores em uma Fábrica Inteligente", font: FONTE, size: 22 })] }),
    new Paragraph({ spacing: { before: 600, after: 80 }, children: [new TextRun({ text: "Integrantes: [preencher nomes e matrículas]", font: FONTE, size: 22 })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Data: [preencher]", font: FONTE, size: 22 })] }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
  const doc = new Document({
    creator: "SmartFactory Lab", title: titulo,
    styles: {
      default: { document: { run: { font: FONTE, size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 34, bold: true, font: FONTE, color: "1F3A5F" }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0, keepNext: true } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: FONTE, color: "2B4C7E" }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1, keepNext: true } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, font: FONTE, color: "374151" }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2, keepNext: true } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
        ...listasNumeradas.map((ref) => ({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] })),
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: titulo + " — página ", font: FONTE, size: 18, color: "6B7280" }), new TextRun({ children: [PageNumber.CURRENT], font: FONTE, size: 18, color: "6B7280" })] })] }) },
      children: [...capa, ...filhos],
    }],
  });
  fs.writeFileSync(caminho, await Packer.toBuffer(doc));
  console.log("Gerado:", caminho);
}

/** Lê um arquivo de texto do projeto (para colar logs reais nos documentos) */
const ler = (rel) => fs.readFileSync(require("path").join(__dirname, "..", "..", rel), "utf8");

module.exports = { h1, h2, h3, p, bullets, numerada, codigo, caixa, tabela, esp, quebra, salvar, ler, LARGURA };
