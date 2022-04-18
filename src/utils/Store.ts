import { createContext } from 'react';
import User from '../models/User';
import Contact from '../models/Contact';
import SnackbarState from "../models/SnackbarState";
import ContextModel from '../models/ContextModel';
import OpenedChat from '../models/OpenedChat';
import Action from '../models/Action';
import { Dispatch } from 'react';
import PeerBank from './PeerBank';
import { GroupManager } from './GroupManager';
import Peer from 'peerjs';

interface ContextStore {
    state: ContextModel,
    dispatch: Dispatch<Action>
}

export let initialState: ContextModel = {
    user: {} as User,
    currentOpenedChat: {} as OpenedChat,
    snackbar: {
        isOpen: false,
        type: 'info',
        message: '',
        autoHideDuration: 6000
    } as SnackbarState
};

export const SimpleObjectStore = {
    peerBank: new PeerBank(),
    groupManagers: <GroupManager[]>[],
    user: null as User | null,
    peerConnection: null as Peer | null
};

export const Context = createContext<ContextStore>({
    state: initialState,
    dispatch: () => undefined
});