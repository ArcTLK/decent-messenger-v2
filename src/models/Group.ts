import { IndexableType } from "dexie";
import Blockchain from "../utils/Blockchain";
import { BlockMessageItem } from "./Block";
import Contact from "./Contact";

export default interface Group {
    name: string;
    members: Contact[];
    admins: Contact[];
    encryptionKey: string;
    createdAt: number;
    blockchain?: Blockchain;
    unsentMessages?: BlockMessageItem[];
}