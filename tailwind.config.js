/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Usamos la pila de fuentes sans del sistema, pero explícitamente
        sans: ['Inter var', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Un azul "enterprise" más serio que el default
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', // Indigo vibrante
          600: '#4f46e5', // Indigo serio (principal)
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
      }
    },
  },
  plugins: [],
}