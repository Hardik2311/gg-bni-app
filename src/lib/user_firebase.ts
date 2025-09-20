import { db } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { type User, Role } from '../Role/permission';

export const getSalesmen = async (): Promise<User[]> => {
    const usersCollection = collection(db, 'users');
    const salesmenQuery = query(usersCollection, where("role", "==", Role.Salesman));

    const userSnapshot = await getDocs(salesmenQuery);

    const userList = userSnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
    })) as User[];

    return userList;
};
export const getWorkers = async (): Promise<User[]> => {
    const usersCollection = collection(db, 'users');

    const salesmenQuery = query(
        usersCollection,
        where("role", "in", [Role.Salesman, Role.Manager])
    );

    const userSnapshot = await getDocs(salesmenQuery);

    const userList = userSnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
    })) as User[];

    return userList;
};