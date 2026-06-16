// TabCraft — Side Panel Entry Point (Plasmo convention)
// Plasmo auto-generates the HTML host and mounts the default-exported component.

import React from 'react';
import App from './App';
import './styles.css';

export default function SidePanel() {
  return (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
