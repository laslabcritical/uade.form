const LIKERT_OPTIONS = [
  { value: "totalmente_en_desacuerdo", label: "Totalmente en desacuerdo" },
  { value: "en_desacuerdo", label: "En desacuerdo" },
  { value: "ni_de_acuerdo_ni_en_desacuerdo", label: "Ni de acuerdo ni en desacuerdo" },
  { value: "de_acuerdo", label: "De acuerdo" },
  { value: "totalmente_de_acuerdo", label: "Totalmente de acuerdo" }
];

const SURVEY_SECTIONS = [
  {
    title: "Dimensión A. Visibilidad y presencia del fenómeno",
    questions: [
      "En los últimos años aumentaron las conversaciones sobre apuestas online entre estudiantes.",
      "Las apuestas online forman parte de la cultura digital adolescente actual.",
      "Los videojuegos y las apuestas aparecen cada vez más mezclados entre sí.",
      "Los estudiantes naturalizan las apuestas deportivas.",
      "Las apuestas online aparecen con frecuencia en redes sociales utilizadas por adolescentes.",
      "Los estudiantes hablan de apuestas o casinos online dentro de la escuela."
    ].map((text, index) => createLikertQuestion(`a${index + 1}`, text))
  },
  {
    title: "Dimensión B. Impacto escolar y subjetivo",
    questions: [
      "Las apuestas online pueden afectar el rendimiento académico.",
      "El uso problemático de apuestas o videojuegos puede alterar el descanso y la atención de los estudiantes.",
      "He observado estudiantes con ansiedad o irritabilidad vinculadas al juego o las apuestas.",
      "Algunos estudiantes utilizan el juego o las apuestas como forma de escape emocional.",
      "Las apuestas online pueden afectar los vínculos entre compañeros.",
      "Las deudas o intercambios de dinero entre estudiantes representan un problema creciente."
    ].map((text, index) => createLikertQuestion(`b${index + 1}`, text))
  },
  {
    title: "Dimensión C. Vulnerabilidad y factores sociales",
    questions: [
      "Los influencers y streamers favorecen la normalización de las apuestas.",
      "La publicidad de apuestas online influye sobre adolescentes.",
      "El fácil acceso a billeteras virtuales facilita el ingreso temprano a las apuestas.",
      "La necesidad de pertenencia grupal puede favorecer el ingreso al juego.",
      "Los adolescentes tienen más acceso a plataformas de apuestas del que las personas adultas creen.",
      "La problemática debe pensarse más allá de la responsabilidad individual del estudiante."
    ].map((text, index) => createLikertQuestion(`c${index + 1}`, text))
  },
  {
    title: "Dimensión D. Formación docente y respuesta institucional",
    questions: [
      "Me siento preparado/a para detectar señales de juego problemático en estudiantes.",
      "La escuela debería trabajar pedagógicamente la problemática de apuestas online.",
      "Las instituciones educativas actualmente cuentan con herramientas suficientes para intervenir.",
      "Sería importante incorporar capacitaciones específicas sobre apuestas online y consumos digitales.",
      "La intervención frente a estas situaciones debería involucrar también a las familias.",
      "El trabajo interdisciplinario es necesario para abordar esta problemática.",
      "Considero importante contar con protocolos institucionales específicos."
    ].map((text, index) => createLikertQuestion(`d${index + 1}`, text))
  },
  {
    title: "Dimensión E. Experiencia directa",
    questions: [
      "He observado estudiantes utilizando plataformas de apuestas.",
      "He escuchado conversaciones sobre apuestas deportivas dentro de la institución.",
      "He observado estudiantes realizando compras frecuentes dentro de videojuegos.",
      "He detectado preocupación familiar vinculada al uso problemático del juego.",
      "Considero que esta problemática aumentó durante los últimos años."
    ].map((text, index) => createLikertQuestion(`e${index + 1}`, text))
  },
  {
    title: "Preguntas de cierre cuantitativo",
    questions: [
      createChoiceQuestion(
        "cierre1",
        "¿Ha recibido capacitación específica sobre apuestas online o consumos problemáticos?",
        ["Sí", "No"]
      ),
      createChoiceQuestion(
        "cierre2",
        "¿Su institución cuenta con protocolos específicos sobre esta temática?",
        ["Sí", "No", "No sabe"]
      ),
      createChoiceQuestion(
        "cierre3",
        "¿Qué rol ocupa en la institución?",
        ["Docente", "Directivo/a", "Preceptor/a", "Equipo de orientación", "Otro"]
      ),
      createChoiceQuestion(
        "cierre4",
        "Nivel educativo alcanzado",
        ["Primario", "Secundario", "Otro"]
      ),
      createChoiceQuestion(
        "cierre5",
        "Nivel educativo donde enseña",
        ["Primaria", "Secundaria"]
      )
    ]
  }
];

