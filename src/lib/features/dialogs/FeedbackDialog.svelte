<script lang="ts">
  import { onMount } from "svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import SettingsGroupIcon from "$lib/components/SettingsGroupIcon.svelte";
  import { showToast } from "$lib/components/toast.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import {
    invokeCheckForUpdates,
    invokeGetRuntimeInfo,
  } from "$lib/features/system/api";

  const MAX_CHARS = 200;
  const ISSUE_URL = "https://github.com/crz-dev/vyu-dev/issues/new";

  let {
    feedbackOpen,
    closeFeedback,
  }: {
    feedbackOpen: boolean;
    closeFeedback: () => void;
  } = $props();

  const t = locale.t;
  const tp = locale.tp;

  type Os = "windows" | "linux" | "macos" | "other" | "";
  type Usefulness = "useful" | "neutral" | "not-used";
  type FeatureRating = Usefulness | "";
  type Frequency = "low" | "medium" | "high" | "";
  type Retention = "no" | "maybe" | "yes" | "";

  let overall = $state(0);
  let performance = $state(0);
  let reliability = $state(0);
  let uiClarity = $state(0);

  const features = [
    {
      id: "edit",
      icon: "pencil",
      labelKey: "dialogs.feedback.features.edit",
      descKey: "dialogs.feedback.features.edit.desc",
    },
    {
      id: "markers",
      icon: "bookmark",
      labelKey: "dialogs.feedback.features.markers",
      descKey: "dialogs.feedback.features.markers.desc",
    },
    {
      id: "library",
      icon: "layout",
      labelKey: "dialogs.feedback.features.library",
      descKey: "dialogs.feedback.features.library.desc",
    },
    {
      id: "accessibility",
      icon: "settings",
      labelKey: "dialogs.feedback.features.accessibility",
      descKey: "dialogs.feedback.features.accessibility.desc",
    },
  ];

  const starLabels = [
    "dialogs.feedback.stars.poor",
    "dialogs.feedback.stars.fair",
    "dialogs.feedback.stars.good",
    "dialogs.feedback.stars.great",
    "dialogs.feedback.stars.excellent",
  ];

  const usefulnessKeys: Record<Usefulness, string> = {
    "not-used": "dialogs.feedback.features.notUsed",
    neutral: "dialogs.feedback.features.neutral",
    useful: "dialogs.feedback.features.useful",
  };

  const usefulnessTones: Record<Usefulness, string> = {
    "not-used": "red",
    neutral: "neutral",
    useful: "green",
  };

  const frequencyKeys: Record<Exclude<Frequency, "">, string> = {
    low: "dialogs.feedback.frequency.low",
    medium: "dialogs.feedback.frequency.medium",
    high: "dialogs.feedback.frequency.high",
  };

  const retentionKeys: Record<Exclude<Retention, "">, string> = {
    no: "dialogs.feedback.retention.no",
    maybe: "dialogs.feedback.retention.maybe",
    yes: "dialogs.feedback.retention.yes",
  };

  let featureRatings = $state<Record<string, FeatureRating>>(
    Object.fromEntries(features.map((f) => [f.id, "" as FeatureRating])),
  );

  let painPoint = $state("");
  let improvement = $state("");
  let frequency = $state<Frequency>("");
  let retention = $state<Retention>("");

  let os = $state<Os>("");
  let osTouched = false;

  let hoveredRow = $state("");
  let hoveredStar = $state(0);

  let checkingUpdates = $state(false);
  let sending = $state(false);

  const hasInput = $derived(
    overall > 0 ||
      performance > 0 ||
      reliability > 0 ||
      uiClarity > 0 ||
      features.some((f) => featureRatings[f.id] !== "") ||
      painPoint.trim() !== "" ||
      improvement.trim() !== "" ||
      frequency !== "" ||
      retention !== "",
  );

  onMount(() => {
    let cancelled = false;
    void invokeGetRuntimeInfo()
      .then((info) => {
        if (cancelled || osTouched) return;
        os =
          info.os === "windows" || info.os === "linux" || info.os === "macos"
            ? (info.os as Os)
            : "other";
      })
      .catch(() => {
        // OS detection is a convenience; the buttons still work without it.
      });
    return () => {
      cancelled = true;
    };
  });

  function setOs(value: Os) {
    osTouched = true;
    os = os === value ? "" : value;
  }

  function setFeature(id: string, value: Usefulness) {
    featureRatings = { ...featureRatings, [id]: value };
  }

  function reset() {
    overall = 0;
    performance = 0;
    reliability = 0;
    uiClarity = 0;
    featureRatings = Object.fromEntries(
      features.map((f) => [f.id, "" as FeatureRating]),
    );
    painPoint = "";
    improvement = "";
    frequency = "";
    retention = "";
    os = "";
    osTouched = false;
    hoveredRow = "";
    hoveredStar = 0;
  }

  function osLabel(): string {
    if (os === "windows") return "Windows";
    if (os === "linux") return "Linux";
    if (os === "macos") return "macOS";
    if (os === "other") return t("dialogs.feedback.system.osOther");
    return "—";
  }

  function ratingLine(label: string, value: number): string {
    const score = value > 0 ? `${value}/5 · ${t(starLabels[value - 1])}` : "—";
    return `- **${label}:** ${score}`;
  }

  function issueSummary(): string {
    return (improvement.trim() || painPoint.trim())
      .replace(/\s+/g, " ")
      .slice(0, 60);
  }

  function buildIssueUrl(): string {
    const lines = [
      `### ${t("dialogs.feedback.experience.title")}`,
      "",
      ratingLine(t("dialogs.feedback.experience.performance"), performance),
      ratingLine(t("dialogs.feedback.experience.reliability"), reliability),
      ratingLine(t("dialogs.feedback.experience.uiClarity"), uiClarity),
      ratingLine(t("dialogs.feedback.experience.overall"), overall),
      "",
      `### ${t("dialogs.feedback.features.title")}`,
      "",
      ...features.map((f) => {
        const rating = featureRatings[f.id];
        return `- **${t(f.labelKey)}:** ${rating ? t(usefulnessKeys[rating]) : "—"}`;
      }),
      "",
      `### ${t("dialogs.feedback.pain.title")}`,
      "",
      painPoint.trim() || "—",
      "",
      `${t("dialogs.feedback.pain.frequency")}: ${frequency ? t(frequencyKeys[frequency]) : "—"}`,
      "",
      `### ${t("dialogs.feedback.future.title")}`,
      "",
      improvement.trim() || "—",
      "",
      `${t("dialogs.feedback.retention.label")} ${retention ? t(retentionKeys[retention]) : "—"}`,
      "",
      `### ${t("dialogs.feedback.system.title")}`,
      "",
      `- **${t("dialogs.feedback.system.os")}:** ${osLabel()}`,
      `- **${t("dialogs.feedback.system.version")}:** v${__APP_VERSION__}`,
    ];

    const summary = issueSummary();
    const title = summary
      ? `${t("dialogs.feedback.title")}: ${summary}`
      : `${t("dialogs.feedback.title")} — v${__APP_VERSION__}`;

    return `${ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(lines.join("\n"))}`;
  }

  async function submit() {
    if (sending || !hasInput) return;
    sending = true;
    try {
      await openUrl(buildIssueUrl());
      reset();
      closeFeedback();
    } catch (e) {
      showToast({
        message: t("dialogs.feedback.toast.openFailed", { error: String(e) }),
        color: "red",
      });
    } finally {
      sending = false;
    }
  }

  async function checkForUpdates() {
    if (checkingUpdates) return;
    checkingUpdates = true;
    try {
      const result = await invokeCheckForUpdates();
      const url = result.status === "update" ? result.releaseUrl : null;
      showToast({
        message: result.message,
        color: "grey",
        duration: url ? 7000 : 4000,
        actions: url
          ? [
              {
                label: t("dialogs.feedback.toast.open"),
                variant: "accent",
                onClick: () => {
                  void openUrl(url).catch((e) =>
                    showToast({ message: String(e), color: "red" }),
                  );
                },
              },
            ]
          : [],
      });
    } catch (e) {
      showToast({ message: String(e), color: "red" });
    } finally {
      checkingUpdates = false;
    }
  }
