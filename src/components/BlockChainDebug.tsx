import { Box, Typography } from "@mui/material";
import { useContext, useEffect, useState } from "react";
import Group from "../models/Group";
import { GroupManager } from "../utils/GroupManager";
import { Context, SimpleObjectStore } from "../utils/Store";

const BlockChainDebug = () => {
    const {state, dispatch} = useContext(Context);

    const [groupManager, setGroupManager] = useState<GroupManager>();

    useEffect(() => {
        const gm = SimpleObjectStore.groupManagers.find(x => x.group.name === state.currentOpenedChat.data.name && x.group.createdAt === (state.currentOpenedChat.data as Group).createdAt);
        setGroupManager(gm);

        var interval = setInterval(() => {
            const gm = SimpleObjectStore.groupManagers.find(x => x.group.name === state.currentOpenedChat.data.name && x.group.createdAt === (state.currentOpenedChat.data as Group).createdAt);
            setGroupManager(gm);
        }, 3000);

        return () => {
            clearInterval(interval);
        }

    }, [state.currentOpenedChat.data]);   
    

    return (
        <Box>
            <Box sx={{ p: 2.5, bgcolor: 'primary.main' }}>
                <Typography variant="h6" component="div" sx={{ color: 'white' }}>Blockchain Debug View</Typography>
            </Box>            
            { 
                groupManager !== undefined && (
                    <Box sx={{ p: 1 }}>
                        <Typography variant="body1" component="div">Status</Typography>
                        <Typography variant="body2" component="div">
                            {
                                groupManager.connecting ? 'Connecting' :
                                groupManager.connected ? 
                                groupManager.roundRobinList[groupManager.roundRobinIndex].username === SimpleObjectStore.user!.username ? 'Block Creator' : 'Connected' :
                                'Loading'
                            }
                        </Typography>
                    </Box>
                )
            }            
        </Box>
    );
}

export default BlockChainDebug;