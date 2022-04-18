import { DataConnection } from "peerjs";
import Contact from "../models/Contact";
import Group from "../models/Group";
import { askForBlockCreator } from "./Election";

export class GroupManager {
    group: Group;
    roundRobinList: Contact[] = [];
    roundRobinIndex: number;

    connections: DataConnection[] = [];

    constructor(group: Group) {
        this.group = group;
        this.roundRobinList = this.group.admins.concat(this.group.members);
    }

    connect() {
        // check if already knows block creator
        if (!this.roundRobinIndex) {
            // inquire who is currently the block creator from random online member
            const randomizedList = this.roundRobinList
                .map(value => ({ value, sort: Math.random() }))
                .sort((a, b) => a.sort - b.sort)
                .map(({ value }) => value);
            
            for (let contact of randomizedList) {
                // askForBlockCreator(contact.username);
            }

        }
    }

    async terminate() {
        // TODO: close all connections

    }
}