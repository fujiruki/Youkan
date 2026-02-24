import { useAuth } from '../../auth/providers/AuthProvider';
import { YoukanTenant } from '../../auth/types';

export const usePlugin = (pluginName: string): boolean => {
    const { tenant } = useAuth();
    const youkanTenant = tenant as YoukanTenant;

    if (!youkanTenant || !youkanTenant.config || !youkanTenant.config.plugins) {
        return false;
    }

    return youkanTenant.config.plugins[pluginName] === true;
};
