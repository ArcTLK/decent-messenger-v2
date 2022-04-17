import User from "./User";
import Contact from "./Contact";
import SnackbarState from "./SnackbarState";
import OpenedChat from "./OpenedChat";

export default interface ContextModel {
    user: User;
    currentOpenedChat: OpenedChat;
    snackbar: SnackbarState;
}