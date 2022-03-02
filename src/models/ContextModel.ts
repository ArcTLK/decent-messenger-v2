import User from "./User";
import Contact from "./Contact";

export default interface ContextModel {
    user: User;
    currentChatUser: Contact;
}