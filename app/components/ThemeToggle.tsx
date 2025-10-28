"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
	const [theme, setTheme] = useState<string>("system");

	useEffect(() => {
		const saved = localStorage.getItem("gbti_theme") || "system";
		setTheme(saved);
		applyTheme(saved);
	}, []);

	function applyTheme(next: string) {
		const root = document.documentElement;
		if (next === "dark") root.classList.add("dark");
		else if (next === "light") root.classList.remove("dark");
		else {
			// system
			if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add("dark");
			else root.classList.remove("dark");
		}
	}

	function cycle() {
		const order = ["system", "light", "dark"];
		const idx = order.indexOf(theme);
		const next = order[(idx + 1) % order.length];
		setTheme(next);
		localStorage.setItem("gbti_theme", next);
		applyTheme(next);
	}

	return (
		<button className="px-2 py-1 border rounded text-sm" onClick={cycle} title={`Theme: ${theme}`}>
			{theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "🖥️"}
		</button>
	);
}
