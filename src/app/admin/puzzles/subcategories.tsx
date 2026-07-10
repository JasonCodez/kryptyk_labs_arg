"use client";

import React, { useEffect, useState } from "react";

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
}

export default function SubcategoryAdmin() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/puzzle-categories")
      .then((res) => res.json())
      .then(setCategories);
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      setLoading(true);
      fetch(`/api/puzzle-subcategories?categoryId=${selectedCategory}`)
        .then((res) => res.json())
        .then(setSubcategories)
        .finally(() => setLoading(false));
    } else {
      setSubcategories([]);
    }
  }, [selectedCategory]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !selectedCategory) return;
    setLoading(true);
    await fetch("/api/puzzle-subcategories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, categoryId: selectedCategory }),
    });
    setName("");
    setDescription("");
    // Refresh list
    fetch(`/api/puzzle-subcategories?categoryId=${selectedCategory}`)
      .then((res) => res.json())
      .then(setSubcategories)
      .finally(() => setLoading(false));
  };

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto" }}>
      <h2>Manage Puzzle Subcategories</h2>
      <label>
        Main Category:
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">Select a category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </label>
      {selectedCategory && (
        <>
          <form onSubmit={handleCreate} style={{ margin: "1rem 0" }}>
            <input
              type="text"
              placeholder="Subcategory name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button type="submit" disabled={loading}>
              Add Subcategory
            </button>
          </form>
          <ul style={{ marginTop: '1rem', padding: 0, listStyle: 'none' }}>
            {subcategories.map((sub) => (
              <li key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <SubcategoryItem
                  subcategory={sub}
                  onUpdated={(updated) => {
                    setSubcategories((prev) => prev.map((s) => s.id === updated.id ? updated : s));
                  }}
                  onDeleted={() => {
                    setSubcategories((prev) => prev.filter((s) => s.id !== sub.id));
                  }}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// SubcategoryItem component for edit/delete
type SubcategoryItemProps = {
  subcategory: Subcategory;
  onUpdated: (s: Subcategory) => void;
  onDeleted: () => void;
};

function SubcategoryItem({ subcategory, onUpdated, onDeleted }: SubcategoryItemProps) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(subcategory.name);
  const [description, setDescription] = React.useState(subcategory.description || "");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/puzzle-subcategories/${subcategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json();
      onUpdated(updated);
      setEditing(false);
    } catch {
      setError("Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this subcategory?")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/puzzle-subcategories/${subcategory.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      onDeleted();
    } catch {
      setError("Delete failed");
    } finally {
      setLoading(false);
    }
  };

  if (editing) {
    return (
      <>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          style={{ minWidth: 120 }}
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          style={{ minWidth: 120 }}
        />
        <button onClick={handleSave} disabled={loading || !name}>
          Save
        </button>
        <button onClick={() => setEditing(false)} disabled={loading}>
          Cancel
        </button>
        <button onClick={handleDelete} disabled={loading} style={{ color: 'red' }}>
          Delete
        </button>
        {error && <span style={{ color: 'red', marginLeft: 8 }}>{error}</span>}
      </>
    );
  }
  return (
    <>
      <strong>{subcategory.name}</strong>
      {subcategory.description && <> - {subcategory.description}</>}
      <button onClick={() => setEditing(true)} style={{ marginLeft: 8 }}>
        Edit
      </button>
      <button onClick={handleDelete} style={{ color: 'red', marginLeft: 4 }}>
        Delete
      </button>
      {error && <span style={{ color: 'red', marginLeft: 8 }}>{error}</span>}
    </>
  );
}
