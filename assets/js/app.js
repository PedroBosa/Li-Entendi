const CHAR_LIMIT = 5000;
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3-pro-preview';
const ENV_PATH = '.env';
let currentMode = 'claro';
let lastResult = null;
let controller = null;

const inputText = document.getElementById('inputText');
const charCount = document.getElementById('charCount');
const charWarn = document.getElementById('charWarn');
const processBtn = document.getElementById('processBtn');
const clearBtn = document.getElementById('clearBtn');
const modeBtns = document.querySelectorAll('.mode');
const tabs = document.querySelectorAll('.tab');
const sections = document.querySelectorAll('.section');
const originalOut = document.getElementById('originalOut');
const simplificadoOut = document.getElementById('simplificadoOut');
const resumoList = document.getElementById('resumoList');
const clausulasList = document.getElementById('clausulasList');
const glossarioList = document.getElementById('glossarioList');
const atencaoList = document.getElementById('atencaoList');
const perguntasList = document.getElementById('perguntasList');
const copySimplificado = document.getElementById('copySimplificado');
const shareResultado = document.getElementById('shareResultado');
const historyEl = document.getElementById('history');
const toggleTheme = document.getElementById('toggleTheme');
const loadingOverlay = document.getElementById('loading');
const exampleSelect = document.getElementById('exampleSelect');
const loadExampleBtn = document.getElementById('loadExample');
const modelSelect = document.getElementById('modelSelect');
const refreshModelsBtn = document.getElementById('refreshModels');

(function init() {
  const savedTheme = localStorage.getItem('leiClara.theme');
  if (savedTheme === 'dark') document.body.setAttribute('data-theme', 'dark');
  const savedModel = localStorage.getItem('leiClara.model') || DEFAULT_MODEL;
  if (modelSelect) modelSelect.value = savedModel;
  renderHistory();
  loadEnv().then(() => { const hasKey = !!(localStorage.getItem('leiClara.apiKey') || ''); if (hasKey) refreshModels(); });
})();

inputText.addEventListener('input', updateCharInfo);
clearBtn.addEventListener('click', () => { inputText.value = ''; updateCharInfo(); resetResults(); });
processBtn.addEventListener('click', onProcess);
modeBtns.forEach(btn => btn.addEventListener('click', () => setMode(btn)));
tabs.forEach(tab => tab.addEventListener('click', () => setTab(tab)));
copySimplificado.addEventListener('click', copySimplifiedText);
shareResultado.addEventListener('click', shareTextResult);
toggleTheme.addEventListener('click', () => {
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  document.body.setAttribute('data-theme', isDark ? '' : 'dark');
  localStorage.setItem('leiClara.theme', isDark ? '' : 'dark');
});
modelSelect.addEventListener('change', () => {
  localStorage.setItem('leiClara.model', modelSelect.value);
});
refreshModelsBtn.addEventListener('click', refreshModels);
loadExampleBtn.addEventListener('click', async () => {
  const path = exampleSelect.value;
  if (!path) return;
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error('Erro ao carregar exemplo');
    const txt = await res.text();
    inputText.value = txt;
    updateCharInfo();
  } catch (e) {
    inputText.value = exemploFallback(path);
    updateCharInfo();
  }
});

function updateCharInfo() {
  const len = inputText.value.length;
  charCount.textContent = String(len);
  if (len > CHAR_LIMIT) {
    charWarn.textContent = 'Limite excedido. Reduza o texto.';
    charWarn.style.color = 'var(--danger)';
    processBtn.disabled = true;
  } else {
    charWarn.textContent = '';
    processBtn.disabled = false;
  }
}

function setMode(btn) {
  modeBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');
  currentMode = btn.dataset.mode;
}

function setTab(tab) {
  tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
  sections.forEach(s => s.classList.remove('active'));
  tab.classList.add('active'); tab.setAttribute('aria-selected', 'true');
  const target = document.getElementById(tab.dataset.target);
  if (target) target.classList.add('active');
}

function resetResults() {
  originalOut.textContent = '';
  simplificadoOut.textContent = '';
  resumoList.innerHTML = '';
  clausulasList.innerHTML = '';
  glossarioList.innerHTML = '';
  atencaoList.innerHTML = '';
  perguntasList.innerHTML = '';
  lastResult = null;
}

