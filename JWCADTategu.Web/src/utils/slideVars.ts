
export const initSlideVars = async () => {
    // @ts-ignore
    if (import.meta.env.DEV) {
        try {
            // Dynamic import to avoid including in production bundle
            // @ts-ignore
            const { slideVars } = await import('@codepen/slidevars');
            slideVars.init();
            console.log('[UI Tuning] slideVars initialized');
        } catch (e) {
            console.error('[UI Tuning] Failed to initialize slideVars', e);
        }
    }
};
