import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegistrationPortal } from './RegistrationPortal';
import { RegistrationForm } from '../features/core/auth/components/RegistrationForm';

export const RegistrationScreen: React.FC = () => {
    const navigate = useNavigate();
    const [selectedType, setSelectedType] = useState<'user' | 'proprietor' | 'company' | null>(null);

    // If no type selected, show Portal
    if (!selectedType) {
        return (
            <RegistrationPortal
                onSelectType={setSelectedType}
                onLogin={() => navigate('/login')}
            />
        );
    }

    // Show Form for selected type
    return (
        <RegistrationForm
            type={selectedType}
            onBack={() => setSelectedType(null)}
        />
    );
};
