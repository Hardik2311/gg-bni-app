import { db } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDoc,
  serverTimestamp,
  DocumentReference,
  writeBatch,
  getCountFromServer,
} from 'firebase/firestore';
import type { Item, ItemGroup } from '../constants/models';
import { Role, type User } from '../Role/permission';

//================================================================================
// PATTERN 1: MODULE-LEVEL INITIALIZATION (FOR BACKWARD COMPATIBILITY)
//================================================================================
// These functions rely on a single, module-wide companyId.
// This pattern is supported but using the factory function is recommended for new code.
//--------------------------------------------------------------------------------

let companyId: string | null = null;

/**
 * Initializes the Firestore operations with a specific company ID.
 * This MUST be called once after a user logs in for the top-level exported functions to work.
 * @param id The company ID of the logged-in user.
 */
export const initializeDbOperations = (id: string) => {
  if (!id) {
    throw new Error("A valid companyId must be provided to initialize DB operations.");
  }
  companyId = id;
};

// --- Helper Functions for Pattern 1 ---
const checkInitialization = () => {
  if (!companyId) {
    throw new Error("Firestore operations have not been initialized. Call initializeDbOperations(companyId) first.");
  }
};

const verifyOwnership = async (docRef: DocumentReference): Promise<boolean> => {
  checkInitialization();
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    return false;
  }
  const data = docSnap.data() as { companyId?: string };
  return data.companyId === companyId;
};


// --- Top-Level Exported Functions (Using module-level companyId) ---

const itemGroupCollectionRef = collection(db, 'itemGroups');
const itemCollectionRef = collection(db, 'items');

export const createItemGroup = async (itemGroup: Omit<ItemGroup, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>): Promise<string> => {
  checkInitialization();
  const docRef = await addDoc(itemGroupCollectionRef, { ...itemGroup, companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return docRef.id;
};
export const getItemGroups = async (): Promise<ItemGroup[]> => {
  checkInitialization();
  const q = query(itemGroupCollectionRef, where('companyId', '==', companyId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ItemGroup) }));
};
export const getItemGroupById = async (id: string): Promise<ItemGroup | null> => {
  const docRef = doc(db, 'itemGroups', id);
  if (!(await verifyOwnership(docRef))) return null;
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...(docSnap.data() as ItemGroup) } : null;
};
export const updateItemGroup = async (id: string, updates: Partial<Omit<ItemGroup, 'id' | 'createdAt' | 'companyId'>>): Promise<void> => {
  const itemGroupDoc = doc(db, 'itemGroups', id);
  if (!(await verifyOwnership(itemGroupDoc))) throw new Error("Permission denied.");
  await updateDoc(itemGroupDoc, { ...updates, updatedAt: serverTimestamp() });
};
export const deleteItemGroup = async (id: string): Promise<void> => {
  const itemGroupDoc = doc(db, 'itemGroups', id);
  if (!(await verifyOwnership(itemGroupDoc))) throw new Error("Permission denied.");
  await deleteDoc(itemGroupDoc);
};
export const createItem = async (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>): Promise<string> => {
  checkInitialization();
  const docRef = await addDoc(itemCollectionRef, { ...item, companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return docRef.id;
};
export const getItems = async (): Promise<Item[]> => {
  checkInitialization();
  const q = query(itemCollectionRef, where('companyId', '==', companyId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Item) }));
};
export const getItemById = async (id: string): Promise<Item | null> => {
  const docRef = doc(db, 'items', id);
  if (!(await verifyOwnership(docRef))) return null;
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...(docSnap.data() as Item) } : null;
};
export const getItemsByItemGroupId = async (itemGroupId: string): Promise<Item[]> => {
  checkInitialization();
  const q = query(itemCollectionRef, where('companyId', '==', companyId), where('itemGroupId', '==', itemGroupId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Item) }));
};
export const updateItem = async (id: string, updates: Partial<Omit<Item, 'id' | 'createdAt' | 'companyId'>>): Promise<void> => {
  const itemDoc = doc(db, 'items', id);
  if (!(await verifyOwnership(itemDoc))) throw new Error("Permission denied.");
  await updateDoc(itemDoc, { ...updates, updatedAt: serverTimestamp() });
};
export const deleteItem = async (id: string): Promise<void> => {
  const itemDoc = doc(db, 'items', id);
  if (!(await verifyOwnership(itemDoc))) throw new Error("Permission denied.");
  await deleteDoc(itemDoc);
};
export const getItemByBarcode = async (barcode: string): Promise<Item | null> => {
  checkInitialization();
  const q = query(itemCollectionRef, where('companyId', '==', companyId), where('barcode', '==', barcode));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...(doc.data() as Item) };
  }
  return null;
};