async function onProcess() {
  const text = sanitizeInput(inputText.value);
  if (!text) { alert('Cole um documento para processar.'); return; }
  if (text.length > CHAR_LIMIT) { alert('Texto acima do limite de 5000 caracteres.'); return; }

  showLoading(true);
  resetResults();
  const apiKey = (localStorage.getItem('leiClara.apiKey') || '').trim();
  try {
    let result;
    if (!apiKey) {
      result = localSimplify(text, currentMode);
    } else {
      const model = localStorage.getItem('leiClara.model') || DEFAULT_MODEL;
      result = await callGemini(apiKey, model, text, currentMode);
    }
    lastResult = result;
    renderResults(text, result);
    saveHistory({ input: text, mode: currentMode, result });
  } catch (err) {
    alert(err.message || 'Falha na IA. Aplicando simplificação local.');
    const fallback = localSimplify(text, currentMode);
    lastResult = fallback;
    renderResults(text, fallback);
  } finally {
    showLoading(false);
  }
}

function sanitizeInput(s) {
  return (s || '').replace(/\u0000/g, '').trim();
}

function showLoading(show) {
  loadingOverlay.classList.toggle('show', !!show);
  sections.forEach(s => s.setAttribute('aria-busy', show ? 'true' : 'false'));
  [originalOut, simplificadoOut].forEach(el => el.classList.toggle('skeleton', !!show));
}

function buildPrompt(text, mode) {
  const modo = mode === 'adolescente' ? 'super simples, como para um adolescente' : (mode === 'tecnico' ? 'técnico simplificado (mantém termos mas explica)' : 'português claro');
  return `Você é um especialista em simplificação de textos jurídicos brasileiros.\n\nTAREFA: Analise o documento abaixo e forneça uma resposta estruturada em JSON.\n\nDOCUMENTO ORIGINAL:\n${text}\n\nNÍVEL DE SIMPLIFICAÇÃO: ${modo}\n\nResponda APENAS com um JSON válido no seguinte formato:\n\n{\n  "textoSimplificado": "versão completa do texto em linguagem ${modo}",\n  "resumoExecutivo": ["ponto 1", "ponto 2", "ponto 3"],\n  "clausulasImportantes": [\n    {\n      "texto": "trecho original da cláusula",\n      "explicacao": "o que isso significa na prática",\n      "nivelAlerta": "alto|medio|baixo"\n    }\n  ],\n  "glossario": [\n    {\n      "termo": "palavra técnica",\n      "definicao": "explicação simples"\n    }\n  ],\n  "pontosAtencao": ["atenção 1", "atenção 2"],\n  "perguntasSugeridas": ["pergunta 1", "pergunta 2", "pergunta 3"]\n}\n\nIMPORTANTE:\n- Use português brasileiro coloquial mas correto\n- Identifique cláusulas abusivas ou incomuns\n- Destaque prazos, valores e obrigações principais\n- Seja direto e honesto sobre riscos`;
}

