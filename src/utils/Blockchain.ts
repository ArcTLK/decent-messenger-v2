import Block from "../models/Block";

class Blockchain {
    blocks: Block[] = [];

    constructor() {
        this.blocks = [];
    }

    // unable to have methods, it says not a function later on after serialization
    // addBlock(block: Block) {
    //     if (this.blocks.findIndex(x => x.hash !== block.hash)) {
    //         this.blocks.push(block);
    //     }        
    // }
}

export default Blockchain;

