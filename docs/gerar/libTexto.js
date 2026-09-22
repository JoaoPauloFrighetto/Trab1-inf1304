// Backend de texto puro (.txt): implementa a mesma API de lib.js (h1, h2, h3, p, bullets,
// numerada, codigo, caixa, tabela, esp, quebra, salvar, ler), mas produzindo apenas texto,
// sem nenhuma dependência de "docx". Os arquivos de conteúdo (relatorio_txt.js, guia_txt.js,
// codigo_txt.js) chamam exatamente as mesmas funções que os originais em docx; só muda o backend.
const fs = require("fs");
const path = require("path");

const LARGURA_COL = 96; // largura de quebra de linha para parágrafos, em colunas

/** Remove marcações de negrito (**texto**) mantendo o texto; preserva `código` entre crases. */
function limpar(t) {
  return String(t).replace(/\*\*([^*]+)\*\*/g, "$1");
}

/** Quebra um texto em linhas de até `largura` colunas, sem cortar palavras. */
function quebrarLinha(texto, largura = LARGURA_COL) {
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = "";
  for (const w of palavras) {
    const tentativa = atual ? atual + " " + w : w;
    if (tentativa.length > largura && atual) {
      linhas.push(atual);
      atual = w;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [""];
}

/** Aplica indentação pendurada: primeira linha com `prefixo`, demais com espaços do mesmo tamanho. */
function comIndentacao(texto, prefixo) {
  const recuo = " ".repeat(prefixo.length);
  const linhas = quebrarLinha(limpar(texto), LARGURA_COL - prefixo.length);
  return linhas.map((l, i) => (i === 0 ? prefixo + l : recuo + l)).join("\n");
}

const h1 = (t) => ({ kind: "h1", text: t.toUpperCase() + "\n" + "=".repeat(Math.min(78, Math.max(t.length, 10))) });
const h2 = (t) => ({ kind: "h2", text: t + "\n" + "-".repeat(Math.min(78, Math.max(t.length, 6))) });
const h3 = (t) => ({ kind: "h3", text: "### " + t });
const p = (t) => ({ kind: "p", text: quebrarLinha(limpar(t)).join("\n") });
const esp = () => ({ kind: "space", text: "" });
const quebra = () => ({ kind: "pagebreak", text: "\n" + "#".repeat(78) + "  (nova seção)" });

const bullets = (itens) => itens.map((t) => ({ kind: "bullet", text: comIndentacao(t, "  - ") }));

function numerada(itens) {
  return itens.map((t, i) => ({ kind: "numbered", text: comIndentacao(t, "  " + (i + 1) + ". ") }));
}

/** Bloco de código / saída de terminal: uma linha por item, indentada, sem quebra de palavra. */
function codigo(texto) {
  const linhas = texto.replace(/\r/g, "").replace(/\n$/, "").split("\n");
  return linhas.map((l) => ({ kind: "codeline", text: "    " + l }));
}

/** Caixa de destaque. tipo: nota | atencao | ok */
function caixa(tipo, titulo, texto) {
  const rotulo = { nota: "NOTA", atencao: "ATENCAO", ok: "RESULTADO" }[tipo] || tipo.toUpperCase();
  const itens = Array.isArray(texto) ? texto : [texto];
  const linhas = [`[${rotulo}] ${limpar(titulo)}`, ...itens.map((t) => comIndentacao(t, "  - "))];
  return { kind: "box", text: linhas.join("\n") };
}

/** Tabela em texto simples, colunas alinhadas por largura de conteúdo. */
function tabela(cabecalho, linhas, _larguras) {
  const linhasLimpa = linhas.map((l) => l.map((c) => limpar(String(c)).replace(/\n/g, " / ")));
  const cabLimpo = cabecalho.map((c) => limpar(String(c)));
  const nCols = cabLimpo.length;
  const larguras = [];
  for (let i = 0; i < nCols; i++) {
    let w = cabLimpo[i].length;
    for (const l of linhasLimpa) w = Math.max(w, (l[i] || "").length);
    larguras.push(Math.min(w, 60));
  }
  const quebrarCel = (t, w) => quebrarLinha(t, w);
  const linhaTexto = (cols) => {
    const partes = cols.map((t, i) => quebrarCel(t, larguras[i]));
    const nLinhas = Math.max(...partes.map((p) => p.length));
    const out = [];
    for (let r = 0; r < nLinhas; r++) {
      out.push(partes.map((p, i) => (p[r] || "").padEnd(larguras[i])).join(" | "));
    }
    return out.join("\n");
  };
  const separador = larguras.map((w) => "-".repeat(w)).join("-+-");
  const out = [linhaTexto(cabLimpo), separador, ...linhasLimpa.map((l) => linhaTexto(l))];
  return { kind: "table", text: out.join("\n") };
}

/** Lê um arquivo de texto do projeto (para colar logs reais nos documentos) */
const ler = (rel) => fs.readFileSync(path.join(__dirname, "..", "..", rel), "utf8");

const LISTA_KINDS = new Set(["bullet", "numbered", "codeline"]);

/** Monta o texto final a partir dos nós, inserindo linha em branco entre blocos de tipos
 *  diferentes e mantendo itens de uma mesma lista/código colados uns aos outros. */
function montarTexto(nodes) {
  const linhas = [];
  let anterior = null;
  for (const n of nodes) {
    const mesmoTipoDeLista = LISTA_KINDS.has(n.kind) && anterior === n.kind;
    if (linhas.length > 0 && !mesmoTipoDeLista) linhas.push("");
    linhas.push(n.text);
    anterior = n.kind;
  }
  return linhas.join("\n");
}

/** Gera o arquivo .txt */
function salvar(caminho, titulo, subtitulo, filhos) {
  const capa = [
    "=".repeat(78),
    "Distribuição e Concorrência — 2026/1",
    titulo.toUpperCase(),
    subtitulo,
    "",
    "Trabalho 1 — Balanceamento de Carga, Elasticidade e Failover com Kafka em Clusters Docker",
    "Mini-mundo: Sistema de Monitoramento de Sensores em uma Fábrica Inteligente",
    "",
    "Integrantes: [preencher nomes e matrículas]",
    "Data: [preencher]",
    "=".repeat(78),
    "",
  ].join("\n");

  const corpo = montarTexto(filhos);
  fs.writeFileSync(caminho, capa + "\n" + corpo + "\n", "utf8");
  console.log("Gerado:", caminho);
}

module.exports = { h1, h2, h3, p, bullets, numerada, codigo, caixa, tabela, esp, quebra, salvar, ler };
