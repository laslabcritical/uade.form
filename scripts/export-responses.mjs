import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "research_responses";
const PAGE_SIZE = 1000;

const COLUMNS = [
  { key: "id", header: "ID", width: 38 },
  { key: "last_saved_at", header: "Ultimo guardado", width: 28 },
  { key: "submitted_at", header: "Enviado", width: 28 },
  { key: "respondent_name", header: "Nombre", width: 26 },
  { key: "respondent_email", header: "Email", width: 30 },
  { key: "q1", header: "Pregunta 1", width: 14 },
  { key: "q2", header: "Pregunta 2", width: 14 },
  { key: "q3", header: "Pregunta 3", width: 14 },
  { key: "q4", header: "Pregunta 4", width: 14 },
  { key: "q5", header: "Pregunta 5", width: 14 },
  { key: "q6", header: "Pregunta 6", width: 14 },
  { key: "completed", header: "Completo", width: 12 },
  { key: "source", header: "Origen", width: 18 }
];

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "data");

const records = await fetchAllRows();
await fs.mkdir(outputDir, { recursive: true });

const normalizedRecords = records.map((record) => ({
  id: record.id,
  last_saved_at: record.last_saved_at,
  submitted_at: record.submitted_at || "",
  respondent_name: record.respondent_name || "",
  respondent_email: record.respondent_email || "",
  q1: booleanToSiNo(record.q1),
  q2: booleanToSiNo(record.q2),
  q3: booleanToSiNo(record.q3),
  q4: booleanToSiNo(record.q4),
  q5: booleanToSiNo(record.q5),
  q6: booleanToSiNo(record.q6),
  completed: record.completed ? "Si" : "No",
  source: record.source || ""
}));

await fs.writeFile(
  path.join(outputDir, "responses.json"),
  JSON.stringify(normalizedRecords, null, 2) + "\n",
  "utf8"
);

await writeWorkbook(normalizedRecords);
await fs.writeFile(path.join(outputDir, "responses.csv"), createCsv(normalizedRecords), "utf8");

console.log(`Exportadas ${normalizedRecords.length} respuestas a ${outputDir}`);

async function fetchAllRows() {
  const allRows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select("*")
      .order("last_saved_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`No se pudieron leer respuestas de Supabase: ${error.message}`);
    }

    allRows.push(...data);

    if (data.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return allRows;
}

async function writeWorkbook(rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Respuestas");
  worksheet.columns = COLUMNS;

  rows.forEach((row) => {
    worksheet.addRow(row);
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  await workbook.xlsx.writeFile(path.join(outputDir, "responses.xlsx"));
}

function createCsv(rows) {
  const header = COLUMNS.map((column) => escapeCsv(column.header)).join(",");
  const body = rows.map((row) => {
    return COLUMNS.map((column) => escapeCsv(row[column.key] ?? "")).join(",");
  });

  return [header, ...body].join("\n") + "\n";
}

function escapeCsv(value) {
  const normalized = String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }
  return normalized;
}

function booleanToSiNo(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return value ? "Si" : "No";
}
