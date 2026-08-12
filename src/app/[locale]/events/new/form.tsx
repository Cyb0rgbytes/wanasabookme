"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { createEventAction, type CreateEventState } from "../actions";
import { computeSettledPrice } from "@/lib/pricing";
import { aedToFils, formatMoney } from "@/lib/format";

const initial: CreateEventState = { status: "idle" };

/**
 * Single-page create form.
 *
 * Grouped into sections rather than a wizard: no step state to manage, the
 * organizer can see the whole shape before committing, and validateEventInput
 * already returns every error at once — which suits one submit, not four.
 */
export function CreateEventForm({ locale }: { locale: Locale }) {
  const t = useTranslations("CreateEvent");
  const tAudience = useTranslations("Audience");
  const router = useRouter();
  const [state, submit, pending] = useActionState(createEventAction, initial);

  // Drives the live price preview as the organizer types.
  const [totalCost, setTotalCost] = useState(0);
  const [capacity, setCapacity] = useState(10);
  const [priceFloor, setPriceFloor] = useState(0);
  const [priceCeiling, setPriceCeiling] = useState(0);

  useEffect(() => {
    if (state.status === "success") {
      router.push(`/events/${state.slug}`);
    }
  }, [state, router]);

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  function errorText(name: string) {
    const key = fieldError(name);
    if (!key) return null;
    return (
      <p role="alert" className="mt-1 text-sm text-red-500">
        {/* Keys come from validateEventInput; fall back if one is unmapped. */}
        {t.has(`errors.${key}`) ? t(`errors.${key}`) : t("errors.invalid")}
      </p>
    );
  }

  const previewCounts = [
    Math.max(1, Math.ceil(capacity / 4)),
    Math.max(1, Math.ceil(capacity / 2)),
    Math.max(1, capacity),
  ];

  return (
    <form action={submit} className="grid gap-10">
      {/* ---- Basics ---- */}
      <Section title={t("sectionBasics")}>
        <Field label={t("titleEn")} required>
          <input
            name="titleEn"
            required
            maxLength={120}
            className={inputClass(Boolean(fieldError("titleEn")))}
          />
          {errorText("titleEn")}
        </Field>

        <Field label={t("titleAr")}>
          {/* dir="rtl" regardless of page locale — this field is always Arabic. */}
          <input
            name="titleAr"
            dir="rtl"
            lang="ar"
            maxLength={120}
            className={inputClass(false)}
          />
        </Field>

        <Field label={t("descriptionEn")}>
          <textarea name="descriptionEn" rows={3} className={inputClass(false)} />
        </Field>

        <Field label={t("descriptionAr")}>
          <textarea
            name="descriptionAr"
            dir="rtl"
            lang="ar"
            rows={3}
            className={inputClass(false)}
          />
        </Field>
      </Section>

      {/* ---- When and where ---- */}
      <Section title={t("sectionWhen")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("startsAt")} required>
            <input
              type="datetime-local"
              name="startsAt"
              required
              className={inputClass(Boolean(fieldError("startsAt")))}
            />
            {errorText("startsAt")}
          </Field>

          <Field label={t("endsAt")}>
            <input
              type="datetime-local"
              name="endsAt"
              className={inputClass(Boolean(fieldError("endsAt")))}
            />
            {errorText("endsAt")}
          </Field>
        </div>

        <input type="hidden" name="timezone" value="Asia/Dubai" />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("venueName")}>
            <input name="venueName" className={inputClass(false)} />
          </Field>
          <Field label={t("city")}>
            <input name="city" defaultValue="Dubai" className={inputClass(false)} />
          </Field>
        </div>
      </Section>

      {/* ---- Cost splitting ---- */}
      <Section title={t("sectionPricing")}>
        <Field label={t("totalCost")} help={t("totalCostHelp")} required>
          <input
            type="number"
            name="totalCost"
            min={0}
            step="0.01"
            required
            defaultValue={0}
            onChange={(e) => setTotalCost(Number(e.target.value))}
            className={inputClass(Boolean(fieldError("totalCostFils")))}
          />
          {errorText("totalCostFils")}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("capacity")} required>
            <input
              type="number"
              name="capacity"
              min={1}
              required
              defaultValue={10}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className={inputClass(Boolean(fieldError("capacity")))}
            />
            {errorText("capacity")}
          </Field>

          <Field label={t("minHeadcount")} help={t("minHeadcountHelp")} required>
            <input
              type="number"
              name="minHeadcount"
              min={0}
              required
              defaultValue={1}
              className={inputClass(Boolean(fieldError("minHeadcount")))}
            />
            {errorText("minHeadcount")}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("priceFloor")} help={t("priceFloorHelp")}>
            <input
              type="number"
              name="priceFloor"
              min={0}
              step="0.01"
              defaultValue={0}
              onChange={(e) => setPriceFloor(Number(e.target.value))}
              className={inputClass(Boolean(fieldError("priceFloorFils")))}
            />
            {errorText("priceFloorFils")}
          </Field>

          <Field label={t("priceCeiling")} help={t("priceCeilingHelp")} required>
            <input
              type="number"
              name="priceCeiling"
              min={0}
              step="0.01"
              required
              defaultValue={0}
              onChange={(e) => setPriceCeiling(Number(e.target.value))}
              className={inputClass(Boolean(fieldError("priceCeilingFils")))}
            />
            {errorText("priceCeilingFils")}
          </Field>
        </div>

        {/* Live preview: shows the organizer what attendees will actually see. */}
        {totalCost > 0 && priceCeiling > 0 && (
          <div className="border-border bg-surface rounded-lg border p-4">
            <p className="text-sm font-medium">{t("preview")}</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {previewCounts.map((count) => (
                <li key={count} className="text-sm">
                  <span className="text-muted block text-xs">
                    {t("previewAt", { count })}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(
                      computeSettledPrice(
                        {
                          totalCostFils: aedToFils(totalCost),
                          minHeadcount: 1,
                          capacity,
                          priceFloorFils: aedToFils(priceFloor),
                          priceCeilingFils: aedToFils(priceCeiling),
                        },
                        count,
                      ),
                      locale,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* ---- Audience ---- */}
      <Section title={t("sectionAudience")}>
        <fieldset>
          <legend className="sr-only">{tAudience("label")}</legend>
          <div className="grid gap-2">
            {(["mixed", "women_only", "family"] as const).map((value) => (
              <label
                key={value}
                className="border-border hover:bg-surface flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors"
              >
                <input
                  type="radio"
                  name="audience"
                  value={value}
                  defaultChecked={value === "mixed"}
                  className="accent-accent"
                />
                <span className="text-sm font-medium">{tAudience(value)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      {state.status === "error" && state.message !== "validation" && (
        <p role="alert" className="text-sm text-red-500">
          {t("errorGeneric")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-accent-foreground rounded-lg px-5 py-3 font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4">
      <h2 className="border-border border-b pb-2 text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  help,
  required,
  children,
}: {
  label: string;
  help?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-accent ms-1">*</span>}
      </span>
      {help && <span className="text-muted mt-0.5 block text-xs">{help}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function inputClass(hasError: boolean) {
  return [
    "border-border bg-background w-full rounded-lg border px-3 py-2 text-sm",
    hasError && "border-red-500",
  ]
    .filter(Boolean)
    .join(" ");
}
