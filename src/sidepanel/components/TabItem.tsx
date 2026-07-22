// TabCraft — Tab Item Component

import React from 'react';
import { focusTab } from '../utils';

interface TabItemProps {
  tab: chrome.tabs.Tab;
  onHibernate?: (tabId: number) => void;
  onClose?: (tabId: number) => void;
}

export function TabItem({ tab, onHibernate, onClose }: TabItemProps) {
  const isActive = tab.active;
  const isDiscarded = tab.discarded;

  function handleClick() {
    focusTab(tab);
  }

  return (
    <div
      className={`tab-item ${isActive ? 'active' : ''} ${isDiscarded ? 'discarded' : ''}`}
      onClick={handleClick}
      title={tab.url}
    >
      {tab.favIconUrl ? (
        <img src={tab.favIconUrl} className="tab-favicon" alt="" onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }} />
      ) : (
        <span className="tab-favicon-placeholder">🌐</span>
      )}
      <span className="tab-title">{tab.title || 'Untitled'}</span>
      <div className="tab-actions">
        {isDiscarded && <span className="tab-badge dormant">💤</span>}
        {!isActive && !isDiscarded && onHibernate && (
          <button
            className="tab-action-btn"
            onClick={(e) => { e.stopPropagation(); onHibernate(tab.id!); }}
            title="Hibernate this tab"
          >
            💤
          </button>
        )}
        {onClose && (
          <button
            className="tab-action-btn danger"
            onClick={(e) => { e.stopPropagation(); onClose(tab.id!); }}
            title="Close this tab"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
