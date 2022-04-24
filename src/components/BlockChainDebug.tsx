import { ReplayCircleFilledOutlined } from "@mui/icons-material";
import { Box, Typography } from "@mui/material";
import { useContext, useEffect, useState } from "react";
import Group from "../models/Group";
import { GroupManager } from "../utils/GroupManager";
import { Context, SimpleObjectStore } from "../utils/Store";

const BlockChainDebug = () => {
    const {state, dispatch} = useContext(Context);

    const [groupManager, setGroupManager] = useState<GroupManager>();
    const [refreshState, setRefreshState] = useState<number>(0);

    useEffect(() => {
        const gm = SimpleObjectStore.groupManagers.find(x => x.group.name === state.currentOpenedChat.data.name && x.group.createdAt === (state.currentOpenedChat.data as Group).createdAt);
        setGroupManager(gm);
    }, [state.currentOpenedChat.data, refreshState]);   
    

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2.5, bgcolor: 'primary.main', gap: 1, alignItems: 'center' }}>
                <Typography variant="h6" component="div" sx={{ color: 'white' }}>Blockchain Debug View</Typography>
                <ReplayCircleFilledOutlined sx={{ color: 'white', cursor: 'pointer' }} onClick={() => setRefreshState(refreshState + 1)}></ReplayCircleFilledOutlined>
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