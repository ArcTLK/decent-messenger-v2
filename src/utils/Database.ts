import Dexie, { IndexableType, liveQuery, Subscription, Table } from 'dexie';
import rsa from 'js-crypto-rsa';
import LogType from '../enums/LogType';
import AppData from '../models/AppData';
import Contact from '../models/Contact';
import Group from '../models/Group';
import Log from '../models/Log';
import StoredMessage from '../models/message/StoredMessage';

class Database extends Dexie {
    messages!: Table<StoredMessage>;
    contacts!: Table<Contact>;
    app!: Table<AppData>;
    logs!: Table<Log>;
    groups!: Table<Group>;

    logsSubscription: Subscription;

    constructor() {
        super('decent-db');
        this.version(14).stores({
            messages: '++id, [nonce+senderUsername+createdAt], receiverUsername, status, senderUsername',
            contacts: '++id, username',
            app: 'type',
            logs: '++id, done, groupId, timestamp',
            groups: '++id, [name+createdAt]'
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

            // db based logging
            this.logsSubscription = liveQuery(() => this.logs.where({ done: 1 }).toArray()).subscribe(async doneLogs => {
                const shownLogs: IndexableType[] = [];

                for (let log of doneLogs) {
                    const logs = await this.logs.where({ groupId: log.groupId }).sortBy('timestamp');
                    console.group(log.groupName);

                    for (let logItem of logs) {
                        if (logItem.type === LogType.Info) {
                            console.log(logItem.text);
                        }
                        else if (logItem.type === LogType.Warn) {
                            console.warn(logItem.text);
                        }
                        else if (logItem.type === LogType.Error) {
                            console.error(logItem.text);
                        }
                        shownLogs.push(logItem.id!);
                    }
                    console.groupEnd();
                }
                
                await this.logs.bulkDelete(shownLogs);
                
                // delete old logs
                this.logs.where('timestamp').belowOrEqual(new Date().getTime() - 1800000).toArray().then(logs => {
                    this.logs.bulkDelete(logs.map(x => x.id!));
                });           
            });
        }, true);
    }

    erase() {
        this.logsSubscription.unsubscribe();
        this.delete().then(() => db.open());
    }
}

const db = new Database();
export default db;