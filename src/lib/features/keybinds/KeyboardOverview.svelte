<script lang="ts">
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import type { KeybindAction } from "$lib/features/keybinds/keybindTypes";
  import { formatKey } from "$lib/features/keybinds/keybindUtils";

  let {
    actions,
    selectedKey = null,
    onSelectKey,
  }: {
    actions: readonly KeybindAction[];
    selectedKey?: string | null;
    onSelectKey: (key: string) => void;
  } = $props();

  type KeyCap = {
    key: string;
    label?: string;
    width?: number;
    modifier?: boolean;
    reserved?: boolean;
  };

  const rows: KeyCap[][] = [
    [
      { key: "Escape", label: "Esc", width: 1.35, reserved: true },
      { key: "1" },
      { key: "2" },
      { key: "3" },
      { key: "4" },
      { key: "5" },
      { key: "6" },
      { key: "7" },
      { key: "8" },
      { key: "9" },
      { key: "0" },
      { key: "-" },
      { key: "=" },
      { key: "Backspace", label: "Bksp", width: 1.65, reserved: true },
    ],
    [
      { key: "Tab", width: 1.35 },
      { key: "q" },
      { key: "w" },
      { key: "e" },
      { key: "r" },
      { key: "t" },
      { key: "y" },
      { key: "u" },
      { key: "i" },
      { key: "o" },
      { key: "p" },
      { key: "[" },
      { key: "]" },
      { key: "\\", width: 1.15 },
    ],
    [
      { key: "CapsLock", label: "Caps", width: 1.6, modifier: true },
      { key: "a" },
      { key: "s" },
      { key: "d" },
      { key: "f" },
      { key: "g" },
      { key: "h" },
      { key: "j" },
      { key: "k" },
      { key: "l" },
      { key: ";" },
      { key: "'" },
      { key: "Enter", width: 1.9 },
    ],
    [
      { key: "Shift", width: 2.1, modifier: true },
      { key: "z" },
      { key: "x" },
      { key: "c" },
      { key: "v" },
      { key: "b" },
      { key: "n" },
      { key: "m" },
      { key: "," },
      { key: "." },
      { key: "/" },
      { key: "?", label: "?" },
      { key: "Shift", label: "Shift", width: 2.1, modifier: true },
    ],
    [
      { key: "Control", label: "Ctrl", width: 1.4, modifier: true },
      { key: "Alt", width: 1.2, modifier: true },
      { key: "Delete", label: "Del", width: 1.4 },
      { key: " ", label: "Space", width: 4.2 },
      { key: "ArrowLeft", label: "←", width: 1.1 },
      { key: "ArrowDown", label: "↓", width: 1.1 },
      { key: "ArrowUp", label: "↑", width: 1.1 },
      { key: "ArrowRight", label: "→", width: 1.1 },
    ],
  ];

  const counts = $derived.by(() => {
    const map = new Map<string, number>();
    for (const action of actions) {
      const binding = keybindStore.bindingFor(action.id);
      if (!binding) continue;
      map.set(binding.key, (map.get(binding.key) ?? 0) + 1);
    }
    return map;
  });

  function keyLabel(cap: KeyCap): string {
    if (cap.label) return cap.label;
    return formatKey(cap.key);
  }

  function handleKey(cap: KeyCap) {
    if (cap.modifier || cap.reserved) return;
    const count = counts.get(cap.key) ?? 0;
    if (count === 0) return;
    onSelectKey(cap.key);
  }
</script>

<div class="keyboard-overview" aria-label="Keyboard usage overview">
  {#each rows as row, rowIndex}
    <div class="keyboard-row" class:keyboard-row-offset={rowIndex === 1}>
      {#each row as cap}
        {@const count = counts.get(cap.key) ?? 0}
        {@const used = count > 0}
        {@const selected = selectedKey === cap.key}
        <button
          type="button"
          class="keycap"
          class:keycap-modifier={cap.modifier}
          class:keycap-reserved={cap.reserved}
          class:keycap-used={used && !cap.modifier && !cap.reserved}
          class:keycap-selected={selected}
          style="--keycap-width: {cap.width ?? 1}"
          disabled={!used || cap.modifier || cap.reserved}
          title={used ? `${count} action${count === 1 ? "" : "s"}` : ""}
          onclick={() => handleKey(cap)}
        >
          <span>{keyLabel(cap)}</span>
          {#if used && !cap.modifier && !cap.reserved}
            <span class="keycap-count">{count}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/each}
</div>
