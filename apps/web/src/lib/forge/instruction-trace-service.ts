import type { Locale } from "@cyclewarden/i18n";

import { createSql } from "@/lib/db";
import type { ForgeActor } from "./actor";

export interface ForgeInstructionTraceView {
  interfaceLocale: Locale;
  instructionLanguage: Locale;
  technicalOutputLanguage: Locale;
  originalInstruction: string;
  normalizedObjective: string;
}

interface InstructionTraceRow {
  interface_locale: Locale;
  instruction_language: Locale;
  technical_output_language: Locale;
  original_instruction: string;
  normalized_objective: string;
}

export async function getForgeInstructionTrace(
  actor: ForgeActor,
  runId: string,
): Promise<ForgeInstructionTraceView> {
  const sql = createSql();
  if (!sql) {
    throw new Error("Durable instruction trace requires PostgreSQL.");
  }

  const rows = await sql<InstructionTraceRow[]>`
    SELECT p.interface_locale, t.instruction_language,
           t.technical_output_language, t.original_instruction,
           t.normalized_objective
    FROM forge_runs r
    JOIN forge_tasks t ON t.id = r.task_id
    JOIN forge_projects p ON p.id = t.project_id
    JOIN forge_workspace_members m ON m.workspace_id = r.workspace_id
    WHERE r.id = ${runId}::uuid
      AND m.user_id = ${actor.id}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) throw new Error("Run instruction trace was not found.");

  return {
    interfaceLocale: row.interface_locale,
    instructionLanguage: row.instruction_language,
    technicalOutputLanguage: row.technical_output_language,
    originalInstruction: row.original_instruction,
    normalizedObjective: row.normalized_objective,
  };
}
