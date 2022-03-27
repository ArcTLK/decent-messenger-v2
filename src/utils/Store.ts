import { createContext } from 'react';
import User from '../models/User';
import Contact from '../models/Contact';
import SnackbarState from "../models/SnackbarState";
import ContextModel from '../models/ContextModel';
import Action from '../models/Action';
import { Dispatch } from 'react';

interface ContextStore {
    state: ContextModel,
    dispatch: Dispatch<Action>
}

export let initialState: ContextModel = {
    user: {} as User,
    currentChatUser: {} as Contact,
    snackbar: {
        isOpen: false,
        type: 'info',
        message: '',
        autoHideDuration: 6000
    } as SnackbarState
};

export const Context = createContext<ContextStore>({
    state: initialState,
    dispatch: () => undefined
});