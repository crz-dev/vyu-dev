function bouncePropRow(event: MouseEvent | KeyboardEvent): void {
  if (
    event instanceof KeyboardEvent &&
    event.key !== "Enter" &&
    event.key !== " "
  )
    return;
  const row = (event.target as HTMLElement | null)?.closest<HTMLElement>(
    ".props-row, [data-copyable]",
  );
  if (!row) return;
  row.classList.remove("props-row-copied");
  void row.offsetWidth;
  row.classList.add("props-row-copied");
  row.addEventListener(
    "animationend",
    () => row.classList.remove("props-row-copied"),
    { once: true },
  );
}

export function bouncePropRows(node: HTMLElement) {
  node.addEventListener("click", bouncePropRow);
  node.addEventListener("keydown", bouncePropRow);
  return {
    destroy() {
      node.removeEventListener("click", bouncePropRow);
      node.removeEventListener("keydown", bouncePropRow);
    },
  };
}
