import User from "./User";
import Contact from "./Contact";
import Message from "./Message";

export default interface ContextModel {
    user: User;
    currentChatUser: Contact;
    contactList: Contact[];
    messages: Message[];
}