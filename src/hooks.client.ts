import type { HandleClientError } from "@sveltejs/kit";
import { applyStartupProfilePreference } from "$lib/services/storage";

export const handleError: HandleClientError = ({ error, status, message }) => {
  console.error(`SvelteKit error (${status}):`, error, message);
  return { message: "An unexpected error occurred" };
};

export function init() {
  applyStartupProfilePreference();

  window.addEventListener("error", (e) => {
    console.error("Uncaught error:", e.error ?? e.message);
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("Unhandled promise rejection:", e.reason);
  });
}
