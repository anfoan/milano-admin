/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    black: '#1b1e21',
                    blue: '#0ea5e9',
                    green: '#10b981',
                    red: '#f43f5e',
                    white: '#ffffff',
                    gray: '#f8f9fa',
                }
            },
            fontFamily: {
                cairo: ['Cairo', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
