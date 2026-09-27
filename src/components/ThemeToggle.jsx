import { useTheme } from '../hooks/useTheme';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ className = '' }) {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={`w-11 h-11 md:w-12 md:h-12 flex items-center justify-center transition-all active:scale-90 ${className}`}
            aria-label="Toggle Theme"
        >
            {theme === 'dark' ? <Sun size={32} className="text-yellow-400" /> : <Moon size={32} className="text-blue-500" />}
        </button>
    );
}
