import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import type { ItemGroup } from '../../constants/models';
import { useDatabase } from '../../context/auth-context';
import { ROUTES } from '../../constants/routes.constants';

// --- Icon Components ---
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"></path></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>;

const ItemGroupPage: React.FC = () => {
  const navigate = useNavigate();
  const dbOperations = useDatabase();

  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [newItemGroupName, setNewItemGroupName] = useState<string>('');

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  /**
   * ✅ NEW: This function now performs the sync operation you requested.
   */
  const fetchAndSyncGroups = useCallback(async () => {
    if (!dbOperations) return;
    setLoading(true);
    setError(null);
    try {
      // Step 1: Fetch all items and all existing canonical groups concurrently.
      const [allItems, existingGroups] = await Promise.all([
        dbOperations.getItems(),
        dbOperations.getItemGroups(),
      ]);

      // Step 2: Get a unique Set of group names used in 'items'.
      const distinctNamesFromItems = new Set<string>();
      allItems.forEach(item => {
        if (item.itemGroupId) {
          distinctNamesFromItems.add(item.itemGroupId);
        }
      });

      // Step 3: Find which group names are missing from the canonical 'itemGroups' list.
      const existingGroupNames = new Set<string>(existingGroups.map(g => g.name));
      const missingGroupNames: string[] = [];
      distinctNamesFromItems.forEach(name => {
        if (!existingGroupNames.has(name)) {
          missingGroupNames.push(name);
        }
      });

      // Step 4: If there are missing groups, create them in the 'itemGroups' database.
      if (missingGroupNames.length > 0) {
        showSuccessMessage(`Syncing... Found and created ${missingGroupNames.length} new group(s).`);
        const createPromises = missingGroupNames.map(name =>
          dbOperations.createItemGroup({ name, description: 'Auto-created from items' })
        );
        await Promise.all(createPromises);
      }

      // Step 5: Fetch the final, complete list from 'itemGroups' and display it.
      const finalGroups = await dbOperations.getItemGroups();
      finalGroups.sort((a, b) => a.name.localeCompare(b.name));
      setItemGroups(finalGroups);

    } catch (err) {
      console.error('Error syncing item groups:', err);
      setError('Failed to sync and load item groups.');
    } finally {
      setLoading(false);
    }
  }, [dbOperations]);

  useEffect(() => {
    fetchAndSyncGroups();
  }, [fetchAndSyncGroups]);

  // --- All other functions below operate on the official 'itemGroups' list ---

  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleAddItemGroup = async () => {
    // This function manually adds a new group to the official list.
    if (newItemGroupName.trim() === '') return setError('Item group name cannot be empty.');
    if (itemGroups.some(g => g.name.toLowerCase() === newItemGroupName.trim().toLowerCase())) {
      return setError('This group name already exists.');
    }
    if (!dbOperations) return;

    setError(null);
    try {
      await dbOperations.createItemGroup({ name: newItemGroupName.trim(), description: '' });
      setNewItemGroupName('');
      showSuccessMessage('Group created successfully!');
      await fetchAndSyncGroups(); // Refresh the list
    } catch (err) {
      console.error('Error adding item group:', err);
      setError('Failed to add item group.');
    }
  };

  const handleEditClick = (group: ItemGroup) => {
    setEditingGroupId(group.id ?? null);
    setEditingGroupName(group.name);
  };

  const handleCancelEdit = () => {
    setEditingGroupId(null);
    setEditingGroupName('');
    setError(null);
  };

  const handleSaveEdit = async (groupToUpdate: ItemGroup) => {
    const newName = editingGroupName.trim();
    if (newName === '' || newName === groupToUpdate.name) {
      handleCancelEdit();
      return;
    }
    if (!dbOperations) return;

    setError(null);
    try {
      await dbOperations.updateGroupAndSyncItems(groupToUpdate, newName);
      handleCancelEdit();
      await fetchAndSyncGroups(); // Refresh the list
      showSuccessMessage(`Group renamed to "${newName}" and items updated.`);
    } catch (err) {
      console.error('Error updating item group:', err);
      setError('Failed to update group.');
    }
  };

  const handleDeleteItemGroup = async (groupToDelete: ItemGroup) => {
    if (!dbOperations) return;
    const groupId = groupToDelete.id ?? null;

    if (confirmingDeleteId !== groupId) {
      setConfirmingDeleteId(groupId);
      return;
    }

    setError(null);
    try {
      await dbOperations.deleteItemGroupIfUnused(groupToDelete);
      setConfirmingDeleteId(null);
      await fetchAndSyncGroups(); // Refresh list after delete
      showSuccessMessage(`Group "${groupToDelete.name}" deleted.`);
    } catch (err: any) {
      console.error('Error deleting item group:', err);
      setError(err.message || 'Failed to delete group.');
      setConfirmingDeleteId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white w-full font-sans">
      <header className="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate(ROUTES.HOME)} className="text-2xl font-bold text-gray-600 hover:text-gray-800">&times;</button>
        <nav className="flex-1 flex justify-center items-center gap-6">
          <NavLink to={ROUTES.ITEM_ADD} className={({ isActive }) => `flex-1 max-w-[120px] cursor-pointer border-b-2 py-3 text-center text-base font-medium transition ${isActive ? 'border-blue-600 font-semibold text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Item Add</NavLink>
          <NavLink to={ROUTES.ITEM_GROUP} className={({ isActive }) => `flex-1 max-w-[120px] cursor-pointer border-b-2 py-3 text-center text-base font-medium transition ${isActive ? 'border-blue-600 font-semibold text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Item Groups</NavLink>
        </nav>
        <div className="w-6"></div>
      </header>

      <main className="flex-grow p-4 bg-gray-50 w-full">
        {error && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg text-sm font-semibold"><p>{error}</p></div>}
        {successMessage && <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-lg text-sm font-semibold"><p>{successMessage}</p></div>}

        <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md">
          <div className="flex flex-col gap-2 mb-6">
            <input type="text" placeholder="Create a New Group" value={newItemGroupName} onChange={(e) => setNewItemGroupName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddItemGroup()} className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={handleAddItemGroup} disabled={loading} className="bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold shadow-sm transition hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed">Add New Group</button>
          </div>

          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Official Item Groups</h2>
          {loading ? (
            <p className="text-gray-500 text-center py-8">Syncing and Loading Groups...</p>
          ) : itemGroups.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No item groups found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {itemGroups.map((group) => (
                <div key={group.id} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border" onMouseLeave={() => setConfirmingDeleteId(null)}>
                  {editingGroupId === group.id ? (
                    <div className="flex flex-col w-full gap-2">
                      <input type="text" value={editingGroupName} onChange={(e) => setEditingGroupName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit(group)} autoFocus className="w-full p-2 border border-blue-500 rounded-md" />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleSaveEdit(group)} className="bg-green-600 text-white py-1 px-3 rounded-md text-sm font-semibold">Save</button>
                        <button onClick={handleCancelEdit} className="bg-gray-500 text-white py-1 px-3 rounded-md text-sm font-semibold">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="text-gray-800 font-medium break-all pr-2">{group.name}</span>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => handleEditClick(group)} className="text-gray-500 hover:text-blue-600" aria-label={`Edit ${group.name}`}><EditIcon /></button>
                        <button onClick={() => handleDeleteItemGroup(group)} className={`transition-colors p-1 rounded ${confirmingDeleteId === group.id ? 'bg-red-500 text-white' : 'text-gray-500 hover:text-red-600'}`} aria-label={`Delete ${group.name}`}>
                          {confirmingDeleteId === group.id ? <span className="text-xs font-bold px-1">Confirm?</span> : <DeleteIcon />}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ItemGroupPage;