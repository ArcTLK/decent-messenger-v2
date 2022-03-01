import PouchDb from "pouchdb-browser";

const Database = {
    messages: new PouchDb('messages'),
    contacts: new PouchDb('contacts'),
    app: new PouchDb('app')
}

export default Database;