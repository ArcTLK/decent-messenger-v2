import Dexie, { Table } from 'dexie';
import rsa from 'js-crypto-rsa';
import AppData from '../models/AppData';
import Contact from '../models/Contact';
import Log from '../models/Log';
import Message from '../models/Message';

class Database extends Dexie {
    messages!: Table<Message>;
    contacts!: Table<Contact>;
    app!: Table<AppData>;
    logs!: Table<Log>;

    constructor() {
        super('decent-db');
        this.version(5).stores({
            messages: '++id, [nonce+senderUsername], receiverUsername, status, senderUsername',
            contacts: '++id, username',
            app: 'type',
            logs: '++id'
        });

        this.on('ready', () => {
            // check if RSA key store exists
            this.app.get('rsa-keystore').then(async data => {
                if (!data) {
                    console.log('RSA Keystore not found, generating new key pair.');
                    // generate and store keys
                    const key = await rsa.generateKey(2048);
                    this.app.add({
                        type: 'rsa-keystore',
                        payload: JSON.stringify(key)
                    });
                }
            });
        }, true);
    }

    erase() {
        this.delete().then(() => db.open());
    }
}

const db = new Database();
export default db;