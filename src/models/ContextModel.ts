import User from "./User";
import Contact from "./Contact";
import SnackbarState from "./SnackbarState";

export default interface ContextModel {
    user: User;
    currentChatUser: Contact;
    snackbar: SnackbarState;
}