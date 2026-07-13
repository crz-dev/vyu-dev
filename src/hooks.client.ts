import type { HandleClientError } from "@sveltejs/kit";

export const handleError: HandleClientError = ({ error, status, message }) => {
	console.error(`SvelteKit error (${status}):`, error, message);
	return { message: "An unexpected error occurred" };
};

if (typeof window !== "undefined") {
	window.addEventListener("error", (e) => {
		console.error("Uncaught error:", e.error ?? e.message);
	});

	window.addEventListener("unhandledrejection", (e) => {
		console.error("Unhandled promise rejection:", e.reason);
	});
}
