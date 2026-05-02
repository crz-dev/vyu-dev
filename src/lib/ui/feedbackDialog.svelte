<script lang="ts">
  const MAX_CHARS = 200;

  let {
    feedbackOpen,
    closeFeedback,
  }: {
    feedbackOpen: boolean;
    closeFeedback: () => void;
  } = $props();

  let overall = $state(0);
  let performance = $state(0);
  let uiClarity = $state(0);

  const features = [
    { id: "edit", label: "Edit" },
    { id: "markers", label: "Markers (timestamps & clips)" },
    { id: "convert", label: "Convert" },
    { id: "compress", label: "Compress" },
    { id: "slideshow", label: "Slideshow" },
    { id: "library", label: "Library" },
  ];

  type Usefulness = "useful" | "neutral" | "not-used";
  let featureRatings = $state<Record<string, Usefulness>>(
    Object.fromEntries(features.map((f) => [f.id, "neutral" as Usefulness])),
  );

  let painPoint = $state("");
  let improvement = $state("");
  let focusArea = $state("");

  type Frequency = "low" | "medium" | "high" | "";
  let frequency = $state<Frequency>("");

  type Retention = "no" | "maybe" | "yes" | "";
  let retention = $state<Retention>("");

  let os = $state("");
  let appVersion = $state("");

  const atLimit = $derived(
    painPoint.length >= MAX_CHARS ||
      improvement.length >= MAX_CHARS ||
      focusArea.length >= MAX_CHARS,
  );

  function setFeature(id: string, value: Usefulness) {
    featureRatings = { ...featureRatings, [id]: value };
  }

  function reset() {
    overall = 0;
    performance = 0;
    uiClarity = 0;
    featureRatings = Object.fromEntries(
      features.map((f) => [f.id, "neutral" as Usefulness]),
    );
    painPoint = "";
    improvement = "";
    focusArea = "";
    frequency = "";
    retention = "";
    os = "";
    appVersion = "";
  }

  function submit() {
    if (atLimit) return;
    reset();
    closeFeedback();
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.scrollTop += e.deltaY * 0.35;
  }

  const starLabels = ["Poor", "Fair", "Good", "Great", "Excellent"];
</script>

