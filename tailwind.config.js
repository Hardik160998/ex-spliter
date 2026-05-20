/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#DAF7E2',
          100: '#B1EBC1',
          200: '#85DE9E',
          300: '#5AD17C',
          400: '#35C55F',
          500: '#16B843',
          600: '#119635',
          700: '#0C7428',
          800: '#07521C',
          900: '#033010',
        },
        surface: {
          50: '#F9F9F9',
          100: '#EEEEEE',
          200: '#E2E2E2',
          300: '#CCCCCC',
          400: '#808080',
          500: '#1E1E1E',
        },
        accent: {
          red: '#F63332',
          amber: '#EC991E',
        },
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'card': '0 4px 16px rgba(0, 0, 0, 0.04), 0 1px 4px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.03)',
        'elevated': '0 12px 40px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.03)',
        'modal': '0 20px 60px rgba(0, 0, 0, 0.12), 0 8px 20px rgba(0, 0, 0, 0.04)',
        'green-glow': '0 4px 14px rgba(22, 184, 67, 0.25)',
        'green-glow-lg': '0 8px 30px rgba(22, 184, 67, 0.3)',
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-out',
        slideUp: 'slideUp 0.3s ease-out',
        slideInRight: 'slideInRight 0.3s ease-out',
        scaleIn: 'scaleIn 0.2s ease-out',
        pulse: 'pulse 2s ease-in-out infinite',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
