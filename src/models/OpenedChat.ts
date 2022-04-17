import Contact from '../models/Contact';
import Group from '../models/Group';
import ChatType from "../enums/ChatType";

export default interface OpenedChat {
    type: ChatType;
    data: Group | Contact;
}