const QUESTIONS = SURVEY_SECTIONS.flatMap((section) => section.questions);
QUESTIONS.forEach((question, index) => {
  question.number = index + 1;
});
const QUESTION_BY_KEY = Object.fromEntries(QUESTIONS.map((question) => [question.key, question]));
const SUBMISSION_TOKEN_KEY = "uade-investigacion-submission-token";
const SOURCE = "github-pages";
const config = window.UADE_FORM_CONFIG || {};

const consentScreen = document.getElementById("consent-screen");
const declinedScreen = document.getElementById("declined-screen");
const completedScreen = document.getElementById("completed-screen");
const surveyShell = document.getElementById("survey-shell");
const acceptConsentButton = document.getElementById("accept-consent");
const declineConsentButton = document.getElementById("decline-consent");
const form = document.getElementById("research-form");
const questionsContainer = document.getElementById("questions");
const progress = document.getElementById("survey-progress");
const helper = document.getElementById("survey-helper");
const feedback = document.getElementById("feedback");
const previousButton = document.getElementById("previous-section");
const nextButton = document.getElementById("next-section");
const submitButton = document.getElementById("submit-form");
const eventsTableName = config.eventsTableName || "research_response_events";

const supabaseClient = createSupabaseClient();
let autosaveChain = Promise.resolve();
let currentSectionIndex = 0;
let isSurveyReady = false;

acceptConsentButton.addEventListener("click", acceptConsent);
declineConsentButton.addEventListener("click", declineConsent);
form.addEventListener("submit", handleSubmit);
previousButton.addEventListener("click", showPreviousSection);
nextButton.addEventListener("click", showNextSection);

function createLikertQuestion(key, text) {
  return {
    key,
    text,
    type: "likert",
    options: LIKERT_OPTIONS
  };
}

function createChoiceQuestion(key, text, labels) {
  return {
    key,
    text,
    type: "choice",
    options: labels.map((label) => ({
      value: slugify(label),
      label
    }))
  };
}

function acceptConsent() {
  consentScreen.hidden = true;
  declinedScreen.hidden = true;
  completedScreen.hidden = true;
  surveyShell.hidden = false;
  initializeSurvey();
  scrollToSurveyStart();
}

