/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: "#0F172A",
                    light: "#E8EAEE",
                    dark: "#0B1220",
                },
                secondary: {
                    DEFAULT: "#5F6B7A",
                    light: "#EDF0F4",
                    dark: "#485462",
                },
                accent: {
                    DEFAULT: "#E2A45A",
                    light: "#FFF5E6",
                    dark: "#C07F2D",
                },
                neutral: {
                    50: "#F8F7F4",
                    100: "#F1EFEB",
                    200: "#E3E0DA",
                    300: "#CEC9C1",
                    400: "#B6B0A6",
                    500: "#8E877B",
                    600: "#6C655C",
                    700: "#4C463F",
                    800: "#312C27",
                    900: "#1F1B17",
                },
                text: {
                    primary: "#111827",
                    secondary: "#4B5563",
                    light: "#6B7280",
                },
                dark: "#212121",
                light: "#7B7B7B",
            },
            fontFamily: {
                poppins: ["Poppins", "sans-serif"],
            },
        },
    },
    plugins: [require("@tailwindcss/typography")],
}
