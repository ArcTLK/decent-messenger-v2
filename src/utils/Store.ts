import { createContext } from 'react';
import User from '../models/User';
import ContextModel from '../models/ContextModel';
import Action from '../models/Action';
import { Dispatch } from 'react';

interface ContextStore {
    state: ContextModel,
    dispatch: Dispatch<Action>
}

export let initialState: ContextModel = {
    user: ({} as User)
};

const cachedData = localStorage.getItem('cached-data');
if (cachedData) {
    initialState = JSON.parse(cachedData);
}

export const Context = createContext<ContextStore>({
    state: initialState,
    dispatch: () => undefined
});