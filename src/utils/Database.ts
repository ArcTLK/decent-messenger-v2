import PouchDb from "pouchdb-browser";

const Database = {
    messages: new PouchDb('messages'),
    contacts: new PouchDb('contacts'),
    app: new PouchDb('app')
}

export function eraseDatabase() {
    Database.messages.destroy();
    Database.contacts.destroy();
    Database.app.destroy();
}

export default Database;