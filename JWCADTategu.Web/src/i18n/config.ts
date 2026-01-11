import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { t as LABELS } from "./labels"; // Alias 't' to 'LABELS'

// Flatten labels if needed, or structured. 
// For now, assume simple structure or just use 'translation' namespace.

// Simple default resources
const resources = {
    ja: {
        translation: {
            ...LABELS // If LABELS is flat key-value
        }
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: "ja",
        fallbackLng: "ja",
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
