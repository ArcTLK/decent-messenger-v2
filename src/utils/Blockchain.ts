import Block from "../models/Block";

class Blockchain {
    blocks: Block[];

    addBlock(block: Block) {
        this.blocks.push(block);
    }
}

export default Blockchain;

