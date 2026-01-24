import { useAuth } from '../../auth/providers/AuthProvider';
import { JbwosTenant } from '../../auth/types';

export const usePlugin = (pluginName: string): boolean => {
    const { tenant } = useAuth();
    const jbwosTenant = tenant as JbwosTenant;

    if (!jbwosTenant || !jbwosTenant.config || !jbwosTenant.config.plugins) {
        return false;
    }

    return jbwosTenant.config.plugins[pluginName] === true;
};
