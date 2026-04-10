const QUESTIONS = [
  "Te resulto facil encontrar la informacion principal?",
  "Usas herramientas digitales todos los dias para estudiar o trabajar?",
  "Consideras util responder encuestas breves en linea?",
  "Te gustaria recibir novedades sobre futuras investigaciones?",
  "Sentiste que el formulario fue claro y rapido de completar?",
  "Participarias nuevamente en una investigacion similar?"
];

const DEMO_STORAGE_KEY = "uade-investigacion-demo-responses";
const config = window.UADE_FORM_CONFIG || {};

const form = document.getElementById("research-form");
const questionsContainer = document.getElementById("questions");
const feedback = document.getElementById("feedback");
const clearDemoButton = document.getElementById("clear-demo-data");
const repoSyncPath = config.repoSyncPath || "data/responses.xlsx";

renderQuestions();
updateStorageStatus();
wireAnswerStates();

form.addEventListener("submit", handleSubmit);
clearDemoButton.addEventListener("click", clearDemoData);

function renderQuestions() {
  questionsContainer.innerHTML = QUESTIONS.map((question, index) => {
    const questionNumber = index + 1;
    const fieldName = `q${questionNumber}`;

    return `
      <fieldset class="question-card">
        <legend class="sr-only">${question}</legend>
        <p class="question-meta">Pregunta ${questionNumber}</p>
        <p class="question-text">${question}</p>
        <div class="options">
          <label class="option-pill">
            <input type="radio" name="${fieldName}" value="true" required />
            <span>Si</span>
          </label>
          <label class="option-pill">
            <input type="radio" name="${fieldName}" value="false" required />
            <span>No</span>
          </label>
        </div>
      </fieldset>
    `;
  }).join("");
}

function wireAnswerStates() {
  const radioInputs = Array.from(document.querySelectorAll('input[type="radio"]'));

  radioInputs.forEach((input) => {
    input.addEventListener("change", () => {
      refreshAnswerStates(input.name);
    });
  });
}

function refreshAnswerStates(groupName) {
  const selector = groupName ? `input[name="${groupName}"]` : 'input[type="radio"]';
  const inputs = document.querySelectorAll(selector);

  inputs.forEach((input) => {
    const pill = input.closest(".option-pill");
    pill.classList.remove("active-yes", "active-no");

    if (input.checked) {
      pill.classList.add(input.value === "true" ? "active-yes" : "active-no");
    }
  });
}

function updateStorageStatus() {
  if (!clearDemoButton) {
    return;
  }

  if (hasRemoteStorage()) {
    clearDemoButton.disabled = true;
    return;
  }

  clearDemoButton.disabled = getDemoResponses().length === 0;
}

function hasRemoteStorage() {
  return Boolean(config.supabaseUrl && config.supabasePublishableKey);
}

async function handleSubmit(event) {
  event.preventDefault();
  setLoading(true);
  hideFeedback();

  try {
    const payload = buildPayload();

    if (hasRemoteStorage()) {
      await submitToSupabase(payload);
      showFeedback(
        `Respuesta enviada correctamente. Para ver el Excel dentro de GitHub, ejecuta o espera el workflow de sincronizacion y revisa ${repoSyncPath}.`,
        "success"
      );
    } else {
      saveDemoResponse(payload);
      showFeedback(
        "Configuracion incompleta: la respuesta se guardo solo como demo local en este navegador.",
        "warning"
      );
    }

    form.reset();
    refreshAnswerStates();
    updateStorageStatus();
  } catch (error) {
    console.error(error);
    showFeedback(
      "No se pudo guardar la respuesta. Revisa docs/config.js o la configuracion de la base.",
      "error"
    );
  } finally {
    setLoading(false);
  }
}

function buildPayload() {
  const formData = new FormData(form);
  const respondentName = String(formData.get("respondent_name") || "").trim();
  const respondentEmail = String(formData.get("respondent_email") || "").trim();

  if (!respondentName) {
    throw new Error("El nombre es obligatorio.");
  }

  const payload = {
    respondent_name: respondentName,
    respondent_email: respondentEmail || null,
    source: "github-pages"
  };

  QUESTIONS.forEach((_, index) => {
    const field = `q${index + 1}`;
    const rawValue = formData.get(field);

    if (rawValue !== "true" && rawValue !== "false") {
      throw new Error(`Falta responder ${field}.`);
    }

    payload[field] = rawValue === "true";
  });

  return payload;
}

async function submitToSupabase(payload) {
  const tableName = config.tableName || "research_responses";
  const endpoint = `${trimTrailingSlash(config.supabaseUrl)}/rest/v1/${tableName}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${config.supabasePublishableKey}`,
      Prefer: "return=minimal"
    },
    body: JSON.stringify([payload])
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase error ${response.status}: ${errorText}`);
  }
}

function saveDemoResponse(payload) {
  const responses = getDemoResponses();
  responses.push({
    ...payload,
    created_at: new Date().toISOString()
  });
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(responses));
}

function getDemoResponses() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || "[]");
  } catch (error) {
    console.error(error);
    return [];
  }
}

function clearDemoData() {
  localStorage.removeItem(DEMO_STORAGE_KEY);
  updateStorageStatus();
  showFeedback("Las respuestas demo locales se eliminaron de este navegador.", "warning");
}

function setLoading(isLoading) {
  const buttons = form.querySelectorAll("button");
  buttons.forEach((button) => {
    button.disabled = isLoading;
  });
}

function showFeedback(message, type) {
  feedback.className = `feedback is-visible ${type}`;
  feedback.textContent = message;
}

function hideFeedback() {
  feedback.className = "feedback";
  feedback.textContent = "";
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