//================================================================================
// PATTERN 2: FACTORY FUNCTION (RECOMMENDED FOR NEW CODE)
//================================================================================
// This function returns a self-contained object with all database methods
// securely scoped to the provided companyId.
//--------------------------------------------------------------------------------

/**
 * ✅ RECOMMENDED: Factory Function for Firestore Operations.
 * Call this function with a companyId to get a set of database operations
 * that are securely scoped to that company.
 */
export const getFirestoreOperations = (companyId: string) => {
  if (!companyId) {
    throw new Error("A valid companyId must be provided to initialize Firestore operations.");
  }

  // Collection References
  const itemGroupRef = collection(db, 'itemGroups');
  const itemRef = collection(db, 'items');
  const usersRef = collection(db, 'users');

  // Scoped helper to verify document ownership
  const verifyOwnershipScoped = async (docRef: DocumentReference): Promise<boolean> => {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return false;
    const data = docSnap.data() as { companyId?: string };
    return data.companyId === companyId;
  };

  return {
    /**
     * ✅ CORRECTED: Fetches groups by finding unique names in 'items',
     * then gets the full group data from the 'itemGroups' collection.
     */
    getDistinctItemGroupsFromItems: async (): Promise<ItemGroup[]> => {
      const q = query(itemRef, where('companyId', '==', companyId));
      const itemsSnapshot = await getDocs(q);

      const groupNames = new Set<string>();
      itemsSnapshot.docs.forEach(doc => {
        const item = doc.data() as Item;
        // Check if itemGroupId exists and is a non-empty string
        if (item.itemGroupId && typeof item.itemGroupId === 'string') {
          groupNames.add(item.itemGroupId);
        }
      });

      if (groupNames.size === 0) {
        return [];
      }

      const groupsQuery = query(itemGroupRef, where('companyId', '==', companyId), where('name', 'in', Array.from(groupNames)));
      const groupsSnapshot = await getDocs(groupsQuery);

      return groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ItemGroup));
    },
    createItemGroup: async (itemGroup: Omit<ItemGroup, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>): Promise<string> => {
      const docRef = await addDoc(itemGroupRef, { ...itemGroup, companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return docRef.id;
    },
    getItemGroups: async (): Promise<ItemGroup[]> => {
      const q = query(itemGroupRef, where('companyId', '==', companyId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ItemGroup) }));
    },
    getItemGroupById: async (id: string): Promise<ItemGroup | null> => {
      const docRef = doc(db, 'itemGroups', id);
      if (!(await verifyOwnershipScoped(docRef))) return null;
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? { id: docSnap.id, ...(docSnap.data() as ItemGroup) } : null;
    },
    updateItemGroup: async (id: string, updates: Partial<Omit<ItemGroup, 'id' | 'createdAt' | 'companyId'>>): Promise<void> => {
      const itemGroupDoc = doc(db, 'itemGroups', id);
      if (!(await verifyOwnershipScoped(itemGroupDoc))) throw new Error("Permission denied.");
      await updateDoc(itemGroupDoc, { ...updates, updatedAt: serverTimestamp() });
    },
    deleteItemGroup: async (id: string): Promise<void> => {
      const itemGroupDoc = doc(db, 'itemGroups', id);
      if (!(await verifyOwnershipScoped(itemGroupDoc))) throw new Error("Permission denied.");
      await deleteDoc(itemGroupDoc);
    },

    /**
     * ✅ NEW FUNCTION: Updates a group's name and syncs this change across all relevant items.
     */
    updateGroupAndSyncItems: async (group: ItemGroup, newName: string): Promise<void> => {
      const { id, name: oldName } = group;
      if (!id) throw new Error("Group ID is missing.");

      const groupDocRef = doc(db, 'itemGroups', id);
      if (!(await verifyOwnershipScoped(groupDocRef))) throw new Error("Permission denied.");

      const batch = writeBatch(db);

      // 1. Update the canonical group document
      batch.update(groupDocRef, { name: newName, updatedAt: serverTimestamp() });

      // 2. Find and update all items using the old group name
      const itemsQuery = query(itemRef, where('companyId', '==', companyId), where('itemGroupId', '==', oldName));
      const itemsSnapshot = await getDocs(itemsQuery);
      itemsSnapshot.forEach(itemDoc => {
        batch.update(itemDoc.ref, { itemGroupId: newName });
      });

      // 3. Commit all changes atomically
      await batch.commit();
    },

    /**
     * ✅ NEW FUNCTION: Deletes a group only if no items are using it.
     */
    deleteItemGroupIfUnused: async (group: ItemGroup): Promise<void> => {
      const { id, name } = group;
      if (!id) throw new Error("Group ID is missing.");

      const groupDocRef = doc(db, 'itemGroups', id);
      if (!(await verifyOwnershipScoped(groupDocRef))) throw new Error("Permission denied.");

      // 1. Check if any items are using this group by name
      const itemsQuery = query(itemRef, where('companyId', '==', companyId), where('itemGroupId', '==', name));
      const countSnapshot = await getCountFromServer(itemsQuery);

      if (countSnapshot.data().count > 0) {
        throw new Error(`Cannot delete. This group is used by ${countSnapshot.data().count} item(s).`);
      }

      // 2. If not in use, delete the group document
      await deleteDoc(groupDocRef);
    },

    // --- Item Operations ---
    createItem: async (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>): Promise<string> => {
      const docRef = await addDoc(itemRef, { ...item, companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return docRef.id;
    },
    getItems: async (): Promise<Item[]> => {
      const q = query(itemRef, where('companyId', '==', companyId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Item) }));
    },
    getItemById: async (id: string): Promise<Item | null> => {
      const docRef = doc(db, 'items', id);
      if (!(await verifyOwnershipScoped(docRef))) return null;
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? { id: docSnap.id, ...(docSnap.data() as Item) } : null;
    },
    getItemsByItemGroupId: async (itemGroupId: string): Promise<Item[]> => {
      const q = query(itemRef, where('companyId', '==', companyId), where('itemGroupId', '==', itemGroupId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Item) }));
    },
    updateItem: async (id: string, updates: Partial<Omit<Item, 'id' | 'createdAt' | 'companyId'>>): Promise<void> => {
      const itemDoc = doc(db, 'items', id);
      if (!(await verifyOwnershipScoped(itemDoc))) throw new Error("Permission denied.");
      await updateDoc(itemDoc, { ...updates, updatedAt: serverTimestamp() });
    },
    deleteItem: async (id: string): Promise<void> => {
      const itemDoc = doc(db, 'items', id);
      if (!(await verifyOwnershipScoped(itemDoc))) throw new Error("Permission denied.");
      await deleteDoc(itemDoc);
    },
    getItemByBarcode: async (barcode: string): Promise<Item | null> => {
      const q = query(itemRef, where('companyId', '==', companyId), where('barcode', '==', barcode));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...(doc.data() as Item) };
      }
      return null;
    },

    // --- User Operations ---
    getSalesmen: async (): Promise<User[]> => {
      const q = query(usersRef, where('companyId', '==', companyId), where("role", "==", Role.Salesman));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as User[];
    },
    getWorkers: async (): Promise<User[]> => {
      const q = query(usersRef, where('companyId', '==', companyId), where("role", "in", [Role.Salesman, Role.Manager]));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as User[];
    },
  };
};