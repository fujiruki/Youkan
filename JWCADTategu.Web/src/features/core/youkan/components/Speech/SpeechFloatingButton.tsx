import React, { useState } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { SpeechButton } from './SpeechButton';
import { SpeechView } from './SpeechView';

export const SpeechFloatingButton: React.FC = () => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  if (!isMobile) return null;

  return (
    <>
      {/* SideMemoWidget が bottom-4 right-4 のため、ずらして配置 */}
      <div className="fixed bottom-20 right-4 z-50">
        <SpeechButton variant="floating" onClick={() => setIsOpen(true)} />
      </div>
      <SpeechView isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