async function callGemini(apiKey, model, text, mode) {
  controller?.abort();
  controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: buildPrompt(text, mode) }] }]
  });
  const candidates = [model, 'gemini-3-pro-preview', 'gemini-1.5-pro-latest', 'gemini-pro'];
  let lastErr;
  try {
    for (const m of candidates) {
      try {
        const endpoint = `${API_BASE}/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal
        });
        if (!res.ok) {
          if (res.status === 404) { lastErr = new Error('Modelo/endpoint não encontrado.'); continue; }
          let msg = 'Erro na API do Gemini.';
          if (res.status === 429) msg = 'Limite de uso da API atingido. Aguarde alguns minutos e tente novamente.';
          if (res.status === 401) msg = 'Não autorizado. Verifique sua API Key.';
          if (res.status === 403) msg = 'Acesso negado. Adicione seu domínio (localhost ou a URL do deploy) em Allowed domains no Google AI Studio.';
          try {
            const errData = await res.json();
            const apiMsg = errData?.error?.message;
            if (apiMsg) msg = `${msg} ${apiMsg}`;
          } catch {}
          throw new Error(msg);
        }
        const data = await res.json();
        const textOut = (((data || {}).candidates || [])[0]?.content?.parts || [])[0]?.text || '';
        const parsed = parseJsonText(textOut);
        validateResultShape(parsed);
        localStorage.setItem('leiClara.model', m);
        return parsed;
      } catch (err) {
        lastErr = err;
        if (err.name === 'AbortError') throw new Error('Tempo limite excedido (30s). Tente novamente.');
      }
    }
    throw lastErr || new Error('Falha ao chamar a IA.');
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshModels() {
  const key = (localStorage.getItem('leiClara.apiKey') || '').trim();
  if (!key) { alert('Configure a API Key para listar modelos.'); return; }
  try {
    const res = await fetch(`${API_BASE}/models?key=${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error('Falha ao listar modelos.');
    const data = await res.json();
    const models = (data.models || []).map(m => typeof m.name === 'string' ? m.name.replace(/^models\//,'') : '').filter(Boolean);
    const supports = (m) => {
      const entry = (data.models || []).find(x => (x.name || '').endsWith(m));
      const methods = entry?.supportedGenerationMethods || entry?.supported_generation_methods || [];
      return Array.isArray(methods) && methods.includes('generateContent');
    };
    const filtered = models.filter(supports).filter(m => !/image|vision|audio|embedding/i.test(m));
    const unique = Array.from(new Set(filtered));
    if (unique.length) {
      const current = localStorage.getItem('leiClara.model') || DEFAULT_MODEL;
      modelSelect.innerHTML = unique.map(m => `<option value="${m}">${m}</option>`).join('');
      modelSelect.value = unique.includes(current) ? current : unique[0];
      localStorage.setItem('leiClara.model', modelSelect.value);
      alert('Modelos atualizados.');
    } else {
      alert('Nenhum modelo disponível para generateContent nesta chave.');
    }
  } catch (e) {
    alert(e.message || 'Erro ao atualizar lista de modelos.');
  }
}

function parseJsonText(s) {
  const match = String(s || '').match(/\{[\s\S]*\}/);
  const raw = match ? match[0] : s;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('A resposta da IA não é um JSON válido.');
  }
}

function validateResultShape(r) {
  const keys = ['textoSimplificado','resumoExecutivo','clausulasImportantes','glossario','pontosAtencao','perguntasSugeridas'];
  const ok = keys.every(k => k in r);
  if (!ok) throw new Error('Resposta incompleta da IA. Tente novamente.');
}

function localSimplify(text, mode) {
  const dict = [
    [/oneroso/gi, 'caro'],
    [/rescisão/gi, 'cancelamento'],
    [/inadimplência/gi, 'atraso no pagamento'],
    [/multa/gi, 'penalidade'],
    [/vigência/gi, 'período de validade'],
    [/cláusula/gi, 'regra'],
    [/juros/gi, 'taxa que aumenta a dívida'],
    [/confidencialidade/gi, 'manter segredo'],
  ];
  let simplified = text;
  dict.forEach(([re, rep]) => { simplified = simplified.replace(re, rep); });
  if (mode === 'adolescente') {
    simplified = simplified
      .replace(/\bdeverá\b/gi, 'tem que')
      .replace(/\bresponsabiliza-se\b/gi, 'fica responsável')
      .replace(/\bobriga-se\b/gi, 'se compromete');
  }
  const clauses = [];
  const patterns = [
    { re: /(multa|penalidade)[\s\S]{0,120}/i, nivel: 'alto', expl: 'Há multa ou penalidade prevista.' },
    { re: /(prazo|vigência)[\s\S]{0,120}/i, nivel: 'medio', expl: 'Observe prazos e período de validade.' },
    { re: /(juros|correção monetária)[\s\S]{0,120}/i, nivel: 'medio', expl: 'Há incidência de juros.' },
    { re: /(rescisão|cancelamento)[\s\S]{0,120}/i, nivel: 'baixo', expl: 'Condições para cancelar o contrato.' },
  ];
  patterns.forEach(p => {
    const m = text.match(p.re);
    if (m) clauses.push({ texto: m[0], explicacao: p.expl, nivelAlerta: p.nivel });
  });
  const glossario = [
    { termo: 'vigência', definicao: 'período em que o contrato vale' },
    { termo: 'rescisão', definicao: 'ato de terminar o contrato' },
    { termo: 'inadimplência', definicao: 'ficar devendo, atrasar pagamento' },
  ];
  const resumo = (text.split(/\n+/).slice(0,3).map(p => p.trim()).filter(Boolean).map(p => p.length > 120 ? p.slice(0,117)+'…' : p));
  const atencao = ['Verifique multas e prazos', 'Confirme valores e reajustes', 'Entenda condições de cancelamento'];
  const perguntas = ['Qual o prazo de vigência?', 'Há multa por rescisão?', 'Como funciona reajuste/juros?'];
  return {
    textoSimplificado: simplified,
    resumoExecutivo: resumo,
    clausulasImportantes: clauses,
    glossario,
    pontosAtencao: atencao,
    perguntasSugeridas: perguntas,
  };
}

function renderResults(original, r) {
  originalOut.innerHTML = highlightAll(original, r);
  simplificadoOut.innerHTML = highlightGlossario(r.textoSimplificado, r.glossario);

  resumoList.innerHTML = (r.resumoExecutivo || []).map(p => `
    <div class="item">
      <div class="item-header">🧭 Resumo</div>
      <div>• ${formatTextBlock(p)}</div>
    </div>`).join('');
  clausulasList.innerHTML = (r.clausulasImportantes || []).map(c => {
    const level = c.nivelAlerta || 'medio';
    const icon = level === 'alto' ? '🚨' : (level === 'medio' ? '⚠️' : '✅');
    const cls = level === 'alto' ? 'alert-high' : (level === 'medio' ? 'alert-medium' : 'alert-low');
    const badgeCls = level === 'alto' ? 'badge-danger' : (level === 'medio' ? 'badge-warning' : 'badge-ok');
    return `<div class="item ${cls}">
      <div class="item-header">${icon} Cláusula <span class="badge ${badgeCls}">${escapeHtml(level)}</span></div>
      <div><strong>Cláusula:</strong> ${formatTextBlock(c.texto)}</div>
      <div><strong>Explicação:</strong> ${formatTextBlock(c.explicacao)}</div>
    </div>`;
  }).join('');

  glossarioList.innerHTML = (r.glossario || []).map(g => `
    <div class="item">
      <div class="item-header">📘 Glossário</div>
      <strong>${escapeHtml(g.termo)}</strong>
      <div class="meta">${formatTextBlock(g.definicao)}</div>
    </div>`).join('');
  atencaoList.innerHTML = (r.pontosAtencao || []).map(x => `
    <div class="item">
      <div class="item-header">❗ Ponto de atenção</div>
      ${formatTextBlock(x)}
    </div>`).join('');
  perguntasList.innerHTML = (r.perguntasSugeridas || []).map(x => `
    <div class="item">
      <div class="item-header">💡 Pergunta sugerida</div>
      ${formatTextBlock(x)}
    </div>`).join('');
}

function highlightAll(text, r) {
  let out = escapeHtml(text);
  (r.glossario || []).forEach(g => {
    const term = escapeRegExp(g.termo);
    out = out.replace(new RegExp(`(${term})`, 'gi'), `<span class="tooltip mark" data-tip="${escapeHtml(g.definicao)}">$1</span>`);
  });
  (r.clausulasImportantes || []).forEach(c => {
    const cls = c.nivelAlerta === 'alto' ? 'alert-high' : (c.nivelAlerta === 'medio' ? 'alert-medium' : 'alert-low');
    const textClause = escapeRegExp(c.texto.slice(0, 80));
    out = out.replace(new RegExp(`${textClause}`, 'i'), `<span class="${cls}">${escapeHtml(c.texto)}</span>`);
  });
  return applyBasicFormatting(out);
}

function highlightGlossario(text, glossario) {
  let out = escapeHtml(text);
  (glossario || []).forEach(g => {
    const term = escapeRegExp(g.termo);
    out = out.replace(new RegExp(`(${term})`, 'gi'), `<span class="tooltip mark" data-tip="${escapeHtml(g.definicao)}">$1</span>`);
  });
  return applyBasicFormatting(out);
}

function applyBasicFormatting(html) {
  return String(html || '')
    .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\n)\* +/g, '$1• ')
    .replace(/(^|\n)- +/g, '$1• ');
}

function formatTextBlock(text) {
  return applyBasicFormatting(escapeHtml(text || ''))
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function escapeHtml(s) {
  return String(s || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}
function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function copySimplifiedText() {
  const txt = simplificadoOut.textContent || '';
  try {
    await navigator.clipboard.writeText(txt);
    flashButton(copySimplificado);
  } catch {
    alert('Não foi possível copiar.');
  }
}

async function shareTextResult() {
  if (!lastResult) { alert('Nada para compartilhar ainda.'); return; }
  const share = [
    'Li & Entendi — Resultado',
    '',
    'Resumo:',
    ...lastResult.resumoExecutivo.map(x => `• ${x}`),
    '',
    'Pontos de atenção:',
    ...lastResult.pontosAtencao.map(x => `• ${x}`),
    '',
    'Perguntas sugeridas:',
    ...lastResult.perguntasSugeridas.map(x => `• ${x}`),
    '',
    'Texto simplificado:',
    lastResult.textoSimplificado,
  ].join('\n');
  try {
    await navigator.clipboard.writeText(share);
    flashButton(shareResultado);
  } catch {
    alert('Não foi possível copiar o compartilhamento.');
  }
}

function flashButton(btn) {
  const orig = btn.textContent;
  btn.textContent = '✅ Copiado!';
  setTimeout(() => btn.textContent = orig, 1500);
}

function saveHistory(entry) {
  const arr = JSON.parse(localStorage.getItem('leiClara.history') || '[]');
  arr.unshift({ ...entry, ts: Date.now() });
  const trimmed = arr.slice(0,3);
  localStorage.setItem('leiClara.history', JSON.stringify(trimmed));
  renderHistory();
}

function renderHistory() {
  const arr = JSON.parse(localStorage.getItem('leiClara.history') || '[]');
  if (!arr.length) {
    historyEl.innerHTML = '<p class="history-empty">Nenhum histórico salvo no momento.</p>';
    return;
  }
  historyEl.innerHTML = arr.map((e, i) => {
    const dt = new Date(e.ts).toLocaleString('pt-BR');
    const excerpt = escapeHtml(e.input.slice(0, 90)) + (e.input.length > 90 ? '…' : '');
    const modeLabel = e.mode === 'adolescente' ? 'Adolescente' : (e.mode === 'tecnico' ? 'Técnico' : 'Claro');
    return `<div class="item">
      <div class="meta">${dt} • Modo: ${modeLabel}</div>
      <div>${excerpt}</div>
      <div class="row" style="margin-top:.5rem">
        <button class="btn" data-restore="${i}">↩️ Restaurar</button>
      </div>
    </div>`;
  }).join('');
  historyEl.querySelectorAll('[data-restore]').forEach(btn => {
    btn.addEventListener('click', () => {
      const arr = JSON.parse(localStorage.getItem('leiClara.history') || '[]');
      const idx = Number(btn.getAttribute('data-restore'));
      const e = arr[idx];
      if (!e) return;
      inputText.value = e.input; updateCharInfo();
      currentMode = e.mode;
      modeBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.mode === e.mode);
        b.setAttribute('aria-selected', b.dataset.mode === e.mode ? 'true' : 'false');
      });
      renderResults(e.input, e.result);
      lastResult = e.result;
      setTab(document.querySelector('.tab[data-target="sec-compare"]'));
    });
  });
}

