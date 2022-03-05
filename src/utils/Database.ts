import Dexie, { Table } from 'dexie';
import AppData from '../models/AppData';
import Contact from '../models/Contact';
import Message from '../models/Message';

class Database extends Dexie {
    messages!: Table<Message>;
    contacts!: Table<Contact>;
    app!: Table<AppData>;

    constructor() {
        super('decent-db');
        this.version(3).stores({
            messages: '++id, senderUsername, receiverUsername, status',
            contacts: '++id, username',
            app: 'type'
        });
    }

    erase() {
        this.delete().then(() => db.open());
    }
}

const db = new Database();
export default db;