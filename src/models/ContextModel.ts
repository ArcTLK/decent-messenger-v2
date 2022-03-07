import User from "./User";
import Contact from "./Contact";
import Message from "./Message";
import SnackbarState from "./SnackbarState";

export default interface ContextModel {
    user: User;
    currentChatUser: Contact;
    snackbar: SnackbarState;
}