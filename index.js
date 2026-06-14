const BASE_URL = "http://localhost:8000";

const STATUS = {
  1: { label: "Em análise", cls: "status-em-analise" },
  2: { label: "Analisado", cls: "status-analisado" },
};

const FALLBACK_IMGS = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80",
  "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=400&q=80",
  "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=80",
  "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=400&q=80",
  "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=400&q=80",
  "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=400&q=80",
  "https://images.unsplash.com/photo-1547411398-0c3e5e04a61f?w=400&q=80",
  "https://images.unsplash.com/photo-1499336315816-097655dcfbda?w=400&q=80",
  "https://images.unsplash.com/photo-1584467541268-b040f83be3fd?w=400&q=80",
];

const FALLBACK_HERO_IMGS = FALLBACK_IMGS.map((u) =>
  u.replace("w=400", "w=1200").replace("q=80", "q=85"),
);

let allUnits = [];
let allComunicados = [];
let currentUnit = null;

// ── HELPERS ────────────────────────────────────────────────────────────────

function resolveImg(imagem, fallback) {
  if (!imagem || (!imagem.startsWith("http") && !imagem.startsWith("/")))
    return fallback;
  return imagem;
}

function resolveMunicipios(u) {
  if (Array.isArray(u.municipios))
    return u.municipios.map((m) => m.nome || m).join(", ") || "—";
  if (typeof u.municipio === "string" && u.municipio) return u.municipio;
  return "—";
}

function resolveAno(dataCriacao) {
  if (!dataCriacao) return "—";
  // PHP serializa DateTime como objeto: { date: "2026-06-14 18:40:13.000000", ... }
  const raw = typeof dataCriacao === "object" ? dataCriacao.date : dataCriacao;
  if (!raw) return "—";
  if (/^\d{4}$/.test(String(raw))) return String(raw);
  try {
    return new Date(raw).getFullYear().toString();
  } catch {
    return String(raw);
  }
}

