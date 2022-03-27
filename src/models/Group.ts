import Contact from "./Contact";

export default interface Group {
    name: string;
    members: Contact[];
    admins: Contact[];
    encryptionKey: string;
}