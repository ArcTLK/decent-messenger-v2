import User from "./User";
import Contact from "./Contact";
import Message from "./Message";

export default interface AppData {
    type: string;
    payload: string;
}