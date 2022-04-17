import Blockchain from "../utils/Blockchain";
import Contact from "./Contact";

export default interface Group {
    name: string;
    members: Contact[];
    admins: Contact[];
    encryptionKey: string;
    createdAt: number;
    blockchain?: Blockchain[];
}