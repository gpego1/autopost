/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1e3a5f',
          50: '#e8eef5',
          100: '#c5d4e7',
          200: '#9fb8d8',
          300: '#789cc9',
          400: '#5a87be',
          500: '#3d72b3',
          600: '#2e5d9e',
          700: '#1e3a5f',
          800: '#162c4a',
          900: '#0e1e35',
        },
        accent: {
          DEFAULT: '#4a7c2f',
          50: '#edf4e8',
          100: '#d0e5c4',
          200: '#b0d49e',
          300: '#90c378',
          400: '#77b55b',
          500: '#5ea83f',
          600: '#4a7c2f',
          700: '#3a6124',
          800: '#2a461a',
          900: '#1a2c10',
        },
        navy: {
          900: '#0d1b2a',
          800: '#1a2d42',
          700: '#1e3a5f',
          600: '#2a4f7c',
          500: '#3a6499',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