function formatDate(raw) {
  try {
    // PHP pode serializar DateTime como objeto: { date: "...", timezone_type: 3, timezone: "UTC" }
    const str = typeof raw === "object" ? raw.date : raw;
    const d = new Date(str);
    if (isNaN(d)) return String(raw);
    const date = d.toLocaleDateString("pt-BR");
    const time = d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date} - ${time}h`;
  } catch {
    return String(raw);
  }
}

// ── LIST.HTML ──────────────────────────────────────────────────────────────

async function initList() {
  const grid = document.getElementById("unit-grid");
  if (!grid) return;

  grid.innerHTML = '<p class="grid-loading">Carregando unidades…</p>';

  try {
    const [unitsRes, commRes] = await Promise.all([
      fetch(`${BASE_URL}/unidade`),
      fetch(`${BASE_URL}/comunicado`),
    ]);

    if (!unitsRes.ok) throw new Error(`HTTP ${unitsRes.status}`);
    allUnits = await unitsRes.json();
    allComunicados = commRes.ok ? await commRes.json() : [];

    renderGrid();
  } catch (err) {
    grid.innerHTML = `
      <p class="grid-error">
        Não foi possível conectar ao servidor.<br>
        <small>${err.message}</small>
      </p>`;
  }
}

function renderGrid() {
  const search = (document.getElementById("f-search")?.value || "").toLowerCase();
  const mun = (document.getElementById("f-municipio")?.value || "").toLowerCase();

  const filtered = allUnits.filter(
    (u) =>
      (!search || (u.nome || "").toLowerCase().includes(search)) &&
      (!mun || resolveMunicipios(u).toLowerCase().includes(mun)),
  );

  const grid = document.getElementById("unit-grid");

  if (filtered.length === 0) {
    grid.innerHTML = '<p class="grid-empty">Nenhuma unidade encontrada.</p>';
    return;
  }

  grid.innerHTML = filtered
    .map((u) => {
      const idx = allUnits.indexOf(u);
      const img = resolveImg(u.imagem, FALLBACK_IMGS[idx % FALLBACK_IMGS.length]);
      const municipio = resolveMunicipios(u).split(",")[0];
      const ano = resolveAno(u.dataCriacao);
      return `
        <div class="unit-card" onclick="goToDetail(${u.id})">
          <img class="unit-card-img" src="${img}" alt="${u.nome}" loading="lazy"
               onerror="this.src='${FALLBACK_IMGS[0]}'">
          <div class="unit-card-body">
            <p class="unit-card-name">${u.nome}</p>
            <p class="unit-card-meta">${municipio}</p>
            <p class="unit-card-meta">${ano}</p>
            <span class="unit-card-link">Ver detalhes →</span>
          </div>
        </div>`;
    })
    .join("");
}

function goToDetail(id) {
  const unit = allUnits.find((u) => u.id === id);
  if (!unit) return;
  sessionStorage.setItem("currentUnitId", String(id));
  sessionStorage.setItem("currentUnit", JSON.stringify(unit));
  window.location.href = "detail.html";
}

// ── DETAIL.HTML ────────────────────────────────────────────────────────────

async function initDetail() {
  const unitId = parseInt(sessionStorage.getItem("currentUnitId") || "0");
  if (!unitId) {
    window.location.href = "list.html";
    return;
  }

  const cached = sessionStorage.getItem("currentUnit");
  currentUnit = cached ? JSON.parse(cached) : null;

  if (currentUnit) populateDetail();

  try {
    const commRes = await fetch(`${BASE_URL}/comunicado`);
    allComunicados = commRes.ok ? await commRes.json() : [];

    if (!currentUnit) {
      const unitRes = await fetch(`${BASE_URL}/unidade/${unitId}`);
      if (unitRes.ok) {
        currentUnit = await unitRes.json();
        sessionStorage.setItem("currentUnit", JSON.stringify(currentUnit));
        populateDetail();
      }
    }

    renderHistorico();
  } catch (err) {
    console.error("Erro ao carregar detalhe:", err);
    renderHistorico();
  }
}

function populateDetail() {
  if (!currentUnit) return;

  const idx = parseInt(sessionStorage.getItem("currentUnitId") || "0") % FALLBACK_HERO_IMGS.length;
  const heroImg = resolveImg(currentUnit.imagem, FALLBACK_HERO_IMGS[idx]);

  document.getElementById("detail-hero").style.backgroundImage = `url('${heroImg}')`;
  document.getElementById("detail-name").textContent = currentUnit.nome || "—";
  document.getElementById("d-municipio").textContent = resolveMunicipios(currentUnit);
  document.getElementById("d-instituicao").textContent =
    currentUnit.instituicao || currentUnit.responsavel?.nome || "—";
  document.getElementById("d-criado").textContent = resolveAno(currentUnit.dataCriacao);
  document.getElementById("d-descricao").textContent = currentUnit.descricao || "";
}

function renderHistorico() {
  const histGrid = document.getElementById("history-grid");
  if (!histGrid || !currentUnit) return;

  const unitComms = allComunicados.filter((c) => {
    // API retorna "unidadeConservacao" (camelCase) com o objeto embutido
    const ucId =
      c.unidadeConservacao?.id ??
      c.unidade_conservacao_id ??
      c.unidade_conservacao?.id ??
      c.unidade_conservacao;
    return ucId === currentUnit.id;
  });

  if (unitComms.length === 0) {
    histGrid.innerHTML =
      '<p class="grid-empty" style="grid-column:1/-1">Nenhum comunicado registrado.</p>';
    return;
  }

  histGrid.innerHTML = unitComms
    .map((c) => {
      const s = STATUS[c.status] || STATUS[1];
      // API retorna "dataCriacao" como string "2026-06-14 18:40:13"
      const raw = c.dataCriacao || c.data_criacao || c.createdAt || c.data || "";
      const date = raw ? formatDate(raw) : "—";
      return `
        <div class="history-card">
          <span class="history-card-icon">⚠️</span>
          <p class="history-card-title">${c.titulo}</p>
          <span class="history-card-status ${s.cls}">${s.label}</span>
          <span class="history-card-date">${date}</span>
        </div>`;
    })
    .join("");
}

// ── FORM.HTML ──────────────────────────────────────────────────────────────

function initForm() {
  const cached = sessionStorage.getItem("currentUnit");
  if (!cached) {
    window.location.href = "list.html";
    return;
  }
  currentUnit = JSON.parse(cached);
  const ucInput = document.getElementById("form-uc");
  if (ucInput) ucInput.value = currentUnit.nome;
}

async function submitForm() {
  const titulo = document.getElementById("form-titulo").value.trim();
  const nome = document.getElementById("form-nome").value.trim();
  const email = document.getElementById("form-email").value.trim();
  const descricao = document.getElementById("form-descricao").value.trim();

  if (!titulo || !email) {
    alert("Preencha ao menos o título e o e-mail.");
    return;
  }

  const responsavel = nome ? { nome, email } : { email };

  const payload = {
    titulo,
    descricao,
    status: 1,
    unidade_conservacao: { id: currentUnit.id },
    responsavel,
  };

  const btn = document.querySelector(".btn-form-submit");
  btn.disabled = true;
  btn.textContent = "Enviando…";

  try {
    const res = await fetch(`${BASE_URL}/comunicado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || `HTTP ${res.status}`);
    }

    alert("Comunicado enviado com sucesso!");
    window.location.href = "detail.html";
  } catch (err) {
    alert(`Erro ao enviar comunicado: ${err.message}`);
    btn.disabled = false;
    btn.textContent = "Enviar";
  }
}

// ── AUTO-INIT ──────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("unit-grid")) initList();
  else if (document.getElementById("detail-hero")) initDetail();
  else if (document.getElementById("form-titulo")) initForm();
});
