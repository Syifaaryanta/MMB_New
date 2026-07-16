import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
}

export const ModalPortal: React.FC<ModalPortalProps> = ({ children }) => {
  const [container, setContainer] = useState<Element | null>(null);

  useEffect(() => {
    // Target only the content area (excluding sidebar and header)
    const el = document.getElementById('main-portal-target') ?? document.body;
    setContainer(el);
  }, []);

  if (!container) return null;
  return createPortal(children, container);
};