</script>

{#snippet starPicker(
  id: string,
  labelKey: string,
  value: number,
  onSet: (n: number) => void,
)}
  {@const display = hoveredRow === id && hoveredStar > 0 ? hoveredStar : value}
  <div
    class="feedback-stars"
    role="group"
    aria-label={t(labelKey)}
    onmouseleave={() => (hoveredStar = 0)}
  >
    {#each [1, 2, 3, 4, 5] as n}
      <button
        class="feedback-star-btn"
        class:filled={n <= display}
        aria-pressed={value === n}
        aria-label={tp("dialogs.feedback.stars", n)}
        onclick={() => onSet(n)}
        onmouseenter={() => {
          hoveredRow = id;
          hoveredStar = n;
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={n <= display ? "currentColor" : "none"}
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          />
        </svg>
      </button>
    {/each}
    <span class="feedback-star-label">
      {display > 0
        ? t(starLabels[display - 1])
        : t("dialogs.feedback.experience.rate")}
    </span>
  </div>
{/snippet}

{#snippet bucketIcon(value: Usefulness)}
  {#if value === "useful"}
    <path
      d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"
    />
  {:else if value === "not-used"}
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  {:else}
    <line x1="5" y1="12" x2="19" y2="12" />
  {/if}
{/snippet}

{#if feedbackOpen}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) closeFeedback();
    }}
  >
    <div
      class="delete-dialog feedback-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
    >
      <div class="settings-header-bar">
        <p class="delete-title" id="feedback-title">
          <svg
            class="header-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path
              d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
            /></svg
          >
          {t("dialogs.feedback.title")}
        </p>
        <p class="delete-subtitle">{t("dialogs.feedback.subtitle")}</p>
        <button
          class="dialog-close-x"
          onclick={closeFeedback}
          aria-label={t("dialogs.feedback.close")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg
          >
        </button>
      </div>

      <div class="feedback-content">
        <div class="feedback-section">
          <div class="feedback-section-header grey">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line
                x1="8"
                y1="21"
                x2="16"
                y2="21"
              /><line x1="12" y1="17" x2="12" y2="21" /></svg
            >
            {t("dialogs.feedback.system.title")}
          </div>
          <div class="feedback-user-info">
            <div class="feedback-select-row">
              <span class="feedback-label">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><rect
                    x="2"
                    y="3"
                    width="20"
                    height="14"
                    rx="2"
                    ry="2"
                  /><line x1="8" y1="21" x2="16" y2="21" /><line
                    x1="12"
                    y1="17"
                    x2="12"
                    y2="21"
                  /></svg
                >
                {t("dialogs.feedback.system.os")}
              </span>
              <div class="feedback-os-toggle">
                <button
                  class="feedback-os-btn"
                  class:active={os === "windows"}
                  onclick={() => setOs("windows")}
                >
                  Windows
                </button>
                <button
                  class="feedback-os-btn"
                  class:active={os === "linux"}
                  onclick={() => setOs("linux")}
                >
                  Linux
                </button>
                <button
                  class="feedback-os-btn"
                  class:active={os === "macos"}
                  onclick={() => setOs("macos")}
                >
                  macOS
                </button>
                <button
                  class="feedback-os-btn"
                  class:active={os === "other"}
                  onclick={() => setOs("other")}
                >
                  {t("dialogs.feedback.system.osOther")}
                </button>
              </div>
            </div>
            <div class="feedback-select-row">
              <span class="feedback-label">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path
                    d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
                  /><line x1="7" y1="7" x2="7.01" y2="7" /></svg
                >
                {t("dialogs.feedback.system.version")}
              </span>
              <div class="feedback-version-actions">
                <span class="feedback-version-text">
                  {t("dialogs.feedback.system.currentVersion")}
                  <u>v{__APP_VERSION__}</u>
                </span>
                <button
                  class="feedback-version-btn"
                  disabled={checkingUpdates}
                  onclick={checkForUpdates}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polyline points="23 4 23 10 17 10" /><polyline
                      points="1 20 1 14 7 14"
                    /><path
                      d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                    /></svg
                  >
                  {t("dialogs.feedback.system.checkUpdates")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="feedback-section">
          <div class="feedback-section-header yellow">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              /></svg
            >
            {t("dialogs.feedback.experience.title")}
          </div>
          <div class="feedback-stars-row">
            <span class="feedback-label">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><polygon
                  points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                /></svg
              >
              {t("dialogs.feedback.experience.performance")}
            </span>
            {@render starPicker(
              "performance",
              "dialogs.feedback.experience.performance",
              performance,
              (n) => (performance = n),
            )}
          </div>
          <div class="feedback-stars-row">
            <span class="feedback-label">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path
                  d="M9 12l2 2 4-4"
                /></svg
              >
              {t("dialogs.feedback.experience.reliability")}
            </span>
            {@render starPicker(
              "reliability",
              "dialogs.feedback.experience.reliability",
              reliability,
              (n) => (reliability = n),
            )}
          </div>
          <div class="feedback-stars-row">
            <span class="feedback-label">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path
                  d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                /><circle cx="12" cy="12" r="3" /></svg
              >
              {t("dialogs.feedback.experience.uiClarity")}
            </span>
            {@render starPicker(
              "clarity",
              "dialogs.feedback.experience.uiClarity",
              uiClarity,
              (n) => (uiClarity = n),
            )}
          </div>
          <div class="feedback-stars-row">
            <span class="feedback-label">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><circle cx="12" cy="12" r="10" /><path
                  d="M8 14s1.5 2 4 2 4-2 4-2"
                /><line x1="9" y1="9" x2="9.01" y2="9" /><line
                  x1="15"
                  y1="9"
                  x2="15.01"
                  y2="9"
                /></svg
              >
              {t("dialogs.feedback.experience.overall")}
            </span>
            {@render starPicker(
              "overall",
              "dialogs.feedback.experience.overall",
              overall,
              (n) => (overall = n),
            )}
          </div>
        </div>

        <div class="feedback-section">
          <div class="feedback-section-header blue">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline
                points="2 17 12 22 22 17"
              /><polyline points="2 12 12 17 22 12" /></svg
            >
            {t("dialogs.feedback.features.title")}
          </div>
          <div class="feedback-feature-legend" aria-hidden="true">
            {#each Object.entries(usefulnessKeys) as [id, key] (id)}
              <span
                class="feedback-legend-item {usefulnessTones[id as Usefulness]}"
              >
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  {@render bucketIcon(id as Usefulness)}
                </svg>
                {t(key)}
              </span>
            {/each}
          </div>
          <div class="feedback-features">
            {#each features as f (f.id)}
              <div class="feedback-feature-row">
                <span class="feedback-feature-text">
                  <span class="feedback-feature-name">
                    <SettingsGroupIcon name={f.icon} />
                    {t(f.labelKey)}
                  </span>
                  <span class="feedback-feature-desc">{t(f.descKey)}</span>
                </span>
                <div
                  class="feedback-buckets"
                  role="group"
                  aria-label={t(f.labelKey)}
                >
                  {#each Object.entries(usefulnessKeys) as [id, key] (id)}
                    <button
                      class="feedback-bucket {usefulnessTones[
                        id as Usefulness
                      ]}"
                      class:active={featureRatings[f.id] === id}
                      aria-pressed={featureRatings[f.id] === id}
                      aria-label={t(key)}
                      onclick={() => setFeature(f.id, id as Usefulness)}
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        {@render bucketIcon(id as Usefulness)}
                      </svg>
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>

        <div class="feedback-section">
          <div class="feedback-section-header red">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><circle cx="12" cy="12" r="10" /><line
                x1="9"
                y1="9"
                x2="9.01"
                y2="9"
              /><line x1="15" y1="9" x2="15.01" y2="9" /><path
                d="M9 15a3 3 0 0 1 6 0"
              /></svg
            >
            {t("dialogs.feedback.pain.title")}
          </div>
          <div
            class="feedback-field"
            class:at-limit={painPoint.length >= MAX_CHARS}
          >
            <div class="feedback-field-header">
              <label for="feedback-pain">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path
                    d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                  /><line x1="12" y1="9" x2="12" y2="13" /><line
                    x1="12"
                    y1="17"
                    x2="12.01"
                    y2="17"
                  /></svg
                >
                {t("dialogs.feedback.pain.mostLabel")}
              </label>
              <span class="feedback-field-status">
                {#if painPoint.length >= MAX_CHARS}
                  <span class="feedback-limit-warning"
                    >{t("dialogs.feedback.limitReached")}</span
                  >
                {:else}
                  <span class="feedback-char-count">
                    {painPoint.length} / {MAX_CHARS}
                  </span>
                {/if}
              </span>
            </div>
            <textarea
              id="feedback-pain"
              bind:value={painPoint}
              placeholder={t("dialogs.feedback.pain.placeholder")}
              rows="2"
              maxlength={MAX_CHARS}
              onwheel={(e) => e.stopPropagation()}
            ></textarea>
            <div class="feedback-frequency">
              <span class="feedback-frequency-label"
                >{t("dialogs.feedback.pain.frequency")}</span
              >
              <div class="feedback-frequency-toggle">
                <button
                  class="feedback-freq-btn green"
                  class:active={frequency === "low"}
                  aria-pressed={frequency === "low"}
                  onclick={() => (frequency = frequency === "low" ? "" : "low")}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polyline points="6 9 12 15 18 9" /></svg
                  >
                  {t("dialogs.feedback.frequency.low")}
                </button>
                <button
                  class="feedback-freq-btn"
                  class:active={frequency === "medium"}
                  aria-pressed={frequency === "medium"}
                  onclick={() =>
                    (frequency = frequency === "medium" ? "" : "medium")}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><line x1="5" y1="12" x2="19" y2="12" /></svg
                  >
                  {t("dialogs.feedback.frequency.medium")}
                </button>
                <button
                  class="feedback-freq-btn red"
                  class:active={frequency === "high"}
                  aria-pressed={frequency === "high"}
                  onclick={() =>
                    (frequency = frequency === "high" ? "" : "high")}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polyline points="6 15 12 9 18 15" /></svg
                  >
                  {t("dialogs.feedback.frequency.high")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="feedback-section">
          <div class="feedback-section-header green">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              /></svg
            >
            {t("dialogs.feedback.future.title")}
          </div>
          <div
            class="feedback-field"
            class:at-limit={improvement.length >= MAX_CHARS}
          >
            <div class="feedback-field-header">
              <label for="feedback-improve">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polygon
                    points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                  /></svg
                >
                {t("dialogs.feedback.future.label")}
              </label>
              <span class="feedback-field-status">
                {#if improvement.length >= MAX_CHARS}
                  <span class="feedback-limit-warning"
                    >{t("dialogs.feedback.limitReached")}</span
                  >
                {:else}
                  <span class="feedback-char-count">
                    {improvement.length} / {MAX_CHARS}
                  </span>
                {/if}
              </span>
            </div>
            <textarea
              id="feedback-improve"
              bind:value={improvement}
              placeholder={t("dialogs.feedback.future.placeholder")}
              rows="2"
              maxlength={MAX_CHARS}
              onwheel={(e) => e.stopPropagation()}
            ></textarea>
          </div>
          <div class="feedback-field">
            <div class="feedback-frequency">
              <span class="feedback-frequency-label"
                >{t("dialogs.feedback.retention.label")}</span
              >
              <div class="feedback-frequency-toggle">
                <button
                  class="feedback-freq-btn red"
                  class:active={retention === "no"}
                  aria-pressed={retention === "no"}
                  onclick={() => (retention = retention === "no" ? "" : "no")}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><circle cx="12" cy="12" r="10" /><line
                      x1="9"
                      y1="9"
                      x2="9.01"
                      y2="9"
                    /><line x1="15" y1="9" x2="15.01" y2="9" /><path
                      d="M9 15a3 3 0 0 1 6 0"
                    /></svg
                  >
                  {t("dialogs.feedback.retention.no")}
                </button>
                <button
                  class="feedback-freq-btn"
                  class:active={retention === "maybe"}
                  aria-pressed={retention === "maybe"}
                  onclick={() =>
                    (retention = retention === "maybe" ? "" : "maybe")}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><circle cx="12" cy="12" r="10" /><line
                      x1="9"
                      y1="9"
                      x2="9.01"
                      y2="9"
                    /><line x1="15" y1="9" x2="15.01" y2="9" /><line
                      x1="9"
                      y1="15"
                      x2="15"
                      y2="15"
                    /></svg
                  >
                  {t("dialogs.feedback.retention.maybe")}
                </button>
                <button
                  class="feedback-freq-btn green"
                  class:active={retention === "yes"}
                  aria-pressed={retention === "yes"}
                  onclick={() => (retention = retention === "yes" ? "" : "yes")}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><circle cx="12" cy="12" r="10" /><line
                      x1="9"
                      y1="9"
                      x2="9.01"
                      y2="9"
                    /><line x1="15" y1="9" x2="15.01" y2="9" /><path
                      d="M8 14s1.5 2 4 2 4-2 4-2"
                    /></svg
                  >
                  {t("dialogs.feedback.retention.yes")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="delete-actions feedback-footer">
        <span class="feedback-privacy">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path
              d="M7 11V7a5 5 0 0110 0v4"
            /></svg
          >
          {t("dialogs.feedback.privacy")}
        </span>
        <button
          class="settings-action-btn blue feedback-send-btn"
          class:faded={!hasInput || sending}
          disabled={!hasInput || sending}
          onclick={submit}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg
          >
          {t("dialogs.feedback.send")}
        </button>
      </div>
    </div>
  </div>
{/if}
