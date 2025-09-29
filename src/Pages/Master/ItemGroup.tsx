import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { ItemGroup } from '../../constants/models';
import { useDatabase } from '../../context/auth-context';
import { ROUTES } from '../../constants/routes.constants';
import { CustomButton } from '../../Components';
import { Variant } from '../../enums';

const ItemGroupPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dbOperations = useDatabase();

  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newItemGroupName, setNewItemGroupName] = useState<string>('');

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (!dbOperations) return;

    const fetchItemGroups = async () => {
      setLoading(true);
      setError(null);
      try {
        const groups = await dbOperations.getItemGroups();
        setItemGroups(groups);
      } catch (err) {
        console.error('Error fetching item groups:', err);
        setError('Failed to load item groups.');
      } finally {
        setLoading(false);
      }
    };

    fetchItemGroups();
  }, [dbOperations]);

  const handleAddItemGroup = async () => {
    if (newItemGroupName.trim() === '') {
      setError('Item group name cannot be empty.');
      return;
    }
    if (!dbOperations) {
      setError('Database is not ready.');
      return;
    }
    setError(null);

    try {
      const newGroupData = { name: newItemGroupName.trim(), description: '' };
      const newGroupId = await dbOperations.createItemGroup(newGroupData);

      const newGroup: ItemGroup = {
        id: newGroupId,
        ...newGroupData,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      setItemGroups(prev => [...prev, newGroup]);
      setNewItemGroupName('');

    } catch (err) {
      console.error('Error adding item group:', err);
      setError('Failed to add item group.');
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
    if (!dbOperations) {
      setError('Database is not ready.');
      return;
    }
    setError(null);

    try {
      await dbOperations.updateItemGroup(id, { name: editingGroupName.trim() });

      setItemGroups(prev => prev.map(group =>
        group.id === id ? { ...group, name: editingGroupName.trim() } : group
      ));

      setEditingGroupId(null);
      setEditingGroupName('');
    } catch (err) {
      console.error('Error updating item group:', err);
      setError('Failed to update item group.');
    }
  };

  const handleCancelEdit = () => {
    setEditingGroupId(null);
    setEditingGroupName('');
    setError(null);
  };

  const handleDeleteItemGroup = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item group?')) {
      if (!dbOperations) {
        setError('Database is not ready.');
        return;
      }
      setError(null);
      try {
        await dbOperations.deleteItemGroup(id);
        setItemGroups(prev => prev.filter(group => group.id !== id));
      } catch (err) {
        console.error('Error deleting item group:', err);
        setError('Failed to delete item group.');
      }
    }
  };

  return (
    <div className="relative flex flex-col h-screen bg-gray-100 w-full font-poppins text-gray-800">
      {/* Fixed Top Bar */}
      <div className="flex flex-col p-4 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-4">Item Groups</h1>
        <div className="flex items-center justify-center gap-6">
          <CustomButton
            variant={Variant.Transparent}
            onClick={() => navigate(ROUTES.ITEM_ADD)}
            active={isActive(ROUTES.ITEM_ADD)}
          >
            Item Add
          </CustomButton>
          <CustomButton
            variant={Variant.Transparent}
            onClick={() => navigate(ROUTES.ITEM_GROUP)}
            active={isActive(ROUTES.ITEM_GROUP)}
          >
            Item Groups
          </CustomButton>
        </div>
      </div>

      {/* Main Content Area - This will be the scrollable part */}
      <div className="flex-grow p-4 bg-gray-50 w-full overflow-y-auto pb-24">
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg shadow-sm border border-red-200">
            <p className="font-semibold">{error}</p>
          </div>
        )}
        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex flex-col gap-2 mb-4">
            <input
              type="text"
              placeholder="New Item Group Name"
              value={newItemGroupName}
              onChange={(e) => setNewItemGroupName(e.target.value)}
              className="flex-1 w-full p-3 border border-gray-300 rounded-lg bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              onKeyPress={(e) => e.key === 'Enter' && handleAddItemGroup()}
              disabled={loading}
            />
            <button
              onClick={handleAddItemGroup}
              className="bg-sky-500 text-white py-3 px-6 rounded-lg font-semibold shadow-sm transition hover:bg-sky-700 disabled:bg-sky-300"
              disabled={loading || newItemGroupName.trim() === ''}
            >
              {loading ? 'Adding...' : 'Add Group'}
            </button>
          </div>

          {loading ? (
            <p className="text-gray-500 text-center py-8">Loading item groups...</p>
          ) : itemGroups.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No item groups found. Add a new one!</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {itemGroups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border"
                >
                  {editingGroupId === group.id ? (
                    <div className="flex flex-col w-full">
                      <input
                        type="text"
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        className="w-full p-2 border border-blue-500 rounded-md mb-2"
                        onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit(group.id!)}
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
                      <span className="text-gray-800 font-medium">{group.name}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditClick(group)}
                          className="text-gray-600 hover:text-blue-500 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"></path>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteItemGroup(group.id!)}
                          className="text-gray-600 hover:text-red-500 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            <line x1="10" x2="10" y1="11" y2="17"></line>
                            <line x1="14" x2="14" y1="11" y2="17"></line>
                          </svg>
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
    </div>
  );
};

export default ItemGroupPage;
