const QUESTIONS = [
  "Te resulto facil encontrar la informacion principal?",
  "Usas herramientas digitales todos los dias para estudiar o trabajar?",
  "Consideras util responder encuestas breves en linea?",
  "Te gustaria recibir novedades sobre futuras investigaciones?",
  "Sentiste que el formulario fue claro y rapido de completar?",
  "Participarias nuevamente en una investigacion similar?"
];

const DEMO_STORAGE_KEY = "uade-investigacion-demo-responses";
const SUBMISSION_TOKEN_KEY = "uade-investigacion-submission-token";
const SOURCE = "github-pages";
const config = window.UADE_FORM_CONFIG || {};

const form = document.getElementById("research-form");
const questionsContainer = document.getElementById("questions");
const feedback = document.getElementById("feedback");
const clearDemoButton = document.getElementById("clear-demo-data");
const nameInput = document.getElementById("respondent-name");
const emailInput = document.getElementById("respondent-email");
const repoSyncPath = config.repoSyncPath || "data/responses.xlsx";
const eventsTableName = config.eventsTableName || "research_response_events";

const supabaseClient = createSupabaseClient();
let autosaveChain = Promise.resolve();

renderQuestions();
updateStorageStatus();
wireFormInteractions();

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

function wireFormInteractions() {
  const radioInputs = Array.from(document.querySelectorAll('input[type="radio"]'));

  radioInputs.forEach((input) => {
    input.addEventListener("change", () => {
      refreshAnswerStates(input.name);
      handleAnswerAutosave(input).catch(handleAutosaveError);
    });
  });

  [nameInput, emailInput].forEach((input) => {
    input.addEventListener("blur", () => {
      handleProfileAutosave().catch(handleAutosaveError);
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

  clearDemoButton.disabled = hasRemoteStorage() || getDemoResponses().length === 0;
}

function hasRemoteStorage() {
  return Boolean(supabaseClient);
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

async function handleAnswerAutosave(input) {
  if (!hasRemoteStorage()) {
    return;
  }

  const payload = buildEventPayload("answer", {
    questionKey: input.name,
    answer: input.value === "true"
  });

  await queueRemoteEvent(payload);
}

async function handleProfileAutosave() {
  if (!hasRemoteStorage()) {
    return;
  }

  const snapshot = readCurrentSnapshot();
  if (!snapshot.respondent_name && !snapshot.respondent_email) {
    return;
  }

  await queueRemoteEvent(buildEventPayload("profile"));
}

async function handleSubmit(event) {
  event.preventDefault();
  setLoading(true);
  hideFeedback();

  try {
    const payload = buildSubmissionPayload();

    if (hasRemoteStorage()) {
      await queueRemoteEvent(buildEventPayload("submit", { snapshot: payload }));
      showFeedback(
        `Formulario enviado. Las respuestas ya quedaron guardadas en Supabase y luego podran verse en ${repoSyncPath}.`,
        "success"
      );
    } else {
      saveDemoResponse(payload);
      showFeedback(
        "Supabase todavia no esta configurado. La respuesta completa se guardo solo como demo local en este navegador.",
        "warning"
      );
    }

    resetSubmissionToken();
    form.reset();
    refreshAnswerStates();
    updateStorageStatus();
  } catch (error) {
    console.error(error);
    showFeedback(
      "No se pudo guardar el formulario. Revisa la configuracion de Supabase o completa los campos obligatorios.",
      "error"
    );
  } finally {
    setLoading(false);
  }
}

function buildSubmissionPayload() {
  const snapshot = readCurrentSnapshot({ requireName: true, requireAllQuestions: true });
  return {
    respondent_name: snapshot.respondent_name,
    respondent_email: snapshot.respondent_email,
    q1: snapshot.answers.q1,
    q2: snapshot.answers.q2,
    q3: snapshot.answers.q3,
    q4: snapshot.answers.q4,
    q5: snapshot.answers.q5,
    q6: snapshot.answers.q6,
    source: SOURCE
  };
}

function readCurrentSnapshot(options = {}) {
  const { requireName = false, requireAllQuestions = false } = options;
  const formData = new FormData(form);
  const rawRespondentName = String(formData.get("respondent_name") || "").trim();
  const respondentName = rawRespondentName.length >= 2 ? rawRespondentName : null;
  const respondentEmail = String(formData.get("respondent_email") || "").trim() || null;
  const answers = {};

  if (requireName && rawRespondentName.length < 2) {
    throw new Error("El nombre es obligatorio.");
  }

  QUESTIONS.forEach((_, index) => {
    const field = `q${index + 1}`;
    const rawValue = formData.get(field);

    if (rawValue === "true") {
      answers[field] = true;
      return;
    }

    if (rawValue === "false") {
      answers[field] = false;
      return;
    }

    if (requireAllQuestions) {
      throw new Error(`Falta responder ${field}.`);
    }

    answers[field] = null;
  });

  return {
    respondent_name: respondentName,
    respondent_email: respondentEmail,
    answers
  };
}

function buildEventPayload(eventType, options = {}) {
  const snapshot = options.snapshot || readCurrentSnapshot();
  const payload = {
    submission_token: getOrCreateSubmissionToken(),
    event_type: eventType,
    respondent_name: snapshot.respondent_name,
    respondent_email: snapshot.respondent_email,
    question_key: null,
    answer: null,
    source: SOURCE,
    is_complete: eventType === "submit"
  };

  if (eventType === "answer") {
    payload.question_key = options.questionKey;
    payload.answer = options.answer;
  }

  return payload;
}

function queueRemoteEvent(payload) {
  autosaveChain = autosaveChain
    .catch(() => {})
    .then(async () => {
      const { error } = await supabaseClient.from(eventsTableName).insert(payload);

      if (error) {
        throw error;
      }
    });

  return autosaveChain;
}

function handleAutosaveError(error) {
  console.error(error);
  showFeedback(
    "No se pudo guardar automaticamente una respuesta. Revisa la conexion con Supabase antes de seguir.",
    "error"
  );
}

function getOrCreateSubmissionToken() {
  const savedToken = sessionStorage.getItem(SUBMISSION_TOKEN_KEY);
  if (savedToken) {
    return savedToken;
  }

  const nextToken = crypto.randomUUID();
  sessionStorage.setItem(SUBMISSION_TOKEN_KEY, nextToken);
  return nextToken;
}

function resetSubmissionToken() {
  sessionStorage.removeItem(SUBMISSION_TOKEN_KEY);
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
  resetSubmissionToken();
  updateStorageStatus();
  showFeedback("Las respuestas demo locales se eliminaron de este navegador.", "warning");
}

function setLoading(isLoading) {
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = isLoading;
  }
}

function showFeedback(message, type) {
  feedback.className = `feedback is-visible ${type}`;
  feedback.textContent = message;
}

function hideFeedback() {
  feedback.className = "feedback";
  feedback.textContent = "";
}
