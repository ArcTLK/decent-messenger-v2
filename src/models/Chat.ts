import Contact from "./Contact";
import StoredMessage from "./message/StoredMessage";

export default interface Chat {
    messages: StoredMessage[];
    participants: Contact[];

}