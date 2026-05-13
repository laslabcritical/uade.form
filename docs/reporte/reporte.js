const LIKERT_OPTIONS = [
  {
    value: "totalmente_en_desacuerdo",
    label: "Totalmente en desacuerdo",
    shortLabel: "Total desac.",
    score: 1
  },
  {
    value: "en_desacuerdo",
    label: "En desacuerdo",
    shortLabel: "Desacuerdo",
    score: 2
  },
  {
    value: "ni_de_acuerdo_ni_en_desacuerdo",
    label: "Ni de acuerdo ni en desacuerdo",
    shortLabel: "Neutral",
    score: 3
  },
  {
    value: "de_acuerdo",
    label: "De acuerdo",
    shortLabel: "Acuerdo",
    score: 4
  },
  {
    value: "totalmente_de_acuerdo",
    label: "Totalmente de acuerdo",
    shortLabel: "Total acuerdo",
    score: 5
  }
];

const DIMENSIONS = [
  {
    key: "a",
    title: "Visibilidad y presencia del fenómeno",
    questions: [
      "En los últimos años aumentaron las conversaciones sobre apuestas online entre estudiantes.",
      "Las apuestas online forman parte de la cultura digital adolescente actual.",
      "Los videojuegos y las apuestas aparecen cada vez más mezclados entre sí.",
      "Los estudiantes naturalizan las apuestas deportivas.",
      "Las apuestas online aparecen con frecuencia en redes sociales utilizadas por adolescentes.",
      "Los estudiantes hablan de apuestas o casinos online dentro de la escuela."
    ]
  },
  {
    key: "b",
    title: "Impacto escolar y subjetivo",
    questions: [
      "Las apuestas online pueden afectar el rendimiento académico.",
      "El uso problemático de apuestas o videojuegos puede alterar el descanso y la atención de los estudiantes.",
      "He observado estudiantes con ansiedad o irritabilidad vinculadas al juego o las apuestas.",
      "Algunos estudiantes utilizan el juego o las apuestas como forma de escape emocional.",
      "Las apuestas online pueden afectar los vínculos entre compañeros.",
      "Las deudas o intercambios de dinero entre estudiantes representan un problema creciente."
    ]
  },
  {
    key: "c",
    title: "Vulnerabilidad y factores sociales",
    questions: [
      "Los influencers y streamers favorecen la normalización de las apuestas.",
      "La publicidad de apuestas online influye sobre adolescentes.",
      "El fácil acceso a billeteras virtuales facilita el ingreso temprano a las apuestas.",
      "La necesidad de pertenencia grupal puede favorecer el ingreso al juego.",
      "Los adolescentes tienen más acceso a plataformas de apuestas del que las personas adultas creen.",
      "La problemática debe pensarse más allá de la responsabilidad individual del estudiante."
    ]
  },
  {
    key: "d",
    title: "Formación docente y respuesta institucional",
    questions: [
      "Me siento preparado/a para detectar señales de juego problemático en estudiantes.",
      "La escuela debería trabajar pedagógicamente la problemática de apuestas online.",
      "Las instituciones educativas actualmente cuentan con herramientas suficientes para intervenir.",
      "Sería importante incorporar capacitaciones específicas sobre apuestas online y consumos digitales.",
      "La intervención frente a estas situaciones debería involucrar también a las familias.",
      "El trabajo interdisciplinario es necesario para abordar esta problemática.",
      "Considero importante contar con protocolos institucionales específicos."
    ]
  },
  {
    key: "e",
    title: "Experiencia directa",
    questions: [
      "He observado estudiantes utilizando plataformas de apuestas.",
      "He escuchado conversaciones sobre apuestas deportivas dentro de la institución.",
      "He observado estudiantes realizando compras frecuentes dentro de videojuegos.",
      "He detectado preocupación familiar vinculada al uso problemático del juego.",
      "Considero que esta problemática aumentó durante los últimos años."
    ]
  }
];

