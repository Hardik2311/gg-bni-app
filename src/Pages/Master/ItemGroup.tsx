import React, { useState, useEffect } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import type { Item, ItemGroup } from '../../constants/models';
import {
  createItemGroup,
  getItemGroups,
  updateItemGroup,
  deleteItemGroup,
  getItems,
} from '../../lib/items_firebase';
import { ROUTES } from '../../constants/routes.constants';

const ItemGroupPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Item Groups');

  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Added back state for the manual input field
  const [newItemGroupName, setNewItemGroupName] = useState<string>('');

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');

  useEffect(() => {
    const syncItemGroups = async () => {
      setLoading(true);
      setError(null);
      try {
        const [allItems, existingGroups] = await Promise.all([
          getItems(),
          getItemGroups(),
        ]);

        const groupNamesFromItems = new Set(
          allItems
            .map((item: Item) => item.itemGroupId?.trim())
            .filter((groupName): groupName is string => !!groupName)
        );

        const existingGroupNames = new Set(existingGroups.map(g => g.name));
        const groupsToCreate = [...groupNamesFromItems].filter(
          name => !existingGroupNames.has(name)
        );

        if (groupsToCreate.length > 0) {
          console.log('Creating new groups:', groupsToCreate);
          const createPromises = groupsToCreate.map(name =>
            createItemGroup({ name, description: '' })
          );
          await Promise.all(createPromises);
        }

        const finalGroups = await getItemGroups();
        setItemGroups(finalGroups);

      } catch (err) {
        console.error('Error synchronizing item groups:', err);
        setError('Failed to load and sync item groups. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    syncItemGroups();
  }, []);

  // 2. Added back the handler for manual creation
  const handleAddItemGroup = async () => {
    if (newItemGroupName.trim() === '') {
      setError('Item group name cannot be empty.');
      return;
    }
    setError(null);

    try {
      await createItemGroup({
        name: newItemGroupName.trim(),
        description: '',
      });
      setNewItemGroupName(''); // Clear the input field
      // Refetch all groups to update the list
      const groups = await getItemGroups();
      setItemGroups(groups);
    } catch (err) {
      console.error('Error adding item group:', err);
      setError('Failed to add item group. Please try again.');
    }
  };

  const handleEditClick = (group: ItemGroup) => {
    setEditingGroupId(group.id!);
    setEditingGroupName(group.name);
  };

  const handleSaveEdit = async (id: string) => {
    if (editingGroupName.trim() === '') {
      setError('Item group name cannot be empty.');
      return;
    }
    setError(null);

    try {
      await updateItemGroup(id, { name: editingGroupName.trim() });
      setEditingGroupId(null);
      setEditingGroupName('');
      const groups = await getItemGroups();
      setItemGroups(groups);
    } catch (err) {
      console.error('Error updating item group:', err);
      setError('Failed to update item group. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingGroupId(null);
    setEditingGroupName('');
    setError(null);
  };

  const handleDeleteItemGroup = async (id: string) => {
    if (
      window.confirm(
        'Are you sure you want to delete this item group? This action cannot be undone.',
      )
    ) {
      setError(null);
      try {
        await deleteItemGroup(id);
        const groups = await getItemGroups();
        setItemGroups(groups);
      } catch (err) {
        console.error('Error deleting item group:', err);
        setError('Failed to delete item group. Please try again.');
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white w-full">
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-1000">
        <button
          onClick={() => navigate(ROUTES.HOME)}
          className="text-2xl font-bold text-gray-600 bg-transparent border-none cursor-pointer p-1"
        >
          &times;
        </button>
        <div className="flex-1 flex justify-center items-center gap-6">
          <NavLink
            to={`${ROUTES.ITEM_ADD}`}
            className={`flex-1 cursor-pointer border-b-2 py-3 text-center text-base font-medium transition hover:text-slate-700 ${activeTab === 'Item Add'
              ? 'border-blue-600 font-semibold text-blue-600'
              : 'border-transparent text-slate-500'
              }`}
            onClick={() => setActiveTab('Item Add')}
          >
            Item Add
          </NavLink>
          <NavLink
            to={`${ROUTES.ITEM_GROUP}`}
            className={`flex-1 cursor-pointer border-b-2 py-3 text-center text-base font-medium transition hover:text-slate-700 ${activeTab === 'Item Groups'
              ? 'border-blue-600 font-semibold text-blue-600'
              : 'border-transparent text-slate-500'
              }`}
            onClick={() => setActiveTab('Item Groups')}
          >
            Item Groups
          </NavLink>
        </div>
        <div className="w-6"></div>
      </div>

      <div className="flex-grow p-4 bg-white w-full overflow-y-auto box-border">
        {error && (
          <div className="mb-4 text-center p-4 bg-red-100 rounded-lg shadow-sm border border-red-200">
            <p className="text-red-700 font-semibold">{error}</p>
          </div>
        )}
        <div className="p-6 bg-white rounded-lg shadow-md">
          {/* 3. Added back the input field and button for manual adding */}
          <div className="flex flex-col sm:flex-row gap-2 mb-6">
            <input
              type="text"
              placeholder="Add New Item Group Manually"
              value={newItemGroupName}
              onChange={(e) => setNewItemGroupName(e.target.value)}
              className="flex-grow w-full p-3 border border-gray-300 rounded-lg bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddItemGroup();
                }
              }}
              disabled={loading}
            />
            <button
              onClick={handleAddItemGroup}
              className="bg-green-600 text-white py-3 px-6 rounded-lg font-semibold shadow-sm transition hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed"
              disabled={loading || newItemGroupName.trim() === ''}
            >
              {loading ? 'Adding...' : 'Add Group'}
            </button>
          </div>

          {loading ? (
            <p className="text-gray-500 text-center py-8">
              Syncing and loading item groups...
            </p>
          ) : itemGroups.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No item groups found. Add one manually or assign a 'group' to your items.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {itemGroups.map((group) => (
                <div
                  key={group.id}
                  className="relative flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200"
                >
                  {editingGroupId === group.id ? (
                    <div className="flex flex-col w-full">
                      <input
                        type="text"
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        className="w-full p-2 border border-blue-500 rounded-md mb-2 text-base"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit(group.id!);
                          }
                        }}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSaveEdit(group.id!)}
                          className="bg-green-500 text-white py-1 px-3 rounded-md transition hover:bg-green-600 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="bg-gray-400 text-white py-1 px-3 rounded-md transition hover:bg-gray-500 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="text-gray-800 font-medium break-all">
                        {group.name}
                      </span>
                      <div className="flex gap-2 flex-shrink-0 ml-2">
                        <button
                          onClick={() => handleEditClick(group)}
                          className="text-gray-600 hover:text-blue-500 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDeleteItemGroup(group.id!)}
                          className="text-gray-600 hover:text-red-500 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* 4. The "Done" button and its container have been removed from the bottom */}
    </div>
  );
};

export default ItemGroupPage;