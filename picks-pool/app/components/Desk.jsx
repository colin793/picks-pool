'use client';

import { createContext, useContext, useEffect, useState } from 'react';

// The desktop desk: rail on the left, the league in the middle, chat docked
// on the right on wide screens. The dock opens by default; the pin closes it
// and the choice is remembered on this device. Anything fixed to the bottom
// of the page reads --dock-right so it stops where the dock starts.
const DockContext = createContext({ open: true, toggle: () => {} });
export const useDock = () => useContext(DockContext);

export default function Desk({ rail, dock, children }) {
  const [open, setOpen] = useState(true);
  useEffect(() => { try { setOpen(localStorage.getItem('dock') !== 'closed'); } catch { /* fine */ } }, []);
  const toggle = () => setOpen((v) => { const next = !v; try { localStorage.setItem('dock', next ? 'open' : 'closed'); } catch { /* fine */ } return next; });
  return (
    <DockContext.Provider value={{ open, toggle }}>
      <div
        data-dock={open ? 'open' : 'closed'}
        style={{ '--dock-right': open && dock ? 'var(--dock-w)' : '0px' }}
        className={`min-h-screen lg:grid lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] ${open && dock ? 'xl:grid-cols-[var(--sidebar-w)_minmax(0,1fr)_var(--dock-w)]' : ''}`}
      >
        {rail}
        {children}
        {dock && <div className={`hidden ${open ? 'xl:block' : ''}`}>{dock}</div>}
      </div>
    </DockContext.Provider>
  );
}
