import Contact from "./Contact";
import Message from "./Message";

export default interface Chat {
    messages: Message[];
    participants: Contact[];

}