{#if feedbackOpen}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) closeFeedback();
    }}
  >
    <div class="delete-dialog feedback-dialog" role="dialog" aria-modal="true">
      <div class="settings-header-bar">
        <p class="delete-title">Feedback</p>
        <p class="delete-subtitle">Help us make vyu better for everyone</p>
      </div>

      <div class="feedback-content" onwheel={handleWheel}>
        <!-- System & app -->
        <div class="feedback-section">
          <div class="feedback-section-header grey">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            System & app
          </div>
          <div class="feedback-user-info">
            <div class="feedback-select-row">
              <label for="feedback-os">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                OS
              </label>
              <select id="feedback-os" bind:value={os}>
                <option value="" disabled selected>Autodetecting…</option>
                <option value="windows">Windows</option>
                <option value="macos">macOS</option>
                <option value="linux">Linux</option>
                <option value="prefer-not">Prefer not to say</option>
              </select>
            </div>
            <div class="feedback-select-row">
              <label for="feedback-version">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                Version
              </label>
              <select id="feedback-version" bind:value={appVersion}>
                <option value="" disabled selected>Autodetecting…</option>
                <option value="1.0.0">1.0.0</option>
                <option value="prefer-not">Prefer not to say</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Star ratings -->
        <div class="feedback-section">
          <div class="feedback-section-header yellow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            Experience
          </div>
          <div class="feedback-stars-row">
            <span class="feedback-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
              Overall
            </span>
            <div class="feedback-stars">
              {#each [1, 2, 3, 4, 5] as n}
                <button
                  class="feedback-star-btn"
                  class:filled={n <= overall}
                  onclick={() => (overall = n)}
                  aria-label="{n} stars"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={n <= overall ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </button>
              {/each}
              <span class="feedback-star-label">{overall > 0 ? starLabels[overall - 1] : "Rate"}</span>
            </div>
          </div>
          <div class="feedback-stars-row">
            <span class="feedback-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Performance
            </span>
            <div class="feedback-stars">
              {#each [1, 2, 3, 4, 5] as n}
                <button
                  class="feedback-star-btn"
                  class:filled={n <= performance}
                  onclick={() => (performance = n)}
                  aria-label="{n} stars"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={n <= performance ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </button>
              {/each}
              <span class="feedback-star-label">{performance > 0 ? starLabels[performance - 1] : "Rate"}</span>
            </div>
          </div>
          <div class="feedback-stars-row">
            <span class="feedback-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              UI Clarity
            </span>
            <div class="feedback-stars">
              {#each [1, 2, 3, 4, 5] as n}
                <button
                  class="feedback-star-btn"
                  class:filled={n <= uiClarity}
                  onclick={() => (uiClarity = n)}
                  aria-label="{n} stars"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={n <= uiClarity ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </button>
              {/each}
              <span class="feedback-star-label">{uiClarity > 0 ? starLabels[uiClarity - 1] : "Rate"}</span>
            </div>
          </div>
        </div>

        <!-- Feature usefulness -->
        <div class="feedback-section">
          <div class="feedback-section-header blue">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            Feature Usefulness
          </div>
          <p class="feedback-hint">How useful are these features to you?</p>
          <div class="feedback-features">
            {#each features as f}
              <div class="feedback-feature-row">
                <span class="feedback-feature-name">
                  {#if f.id === "edit"}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L18.5 2.5z"/></svg>
                  {:else if f.id === "markers"}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
                  {:else if f.id === "convert"}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                  {:else if f.id === "compress"}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                  {:else if f.id === "slideshow"}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  {:else if f.id === "library"}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                  {/if}
                  {f.label}
                </span>
                <div class="feedback-buckets">
                  <button
                    class="feedback-bucket red"
                    class:active={featureRatings[f.id] === "not-used"}
                    onclick={() => setFeature(f.id, "not-used")}
                  >Not used</button>
                  <button
                    class="feedback-bucket"
                    class:active={featureRatings[f.id] === "neutral"}
                    onclick={() => setFeature(f.id, "neutral")}
                  >Neutral</button>
                  <button
                    class="feedback-bucket green"
                    class:active={featureRatings[f.id] === "useful"}
                    onclick={() => setFeature(f.id, "useful")}
                  >Useful</button>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Pain points -->
        <div class="feedback-section">
          <div class="feedback-section-header red">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/><path d="M9 15a3 3 0 0 1 6 0"/></svg>
            Pain points
          </div>
          <div class="feedback-field" class:at-limit={painPoint.length >= MAX_CHARS}>
            <div class="feedback-field-header">
              <label for="feedback-pain">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                What bothered you most?
              </label>
              <span class="feedback-char-count" class:at-limit={painPoint.length >= MAX_CHARS}>
                {painPoint.length} / {MAX_CHARS}
              </span>
            </div>
            <textarea
              id="feedback-pain"
              bind:value={painPoint}
              placeholder="Describe any friction or issue..."
              rows="2"
              maxlength={MAX_CHARS}
              onwheel={(e) => e.stopPropagation()}
            ></textarea>
            <div class="feedback-frequency">
              <span class="feedback-frequency-label">Frequency</span>
              <div class="feedback-frequency-toggle">
                <button
                  class="feedback-freq-btn green"
                  class:active={frequency === "low"}
                  onclick={() => (frequency = frequency === "low" ? "" : "low")}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  Low
                </button>
                <button
                  class="feedback-freq-btn"
                  class:active={frequency === "medium"}
                  onclick={() => (frequency = frequency === "medium" ? "" : "medium")}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Medium
                </button>
                <button
                  class="feedback-freq-btn red"
                  class:active={frequency === "high"}
                  onclick={() => (frequency = frequency === "high" ? "" : "high")}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"/></svg>
                  High
                </button>
              </div>
            </div>
            {#if painPoint.length >= MAX_CHARS}
              <span class="feedback-limit-warning">Character limit reached</span>
            {/if}
          </div>
          <div class="feedback-field" class:at-limit={focusArea.length >= MAX_CHARS}>
            <div class="feedback-field-header">
              <label for="feedback-focus">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                What things do you want us to focus on?
              </label>
              <span class="feedback-char-count" class:at-limit={focusArea.length >= MAX_CHARS}>
                {focusArea.length} / {MAX_CHARS}
              </span>
            </div>
            <textarea
              id="feedback-focus"
              bind:value={focusArea}
              placeholder="Features, workflows, anything..."
              rows="2"
              maxlength={MAX_CHARS}
              onwheel={(e) => e.stopPropagation()}
            ></textarea>
            {#if focusArea.length >= MAX_CHARS}
              <span class="feedback-limit-warning">Character limit reached</span>
            {/if}
          </div>
        </div>

        <!-- Future & Improvements -->
        <div class="feedback-section">
          <div class="feedback-section-header green">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Future & Improvements
          </div>
          <div class="feedback-field" class:at-limit={improvement.length >= MAX_CHARS}>
            <div class="feedback-field-header">
              <label for="feedback-improve">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                One thing you'd change or add
              </label>
              <span class="feedback-char-count" class:at-limit={improvement.length >= MAX_CHARS}>
                {improvement.length} / {MAX_CHARS}
              </span>
            </div>
            <textarea
              id="feedback-improve"
              bind:value={improvement}
              placeholder="Your best idea..."
              rows="2"
              maxlength={MAX_CHARS}
              onwheel={(e) => e.stopPropagation()}
            ></textarea>
            {#if improvement.length >= MAX_CHARS}
              <span class="feedback-limit-warning">Character limit reached</span>
            {/if}
          </div>
          <div class="feedback-field">
            <div class="feedback-field-header">
              <label>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/></svg>
                Will you keep using this app?
              </label>
            </div>
            <div class="feedback-frequency">
              <span class="feedback-frequency-label">Likelihood</span>
              <div class="feedback-frequency-toggle">
                <button
                  class="feedback-freq-btn red"
                  class:active={retention === "no"}
                  onclick={() => (retention = retention === "no" ? "" : "no")}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/><path d="M9 15a3 3 0 0 1 6 0"/></svg>
                  No
                </button>
                <button
                  class="feedback-freq-btn"
                  class:active={retention === "maybe"}
                  onclick={() => (retention = retention === "maybe" ? "" : "maybe")}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                  Maybe
                </button>
                <button
                  class="feedback-freq-btn green"
                  class:active={retention === "yes"}
                  onclick={() => (retention = retention === "yes" ? "" : "yes")}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/></svg>
                  Yes
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Submit -->
        <div class="feedback-submit-wrap">
          <button class="settings-action-btn blue feedback-send-btn" class:faded={atLimit} disabled={atLimit} onclick={submit}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            Send feedback
          </button>
          <span class="feedback-weekly-note">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            You can only send feedback once per week.
          </span>
        </div>
      </div>

      <div class="delete-actions feedback-footer">
        <span class="feedback-privacy">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Used only to improve the app. Nothing is logged permanently or tied to your identity.
        </span>
        <button class="delete-cancel" onclick={closeFeedback}>Close</button>
      </div>
    </div>
  </div>
{/if}
