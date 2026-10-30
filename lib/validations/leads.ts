import { z } from "zod";

import { LEAD_LIMITS, STAGE_KINDS } from "@/config/leads";
import { filterValues, listQuerySchema } from "@/lib/validations/table";
import {
  amountField,
  colorField,
  idField,
  optionalEmail,
  optionalPhone,
  optionalText,
  tagList,
} from "@/lib/validations/fields";

const amount = amountField;

const isoDate = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())),
    "Introduce una fecha válida",
  );

export const leadFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(150, "Máximo 150 caracteres"),
  pipelineId: idField,
  stageId: z.string("Selecciona un paso").trim().min(1, "Selecciona un paso"),
  value: amount,
  expectedCloseDate: isoDate,
  contactName: optionalText(120),
  companyName: optionalText(120),
  email: optionalEmail,
  phone: optionalPhone,
  source: optionalText(60),
  lostReason: optionalText(300),
  ownerId: z.string().trim().max(128),
  customerId: z.string().trim().max(128),
  tags: tagList(LEAD_LIMITS.maxTags, LEAD_LIMITS.maxTagLength),
});

export const updateLeadSchema = z.object({
  id: idField,
  values: leadFormSchema,
});

/** A pipeline id, or "" for the organization's first pipeline. */
export const pipelineIdSchema = z.string().trim().max(128);

export const leadBoardSchema = z.object({
  /** "" selects the first pipeline of the organization. */
  pipelineId: z.string().trim().max(128).default(""),
  q: z.string().trim().max(100).default(""),
  /** Member user id, "me" for the caller or "none" for unassigned. */
  ownerId: z.string().trim().max(128).default(""),
});

export const moveLeadSchema = z.object({
  id: idField,
  stageId: idField,
  /** Position in the target column once the lead is removed from its origin. */
  index: z.number().int().min(0).max(100_000),
});

export const leadNoteSchema = z.object({
  leadId: idField,
  body: z
    .string()
    .trim()
    .min(1, "Escribe una nota")
    .max(
      LEAD_LIMITS.maxNoteLength,
      `Máximo ${LEAD_LIMITS.maxNoteLength} caracteres`,
    ),
});

export const pipelineFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(60, "Máximo 60 caracteres"),
  description: optionalText(200),
});

export const updatePipelineSchema = z.object({
  id: idField,
  values: pipelineFormSchema,
});

export const stageFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Introduce un nombre")
    .max(40, "Máximo 40 caracteres"),
  color: colorField,
  kind: z.enum(STAGE_KINDS, "Selecciona un tipo"),
  probability: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" || (/^\d{1,3}$/.test(value) && Number(value) <= 100),
      "Introduce un número entre 0 y 100",
    ),
});

export const createStageSchema = z.object({
  pipelineId: idField,
  values: stageFormSchema,
});

export const updateStageSchema = z.object({
  id: idField,
  values: stageFormSchema,
});

export const moveItemSchema = z.object({
  id: idField,
  direction: z.enum(["up", "down"]),
});

export const deleteStageSchema = z.object({
  id: idField,
  /** Stage that receives the leads of the deleted one, if it has any. */
  targetStageId: z.string().trim().max(128).default(""),
});

export const leadIdSchema = idField;

export type LeadFormValues = z.infer<typeof leadFormSchema>;
export type LeadBoardFilters = z.infer<typeof leadBoardSchema>;
export type LeadNoteValues = z.infer<typeof leadNoteSchema>;
export type PipelineFormValues = z.infer<typeof pipelineFormSchema>;
export type StageFormValues = z.infer<typeof stageFormSchema>;

export const EMPTY_LEAD_FORM: LeadFormValues = {
  title: "",
  pipelineId: "",
  stageId: "",
  value: "",
  expectedCloseDate: "",
  contactName: "",
  companyName: "",
  email: "",
  phone: "",
  source: "",
  lostReason: "",
  ownerId: "",
  customerId: "",
  tags: [],
};

export const pipelineListSchema = listQuerySchema(
  ["position", "name", "openCount", "openValue", "forecast", "leadCount"],
  { sort: "position", direction: "asc" },
);

export const customerLeadListSchema = listQuerySchema(
  ["title", "pipeline", "stage", "value", "updatedAt"],
  { sort: "updatedAt", direction: "desc" },
).extend({
  customerId: idField,
  kinds: z.array(z.enum(STAGE_KINDS)).max(STAGE_KINDS.length).default([]),
  pipelineIds: filterValues,
});

export type PipelineListParams = z.infer<typeof pipelineListSchema>;
export type CustomerLeadListParams = z.infer<typeof customerLeadListSchema>;
