// TabCraft — Domain Rules Editor

import React, { useState, useEffect } from 'react';
import type { DomainRule } from '../../shared/types';
import { CATEGORIES } from '../../shared/types';

type SortBy = 'domain-asc' | 'domain-desc' | 'category-asc' | 'category-desc';

export function RulesView() {
  const [rules, setRules] = useState<DomainRule[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortBy>('domain-asc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDomain, setEditDomain] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newCategory, setNewCategory] = useState('Development');

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    const result = await chrome.storage.local.get('rules');
    setRules(result.rules || []);
  }

  async function saveRules(updated: DomainRule[]) {
    setRules(updated);
    await chrome.storage.local.set({ rules: updated });
  }

  function handleEdit(rule: DomainRule) {
    setEditingId(rule.id);
    setEditDomain(rule.domain);
    setEditCategory(rule.category);
  }

  async function handleSave() {
    if (!editingId) return;
    const updated = rules.map(r =>
      r.id === editingId ? { ...r, domain: editDomain, category: editCategory, updatedAt: Date.now() } : r
    );
    await saveRules(updated);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    const rule = rules.find(r => r.id === id);
    if (rule?.source === 'seed') {
      if (!confirm('This is a built-in rule. Delete it?')) return;
    }
    await saveRules(rules.filter(r => r.id !== id));
  }

  async function handleAdd() {
    if (!newDomain.trim()) return;
    const rule: DomainRule = {
      id: `user_${Date.now()}`,
      domain: newDomain.trim().toLowerCase().replace(/^www\./, ''),
      category: newCategory,
      source: 'user',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveRules([...rules, rule]);
    setNewDomain('');
    setShowAdd(false);
  }

  async function handleReset() {
    if (confirm('Reset all rules to defaults? Your custom rules will be removed.')) {
      // Reload seed rules from the extension
      await chrome.storage.local.remove('rules');
      await loadRules();
    }
  }

  // Filter and sort
  const filtered = rules
    .filter(r => {
      if (search && !r.domain.includes(search.toLowerCase())) return false;
      if (filterCategory && r.category !== filterCategory) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'domain-asc': return a.domain.localeCompare(b.domain);
        case 'domain-desc': return b.domain.localeCompare(a.domain);
        case 'category-asc': return a.category.localeCompare(b.category);
        case 'category-desc': return b.category.localeCompare(a.category);
      }
    });

  const categories = [...new Set(rules.map(r => r.category))].sort();

  return (
    <div className="rules-view">
      {/* Toolbar */}
      <div className="rules-toolbar">
        <input
          type="text"
          placeholder="Search domains..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          className="setting-select"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="setting-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
        >
          <option value="domain-asc">Domain A→Z</option>
          <option value="domain-desc">Domain Z→A</option>
          <option value="category-asc">Category A→Z</option>
          <option value="category-desc">Category Z→A</option>
        </select>
      </div>

      {/* Stats */}
      <div className="rules-stats">
        <span>{filtered.length} rules</span>
        <span className="rules-stats-breakdown">
          {categories.map(c => {
            const count = rules.filter(r => r.category === c).length;
            return <span key={c} className="rule-badge">{c} ({count})</span>;
          })}
        </span>
      </div>

      {/* Rules Table */}
      <div className="rules-table-container">
        <table className="rules-table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Category</th>
              <th>Source</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(rule => (
              <tr key={rule.id} className={editingId === rule.id ? 'editing' : ''}>
                {editingId === rule.id ? (
                  <>
                    <td>
                      <input
                        className="inline-edit"
                        value={editDomain}
                        onChange={(e) => setEditDomain(e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="inline-edit"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td><span className={`source-badge ${rule.source}`}>{rule.source}</span></td>
                    <td>
                      <button className="tab-action-btn" onClick={handleSave} title="Save">✓</button>
                      <button className="tab-action-btn" onClick={() => setEditingId(null)} title="Cancel">✕</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="domain-cell">{rule.domain}</td>
                    <td><span className="category-pill">{rule.category}</span></td>
                    <td><span className={`source-badge ${rule.source}`}>{rule.source}</span></td>
                    <td>
                      <button className="tab-action-btn" onClick={() => handleEdit(rule)} title="Edit">✏️</button>
                      <button className="tab-action-btn danger" onClick={() => handleDelete(rule.id)} title="Delete">🗑️</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Rule */}
      {showAdd ? (
        <div className="add-rule-form">
          <input
            placeholder="domain.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            className="search-input"
            autoFocus
          />
          <select
            className="setting-select"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn btn-primary" onClick={handleAdd}>Add</button>
          <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
        </div>
      ) : (
        <div className="rules-footer">
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Rule</button>
          <button className="btn btn-danger" onClick={handleReset}>Reset to Defaults</button>
        </div>
      )}
    </div>
  );
}
