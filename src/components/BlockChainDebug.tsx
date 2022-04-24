import { ArrowLeft, ArrowRight, ReplayCircleFilledOutlined } from "@mui/icons-material";
import { Box, Divider, Grid, IconButton, Stack, Typography } from "@mui/material";
import { useContext, useEffect, useState } from "react";
import { Globals } from "../Constants";
import Group from "../models/Group";
import { GroupManager } from "../utils/GroupManager";
import { Context, SimpleObjectStore } from "../utils/Store";

const BlockChainDebug = () => {
    const {state, dispatch} = useContext(Context);

    const [groupManager, setGroupManager] = useState<GroupManager>();
    const [refreshState, setRefreshState] = useState<number>(0);
    const [viewingBlockIndex, setViewingBlockIndex] = useState<number>(-1);
    const [timer, setTimer] = useState<number>(0);

    useEffect(() => {
        const gm = SimpleObjectStore.groupManagers.find(x => x.group.name === state.currentOpenedChat.data.name && x.group.createdAt === (state.currentOpenedChat.data as Group).createdAt);
        setGroupManager(gm);
        if (gm && gm.group.blockchain && viewingBlockIndex === -1) {
            setViewingBlockIndex(gm.group.blockchain.blocks.length - 1);
        }

        const timeout = setTimeout(() => {
            setTimer(timer + 1);
        }, 1000);

        return () => {
            clearTimeout(timeout);
        }
    }, [state.currentOpenedChat.data, refreshState, timer]);   
    

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2.5, bgcolor: 'primary.main', gap: 1, alignItems: 'center' }}>
                <Typography variant="h6" component="div" sx={{ color: 'white' }}>Blockchain Debug View</Typography>
                <ReplayCircleFilledOutlined sx={{ color: 'white', cursor: 'pointer' }} onClick={() => setRefreshState(refreshState + 1)}></ReplayCircleFilledOutlined>
            </Box>            
            { 
                groupManager !== undefined && (
                    <>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: 2 }}>
                            <IconButton color="primary" disabled={viewingBlockIndex < 0}>
                                <ArrowLeft sx={{ fontSize: '2.5rem' }}></ArrowLeft>
                            </IconButton>
                            <Box sx={{ p: 1 }}>
                                {
                                    viewingBlockIndex === -1 ? (
                                        <Typography variant="h6" component="div">No blocks</Typography>
                                    ) : (
                                        <Box>

                                        </Box>
                                    )
                                }
                            </Box>
                            <IconButton color="primary" disabled={viewingBlockIndex === -1 || viewingBlockIndex >= groupManager.group.blockchain!.blocks.length - 1}>
                                <ArrowRight sx={{ fontSize: '2.5rem' }}></ArrowRight>
                            </IconButton>
                        </Stack>
                        <Box sx={{ p: 1, mt: 2 }}>
                            <Typography variant="h6" component="div">Status</Typography>
                            <Typography variant="body1" component="div">
                                {
                                    groupManager.connecting ? 'Connecting' :
                                    groupManager.connected ? 
                                    groupManager.roundRobinList[groupManager.roundRobinIndex].username === SimpleObjectStore.user!.username ? 'Block Creator' : 'Connected' :
                                    'Loading'
                                }
                            </Typography>
                            <Typography variant="h6" component="div" sx={{mt: 2}}>
                                Round Robin List
                            </Typography>
                            <Grid container spacing={2}>
                                {
                                    groupManager.roundRobinList.map((contact, index) => (
                                        <Grid key={index} item xs={6}>
                                            <Typography variant="body2" component="div"
                                            sx={index === groupManager.roundRobinIndex ? {
                                                bgcolor: 'primary.main',
                                                color: 'white',
                                                p: 1,
                                                textAlign: 'center'
                                            } : { p: 1, textAlign: 'center' }}>{contact.username}</Typography>
                                        </Grid>
                                    ))
                                }                            
                            </Grid>
                            <Typography variant="body2" component="div" sx={{mt: 2}}>
                                Time elapsed: {timer} seconds
                            </Typography>
                        </Box>                        
                        
                        {
                            groupManager.roundRobinList[groupManager.roundRobinIndex].username === SimpleObjectStore.user?.username && (
                                <Box sx={{ my: 2, pb: 1, boxShadow: 3 }}>
                                    <Box sx={{ p: 2, bgcolor: 'primary.main' }}>
                                        <Typography variant="h6" component="div" sx={{ color: 'white' }}>Creating Block #{groupManager.group.blockchain ? groupManager.group.blockchain.blocks.length : 0 }</Typography>
                                    </Box>
                                    {groupManager.messages && groupManager.messages.length > 0 ? (
                                        <Stack divider={<Divider flexItem />} spacing={1} sx={{ m: 2 }}>
                                            {
                                                groupManager.messages.map((message, index) => (
                                                    <Box key={index}>
                                                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                            <Typography variant="body1" component="div">{message.senderUsername}</Typography>
                                                            <Typography variant="body2" component="div">{new Date(message.createdAt).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}</Typography>
                                                        </Stack>                                            
                                                        <Typography variant="body2" component="div">{message.message}</Typography>                                            
                                                    </Box> 
                                                ))
                                            }
                                        </Stack>
                                    ) : (
                                        <Box sx={{ m: 2 }}>
                                            <Typography variant="body1" component="div">No messages received.</Typography>
                                        </Box>
                                    )}                                                   
                                </Box>
                            )
                        }
                    </>
                )
            }            
        </Box>
    );
}

export default BlockChainDebug;