function declineConsent() {
  consentScreen.hidden = true;
  surveyShell.hidden = true;
  completedScreen.hidden = true;
  declinedScreen.hidden = false;
  resetSubmissionToken();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initializeSurvey() {
  if (isSurveyReady) {
    return;
  }

  renderQuestions();
  wireFormInteractions();
  updatePagination();
  isSurveyReady = true;
}

function renderQuestions() {
  questionsContainer.innerHTML = SURVEY_SECTIONS.map((section, sectionIndex) => `
    <section class="survey-section" aria-labelledby="section-${sectionIndex + 1}">
      <h2 id="section-${sectionIndex + 1}">${escapeHtml(section.title)}</h2>
      <div class="section-questions">
        ${section.questions.map(renderQuestion).join("")}
      </div>
    </section>
  `).join("");
}

function renderQuestion(question) {
  if (question.type === "text") {
    return renderTextQuestion(question);
  }

  return renderRadioQuestion(question);
}

function renderRadioQuestion(question) {
  const optionClass = question.type === "likert" ? "likert-options" : "choice-options";

  return `
    <fieldset class="question-card">
      <legend class="sr-only">${escapeHtml(question.text)}</legend>
      <p class="question-meta">Pregunta ${question.number}</p>
      <p class="question-text">${escapeHtml(question.text)}</p>
      <div class="options ${optionClass}">
        ${question.options.map((option) => `
          <label class="option-pill">
            <input
              type="radio"
              name="${question.key}"
              value="${escapeHtml(option.value)}"
              required
            />
            <span>${escapeHtml(option.label)}</span>
          </label>
        `).join("")}
      </div>
    </fieldset>
  `;
}

function renderTextQuestion(question) {
  return `
    <fieldset class="question-card">
      <legend class="sr-only">${escapeHtml(question.text)}</legend>
      <p class="question-meta">Pregunta ${question.number}</p>
      <label class="field text-question">
        <span>${escapeHtml(question.text)}</span>
        <input
          type="text"
          name="${question.key}"
          placeholder="${escapeHtml(question.placeholder)}"
          required
        />
      </label>
    </fieldset>
  `;
}

function wireFormInteractions() {
  const radioInputs = Array.from(document.querySelectorAll('input[type="radio"]'));
  const textInputs = Array.from(document.querySelectorAll('input[type="text"]'));

  radioInputs.forEach((input) => {
    input.addEventListener("change", () => {
      refreshAnswerStates(input.name);
      handleAnswerAutosave(input.name, input.value).catch(handleAutosaveError);
    });
  });

  textInputs.forEach((input) => {
    input.addEventListener("blur", () => {
      const value = input.value.trim();
      if (value) {
        handleAnswerAutosave(input.name, value).catch(handleAutosaveError);
      }
    });
  });
}

function showPreviousSection() {
  if (currentSectionIndex === 0) {
    return;
  }

  currentSectionIndex -= 1;
  updatePagination();
  hideFeedback();
  scrollToFormTop();
}

function showNextSection() {
  const missingQuestion = getFirstMissingQuestion(SURVEY_SECTIONS[currentSectionIndex]);

  if (missingQuestion) {
    focusQuestion(missingQuestion);
    showFeedback("Respondé todas las preguntas de esta dimensión para continuar.", "warning");
    return;
  }

  if (currentSectionIndex >= SURVEY_SECTIONS.length - 1) {
    return;
  }

  currentSectionIndex += 1;
  updatePagination();
  hideFeedback();
  scrollToFormTop();
}

function updatePagination() {
  const sections = Array.from(document.querySelectorAll(".survey-section"));
  const isFirstSection = currentSectionIndex === 0;
  const isLastSection = currentSectionIndex === SURVEY_SECTIONS.length - 1;
  const currentSection = SURVEY_SECTIONS[currentSectionIndex];

  sections.forEach((section, index) => {
    const isCurrent = index === currentSectionIndex;
    section.hidden = !isCurrent;
    section.setAttribute("aria-hidden", String(!isCurrent));
  });

  progress.innerHTML = `
    <span>Paso ${currentSectionIndex + 1} de ${SURVEY_SECTIONS.length}</span>
    <strong>${escapeHtml(currentSection.title)}</strong>
  `;
  previousButton.hidden = isFirstSection;
  nextButton.hidden = isLastSection;
  submitButton.hidden = !isLastSection;
  helper.textContent = isLastSection
    ? "Revisá la última sección y enviá la encuesta cuando esté completa."
    : "Completá esta dimensión para avanzar.";
}

function getFirstMissingQuestion(section) {
  const formData = new FormData(form);

  return section.questions.find((question) => {
    const value = String(formData.get(question.key) || "").trim();
    return !value;
  });
}

function getFirstMissingQuestionInSurvey() {
  for (let sectionIndex = 0; sectionIndex < SURVEY_SECTIONS.length; sectionIndex += 1) {
    const question = getFirstMissingQuestion(SURVEY_SECTIONS[sectionIndex]);

    if (question) {
      return { question, sectionIndex };
    }
  }

  return null;
}

function focusQuestion(question) {
  const field = form.elements[question.key];

  if (!field) {
    return;
  }

  const element = field instanceof RadioNodeList ? field[0] : field;
  element?.closest(".question-card")?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
  element?.focus({ preventScroll: true });
}

function scrollToFormTop() {
  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function scrollToSurveyStart() {
  surveyShell.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function refreshAnswerStates(groupName) {
  const selector = groupName ? `input[name="${groupName}"]` : 'input[type="radio"]';
  const inputs = document.querySelectorAll(selector);

  inputs.forEach((input) => {
    const pill = input.closest(".option-pill");
    pill.classList.toggle("is-selected", input.checked);
  });
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

async function handleAnswerAutosave(questionKey, answerValue) {
  if (!hasRemoteStorage()) {
    return;
  }

  if (!QUESTION_BY_KEY[questionKey]) {
    throw new Error(`Pregunta desconocida: ${questionKey}`);
  }

  const payload = buildEventPayload("answer", {
    questionKey,
    answerValue
  });

  await queueRemoteEvent(payload);
}

async function handleSubmit(event) {
  event.preventDefault();
  hideFeedback();

  const missing = getFirstMissingQuestionInSurvey();
  if (missing) {
    currentSectionIndex = missing.sectionIndex;
    updatePagination();
    focusQuestion(missing.question);
    showFeedback("Completá todas las preguntas antes de enviar la encuesta.", "warning");
    return;
  }

  setLoading(true);

  try {
    const payload = buildSubmissionPayload();

    if (hasRemoteStorage()) {
      await queueRemoteEvent(buildEventPayload("submit", { snapshot: payload }));
    } else {
      saveDemoResponse(payload);
    }

    resetSubmissionToken();
    form.reset();
    refreshAnswerStates();
    currentSectionIndex = 0;
    updatePagination();
    showCompletedScreen();
  } catch (error) {
    console.error(error);
    showFeedback(
      "No se pudo guardar el formulario. Revisá la configuración de Supabase o completá todos los campos obligatorios.",
      "error"
    );
  } finally {
    setLoading(false);
  }
}

function showCompletedScreen() {
  consentScreen.hidden = true;
  declinedScreen.hidden = true;
  surveyShell.hidden = true;
  completedScreen.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildSubmissionPayload() {
  const snapshot = readCurrentSnapshot({ requireAllQuestions: true });

  return {
    answers: snapshot.answers,
    source: SOURCE
  };
}

function readCurrentSnapshot(options = {}) {
  const { requireAllQuestions = false } = options;
  const formData = new FormData(form);
  const answers = {};

  QUESTIONS.forEach((question) => {
    const rawValue = formData.get(question.key);
    const value = String(rawValue || "").trim();

    if (!value) {
      if (requireAllQuestions) {
        throw new Error(`Falta responder ${question.key}.`);
      }

      answers[question.key] = null;
      return;
    }

    answers[question.key] = value;
  });

  return { answers };
}

function buildEventPayload(eventType, options = {}) {
  const payload = {
    submission_token: getOrCreateSubmissionToken(),
    event_type: eventType,
    question_key: null,
    answer_value: null,
    answers: null,
    source: SOURCE,
    is_complete: eventType === "submit"
  };

  if (eventType === "answer") {
    payload.question_key = options.questionKey;
    payload.answer_value = options.answerValue;
  }

  if (eventType === "submit") {
    payload.answers = options.snapshot.answers;
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
    "No se pudo guardar automáticamente una respuesta. Revisá la conexión con Supabase antes de seguir.",
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
  console.info("Respuesta sin Supabase:", {
    ...payload,
    created_at: new Date().toISOString()
  });
}

function setLoading(isLoading) {
  if (submitButton) {
    submitButton.disabled = isLoading;
  }

  [previousButton, nextButton].forEach((button) => {
    if (button) {
      button.disabled = isLoading;
    }
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

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