const CLOSING_QUESTIONS = [
  {
    key: "cierre1",
    text: "¿Ha recibido capacitación específica sobre apuestas online o consumos problemáticos?",
    options: [
      { value: "si", label: "Sí" },
      { value: "no", label: "No" }
    ]
  },
  {
    key: "cierre2",
    text: "¿Su institución cuenta con protocolos específicos sobre esta temática?",
    options: [
      { value: "si", label: "Sí" },
      { value: "no", label: "No" },
      { value: "no_sabe", label: "No sabe" }
    ]
  },
  {
    key: "cierre3",
    text: "¿Qué rol ocupa en la institución?",
    options: [
      { value: "docente", label: "Docente" },
      { value: "directivo_a", label: "Directivo/a" },
      { value: "preceptor_a", label: "Preceptor/a" },
      { value: "equipo_de_orientacion", label: "Equipo de orientación" },
      { value: "otro", label: "Otro" }
    ]
  },
  {
    key: "cierre4",
    text: "Nivel educativo alcanzado",
    options: [
      { value: "primario", label: "Primario" },
      { value: "secundario", label: "Secundario" },
      { value: "otro", label: "Otro" }
    ]
  },
  {
    key: "cierre5",
    text: "Nivel educativo donde enseña",
    options: [
      { value: "primaria", label: "Primaria" },
      { value: "secundaria", label: "Secundaria" }
    ]
  }
];

const LIKERT_QUESTIONS = DIMENSIONS.flatMap((dimension) =>
  dimension.questions.map((text, index) => ({
    key: `${dimension.key}${index + 1}`,
    dimensionKey: dimension.key,
    dimensionTitle: dimension.title,
    text,
    type: "likert"
  }))
);

const QUESTIONS = [
  ...LIKERT_QUESTIONS,
  ...CLOSING_QUESTIONS.map((question) => ({
    ...question,
    type: "choice"
  }))
];

const QUESTION_BY_KEY = Object.fromEntries(QUESTIONS.map((question) => [question.key, question]));
const LIKERT_BY_VALUE = Object.fromEntries(LIKERT_OPTIONS.map((option) => [option.value, option]));
const REFRESH_INTERVAL_MS = 30000;
const config = window.UADE_FORM_CONFIG || {};

const statusBanner = document.getElementById("status-banner");
const refreshMeta = document.getElementById("refresh-meta");
const refreshButton = document.getElementById("refresh-report");
const kpiGrid = document.getElementById("kpi-grid");
const funnelChart = document.getElementById("funnel-chart");
const dimensionChart = document.getElementById("dimension-chart");
const rankingChart = document.getElementById("ranking-chart");
const choiceChart = document.getElementById("choice-chart");
const heatmap = document.getElementById("heatmap");

let supabaseClient = null;
let refreshTimer = null;
let realtimeRefreshTimer = null;

refreshButton.addEventListener("click", () => {
  loadReport({ showLoading: true });
});

initializeReport();

function initializeReport() {
  supabaseClient = createSupabaseClient();

  if (!supabaseClient) {
    showError("No se encontró la configuración de Supabase para leer el reporte.");
    renderEmptyReport();
    return;
  }

  loadReport({ showLoading: true });
  refreshTimer = window.setInterval(() => {
    loadReport({ showLoading: false });
  }, REFRESH_INTERVAL_MS);
  subscribeToInserts();
}

