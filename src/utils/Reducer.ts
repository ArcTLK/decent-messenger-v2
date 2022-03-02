import Action from "../models/Action";
import ContextModel from "../models/ContextModel";

const updateState = (state: ContextModel, newState: Partial<ContextModel>): ContextModel => {
    const updatedState = {
        ...state,
        ...newState
    };
    
    return updatedState;
}

const Reducer = (state: ContextModel, action: Action): ContextModel => {
    switch (action.type) {
        case 'UpdateUser':
            return updateState(state, { user: { ...state.user, ...action.payload } });
        case 'UpdateCurrentChatUser':
            return updateState(state, { currentChatUser: { ...state.currentChatUser, ...action.payload } });
        default:
            return state;
    }
}

export default Reducer;