function exemploFallback(path) {
  if (path.includes('aluguel')) return `CONTRATO DE LOCAÇÃO\n\nLocador: João da Silva\nLocatário: Maria Souza\nImóvel: Apto 101, Rua X, São Paulo\nPrazo: 12 meses a partir de 01/02/2025\nAluguel: R$ 2.500,00 com reajuste anual pelo IPCA\nMulta por rescisão antecipada: 3 alugueis\nResponsabilidades: locatário deve pagar condomínio e água; locador cobre IPTU.\nConfidencialidade: não aplicável.\n`; 
  if (path.includes('termo-uso')) return `TERMO DE USO - APP Exemplo\n\nAo criar a conta, o usuário concorda com coleta de dados de uso e localização.\nPodem ser enviados e-mails promocionais.\nCancelamento pode ser solicitado a qualquer momento, sem multa.\nAssinatura mensal renovada automaticamente. Juros por atraso: 2% ao mês.\n`; 
  return `CLÁUSULA DE TRABALHO\n\nO colaborador obriga-se a manter confidencialidade sobre informações estratégicas.\nVigência do acordo: 24 meses. Em caso de rescisão sem aviso prévio, há multa.\nReajuste anual conforme acordo coletivo.\n`;
}

function parseEnv(text) {
  const env = {};
  String(text || '').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      env[key] = val;
    }
  });
  return env;
}

async function loadEnv() {
  try {
    const res = await fetch(ENV_PATH, { cache: 'no-store' });
    if (!res.ok) return;
    const txt = await res.text();
    const env = parseEnv(txt);
    const key = env.GEMINI_API_KEY || env.API_KEY || '';
    const model = env.GEMINI_MODEL || '';
    if (key) {
      localStorage.setItem('leiClara.apiKey', key);
    }
    if (model) {
      if (modelSelect) modelSelect.value = model;
      localStorage.setItem('leiClara.model', model);
    }
  } catch {}
}