async function loadReport(options = {}) {
  const { showLoading = false } = options;

  if (showLoading) {
    setStatus("Cargando datos agregados...");
  }

  setLoading(true);

  try {
    const [totalsResult, dimensionsResult, distributionResult] = await Promise.all([
      supabaseClient.from("research_report_totals").select("*").maybeSingle(),
      supabaseClient.from("research_report_dimension_scores").select("*"),
      supabaseClient.from("research_report_answer_distribution").select("*")
    ]);

    const error = totalsResult.error || dimensionsResult.error || distributionResult.error;
    if (error) {
      throw error;
    }

    const totals = normalizeTotals(totalsResult.data);
    const dimensions = dimensionsResult.data || [];
    const distributions = distributionResult.data || [];
    const questionStats = buildQuestionStats(distributions);

    renderKpis(totals);
    renderFunnel(totals);
    renderDimensions(dimensions);
    renderRanking(questionStats);
    renderChoices(questionStats);
    renderHeatmap(questionStats);
    setStatus("Reporte actualizado con datos agregados.");
    refreshMeta.textContent = `Actualizado ${formatTime(new Date())}`;
  } catch (error) {
    console.error(error);
    showError(
      "No se pudo leer el reporte. Verificá que las vistas agregadas del SQL estén aplicadas en Supabase."
    );
  } finally {
    setLoading(false);
  }
}

function createSupabaseClient() {
  const clientFactory = window.supabase?.createClient;
  const publicKey = config.supabasePublishableKey;

  if (!clientFactory || !config.supabaseUrl || !publicKey) {
    return null;
  }

  return clientFactory(config.supabaseUrl, publicKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

function subscribeToInserts() {
  const eventsTableName = config.eventsTableName || "research_response_events";

  supabaseClient
    .channel("research-report-live-refresh")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: eventsTableName },
      () => {
        window.clearTimeout(realtimeRefreshTimer);
        realtimeRefreshTimer = window.setTimeout(() => {
          loadReport({ showLoading: false });
        }, 700);
      }
    )
    .subscribe();
}

function normalizeTotals(totals = {}) {
  const started = toNumber(totals.started_responses);
  const completed = toNumber(totals.completed_responses);
  const answered = toNumber(totals.answered_responses);

  return {
    startedResponses: started,
    answeredResponses: answered,
    completedResponses: completed,
    inProgressResponses: Math.max(started - completed, 0),
    completionRate: toNumber(totals.completion_rate)
  };
}

function buildQuestionStats(rows) {
  const grouped = rows.reduce((accumulator, row) => {
    const questionKey = row.question_key;
    const answerValue = row.answer_value;

    if (!questionKey || !answerValue) {
      return accumulator;
    }

    if (!accumulator[questionKey]) {
      accumulator[questionKey] = {};
    }

    accumulator[questionKey][answerValue] = toNumber(row.response_count);
    return accumulator;
  }, {});

  return QUESTIONS.map((question) => {
    const counts = grouped[question.key] || {};
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

    if (question.type === "likert") {
      const weightedScore = LIKERT_OPTIONS.reduce((sum, option) => {
        return sum + toNumber(counts[option.value]) * option.score;
      }, 0);
      const agreementCount =
        toNumber(counts.de_acuerdo) + toNumber(counts.totalmente_de_acuerdo);

      return {
        ...question,
        counts,
        total,
        average: total > 0 ? weightedScore / total : 0,
        agreementRate: total > 0 ? (agreementCount / total) * 100 : 0
      };
    }

    return {
      ...question,
      counts,
      total
    };
  });
}

function renderKpis(totals) {
  const kpis = [
    {
      label: "Respuestas iniciadas",
      value: formatInteger(totals.startedResponses),
      note: "Tokens únicos registrados"
    },
    {
      label: "Con al menos una respuesta",
      value: formatInteger(totals.answeredResponses),
      note: "Formularios con avance"
    },
    {
      label: "Completadas",
      value: formatInteger(totals.completedResponses),
      note: "Envíos finalizados"
    },
    {
      label: "Tasa de finalización",
      value: formatPercent(totals.completionRate),
      note: `${formatInteger(totals.inProgressResponses)} en progreso`
    }
  ];

  kpiGrid.innerHTML = kpis
    .map(
      (kpi) => `
        <article class="kpi-card">
          <p class="kpi-label">${escapeHtml(kpi.label)}</p>
          <p class="kpi-value">${escapeHtml(kpi.value)}</p>
          <p class="kpi-note">${escapeHtml(kpi.note)}</p>
        </article>
      `
    )
    .join("");
}

