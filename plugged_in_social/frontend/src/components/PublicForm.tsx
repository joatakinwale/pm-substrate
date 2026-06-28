"use client";

import { useMemo, useState, type FormEvent } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type PublicFormDefinition = {
  name: string;
  slug: string;
  description: string | null;
  schema_json: Record<string, unknown>;
  theme_json: Record<string, unknown> | null;
  success_message: string | null;
  redirect_url: string | null;
};

type Choice = {
  value: string;
  label: string;
};

type Field = {
  name: string;
  label: string;
  type: string;
  inputType?: string;
  placeholder?: string;
  description?: string;
  required: boolean;
  choices: Choice[];
};

const DEFAULT_FIELDS: Field[] = [
  {
    name: "full_name",
    label: "Full name",
    type: "text",
    required: true,
    choices: [],
  },
  {
    name: "email",
    label: "Email",
    type: "text",
    inputType: "email",
    required: true,
    choices: [],
  },
  {
    name: "message",
    label: "Message",
    type: "comment",
    required: false,
    choices: [],
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function readChoices(value: unknown): Choice[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        return { value: item, label: item };
      }
      const obj = asRecord(item);
      const value = readString(obj, ["value", "id", "name"]);
      const label = readString(obj, ["text", "label", "title", "value"]);
      return value ? { value, label: label || value } : null;
    })
    .filter((item): item is Choice => item !== null);
}

function normalizeField(raw: unknown): Field | null {
  const obj = asRecord(raw);
  const name = readString(obj, ["name", "id", "key"]);
  if (!name) return null;

  const type = readString(obj, ["type"]) || "text";
  const label = readString(obj, ["title", "label"]) || name.replace(/_/g, " ");
  const choices = readChoices(obj.choices ?? obj.options);
  const required = obj.isRequired === true || obj.required === true;
  const placeholder = readString(obj, ["placeholder", "placeHolder"]);
  const description = readString(obj, ["description", "helpText"]);
  const inputType = readString(obj, ["inputType", "input_type"]);

  return {
    name,
    label,
    type,
    inputType,
    placeholder,
    description,
    required,
    choices,
  };
}

function extractFields(schema: Record<string, unknown>): Field[] {
  const directFields = schema.fields ?? schema.elements;
  const candidates: unknown[] = Array.isArray(directFields) ? directFields : [];

  const pages = schema.pages;
  if (Array.isArray(pages)) {
    for (const page of pages) {
      const elements = asRecord(page).elements;
      if (Array.isArray(elements)) candidates.push(...elements);
    }
  }

  const fields = candidates
    .map(normalizeField)
    .filter((field): field is Field => field !== null);

  return fields.length > 0 ? fields : DEFAULT_FIELDS;
}

function emptyValueFor(field: Field): string | string[] | boolean {
  if (field.type === "checkbox") return [];
  if (field.type === "boolean") return false;
  return "";
}

function hasValue(value: string | string[] | boolean): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  return value.trim().length > 0;
}

function inputTypeFor(field: Field): string {
  if (field.inputType) return field.inputType;
  if (field.name.toLowerCase().includes("email")) return "email";
  if (field.name.toLowerCase().includes("phone")) return "tel";
  if (field.name.toLowerCase().includes("website")) return "url";
  if (field.type === "number" || field.type === "rating") return "number";
  if (field.type === "date") return "date";
  return "text";
}

export default function PublicForm({ form }: { form: PublicFormDefinition }) {
  const fields = useMemo(() => extractFields(form.schema_json), [form.schema_json]);
  const [values, setValues] = useState<Record<string, string | string[] | boolean>>(
    () =>
      Object.fromEntries(
        fields.map((field) => [field.name, emptyValueFor(field)])
      )
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setFieldValue(name: string, value: string | string[] | boolean) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function toggleChoice(field: Field, choice: string) {
    const current = values[field.name];
    const list = Array.isArray(current) ? current : [];
    setFieldValue(
      field.name,
      list.includes(choice)
        ? list.filter((item) => item !== choice)
        : [...list, choice]
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const missing = fields.find(
      (field) => field.required && !hasValue(values[field.name] ?? "")
    );
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        `${API_URL}/api/forms/public/${encodeURIComponent(form.slug)}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: values }),
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || `Submission failed (${response.status})`);
      }
      if (form.redirect_url) {
        window.location.assign(form.redirect_url);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the form.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-stevie-green/20 bg-stevie-green/5 p-8 text-center">
        <h2 className="heading-brand text-3xl mb-3">Thank you.</h2>
        <p className="text-sm text-muted-foreground">
          {form.success_message || "Your submission has been received."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {fields.map((field) => {
        const value = values[field.name] ?? emptyValueFor(field);
        const id = `form-${form.slug}-${field.name}`;

        if (field.type === "comment" || field.type === "textarea") {
          return (
            <div key={field.name}>
              <label htmlFor={id} className="block text-sm font-medium mb-1.5">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              <textarea
                id={id}
                rows={4}
                required={field.required}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => setFieldValue(field.name, event.target.value)}
                placeholder={field.placeholder}
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors resize-none"
              />
              {field.description && (
                <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
              )}
            </div>
          );
        }

        if (field.type === "dropdown") {
          return (
            <div key={field.name}>
              <label htmlFor={id} className="block text-sm font-medium mb-1.5">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              <select
                id={id}
                required={field.required}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => setFieldValue(field.name, event.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
              >
                <option value="">Select...</option>
                {field.choices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (field.type === "radiogroup") {
          return (
            <fieldset key={field.name} className="space-y-2">
              <legend className="block text-sm font-medium">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {field.choices.map((choice) => (
                  <label
                    key={choice.value}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={choice.value}
                      checked={value === choice.value}
                      onChange={() => setFieldValue(field.name, choice.value)}
                      className="accent-stevie-green"
                    />
                    {choice.label}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        }

        if (field.type === "checkbox") {
          const list = Array.isArray(value) ? value : [];
          return (
            <fieldset key={field.name} className="space-y-2">
              <legend className="block text-sm font-medium">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {field.choices.map((choice) => (
                  <label
                    key={choice.value}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={list.includes(choice.value)}
                      onChange={() => toggleChoice(field, choice.value)}
                      className="accent-stevie-green"
                    />
                    {choice.label}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        }

        if (field.type === "boolean") {
          return (
            <label
              key={field.name}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={value === true}
                onChange={(event) => setFieldValue(field.name, event.target.checked)}
                className="accent-stevie-green"
              />
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
          );
        }

        return (
          <div key={field.name}>
            <label htmlFor={id} className="block text-sm font-medium mb-1.5">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              id={id}
              type={inputTypeFor(field)}
              required={field.required}
              value={typeof value === "string" ? value : ""}
              onChange={(event) => setFieldValue(field.name, event.target.value)}
              placeholder={field.placeholder}
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
            />
            {field.description && (
              <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
            )}
          </div>
        );
      })}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-6 py-3 bg-stevie-green text-white text-sm font-semibold rounded-full hover:bg-stevie-green-light transition-colors disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
