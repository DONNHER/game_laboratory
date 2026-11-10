import React from 'react';

interface PhoneFrameProps {
  children: React.ReactNode;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({ children }) => {
  return (
    <div className="relative w-full h-[100dvh] bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none">
      {children}
    </div>
  );
};