function renderFunnel(totals) {
  const stages = [
    {
      label: "Iniciadas",
      value: totals.startedResponses,
      note: "Total de formularios abiertos"
    },
    {
      label: "Con respuestas",
      value: totals.answeredResponses,
      note: "Tienen al menos una respuesta guardada"
    },
    {
      label: "Completadas",
      value: totals.completedResponses,
      note: "Llegaron al envío final"
    }
  ];
  const maxValue = Math.max(...stages.map((stage) => stage.value), 1);

  funnelChart.innerHTML = stages
    .map((stage) => {
      const width = Math.max((stage.value / maxValue) * 100, stage.value > 0 ? 6 : 0);
      return `
        <div class="funnel-row">
          <div class="row-top">
            <span class="row-label">${escapeHtml(stage.label)}</span>
            <span class="chart-value">${formatInteger(stage.value)}</span>
          </div>
          <div class="bar-track" aria-hidden="true">
            <span class="bar-fill" style="--bar-width: ${width}%;"></span>
          </div>
          <p class="bar-note">${escapeHtml(stage.note)}</p>
        </div>
      `;
    })
    .join("");
}

function renderDimensions(rows) {
  const byKey = Object.fromEntries(rows.map((row) => [row.dimension_key, row]));

  dimensionChart.innerHTML = DIMENSIONS.map((dimension) => {
    const row = byKey[dimension.key] || {};
    const average = toNumber(row.average_score);
    const answeredCount = toNumber(row.answered_count);
    const agreementRate = toNumber(row.agreement_rate);
    const width = average > 0 ? (average / 5) * 100 : 0;

    return `
      <div class="dimension-row">
        <div class="row-top">
          <span class="row-label">${escapeHtml(dimension.title)}</span>
          <span class="chart-value">${formatDecimal(average)} / 5</span>
        </div>
        <div class="bar-track" aria-hidden="true">
          <span class="bar-fill" style="--bar-width: ${width}%;"></span>
        </div>
        <p class="bar-note">
          ${formatInteger(answeredCount)} respuestas · ${formatPercent(agreementRate)} de acuerdo
        </p>
      </div>
    `;
  }).join("");
}

function renderRanking(questionStats) {
  const rankedQuestions = questionStats
    .filter((question) => question.type === "likert" && question.total > 0)
    .sort((first, second) => second.average - first.average)
    .slice(0, 8);

  if (rankedQuestions.length === 0) {
    rankingChart.innerHTML = `<p class="empty-state">Todavía no hay respuestas Likert para calcular el ranking.</p>`;
    return;
  }

  rankingChart.innerHTML = rankedQuestions
    .map((question) => {
      const width = (question.average / 5) * 100;

      return `
        <div class="ranking-row">
          <div class="row-top">
            <span class="row-label">${escapeHtml(question.key.toUpperCase())}. ${escapeHtml(question.text)}</span>
            <span class="chart-value">${formatDecimal(question.average)}</span>
          </div>
          <div class="bar-track" aria-hidden="true">
            <span class="bar-fill" style="--bar-width: ${width}%;"></span>
          </div>
          <p class="bar-note">
            ${formatPercent(question.agreementRate)} de acuerdo · ${formatInteger(question.total)} respuestas
          </p>
        </div>
      `;
    })
    .join("");
}

function renderChoices(questionStats) {
  const closingStats = questionStats.filter((question) => question.type === "choice");

  choiceChart.innerHTML = closingStats
    .map((question) => {
      const knownOptions = question.options || [];
      const extraOptions = Object.keys(question.counts)
        .filter((value) => !knownOptions.some((option) => option.value === value))
        .map((value) => ({ value, label: humanizeValue(value) }));
      const options = [...knownOptions, ...extraOptions];

      const optionBars = options
        .map((option) => {
          const count = toNumber(question.counts[option.value]);
          const percent = question.total > 0 ? (count / question.total) * 100 : 0;

          return `
            <div class="choice-option">
              <div class="row-top">
                <span class="row-label">${escapeHtml(option.label)}</span>
                <span class="chart-value">${formatPercent(percent)}</span>
              </div>
              <div class="bar-track" aria-hidden="true">
                <span class="bar-fill" style="--bar-width: ${percent}%;"></span>
              </div>
            </div>
          `;
        })
        .join("");

      return `
        <section class="choice-block">
          <p class="choice-title">${escapeHtml(question.text)}</p>
          <p class="choice-total">${formatInteger(question.total)} respuestas</p>
          ${optionBars || `<p class="empty-state">Sin respuestas registradas.</p>`}
        </section>
      `;
    })
    .join("");
}

function renderHeatmap(questionStats) {
  const likertStats = questionStats.filter((question) => question.type === "likert");
  const headerCells = [
    "Pregunta",
    ...LIKERT_OPTIONS.map((option) => option.shortLabel),
    "Total"
  ];

  const rows = likertStats
    .map((question) => {
      const optionCells = LIKERT_OPTIONS.map((option, optionIndex) => {
        const count = toNumber(question.counts[option.value]);
        const percent = question.total > 0 ? (count / question.total) * 100 : 0;
        const background = getHeatBackground(optionIndex, percent);

        return `
          <div class="heatmap-cell heat-value" style="background: ${background};">
            <span>${formatPercent(percent)}</span>
            <span class="heat-count">${formatInteger(count)}</span>
          </div>
        `;
      }).join("");

      return `
        <div class="heatmap-cell heatmap-question">
          <span class="question-key">${escapeHtml(question.key)}</span>
          <span class="question-text">${escapeHtml(question.text)}</span>
          <span class="question-meta">${escapeHtml(question.dimensionTitle)}</span>
        </div>
        ${optionCells}
        <div class="heatmap-cell heat-value">
          <span>${formatInteger(question.total)}</span>
          <span class="heat-count">resp.</span>
        </div>
      `;
    })
    .join("");

  heatmap.innerHTML = `
    ${headerCells
      .map((label) => `<div class="heatmap-cell header-cell">${escapeHtml(label)}</div>`)
      .join("")}
    ${rows}
  `;
}

function renderEmptyReport() {
  kpiGrid.innerHTML = "";
  funnelChart.innerHTML = `<p class="empty-state">Sin datos para mostrar.</p>`;
  dimensionChart.innerHTML = `<p class="empty-state">Sin datos para mostrar.</p>`;
  rankingChart.innerHTML = `<p class="empty-state">Sin datos para mostrar.</p>`;
  choiceChart.innerHTML = `<p class="empty-state">Sin datos para mostrar.</p>`;
  heatmap.innerHTML = "";
}

function getHeatBackground(optionIndex, percent) {
  const alpha = Math.min(0.12 + percent / 100 * 0.72, 0.84).toFixed(2);

  if (optionIndex <= 1) {
    return `rgba(173, 79, 89, ${alpha})`;
  }

  if (optionIndex === 2) {
    return `rgba(83, 97, 110, ${Math.min(0.1 + percent / 100 * 0.5, 0.6).toFixed(2)})`;
  }

  return `rgba(37, 107, 99, ${alpha})`;
}

function setStatus(message) {
  statusBanner.className = "status-banner";
  statusBanner.textContent = message;
}

function showError(message) {
  statusBanner.className = "status-banner is-error";
  statusBanner.textContent = message;
}

function setLoading(isLoading) {
  refreshButton.disabled = isLoading;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatInteger(value) {
  return Math.round(toNumber(value)).toLocaleString("es-AR");
}

function formatDecimal(value) {
  return toNumber(value).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPercent(value) {
  return `${toNumber(value).toLocaleString("es-AR", {
    maximumFractionDigits: 1
  })}%`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function humanizeValue(value) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.addEventListener("beforeunload", () => {
  window.clearInterval(refreshTimer);
  window.clearTimeout(realtimeRefreshTimer);
});
